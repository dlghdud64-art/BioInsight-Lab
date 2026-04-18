/**
 * AI Suggestion Store — 화면당 1개 active suggestion 관리
 *
 * 규칙:
 * - 한 scope에서 active suggestion은 항상 1개
 * - 같은 scope + targetId + contextHash 조합은 중복 생성 금지
 * - accepted / dismissed 된 동일 contextHash는 재노출 금지
 * - 컴포넌트 local state로 accepted/dismissed 관리 금지
 */
import { create } from "zustand";
import type { AiSuggestion, AiSuggestionScope, AiSuggestionStatus } from "@/lib/ai/suggestion-engine";

interface AiSuggestionStoreState {
  // ── State ──
  suggestionsByScope: Record<string, AiSuggestion>; // key = scope
  dismissedContextHashes: Set<string>;
  acceptedContextHashes: Set<string>;
  editedSuggestionIds: Set<string>;
  activeSuggestionIdByScope: Record<string, string>; // scope → suggestion.id

  // ── Actions ──
  upsertSuggestion: (suggestion: AiSuggestion) => void;
  setActiveSuggestion: (scope: AiSuggestionScope, suggestionId: string) => void;
  acceptSuggestion: (scope: AiSuggestionScope) => void;
  dismissSuggestion: (scope: AiSuggestionScope) => void;
  editSuggestion: (scope: AiSuggestionScope) => void;
  clearStaleSuggestions: (scope: AiSuggestionScope, validTargetIds: string[]) => void;
  getActiveSuggestion: (scope: AiSuggestionScope) => AiSuggestion | null;
}

export const useAiSuggestionStore = create<AiSuggestionStoreState>((set, get) => ({
  suggestionsByScope: {},
  dismissedContextHashes: new Set(),
  acceptedContextHashes: new Set(),
  editedSuggestionIds: new Set(),
  activeSuggestionIdByScope: {},

  upsertSuggestion: (suggestion) => {
    const state = get();
    const { scope, contextHash } = suggestion;

    // 이미 dismissed/accepted된 contextHash → 재생성 금지
    if (state.dismissedContextHashes.has(contextHash)) return;
    if (state.acceptedContextHashes.has(contextHash)) return;

    // 같은 scope에 같은 contextHash가 이미 있으면 재생성 금지
    const existing = state.suggestionsByScope[scope];
    if (existing && existing.contextHash === contextHash) return;

    set({
      suggestionsByScope: { ...state.suggestionsByScope, [scope]: suggestion },
      activeSuggestionIdByScope: { ...state.activeSuggestionIdByScope, [scope]: suggestion.id },
    });
  },

  setActiveSuggestion: (scope, suggestionId) => {
    set((state) => ({
      activeSuggestionIdByScope: { ...state.activeSuggestionIdByScope, [scope]: suggestionId },
    }));
  },

  acceptSuggestion: (scope) => {
    const state = get();
    const suggestion = state.suggestionsByScope[scope];
    if (!suggestion) return;

    const now = new Date().toISOString();
    const updated: AiSuggestion = { ...suggestion, status: "accepted" as AiSuggestionStatus, updatedAt: now };
    const newAccepted = new Set(state.acceptedContextHashes);
    newAccepted.add(suggestion.contextHash);

    set({
      suggestionsByScope: { ...state.suggestionsByScope, [scope]: updated },
      acceptedContextHashes: newAccepted,
    });
  },

  dismissSuggestion: (scope) => {
    const state = get();
    const suggestion = state.suggestionsByScope[scope];
    if (!suggestion) return;

    const newDismissed = new Set(state.dismissedContextHashes);
    newDismissed.add(suggestion.contextHash);

    // active suggestion 제거
    const newByScope = { ...state.suggestionsByScope };
    delete newByScope[scope];
    const newActiveIds = { ...state.activeSuggestionIdByScope };
    delete newActiveIds[scope];

    set({
      suggestionsByScope: newByScope,
      activeSuggestionIdByScope: newActiveIds,
      dismissedContextHashes: newDismissed,
    });
  },

  editSuggestion: (scope) => {
    const state = get();
    const suggestion = state.suggestionsByScope[scope];
    if (!suggestion) return;

    const now = new Date().toISOString();
    const updated: AiSuggestion = { ...suggestion, status: "edited" as AiSuggestionStatus, updatedAt: now };
    const newEdited = new Set(state.editedSuggestionIds);
    newEdited.add(suggestion.id);

    set({
      suggestionsByScope: { ...state.suggestionsByScope, [scope]: updated },
      editedSuggestionIds: newEdited,
    });
  },

  clearStaleSuggestions: (scope, validTargetIds) => {
    const state = get();
    const suggestion = state.suggestionsByScope[scope];
    if (!suggestion) return;

    // targetId가 더 이상 유효하지 않으면 drop
    if (!validTargetIds.includes(suggestion.targetId)) {
      const newByScope = { ...state.suggestionsByScope };
      delete newByScope[scope];
      const newActiveIds = { ...state.activeSuggestionIdByScope };
      delete newActiveIds[scope];
      set({ suggestionsByScope: newByScope, activeSuggestionIdByScope: newActiveIds });
    }
  },

  getActiveSuggestion: (scope) => {
    const state = get();
    const suggestion = state.suggestionsByScope[scope];
    if (!suggestion) return null;
    if (suggestion.status === "dismissed") return null;
    return suggestion;
  },
}));
