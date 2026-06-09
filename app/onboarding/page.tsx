import { redirect } from "next/navigation";
import { OnboardingScreen } from "@/components/creed/onboarding-screen";
import { loadCreedState } from "@/lib/creed-backend";
import { isSupabaseTableMissingError } from "@/lib/creed-backend-errors";
import { hasPaidEntitlement } from "@/lib/stripe";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

// Onboarding is free and lives outside the (creed-app) route group. Anyone
// signed in can run it (connect an agent, compose, preview); the paywall is the
// hosted app, not onboarding. We pass two signals to the screen:
//   - paid: switches the final button between "Get Creed" (checkout) and
//     "Go to my Creed" (straight into the app).
//   - initialStage: resume point. A composed Creed resumes on the preview; a
//     claimed-but-not-composed seed resumes on the Connect step; otherwise the
//     screen starts at step 0.
export default async function OnboardingPage() {
  // Default to paid=true when Supabase isn't configured (local dev) so the
  // screen mirrors the layout, which skips the gate entirely in that mode.
  let paid = true;
  let initialStage: "connect" | "preview" | undefined;

  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/home");
    }

    paid = await hasPaidEntitlement(supabase, user.id);

    // loadCreedState is cache()-wrapped, so this reuses the identical call the
    // root layout already made this request. "Composed" == any section last
    // edited by an agent; "hasPersistedCreed" means the seed was claimed.
    try {
      const result = await loadCreedState(supabase, user);
      const composed = result.state.sections.some(
        (section) => section.lastEditedType === "agent"
      );
      if (composed) {
        initialStage = "preview";
      } else if (result.hasPersistedCreed) {
        initialStage = "connect";
      }
    } catch (error) {
      if (!isSupabaseTableMissingError(error)) {
        throw error;
      }
    }
  }

  return <OnboardingScreen paid={paid} initialStage={initialStage} />;
}
