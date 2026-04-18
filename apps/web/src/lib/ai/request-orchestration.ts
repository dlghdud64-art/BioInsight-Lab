/**
 * Request Draft Orchestration — 사건별 후처리 순서 고정
 *
 * 역할: existing primitives (selector/util/reducer)를 어떤 순서로 호출할지 고정.
 * 새로운 truth를 만들지 않음. 호출 순서만 조정하는 조정층.
 *
 * 경계:
 *   reducers/util/selectors = canonical truth primitives
 *   orchestration helpers = 사건별 호출 순서
 *   container/components = UI event emit + surface model render
 *
 * 고정 규칙:
 * 1. 모든 사건은 단일 orchestration entry를 거침. component raw multi-dispatch 금지.
 * 2. recompute 순서: cleanup → prune → active selection → mirror 갱신.
 * 3. supplier change는 recompute entry이지 generation entry가 아님.
 * 4. orchestration은 UI surface를 직접 바꾸지 않음 — selector model이 UI truth.
 */

// ── Orchestration event ──

export type RequestDraftOrchestrationEvent =
  | "supplier_changed"
  | "user_edited"
  | "suggestion_accepted"
  | "suggestion_dismissed"
  | "suggestion_noop"
  | "generation_started"
  | "generation_result_applied"
  | "generation_result_discarded";

// ── Supplier-local recompute (canonical post-processing) ──

export interface RecomputeInput {
  requestAssemblyId: string;
  supplierId: string;
  reason: RequestDraftOrchestrationEvent;
}

/**
 * recomputeRequestDraftForSupplier
 *
 * 모든 사건 후처리의 공통 마지막 단계.
 * 순서:
 *   1. supplier-local cleanup (resolved/stale candidate 정리)
 *   2. orphan prune
 *   3. active selection recompute → activeSuggestionId mirror
 *
 * 이 함수는 state를 직접 변이하지 않고 필요한 작업 목록을 반환.
 * 호출자가 실제 state 변경을 수행.
 */
export interface RecomputeActions {
  shouldCleanup: boolean;
  shouldPruneOrphans: boolean;
  shouldRecomputeActiveSelection: boolean;
  reason: RequestDraftOrchestrationEvent;
}

export function planRecompute(input: RecomputeInput): RecomputeActions {
  // 모든 사건에서 동일 순서 보장
  return {
    shouldCleanup: true,
    shouldPruneOrphans: true,
    shouldRecomputeActiveSelection: true,
    reason: input.reason,
  };
}

// ── Event-specific orchestration entries ──

// 각 entry는 "무슨 순서로 무엇을 호출할지"만 정의.

export interface SupplierChangedActions {
  clearTransientRefs: true;
  recompute: RecomputeActions;
  triggerGeneration: false; // supplier change ≠ generation trigger
}

export function planSupplierChanged(input: {
  requestAssemblyId: string;
  nextSupplierId: string;
}): SupplierChangedActions {
  return {
    clearTransientRefs: true,
    recompute: planRecompute({
      requestAssemblyId: input.requestAssemblyId,
      supplierId: input.nextSupplierId,
      reason: "supplier_changed",
    }),
    triggerGeneration: false,
  };
}

export interface UserEditedActions {
  recordActivity: true;
  maybeRecordEditedResolution: true;
  recompute: RecomputeActions;
  maybeGenerate: true;
  editSource: "message" | "question" | "attachments" | "items";
}

export function planUserEdited(input: {
  requestAssemblyId: string;
  supplierId: string;
  editSource: "message" | "question" | "attachments" | "items";
}): UserEditedActions {
  return {
    recordActivity: true,
    maybeRecordEditedResolution: true,
    recompute: planRecompute({
      requestAssemblyId: input.requestAssemblyId,
      supplierId: input.supplierId,
      reason: "user_edited",
    }),
    maybeGenerate: true,
    editSource: input.editSource,
  };
}

export interface SuggestionAcceptedActions {
  applyPatch: true;
  recordResolutionAndBaseline: true;
  clearActiveSuggestion: true;
  recompute: RecomputeActions;
}

export function planSuggestionAccepted(input: {
  requestAssemblyId: string;
  supplierId: string;
}): SuggestionAcceptedActions {
  return {
    applyPatch: true,
    recordResolutionAndBaseline: true,
    clearActiveSuggestion: true,
    recompute: planRecompute({
      requestAssemblyId: input.requestAssemblyId,
      supplierId: input.supplierId,
      reason: "suggestion_accepted",
    }),
  };
}

export interface SuggestionDismissedActions {
  recordResolutionAndBaseline: true;
  clearActiveSuggestion: true;
  recompute: RecomputeActions;
}

export function planSuggestionDismissed(input: {
  requestAssemblyId: string;
  supplierId: string;
}): SuggestionDismissedActions {
  return {
    recordResolutionAndBaseline: true,
    clearActiveSuggestion: true,
    recompute: planRecompute({
      requestAssemblyId: input.requestAssemblyId,
      supplierId: input.supplierId,
      reason: "suggestion_dismissed",
    }),
  };
}

export interface SuggestionNoopActions {
  recordResolutionAndBaseline: true;
  clearActiveSuggestion: true;
  recompute: RecomputeActions;
}

export function planSuggestionNoop(input: {
  requestAssemblyId: string;
  supplierId: string;
}): SuggestionNoopActions {
  return {
    recordResolutionAndBaseline: true,
    clearActiveSuggestion: true,
    recompute: planRecompute({
      requestAssemblyId: input.requestAssemblyId,
      supplierId: input.supplierId,
      reason: "suggestion_noop",
    }),
  };
}

export interface GenerationResultActions {
  upsertResult: boolean;
  clearInflight: true;
  recompute: RecomputeActions;
}

export function planGenerationResultApplied(input: {
  requestAssemblyId: string;
  supplierId: string;
}): GenerationResultActions {
  return {
    upsertResult: true,
    clearInflight: true,
    recompute: planRecompute({
      requestAssemblyId: input.requestAssemblyId,
      supplierId: input.supplierId,
      reason: "generation_result_applied",
    }),
  };
}

export function planGenerationResultDiscarded(input: {
  requestAssemblyId: string;
  supplierId: string;
}): GenerationResultActions {
  return {
    upsertResult: false,
    clearInflight: true,
    recompute: planRecompute({
      requestAssemblyId: input.requestAssemblyId,
      supplierId: input.supplierId,
      reason: "generation_result_discarded",
    }),
  };
}

// ── Generation source mapping ──

export function mapEditSourceToGenerationTrigger(
  editSource: "message" | "question" | "attachments" | "items"
): "message_change" | "question_change" | "attachments_change" | "items_change" {
  const map = {
    message: "message_change" as const,
    question: "question_change" as const,
    attachments: "attachments_change" as const,
    items: "items_change" as const,
  };
  return map[editSource];
}
