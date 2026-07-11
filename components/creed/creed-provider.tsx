"use client";

// Mutator functions in this provider are intentionally declared as plain
// inline `function` declarations rather than `useCallback`s. Every mutator
// goes through `commitState`, which uses `setState`'s function-update
// form - so the "stale closure" risk that `react-hooks/exhaustive-deps`
// is meant to catch can't actually occur here. Wrapping each of 30+
// mutators in `useCallback` (with manually-curated deps for each) would
// be a large surface for subtle bugs without changing observable
// behaviour. Consumers that need fine-grained re-render control should
// use a selector pattern over the context value, not rely on referential
// stability of every action.
/* eslint-disable react-hooks/exhaustive-deps */

import {
  createContext,
  useCallback,
  useEffect,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  buildVisibleCreedMarkdown,
  createStarterContent,
  applyReorderDraft,
  getMetaProposalDiffText,
  getProposalPreviewText,
  inferAgentSectionAccent,
  initialOnboardingState,
  initialCreedState,
  isAccentKey,
  normalizeLegacyProposalDraft,
  normalizeProposalForSection,
  permissionToWritable,
  type AccentKey,
  type ActivityEntry,
  type AgentPermission,
  type CreedSection,
  type CreedSettings,
  type CreedState,
  type Proposal,
  type ProposalDraft,
} from "@/lib/creed-data";
import { normalizeRichTextInput, richTextContentEquivalent } from "@/lib/rich-text";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { toast } from "sonner";

type CreedContextValue = {
  state: CreedState;
  toggleLock: () => void;
  toggleSectionLock: (sectionId: string) => void;
  updateRichTextSection: (sectionId: string, content: string) => void;
  // Company Proposal-only members file a manual edit as a proposal on demand
  // (via the "submit proposal" button), rather than autosaving it. Optimistic:
  // returns immediately after showing the pending card, persisting in the
  // background. Returns false only when it can't even start (no active Creed).
  fileProposalEdit: (sectionId: string, content: string) => boolean;
  reorderSections: (sectionIds: string[]) => void;
  addSection: (name: string, starter?: string) => CreedSection;
  addSectionAfter: (
    afterSectionId: string,
    name: string,
    starter?: string,
  ) => void;
  renameSection: (sectionId: string, name: string) => void;
  setSectionAccent: (sectionId: string, accent: AccentKey) => void;
  duplicateSection: (sectionId: string) => void;
  deleteSection: (sectionId: string) => void;
  archiveSection: (sectionId: string) => void;
  restoreSection: (sectionId: string) => void;
  archiveCreed: () => void;
  clearSections: () => void;
  acceptProposal: (proposalId: string) => Promise<void>;
  acceptProposals: (proposalIds: string[]) => void;
  rejectProposal: (proposalId: string) => void;
  withdrawProposal: (proposalId: string) => void;
  editProposalDraft: (proposalId: string, draft: ProposalDraft) => void;
  setSectionPermission: (
    sectionId: string,
    permission: AgentPermission,
  ) => void;
  setAllSectionPermissions: (
    permission: "read-only" | "propose" | "direct",
  ) => void;
  setVersionControlConfig: (
    patch: Partial<CreedSettings["versionControl"]>,
  ) => void;
  setDisplayName: (name: string) => Promise<boolean>;
  setProfileAvatar: (avatarUrl: string, scope: "personal" | "company") => void;
  refreshState: () => Promise<void>;
  switchCreed: (creedId: string) => Promise<{ ok: boolean; error?: string }>;
  importSections: (sections: CreedSection[]) => Promise<void>;
  deleteAccount: () => Promise<void>;
  updateOnboarding: (patch: Partial<CreedState["onboarding"]>) => void;
  resetOnboarding: () => void;
  claimOnboardingPreview: (sections: CreedSection[]) => Promise<void>;
  signOut: () => Promise<void>;
  exportMarkdown: () => string;
  exportActivityJson: () => string;
  exportAllDataJson: () => string;
};

const CreedContext = createContext<CreedContextValue | null>(null);
const AUTOSAVE_DELAY_MS = 500;
const EXTERNAL_SYNC_INTERVAL_MS = 30_000;
// Company Creeds are multi-user, so changes (proposals, edits, reviews) need to
// surface on everyone's screen quickly - poll far more often than the personal
// single-user case. Focus/visibility refetches still make tab-switches instant.
const COMPANY_SYNC_INTERVAL_MS = 5_000;

function nextMutationTick(state: CreedState) {
  return {
    ...state,
    mutationTick: state.mutationTick + 1,
  };
}

function updateSectionMeta(
  section: CreedSection,
  actor: string,
  type: "user" | "agent",
) {
  return {
    ...section,
    lastEditedBy: actor,
    lastEditedType: type,
    lastEditedLabel: "just now",
  } as CreedSection;
}

function getInitials(name: string) {
  const parts = name
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return "CR";
  }

  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function mergeExternalState(
  current: CreedState,
  incoming: CreedState,
  canReplaceSections: boolean,
  // Proposal ids resolved locally (accepted / rejected / gone-stale) whose
  // resolution may not have reached the server yet. The server copy of these
  // is still "pending", so taking `incoming.proposals` verbatim used to
  // resurrect a just-accepted proposal whenever a focus/visibility/poll sync
  // raced the persist - and the resurrected copy then failed the revision
  // guard and got marked stale. An id is confirmed (removed from the set)
  // once the server stops listing it as pending. Confirmation is derived from
  // the incoming payload alone - never from the set's own prior state - so
  // re-running this merge (React StrictMode double-invokes updaters) yields
  // the same result.
  resolvedProposalIds: Set<string>,
) {
  const incomingPendingIds = new Set(
    incoming.proposals
      .filter((proposal) => proposal.status === "pending")
      .map((proposal) => proposal.id),
  );
  for (const id of Array.from(resolvedProposalIds)) {
    if (!incomingPendingIds.has(id)) {
      resolvedProposalIds.delete(id);
    }
  }
  const proposals = incoming.proposals.filter(
    (proposal) => !resolvedProposalIds.has(proposal.id),
  );

  return {
    ...current,
    // Company / switcher context always reflects the server (which Creed is
    // active, the roster, permissions, billing/freeze state).
    creedId: incoming.creedId,
    creedType: incoming.creedType,
    creeds: incoming.creeds,
    company: incoming.company,
    user: incoming.user,
    readUrl: incoming.readUrl,
    readToken: incoming.readToken,
    writeToken: incoming.writeToken,
    directEditToken: incoming.directEditToken,
    mcpUrl: incoming.mcpUrl,
    mcpStatus: incoming.mcpStatus,
    mcpLastUsed: incoming.mcpLastUsed,
    mcpLastClientName: incoming.mcpLastClientName,
    mcpClients: incoming.mcpClients,
    sections: canReplaceSections ? incoming.sections : current.sections,
    // Server proposals win (minus the locally-resolved set above): preferring
    // local copies while edits were unpersisted masked genuine server-side
    // transitions (an agent revising a draft, a teammate's accept marking a
    // sibling proposal stale).
    proposals,
    activity: incoming.activity,
    settings: canReplaceSections ? incoming.settings : current.settings,
    connections: incoming.connections,
    sectionRevisions: canReplaceSections
      ? incoming.sectionRevisions
      : current.sectionRevisions,
  };
}

function cloneSection(section: CreedSection): CreedSection {
  const copyId = `${section.id}-copy-${Math.random().toString(36).slice(2, 7)}`;

  return { ...section, id: copyId, name: `${section.name} Copy` };
}

function getProposalBeforeText(
  section: CreedSection | undefined,
  _proposal: Proposal,
) {
  return section?.content;
}

// Monotonic suffix so two IDs generated in the same millisecond don't
// collide. The previous `Date.now()`-only IDs were colliding when
// `acceptProposals` batch-applied several proposals in one tick (multiple
// new sections + multiple activity rows landing in the same ms).
let idCounter = 0;
function uniqueLocalId(prefix: string) {
  idCounter += 1;
  return `${prefix}-${Date.now()}-${idCounter.toString(36)}`;
}

// Company section ids must match the server's `section-<16 hex>` shape (the
// create route validates it) so the optimistic row and the persisted row share
// an id - no post-create reconciliation. Personal sections keep uniqueLocalId.
function newCompanySectionId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return `section-${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

function buildActivityEntry(
  proposal: Proposal,
  state: CreedState,
  status: "accepted" | "rejected" | "stale",
): ActivityEntry {
  const createdAt = new Date().toISOString();
  const section = state.sections.find((item) => item.id === proposal.sectionId);
  const normalizedProposal = normalizeProposalForSection(proposal, section);
  const metaDiff = getMetaProposalDiffText(normalizedProposal.draft, section);
  const beforeText =
    metaDiff?.before ?? getProposalBeforeText(section, normalizedProposal);
  const afterText =
    metaDiff?.after ?? getProposalPreviewText(normalizedProposal.draft);

  return {
    id: uniqueLocalId("activity"),
    proposalId: normalizedProposal.id,
    createdAt,
    dayLabel: "Today",
    sectionId: normalizedProposal.sectionId,
    sectionName: normalizedProposal.sectionName,
    accent: normalizedProposal.accent,
    actor: normalizedProposal.agentName,
    actorType: "agent",
    summary:
      status === "accepted"
        ? `Accepted ${normalizedProposal.sectionName.toLowerCase()} proposal`
        : status === "stale"
          ? `${normalizedProposal.sectionName} proposal became stale`
          : `Rejected ${normalizedProposal.sectionName.toLowerCase()} proposal`,
    timeLabel: "just now",
    status,
    changeType: normalizedProposal.changeType,
    reason: normalizedProposal.reason,
    impact: normalizedProposal.impact,
    confidence: normalizedProposal.confidence,
    beforeText,
    afterText,
  };
}

function applyProposalToSection(section: CreedSection, proposal: Proposal) {
  // Under the unified model every section is rich-text. normalizeLegacyProposalDraft
  // collapses any legacy draft shape (operating-principles, decisions, focus,
  // rules, chips) to a rich-text payload before we apply it.
  const draft = normalizeLegacyProposalDraft(proposal.draft);

  if (draft.kind === "rename-section") {
    const nextName = draft.name.trim();
    if (!nextName) return section;
    return updateSectionMeta(
      { ...section, name: nextName },
      proposal.agentName,
      "agent",
    );
  }

  if (draft.kind === "recolor-section") {
    return updateSectionMeta(
      { ...section, accent: draft.accent },
      proposal.agentName,
      "agent",
    );
  }

  if (draft.kind !== "rich-text") {
    return section;
  }

  const content = normalizeRichTextInput(draft);
  return updateSectionMeta(
    { ...section, content },
    proposal.agentName,
    "agent",
  );
}

function createSectionFromProposalDraft(
  proposal: Proposal,
): CreedSection | null {
  const draft = normalizeLegacyProposalDraft(proposal.draft);

  if (draft.kind !== "new-section") {
    return null;
  }

  const content = normalizeRichTextInput(draft);

  return {
    id: uniqueLocalId("section"),
    kind: "rich-text",
    template: draft.template ?? "freeform",
    name: draft.name.trim() || "New section",
    accent:
      draft.accent ??
      inferAgentSectionAccent({
        name: draft.name,
        content: draft.contentMarkdown ?? draft.contentHtml,
        insertAfterSectionId: draft.insertAfterSectionId,
      }),
    content,
    agentWritable: true,
    agentPermission: "propose",
    lastEditedBy: proposal.agentName,
    lastEditedType: "agent",
    lastEditedLabel: "just now",
  };
}

function bumpSectionRevisionMap(
  revisions: CreedState["sectionRevisions"],
  sectionId: string,
) {
  return {
    ...revisions,
    [sectionId]: (revisions[sectionId] ?? 0) + 1,
  };
}

export function CreedProvider({
  children,
  initialState = initialCreedState,
  persistenceEnabled: initialPersistenceEnabled = false,
}: {
  children: ReactNode;
  initialState?: CreedState;
  persistenceEnabled?: boolean;
}) {
  const [state, setState] = useState(initialState);
  // Reactive, not just the prop: onboarding loads before any Creed exists (so
  // the initial value is false), then claims the seed mid-flow. Flipping it on
  // claim turns on persistence so edits made after the claim are saved (the
  // page loaded as a non-persisted session).
  const [persistenceEnabled, setPersistenceEnabled] = useState(
    initialPersistenceEnabled,
  );
  const latestStateRef = useRef(initialState);
  const saveTimerRef = useRef<number | null>(null);
  const lastPersistedTickRef = useRef(initialState.mutationTick);
  // Proposal ids resolved locally whose resolution hasn't been confirmed by
  // the server yet - see mergeExternalState. Cleared wholesale on Creed switch.
  const resolvedProposalIdsRef = useRef<Set<string>>(new Set());
  // Company mode saves per section (not the full-state PUT). One debounce timer
  // per section id.
  const companySaveTimers = useRef<Map<string, number>>(new Map());
  // Serialize per-section company saves: only one PUT per section in flight, and
  // if more typing lands mid-save, re-run once when it finishes. This is what
  // stops a section's own overlapping autosaves from tripping the revision guard
  // ("This section changed while you were editing").
  const companySaveInFlight = useRef<Set<string>>(new Set());
  const companySaveDirty = useRef<Set<string>>(new Set());

  const persistState = useCallback(
    async (nextState: CreedState, keepalive = false) => {
      if (!persistenceEnabled) {
        return;
      }

      const response = await fetch("/api/app/state", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        keepalive,
        body: JSON.stringify({ state: nextState }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error ?? "Could not save Creed.");
      }
    },
    [persistenceEnabled],
  );

  const flushPendingState = useCallback(
    async (snapshot: CreedState, keepalive = false) => {
      // Flip to "Saving" only now, when the debounced write actually starts, so a
      // continuous typing burst stays on the last "Saved" label until the user
      // pauses. The save-status clock sweep triggers off this saving flip.
      setState((current) =>
        current.saving ? current : { ...current, saving: true },
      );
      try {
        await persistState(snapshot, keepalive);
        lastPersistedTickRef.current = snapshot.mutationTick;
        setState((current) =>
          // Only the latest write clears the indicator and stamps the save time;
          // if a newer edit is already in flight, leave saving on for its flush.
          current.mutationTick === snapshot.mutationTick
            ? { ...current, saving: false, lastSavedAt: Date.now() }
            : current,
        );
      } catch (error) {
        setState((current) => ({ ...current, saving: false }));
        // Surface the failure the house way (sonner) instead of silently
        // showing "Saved". A fixed id collapses repeats so a flaky connection
        // can't stack toasts.
        toast.error(
          error instanceof Error ? error.message : "Couldn't save your changes.",
          { id: "creed-save-failed" },
        );
      }
    },
    [persistState],
  );

  function schedulePersist(snapshot: CreedState) {
    latestStateRef.current = snapshot;

    if (!persistenceEnabled) {
      return;
    }

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      void flushPendingState(latestStateRef.current);
    }, AUTOSAVE_DELAY_MS);
  }

  function commitState(updater: (current: CreedState) => CreedState) {
    setState((current) => {
      const nextState = updater(current);
      const shouldPersist =
        persistenceEnabled && nextState.mutationTick !== current.mutationTick;

      latestStateRef.current = nextState;

      if (shouldPersist) {
        schedulePersist(nextState);
      }

      return nextState;
    });
  }

  // Company mode: persist a single section through the per-section API instead
  // of the personal full-state PUT. Debounced per section. Handles the 409
  // conflict (reload the section) and the Proposal-only case (edit filed as a
  // proposal). Local state is already updated by the caller's commitState.
  // Persist an optimistically-added company section. The section already lives
  // in local state with a server-shaped id, so success just records its revision
  // (for the first edit's baseRevision); a failure toasts and re-syncs so the
  // phantom row can't linger. Mirrors the reorder company branch.
  async function runCompanySectionCreate(section: CreedSection, afterSectionId?: string) {
    const creedId = latestStateRef.current.creedId;
    if (!creedId) return;
    try {
      const res = await fetch("/api/app/sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creedId,
          sectionId: section.id,
          name: section.name,
          contentHtml: section.kind === "rich-text" ? section.content : "",
          accent: section.accent,
          ...(afterSectionId ? { insertAfterSectionId: afterSectionId } : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        revision?: number;
        error?: string;
      };
      if (!res.ok) {
        toast.error(data.error ?? "The section could not be created.");
        await syncFromServer();
        return;
      }
      setState((s) => ({
        ...s,
        sectionRevisions: {
          ...s.sectionRevisions,
          [section.id]: data.revision ?? 1,
        },
      }));
    } catch {
      toast.error("The section could not be created.");
      await syncFromServer();
    }
  }

  async function runCompanySectionArchive(
    sectionId: string,
    archived: boolean,
    options: { sync?: boolean } = {},
  ) {
    const creedId = latestStateRef.current.creedId;
    if (!creedId) return;
    const shouldSync = options.sync ?? true;

    try {
      const response = await fetch(
        `/api/app/sections/${encodeURIComponent(sectionId)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ creedId, archived }),
        },
      );
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        toast.error(
          data.error ??
            (archived
              ? "Could not archive the section."
              : "Could not restore the section."),
        );
        if (shouldSync) await syncFromServer();
        return;
      }

      if (shouldSync) await syncFromServer();
    } catch {
      toast.error(
        archived
          ? "Could not archive the section."
          : "Could not restore the section.",
      );
      if (shouldSync) await syncFromServer();
    }
  }

  function saveCompanySection(sectionId: string, _content: string) {
    const creedId = latestStateRef.current.creedId;
    if (!creedId) return;
    const timers = companySaveTimers.current;
    const existing = timers.get(sectionId);
    if (existing) window.clearTimeout(existing);
    timers.set(
      sectionId,
      window.setTimeout(() => {
        timers.delete(sectionId);
        void runCompanySave(sectionId);
      }, AUTOSAVE_DELAY_MS),
    );
  }

  // The actual per-section PUT. Serialized: if a save is already in flight for
  // this section, mark it dirty and let the running save re-fire when it lands,
  // so a section never races its own autosave. Always sends the LATEST local
  // content + revision, and a revision conflict (almost always our own prior
  // save) is auto-resolved by retrying against the server's current revision -
  // never a disruptive "reload the section" toast that would drop live typing.
  async function runCompanySave(sectionId: string) {
    const creedId = latestStateRef.current.creedId;
    if (!creedId) return;
    if (companySaveInFlight.current.has(sectionId)) {
      companySaveDirty.current.add(sectionId);
      return;
    }
    companySaveInFlight.current.add(sectionId);
    setState((s) => (s.saving ? s : { ...s, saving: true }));

    const put = async (baseRevision: number) => {
      const content =
        latestStateRef.current.sections.find((x) => x.id === sectionId)
          ?.content ?? "";
      const response = await fetch(
        `/api/app/sections/${encodeURIComponent(sectionId)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ creedId, baseRevision, content }),
        },
      );
      const data = (await response.json().catch(() => ({}))) as {
        revision?: number;
        filedProposal?: boolean;
        error?: string;
        currentRevision?: number;
      };
      return { response, data };
    };

    try {
      const baseRevision =
        latestStateRef.current.sectionRevisions[sectionId] ?? 1;
      let { response, data } = await put(baseRevision);

      // Conflict: sync our base to the server's current revision and retry once
      // with the latest content. Overlapping autosaves resolve silently.
      if (response.status === 409 && typeof data.currentRevision === "number") {
        ({ response, data } = await put(data.currentRevision));
      }

      if (!response.ok) {
        if (response.status === 403) {
          toast.error(data.error ?? "You cannot edit this section.");
        } else if (response.status === 409) {
          // A genuine conflict that survived the retry - reload rather than
          // clobber. Rare (needs a real concurrent writer, not our own save).
          toast.error("This section changed elsewhere. Reloading it.");
          await syncFromServer();
        } else {
          toast.error(data.error ?? "Could not save the section.");
        }
        return;
      }

      if (data.filedProposal) {
        await syncFromServer();
      }
      setState((s) => ({
        ...s,
        lastSavedAt: Date.now(),
        sectionRevisions: {
          ...s.sectionRevisions,
          [sectionId]: data.revision ?? s.sectionRevisions[sectionId] ?? 1,
        },
      }));
    } catch {
      toast.error("Could not save the section.");
    } finally {
      companySaveInFlight.current.delete(sectionId);
      // Typing landed while we were saving - persist the newest content now,
      // with the revision we just learned, and keep the "Saving" indicator on
      // through the re-run (no flicker). Otherwise settle to "Saved".
      if (companySaveDirty.current.has(sectionId)) {
        companySaveDirty.current.delete(sectionId);
        void runCompanySave(sectionId);
      } else {
        setState((s) => (s.saving ? { ...s, saving: false } : s));
      }
    }
  }

  useEffect(() => {
    if (!persistenceEnabled) {
      return;
    }

    function flushCurrentState() {
      const snapshot = latestStateRef.current;
      if (snapshot.mutationTick === lastPersistedTickRef.current) {
        return;
      }

      void flushPendingState(snapshot, true);
    }

    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        flushCurrentState();
      }
    }

    window.addEventListener("beforeunload", flushCurrentState);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("beforeunload", flushCurrentState);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [flushPendingState, persistenceEnabled]);

  const syncFromServer = useCallback(async () => {
    if (!persistenceEnabled) {
      return;
    }

    const response = await fetch("/api/app/state", {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as { state?: CreedState };
    if (!payload.state) {
      return;
    }

    setState((current) => {
      // Ignore a response for a different Creed (a background sync that raced a
      // switch). Cross-Creed transitions go through switchCreed's wholesale
      // replace; merging across Creeds would pair a mismatched creedType with
      // the wrong sections and crash render.
      if (
        payload.state!.creedId &&
        current.creedId &&
        payload.state!.creedId !== current.creedId
      ) {
        return current;
      }
      const canReplaceSections =
        current.mutationTick === lastPersistedTickRef.current;
      const nextState = mergeExternalState(
        current,
        payload.state!,
        canReplaceSections,
        resolvedProposalIdsRef.current,
      );
      latestStateRef.current = nextState;
      return nextState;
    });
  }, [persistenceEnabled]);

  // Switch the active Creed instantly, client-side. We deliberately do NOT use
  // router.refresh() here: that re-runs the whole app-layout gate and every
  // server read, and the provider (useState(initialState)) ignores the new prop
  // anyway. Instead we set the active-Creed cookie, fetch the target Creed's
  // full state, and REPLACE local state wholesale. A wholesale replace (not the
  // merge path syncFromServer uses) is essential: merging a company state onto a
  // personal one - or with local unsaved sections - yields an inconsistent
  // creedType/sections pairing that crashes render. We also flip
  // persistenceEnabled to match the target (personal saves full-state; company
  // saves per section) so the right save path is used after the switch.
  const switchCreed = useCallback(
    async (creedId: string): Promise<{ ok: boolean; error?: string }> => {
      // Flush a pending personal autosave so leaving never drops an edit, then
      // cancel any debounced per-section company saves (we're leaving on purpose).
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
        if (persistenceEnabled) {
          await flushPendingState(latestStateRef.current).catch(() => {});
        }
      }
      for (const timer of companySaveTimers.current.values()) {
        window.clearTimeout(timer);
      }
      companySaveTimers.current.clear();
      // Locally-resolved proposal ids belong to the Creed we're leaving.
      resolvedProposalIdsRef.current.clear();

      const activate = await fetch("/api/app/creeds/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creedId }),
      });
      if (!activate.ok) {
        const data = (await activate.json().catch(() => ({}))) as {
          error?: string;
        };
        return { ok: false, error: data.error ?? "Could not switch Creed." };
      }

      const stateResponse = await fetch("/api/app/state", {
        method: "GET",
        cache: "no-store",
      });
      if (!stateResponse.ok) {
        return { ok: false, error: "Could not load that Creed." };
      }
      const payload = (await stateResponse.json().catch(() => ({}))) as {
        state?: CreedState;
        hasPersistedCreed?: boolean;
      };
      if (!payload.state) {
        return { ok: false, error: "Could not load that Creed." };
      }

      const next = payload.state;
      lastPersistedTickRef.current = next.mutationTick;
      latestStateRef.current = next;
      setState(next);
      setPersistenceEnabled(Boolean(payload.hasPersistedCreed));
      return { ok: true };
    },
    [persistenceEnabled, flushPendingState],
  );

  useEffect(() => {
    if (!persistenceEnabled) {
      return;
    }

    let interval: number | null = null;
    // Bumped on every stop/start so an in-flight sync's `.finally` can tell
    // whether it still owns the loop - without this, pausing mid-request would
    // orphan a chain and double up the polling on resume.
    let epoch = 0;

    // Self-rescheduling timeout (not a fixed setInterval) so the cadence can
    // follow the active Creed: company Creeds poll fast for near-live updates,
    // personal Creeds stay lazy. Reads creedType fresh each tick so switching
    // Creeds adapts without restarting the effect.
    function scheduleNext(myEpoch: number) {
      const delay =
        latestStateRef.current.creedType === "company"
          ? COMPANY_SYNC_INTERVAL_MS
          : EXTERNAL_SYNC_INTERVAL_MS;
      interval = window.setTimeout(() => {
        void syncFromServer().finally(() => {
          if (myEpoch === epoch) scheduleNext(myEpoch);
        });
      }, delay);
    }

    function startInterval() {
      stopInterval();
      scheduleNext(epoch);
    }

    function stopInterval() {
      epoch += 1;
      if (interval !== null) {
        window.clearTimeout(interval);
        interval = null;
      }
    }

    function onWindowFocus() {
      void syncFromServer();
      startInterval();
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        void syncFromServer();
        startInterval();
      } else {
        stopInterval();
      }
    }

    void syncFromServer();
    if (
      typeof document === "undefined" ||
      document.visibilityState === "visible"
    ) {
      startInterval();
    }

    window.addEventListener("focus", onWindowFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      stopInterval();
      window.removeEventListener("focus", onWindowFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [persistenceEnabled, syncFromServer]);

  function toggleLock() {
    commitState((current) =>
      nextMutationTick({
        ...current,
        locked: !current.locked,
        // Toggling the master lock always clears per-section overrides - the
        // header is the authority again.
        sectionLockOverrides: [],
      }),
    );
  }

  function toggleSectionLock(sectionId: string) {
    commitState((current) => {
      // Per-section overrides only matter while the master lock is on. With
      // the file unlocked there's nothing to override; ignore.
      if (!current.locked) return current;

      const overrides = new Set(current.sectionLockOverrides);
      if (overrides.has(sectionId)) {
        overrides.delete(sectionId);
      } else {
        overrides.add(sectionId);
      }

      return nextMutationTick({
        ...current,
        sectionLockOverrides: Array.from(overrides),
      });
    });
  }

  // File a manual member edit as a proposal immediately (no debounce, no local
  // content mutation): used by the Proposal-only "submit proposal" button. The
  // section's canonical content is untouched; syncFromServer then surfaces the
  // pending proposal card, exactly as an agent-filed proposal would appear.
  function fileProposalEdit(sectionId: string, content: string): boolean {
    const snapshot = latestStateRef.current;
    const creedId = snapshot.creedId;
    if (!creedId) return false;
    const baseRevision = snapshot.sectionRevisions[sectionId] ?? 1;
    const section = snapshot.sections.find((s) => s.id === sectionId);
    const u = snapshot.user;

    // Optimistic: show the pending proposal card instantly (with the author's
    // own avatar), then persist in the background. The server's real proposal
    // replaces this temp one on the next sync; a failure rolls it back.
    const tempId = `optimistic-${sectionId}-${idCounter}`;
    idCounter += 1;
    const optimistic: Proposal = {
      id: tempId,
      sectionId,
      sectionName: section?.name ?? "",
      accent: (section?.accent ?? "mono") as AccentKey,
      agentName: u.name,
      timeLabel: "just now",
      changeType: "refines-existing",
      reason: "Suggested edit.",
      impact: "future-responses",
      confidence: "durable",
      draft: { kind: "rich-text", contentHtml: content },
      status: "pending",
      authorType: "user",
      authorAvatarUrl: u.avatarUrl,
      authorInitials: u.avatarInitials,
      mine: true,
    };
    setState((c) => {
      const next = { ...c, proposals: [optimistic, ...c.proposals] };
      latestStateRef.current = next;
      return next;
    });

    void (async () => {
      try {
        const response = await fetch(
          `/api/app/sections/${encodeURIComponent(sectionId)}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ creedId, baseRevision, content }),
          },
        );
        if (!response.ok) {
          const data = (await response.json().catch(() => ({}))) as {
            error?: string;
          };
          // Roll the optimistic card back out.
          setState((c) => {
            const next = {
              ...c,
              proposals: c.proposals.filter((p) => p.id !== tempId),
            };
            latestStateRef.current = next;
            return next;
          });
          toast.error(
            response.status === 409
              ? "This section changed while you were editing."
              : (data.error ?? "Could not submit the proposal."),
          );
          return;
        }
        // Replace the temp proposal with the server's real one.
        await syncFromServer();
      } catch {
        setState((c) => {
          const next = {
            ...c,
            proposals: c.proposals.filter((p) => p.id !== tempId),
          };
          latestStateRef.current = next;
          return next;
        });
        toast.error("Could not submit the proposal.");
      }
    })();

    return true;
  }

  function updateRichTextSection(sectionId: string, content: string) {
    // Ignore no-op echoes: the rich-text editor emits onChange on init and after
    // normalization with content identical to what we just loaded. Acting on
    // those would churn state and, in company mode, fire a redundant per-section
    // save that logs a phantom "edited" activity row on a freshly loaded Creed.
    const existing = latestStateRef.current.sections.find(
      (section) => section.id === sectionId && section.kind === "rich-text",
    );
    if (existing && richTextContentEquivalent(existing.content, content)) {
      return;
    }

    commitState((current) =>
      nextMutationTick({
        ...current,
        sections: current.sections.map((section) =>
          section.id === sectionId && section.kind === "rich-text"
            ? updateSectionMeta({ ...section, content }, "You", "user")
            : section,
        ),
      }),
    );
    // Company mode persists per section (the full-state PUT is disabled).
    if (latestStateRef.current.creedType === "company") {
      saveCompanySection(sectionId, content);
    }
  }

  function reorderSections(sectionIds: string[]) {
    commitState((current) => {
      const map = new Map(
        current.sections.map((section) => [section.id, section]),
      );
      const reordered = sectionIds
        .map((id) => map.get(id))
        .filter((section): section is CreedSection => Boolean(section));
      // Preserve any sections not in the reordered list (archived sections are
      // hidden from the editor, so they aren't part of the drag set). Without
      // this they'd be dropped from state and then deleted on the next persist.
      const reorderedIds = new Set(sectionIds);
      const preserved = current.sections.filter(
        (section) => !reorderedIds.has(section.id),
      );

      return nextMutationTick({
        ...current,
        sections: [...reordered, ...preserved],
      });
    });
    // Company: the full-state PUT doesn't persist order, so save the new section
    // positions through the dedicated endpoint. The local commitState above is
    // the optimistic update; this makes it stick and reach other members.
    if (latestStateRef.current.creedType === "company") {
      const creedId = latestStateRef.current.creedId;
      if (creedId) {
        void (async () => {
          try {
            const res = await fetch("/api/app/sections/reorder", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ creedId, sectionIds }),
            });
            if (!res.ok) {
              const data = (await res.json().catch(() => ({}))) as {
                error?: string;
              };
              toast.error(data.error ?? "Could not save the new order.");
              await syncFromServer();
            }
          } catch {
            toast.error("Could not save the new order.");
            await syncFromServer();
          }
        })();
      }
    }
  }

  function addSection(name: string, starter?: string) {
    const trimmedName = name.trim() || "New section";
    const isCompany = latestStateRef.current.creedType === "company";
    const newSection: CreedSection = {
      id: isCompany ? newCompanySectionId() : uniqueLocalId("section"),
      kind: "rich-text",
      template: "freeform",
      name: trimmedName,
      accent: "custom",
      content: starter ?? createStarterContent(trimmedName),
      agentWritable: true,
      agentPermission: "propose",
      lastEditedBy: "You",
      lastEditedType: "user",
      lastEditedLabel: "just now",
    };

    commitState((current) =>
      nextMutationTick({
        ...current,
        sections: [...current.sections, newSection],
      }),
    );

    // Company mode persists per section: the full-state PUT is disabled, so
    // without this the new section vanishes on the next sync poll.
    if (isCompany) {
      void runCompanySectionCreate(newSection);
    }

    return newSection;
  }

  function addSectionAfter(
    afterSectionId: string,
    name: string,
    starter?: string,
  ) {
    const trimmedName = name.trim() || "New section";
    const isCompany = latestStateRef.current.creedType === "company";
    const newSection: CreedSection = {
      id: isCompany ? newCompanySectionId() : uniqueLocalId("section"),
      kind: "rich-text",
      template: "freeform",
      name: trimmedName,
      accent: "custom",
      content: starter ?? createStarterContent(trimmedName),
      agentWritable: true,
      agentPermission: "propose",
      lastEditedBy: "You",
      lastEditedType: "user",
      lastEditedLabel: "just now",
    };

    commitState((current) => {
      const index = current.sections.findIndex(
        (section) => section.id === afterSectionId,
      );
      const nextSections = [...current.sections];
      nextSections.splice(index + 1, 0, newSection);

      return nextMutationTick({
        ...current,
        sections: nextSections,
      });
    });

    // Company mode persists per section (see addSection); anchor after the
    // requested section so server order matches the optimistic insert.
    if (isCompany) {
      void runCompanySectionCreate(newSection, afterSectionId);
    }
  }

  function renameSection(sectionId: string, name: string) {
    commitState((current) =>
      nextMutationTick({
        ...current,
        sections: current.sections.map((section) =>
          section.id === sectionId
            ? {
                ...section,
                name: name.trim() || section.name,
                lastEditedBy: "You",
                lastEditedType: "user",
                lastEditedLabel: "just now",
              }
            : section,
        ),
      }),
    );
  }

  function setSectionAccent(sectionId: string, accent: AccentKey) {
    commitState((current) =>
      nextMutationTick({
        ...current,
        sections: current.sections.map((section) =>
          section.id === sectionId
            ? updateSectionMeta({ ...section, accent }, "You", "user")
            : section,
        ),
        proposals: current.proposals.map((proposal) =>
          proposal.sectionId === sectionId ? { ...proposal, accent } : proposal,
        ),
        activity: current.activity.map((entry) =>
          entry.sectionId === sectionId ? { ...entry, accent } : entry,
        ),
      }),
    );
  }

  function duplicateSection(sectionId: string) {
    commitState((current) => {
      const section = current.sections.find((item) => item.id === sectionId);

      if (!section) {
        return current;
      }

      const index = current.sections.findIndex((item) => item.id === sectionId);
      const nextSections = [...current.sections];
      nextSections.splice(index + 1, 0, cloneSection(section));

      return nextMutationTick({
        ...current,
        sections: nextSections,
      });
    });
  }

  function deleteSection(sectionId: string) {
    if (latestStateRef.current.creedType === "company") {
      const creedId = latestStateRef.current.creedId;
      // Optimistically drop it locally, then permanently delete it via the
      // company API (owner/admin only; the server re-checks the role).
      commitState((current) =>
        nextMutationTick({
          ...current,
          sections: current.sections.filter(
            (section) => section.id !== sectionId,
          ),
        }),
      );
      if (creedId) {
        void (async () => {
          const response = await fetch(
            `/api/app/sections/${encodeURIComponent(sectionId)}`,
            {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ creedId }),
            },
          );
          if (!response.ok) {
            const data = (await response.json().catch(() => ({}))) as {
              error?: string;
            };
            toast.error(data.error ?? "Could not delete the section.");
            await syncFromServer();
          }
        })();
      }
      return;
    }
    commitState((current) =>
      nextMutationTick({
        ...current,
        sections: current.sections.filter(
          (section) => section.id !== sectionId,
        ),
        proposals: current.proposals.filter(
          (proposal) => proposal.sectionId !== sectionId,
        ),
        activity: current.activity.filter(
          (entry) => entry.sectionId !== sectionId,
        ),
      }),
    );
  }

  // Archive keeps the section in state (so it survives persistence) but flags it
  // hidden from the editor, agent read, quality, and export. Pending proposals
  // for it are dropped so nothing dangles against a hidden section; activity
  // history is preserved. Restore simply clears the flag.
  function archiveSection(sectionId: string) {
    const isCompany = latestStateRef.current.creedType === "company";
    commitState((current) =>
      nextMutationTick({
        ...current,
        sections: current.sections.map((section) =>
          section.id === sectionId ? { ...section, archived: true } : section,
        ),
        proposals: current.proposals.filter(
          (proposal) => proposal.sectionId !== sectionId,
        ),
      }),
    );
    if (isCompany) {
      void runCompanySectionArchive(sectionId, true);
    }
  }

  function restoreSection(sectionId: string) {
    const isCompany = latestStateRef.current.creedType === "company";
    commitState((current) =>
      nextMutationTick({
        ...current,
        sections: current.sections.map((section) =>
          section.id === sectionId ? { ...section, archived: false } : section,
        ),
      }),
    );
    if (isCompany) {
      void runCompanySectionArchive(sectionId, false);
    }
  }

  // Archiving the whole Creed archives every live section at once and drops in a
  // single blank placeholder, so the file resets to a clean slate while every
  // section stays recoverable from Settings -> Archived.
  function archiveCreed() {
    if (latestStateRef.current.creedType === "company") {
      const sectionIds = latestStateRef.current.sections
        .filter((section) => !section.archived)
        .map((section) => section.id);
      commitState((current) =>
        nextMutationTick({
          ...current,
          sections: current.sections.map((section) => ({
            ...section,
            archived: true,
          })),
          proposals: [],
        }),
      );
      void Promise.all(
        sectionIds.map((sectionId) =>
          runCompanySectionArchive(sectionId, true, { sync: false }),
        ),
      ).then(() => syncFromServer());
      return;
    }

    commitState((current) => {
      const archived = current.sections.map((section) =>
        section.archived ? section : { ...section, archived: true },
      );
      const placeholder: CreedSection = {
        id: uniqueLocalId("section"),
        kind: "rich-text",
        template: "freeform",
        name: "New section",
        accent: "custom",
        content:
          "<p>Start fresh here. Your previous sections are saved in Settings, under Archived.</p>",
        agentWritable: true,
        agentPermission: "propose",
        lastEditedBy: "You",
        lastEditedType: "user",
        lastEditedLabel: "just now",
      };
      return nextMutationTick({
        ...current,
        sections: [...archived, placeholder],
        proposals: [],
      });
    });
  }

  function clearSections() {
    // Reset back to the recommended default starter sections instead of
    // leaving the file empty - gives the user something to write into and
    // every connected agent a sane scaffold to read from straight away.
    const defaultSections = initialCreedState.sections.map((section) => ({
      ...section,
      lastEditedBy: "You",
      lastEditedType: "user" as const,
      lastEditedLabel: "just now",
    }));
    commitState((current) =>
      nextMutationTick({
        ...current,
        sections: defaultSections,
        proposals: [],
        activity: [],
      }),
    );
  }

  // Company mode: proposals are reviewed through the per-Creed API (the personal
  // full-state path is disabled). On success the response carries the applied
  // section (revision + content), so the common rich-text accept reconciles
  // from the response alone instead of refetching the whole Creed state; the
  // company poll delivers the server-written activity row moments later.
  // Structural accepts (new/delete/reorder) pass syncAfter, since their
  // effects span the sections list.
  async function reviewCompanyProposalRemote(
    proposalId: string,
    decision: "accept" | "reject" | "withdraw",
    opts?: { syncAfter?: boolean },
  ) {
    const creedId = latestStateRef.current.creedId;
    if (!creedId) return;
    resolvedProposalIdsRef.current.add(proposalId);
    try {
      const response = await fetch(
        `/api/app/proposals/${encodeURIComponent(proposalId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ creedId, decision }),
        },
      );
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
          code?: string;
        };
        toast.error(
          data.code === "stale"
            ? "That proposal went stale - the section changed after it was proposed."
            : (data.error ?? "Could not review the proposal."),
        );
        // Reconcile: the caller already applied the change optimistically, so
        // pull the server truth back in to undo it. Release the suppression
        // first - with the id still in the resolved set, the merge would
        // filter the still-pending proposal out and the card could never
        // come back on this client.
        resolvedProposalIdsRef.current.delete(proposalId);
        await syncFromServer();
        return;
      }
      if (opts?.syncAfter) {
        await syncFromServer();
        return;
      }
      const result = (await response.json().catch(() => null)) as {
        revision?: number;
        sectionId?: string;
        sectionName?: string;
        accent?: string;
        contentHtml?: string;
      } | null;
      if (!result?.sectionId) return; // reject/withdraw: nothing to fold in
      // Fold the authoritative section back in quietly (no mutation tick - this
      // is reconciliation, not an edit to persist).
      setState((c) => {
        const next = {
          ...c,
          sections: c.sections.map((section) =>
            section.id === result.sectionId
              ? {
                  ...section,
                  content: result.contentHtml ?? section.content,
                  name: result.sectionName ?? section.name,
                  accent: isAccentKey(result.accent)
                    ? result.accent
                    : section.accent,
                }
              : section,
          ),
          sectionRevisions:
            typeof result.revision === "number" && result.revision > 0
              ? {
                  ...c.sectionRevisions,
                  [result.sectionId!]: result.revision,
                }
              : c.sectionRevisions,
        };
        latestStateRef.current = next;
        return next;
      });
    } catch {
      toast.error("Could not review the proposal.");
      resolvedProposalIdsRef.current.delete(proposalId);
      await syncFromServer();
    }
  }

  // Personal mode: resolve the proposal server-side at click time (delete the
  // row, apply content drafts) so a browser refresh can never resurrect an
  // already-reviewed proposal. Local state was already updated optimistically;
  // on accept, the response's revision becomes the section's authoritative
  // revision - the local +1 bump can drift from the server's content-diff
  // recompute, which is what used to strand later proposals as false-stale.
  // Failures are deliberately quiet: the debounced full-state persist carries
  // the same resolution, so the old client-authoritative path remains the
  // fallback.
  async function reviewPersonalProposalRemote(
    proposalId: string,
    decision: "accept" | "reject",
    sectionId?: string,
  ) {
    const creedId = latestStateRef.current.creedId;
    if (!creedId) return;
    resolvedProposalIdsRef.current.add(proposalId);
    try {
      const response = await fetch(
        `/api/app/proposals/${encodeURIComponent(proposalId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ creedId, decision }),
        },
      );
      if (!response.ok) return;
      const result = (await response.json().catch(() => null)) as {
        revision?: number;
        sectionId?: string;
      } | null;
      const targetId = result?.sectionId ?? sectionId;
      if (
        decision === "accept" &&
        targetId &&
        typeof result?.revision === "number" &&
        result.revision > 0
      ) {
        setState((c) => {
          const next = {
            ...c,
            sectionRevisions: {
              ...c.sectionRevisions,
              [targetId]: result.revision!,
            },
          };
          latestStateRef.current = next;
          return next;
        });
      }
    } catch {
      // Offline / transient: the scheduled autosave PUT persists the same
      // resolution and the persist path removes the server row.
    }
  }

  // Optimistically drop a proposal from local state (company mode): the card
  // disappears instantly; the background review/withdraw persists + reconciles.
  function removeProposalLocal(proposalId: string) {
    setState((c) => {
      const next = {
        ...c,
        proposals: c.proposals.filter((p) => p.id !== proposalId),
      };
      latestStateRef.current = next;
      return next;
    });
  }

  async function acceptProposal(proposalId: string) {
    if (latestStateRef.current.creedType === "company") {
      const pending = latestStateRef.current.proposals.find(
        (item) => item.id === proposalId,
      );
      // Optimistic: apply a rich-text edit to the section and drop the card
      // immediately, then persist + reconcile in the background.
      setState((c) => {
        const p = c.proposals.find((x) => x.id === proposalId);
        const newContent =
          p && p.draft.kind === "rich-text" ? p.draft.contentHtml : undefined;
        const sections =
          p && typeof newContent === "string"
            ? c.sections.map((s) =>
                s.id === p.sectionId ? { ...s, content: newContent } : s,
              )
            : c.sections;
        const next = {
          ...c,
          sections,
          proposals: c.proposals.filter((x) => x.id !== proposalId),
        };
        latestStateRef.current = next;
        return next;
      });
      void reviewCompanyProposalRemote(proposalId, "accept", {
        // Rich-text accepts reconcile from the response; structural drafts
        // reshape the sections list, so pull the full state once.
        syncAfter: pending ? pending.draft.kind !== "rich-text" : true,
      });
      return;
    }

    // Personal: a single accept is a batch of one. acceptProposals owns the
    // staleness check, the state commit, and the durable server resolution,
    // so the single and Accept-all paths can never diverge.
    acceptProposals([proposalId]);
  }

  // Accept many proposals in a single state commit, then resolve each one
  // server-side in the background (sequentially - parallel applies to the
  // same section would race the revision recompute).
  function acceptProposals(proposalIds: string[]) {
    if (proposalIds.length === 0) return;
    if (latestStateRef.current.creedType === "company") {
      // Company reviews are per-proposal server calls with their own
      // optimistic handling and error reconciliation; the personal
      // full-state commit below would neither persist nor reconcile there.
      for (const id of proposalIds) {
        void acceptProposal(id);
      }
      return;
    }
    const idsToAccept = new Set(proposalIds);
    const acceptedIds: Array<{ id: string; sectionId: string }> = [];
    const staleIds: string[] = [];

    // Compute the batch outcome from the live snapshot rather than inside the
    // setState updater: React defers updaters when the hook already has a
    // queued update, so side-channels filled inside one can be empty by the
    // time the code after commitState runs - the server-resolution queue
    // would silently come out empty (and updaters must stay pure regardless).
    // latestStateRef tracks every commit synchronously, so this snapshot is
    // exactly the state the commit below replaces.
    const current = latestStateRef.current;
    {
      let nextSections = [...current.sections];
      let nextRevisions = current.sectionRevisions;
      const newActivityEntries: ActivityEntry[] = [];
      const remainingProposals = current.proposals.filter(
        (item) => !idsToAccept.has(item.id),
      );

      for (const id of proposalIds) {
        const rawProposal = current.proposals.find((item) => item.id === id);
        if (!rawProposal) continue;

        const targetSection = nextSections.find(
          (section) => section.id === rawProposal.sectionId,
        );
        const proposal = normalizeProposalForSection(
          rawProposal,
          targetSection,
        );

        const currentRevision = nextRevisions[proposal.sectionId] ?? null;
        const isStale =
          proposal.baseRevision != null &&
          currentRevision != null &&
          proposal.baseRevision !== currentRevision;

        if (isStale) {
          staleIds.push(id);
          newActivityEntries.push(
            buildActivityEntry(
              { ...proposal, status: "stale" },
              { ...current, sections: nextSections },
              "stale",
            ),
          );
          continue;
        }
        acceptedIds.push({ id, sectionId: proposal.sectionId });

        if (proposal.draft.kind === "new-section") {
          const newSectionDraft = proposal.draft;
          const newSection = createSectionFromProposalDraft(proposal);
          if (!newSection) continue;
          const insertAfterId = newSectionDraft.insertAfterSectionId;
          const insertAfterIndex = insertAfterId
            ? nextSections.findIndex((section) => section.id === insertAfterId)
            : -1;
          if (insertAfterIndex === -1) {
            nextSections.push(newSection);
          } else {
            nextSections.splice(insertAfterIndex + 1, 0, newSection);
          }
          nextRevisions = bumpSectionRevisionMap(nextRevisions, newSection.id);
        } else if (proposal.draft.kind === "delete-section") {
          // Drop the section and any other pending proposals targeting it
          // from the in-flight remainingProposals set so they don't hang
          // around after the batch lands.
          const targetId = proposal.sectionId;
          nextSections = nextSections.filter(
            (section) => section.id !== targetId,
          );
          for (let i = remainingProposals.length - 1; i >= 0; i -= 1) {
            if (remainingProposals[i].sectionId === targetId) {
              remainingProposals.splice(i, 1);
            }
          }
        } else if (proposal.draft.kind === "reorder-section") {
          nextSections = applyReorderDraft(
            nextSections,
            proposal.sectionId,
            proposal.draft,
          );
        } else {
          nextSections = nextSections.map((section) =>
            section.id === proposal.sectionId
              ? applyProposalToSection(section, proposal)
              : section,
          );
          nextRevisions = bumpSectionRevisionMap(
            nextRevisions,
            proposal.sectionId,
          );
        }

        newActivityEntries.push(
          buildActivityEntry(
            proposal,
            { ...current, sections: nextSections },
            "accepted",
          ),
        );
      }

      // Drop the old pending activity rows for everything we just acted
      // on, then prepend the new accepted/stale rows.
      const remainingActivity = current.activity.filter(
        (entry) => !entry.proposalId || !idsToAccept.has(entry.proposalId),
      );

      const nextState = nextMutationTick({
        ...current,
        sections: nextSections,
        sectionRevisions: nextRevisions,
        proposals: remainingProposals,
        activity: [...newActivityEntries, ...remainingActivity],
      });

      // Suppress resurrection for the whole batch BEFORE any network runs,
      // so a focus/poll sync during the sequential resolution below can't
      // re-merge the still-pending tail of the queue.
      for (const entry of acceptedIds) {
        resolvedProposalIdsRef.current.add(entry.id);
      }
      for (const id of staleIds) {
        resolvedProposalIdsRef.current.add(id);
      }

      commitState(() => nextState);

      // Resolve server-side in the background. Stale ones are resolved as
      // rejects (the stale activity entry is the record; the row must not
      // stay pending).
      const queue = [
        ...acceptedIds.map((entry) => ({
          id: entry.id,
          decision: "accept" as const,
          sectionId: entry.sectionId as string | undefined,
        })),
        ...staleIds.map((id) => ({
          id,
          decision: "reject" as const,
          sectionId: undefined as string | undefined,
        })),
      ];
      void (async () => {
        for (const item of queue) {
          await reviewPersonalProposalRemote(
            item.id,
            item.decision,
            item.sectionId,
          );
        }
      })();
    }
  }

  function rejectProposal(proposalId: string) {
    if (latestStateRef.current.creedType === "company") {
      removeProposalLocal(proposalId);
      void reviewCompanyProposalRemote(proposalId, "reject");
      return;
    }
    commitState((current) => {
      const proposal = current.proposals.find((item) => item.id === proposalId);

      if (!proposal) {
        return current;
      }

      return nextMutationTick({
        ...current,
        proposals: current.proposals.filter((item) => item.id !== proposalId),
        activity: [
          buildActivityEntry(proposal, current, "rejected"),
          ...current.activity.filter(
            (entry) => entry.proposalId !== proposal.id,
          ),
        ],
      });
    });
    void reviewPersonalProposalRemote(proposalId, "reject");
  }

  // Company Proposal-only members delete their OWN pending proposal (they can't
  // approve/reject it). Author-gated server-side; company mode only.
  function withdrawProposal(proposalId: string) {
    if (latestStateRef.current.creedType === "company") {
      removeProposalLocal(proposalId);
      void reviewCompanyProposalRemote(proposalId, "withdraw");
    }
  }

  function editProposalDraft(proposalId: string, draft: ProposalDraft) {
    commitState((current) =>
      nextMutationTick({
        ...current,
        proposals: current.proposals.map((proposal) =>
          proposal.id === proposalId ? { ...proposal, draft } : proposal,
        ),
      }),
    );
  }

  function setSectionPermission(
    sectionId: string,
    permission: AgentPermission,
  ) {
    commitState((current) =>
      nextMutationTick({
        ...current,
        sections: current.sections.map((section) =>
          section.id === sectionId
            ? {
                ...section,
                agentPermission: permission,
                agentWritable: permissionToWritable(permission),
              }
            : section,
        ),
      }),
    );
  }

  // Bulk lever behind the global control: set every non-hidden section to one
  // level, preserving explicit "hidden" locks (a private section shouldn't be
  // re-exposed by a set-all). Also updates the global default used for newly
  // created sections.
  function setAllSectionPermissions(
    permission: "read-only" | "propose" | "direct",
  ) {
    commitState((current) =>
      nextMutationTick({
        ...current,
        settings: {
          ...current.settings,
          requireApproval: permission !== "direct",
        },
        sections: current.sections.map((section) =>
          section.agentPermission === "hidden"
            ? section
            : {
                ...section,
                agentPermission: permission,
                agentWritable: permissionToWritable(permission),
              },
        ),
      }),
    );
  }

  function setVersionControlConfig(
    patch: Partial<CreedSettings["versionControl"]>,
  ) {
    commitState((current) =>
      nextMutationTick({
        ...current,
        settings: {
          ...current.settings,
          versionControl: {
            ...current.settings.versionControl,
            ...patch,
          },
        },
      }),
    );
  }

  async function setDisplayName(name: string): Promise<boolean> {
    const trimmedName = name.trim();
    if (!trimmedName) {
      return false;
    }

    const previousUser = latestStateRef.current.user;

    commitState((current) =>
      nextMutationTick({
        ...current,
        user: {
          ...current.user,
          name: trimmedName,
          avatarInitials: getInitials(trimmedName),
        },
      }),
    );

    if (persistenceEnabled) {
      try {
        const response = await fetch("/api/app/profile", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name: trimmedName }),
        });

        if (!response.ok) {
          throw new Error("Could not update profile.");
        }
      } catch {
        commitState((current) =>
          nextMutationTick({
            ...current,
            user: previousUser,
          }),
        );
        return false;
      }
    }

    return true;
  }

  function setProfileAvatar(avatarUrl: string, scope: "personal" | "company") {
    const trimmed = avatarUrl.trim();
    if (!trimmed) return;

    commitState((current) => {
      if (scope === "company") {
        const creedId = current.company?.creedId ?? current.creedId;
        return {
          ...current,
          company: current.company
            ? {
                ...current.company,
                avatarUrl: trimmed,
              }
            : current.company,
          creeds: current.creeds?.map((creed) =>
            creed.id === creedId ? { ...creed, avatarUrl: trimmed } : creed,
          ),
        };
      }

      return {
        ...current,
        user: {
          ...current.user,
          avatarUrl: trimmed,
        },
        creeds: current.creeds?.map((creed) =>
          creed.type === "personal" ? { ...creed, avatarUrl: trimmed } : creed,
        ),
      };
    });
  }

  async function deleteAccount() {
    if (!persistenceEnabled) {
      return;
    }

    const response = await fetch("/api/app/account", {
      method: "DELETE",
    });

    if (!response.ok) {
      throw new Error("Could not delete account.");
    }

    window.location.href = "/";
  }

  function updateOnboarding(patch: Partial<CreedState["onboarding"]>) {
    setState((current) => ({
      ...current,
      onboarding: {
        ...current.onboarding,
        ...patch,
      },
    }));
  }

  function resetOnboarding() {
    setState((current) => ({
      ...current,
      onboarding: initialOnboardingState,
    }));
  }

  async function claimOnboardingPreview(sections: CreedSection[]) {
    const nextState = nextMutationTick({
      ...state,
      lastSavedAt: Date.now(),
      sections,
      proposals: [],
      activity: [],
    });

    setState(nextState);

    if (!persistenceEnabled) {
      const response = await fetch("/api/app/claim", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sections }),
      });

      if (!response.ok) {
        throw new Error("Could not create your Creed.");
      }
      // The seed is now persisted server-side, so this is a real backed
      // session. Turn on persistence so subsequent edits save.
      setPersistenceEnabled(true);
      return;
    }

    await persistState(nextState);
  }

  async function importSections(sections: CreedSection[]) {
    const hasVersionControlTarget =
      Boolean(state.settings.versionControl.repoOwner) &&
      Boolean(state.settings.versionControl.repoName) &&
      Boolean(state.settings.versionControl.branch);

    const nextState = nextMutationTick({
      ...state,
      lastSavedAt: Date.now(),
      sections,
      proposals: [],
      settings: {
        ...state.settings,
        versionControl: {
          ...state.settings.versionControl,
          lastSyncedContentHash: undefined,
          syncStatus: hasVersionControlTarget ? "unknown" : "not-configured",
        },
      },
      sectionRevisions: Object.fromEntries(
        sections.map((section) => [section.id, 1]),
      ),
    });

    setState(nextState);

    if (!persistenceEnabled) {
      return;
    }

    await persistState(nextState);
  }

  async function signOut() {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  function exportMarkdown() {
    return buildVisibleCreedMarkdown(state.sections);
  }

  function exportActivityJson() {
    const activity =
      state.creedType === "company"
        ? state.activity
        : state.activity.filter((entry) => entry.actorType === "agent");
    return JSON.stringify(activity, null, 2);
  }

  function exportAllDataJson() {
    return JSON.stringify(state, null, 2);
  }

  const contextValue = useMemo<CreedContextValue>(
    () => ({
      state,
      toggleLock,
      toggleSectionLock,
      updateRichTextSection,
      fileProposalEdit,
      reorderSections,
      addSection,
      addSectionAfter,
      renameSection,
      setSectionAccent,
      duplicateSection,
      deleteSection,
      archiveSection,
      restoreSection,
      archiveCreed,
      clearSections,
      acceptProposal,
      acceptProposals,
      rejectProposal,
      withdrawProposal,
      editProposalDraft,
      setSectionPermission,
      setAllSectionPermissions,
      setVersionControlConfig,
      setDisplayName,
      setProfileAvatar,
      refreshState: syncFromServer,
      switchCreed,
      importSections,
      deleteAccount,
      updateOnboarding,
      resetOnboarding,
      claimOnboardingPreview,
      signOut,
      exportMarkdown,
      exportActivityJson,
      exportAllDataJson,
    }),
    [
      state,
      toggleLock,
      toggleSectionLock,
      updateRichTextSection,
      fileProposalEdit,
      reorderSections,
      addSection,
      addSectionAfter,
      renameSection,
      setSectionAccent,
      duplicateSection,
      deleteSection,
      archiveSection,
      restoreSection,
      archiveCreed,
      clearSections,
      acceptProposal,
      acceptProposals,
      rejectProposal,
      withdrawProposal,
      editProposalDraft,
      setSectionPermission,
      setAllSectionPermissions,
      setVersionControlConfig,
      setDisplayName,
      setProfileAvatar,
      syncFromServer,
      switchCreed,
      importSections,
      deleteAccount,
      updateOnboarding,
      resetOnboarding,
      claimOnboardingPreview,
      signOut,
      exportMarkdown,
      exportActivityJson,
      exportAllDataJson,
    ],
  );

  return (
    <CreedContext.Provider value={contextValue}>
      {children}
    </CreedContext.Provider>
  );
}

export function useCreed() {
  const context = useContext(CreedContext);

  if (!context) {
    throw new Error("useCreed must be used inside a CreedProvider");
  }

  return context;
}
