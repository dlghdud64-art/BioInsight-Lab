/**
 * Request Draft Candidate Store — contextKey dedupe + upsert + cleanup + orphan prune
 *
 * 설계 원칙:
 * - candidate store는 history archive가 아님. current supplier-local candidate pool.
 * - contextKey당 representative suggestion 1개만 유지.
 * - old stale/resolved/noop candidate는 cleanup 대상.
 * - entity cleanup은 resolutionLog/baseline lifecycle truth와 독립.
 * - orphan entity (index에서 참조 안 됨) → prune.
 *
 * 고정 규칙:
 * 1. 같은 contextKey면 upsert (append 금지).
 * 2. cleanup은 selector가 올리지 않을 candidate만 정리.
 * 3. active suggestion 선택은 entity upsert와 분리 (selector recompute 기준).
 * 4. entity 삭제가 resolutionLog/baseline을 깨면 안 됨.
 */

import type { RequestDraftSuggestion } from "./request-suggestion-store";

// ── Context key ──

export function buildContextKey(input: {
  requestAssemblyId: string;
  supplierId: string;
  contextHash: string;
}): string {
  return `request_draft:${input.requestAssemblyId}:${input.supplierId}:${input.contextHash}`;
}

// ── Index model ──

// contextKey → representative suggestionId (1개만)
export type ContextKeyIndex = Record<string, string | null>;

// ── Entity store shape (candidate pool) ──

export interface RequestDraftCandidateStore {
  byId: Record<string, RequestDraftSuggestion>;
  byContextKey: ContextKeyIndex;
}

export function createEmptyCandidateStore(): RequestDraftCandidateStore {
  return { byId: {}, byContextKey: {} };
}

// ── Upsert ──

export interface UpsertResult {
  store: RequestDraftCandidateStore;
  replacedId: string | null;
  isNew: boolean;
}

export function upsertSuggestion(
  store: RequestDraftCandidateStore,
  suggestion: RequestDraftSuggestion
): UpsertResult {
  const contextKey = buildContextKey({
    requestAssemblyId: suggestion.sourceContext.requestAssemblyId,
    supplierId: suggestion.sourceContext.supplierId,
    contextHash: suggestion.sourceContext.contextHash,
  });

  const previousId = store.byContextKey[contextKey] ?? null;
  const isNew = !previousId || previousId !== suggestion.id;

  const nextById = { ...store.byId };
  const nextByContextKey = { ...store.byContextKey };

  // Insert/replace representative
  nextById[suggestion.id] = suggestion;
  nextByContextKey[contextKey] = suggestion.id;

  // Remove old representative (if different and not active elsewhere)
  let replacedId: string | null = null;
  if (previousId && previousId !== suggestion.id) {
    // Check if old entity is referenced by another contextKey
    const stillReferenced = Object.values(nextByContextKey).some(
      id => id === previousId && id !== suggestion.id
    );
    if (!stillReferenced) {
      delete nextById[previousId];
      replacedId = previousId;
    }
  }

  return {
    store: { byId: nextById, byContextKey: nextByContextKey },
    replacedId,
    isNew,
  };
}

// ── Supplier-local cleanup ──

export function cleanupSupplierCandidates(
  store: RequestDraftCandidateStore,
  input: {
    requestAssemblyId: string;
    supplierId: string;
    currentContextHash: string;
    resolvedContextHashes: Set<string>;
    activeSuggestionId: string | null;
  }
): RequestDraftCandidateStore {
  const { requestAssemblyId, supplierId, currentContextHash, resolvedContextHashes, activeSuggestionId } = input;

  const prefix = `request_draft:${requestAssemblyId}:${supplierId}:`;
  const nextById = { ...store.byId };
  const nextByContextKey = { ...store.byContextKey };

  for (const [contextKey, suggestionId] of Object.entries(store.byContextKey)) {
    if (!contextKey.startsWith(prefix)) continue;
    if (!suggestionId) continue;

    // Extract contextHash from key
    const keyContextHash = contextKey.slice(prefix.length);

    // Keep current context representative
    if (keyContextHash === currentContextHash) continue;

    // Keep active suggestion
    if (suggestionId === activeSuggestionId) continue;

    // Remove resolved context candidates
    if (resolvedContextHashes.has(keyContextHash)) {
      delete nextById[suggestionId];
      delete nextByContextKey[contextKey];
      continue;
    }

    // Remove stale (non-current) context candidates older than current
    // Conservative: only remove if explicitly resolved or stale
    // For now, keep non-resolved old context candidates (they'll be filtered by selector)
  }

  return { byId: nextById, byContextKey: nextByContextKey };
}

// ── Orphan prune ──

export function pruneOrphans(
  store: RequestDraftCandidateStore,
  activeSuggestionId: string | null
): RequestDraftCandidateStore {
  const referencedIds = new Set<string>();

  // Referenced by contextKey index
  for (const id of Object.values(store.byContextKey)) {
    if (id) referencedIds.add(id);
  }

  // Active suggestion
  if (activeSuggestionId) referencedIds.add(activeSuggestionId);

  const nextById = { ...store.byId };
  let pruned = false;

  for (const id of Object.keys(nextById)) {
    if (referencedIds.has(id)) continue;
    delete nextById[id];
    pruned = true;
  }

  if (!pruned) return store;

  return { byId: nextById, byContextKey: store.byContextKey };
}

// ── Full upsert + cleanup + prune pipeline ──

export interface UpsertPipelineInput {
  store: RequestDraftCandidateStore;
  suggestion: RequestDraftSuggestion;
  currentContextHash: string;
  resolvedContextHashes: Set<string>;
  activeSuggestionId: string | null;
}

export function upsertAndCleanup(input: UpsertPipelineInput): RequestDraftCandidateStore {
  const { suggestion, currentContextHash, resolvedContextHashes, activeSuggestionId } = input;

  // 1. Upsert representative
  const upsertResult = upsertSuggestion(input.store, suggestion);

  // 2. Cleanup supplier-local stale/resolved candidates
  const cleaned = cleanupSupplierCandidates(upsertResult.store, {
    requestAssemblyId: suggestion.sourceContext.requestAssemblyId,
    supplierId: suggestion.sourceContext.supplierId,
    currentContextHash,
    resolvedContextHashes,
    activeSuggestionId,
  });

  // 3. Prune orphans
  return pruneOrphans(cleaned, activeSuggestionId);
}

// ── Query: get representative for supplier/context ──

export function getRepresentative(
  store: RequestDraftCandidateStore,
  input: { requestAssemblyId: string; supplierId: string; contextHash: string }
): RequestDraftSuggestion | null {
  const key = buildContextKey(input);
  const id = store.byContextKey[key];
  if (!id) return null;
  return store.byId[id] ?? null;
}

// ── Query: all candidates for supplier ──

export function getCandidatesForSupplier(
  store: RequestDraftCandidateStore,
  requestAssemblyId: string,
  supplierId: string
): RequestDraftSuggestion[] {
  const prefix = `request_draft:${requestAssemblyId}:${supplierId}:`;
  const results: RequestDraftSuggestion[] = [];

  for (const [key, id] of Object.entries(store.byContextKey)) {
    if (!key.startsWith(prefix) || !id) continue;
    const entity = store.byId[id];
    if (entity) results.push(entity);
  }

  return results;
}
