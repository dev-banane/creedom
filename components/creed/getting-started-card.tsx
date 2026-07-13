"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { useCreed } from "@/components/creed/creed-provider";
import {
  GETTING_STARTED_STEPS,
  type GettingStartedStepKey,
} from "@/lib/creed-data";
import { cn } from "@/lib/utils";

// Post-onboarding "Get started" checklist. Lives in the bottom-right corner
// where toasts spawn, shaped like a toast: same width, radius, and shadow,
// but surfaced as the app background with a plain border. The chevron
// expands the five steps; each checks itself off the first time the user
// does the thing (see markGettingStartedStep call sites). Once all five are
// done the card shows a brief all-set moment and never renders again.
//
// The card publishes its rendered height as --getting-started-offset on the
// root element; the shared <Toaster> offsets by it, so toasts always stack
// just above the card and track its expansion in real time.

const COLLAPSE_PREF_KEY = "creed:getting-started-collapsed";
const OFFSET_VAR = "--getting-started-offset";
const COMPLETION_LINGER_MS = 2_800;

function ProgressRing({ done, total }: { done: number; total: number }) {
  const radius = 7;
  const circumference = 2 * Math.PI * radius;
  const fraction = total === 0 ? 0 : done / total;
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <circle
        cx="9"
        cy="9"
        r={radius}
        fill="none"
        stroke="var(--creed-border)"
        strokeWidth="2"
      />
      <circle
        cx="9"
        cy="9"
        r={radius}
        fill="none"
        stroke="#2563EB"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - fraction)}
        transform="rotate(-90 9 9)"
        className="transition-[stroke-dashoffset] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
      />
    </svg>
  );
}

export function GettingStartedCard() {
  const { state } = useCreed();
  const gettingStarted = state.gettingStarted;

  const [expanded, setExpanded] = useState(false);
  // Completion is held on screen briefly before the card leaves for good.
  const [lingering, setLingering] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sawIncompleteRef = useRef(false);

  const steps = gettingStarted?.steps ?? {};
  const doneCount = GETTING_STARTED_STEPS.filter(({ key }) => steps[key]).length;
  const total = GETTING_STARTED_STEPS.length;
  const allDone = doneCount === total || Boolean(gettingStarted?.completedAt);

  // Expanded by default the very first time; collapse choice remembered.
  useEffect(() => {
    try {
      setExpanded(localStorage.getItem(COLLAPSE_PREF_KEY) !== "1");
    } catch {
      setExpanded(true);
    }
  }, []);

  // Completing the last step while the card is on screen earns the all-set
  // moment; arriving already-complete (page load after the fact) does not.
  useEffect(() => {
    if (!gettingStarted) return;
    if (!allDone) {
      sawIncompleteRef.current = true;
      return;
    }
    if (sawIncompleteRef.current && !lingering) {
      setLingering(true);
      const timeout = window.setTimeout(
        () => setLingering(false),
        COMPLETION_LINGER_MS,
      );
      return () => window.clearTimeout(timeout);
    }
  }, [gettingStarted, allDone, lingering]);

  const visible = Boolean(gettingStarted) && (!allDone || lingering);

  // Publish the card's live height so the toast stack sits above it. The
  // observer tracks the expand/collapse animation frame by frame.
  useEffect(() => {
    const root = document.documentElement;
    if (!visible) {
      root.style.removeProperty(OFFSET_VAR);
      return;
    }
    const node = containerRef.current;
    if (!node) return;
    const update = () => {
      root.style.setProperty(
        OFFSET_VAR,
        `${Math.ceil(node.getBoundingClientRect().height) + 12}px`,
      );
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => {
      observer.disconnect();
      root.style.removeProperty(OFFSET_VAR);
    };
  }, [visible]);

  if (!visible) return null;

  function toggleExpanded() {
    setExpanded((current) => {
      const next = !current;
      try {
        localStorage.setItem(COLLAPSE_PREF_KEY, next ? "0" : "1");
      } catch {
        // Preference only; losing it just means the default next load.
      }
      return next;
    });
  }

  return (
    <div
      ref={containerRef}
      className="fixed bottom-5 right-5 z-40 hidden w-[356px] sm:block"
    >
      <div className="overflow-hidden rounded-[14px] border border-[var(--creed-border)] bg-[var(--creed-background)] shadow-[0_10px_30px_rgba(28,28,26,0.10)]">
        {lingering && allDone ? (
          <div className="flex items-center gap-3 p-3.5">
            <ProgressRing done={total} total={total} />
            <div className="text-[13px] font-medium leading-5 text-[var(--creed-text-primary)]">
              You&apos;re all set.
            </div>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={toggleExpanded}
              aria-expanded={expanded}
              className="flex w-full items-center gap-3 p-3.5 text-left"
            >
              <ProgressRing done={doneCount} total={total} />
              <span className="flex-1 text-[13px] font-medium leading-5 text-[var(--creed-text-primary)]">
                Get started
              </span>
              <span className="text-[12px] tabular-nums text-[var(--creed-text-tertiary)]">
                {doneCount}/{total}
              </span>
              <span className="flex h-7 w-7 items-center justify-center rounded-[8px] text-[var(--creed-text-secondary)] transition-colors hover:bg-[var(--creed-surface-raised)]">
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform duration-300",
                    expanded && "rotate-180",
                  )}
                />
              </span>
            </button>
            <div
              className={cn(
                "grid transition-[grid-template-rows,opacity] duration-[280ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
                expanded
                  ? "grid-rows-[1fr] opacity-100"
                  : "grid-rows-[0fr] opacity-0",
              )}
            >
              <div className="min-h-0 overflow-hidden">
                <ul className="px-3.5 pb-3 pt-0.5">
                  {GETTING_STARTED_STEPS.map(({ key, label }) => (
                    <StepRow key={key} stepKey={key} label={label} done={Boolean(steps[key])} />
                  ))}
                </ul>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StepRow({
  stepKey,
  label,
  done,
}: {
  stepKey: GettingStartedStepKey;
  label: string;
  done: boolean;
}) {
  return (
    <li data-step={stepKey} className="flex items-center gap-2.5 py-[7px]">
      <span
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          done
            ? "scale-100 border-transparent bg-[#2563EB]"
            : "border-[var(--creed-border-strong)] bg-transparent",
        )}
      >
        <Check
          strokeWidth={3}
          className={cn(
            "h-2.5 w-2.5 text-white transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
            done ? "scale-100 opacity-100" : "scale-50 opacity-0",
          )}
        />
      </span>
      <span
        className={cn(
          "text-[13px] leading-5 transition-colors duration-300",
          done
            ? "text-[var(--creed-text-tertiary)]"
            : "text-[var(--creed-text-secondary)]",
        )}
      >
        {label}
      </span>
    </li>
  );
}
