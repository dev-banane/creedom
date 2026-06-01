"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AnimatedCheckmark } from "@/components/ui/animated-checkmark";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CopyIcon } from "@/components/ui/copy";
import { AgentIconStack } from "@/components/creed/agent-icon-stack";
import { AnimatedIconButton } from "@/components/creed/animated-icon-action";
import { IntegrationGlyph } from "@/components/creed/brand";
import { McpHealthDashboard } from "@/components/creed/mcp-health-dashboard";
import { useCreed } from "@/components/creed/creed-provider";
import { cn } from "@/lib/utils";

function getPromptButtonClasses(connectionId: string) {
  switch (connectionId) {
    case "codex":
      return "bg-[#2563EB] text-white transition-colors hover:bg-[#1D4ED8]";
    case "claude":
      return "bg-[#FF6200] text-white hover:bg-[#E65A00]";
    case "openclaw":
      return "bg-[#FF0000] text-white hover:bg-[#E00000]";
    case "hermes":
      return "bg-[#FFBB00] text-white hover:bg-[#E6A900] dark:bg-[#D9A000] dark:hover:bg-[#B88600]";
    case "cursor":
    case "windsurf":
    case "opencode":
      return "bg-[#171717] text-white hover:bg-[#0F0F0F] dark:bg-[#e7e7e2] dark:text-[#0e0e0d] dark:hover:bg-[#cfcfc8]";
    case "custom":
      return "border border-[var(--creed-border-strong)] bg-[var(--creed-surface)] text-[var(--creed-text-primary)] hover:bg-[var(--creed-surface-raised)]";
    default:
      return "bg-[var(--creed-text-primary)] text-[var(--creed-button-primary-fg)] hover:bg-[var(--creed-button-primary-hover)]";
  }
}

function buildOpenCodeMcpConfig(url: string, token: string) {
  return JSON.stringify(
    {
      $schema: "https://opencode.ai/config.json",
      mcp: {
        creed: {
          type: "remote",
          url,
          enabled: true,
          oauth: false,
          headers: {
            Authorization: `Bearer ${token}`,
          },
          timeout: 30000,
        },
      },
    },
    null,
    2
  );
}

function buildMcpServersConfig(url: string, token: string) {
  return JSON.stringify(
    {
      mcpServers: {
        creed: {
          url,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      },
    },
    null,
    2
  );
}

function buildClaudeCodeConfig(url: string, token: string) {
  return [
    "claude mcp add-json creed '",
    JSON.stringify(
      {
        type: "http",
        url,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      null,
      2
    ),
    "'",
  ].join("");
}

function buildCodexMcpConfig(url: string, token: string) {
  return [
    "[mcp_servers.creed]",
    `url = "${url}"`,
    "enabled = true",
    "",
    "[mcp_servers.creed.http_headers]",
    `Authorization = "Bearer ${token}"`,
  ].join("\n");
}

// Per-agent MCP config. Keyed by the same ids as state.connections so each
// card can copy the exact config its agent expects. Anything not listed
// falls back to the standard remote mcpServers shape.
const agentMcpConfigBuilders: Record<string, (url: string, token: string) => string> = {
  codex: buildCodexMcpConfig,
  claude: buildClaudeCodeConfig,
  opencode: buildOpenCodeMcpConfig,
  cursor: buildMcpServersConfig,
  windsurf: buildMcpServersConfig,
  openclaw: buildMcpServersConfig,
  hermes: buildMcpServersConfig,
  custom: buildMcpServersConfig,
};

function buildAgentMcpConfig(id: string, url: string, token: string) {
  return (agentMcpConfigBuilders[id] ?? buildMcpServersConfig)(url, token);
}

function buildMcpSetupPrompt(config: string, opencodeConfig: string) {
  return [
    "Set up Creed MCP for me in this agent environment.",
    "",
    "Before you do anything else:",
    "- Read https://creed.md/docs once and use it as the operating guide for this setup.",
    "",
    "Goal:",
    "- Install the Creed MCP server config below into your persistent MCP configuration so future sessions can use Creed without me pasting this setup prompt again.",
    "- This should be a one-prompt setup. Do the install, verification, and durable reminder now without asking me to paste a second prompt.",
    "- After installing it, verify the connection by listing the MCP tools and calling read_creed once.",
    "- Also call get_write_policy and confirm whether you can direct_edit_creed or should use propose_creed_update.",
    "- Do not claim Creed is connected unless read_creed succeeds and you can see a valid write policy.",
    "- Read Creed before meaningful work and identify the sections that matter for the task before planning.",
    "- At the end of meaningful work, use the self-improvement contract from Creed to decide whether the file should be refined, pruned, or left unchanged.",
    "- If a durable improvement exists, use propose_creed_update or direct_edit_creed according to the write policy.",
    "- If nothing durable changed, do nothing. Do not create update noise just to show activity.",
    "- When calling Creed MCP tools, include your product name as agentName when the tool accepts it, for example Codex, Claude Code, OpenClaw, Hermes, OpenCode, or Custom Agent.",
    "",
    "OpenCode-specific setup:",
    "- If this environment is OpenCode, do not run opencode mcp auth creed. Creed MCP uses a bearer token, not OAuth.",
    "- Install the OpenCode config below into the persistent OpenCode config, usually ~/.config/opencode/opencode.json or the active project opencode.json.",
    "- Keep oauth set to false so OpenCode does not try to start an OAuth flow.",
    "",
    "OpenCode MCP config:",
    "```json",
    opencodeConfig,
    "```",
    "",
    "Important:",
    "- Do not just store this in conversation context.",
    "- Do not ask me to manually edit config unless you do not have permission to update your own MCP configuration.",
    "- If you cannot write the config yourself, tell me exactly which file or settings screen needs this config and paste the ready-to-use block.",
    "- If your environment supports persistent instructions, startup hooks, recurring reminders, or task-end checks, add a lightweight reminder to read Creed at the start of meaningful work and revisit it at the end.",
    "- After verification, tell me the exact tools you saw and the write mode you confirmed.",
    "- Treat the Authorization value as a secret. Do not print it again unless I explicitly ask for manual setup help.",
    "",
    "Standard Creed MCP config for agents that use mcpServers:",
    "```json",
    config,
    "```",
    "",
    "After setup, use Creed MCP as the preferred connection path. If anything is unclear, read https://creed.md/docs before asking me.",
  ].join("\n");
}

export function ConnectionsScreen() {
  const router = useRouter();
  const { state } = useCreed();
  const [copied, setCopied] = useState<string | null>(null);
  const [agentSetupOpen, setAgentSetupOpen] = useState(false);

  async function copyValue(key: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    window.setTimeout(() => setCopied(null), 1600);
  }

  useEffect(() => {
    if (state.sections.length === 0) {
      router.replace("/onboarding");
    }
  }, [router, state.sections.length]);

  const mcpStatusLabel = !state.mcpToken
    ? "Not connected via MCP"
    : state.mcpStatus === "connected"
      ? "Connected via MCP"
      : "Not connected via MCP";
  const openCodeMcpConfig = buildOpenCodeMcpConfig(state.mcpUrl, state.mcpToken);
  const mcpSetupPrompt = buildMcpSetupPrompt(state.mcpConfig, openCodeMcpConfig);
  const showMcpStack = state.mcpStatus === "connected" && state.mcpClients.length > 0;

  return (
    <div className="h-full overflow-y-auto bg-[var(--creed-surface)] creed-scrollbar">
        <div className="mx-auto max-w-6xl px-4 py-8 md:px-12 md:py-10">
          <div className="max-w-3xl">
            <h1 className="font-heading text-[1.75rem] font-medium tracking-[-0.03em] text-[var(--creed-text-primary)]">
              Connections
            </h1>
          </div>

          <div className="mt-8">
            <h2 className="text-[16px] font-medium text-[var(--creed-text-primary)]">
              MCP setup
            </h2>
            <p className="mt-2 text-[14px] leading-7 text-[var(--creed-text-secondary)]">
              The recommended way to connect any agent that supports MCP.
            </p>
          </div>

          <div className="mt-5 flex h-auto flex-col self-start rounded-[16px] border border-[var(--creed-border)] bg-[var(--creed-surface)] p-4 md:p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <IntegrationGlyph kind="mcp" framed={false} className="h-9 w-9 shrink-0" />
                <div>
                  <div className="text-[15px] font-medium text-[var(--creed-text-primary)]">
                    All Agents
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-[var(--creed-text-secondary)]">
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full",
                        state.mcpStatus === "connected"
                          ? "bg-[#16A34A]"
                          : "bg-[var(--creed-border-strong)]"
                      )}
                    />
                    <span>{mcpStatusLabel}</span>
                    {showMcpStack ? (
                      <AgentIconStack
                        agents={state.mcpClients}
                        variant="inline"
                        className="gap-1.5"
                        itemClassName="h-4 w-4"
                        maxVisible={6}
                      />
                    ) : null}
                    {state.mcpStatus === "connected" && state.mcpLastUsed ? (
                      <>
                        <span>·</span>
                        <span>Last seen {state.mcpLastUsed}</span>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <p className="mt-4 text-[13px] leading-6 text-[var(--creed-text-secondary)]">
              Paste this prompt into any agent and it installs the Creed MCP server itself.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-3">
                <AnimatedIconButton
                  icon={CopyIcon}
                  showIcon={copied !== "mcp-prompt"}
                  className="min-w-[116px] justify-center rounded-md bg-[var(--creed-text-primary)] px-4 text-[var(--creed-button-primary-fg)] hover:bg-[var(--creed-button-primary-hover)]"
                  onClick={() => copyValue("mcp-prompt", mcpSetupPrompt)}
                >
                  {copied === "mcp-prompt" ? (
                    <>
                      <AnimatedCheckmark className="h-4 w-4" size={16} />
                      Copied
                    </>
                  ) : (
                    "Copy prompt"
                  )}
                </AnimatedIconButton>
                <Button
                  variant="ghost"
                  className="rounded-md text-[var(--creed-text-secondary)] hover:text-[var(--creed-text-primary)]"
                  onClick={() => setAgentSetupOpen((current) => !current)}
                >
                  {agentSetupOpen ? "Hide specific agents" : "Show specific agents"}
                </Button>
              </div>

            <AnimatePresence initial={false}>
              {agentSetupOpen ? (
                <motion.div
                  initial={{ height: 0, opacity: 0, y: -8 }}
                  animate={{ height: "auto", opacity: 1, y: 0 }}
                  exit={{ height: 0, opacity: 0, y: -8 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="overflow-hidden"
                >
                  <div className="mt-5 grid items-start gap-4 border-t border-[var(--creed-border)] pt-5 lg:grid-cols-2">
                    {state.connections.map((connection) => {
                      const prompt = connection.promptVariant ?? state.universalConnectionPrompt;
                      const configKey = `config-${connection.id}`;
                      const promptKey = `prompt-${connection.id}`;

                      return (
                        <div
                          key={connection.id}
                          className="flex h-auto flex-col self-start rounded-[14px] border border-[var(--creed-border)] bg-[var(--creed-surface)] p-4"
                        >
                          <div className="flex items-center gap-3">
                            <IntegrationGlyph kind={connection.icon} framed={false} className="h-9 w-9 shrink-0" />
                            <div>
                              <div className="text-[15px] font-medium text-[var(--creed-text-primary)]">
                                {connection.name}
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-[var(--creed-text-secondary)]">
                                <span
                                  className={cn(
                                    "h-2 w-2 rounded-full",
                                    connection.status === "connected"
                                      ? "bg-[#16A34A]"
                                      : "bg-[var(--creed-border-strong)]"
                                  )}
                                />
                                <span>
                                  {connection.status === "connected" ? "Connected" : "Not connected"}
                                </span>
                                {connection.status === "connected" && connection.lastUsed ? (
                                  <>
                                    <span>·</span>
                                    <span>Last seen {connection.lastUsed}</span>
                                  </>
                                ) : null}
                              </div>
                            </div>
                          </div>

                          <p className="mt-4 text-[13px] leading-6 text-[var(--creed-text-secondary)]">
                            {connection.description}
                          </p>

                          <div className="mt-5 flex flex-wrap items-center gap-3">
                            <AnimatedIconButton
                              icon={CopyIcon}
                              showIcon={copied !== promptKey}
                              className={cn("min-w-[116px] justify-center rounded-md px-4", getPromptButtonClasses(connection.id))}
                              onClick={() => copyValue(promptKey, prompt)}
                            >
                              {copied === promptKey ? (
                                <>
                                  <AnimatedCheckmark className="h-4 w-4" size={16} />
                                  Copied
                                </>
                              ) : (
                                "Copy prompt"
                              )}
                            </AnimatedIconButton>
                            <Button
                              variant="ghost"
                              className="rounded-md text-[var(--creed-text-secondary)] hover:text-[var(--creed-text-primary)]"
                              onClick={() =>
                                copyValue(configKey, buildAgentMcpConfig(connection.id, state.mcpUrl, state.mcpToken))
                              }
                            >
                              {copied === configKey ? (
                                <>
                                  <AnimatedCheckmark className="h-4 w-4" size={16} />
                                  Copied
                                </>
                              ) : (
                                "Copy config"
                              )}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          <McpHealthDashboard />
        </div>
    </div>
  );
}
