"use client";

import { useState } from "react";
import { AnimatedCheckmark } from "@/components/ui/animated-checkmark";
import { CopyIcon } from "@/components/ui/copy";
import { PlusIcon } from "@/components/ui/plus";
import { AnimatedIconButton } from "@/components/creed/animated-icon-action";
import { IntegrationGlyph } from "@/components/creed/brand";
import type { ConnectionItem, McpClient } from "@/lib/creed-data";
import { cn } from "@/lib/utils";

// Per-agent button colour, matching each client's brand.
function getAgentButtonClasses(connectionId: string) {
  switch (connectionId) {
    case "codex":
      return "bg-[#2563EB] text-white transition-colors hover:bg-[#1D4ED8]";
    case "claude":
    case "claudecode":
      return "bg-[#FF6200] text-white hover:bg-[#E65A00]";
    case "openclaw":
      return "bg-[#FF0000] text-white hover:bg-[#E00000]";
    case "hermes":
      return "bg-[#FFBB00] text-white hover:bg-[#E6A900] dark:bg-[#D9A000] dark:hover:bg-[#B88600]";
    case "chatgpt":
    case "cursor":
    case "devin":
    case "grok":
    case "v0":
    case "opencode":
      return "bg-[#171717] text-white hover:bg-[#0F0F0F] dark:bg-[#e7e7e2] dark:text-[#0e0e0d] dark:hover:bg-[#cfcfc8]";
    case "custom":
      return "border border-[var(--creed-border-strong)] bg-[var(--creed-surface)] text-[var(--creed-text-primary)] hover:bg-[var(--creed-surface-raised)]";
    default:
      return "bg-[var(--creed-text-primary)] text-[var(--creed-button-primary-fg)] hover:bg-[var(--creed-button-primary-hover)]";
  }
}

// Per-card connected status from the live MCP client roster, matched by resolved
// brand icon. The roster updates on every MCP request - including reads - so a
// card lights up as soon as its agent connects (the legacy per-id status only
// updated on writes / proposals).
export function resolveConnectionStatus(connection: ConnectionItem, mcpClients: McpClient[]) {
  const matched = mcpClients.find((client) => client.icon === connection.icon);
  return {
    isConnected: Boolean(matched) || connection.status === "connected",
    lastSeen: matched?.lastUsed ?? connection.lastUsed,
  };
}

// One per-agent connect card, used on both /connections and the onboarding
// Connect step. Self-contained: it manages its own copy/flash state and chooses
// the action by what the connection offers (deep link -> "Add MCP", command ->
// "Copy command", otherwise "Copy URL").
export function ConnectionCard({
  connection,
  mcpUrl,
  isConnected,
  lastSeen,
}: {
  connection: ConnectionItem;
  mcpUrl: string;
  isConnected: boolean;
  lastSeen?: string;
}) {
  const [flashed, setFlashed] = useState(false);
  const flash = () => {
    setFlashed(true);
    window.setTimeout(() => setFlashed(false), 1600);
  };
  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    flash();
  };
  const buttonClass = cn(
    "min-w-[116px] justify-center rounded-md px-4",
    getAgentButtonClasses(connection.id)
  );

  return (
    <div className="flex h-auto flex-col self-start rounded-[14px] border border-[var(--creed-border)] bg-[var(--creed-surface)] p-4">
      <div className="flex items-center gap-3">
        <IntegrationGlyph kind={connection.icon} framed={false} className="h-9 w-9 shrink-0" />
        <div>
          <div className="text-[15px] font-medium text-[var(--creed-text-primary)]">
            {connection.name}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-[var(--creed-text-secondary)]">
            <span
              className={cn(
                "h-2 w-2 rounded-[3px]",
                isConnected ? "bg-[#16A34A]" : "bg-[var(--creed-border-strong)]"
              )}
            />
            <span>{isConnected ? "Connected" : "Not connected"}</span>
            {isConnected && lastSeen ? (
              <>
                <span>·</span>
                <span>Last seen {lastSeen}</span>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <p className="mt-4 text-[13px] leading-6 text-[var(--creed-text-secondary)]">
        {connection.connectHint}
      </p>

      {connection.command ? (
        <div className="mt-3 w-fit max-w-full self-start rounded-[var(--radius-md)] border border-[var(--creed-border)] px-3 py-2 font-mono text-[13px] text-[var(--creed-text-primary)]">
          <span className="block break-all">{connection.command}</span>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {connection.deepLink ? (
          <AnimatedIconButton
            icon={PlusIcon}
            showIcon={!flashed}
            className={buttonClass}
            onClick={() => {
              const href = connection.deepLink ?? "";
              flash();
              if (href) {
                window.location.href = href;
              }
            }}
          >
            {flashed ? (
              <>
                <AnimatedCheckmark className="h-4 w-4" size={16} />
                Added
              </>
            ) : (
              "Add MCP"
            )}
          </AnimatedIconButton>
        ) : connection.command ? (
          <AnimatedIconButton
            icon={CopyIcon}
            showIcon={!flashed}
            className={buttonClass}
            onClick={() => copy(connection.command ?? "")}
          >
            {flashed ? (
              <>
                <AnimatedCheckmark className="h-4 w-4" size={16} />
                Copied
              </>
            ) : (
              "Copy command"
            )}
          </AnimatedIconButton>
        ) : (
          <AnimatedIconButton
            icon={CopyIcon}
            showIcon={!flashed}
            className={buttonClass}
            onClick={() => copy(mcpUrl)}
          >
            {flashed ? (
              <>
                <AnimatedCheckmark className="h-4 w-4" size={16} />
                Copied
              </>
            ) : (
              "Copy URL"
            )}
          </AnimatedIconButton>
        )}
      </div>
    </div>
  );
}
