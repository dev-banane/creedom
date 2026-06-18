"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Check, X } from "lucide-react";
import {
  ArrowUpRightIcon,
  type ArrowUpRightIconHandle,
} from "@/components/ui/arrow-up-right";
import { AnimatedPageTitle } from "@/components/marketing/animated-page-title";
import { MarketingFooter, MarketingHeader } from "@/components/marketing/site-chrome";
import { usePaidStatus } from "@/components/marketing/use-paid-status";
import { useLandingAuthState } from "@/components/marketing/use-landing-auth-state";
import { useOnboardingResume } from "@/components/marketing/use-onboarding-resume";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { GITHUB_URL } from "@/lib/branding";
import { cn } from "@/lib/utils";

const lightApostlesImage = "/assets/landing/backgrounds/light-apostles.avif";
const darkApostlesImage = "/assets/landing/backgrounds/dark-apostles.avif";

type Feature = { label: string; included: boolean };

const SHARED_FEATURES: Feature[] = [
  { label: "Full Creed editor with rich components", included: true },
  { label: "All MCP connections and integrations", included: true },
  { label: "Quality scoring and inline diff review", included: true },
  { label: "Use credits or bring your own key (BYOK)", included: true },
];

const FREE_EXTRAS: Feature[] = [
  { label: "Hosted instance, no setup required", included: false },
  { label: "Managed backend, auth and storage", included: false },
  { label: "Cross-device sync and backups", included: false },
  { label: "Priority support and updates", included: false },
];

const PRO_EXTRAS: Feature[] = [
  { label: "Hosted instance, no setup required", included: true },
  { label: "Managed backend, auth and storage", included: true },
  { label: "Cross-device sync and backups", included: true },
  { label: "Priority support and updates", included: true },
];

export function PricingPageView() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 20);
    }

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const githubHref = GITHUB_URL ?? "https://github.com";

  return (
    <div className="min-h-screen bg-[var(--creed-background)] text-[var(--creed-text-primary)]">
      <section className="relative h-60 overflow-hidden bg-[#e9e5de] dark:bg-[#0e0e0d] md:h-72">
        <div className="absolute inset-x-0 top-0 h-screen">
          <Image
            src={lightApostlesImage}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-center dark:hidden"
          />
          <Image
            src={darkApostlesImage}
            alt=""
            fill
            sizes="100vw"
            className="hidden object-cover object-center dark:block"
          />
        </div>
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,31,60,0.16)_0%,rgba(15,31,60,0.08)_28%,rgba(15,31,60,0.05)_56%,rgba(255,255,255,0)_76%)] dark:bg-[linear-gradient(180deg,rgba(0,0,0,0.32)_0%,rgba(0,0,0,0.18)_28%,rgba(0,0,0,0.08)_56%,rgba(0,0,0,0)_76%)]" />
        <div className="absolute -bottom-[22%] left-[-10%] h-[58%] w-[46%] rounded-[100%] bg-white/82 blur-[112px] dark:bg-[#0e0e0d]/82" />
        <div className="absolute -bottom-[22%] right-[-10%] h-[58%] w-[46%] rounded-[100%] bg-white/82 blur-[112px] dark:bg-[#0e0e0d]/82" />
        <div className="absolute left-1/2 bottom-[-14%] h-[34%] w-[64%] -translate-x-1/2 rounded-[100%] bg-white/40 blur-[128px] dark:bg-[#0e0e0d]/45" />
        <div className="absolute inset-x-0 bottom-0 h-[72%] bg-[linear-gradient(180deg,rgba(255,255,255,0)_0%,rgba(249,249,248,0.025)_20%,rgba(249,249,248,0.14)_42%,rgba(249,249,248,0.48)_68%,rgba(249,249,248,0.86)_86%,#f9f9f8_100%)] dark:bg-[linear-gradient(180deg,rgba(14,14,13,0)_0%,rgba(14,14,13,0.04)_20%,rgba(14,14,13,0.18)_42%,rgba(14,14,13,0.52)_68%,rgba(14,14,13,0.88)_86%,#0e0e0d_100%)]" />
        <div className="absolute left-1/2 bottom-[-24%] h-[54%] w-[148%] -translate-x-1/2 rounded-[50%_50%_0_0] bg-[var(--creed-background)]/82 blur-[26px]" />
        <div className="relative z-10 flex flex-col px-6 py-5 md:px-10 md:py-7">
          <MarketingHeader configured scrolled={scrolled} />
        </div>
      </section>

      <motion.main
        className="mx-auto max-w-4xl px-6 pb-20 pt-8 md:px-10 md:pb-24 md:pt-10"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="border-b border-[var(--creed-border)] pb-8">
          <AnimatedPageTitle
            delay={0.24}
            text="Pricing"
            className="t-section text-[var(--creed-text-primary)]"
          />
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.46, delay: 0.42, ease: [0.16, 1, 0.3, 1] }}
            className="mt-5 max-w-2xl text-[18px] leading-8 text-[var(--creed-text-secondary)]"
          >
            Run Creed yourself for free, or skip the setup and let us host it.
          </motion.p>
        </div>

        <section className="py-10 md:py-12">
          <div className="grid gap-4 md:grid-cols-2 md:gap-5">
            <PricingCard
              price="$0"
              cadence="forever"
              tagline="Self-host the open-source build with your own keys."
              features={[...SHARED_FEATURES, ...FREE_EXTRAS]}
              cta={{
                kind: "external",
                label: "View on GitHub",
                href: githubHref,
                style: "outline",
              }}
            />
            <PricingCard
              price="$49"
              cadence="one-time"
              tagline="Lifetime access to the hosted version, fully managed."
              features={[...SHARED_FEATURES, ...PRO_EXTRAS]}
              cta={{ kind: "hosted-purchase" }}
            />
          </div>

          <p className="mt-7 text-center text-[13px] leading-6 text-[var(--creed-text-tertiary)]">
            Both plans use your own OpenRouter API key, so model spend is always paid directly to your provider.
          </p>
        </section>
      </motion.main>

      <MarketingFooter />
    </div>
  );
}

type PricingCardCta =
  | { kind: "external"; label: string; href: string; style: "solid" | "outline" }
  | { kind: "hosted-purchase" };

function PricingCard({
  price,
  cadence,
  tagline,
  features,
  cta,
}: {
  price: string;
  cadence: string;
  tagline: string;
  features: Feature[];
  cta: PricingCardCta;
}) {
  return (
    <div className="flex flex-col rounded-[20px] bg-[var(--creed-surface)] p-6 md:p-7">
      <div>
        <div className="flex items-baseline gap-2">
          <span className="text-[36px] font-semibold leading-none tracking-[-0.02em] text-[var(--creed-text-primary)]">
            {price}
          </span>
          <span className="text-[13px] font-medium text-[var(--creed-text-tertiary)]">
            {cadence}
          </span>
        </div>
        <p className="mt-3 text-[14px] leading-6 text-[var(--creed-text-secondary)]">
          {tagline}
        </p>
      </div>

      <div className="my-6 h-px bg-[var(--creed-border)]" />

      <ul className="flex-1 space-y-2.5">
        {features.map((feature) => (
          <li key={feature.label} className="flex items-start gap-2.5">
            <span className="mt-[5px] inline-flex h-[14px] w-[14px] shrink-0 items-center justify-center">
              {feature.included ? (
                <Check
                  className="h-[14px] w-[14px] text-[#16A34A]"
                  strokeWidth={2.75}
                />
              ) : (
                <X
                  className="h-[14px] w-[14px] text-[#DC2626] dark:text-[#F87171]"
                  strokeWidth={2.75}
                />
              )}
            </span>
            <span
              className={cn(
                "text-[14px] leading-6",
                feature.included
                  ? "text-[var(--creed-text-primary)]"
                  : "text-[var(--creed-text-tertiary)]"
              )}
            >
              {feature.label}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-7">
        {cta.kind === "external" ? <ExternalCta cta={cta} /> : <HostedPurchaseCta />}
      </div>
    </div>
  );
}

function ExternalCta({
  cta,
}: {
  cta: { label: string; href: string; style: "solid" | "outline" };
}) {
  const arrowRef = useRef<ArrowUpRightIconHandle | null>(null);
  return (
    <a
      href={cta.href}
      target="_blank"
      rel="noopener noreferrer"
      onMouseEnter={() => arrowRef.current?.startAnimation()}
      onMouseLeave={() => arrowRef.current?.stopAnimation()}
      className={ctaClass(cta.style)}
    >
      {cta.label}
      {cta.style === "outline" ? (
        <ArrowUpRightIcon
          ref={arrowRef}
          size={16}
          className="inline-flex h-4 w-4 items-center justify-center"
        />
      ) : null}
    </a>
  );
}

/**
 * Hosted-plan CTA. Three states:
 *
 *   signed-in + paid    → green "Owned" pill, links to /file
 *   signed-in + unpaid  → "Get Started" → /onboarding
 *   signed-out          → "Get Started" → Google OAuth → /onboarding
 *
 * The app is the paid product; the actual $49 charge happens at the end of
 * onboarding (the "Get Creed" button), so the pricing CTA just drops people
 * into the free onboarding funnel rather than charging up front.
 */
function HostedPurchaseCta() {
  const authState = useLandingAuthState();
  const paidStatus = usePaidStatus();
  const canResume = useOnboardingResume();
  const router = useRouter();

  if (paidStatus === "paid") {
    return (
      <Link
        href="/file"
        className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-md bg-[#16A34A] px-4 text-[14px] font-medium text-white transition-colors hover:bg-[#15803d]"
      >
        <Check className="h-4 w-4" strokeWidth={2.75} />
        Owned
      </Link>
    );
  }

  if (authState === "signed-out") {
    return (
      <GoogleSignInButton
        label="Get Started"
        showIcon={false}
        redirectTo="/onboarding"
        className={ctaClass("solid")}
      />
    );
  }

  // Signed-in but unpaid (or still resolving auth/paid - show the same button
  // so the layout doesn't jump while paidStatus is "unknown"). Enter the free
  // onboarding funnel; the paywall is the "Get Creed" button at the end. If they
  // have an unfinished onboarding in this browser, offer "Resume".
  return (
    <button
      type="button"
      onClick={() => router.push("/onboarding")}
      className={ctaClass("solid")}
    >
      {canResume ? "Resume" : "Get Started"}
    </button>
  );
}

function ctaClass(style: "solid" | "outline") {
  if (style === "solid") {
    return "inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-md bg-[#2563EB] px-4 text-[14px] font-medium text-white transition-colors hover:bg-[#1D4ED8]";
  }
  return "inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-md border border-[var(--creed-border)] bg-transparent px-4 text-[14px] font-medium text-[var(--creed-text-primary)] transition-colors hover:bg-[var(--creed-surface-raised)]";
}
