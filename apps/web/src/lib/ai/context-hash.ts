/**
 * contextHash — 현재 화면 상태를 대표하는 deterministic hash
 *
 * 랜덤값 금지. stable serialize 후 hash 생성.
 */
import type { AiSuggestionScope } from "./suggestion-engine";

function stableHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function stableStringify(obj: Record<string, unknown>): string {
  return JSON.stringify(obj, Object.keys(obj).sort());
}

export function buildContextHash(scope: AiSuggestionScope, inputs: Record<string, unknown>): string {
  return `${scope}_${stableHash(stableStringify(inputs))}`;
}

// ── Sourcing ──
export function buildSourcingContextHash(params: {
  query: string;
  resultCount: number;
  compareIds: string[];
  requestIds: string[];
  activeResultId: string | null;
}): string {
  return buildContextHash("sourcing_summary", {
    q: params.query,
    rc: params.resultCount,
    cids: params.compareIds.slice().sort().join(","),
    rids: params.requestIds.slice().sort().join(","),
    aid: params.activeResultId ?? "",
  });
}

// ── Compare ──
export function buildCompareContextHash(params: {
  compareSessionId: string;
  comparedItemIds: string[];
  compareMode: string;
  activeCompareItemId: string | null;
  selectedDecisionItemId: string | null;
}): string {
  return buildContextHash("compare_recommendation", {
    sid: params.compareSessionId,
    cids: params.comparedItemIds.slice().sort().join(","),
    mode: params.compareMode,
    acid: params.activeCompareItemId ?? "",
    sdid: params.selectedDecisionItemId ?? "",
  });
}

// ── Request (legacy — builder 호환) ──
export function buildRequestContextHash(params: {
  requestAssemblyId: string;
  activeSupplierRequestId: string | null;
  missingFields: string[];
  itemIds: string[];
  leadTimeIncluded: boolean;
  substituteIncluded: boolean;
}): string {
  return buildContextHash("request_draft", {
    raid: params.requestAssemblyId,
    asrid: params.activeSupplierRequestId ?? "",
    mf: params.missingFields.slice().sort().join(","),
    iids: params.itemIds.slice().sort().join(","),
    lt: params.leadTimeIncluded ? "1" : "0",
    sub: params.substituteIncluded ? "1" : "0",
  });
}

// ── Request Draft (full — editState/mergeState/attachments 포함) ──

export interface RequestDraftContextInput {
  requestAssemblyId: string;
  supplierId: string;
  itemIds: string[];
  messageBody: string;
  attachmentIds: string[];
  leadTimeQuestionIncluded: boolean;
  substituteQuestionIncluded: boolean;
  editState?: "pristine" | "edited";
  mergeState?: "clean" | "partial" | "conflicted";
}

export function buildRequestDraftContextHash(input: RequestDraftContextInput): string {
  return buildContextHash("request_draft", {
    raid: input.requestAssemblyId,
    sid: input.supplierId,
    iids: input.itemIds.slice().sort().join(","),
    mb_len: input.messageBody.length.toString(),
    mb_fp: stableHash(input.messageBody.substring(0, 200)),
    aids: input.attachmentIds.slice().sort().join(","),
    lt: input.leadTimeQuestionIncluded ? "1" : "0",
    sub: input.substituteQuestionIncluded ? "1" : "0",
    es: input.editState ?? "pristine",
    ms: input.mergeState ?? "clean",
  });
}

export function buildRequestDraftFingerprint(input: RequestDraftContextInput): string {
  // fingerprint는 messageBody 내용까지 포함하여 더 세밀하게 구분
  return stableHash(stableStringify({
    sid: input.supplierId,
    iids: input.itemIds.slice().sort().join(","),
    mb: input.messageBody,
    aids: input.attachmentIds.slice().sort().join(","),
    lt: input.leadTimeQuestionIncluded ? "1" : "0",
    sub: input.substituteQuestionIncluded ? "1" : "0",
  }));
}
