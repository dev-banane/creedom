// The /learn article registry. Each guide is one file exporting an `Article`;
// this module collects them, orders them, and exposes lookup helpers used by
// the /learn index, the /learn/[slug] pages, the sitemap, and the llms files.

import type { Article, LearnCluster } from "./types";
import { CLUSTER_META } from "./types";

// Category
import { whatIsAPersonalContextFile } from "./what-is-a-personal-context-file";
import { personalContextFileTemplate } from "./personal-context-file-template";
import { claudeMdForYourLife } from "./claude-md-for-your-life";
import { personalClaudeMdTemplate } from "./personal-claude-md-template";
import { aboutMeMd } from "./about-me-md";
import { tabAutocomplete } from "./tab-autocomplete";
// Problem
import { whyChatgptForgetsYou } from "./why-chatgpt-forgets-you";
import { chatgptCustomInstructionsLimit } from "./chatgpt-custom-instructions-limit";
import { stopRepeatingYourselfToAi } from "./stop-repeating-yourself-to-ai";
import { shareContextBetweenChatgptAndClaude } from "./share-context-between-chatgpt-and-claude";
import { syncAiMemoryAcrossTools } from "./sync-ai-memory-across-tools";
import { exportChatgptMemory } from "./export-chatgpt-memory";
// Comparison
import { creedVsChatgptMemory } from "./creed-vs-chatgpt-memory";
import { creedVsClaudeMemory } from "./creed-vs-claude-memory";
import { memoryMcpServersCompared } from "./memory-mcp-servers-compared";
import { creedVsMem0 } from "./creed-vs-mem0";
import { browserExtensionVsMcpContext } from "./browser-extension-vs-mcp-context";
import { rewindLimitlessAlternatives } from "./rewind-limitless-alternatives";
// Integration
import { connectCreedToClaudeCode } from "./connect-creed-to-claude-code";
import { connectCreedToChatgpt } from "./connect-creed-to-chatgpt";
import { connectCreedToCursor } from "./connect-creed-to-cursor";
// Company
import { teamContextFile } from "./team-context-file";
import { teamClaudeMd } from "./team-claude-md";

// Order here = priority order from the plan, and the order guides appear
// within a cluster on the index page.
export const learnArticles: Article[] = [
  whatIsAPersonalContextFile,
  personalContextFileTemplate,
  claudeMdForYourLife,
  personalClaudeMdTemplate,
  aboutMeMd,
  tabAutocomplete,
  whyChatgptForgetsYou,
  chatgptCustomInstructionsLimit,
  stopRepeatingYourselfToAi,
  shareContextBetweenChatgptAndClaude,
  syncAiMemoryAcrossTools,
  exportChatgptMemory,
  creedVsChatgptMemory,
  creedVsClaudeMemory,
  memoryMcpServersCompared,
  creedVsMem0,
  browserExtensionVsMcpContext,
  rewindLimitlessAlternatives,
  connectCreedToClaudeCode,
  connectCreedToChatgpt,
  connectCreedToCursor,
  teamContextFile,
  teamClaudeMd,
];

export function getArticle(slug: string): Article | undefined {
  return learnArticles.find((a) => a.slug === slug);
}

export type ClusterGroup = {
  cluster: LearnCluster;
  title: string;
  blurb: string;
  articles: Article[];
};

// Articles grouped by cluster, in the cluster display order.
export function articlesByCluster(): ClusterGroup[] {
  const clusters = Object.keys(CLUSTER_META) as LearnCluster[];
  return clusters
    .sort((a, b) => CLUSTER_META[a].order - CLUSTER_META[b].order)
    .map((cluster) => ({
      cluster,
      title: CLUSTER_META[cluster].title,
      blurb: CLUSTER_META[cluster].blurb,
      articles: learnArticles.filter((a) => a.cluster === cluster),
    }))
    .filter((group) => group.articles.length > 0);
}
