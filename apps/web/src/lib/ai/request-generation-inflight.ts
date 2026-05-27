/**
 * Request Draft Generation Inflight — dedupe + stale result discard
 *
 * 고정 규칙:
 * 1. generation request는 supplier-local context identity를 가짐.
 * 2. 같은 supplier/contextHash/draftFingerprint에 대해 inflight 1개만.
 * 3. result 도착 시 current canonical context 기준 재검증. stale → silent discard.
 * 4. stale discard는 정상 경로. error UI 금지.
 * 5. inflight clear는 requestId match 기준만.
 * 6. latest response wins 아님 — current context match wins.
 */

import type { SupplierRequestDraft } from "./request-draft-patch";
import { buildRequestDraftContextHash, buildRequestDraftFingerprint, type RequestDraftContextInput } from "./context-hash";

// ── Generation request identity ──

export interface RequestDraftGenerationRequest {
  requestId: string;
  requestAssemblyId: string;
  supplierId: string;
  contextHash: string;
  draftFingerprint: string;
  startedAt: string;
  source: "message_change" | "question_change" | "attachments_change" | "items_change";
}

// ── Inflight state ──

export type RequestDraftInflightMap = Record<string, RequestDraftGenerationRequest | null>;

// ── Request identity builder ──

let _counter = 0;
function uid(): string {
  return `genreq_${Date.now()}_${++_counter}`;
}

export function buildGenerationRequest(input: {
  requestAssemblyId: string;
  supplierId: string;
  draft: SupplierRequestDraft;
  source: RequestDraftGenerationRequest["source"];
  now: string;
}): RequestDraftGenerationRequest {
  const { requestAssemblyId, supplierId, draft, source, now } = input;

  const contextInput: RequestDraftContextInput = {
    requestAssemblyId,
    supplierId,
    itemIds: draft.itemIds,
    messageBody: draft.messageBody,
    attachmentIds: draft.attachments.map(a => a.id),
    leadTimeQuestionIncluded: draft.leadTimeQuestionIncluded,
    substituteQuestionIncluded: draft.substituteQuestionIncluded,
    editState: draft.editState,
    mergeState: draft.mergeState,
  };

  return {
    requestId: uid(),
    requestAssemblyId,
    supplierId,
    contextHash: buildRequestDraftContextHash(contextInput),
    draftFingerprint: buildRequestDraftFingerprint(contextInput),
    startedAt: now,
    source,
  };
}

// ── Inflight dedupe ──

export function isDuplicateInflight(input: {
  inflight: RequestDraftGenerationRequest | null;
  next: RequestDraftGenerationRequest;
}): boolean {
  const { inflight, next } = input;
  if (!inflight) return false;

  // same supplier + same contextHash + same fingerprint = duplicate
  return (
    inflight.requestAssemblyId === next.requestAssemblyId &&
    inflight.supplierId === next.supplierId &&
    inflight.contextHash === next.contextHash &&
    inflight.draftFingerprint === next.draftFingerprint
  );
}

// ── Stale result discard ──

export interface StaleCheckInput {
  request: RequestDraftGenerationRequest;
  currentSupplierId: string | null;
  currentDraft: SupplierRequestDraft | null;
  currentRequestAssemblyId: string | null;
  resolvedAfterStart: boolean;
  hasVisibleValidSuggestion: boolean;
}

export function shouldDiscardResult(input: StaleCheckInput): boolean {
  const { request, currentSupplierId, currentDraft, currentRequestAssemblyId, resolvedAfterStart, hasVisibleValidSuggestion } = input;

  // 1. No active supplier/draft
  if (!currentSupplierId || !currentDraft || !currentRequestAssemblyId) return true;

  // 2. Supplier mismatch
  if (request.supplierId !== currentSupplierId) return true;

  // 3. Assembly mismatch
  if (request.requestAssemblyId !== currentRequestAssemblyId) return true;

  // 4. Context mismatch — current draft changed since request started
  const currentContextInput: RequestDraftContextInput = {
    requestAssemblyId: currentRequestAssemblyId,
    supplierId: currentSupplierId,
    itemIds: currentDraft.itemIds,
    messageBody: currentDraft.messageBody,
    attachmentIds: currentDraft.attachments.map(a => a.id),
    leadTimeQuestionIncluded: currentDraft.leadTimeQuestionIncluded,
    substituteQuestionIncluded: currentDraft.substituteQuestionIncluded,
    editState: currentDraft.editState,
    mergeState: currentDraft.mergeState,
  };
  const currentHash = buildRequestDraftContextHash(currentContextInput);
  if (request.contextHash !== currentHash) return true;

  // 5. Draft sent/conflicted
  if (currentDraft.readiness === "sent") return true;
  if (currentDraft.mergeState === "conflicted") return true;

  // 6. Resolution occurred after request start
  if (resolvedAfterStart) return true;

  // 7. Valid suggestion already exists
  if (hasVisibleValidSuggestion) return true;

  return false;
}

// ── Resolution-after-request check ──

export function hasResolutionAfterTimestamp(input: {
  resolvedHistory: Array<{ requestAssemblyId: string; supplierId: string; resolvedAt: string }>;
  requestAssemblyId: string;
  supplierId: string;
  since: string;
}): boolean {
  return input.resolvedHistory.some(
    h => h.requestAssemblyId === input.requestAssemblyId
      && h.supplierId === input.supplierId
      && h.resolvedAt > input.since
  );
}

// ── Inflight clear (requestId match only) ──

export function clearInflightIfMatch(
  inflightMap: RequestDraftInflightMap,
  supplierId: string,
  requestId: string
): RequestDraftInflightMap {
  const current = inflightMap[supplierId];
  if (!current || current.requestId !== requestId) return inflightMap;
  return { ...inflightMap, [supplierId]: null };
}

// ── Set inflight ──

export function setInflight(
  inflightMap: RequestDraftInflightMap,
  request: RequestDraftGenerationRequest
): RequestDraftInflightMap {
  return { ...inflightMap, [request.supplierId]: request };
}

// ── Is inflight for supplier ──

export function isInflightForSupplier(
  inflightMap: RequestDraftInflightMap,
  supplierId: string
): boolean {
  return !!inflightMap[supplierId];
}
