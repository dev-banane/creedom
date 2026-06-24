"use client";

// Three interactive mini-demos for the "How Creed works" steps, reflecting the
// current app:
//  - CreateDemo: a mini onboarding interview. Type an answer and continue
//    through a few questions, then a starter Creed is ready.
//  - ConnectDemo: a single "All agents" card mashing up the onboarding
//    copy-prompt button and the Connections all-agents glyph, both recoloured
//    by the cycling brand palette (creed-copy-cycle).
//  - ReviewDemo: the Identity quality card with a score and three expandable
//    note rows (+ green, / amber, - red).
// Client-only mock state, mobile-first (everything stacks vertically), no backend.

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, ChevronDown, RotateCcw } from "lucide-react";
import { AnimatedIconButton } from "@/components/creed/animated-icon-action";
import { AnimatedCheckmark } from "@/components/ui/animated-checkmark";
import { CopyIcon } from "@/components/ui/copy";
import { QualityRing, qualityScoreColor } from "@/components/creed/file-quality-ui";
import { accentColorMap } from "@/lib/creed-data";
import { cn } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;

// ----- step 1: create (mini interview) -------------------------------------

const INTERVIEW = [
  { label: "How would you describe yourself?", placeholder: "Founder and designer in Lisbon" },
  { label: "What are you working toward?", placeholder: "Ship the v2 beta by August" },
  { label: "How should AI reply to you?", placeholder: "Lead with the answer, keep it tight" },
] as const;
const CREATE_ACCENT = "#2563EB";

export function CreateDemo() {
  const [step, setStep] = useState(0);
  const [value, setValue] = useState("");
  const total = INTERVIEW.length;
  const done = step >= total;
  const last = step === total - 1;
  const advance = () => {
    setValue("");
    setStep((s) => s + 1);
  };
  const reset = () => {
    setStep(0);
    setValue("");
  };

  return (
    <div className="w-full">
      <div className="rounded-[14px] border border-[var(--creed-border)] bg-[var(--creed-surface)] p-4 shadow-[0_8px_24px_rgba(28,28,26,0.06)]">
        <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--creed-surface-raised)]">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: CREATE_ACCENT }}
            initial={false}
            animate={{ width: `${(Math.min(step, total) / total) * 100}%` }}
            transition={{ duration: 0.4, ease: EASE }}
          />
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {!done ? (
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.24, ease: EASE }}
            >
              <div className="mt-4 text-[12px] font-medium text-[var(--creed-text-tertiary)]">
                Question {step + 1} of {total}
              </div>
              <div className="mt-1 text-[16px] font-medium leading-snug text-[var(--creed-text-primary)]">{INTERVIEW[step].label}</div>
              <input
                value={value}
                onChange={(event) => setValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    advance();
                  }
                }}
                placeholder={INTERVIEW[step].placeholder}
                className="mt-3 h-11 w-full rounded-xl border border-[var(--creed-border)] bg-[var(--creed-surface)] px-3.5 text-[14px] text-[var(--creed-text-primary)] outline-none transition-colors placeholder:text-[var(--creed-text-tertiary)] focus:border-[var(--creed-border-strong)]"
              />
              <button
                type="button"
                onClick={advance}
                className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-md bg-[var(--creed-text-primary)] px-4 text-[13px] font-medium text-[var(--creed-button-primary-fg)] transition-colors hover:bg-[var(--creed-button-primary-hover)]"
              >
                {last ? "Create my Creed" : "Continue"}
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="done"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.26, ease: EASE }}
              className="flex flex-col items-center justify-center gap-3 py-7 text-center"
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#ECFDF5] text-[#16A34A] dark:bg-[#052e1a]/55 dark:text-[#4ade80]">
                <Check className="h-4 w-4" />
              </span>
              <div className="text-[14px] font-medium text-[var(--creed-text-primary)]">Your starter Creed is ready</div>
              <button
                type="button"
                onClick={reset}
                className="inline-flex h-7 items-center gap-1.5 rounded-md border border-[var(--creed-border)] bg-[var(--creed-surface)] px-2.5 text-[12px] font-medium text-[var(--creed-text-secondary)] transition-colors hover:bg-[var(--creed-surface-raised)] hover:text-[var(--creed-text-primary)]"
              >
                <RotateCcw className="h-3 w-3" />
                Replay
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ----- step 2: connect (all-agents mashup) ---------------------------------

const ALL_AGENTS_MASK = {
  WebkitMaskImage: "url(/assets/agents/allagents.svg)",
  maskImage: "url(/assets/agents/allagents.svg)",
  WebkitMaskRepeat: "no-repeat",
  maskRepeat: "no-repeat",
  WebkitMaskPosition: "center",
  maskPosition: "center",
  WebkitMaskSize: "contain",
  maskSize: "contain",
} as const;

const CONNECT_PROMPT = "Connect to my Creed at https://creed.md/mcp and read it before you reply.";

export function ConnectDemo() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(CONNECT_PROMPT);
    } catch {
      // clipboard may be unavailable in some preview contexts; still flash.
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="w-full">
      <div className="flex w-full flex-col rounded-[14px] border border-[var(--creed-border)] bg-[var(--creed-surface)] p-5 text-left">
        <div className="flex items-center gap-3">
          {/* All-agents glyph recoloured by the cycling palette: the asset is a
              monochrome svg, so we mask the cycling background to its shape. */}
          <span aria-hidden className="creed-copy-cycle inline-block h-9 w-9 shrink-0" style={ALL_AGENTS_MASK} />
          <div>
            <div className="text-[15px] font-medium text-[var(--creed-text-primary)]">All agents</div>
            <div className="mt-1 text-[13px] text-[var(--creed-text-secondary)]">One prompt connects them all.</div>
          </div>
        </div>
        <p className="mt-4 text-[13px] leading-6 text-[var(--creed-text-secondary)]">
          Paste it into any AI. It reads your Creed before every reply.
        </p>
        <div className="mt-4">
          <AnimatedIconButton
            type="button"
            icon={CopyIcon}
            showIcon={!copied}
            className="creed-copy-cycle min-w-[116px] justify-center rounded-md px-4 text-white"
            onClick={() => void copy()}
          >
            {copied ? (
              <>
                <AnimatedCheckmark className="h-4 w-4" size={16} />
                Copied
              </>
            ) : (
              "Copy prompt"
            )}
          </AnimatedIconButton>
        </div>
      </div>
    </div>
  );
}

// ----- step 3: review (quality) --------------------------------------------

type Tone = "green" | "amber" | "red";
const TAG_TONE: Record<Tone, string> = {
  green: "bg-[#ECFDF5] text-[#047857] dark:bg-[#052e1a]/55 dark:text-[#4ade80]",
  amber: "bg-[#FFFBEB] text-[#92400E] dark:bg-[#451a03]/55 dark:text-[#fbbf24]",
  red: "bg-[#FEF2F2] text-[#B91C1C] dark:bg-[#3F1212]/55 dark:text-[#fca5a5]",
};

function TagPill({ label, tone }: { label: string; tone: Tone }) {
  return (
    <span className={cn("inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-[1.2]", TAG_TONE[tone])}>
      {label}
    </span>
  );
}

function NoteRow({ tone, note }: { tone: "good" | "mid" | "bad"; note: { title: string; detail: string } }) {
  const [open, setOpen] = useState(false);
  const color = tone === "good" ? "var(--creed-success)" : tone === "mid" ? "var(--creed-score-mid)" : "var(--creed-danger)";
  const symbol = tone === "good" ? "+" : tone === "mid" ? "/" : "−";
  return (
    <div className="overflow-hidden rounded-md transition-colors hover:bg-[var(--creed-surface-raised)]">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center gap-1.5 px-1.5 py-1 text-left">
        <span className="shrink-0 font-mono text-[12px] font-medium leading-[1.2]" style={{ color }}>
          {symbol}
        </span>
        <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-[var(--creed-text-primary)]">{note.title}</span>
        <ChevronDown
          className={cn(
            "h-3 w-3 shrink-0 transition-all duration-150",
            open ? "rotate-180 text-[var(--creed-text-primary)]" : "rotate-0 text-[var(--creed-text-tertiary)]"
          )}
        />
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="px-1.5 pb-1.5 pl-[18px] text-[12px] leading-[1.5] text-[var(--creed-text-secondary)]">{note.detail}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function ReviewDemo() {
  const accent = accentColorMap.identity;
  const score = 75;

  return (
    <div className="w-full">
      <div className="rounded-[14px] border border-[var(--creed-border)] bg-[var(--creed-surface)] p-4 shadow-[0_8px_24px_rgba(28,28,26,0.06)]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="h-7 w-[3px] shrink-0 rounded-full" style={{ backgroundColor: accent }} />
            <span className="text-[15px] font-medium" style={{ color: accent }}>
              Identity
            </span>
            <QualityRing score={score} color={accent} size={18} />
          </div>
          <span className="flex items-baseline gap-1.5">
            <span className="font-mono text-[20px] font-medium leading-none tabular-nums" style={{ color: qualityScoreColor(score) }}>
              {score}
            </span>
            <span className="text-[12px] font-medium text-[var(--creed-text-primary)]">/ 100</span>
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-1">
          <TagPill label="Concrete" tone="green" />
          <TagPill label="Generic" tone="amber" />
          <TagPill label="Vague" tone="red" />
        </div>
        <div className="mt-3 space-y-1 border-t border-[var(--creed-border)] pt-2">
          <NoteRow tone="good" note={{ title: "Location and role are clear", detail: "Names where you study and that you work solo with AI." }} />
          <NoteRow tone="mid" note={{ title: "A few lines stay generic", detail: "Some phrasing could apply to anyone; tighten it to you." }} />
          <NoteRow tone="bad" note={{ title: "Contains a stray line", detail: "A leftover scratch note near the end reads like garbage." }} />
        </div>
      </div>
    </div>
  );
}
