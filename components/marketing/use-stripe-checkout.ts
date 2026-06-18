"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

// Starts the Hosted-plan Stripe Checkout and redirects the browser to it.
// Shared by the pricing "Get Started" path and the onboarding "Get Creed"
// button so the already-paid (409) handling and error copy live in one place.
// On success the browser navigates to Stripe, so `submitting` is intentionally
// left true (the page is leaving); it's only reset on error.
export function useStripeCheckout() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const startCheckout = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
        alreadyPaid?: boolean;
      };
      if (data.alreadyPaid) {
        toast.success("You already own Creed");
        router.push("/file");
        return;
      }
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Couldn't start checkout");
      }
      window.location.href = data.url;
    } catch (error) {
      setSubmitting(false);
      toast.error(error instanceof Error ? error.message : "Couldn't start checkout");
    }
  }, [router, submitting]);

  return { startCheckout, submitting };
}
