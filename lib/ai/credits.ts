import "server-only";
// Prepaid credits: the money-out + money-in logic that sits between the AI
// features and the creed_credits balance. BYOK stays untouched; credits mode
// runs on the platform OpenRouter key and bills the user's prepaid balance.
//
// All balance mutations go through the two service-role RPCs (credit_topup /
// debit_credits). This module owns the only calls to them, plus the read-side
// helpers for the settings UI.
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SupabaseLikeClient } from "@/lib/supabase/types";
import { CREDIT_MARKUP } from "@/lib/ai/credit-config";
import { DEFAULT_AI_MODEL_ID, getAiModel } from "@/lib/ai/model-catalog";
import { readAiSettings, type AiMode } from "@/lib/ai/persistence";
import { decryptSecret } from "@/lib/secret-crypto";
import { log } from "@/lib/observability";

// Floor every debit so a near-zero estimate still records a charge, and a
// mispriced model can never hand out a genuinely free run. 1000 micro = $0.001.
const MIN_DEBIT_MICRO = 1000;
const MICRO_PER_USD = 1_000_000;

type RpcClient = {
  rpc: (
    fn: string,
    params: Record<string, unknown>
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

export type ResolvedAiCredential = {
  apiKey: string;
  modelId: string;
  mode: AiMode;
};

export type PublicCreditTransaction = {
  id: string;
  type: "topup" | "debit";
  amountUsd: number;
  balanceAfterUsd: number;
  feature: string | null;
  modelId: string | null;
  createdAt: string;
};

export type CreditsState = {
  balanceMicroUsd: number;
  balanceUsd: number;
  transactions: PublicCreditTransaction[];
};

export function getOpenRouterPlatformKey(): string {
  const value = process.env.OPENROUTER_PLATFORM_KEY?.trim();
  if (!value) {
    // Credits-specific copy. Never surface the BYOK "paste a key" error to a
    // credits user, who has no key to paste.
    throw new Error("Credits are temporarily unavailable");
  }
  return value;
}

function microToUsd(micro: number) {
  return micro / MICRO_PER_USD;
}

async function readBalanceMicro(client: unknown, userId: string): Promise<number> {
  const db = client as SupabaseLikeClient;
  const { data, error } = await db
    .from("creed_credits")
    .select("balance_micro_usd")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    log.error("credit_balance_read_failed", { userId, message: error.message });
    throw new Error("Credits are temporarily unavailable");
  }
  const row = data as { balance_micro_usd?: number | string } | null;
  return row ? Number(row.balance_micro_usd) || 0 : 0;
}

// Pick the key + model for an AI call based on the user's ai_mode. BYOK reuses
// the existing per-user-key path. Credits validates that the platform key is
// configured, the model is billable, and the balance is positive, then returns
// the platform key. The balance gate reads via the admin client so the money
// decision never depends on RLS being correctly applied to the caller's client.
export async function resolveAiCredential(
  client: unknown,
  userId: string
): Promise<ResolvedAiCredential> {
  const row = await readAiSettings(client, userId);
  const mode: AiMode = row?.ai_mode === "byok" ? "byok" : "credits";

  if (mode === "byok") {
    // Reuse the row already loaded above instead of re-reading settings.
    const encryptedKey = row?.encrypted_api_key;
    if (!encryptedKey || row?.key_status !== "valid") {
      throw new Error("Add an OpenRouter key in Settings");
    }
    return {
      apiKey: decryptSecret(encryptedKey),
      modelId: row?.selected_model_id || DEFAULT_AI_MODEL_ID,
      mode: "byok",
    };
  }

  const apiKey = getOpenRouterPlatformKey();
  const modelId = row?.selected_model_id || DEFAULT_AI_MODEL_ID;

  // A model the catalog prices at $0 would let credits users run for free while
  // we pay real money on the platform key. Refuse it in credits mode.
  const model = await getAiModel(modelId);
  if (model.inputCostPerMillion <= 0 && model.outputCostPerMillion <= 0) {
    throw new Error("That model isn't available on credits");
  }

  const balanceMicro = await readBalanceMicro(getSupabaseAdminClient(), userId);
  if (balanceMicro <= 0) {
    throw new Error("Out of credits");
  }

  return { apiKey, modelId, mode: "credits" };
}

// Deduct realCost x markup after a successful call. The OpenRouter spend has
// already happened, so a failure here must NOT fail the user's request: we log
// it at error level so the gap can be reconciled against creed_ai_usage, rather
// than silently dropping the charge.
export async function deductCredits({
  userId,
  costUsd,
  feature,
  modelId,
}: {
  userId: string;
  costUsd: number;
  feature: string;
  modelId: string;
}): Promise<number | null> {
  const micro = Math.max(MIN_DEBIT_MICRO, Math.ceil(costUsd * CREDIT_MARKUP * MICRO_PER_USD));
  const admin = getSupabaseAdminClient() as unknown as RpcClient;
  const { data, error } = await admin.rpc("debit_credits", {
    p_user_id: userId,
    p_amount_micro: micro,
    p_feature: feature,
    p_model_id: modelId,
  });
  if (error) {
    log.error("credit_debit_failed_after_spend", {
      userId,
      micro,
      feature,
      modelId,
      message: error.message,
    });
    return null;
  }
  // debit_credits returns the post-debit balance in micro-USD.
  const balanceMicro = typeof data === "number" || typeof data === "string" ? Number(data) : NaN;
  return Number.isFinite(balanceMicro) ? balanceMicro / MICRO_PER_USD : null;
}

// Idempotent money-in, called by the Stripe webhook after a PaymentIntent
// succeeds. The RPC dedupes on the PaymentIntent id, so a Stripe redelivery is
// a no-op.
export async function creditTopup({
  userId,
  amountMicro,
  paymentIntentId,
}: {
  userId: string;
  amountMicro: number;
  paymentIntentId: string;
}): Promise<void> {
  const admin = getSupabaseAdminClient() as unknown as RpcClient;
  const { error } = await admin.rpc("credit_topup", {
    p_user_id: userId,
    p_amount_micro: amountMicro,
    p_payment_intent_id: paymentIntentId,
  });
  if (error) {
    log.error("credit_topup_failed", { userId, paymentIntentId, message: error.message });
    throw new Error("Could not credit balance");
  }
}

// Balance + recent ledger for the settings UI. Reads via the caller's session
// client (RLS select-own), so no admin escalation for a user reading their own.
export async function getCreditsState(client: unknown, userId: string): Promise<CreditsState> {
  const db = client as SupabaseLikeClient;
  const [balanceResult, txResult] = await Promise.all([
    db.from("creed_credits").select("balance_micro_usd").eq("user_id", userId).maybeSingle(),
    db
      .from("creed_credit_transactions")
      .select("id, type, amount_micro_usd, balance_after_micro_usd, feature, model_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(25),
  ]);

  if (balanceResult.error) {
    log.error("credits_state_balance_failed", { userId, message: balanceResult.error.message });
    throw new Error("Could not load credits");
  }
  if (txResult.error) {
    log.error("credits_state_history_failed", { userId, message: txResult.error.message });
    throw new Error("Could not load credits");
  }

  const balanceRow = balanceResult.data as { balance_micro_usd?: number | string } | null;
  const balanceMicroUsd = balanceRow ? Number(balanceRow.balance_micro_usd) || 0 : 0;

  const rows =
    (txResult.data as Array<{
      id: string;
      type: "topup" | "debit";
      amount_micro_usd: number | string;
      balance_after_micro_usd: number | string;
      feature: string | null;
      model_id: string | null;
      created_at: string;
    }> | null) ?? [];

  const transactions: PublicCreditTransaction[] = rows.map((row) => ({
    id: row.id,
    type: row.type,
    amountUsd: microToUsd(Number(row.amount_micro_usd) || 0),
    balanceAfterUsd: microToUsd(Number(row.balance_after_micro_usd) || 0),
    feature: row.feature,
    modelId: row.model_id,
    createdAt: row.created_at,
  }));

  return {
    balanceMicroUsd,
    balanceUsd: microToUsd(balanceMicroUsd),
    transactions,
  };
}
