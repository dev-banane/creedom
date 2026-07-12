"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type SystemStatus =
  | "operational"
  | "degraded"
  | "maintenance"
  | "outage"
  | "unknown";

type StatusVariant = {
  label: string;
  dot: string;
  pulse: string;
  text: string;
};

type LiveStatusColor = "green" | "yellow" | "red";

type LiveStatusResponse = {
  label?: unknown;
  color?: unknown;
};

const DEFAULT_STATUS: SystemStatus = "operational";
const DEFAULT_LABEL = "Fully operational";
const STATUS_ENDPOINT = "/api/status";

const STATUS_COLOR_CLASSES: Record<LiveStatusColor, Pick<StatusVariant, "dot" | "pulse">> = {
  green: {
    dot: "bg-[#22C55E]",
    pulse: "bg-[#22C55E]/60",
  },
  yellow: {
    dot: "bg-[#F59E0B]",
    pulse: "bg-[#F59E0B]/60",
  },
  red: {
    dot: "bg-[#DC2626]",
    pulse: "bg-[#DC2626]/60",
  },
};

const STATUS_VARIANTS: Record<SystemStatus, StatusVariant> = {
  operational: {
    label: DEFAULT_LABEL,
    dot: "bg-[#22C55E]",
    pulse: "bg-[#22C55E]/60",
    text: "text-[var(--creed-text-secondary)]",
  },
  degraded: {
    label: "Degraded performance",
    dot: "bg-[#F59E0B]",
    pulse: "bg-[#F59E0B]/60",
    text: "text-[var(--creed-text-secondary)]",
  },
  maintenance: {
    label: "Scheduled maintenance",
    dot: "bg-[#2563EB]",
    pulse: "bg-[#2563EB]/60",
    text: "text-[var(--creed-text-secondary)]",
  },
  outage: {
    label: "Service disruption",
    dot: "bg-[#DC2626]",
    pulse: "bg-[#DC2626]/60",
    text: "text-[var(--creed-text-secondary)]",
  },
  unknown: {
    label: "Status unavailable",
    dot: "bg-[var(--creed-text-tertiary)]",
    pulse: "bg-transparent",
    text: "text-[var(--creed-text-tertiary)]",
  },
};

function isLiveStatusColor(value: unknown): value is LiveStatusColor {
  return value === "green" || value === "yellow" || value === "red";
}

export function SystemStatusPill({
  status = DEFAULT_STATUS,
  href,
  className,
}: {
  status?: SystemStatus;
  href?: string;
  className?: string;
}) {
  const initialVariant = STATUS_VARIANTS[status];
  const [liveStatus, setLiveStatus] = useState<{
    label: string;
    color: LiveStatusColor;
  }>({
    label: initialVariant.label,
    color: status === "outage" ? "red" : status === "operational" ? "green" : "yellow",
  });

  useEffect(() => {
    let cancelled = false;

    async function loadStatus() {
      // Skip while hidden; the next visible poll (or refocus) catches up.
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch(STATUS_ENDPOINT);
        if (!response.ok) return;

        const data = (await response.json()) as LiveStatusResponse;
        const label = typeof data.label === "string" ? data.label.trim() : "";
        const color = isLiveStatusColor(data.color) ? data.color : null;

        if (!cancelled && label && color) {
          setLiveStatus({ label, color });
        }
      } catch {
        // Keep the server-rendered fallback if the status endpoint is unreachable.
      }
    }

    void loadStatus();
    // 5 min cadence: the route is CDN-cached for 60s anyway, and a status
    // pill in the footer doesn't need sub-minute freshness.
    const intervalId = window.setInterval(loadStatus, 300_000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  const variant = {
    ...initialVariant,
    label: liveStatus.label,
    ...STATUS_COLOR_CLASSES[liveStatus.color],
  };
  const Tag = href ? "a" : "div";

  return (
    <Tag
      {...(href ? { href, target: "_blank", rel: "noreferrer" } : {})}
      className={cn(
        "t-meta inline-flex items-center gap-2 rounded-[10px] bg-[var(--creed-surface-raised)] px-3 py-2 font-medium leading-none transition-colors hover:bg-[var(--creed-border)] hover:text-[var(--creed-text-primary)]",
        variant.text,
        className
      )}
    >
      <span className="relative flex h-2 w-2">
        <span
          className={cn(
            "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
            variant.pulse
          )}
        />
        <span className={cn("relative inline-flex h-2 w-2 rounded-full", variant.dot)} />
      </span>
      <span className="leading-none">{variant.label}</span>
    </Tag>
  );
}
