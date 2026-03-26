/**
 * Request Draft Supplier Switch — per-supplier suggestion reselect + resolution query
 *
 * 고정 규칙:
 * 1. supplier별 suggestion context는 독립적. 교차 오염 금지.
 * 2. 복귀 시 UI snapshot 복원 아닌 현재 canonical context 기준 재평가.
 * 3. resolved/stale/no-op/redundant suggestion은 복귀해도 재노출 금지.
 * 4. activeSuggestionId는 단독 source가 아니라 reselect 결과의 반영값.
 * 5. supplier 전환 = selection/re-evaluation trigger. generation trigger 아님.
 * 6. stale ref/card/action row 잔상 남기지 않음.
 */

import type { RequestDraftSuggestion, RequestSuggestionState } from "./request-suggestion-store";
import type { SupplierRequestDraft, SupplierDraftPatch, AssemblyStatus } from "./request-draft-patch";
import { buildRequestDraftContextHash, type RequestDraftContextInput } from "./context-hash";
import { isNoOpPatch } from "./request-draft-diff";

// ── Types ──

export interface SupplierSuggestionResolutionQuery {
  requestAssemblyId: string;
  supplierId: string;
}

export interface SelectActiveSuggestionForSupplierInput {
  supplierId: string | null;
  requestAssemblyId: string;
  candidates: RequestDraftSuggestion[];
  draft: SupplierRequestDraft | null;
  resolutionLog: RequestSuggestionState["resolvedHistory"];
  assemblyStatus: AssemblyStatus;
}

export interface SupplierSwitchResult {
  activeSuggestion: RequestDraftSuggestion | null;
  gate: "visible" | "hidden";
  hiddenReason: string | null;
}

// ── Per-supplier resolution query ──

export function selectResolutionsForSupplier(
  resolvedHistory: RequestSuggestionState["resolvedHistory"],
  query: SupplierSuggestionResolutionQuery
): RequestSuggestionState["resolvedHistory"] {
  return resolvedHistory.filter(
    h => h.supplierId === query.supplierId
      && h.requestAssemblyId === query.requestAssemblyId
  );
}

// ── Per-supplier candidate filter ──

export function filterCandidatesForSupplier(
  candidates: RequestDraftSuggestion[],
  supplierId: string,
  requestAssemblyId: string
): RequestDraftSuggestion[] {
  return candidates.filter(
    s => s.sourceContext.supplierId === supplierId
      && s.sourceContext.requestAssemblyId === requestAssemblyId
      && s.status === "generated"
  );
}

// ── Build current contextHash for supplier draft ──

function buildCurrentContextHash(
  draft: SupplierRequestDraft,
  requestAssemblyId: string
): string {
  const input: RequestDraftContextInput = {
    requestAssemblyId,
    supplierId: draft.supplierId,
    itemIds: draft.itemIds,
    messageBody: draft.messageBody,
    attachmentIds: draft.attachments.map(a => a.id),
    leadTimeQuestionIncluded: draft.leadTimeQuestionIncluded,
    substituteQuestionIncluded: draft.substituteQuestionIncluded,
    editState: draft.editState,
    mergeState: draft.mergeState,
  };
  return buildRequestDraftContextHash(input);
}

// ── Per-supplier active suggestion reselect ──
// restore가 아니라 recompute. 현재 canonical context 기준.

export function selectActiveRequestDraftSuggestionForSupplier(
  input: SelectActiveSuggestionForSupplierInput
): SupplierSwitchResult {
  const { supplierId, requestAssemblyId, candidates, draft, resolutionLog, assemblyStatus } = input;

  // Guard: no supplier or draft
  if (!supplierId || !draft) {
    return { activeSuggestion: null, gate: "hidden", hiddenReason: "no_supplier_or_draft" };
  }

  // Guard: sent
  if (draft.readiness === "sent" || assemblyStatus === "sent") {
    return { activeSuggestion: null, gate: "hidden", hiddenReason: "sent" };
  }

  // Guard: conflicted
  if (draft.mergeState === "conflicted") {
    return { activeSuggestion: null, gate: "hidden", hiddenReason: "conflicted" };
  }

  // Current contextHash
  const currentHash = buildCurrentContextHash(draft, requestAssemblyId);

  // Supplier-specific candidates only
  const supplierCandidates = filterCandidatesForSupplier(candidates, supplierId, requestAssemblyId);

  // Supplier-specific resolutions
  const supplierResolutions = selectResolutionsForSupplier(resolutionLog, { requestAssemblyId, supplierId });

  // Filter: contextHash match + not resolved + not no-op
  const visibleCandidates = supplierCandidates
    .filter(s => {
      // contextHash must match current draft state
      if (s.sourceContext.contextHash !== currentHash) return false;

      // Check if this contextHash is already resolved
      const isResolved = supplierResolutions.some(
        h => h.contextHash === s.sourceContext.contextHash
      );
      if (isResolved) return false;

      // Check no-op
      if (isNoOpPatch(draft, s.payload.patch as SupplierDraftPatch)) return false;

      return true;
    })
    // Most recent first
    .sort((a, b) => (a.generatedAt < b.generatedAt ? 1 : -1));

  // Ready_to_send + ready draft → redundant suppress
  if (assemblyStatus === "ready_to_send" && draft.readiness === "ready") {
    return { activeSuggestion: null, gate: "hidden", hiddenReason: "redundant_ready" };
  }

  const selected = visibleCandidates[0] ?? null;

  return {
    activeSuggestion: selected,
    gate: selected ? "visible" : "hidden",
    hiddenReason: selected ? null : "no_valid_candidate",
  };
}

// ── Supplier change handler (순서 고정) ──
// setActiveSupplierRequestId 이후 호출.
// 반환값으로 activeSuggestionId를 갱신해야 함.

export function handleSupplierChangeReEvaluation(input: {
  nextSupplierId: string;
  requestAssemblyId: string;
  allSuggestions: RequestDraftSuggestion[];
  supplierDraftMap: Record<string, SupplierRequestDraft>;
  resolvedHistory: RequestSuggestionState["resolvedHistory"];
  assemblyStatus: AssemblyStatus;
}): SupplierSwitchResult {
  const { nextSupplierId, requestAssemblyId, allSuggestions, supplierDraftMap, resolvedHistory, assemblyStatus } = input;

  const draft = supplierDraftMap[nextSupplierId] ?? null;

  return selectActiveRequestDraftSuggestionForSupplier({
    supplierId: nextSupplierId,
    requestAssemblyId,
    candidates: allSuggestions,
    draft,
    resolutionLog: resolvedHistory,
    assemblyStatus,
  });
}
