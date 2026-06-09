"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

// True when the signed-in user has already started onboarding (a Creed exists
// server-side: seed claimed or composed), so marketing CTAs can offer "Resume"
// instead of "Get Started". Server-backed via /api/app/onboarding-status, so
// it's correct on any device. Mirrors useLandingAuthState / usePaidStatus: a
// tiny inline auth listener + fetch.
export function useOnboardingResume(configured: boolean = true): boolean {
  const [canResume, setCanResume] = useState(false);

  useEffect(() => {
    if (!configured) return;
    let active = true;
    const supabase = getSupabaseBrowserClient();

    async function refresh(userId: string | null) {
      if (!userId) {
        if (active) setCanResume(false);
        return;
      }
      try {
        const res = await fetch("/api/app/onboarding-status", {
          method: "GET",
          cache: "no-store",
        });
        if (!res.ok) {
          if (active) setCanResume(false);
          return;
        }
        const data = (await res.json()) as { started?: boolean };
        if (active) setCanResume(Boolean(data.started));
      } catch {
        if (active) setCanResume(false);
      }
    }

    supabase.auth.getUser().then((result: { data: { user: unknown } }) => {
      const user = result.data.user as { id?: string } | null;
      void refresh(user?.id ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: unknown, session: unknown) => {
      const s = session as { user?: { id?: string } } | null;
      void refresh(s?.user?.id ?? null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [configured]);

  return canResume;
}
