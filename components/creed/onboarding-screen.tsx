"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AnimatedCheckmark } from "@/components/ui/animated-checkmark";
import { ArrowRightIcon } from "@/components/ui/arrow-right";
import { CopyIcon } from "@/components/ui/copy";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CreedWordmark, IntegrationGlyph } from "@/components/creed/brand";
import { ConnectionCard, resolveConnectionStatus } from "@/components/creed/connection-card";
import { useCreed } from "@/components/creed/creed-provider";
import { RichTextEditor } from "@/components/creed/rich-text-editor";
import { useStripeCheckout } from "@/components/marketing/use-stripe-checkout";
import {
  accentColorMap,
  type CreedSection,
  type McpClient,
  type OnboardingState,
} from "@/lib/creed-data";
import { getCreedPromptText } from "@/lib/creed-prompts";
import { splitPreservingLigatures } from "@/lib/landing-text";
import {
  CREED_TYPE_OPTIONS,
  buildOnboardingPreviewSections,
  compileOnboardingDraft,
  getCreedTypeDefinition,
} from "@/lib/onboarding/compile";
import { cn } from "@/lib/utils";

// 9-step flow indexed 0-8: vibe / identity / direction / tools / preferences /
// daily context / connect / compose / preview. The questionnaire feeds a
// deterministic seed draft; the connected agent composes the real initial
// Creed, which the user reviews on the preview step before entering the app.
// Each step picks an accent for the top progress bar so the colour subtly
// tracks where the user is in the flow.
const TOTAL_STEPS = 9;
const CONNECT_STEP = 6;
const COMPOSE_STEP = 7;
const PREVIEW_STEP = 8;
// Advancing past the last questionnaire step silently claims the seed draft so
// the agent has onboarding context to read over MCP before it composes.
const FINAL_QUESTION_STEP = CONNECT_STEP - 1;

const stepAccentMap = [
  accentColorMap.identity, // 0 vibe
  accentColorMap.identity, // 1 identity
  accentColorMap.projects, // 2 direction (goals + work)
  accentColorMap.tools, // 3 tools
  accentColorMap.preferences, // 4 preferences + constraints
  accentColorMap.workflows, // 5 daily context
  "#2563EB", // 6 connect
  accentColorMap.identity, // 7 compose
  accentColorMap.identity, // 8 preview
];

// Vibe accent colours: blue / green / orange / purple - matched to the
// 4 onboarding personas in CREED_TYPE_OPTIONS order.
const typeThemes: Record<OnboardingState["creedType"], { accent: string; tint: string }> = {
  personal: { accent: "#2563EB", tint: "#DBEAFE" }, // blue
  builder: { accent: "#059669", tint: "#D1FAE5" }, // green
  creative: { accent: "#EA580C", tint: "#FFEDD5" }, // orange
  custom: { accent: "#7C3AED", tint: "#EDE9FE" }, // purple
};

const defaultStepTitle = "Pick the closest vibe.";
const defaultStepSubtitle = "It only changes the question wording and examples.";

// MCP clients report names like "Claude Code (creed)" - the trailing
// "(<server alias>)" is just the local connector name and is noise in the UI.
function agentDisplayName(name: string) {
  return name.replace(/\s*\([^)]*\)\s*$/, "").trim() || name;
}

export function OnboardingScreen({
  paid,
  initialStage,
}: {
  paid: boolean;
  initialStage?: "connect" | "preview";
}) {
  const router = useRouter();
  const { state, updateOnboarding, claimOnboardingPreview } = useCreed();
  const { startCheckout, submitting: checkoutSubmitting } = useStripeCheckout();
  const [step, setStep] = useState(
    initialStage === "preview" ? PREVIEW_STEP : initialStage === "connect" ? CONNECT_STEP : 0
  );
  const [groupOther, setGroupOther] = useState<string | null>(null);
  const [groupOtherValue, setGroupOtherValue] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);
  const creedTypeDefinition = getCreedTypeDefinition(state.onboarding.creedType);
  const typeTheme = typeThemes[state.onboarding.creedType];
  const currentAccent =
    step === 0 || step === 1 || step === TOTAL_STEPS - 1 ? typeTheme.accent : stepAccentMap[step];
  const currentToolGroups = creedTypeDefinition.toolsGroups;
  const previewSections = useMemo(
    () => buildOnboardingPreviewSections(compileOnboardingDraft(state.onboarding)),
    [state.onboarding]
  );

  // The Connect step polls /api/app/state directly (effect below) and overrides
  // the provider's roster the moment an agent registers - so detection is
  // near-instant even for CLI agents (Codex, Claude Code, OpenCode) that never
  // trigger the provider's focus/visibility sync. Falls back to provider state.
  const [serverMcpClients, setServerMcpClients] = useState<McpClient[] | null>(null);
  // Prefer the live provider roster once it has anything; the polled snapshot is
  // just the fast-path bridge until the provider's slower sync catches up, so it
  // never goes stale (e.g. a second agent connecting later still shows up).
  const mcpClients = state.mcpClients.length > 0 ? state.mcpClients : (serverMcpClients ?? []);

  // Connect gate: connected once the roster has any client (or the provider has
  // already marked the session connected).
  const connected = state.mcpStatus === "connected" || mcpClients.length > 0;
  // Compose "write landed" signal. The Compose step polls the server directly
  // (effect below) and flips these the moment an agent-authored section appears,
  // independent of the provider's background-sync merge guard - which during
  // onboarding can refuse to adopt the agent's compose and leave the screen
  // stuck on "waiting" until a manual refresh.
  const [submittedViaServer, setSubmittedViaServer] = useState(false);
  const [serverComposedSections, setServerComposedSections] = useState<CreedSection[] | null>(null);
  const composedSections = serverComposedSections ?? state.sections;
  const composed =
    submittedViaServer || composedSections.some((section) => section.lastEditedType === "agent");
  // Which agent composed (compose_creed is one-time, so at most one). Used to
  // attribute the finished Creed on the Compose step.
  const composerName =
    composedSections.find((section) => section.lastEditedType === "agent")?.lastEditedBy ?? null;

  // Has a given connected agent actually sent a Creed? compose is one-time, so
  // with a single agent the composer is unambiguous; with several we match the
  // composer by alias-stripped name.
  const isAgentSubmitted = (clientName: string) =>
    composed &&
    (mcpClients.length === 1 ||
      agentDisplayName(clientName).toLowerCase() ===
        agentDisplayName(composerName ?? "").toLowerCase());
  const submittedCount = mcpClients.filter((client) => isAgentSubmitted(client.name)).length;
  const allSubmitted = mcpClients.length > 0 && submittedCount === mcpClients.length;

  // Roster of connected agents with their submit status, shown on the Compose
  // step so the user can see which agent(s) have actually sent a Creed - works
  // whether they have one agent or several connected.
  const connectedAgentsRoster =
    mcpClients.length > 0 ? (
      <div className="mx-auto flex w-full max-w-md flex-col gap-2">
        {mcpClients.map((client) => {
          const submitted = isAgentSubmitted(client.name);
          return (
            <div
              key={client.id}
              className="flex items-center justify-between gap-3 rounded-[12px] border border-[var(--creed-border)] bg-[var(--creed-surface)] px-3 py-2.5"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <IntegrationGlyph kind={client.icon} framed={false} className="h-6 w-6 shrink-0" />
                <span className="truncate text-[14px] text-[var(--creed-text-primary)]">
                  {agentDisplayName(client.name)}
                </span>
              </div>
              {submitted ? (
                <span className="flex shrink-0 items-center gap-1.5 text-[12px] text-[var(--creed-text-secondary)]">
                  <span className="h-2 w-2 rounded-[3px] bg-[#16A34A]" />
                  Submitted
                </span>
              ) : (
                <span className="flex shrink-0 items-center gap-1.5 text-[12px] text-[var(--creed-text-tertiary)]">
                  <span className="h-2 w-2 rounded-[3px] bg-[var(--creed-border-strong)]" />
                  Not submitted
                </span>
              )}
            </div>
          );
        })}
      </div>
    ) : null;

  // A returning PAID user who already has a composed Creed skips onboarding and
  // goes straight to /file. We gate on `paid` so unpaid composed users (whom the
  // app layout sends here to pay) are NOT bounced - that would loop them
  // /file <-> /onboarding. They instead start on the preview (via initialStage)
  // with the "Get Creed" button. We only bounce at step 0, never mid-flow.
  useEffect(() => {
    if (paid && step === 0 && composed) {
      router.replace("/file");
    }
  }, [router, paid, step, composed]);

  // On the Compose step, poll the server directly so the screen flips the moment
  // the agent's compose lands. We read /api/app/state ourselves rather than going
  // through the provider, whose background-sync merge guard can refuse to adopt
  // the agent's sections mid-onboarding; this path can't be blocked. (The roster
  // of connected agents stays fresh via the provider's own background sync.)
  useEffect(() => {
    if (step !== COMPOSE_STEP || composed) {
      return;
    }
    let cancelled = false;
    async function checkForCompose() {
      try {
        const res = await fetch("/api/app/state", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { state?: { sections?: CreedSection[] } };
        const sections = data.state?.sections ?? [];
        if (!cancelled && sections.some((section) => section.lastEditedType === "agent")) {
          setServerComposedSections(sections);
          setSubmittedViaServer(true);
        }
      } catch {
        // Ignore transient poll errors; the next tick retries.
      }
    }
    const id = window.setInterval(checkForCompose, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [step, composed]);

  // On the Connect step, poll the roster directly so the card flips within a few
  // seconds even for CLI agents that never trigger the provider's focus sync.
  // Stops as soon as a client appears (the `connected` dep re-runs the effect).
  useEffect(() => {
    if (step !== CONNECT_STEP || connected) {
      return;
    }
    let cancelled = false;
    async function checkForConnect() {
      try {
        const res = await fetch("/api/app/state", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { state?: { mcpClients?: McpClient[] } };
        const clients = data.state?.mcpClients ?? [];
        if (!cancelled && clients.length > 0) {
          setServerMcpClients(clients);
        }
      } catch {
        // Ignore transient poll errors; the next tick retries.
      }
    }
    void checkForConnect();
    const id = window.setInterval(checkForConnect, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [step, connected]);

  function toggleCommunicationStyle(
    option: "Direct" | "Collaborative" | "Thorough" | "Concise"
  ) {
    const current = state.onboarding.communicationStyle;
    const next = current.includes(option)
      ? current.filter((item) => item !== option)
      : [...current, option];

    updateOnboarding({
      communicationStyle: next,
    });
  }

  function updateStack(group: string, value: string) {
    const current = state.onboarding.stackSelections[group] ?? [];
    const next = current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value];

    updateOnboarding({
      stackSelections: {
        ...state.onboarding.stackSelections,
        [group]: next,
      },
    });
  }

  function addGroupOther() {
    const next = groupOtherValue.trim();

    if (!groupOther || !next) {
      return;
    }

    const current = state.onboarding.stackSelections[groupOther] ?? [];
    if (current.some((item) => item.toLowerCase() === next.toLowerCase())) {
      setGroupOtherValue("");
      setGroupOther(null);
      return;
    }

    updateOnboarding({
      stackSelections: {
        ...state.onboarding.stackSelections,
        [groupOther]: [...current, next],
      },
    });
    setGroupOtherValue("");
    setGroupOther(null);
  }

  const handleContinue = useCallback(async () => {
    if (step === FINAL_QUESTION_STEP) {
      // Silently claim the deterministic seed draft so the agent has onboarding
      // context to read over MCP, then move to Connect. The draft is never
      // shown as a finished Creed - the connected agent composes the real
      // initial Creed at the final step.
      if (claiming) return;
      setClaiming(true);
      try {
        await claimOnboardingPreview(previewSections);
        setStep(CONNECT_STEP);
      } finally {
        setClaiming(false);
      }
      return;
    }
    if (step === CONNECT_STEP) {
      // Hard gate: only advance once an agent is connected.
      if (!connected) return;
      setStep(COMPOSE_STEP);
      return;
    }
    if (step === COMPOSE_STEP) {
      // Hard gate: only advance once an agent has composed the Creed.
      if (!composed) return;
      setStep(PREVIEW_STEP);
      return;
    }
    setStep((current) => Math.min(current + 1, TOTAL_STEPS - 1));
  }, [step, claiming, connected, composed, previewSections, claimOnboardingPreview]);

  useEffect(() => {
    function onWindowKeyDown(event: KeyboardEvent) {
      if (step >= TOTAL_STEPS - 1 || claiming) {
        return;
      }

      if (
        event.key !== "Enter" ||
        event.shiftKey ||
        event.altKey ||
        event.metaKey ||
        event.ctrlKey
      ) {
        return;
      }

      const target = event.target as HTMLElement | null;
      if (!target) {
        return;
      }

      if (target.closest("[data-disable-continue='true']")) {
        return;
      }

      event.preventDefault();
      handleContinue();
    }

    window.addEventListener("keydown", onWindowKeyDown);

    return () => {
      window.removeEventListener("keydown", onWindowKeyDown);
    };
  }, [claiming, step, handleContinue]);

  function handleFinish() {
    // The agent composed the Creed server-side, so the provider's in-memory
    // state may still hold the seed (its background-sync guard won't overwrite
    // local sections mid-flow). Use a full navigation so /file reloads from
    // server state and renders the composed Creed rather than the seed.
    window.location.href = "/file";
  }

  async function handleCopyPrompt() {
    await navigator.clipboard.writeText(getCreedPromptText("compose-my-creed"));
    setPromptCopied(true);
    window.setTimeout(() => setPromptCopied(false), 1600);
  }

  return (
    <div className="min-h-dvh bg-[var(--creed-surface)] md:h-screen md:overflow-hidden">
      <motion.div
        className="h-[2px]"
        animate={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%`, backgroundColor: currentAccent }}
        transition={{ duration: 1.45, ease: [0.32, 0.06, 0.18, 1] }}
      />

      <div className="flex min-h-[calc(100dvh-2px)] flex-col px-6 py-5 md:h-[calc(100vh-2px)] md:px-10 md:py-6">
        <div className="flex items-center justify-between">
          <CreedWordmark />
          <div className="text-[12px] text-[var(--creed-text-tertiary)]">{`${step + 1} of ${TOTAL_STEPS}`}</div>
        </div>

        <div className="flex min-h-0 flex-1 items-start justify-center py-8 md:items-center md:py-4">
          <div className="w-full max-w-[1080px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 16, filter: "blur(8px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -10, filter: "blur(6px)" }}
                transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              >
                <StepFrame
                  wide={step === 3 || step >= CONNECT_STEP}
                  narrow={step === 0}
                >
                  {/* Step 0 - vibe picker */}
                  {step === 0 ? (
                    <OnboardingStep title={defaultStepTitle} subtitle={defaultStepSubtitle}>
                      <div className="grid gap-3 md:grid-cols-2">
                        {CREED_TYPE_OPTIONS.map((type, index) => {
                          const definition = getCreedTypeDefinition(type);
                          const theme = typeThemes[type];
                          const active = state.onboarding.creedType === type;

                          return (
                            <AnimatedBlock key={type} index={index}>
                              <button
                                type="button"
                                onClick={() => {
                                  setGroupOther(null);
                                  setGroupOtherValue("");
                                  updateOnboarding({
                                    creedType: type,
                                    stackSelections: {},
                                  });
                                }}
                                className={cn(
                                  "h-full w-full rounded-[20px] border bg-[var(--creed-surface)] px-4 py-4 text-left transition-[border-color,background-color,box-shadow,transform] duration-150 focus:outline-none",
                                  active
                                    ? "text-[var(--creed-text-primary)]"
                                    : "border-[var(--creed-border)] bg-[var(--creed-surface)] hover:border-[var(--creed-border-strong)] hover:bg-[var(--creed-surface-raised)]"
                                )}
                                style={
                                  active
                                    ? {
                                        borderColor: theme.accent,
                                        background: `linear-gradient(135deg, ${theme.accent}1A 0%, ${theme.accent}26 100%)`,
                                        boxShadow: `0 0 0 1px ${theme.accent} inset`,
                                      }
                                    : undefined
                                }
                              >
                                <div
                                  className="text-[15px] font-medium text-[var(--creed-text-primary)]"
                                  style={active ? { color: theme.accent } : undefined}
                                >
                                  {definition.label}
                                </div>
                                <div
                                  className="mt-2 text-[13px] leading-6 text-[var(--creed-text-secondary)]"
                                  style={active ? { color: theme.accent } : undefined}
                                >
                                  {definition.description}
                                </div>
                              </button>
                            </AnimatedBlock>
                          );
                        })}
                      </div>
                    </OnboardingStep>
                  ) : null}

                  {/* Step 1 - Identity */}
                  {step === 1 ? (
                    <OnboardingStep
                      title={creedTypeDefinition.startTitle}
                      subtitle={creedTypeDefinition.startSubtitle}
                    >
                      <AnimatedBlock index={0}>
                        <FieldLabel>{creedTypeDefinition.roleLabel}</FieldLabel>
                        <Input
                          value={state.onboarding.role}
                          onChange={(event) => updateOnboarding({ role: event.target.value })}
                          className="h-13 rounded-2xl border-[var(--creed-border)] px-4 text-[17px]"
                          placeholder={creedTypeDefinition.rolePlaceholder}
                        />
                      </AnimatedBlock>
                      <AnimatedBlock index={1}>
                        <FieldLabel>{creedTypeDefinition.alwaysKnowLabel}</FieldLabel>
                        <Textarea
                          value={state.onboarding.workingWithYou}
                          onChange={(event) =>
                            updateOnboarding({ workingWithYou: event.target.value })
                          }
                          className="min-h-28 rounded-2xl border-[var(--creed-border)] px-4 py-4 text-[15px] leading-7"
                          placeholder={creedTypeDefinition.alwaysKnowPlaceholder}
                        />
                      </AnimatedBlock>
                    </OnboardingStep>
                  ) : null}

                  {/* Step 2 - Direction (Goals + Work) */}
                  {step === 2 ? (
                    <OnboardingStep
                      title="Where you're headed."
                      subtitle="Goals AI should pull on, and the kind of work you do."
                    >
                      <AnimatedBlock index={0}>
                        <FieldLabel>{creedTypeDefinition.goalsLabel}</FieldLabel>
                        <Textarea
                          value={state.onboarding.currentProject}
                          onChange={(event) =>
                            updateOnboarding({ currentProject: event.target.value })
                          }
                          className="min-h-32 rounded-2xl border-[var(--creed-border)] px-4 py-4 text-[15px] leading-7"
                          placeholder={creedTypeDefinition.goalsPlaceholder}
                        />
                      </AnimatedBlock>
                      <AnimatedBlock index={1}>
                        <FieldLabel>{creedTypeDefinition.workLabel}</FieldLabel>
                        <Textarea
                          value={state.onboarding.work}
                          onChange={(event) =>
                            updateOnboarding({ work: event.target.value })
                          }
                          className="min-h-28 rounded-2xl border-[var(--creed-border)] px-4 py-4 text-[15px] leading-7"
                          placeholder={creedTypeDefinition.workPlaceholder}
                        />
                      </AnimatedBlock>
                    </OnboardingStep>
                  ) : null}

                  {/* Step 3 - Tools */}
                  {step === 3 ? (
                    <OnboardingStep
                      title={creedTypeDefinition.toolsTitle}
                      subtitle={creedTypeDefinition.toolsSubtitle}
                    >
                      <AnimatedBlock index={0}>
                        <div className="grid gap-x-8 gap-y-5 md:grid-cols-2">
                          {Object.entries(currentToolGroups).map(([group, items], index) => (
                            <div key={group}>
                              <FieldLabel>{group}</FieldLabel>
                              {(() => {
                                const predefinedItems = items as readonly string[];
                                const renderedItems = [
                                  ...predefinedItems,
                                  ...(state.onboarding.stackSelections[group] ?? []).filter(
                                    (item) => !predefinedItems.includes(item)
                                  ),
                                ];

                                return (
                                  <div className="flex flex-wrap gap-2">
                                    <AnimatePresence initial={false} mode="popLayout">
                                      {renderedItems.map((item) => (
                                        <motion.div
                                          key={item}
                                          layout="position"
                                          initial={{ opacity: 0, scale: 0.92 }}
                                          animate={{ opacity: 1, scale: 1 }}
                                          exit={{ opacity: 0, scale: 0.92 }}
                                          transition={{
                                            layout: {
                                              type: "spring",
                                              stiffness: 420,
                                              damping: 34,
                                              mass: 0.7,
                                            },
                                            opacity: { duration: 0.18, ease: [0.22, 1, 0.36, 1] },
                                            scale: { duration: 0.18, ease: [0.22, 1, 0.36, 1] },
                                          }}
                                        >
                                          <PillButton
                                            active={state.onboarding.stackSelections[group]?.includes(
                                              item
                                            )}
                                            accent={accentColorMap.tools}
                                            small
                                            onClick={() => updateStack(group, item)}
                                          >
                                            {item}
                                          </PillButton>
                                        </motion.div>
                                      ))}
                                    </AnimatePresence>
                                    <motion.button
                                      type="button"
                                      layout="position"
                                      transition={{
                                        layout: {
                                          type: "spring",
                                          stiffness: 420,
                                          damping: 34,
                                          mass: 0.7,
                                        },
                                      }}
                                      className="rounded-xl border border-dashed border-[var(--creed-border-strong)] px-3 py-1.5 text-[13px] text-[var(--creed-text-secondary)] transition-colors duration-150 hover:border-[var(--creed-text-secondary)] hover:text-[var(--creed-text-primary)] focus:outline-none"
                                      onClick={() => {
                                        setGroupOther(group);
                                        setGroupOtherValue("");
                                      }}
                                    >
                                      Other
                                    </motion.button>
                                  </div>
                                );
                              })()}
                              <AnimatePresence initial={false}>
                                {groupOther === group ? (
                                  <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{
                                      height: { duration: 0.24, ease: [0.22, 1, 0.36, 1] },
                                      opacity: { duration: 0.16, ease: [0.22, 1, 0.36, 1] },
                                    }}
                                    className="overflow-hidden"
                                  >
                                    <div className="mt-3 rounded-2xl p-1">
                                      <Input
                                        data-disable-continue="true"
                                        value={groupOtherValue}
                                        className="h-11 rounded-xl border-[var(--creed-border)] bg-[var(--creed-surface)]"
                                        placeholder={`e.g. Add another ${group.toLowerCase()} tool`}
                                        onChange={(event) => setGroupOtherValue(event.target.value)}
                                        onKeyDown={(event) => {
                                          if (event.key === "Enter" && !event.shiftKey) {
                                            event.preventDefault();
                                            addGroupOther();
                                          }
                                        }}
                                      />
                                    </div>
                                  </motion.div>
                                ) : null}
                              </AnimatePresence>
                              {/* Preserve `index` for the React reconciler */}
                              <span hidden>{index}</span>
                            </div>
                          ))}
                        </div>
                      </AnimatedBlock>
                    </OnboardingStep>
                  ) : null}

                  {/* Step 4 - Preferences + Constraints */}
                  {step === 4 ? (
                    <OnboardingStep
                      title={creedTypeDefinition.defaultsTitle}
                      subtitle={creedTypeDefinition.defaultsSubtitle}
                    >
                      <AnimatedBlock index={0}>
                        <FieldLabel>How do you want AI to act?</FieldLabel>
                        <div className="flex flex-wrap gap-2.5">
                          {["Direct", "Collaborative", "Thorough", "Concise"].map((option) => (
                            <PillButton
                              key={option}
                              active={state.onboarding.communicationStyle.includes(
                                option as "Direct" | "Collaborative" | "Thorough" | "Concise"
                              )}
                              accent={typeTheme.accent}
                              onClick={() =>
                                toggleCommunicationStyle(
                                  option as "Direct" | "Collaborative" | "Thorough" | "Concise"
                                )
                              }
                            >
                              {option}
                            </PillButton>
                          ))}
                        </div>
                      </AnimatedBlock>
                      <AnimatedBlock index={1}>
                        <FieldLabel>What annoys you about AI replies?</FieldLabel>
                        <Textarea
                          value={state.onboarding.annoyances}
                          onChange={(event) => updateOnboarding({ annoyances: event.target.value })}
                          className="min-h-24 rounded-2xl border-[var(--creed-border)] bg-[var(--creed-surface)] px-4 py-4 text-[15px] leading-7"
                          placeholder="e.g. Long preambles, generic advice, over-praise, unnecessary disclaimers."
                        />
                      </AnimatedBlock>
                      <AnimatedBlock index={2}>
                        <FieldLabel>Anything you never want AI to do? <span className="ml-2 text-[var(--creed-text-tertiary)]">Optional</span></FieldLabel>
                        <Textarea
                          value={state.onboarding.constraints}
                          onChange={(event) => updateOnboarding({ constraints: event.target.value })}
                          className="min-h-24 rounded-2xl border-[var(--creed-border)] bg-[var(--creed-surface)] px-4 py-4 text-[15px] leading-7"
                          placeholder="e.g. Don't make assumptions about my work without checking. Don't surface political takes unprompted."
                        />
                      </AnimatedBlock>
                    </OnboardingStep>
                  ) : null}

                  {/* Step 5 - Daily Context (single optional textarea) */}
                  {step === 5 ? (
                    <OnboardingStep
                      title="Your daily context."
                      subtitle="Routines, people, health notes, beliefs."
                    >
                      <AnimatedBlock index={0}>
                        <Textarea
                          value={state.onboarding.context}
                          onChange={(event) => updateOnboarding({ context: event.target.value })}
                          className="min-h-[280px] rounded-2xl border-[var(--creed-border)] px-4 py-4 text-[15px] leading-7"
                          placeholder={
                            "e.g. Wake at 7, deep work mornings, no meetings before 11. Live in Berlin, three timezones from most collaborators. Maya is my co-founder. Vegetarian, migraine-prone when low on sleep. Long-term thinking over quick wins."
                          }
                        />
                      </AnimatedBlock>
                    </OnboardingStep>
                  ) : null}

                  {/* Step 6 - Connect an agent (hard gate) */}
                  {step === CONNECT_STEP ? (
                    <OnboardingStep
                      title="Connect your agent."
                      subtitle="Your agent composes your Creed next, from everything you just shared plus what it already knows about you. Connect at least one to continue."
                    >
                      <AnimatedBlock index={0}>
                        <div className="creed-scrollbar md:max-h-[calc(100vh-380px)] md:overflow-y-auto md:pr-1">
                          <div className="grid items-start gap-4 lg:grid-cols-2">
                            {state.connections.map((connection) => {
                              const { isConnected, lastSeen } = resolveConnectionStatus(
                                connection,
                                mcpClients
                              );
                              return (
                                <ConnectionCard
                                  key={connection.id}
                                  connection={connection}
                                  mcpUrl={state.mcpUrl}
                                  isConnected={isConnected}
                                  lastSeen={lastSeen}
                                />
                              );
                            })}
                          </div>
                        </div>
                      </AnimatedBlock>
                    </OnboardingStep>
                  ) : null}

                  {/* Step 7 - Compose (the agent writes the full Creed) */}
                  {step === COMPOSE_STEP ? (
                    <div className="text-center">
                      <AnimatedBlock index={0}>
                        <AnimatedHeadline
                          text={composed ? "Your Creed is ready." : "Bring it to life."}
                          className="t-section justify-center text-[var(--creed-text-primary)]"
                        />
                      </AnimatedBlock>
                      <AnimatedBlock index={1}>
                        <p className="t-lede mx-auto mt-6 max-w-2xl text-[var(--creed-text-tertiary)]">
                          {composed
                            ? "Your agent composed your full Creed."
                            : "Paste this into your connected agent. It turns everything from onboarding, plus what it already knows about you, into your full Creed."}
                        </p>
                      </AnimatedBlock>
                      <AnimatedBlock index={2}>
                        <div className="mx-auto mt-8 flex max-w-md flex-col items-center gap-5">
                          {composed ? null : (
                            <Button
                              type="button"
                              style={{ borderRadius: "0.875rem" }}
                              className="min-w-[184px] justify-center bg-[var(--creed-text-primary)] px-5 text-[var(--creed-button-primary-fg)] hover:bg-[var(--creed-button-primary-hover)]"
                              onClick={() => void handleCopyPrompt()}
                            >
                              {promptCopied ? (
                                <>
                                  <AnimatedCheckmark className="h-4 w-4" size={16} />
                                  Copied
                                </>
                              ) : (
                                <>
                                  <CopyIcon className="h-4 w-4" size={16} />
                                  Copy starter prompt
                                </>
                              )}
                            </Button>
                          )}
                          {connectedAgentsRoster}
                          {allSubmitted ? (
                            <div className="flex items-center gap-2 text-[13px] font-medium text-[#16A34A]">
                              <AnimatedCheckmark className="h-4 w-4" size={16} />
                              All agents submitted
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-[13px] text-[var(--creed-text-tertiary)]">
                              <LoaderCircle className="h-4 w-4 animate-spin" />
                              {composed
                                ? `${submittedCount} of ${mcpClients.length} agents submitted`
                                : "Waiting for an agent to submit..."}
                            </div>
                          )}
                        </div>
                      </AnimatedBlock>
                    </div>
                  ) : null}

                  {/* Step 8 - Preview the composed Creed before entering the app */}
                  {step === PREVIEW_STEP ? (
                    <div className="text-center">
                      <AnimatedBlock index={0}>
                        <AnimatedHeadline
                          text="Your Creed."
                          className="t-section justify-center text-[var(--creed-text-primary)]"
                        />
                      </AnimatedBlock>
                      <AnimatedBlock index={1}>
                        <p className="t-lede mx-auto mt-6 max-w-2xl text-[var(--creed-text-tertiary)]">
                          {composerName
                            ? `Composed by ${composerName}. Take a look, then head in.`
                            : "Take a look, then head in."}
                        </p>
                      </AnimatedBlock>
                      <AnimatedBlock index={2}>
                        <motion.div
                          initial={{ opacity: 0, y: 18, scale: 0.985, filter: "blur(10px)" }}
                          animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                          transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
                          className="mx-auto mt-10 max-w-[920px]"
                        >
                          <CreedPreview sections={composedSections} />
                        </motion.div>
                      </AnimatedBlock>
                    </div>
                  ) : null}
                </StepFrame>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        <div className="flex items-center justify-between pt-3">
          <div>
            {step === 0 && !claiming ? (
              <button
                type="button"
                onClick={() => router.push("/home")}
                className="inline-flex items-center gap-2 text-sm text-[var(--creed-text-secondary)] transition-colors duration-150 hover:text-[var(--creed-text-primary)]"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
            ) : step > 0 && !claiming ? (
              <button
                type="button"
                onClick={() => setStep((current) => current - 1)}
                className="inline-flex items-center gap-2 text-sm text-[var(--creed-text-secondary)] transition-colors duration-150 hover:text-[var(--creed-text-primary)]"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
            ) : null}
          </div>

          {step < TOTAL_STEPS - 1 ? (
            <div className="flex items-center gap-3">
              <span className="hidden text-[12px] text-[var(--creed-text-tertiary)] md:inline">
                ↵ to continue
              </span>
              <Button
                style={{ borderRadius: "0.875rem" }}
                className="bg-[var(--creed-text-primary)] px-5 text-[var(--creed-button-primary-fg)] hover:bg-[var(--creed-button-primary-hover)] disabled:bg-[var(--creed-border-strong)] disabled:text-[var(--creed-text-tertiary)]"
                onClick={handleContinue}
                disabled={
                  claiming ||
                  (step === CONNECT_STEP && !connected) ||
                  (step === COMPOSE_STEP && !composed)
                }
              >
                {claiming
                  ? "Saving"
                  : step === CONNECT_STEP && !connected
                    ? "Connect an agent"
                    : "Continue"}
                {claiming ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRightIcon className="h-4 w-4" size={16} />
                )}
              </Button>
            </div>
          ) : paid ? (
            <Button
              style={{ borderRadius: "0.875rem" }}
              className="bg-[var(--creed-text-primary)] px-5 text-[var(--creed-button-primary-fg)] hover:bg-[var(--creed-button-primary-hover)]"
              onClick={handleFinish}
            >
              Go to my Creed
              <ArrowRightIcon className="h-4 w-4" size={16} />
            </Button>
          ) : (
            <Button
              style={{ borderRadius: "0.875rem" }}
              className="bg-[var(--creed-text-primary)] px-5 text-[var(--creed-button-primary-fg)] hover:bg-[var(--creed-button-primary-hover)] disabled:bg-[var(--creed-border-strong)] disabled:text-[var(--creed-text-tertiary)]"
              onClick={() => void startCheckout()}
              disabled={checkoutSubmitting}
            >
              {checkoutSubmitting ? "Starting" : "Get Creed"}
              {checkoutSubmitting ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowRightIcon className="h-4 w-4" size={16} />
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function StepFrame({
  children,
  wide = false,
  narrow = false,
}: {
  children: ReactNode;
  wide?: boolean;
  narrow?: boolean;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full",
        narrow ? "max-w-2xl" : wide ? "max-w-5xl" : "max-w-3xl"
      )}
    >
      {children}
    </div>
  );
}

function OnboardingStep({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div>
      <AnimatedHeadline
        text={title}
        className="t-section text-[var(--creed-text-primary)]"
      />
      <p className="t-lede mt-4 max-w-2xl text-[var(--creed-text-tertiary)]">
        {subtitle}
      </p>
      <div className="mt-9 space-y-6">{children}</div>
    </div>
  );
}

function AnimatedHeadline({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  // Split into lines, then per line into words, then per word into glyphs.
  // Word spans use `whitespace-nowrap` so they wrap as units (responsive),
  // while glyphs inside still animate individually - same blur-in motion as
  // the landing-hero headline.
  const lines = useMemo(() => text.split("\n"), [text]);

  return (
    <motion.h1
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: 0.042,
          },
        },
      }}
      className={cn("flex flex-wrap", className)}
    >
      {lines.map((line, lineIndex) => {
        const words = line.split(" ");
        return (
          <span key={`${line}-${lineIndex}`} className="basis-full">
            {words.map((word, wordIndex) => (
              <span
                key={`${word}-${lineIndex}-${wordIndex}`}
                className="inline-block whitespace-nowrap align-baseline"
              >
                {splitPreservingLigatures(word).map((glyph, glyphIndex) => (
                  <motion.span
                    key={`${glyph}-${lineIndex}-${wordIndex}-${glyphIndex}`}
                    variants={{
                      hidden: { opacity: 0, filter: "blur(10px)", y: 10 },
                      visible: { opacity: 1, filter: "blur(0px)", y: 0 },
                    }}
                    transition={{ duration: 0.62, ease: [0.16, 1, 0.3, 1] }}
                    className="inline-block whitespace-pre"
                  >
                    {glyph}
                  </motion.span>
                ))}
                {wordIndex < words.length - 1 ? (
                  <motion.span
                    variants={{
                      hidden: { opacity: 0, filter: "blur(10px)", y: 10 },
                      visible: { opacity: 1, filter: "blur(0px)", y: 0 },
                    }}
                    transition={{ duration: 0.62, ease: [0.16, 1, 0.3, 1] }}
                    className="inline-block whitespace-pre"
                  >
                    {" "}
                  </motion.span>
                ) : null}
              </span>
            ))}
          </span>
        );
      })}
    </motion.h1>
  );
}

function AnimatedBlock({
  children,
  index,
}: {
  children: ReactNode;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ delay: index * 0.045, duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mb-3 text-[13px] font-medium text-[var(--creed-text-secondary)]">
      {children}
    </div>
  );
}

function PillButton({
  active,
  accent,
  small = false,
  onClick,
  children,
}: {
  active?: boolean;
  accent: string;
  small?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.985 }}
      onClick={onClick}
      className={cn(
        "border bg-[var(--creed-surface)] font-medium outline-none transition-colors focus:outline-none focus-visible:outline-none",
        small ? "rounded-lg px-3 py-1.5 text-[13px]" : "rounded-xl px-4 py-2 text-[14px]",
        active
          ? ""
          : "border-[var(--creed-border)] text-[var(--creed-text-secondary)] hover:border-[var(--creed-border-strong)] hover:bg-[var(--creed-surface-raised)] hover:text-[var(--creed-text-primary)]"
      )}
      style={
        active
          ? {
              borderColor: accent,
              color: accent,
              background: `linear-gradient(135deg, ${accent}1A 0%, ${accent}26 100%)`,
              boxShadow: `0 0 0 1px ${accent} inset`,
            }
          : undefined
      }
    >
      {children}
    </motion.button>
  );
}

function CreedPreview({ sections }: { sections: CreedSection[] }) {
  return (
    <div className="overflow-hidden rounded-[16px] border border-[var(--creed-border)] bg-[var(--creed-surface)] text-left">
      <div className="md:h-[520px] md:overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="mx-auto max-w-[920px] px-6 py-8 md:px-10">
          <div className="space-y-10">
            {sections.map((section) => (
              <section key={section.id} className="group relative">
                <div className="mb-6 flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <span
                        className="inline-block h-9 w-[3px] rounded-full"
                        style={{ backgroundColor: accentColorMap[section.accent] }}
                      />
                      <div className="flex min-w-0 flex-wrap items-center gap-3">
                        <span
                          className="text-[15px] font-medium leading-none md:text-[16px]"
                          style={{ color: accentColorMap[section.accent] }}
                        >
                          {section.name}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <RichTextEditor
                    sectionId={section.id}
                    content={section.content}
                    readOnly
                    accentColor={accentColorMap[section.accent]}
                    onChange={() => {}}
                  />
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
