/**
 * Request Draft Active Suggestion Selector Chain — 단일 경로
 *
 * 선택 경로:
 *   current context key → representative → final active suggestion
 *
 * 고정 규칙:
 * 1. activeSuggestionId는 derived mirror. direct render truth 금지.
 * 2. byContextKey 인덱스 우선. byId 전체 scan 금지.
 * 3. suppress 판단은 selector chain 안에서 끝냄. component ad-hoc filtering 금지.
 * 4. preview/actionability/review는 모두 final active suggestion 기준.
 * 5. null active → no-copy/no-surface. placeholder 남발 금지.
 */

import type { RequestDraftSuggestion } from "./request-suggestion-store";
import type { SupplierRequestDraft } from "./request-draft-patch";
import type { RequestDraftCandidateStore } from "./request-candidate-store";
import type { RequestDraftSuggestionActionability } from "./request-draft-action-gate";
import type { EffectivePreviewItem } from "./request-draft-diff";
import { buildRequestDraftContextHash, type RequestDraftContextInput } from "./context-hash";
import { buildContextKey } from "./request-candidate-store";

// ── Step 1: Current context key ──

export interface ActiveSupplierContext {
  requestAssemblyId: string;
  supplierId: string;
  draft: SupplierRequestDraft;
}

export function computeCurrentContextKey(
  ctx: ActiveSupplierContext | null
): string | null {
  if (!ctx) return null;

  const input: RequestDraftContextInput = {
    requestAssemblyId: ctx.requestAssemblyId,
    supplierId: ctx.supplierId,
    itemIds: ctx.draft.itemIds,
    messageBody: ctx.draft.messageBody,
    attachmentIds: ctx.draft.attachments.map(a => a.id),
    leadTimeQuestionIncluded: ctx.draft.leadTimeQuestionIncluded,
    substituteQuestionIncluded: ctx.draft.substituteQuestionIncluded,
    editState: ctx.draft.editState,
    mergeState: ctx.draft.mergeState,
  };

  const contextHash = buildRequestDraftContextHash(input);

  return buildContextKey({
    requestAssemblyId: ctx.requestAssemblyId,
    supplierId: ctx.supplierId,
    contextHash,
  });
}

// ── Step 2: Representative lookup (byContextKey → byId) ──

export function lookupRepresentative(
  candidateStore: RequestDraftCandidateStore,
  contextKey: string | null
): RequestDraftSuggestion | null {
  if (!contextKey) return null;
  const id = candidateStore.byContextKey[contextKey];
  if (!id) return null;
  return candidateStore.byId[id] ?? null;
}

// ── Step 3: Final active suggestion (representative + gate) ──

export interface FinalActiveSuggestionInput {
  representative: RequestDraftSuggestion | null;
  gate: RequestDraftSuggestionActionability["gate"];
}

export function computeFinalActiveSuggestion(
  input: FinalActiveSuggestionInput
): RequestDraftSuggestion | null {
  if (!input.representative) return null;
  if (input.gate !== "visible") return null;
  if (input.representative.status !== "generated") return null;
  return input.representative;
}

// ── Surface model (component가 읽는 단일 묶음) ──

export interface RequestDraftSuggestionSurfaceModel {
  suggestion: RequestDraftSuggestion | null;
  previewItems: EffectivePreviewItem[];
  actionability: RequestDraftSuggestionActionability;
  shouldRender: boolean;
}

export function buildSurfaceModel(input: {
  activeSuggestion: RequestDraftSuggestion | null;
  previewItems: EffectivePreviewItem[];
  actionability: RequestDraftSuggestionActionability;
}): RequestDraftSuggestionSurfaceModel {
  const shouldRender = !!(
    input.activeSuggestion &&
    input.actionability.gate === "visible" &&
    input.previewItems.length > 0
  );

  return {
    suggestion: input.activeSuggestion,
    previewItems: input.previewItems,
    actionability: input.actionability,
    shouldRender,
  };
}

// ── Recompute helper (단일 진입점) ──

export interface RecomputeResult {
  activeSuggestionId: string | null;
  surfaceModel: RequestDraftSuggestionSurfaceModel;
}

export function recomputeActiveSuggestionSelection(input: {
  supplierContext: ActiveSupplierContext | null;
  candidateStore: RequestDraftCandidateStore;
  gate: RequestDraftSuggestionActionability["gate"];
  previewItems: EffectivePreviewItem[];
  actionability: RequestDraftSuggestionActionability;
}): RecomputeResult {
  const { supplierContext, candidateStore, gate, previewItems, actionability } = input;

  // Step 1: context key
  const contextKey = computeCurrentContextKey(supplierContext);

  // Step 2: representative
  const representative = lookupRepresentative(candidateStore, contextKey);

  // Step 3: final active
  const activeSuggestion = computeFinalActiveSuggestion({ representative, gate });

  // Surface model
  const surfaceModel = buildSurfaceModel({
    activeSuggestion,
    previewItems: activeSuggestion ? previewItems : [],
    actionability: activeSuggestion ? actionability : { ...actionability, gate: actionability.gate },
  });

  return {
    activeSuggestionId: activeSuggestion?.id ?? null,
    surfaceModel,
  };
}
