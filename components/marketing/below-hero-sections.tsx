"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import type { StaticImageData } from "next/image";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { CreedAppDemo } from "@/components/marketing/creed-app-demo";
import { DirectEditDemo, ProposalDemo } from "@/components/marketing/governed-demos";
import { ConnectDemo, CreateDemo, ReviewDemo } from "@/components/marketing/how-it-works-demos";
import { MarketingFooter } from "@/components/marketing/site-chrome";
import { useLandingAuthState } from "@/components/marketing/use-landing-auth-state";
import { usePaidStatus } from "@/components/marketing/use-paid-status";
import { useOnboardingResume } from "@/components/marketing/use-onboarding-resume";
import { useAnimatedIconControls } from "@/components/creed/animated-icon-controls";
import { ArrowRightIcon } from "@/components/ui/arrow-right";
import { homeFaqItems as faqItems } from "@/lib/marketing/faq";
import { cn } from "@/lib/utils";

const claudeCodeIcon = "/assets/agents/claudecode.svg";
const codexIcon = "/assets/agents/codex.svg";
const hermesIcon = "/assets/agents/hermes.svg";
const openClawIcon = "/assets/agents/openclaw.svg";
const openCodeIcon = "/assets/agents/opencode.svg";
const cursorIcon = "/assets/agents/cursor.svg";
const devinIcon = "/assets/agents/devin.svg";
const grokIcon = "/assets/agents/grok.svg";
const chatgptIcon = "/assets/agents/chatgpt.svg";
const claudeIcon = "/assets/agents/claude.svg";
const replitIcon = "/assets/agents/replit.svg";
const whirlIcon = "/assets/agents/whirl.svg";
const v0Icon = "/assets/agents/v0.svg";
const customIcon = "/assets/agents/customagent.svg";

type BrandLogoKey =
  | "chatgpt"
  | "claude"
  | "claudecode"
  | "codex"
  | "cursor"
  | "devin"
  | "github"
  | "grok"
  | "hermes"
  | "openclaw"
  | "notion"
  | "obsidian"
  | "opencode"
  | "replit"
  | "whirl"
  | "v0"
  | "custom";

const brandLogoMap: Record<
  BrandLogoKey,
  { src: string | StaticImageData; imageClassName?: string }
> = {
  codex: {
    src: codexIcon,
    imageClassName: "scale-[0.92]",
  },
  cursor: {
    src: cursorIcon,
    imageClassName: "scale-[0.88]",
  },
  devin: {
    src: devinIcon,
    imageClassName: "scale-[0.92]",
  },
  grok: {
    src: grokIcon,
    imageClassName: "scale-[0.84]",
  },
  chatgpt: {
    src: chatgptIcon,
    imageClassName: "scale-[0.9]",
  },
  claude: {
    src: claudeIcon,
    imageClassName: "scale-[0.92]",
  },
  claudecode: {
    src: claudeCodeIcon,
    imageClassName: "scale-[0.92]",
  },
  github: {
    src: "/assets/landing/brands/github.png",
    imageClassName: "scale-[0.86]",
  },
  hermes: {
    src: hermesIcon,
    imageClassName: "scale-[1.02]",
  },
  openclaw: {
    src: openClawIcon,
    imageClassName: "scale-[1.02]",
  },
  notion: {
    src: "/assets/landing/brands/notion.png",
    imageClassName: "scale-[0.82]",
  },
  obsidian: {
    src: "/assets/landing/brands/obsidian.png",
    imageClassName: "scale-[0.82]",
  },
  opencode: {
    src: openCodeIcon,
    imageClassName: "scale-[0.9]",
  },
  replit: {
    src: replitIcon,
    imageClassName: "scale-[0.92]",
  },
  whirl: {
    src: whirlIcon,
    imageClassName: "scale-[0.92]",
  },
  v0: {
    src: v0Icon,
    imageClassName: "scale-[0.82]",
  },
  custom: {
    src: customIcon,
    imageClassName: "scale-[0.94]",
  },
};

export function BelowHeroSections({ configured }: { configured: boolean }) {
  return (
    <main className="bg-[var(--creed-background)] pb-12">
      <CreedBentoSection />
      <GovernedCollaborationSection />
      <HowItWorksSection />
      <IntegrationsSection />
      <FaqSection />
      <ClosingCtaSection configured={configured} />
      <MarketingFooter />
    </main>
  );
}

function CreedBentoSection() {
  return (
    <section className="px-4 py-20 md:px-10 md:py-24 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          headline="The home for your personal context"
          subline="Everything that makes an AI useful to you, in one place."
        />

        <div className="mt-10">
          <CreedAppDemo />
        </div>
      </div>
    </section>
  );
}

// A bento tile whose media slot is a coloured gradient plate with an
// interactive demo floating on it, and the explainer copy below. The two
// cards stretch to equal height via the grid; the plate flexes to fill.
function PlateCard({
  lightBg,
  darkBg,
  number,
  title,
  body,
  square = false,
  children,
}: {
  lightBg: string;
  darkBg: string;
  number?: string;
  title: string;
  body: string;
  square?: boolean;
  children: ReactNode;
}) {
  return (
    <article
      className={cn(
        "flex flex-col rounded-[26px] bg-[var(--creed-surface)] p-3 md:rounded-[30px] md:p-4",
        !square && "h-full"
      )}
    >
      <div
        className={cn(
          "relative flex items-center justify-center overflow-hidden rounded-[16px] p-4 sm:p-6 md:rounded-[18px]",
          // Square plate at the 3-up desktop width; auto height (content) when
          // the grid collapses to one column so a full-width square isn't huge.
          square ? "lg:aspect-square" : "min-h-[380px] flex-1"
        )}
      >
        <Image
          src={lightBg}
          alt=""
          fill
          unoptimized
          sizes="(min-width: 768px) 520px, 100vw"
          className="object-cover dark:hidden"
        />
        <Image
          src={darkBg}
          alt=""
          fill
          unoptimized
          sizes="(min-width: 768px) 520px, 100vw"
          className="hidden object-cover dark:block"
        />
        <div className="relative w-full">{children}</div>
      </div>
      <div className="mt-4 px-1 md:mt-5">
        <h3 className="t-step text-[var(--creed-text-primary)]">
          {number ? <span className="mr-2 font-normal text-[var(--creed-text-tertiary)]">{number}</span> : null}
          {title}
        </h3>
        <p className="t-body mt-2.5 text-[var(--creed-text-secondary)]">{body}</p>
      </div>
    </article>
  );
}

function GovernedCollaborationSection() {
  return (
    <section className="px-6 py-20 md:px-10 md:py-24 lg:px-12">
      <div className="mx-auto max-w-5xl">
        <SectionHeading
          headline="Review everything or nothing"
          subline="Approve every agent edit, or let them write directly."
          align="left"
        />

        <div className="mt-12 grid items-stretch gap-5 md:grid-cols-2">
          <PlateCard
            lightBg="/assets/landing/backgrounds/light-proposal-bg.avif"
            darkBg="/assets/landing/backgrounds/dark-proposal-bg.avif"
            title="You control what gets remembered."
            body="Agents propose updates in real time, but nothing changes until you approve it."
          >
            <ProposalDemo />
          </PlateCard>
          <PlateCard
            lightBg="/assets/landing/backgrounds/light-direct-bg.avif"
            darkBg="/assets/landing/backgrounds/dark-direct-bg.avif"
            title="Let trusted agents write directly."
            body="Agents can update your Creed without review, keeping your context current as you work."
          >
            <DirectEditDemo />
          </PlateCard>
        </div>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  return (
    <section className="px-6 py-24 md:px-10 md:py-30 lg:px-12">
      <SectionHeading
        headline="How Creed works"
        subline="Set your context once and let your agents keep it sharp."
        className="max-w-[52rem]"
      />

      <div className="mx-auto mt-14 grid max-w-6xl items-start gap-5 lg:grid-cols-3">
        <PlateCard
          lightBg="/assets/landing/backgrounds/light-create-bg.avif"
          darkBg="/assets/landing/backgrounds/dark-create-bg.avif"
          number="1"
          title="Create your Creed"
          body="Answer a few sharp questions and generate your starter profile."
          square
        >
          <CreateDemo />
        </PlateCard>
        <PlateCard
          lightBg="/assets/landing/backgrounds/light-connect-bg.avif"
          darkBg="/assets/landing/backgrounds/dark-connect-bg.avif"
          number="2"
          title="Connect your agents"
          body="Add the MCP server, click Allow, and every agent reads your profile."
          square
        >
          <ConnectDemo />
        </PlateCard>
        <PlateCard
          lightBg="/assets/landing/backgrounds/light-improve-bg.avif"
          darkBg="/assets/landing/backgrounds/dark-improve-bg.avif"
          number="3"
          title="Review what sticks"
          body="Approve the updates worth keeping and let your profile sharpen over time."
          square
        >
          <ReviewDemo />
        </PlateCard>
      </div>
    </section>
  );
}

// Each tile's name is coloured to match its icon's dominant brand colour.
// Mono icons (ChatGPT, Grok, Cursor, OpenCode, Devin, v0, Custom, GitHub,
// Notion) fall through to the primary text colour so the name reads as the
// same monochrome as the glyph. Hermes' yellow is darkened in light mode so
// it stays legible on the white card.
const STACK_NAME_ACCENT: Partial<Record<BrandLogoKey, string>> = {
  claude: "text-[#FF6200]",
  claudecode: "text-[#FF6200]",
  codex: "text-[#0066FF]",
  openclaw: "text-[#FF0000]",
  hermes: "text-[#B58900] dark:text-[#FFBB00]",
  replit: "text-[#F26207]",
  whirl: "text-[#0066FF]",
  obsidian: "text-[#7C3AED]",
};

function StackTile({ brand, label }: { brand: BrandLogoKey; label: string }) {
  return (
    <div className="flex w-full flex-col items-center justify-center gap-2.5 rounded-2xl bg-[var(--creed-surface)] px-2 py-4">
      <BrandImage brand={brand} label={label} className="h-10 w-10" />
      <div
        className={cn(
          "text-center text-[12px] font-medium leading-tight tracking-[-0.01em]",
          STACK_NAME_ACCENT[brand] ?? "text-[var(--creed-text-primary)]"
        )}
      >
        {label}
      </div>
    </div>
  );
}

function IntegrationsSection() {
  const agents: Array<{ label: string; brand: BrandLogoKey }> = [
    { label: "ChatGPT", brand: "chatgpt" },
    { label: "Claude", brand: "claude" },
    { label: "Grok", brand: "grok" },
    { label: "OpenClaw", brand: "openclaw" },
    { label: "Hermes", brand: "hermes" },
    { label: "Cursor", brand: "cursor" },
    { label: "OpenCode", brand: "opencode" },
    { label: "Devin", brand: "devin" },
    { label: "Codex", brand: "codex" },
    { label: "Claude Code", brand: "claudecode" },
    { label: "Replit", brand: "replit" },
    { label: "Whirl", brand: "whirl" },
    { label: "v0", brand: "v0" },
    { label: "Custom", brand: "custom" },
  ];
  const integrations: Array<{ label: string; brand: BrandLogoKey }> = [
    { label: "GitHub", brand: "github" },
    { label: "Notion", brand: "notion" },
    { label: "Obsidian", brand: "obsidian" },
  ];

  return (
    <section className="px-6 py-24 md:px-10 md:py-30 lg:px-12">
      <SectionHeading
        headline="Works with your stack"
        subline="Connect Creed once, then every AI you talk to knows you instantly."
        className="max-w-[64rem]"
      />

      {/* Both grids share the same 7-column track so the Integrations tiles
          line up directly under the first Agents. Centred under the heading. */}
      <div className="mx-auto mt-14 grid max-w-[46rem] gap-10">
        <div>
          <div className="t-body-lg font-medium text-[var(--creed-text-primary)]">Agents</div>
          <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-5 md:grid-cols-7">
            {agents.map((item) => (
              <StackTile key={item.label} brand={item.brand} label={item.label} />
            ))}
          </div>
        </div>

        <div>
          <div className="t-body-lg font-medium text-[var(--creed-text-primary)]">Integrations</div>
          <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-5 md:grid-cols-7">
            {integrations.map((item) => (
              <StackTile key={item.label} brand={item.brand} label={item.label} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function FaqSection() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section className="px-6 py-24 md:px-10 md:py-30 lg:px-12">
      <SectionHeading headline="Questions" />

      <div className="mx-auto mt-14 max-w-[46rem]">
        {faqItems.map((item, index) => {
          const open = openIndex === index;

          return (
            <div key={item.question} className="border-b border-[var(--creed-border)]">
              <button
                type="button"
                onClick={() => setOpenIndex(open ? -1 : index)}
                className="flex w-full items-center justify-between gap-6 py-7 text-left"
              >
                <span className="t-body-lg font-medium text-[var(--creed-text-primary)]">{item.question}</span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-[var(--creed-text-tertiary)] transition-transform duration-300",
                    open && "rotate-180"
                  )}
                />
              </button>

              <div
                className={cn(
                  "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
                  open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                )}
              >
                <div className="overflow-hidden">
                  <p className="t-body max-w-3xl pb-7 text-[var(--creed-text-secondary)]">
                    {item.answer}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ClosingCtaSection({ configured }: { configured: boolean }) {
  const authState = useLandingAuthState(configured);
  const paidStatus = usePaidStatus(configured);
  const canResume = useOnboardingResume(configured);
  const isPaid = authState === "signed-in" && paidStatus === "paid";
  const closingArrow = useAnimatedIconControls(80, undefined, 420);

  return (
    <section className="px-6 py-24 md:px-10 md:py-30 lg:px-12">
      <div className="mx-auto max-w-4xl text-center">
        <SectionTitle className="t-section justify-center text-[var(--creed-text-primary)]">
          {"Give every agent\nthe same starting point"}
        </SectionTitle>

        <p className="t-lede mx-auto mt-5 max-w-2xl text-[var(--creed-text-tertiary)]">
          Try Creed today for completely free.
        </p>

        <div className="mt-9 flex justify-center">
          {isPaid ? (
            <Link
              href="/file"
              onMouseEnter={closingArrow.start}
              onMouseLeave={closingArrow.settle}
              onPointerDown={(event) => {
                if (event.pointerType !== "mouse") closingArrow.start();
              }}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#2563EB] pl-4 pr-3 text-[14px] font-medium text-white transition-colors hover:bg-[#1D4ED8]"
            >
              <span className="leading-none">Go to app</span>
              <ArrowRightIcon
                ref={closingArrow.iconRef}
                size={16}
                className="inline-flex shrink-0 items-center justify-center leading-none"
              />
            </Link>
          ) : (
            <Link
              href={canResume ? "/onboarding" : "/pricing"}
              onMouseEnter={closingArrow.start}
              onMouseLeave={closingArrow.settle}
              onPointerDown={(event) => {
                if (event.pointerType !== "mouse") closingArrow.start();
              }}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#2563EB] pl-4 pr-3 text-[14px] font-medium text-white transition-colors hover:bg-[#1D4ED8]"
            >
              <span className="leading-none">{canResume ? "Resume" : "Get Started"}</span>
              <ArrowRightIcon
                ref={closingArrow.iconRef}
                size={16}
                className="inline-flex shrink-0 items-center justify-center leading-none"
              />
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

function SectionHeading({
  headline,
  subline,
  align = "center",
  className,
}: {
  headline: string;
  subline?: string;
  align?: "center" | "left";
  className?: string;
}) {
  const centered = align === "center";

  return (
    <div
      className={cn(
        centered
          ? "mx-auto max-w-3xl px-2 text-center sm:px-0 md:max-w-[72rem]"
          : "mx-auto max-w-3xl px-2 text-center sm:px-0 md:mx-0 md:max-w-2xl md:text-left",
        className
      )}
    >
      <SectionTitle
        className={cn(
          "t-section text-[var(--creed-text-primary)]",
          centered ? "justify-center" : "justify-center md:justify-start"
        )}
      >
        {headline}
      </SectionTitle>
      {subline ? (
        <p
          className={cn(
            "t-lede mt-5 max-w-2xl text-[var(--creed-text-tertiary)]",
            centered ? "mx-auto" : "mx-auto md:mx-0"
          )}
        >
          {subline}
        </p>
      ) : null}
    </div>
  );
}

// Black-on-white brand logos that need flipping to white in dark mode.
// Coloured brand assets (Claude, Codex, OpenClaw, Hermes, etc.) skip this.
const MONOCHROME_BRANDS = new Set<BrandLogoKey>([
  "github",
  "opencode",
  "cursor",
  "devin",
  "grok",
  "chatgpt",
  "v0",
  "custom",
]);

function BrandImage({
  brand,
  label,
  className,
}: {
  brand: BrandLogoKey;
  label: string;
  className?: string;
}) {
  const asset = brandLogoMap[brand];
  const [errored, setErrored] = useState(false);

  if (errored) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-md bg-[var(--creed-surface-raised)] text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--creed-text-tertiary)]",
          className
        )}
        title={typeof asset.src === "string" ? asset.src : label}
      >
        {label.slice(0, 2)}
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      <Image
        src={asset.src}
        alt={label}
        fill
        sizes="160px"
        className={cn(
          "pointer-events-none select-none object-contain",
          MONOCHROME_BRANDS.has(brand) && "creed-invert-on-dark",
          asset.imageClassName
        )}
        draggable={false}
        onError={() => setErrored(true)}
      />
    </div>
  );
}

// Static section title. The per-glyph blur-in lives only on the landing hero
// and onboarding now; below-hero titles render plainly (keeping the same
// flex-wrap line handling so multi-line and single-line headings lay out the
// same as before).
function SectionTitle({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  const lines = children.split("\n");
  const hasExplicitBreak = lines.length > 1;

  return (
    <h2 className={cn("flex flex-wrap", !hasExplicitBreak && "md:flex-nowrap", className)}>
      {lines.map((line, lineIndex) => (
        <span
          key={`${line}-${lineIndex}`}
          className={
            hasExplicitBreak
              ? "basis-full whitespace-nowrap"
              : "basis-auto whitespace-normal md:whitespace-nowrap"
          }
        >
          {line}
        </span>
      ))}
    </h2>
  );
}
