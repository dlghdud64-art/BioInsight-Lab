/**
 * Request Draft Suggestion Store
 *
 * ── 고정 규칙 ──
 * 1. AI suggestion은 canonical draft와 분리. accepted 전까지 draft 변경 금지.
 * 2. accepted → applySupplierDraftPatch() 경유만 허용. direct write 금지.
 * 3. 한 화면에 active suggestion 1개만.
 * 4. 같은 contextHash에서 accepted/dismissed/edited suggestion 재노출 금지.
 * 5. stale suggestion은 apply/accept 대상 불가. 재생성 경로만 허용.
 * 6. auto send / auto ready / auto supplier switch 금지.
 */

import type { SupplierDraftPatch } from "./request-draft-patch";

// ── Types ────────────────────────────────────────────────────────────────────

export type RequestSuggestionStatus = "generated" | "accepted" | "dismissed" | "edited";

export interface RequestDraftSuggestionPreview {
  messageBody?: string;
  attachmentsCount?: number;
  leadTimeQuestionIncluded?: boolean;
  substituteQuestionIncluded?: boolean;
  itemCount?: number;
}

export interface RequestDraftSuggestion {
  id: string;
  scope: "request_draft";
  targetId: string; // activeSupplierRequestId
  title: string;
  message: string;
  actions: Array<"accept" | "dismiss" | "review">;
  status: RequestSuggestionStatus;
  confidence: number;
  sourceContext: {
    requestAssemblyId: string;
    supplierId: string;
    contextHash: string;
    itemIds: string[];
    draftFingerprint: string;
  };
  payload: {
    supplierId: string;
    requestAssemblyId: string;
    patch: SupplierDraftPatch;
    preview: RequestDraftSuggestionPreview;
    rationale: string[];
  };
  generatedAt: string;
  resolvedAt?: string;
}

// ── Store State ──────────────────────────────────────────────────────────────

export interface RequestSuggestionState {
  /** 현재 active suggestion (scope=request_draft 기준 1개만) */
  activeSuggestion: RequestDraftSuggestion | null;
  /** resolved된 suggestion 이력 (dedupe 판단용) */
  resolvedHistory: Array<{
    contextHash: string;
    status: "accepted" | "dismissed" | "edited";
    resolvedAt: string;
    suggestionId: string;
  }>;
}

// ── Store Actions ────────────────────────────────────────────────────────────

export function createInitialState(): RequestSuggestionState {
  return {
    activeSuggestion: null,
    resolvedHistory: [],
  };
}

/**
 * 새 suggestion 생성 시도.
 * dedupe/stale 판정 후 유효하면 active로 설정.
 */
export function generateRequestSuggestion(
  state: RequestSuggestionState,
  suggestion: RequestDraftSuggestion
): RequestSuggestionState {
  const { contextHash } = suggestion.sourceContext;

  // Rule: 같은 contextHash에서 이미 accepted/dismissed/edited면 재노출 금지
  const alreadyResolved = state.resolvedHistory.some(
    h => h.contextHash === contextHash
  );
  if (alreadyResolved) return state;

  // Rule: 현재 active가 같은 contextHash면 재생성 불필요
  if (
    state.activeSuggestion &&
    state.activeSuggestion.sourceContext.contextHash === contextHash &&
    state.activeSuggestion.status === "generated"
  ) {
    return state;
  }

  // 새 suggestion을 active로 설정 (기존 active는 대체)
  return {
    ...state,
    activeSuggestion: suggestion,
  };
}

/**
 * suggestion accepted → patch를 반환하고 상태를 accepted로 변경.
 * 실제 draft 적용은 caller가 applySupplierDraftPatch()로 처리해야 함.
 */
export function acceptRequestSuggestion(
  state: RequestSuggestionState
): { state: RequestSuggestionState; patch: SupplierDraftPatch | null } {
  if (!state.activeSuggestion || state.activeSuggestion.status !== "generated") {
    return { state, patch: null };
  }

  const now = new Date().toISOString();
  const suggestion = state.activeSuggestion;

  return {
    state: {
      activeSuggestion: { ...suggestion, status: "accepted", resolvedAt: now },
      resolvedHistory: [
        ...state.resolvedHistory,
        {
          contextHash: suggestion.sourceContext.contextHash,
          status: "accepted",
          resolvedAt: now,
          suggestionId: suggestion.id,
        },
      ],
    },
    patch: suggestion.payload.patch,
  };
}

/**
 * suggestion dismissed → 같은 contextHash 재노출 차단.
 */
export function dismissRequestSuggestion(
  state: RequestSuggestionState
): RequestSuggestionState {
  if (!state.activeSuggestion) return state;

  const now = new Date().toISOString();
  const suggestion = state.activeSuggestion;

  return {
    activeSuggestion: { ...suggestion, status: "dismissed", resolvedAt: now },
    resolvedHistory: [
      ...state.resolvedHistory,
      {
        contextHash: suggestion.sourceContext.contextHash,
        status: "dismissed",
        resolvedAt: now,
        suggestionId: suggestion.id,
      },
    ],
  };
}

/**
 * accepted 후 user가 draft를 추가 수정 → edited 상태로 마킹.
 */
export function markSuggestionEdited(
  state: RequestSuggestionState,
  suggestionId: string
): RequestSuggestionState {
  // resolved history에서 해당 suggestion을 edited로 업데이트
  const updatedHistory = state.resolvedHistory.map(h =>
    h.suggestionId === suggestionId ? { ...h, status: "edited" as const } : h
  );

  // active가 해당 suggestion이면 상태 변경
  const updatedActive =
    state.activeSuggestion?.id === suggestionId
      ? { ...state.activeSuggestion, status: "edited" as const, resolvedAt: new Date().toISOString() }
      : state.activeSuggestion;

  return { activeSuggestion: updatedActive, resolvedHistory: updatedHistory };
}

/**
 * context가 바뀌었을 때 stale suggestion 정리.
 * 현재 active가 stale이면 제거.
 */
export function clearStaleSuggestion(
  state: RequestSuggestionState,
  currentContextHash: string
): RequestSuggestionState {
  if (!state.activeSuggestion) return state;

  const isStale =
    state.activeSuggestion.sourceContext.contextHash !== currentContextHash &&
    state.activeSuggestion.status === "generated";

  if (isStale) {
    return { ...state, activeSuggestion: null };
  }

  return state;
}

// ── Selectors ────────────────────────────────────────────────────────────────

export function selectActiveSuggestion(
  state: RequestSuggestionState
): RequestDraftSuggestion | null {
  if (!state.activeSuggestion) return null;
  // generated 상태만 active로 노출
  if (state.activeSuggestion.status !== "generated") return null;
  return state.activeSuggestion;
}

export function isSuggestionSuppressed(
  state: RequestSuggestionState,
  contextHash: string
): boolean {
  return state.resolvedHistory.some(h => h.contextHash === contextHash);
}

/**
 * shouldShowRequestDraftSuggestion — sent/conflicted/stale/resolved 종합 판정.
 * 의사코드 그대로 구현.
 */
export function shouldShowRequestDraftSuggestion(params: {
  suggestion: RequestDraftSuggestion | null;
  draftReadiness: "draft" | "in_progress" | "ready" | "sent";
  draftMergeState: "clean" | "partial" | "conflicted";
  assemblyStatus: "drafting" | "partial_ready" | "ready_to_send" | "sent";
  currentContextHash: string;
  resolvedHistory: RequestSuggestionState["resolvedHistory"];
}): boolean {
  const { suggestion, draftReadiness, draftMergeState, assemblyStatus, currentContextHash, resolvedHistory } = params;
  if (!suggestion) return false;
  if (suggestion.status !== "generated") return false;

  // sent 보호
  if (draftReadiness === "sent") return false;
  if (assemblyStatus === "sent") return false;

  // conflict 우선
  if (draftMergeState === "conflicted") return false;

  // context hash 불일치 → stale
  if (suggestion.sourceContext.contextHash !== currentContextHash) return false;

  // 동일 contextHash 이미 resolved
  const alreadyResolved = resolvedHistory.some(
    (h: any) => h.contextHash === suggestion.sourceContext?.contextHash &&
         h.supplierId === suggestion.sourceContext?.supplierId
  );
  if (alreadyResolved) return false;

  return true;
}

// ── Placement ────────────────────────────────────────────────────────────────

export type SuggestionPlacement = "hidden" | "center_inline_top";

export function getRequestDraftSuggestionPlacement(input: {
  hasActiveSuggestion: boolean;
  activeSupplierRequestId: string | null;
  suggestionSupplierId: string | null;
  draftReadiness?: "draft" | "in_progress" | "ready" | "sent";
  draftMergeState?: "clean" | "partial" | "conflicted";
  assemblyStatus?: "drafting" | "partial_ready" | "ready_to_send" | "sent";
  isResolvedContext: boolean;
}): SuggestionPlacement {
  if (!input.hasActiveSuggestion) return "hidden";
  if (!input.activeSupplierRequestId) return "hidden";
  if (!input.suggestionSupplierId) return "hidden";
  if (input.suggestionSupplierId !== input.activeSupplierRequestId) return "hidden";
  if (input.isResolvedContext) return "hidden";
  if (input.draftReadiness === "sent") return "hidden";
  if (input.draftMergeState === "conflicted") return "hidden";
  if (input.assemblyStatus === "sent") return "hidden";
  return "center_inline_top";
}

// ── Preview items ────────────────────────────────────────────────────────────

export interface SuggestionPreviewItem {
  key: "message" | "lead_time" | "substitute" | "attachments" | "items";
  label: string;
}

export function buildRequestDraftSuggestionPreviewItems(
  suggestion: RequestDraftSuggestion
): SuggestionPreviewItem[] {
  const items: SuggestionPreviewItem[] = [];
  const patch = suggestion.payload.patch.fields;

  if (typeof patch.messageBody === "string" && patch.messageBody.trim().length > 0) {
    items.push({ key: "message", label: "요청 메시지 초안 보강" });
  }
  if (patch.leadTimeQuestionIncluded === true) {
    items.push({ key: "lead_time", label: "납기 문의 포함" });
  }
  if (patch.substituteQuestionIncluded === true) {
    items.push({ key: "substitute", label: "대체품 문의 포함" });
  }

  return items.slice(0, 4);
}

export function selectSuggestionStatus(
  state: RequestSuggestionState
): RequestSuggestionStatus | null {
  return state.activeSuggestion?.status ?? null;
}
