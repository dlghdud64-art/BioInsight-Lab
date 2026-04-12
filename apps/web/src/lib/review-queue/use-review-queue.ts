/**
 * Step 1 Review Queue 통합 상태 관리 hook
 *
 * 직접 검색 / 엑셀 업로드 / 프로토콜 업로드가 공유하는 단일 queue.
 * sessionStorage에 draft 유지. 승인된 항목만 Step 2/3로 handoff.
 */

import { useState, useCallback, useMemo, useEffect } from "react";
import type {
  ReviewQueueItem,
  ReviewStatus,
  SourceType,
  MatchCandidate,
  HandoffItem,
} from "./types";
import { canHandoffToCompare, canHandoffToQuote, toHandoffItem } from "./types";

const STORAGE_KEY = "labaxis_review_queue_draft";

// ── sessionStorage persistence ──
function loadDraft(): ReviewQueueItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveDraft(items: ReviewQueueItem[]) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // quota exceeded — silent fail
  }
}

// ── 중복 판정 키 ──
function getDuplicateKey(item: ReviewQueueItem): string {
  return `${item.sourceType}|${item.rawInput}|${item.catalogNumber ?? ""}|${item.manufacturer ?? ""}`;
}

// ── 유사 항목 감지 (충돌 후보) ──
function findSimilarItems(items: ReviewQueueItem[], newItem: ReviewQueueItem): ReviewQueueItem[] {
  if (!newItem.parsedItemName) return [];
  const name = newItem.parsedItemName.toLowerCase();
  return items.filter(
    (existing) =>
      existing.id !== newItem.id &&
      existing.parsedItemName?.toLowerCase().includes(name)
  );
}

export function useReviewQueue() {
  const [items, setItems] = useState<ReviewQueueItem[]>(loadDraft);

  // ── sessionStorage 동기화 ──
  useEffect(() => {
    saveDraft(items);
  }, [items]);

  // ── 중복 체크 ──
  const isDuplicate = useCallback((item: ReviewQueueItem): boolean => {
    const key = getDuplicateKey(item);
    return items.some((e) => getDuplicateKey(e) === key);
  }, [items]);

  // ── 유사 항목 감지 ──
  const getSimilarItems = useCallback((item: ReviewQueueItem): ReviewQueueItem[] => {
    return findSimilarItems(items, item);
  }, [items]);

  // ── 단건 추가 (중복 체크 포함) ──
  const addQueueItem = useCallback((item: ReviewQueueItem): {
    added: boolean;
    existingId?: string;
    similarCount?: number;
  } => {
    const key = getDuplicateKey(item);
    const existing = items.find((e) => getDuplicateKey(e) === key);
    if (existing) {
      return { added: false, existingId: existing.id };
    }
    const similar = findSimilarItems(items, item);
    setItems((prev) => [...prev, item]);
    return { added: true, similarCount: similar.length };
  }, [items]);

  // ── 일괄 추가 (중복 필터) ──
  const addQueueItems = useCallback((newItems: ReviewQueueItem[]): {
    addedCount: number;
    duplicateCount: number;
  } => {
    const existingKeys = new Set(items.map(getDuplicateKey));
    const unique = newItems.filter((item) => {
      const key = getDuplicateKey(item);
      if (existingKeys.has(key)) return false;
      existingKeys.add(key); // 배치 내 중복도 방지
      return true;
    });
    if (unique.length > 0) {
      setItems((prev) => [...prev, ...unique]);
    }
    return { addedCount: unique.length, duplicateCount: newItems.length - unique.length };
  }, [items]);

  // ── 기존 addItem (params → item 생성, 하위 호환) ──
  const addItem = useCallback((params: {
    sourceType: SourceType;
    rawInput: string;
    parsedItemName: string;
    manufacturer?: string | null;
    catalogNumber?: string | null;
    spec?: string | null;
    quantity?: number | null;
    unit?: string | null;
    confidence: "high" | "medium" | "low";
    matchCandidates?: MatchCandidate[];
    reviewReason?: string | null;
  }) => {
    const confidence = params.confidence;
    const hasMatch = (params.matchCandidates?.length ?? 0) > 0;
    const topMatch = params.matchCandidates?.[0] ?? null;

    let status: ReviewStatus = "needs_review";
    let needsReview = true;
    if (confidence === "high" && hasMatch) {
      status = "confirmed";
      needsReview = false;
    } else if (confidence === "low" || !hasMatch) {
      status = "match_failed";
    }

    const newItem: ReviewQueueItem = {
      id: `rq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      sourceType: params.sourceType,
      rawInput: params.rawInput,
      parsedItemName: params.parsedItemName,
      manufacturer: params.manufacturer ?? null,
      catalogNumber: params.catalogNumber ?? null,
      spec: params.spec ?? null,
      quantity: params.quantity ?? null,
      unit: params.unit ?? null,
      confidence,
      status,
      matchCandidates: params.matchCandidates ?? [],
      selectedProduct: confidence === "high" ? topMatch : null,
      needsReview,
      reviewReason: params.reviewReason ?? null,
      addedAt: new Date().toISOString(),
    };

    setItems((prev) => [...prev, newItem]);
    return newItem.id;
  }, []);

  // ── 일괄 추가 (하위 호환) ──
  const addBatch = useCallback((batchParams: Parameters<typeof addItem>[0][]) => {
    batchParams.forEach((p) => addItem(p));
  }, [addItem]);

  // ── 상태 전이 ──
  const approve = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, status: "approved" as const, needsReview: false, reviewReason: null }
          : item
      )
    );
  }, []);

  const exclude = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, status: "excluded" as const } : item
      )
    );
  }, []);

  const undoApprove = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id && item.status === "approved"
          ? { ...item, status: "confirmed" as const }
          : item
      )
    );
  }, []);

  const restore = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id && item.status === "excluded"
          ? { ...item, status: "confirmed" as const }
          : item
      )
    );
  }, []);

  const updateItem = useCallback((id: string, updates: Partial<ReviewQueueItem>) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  }, []);

  const selectProduct = useCallback((id: string, product: MatchCandidate) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, selectedProduct: product, status: "confirmed" as const, needsReview: false }
          : item
      )
    );
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setItems([]);
    sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  // ── 통계 ──
  const stats = useMemo(() => {
    const confirmed = items.filter((i) => i.status === "confirmed").length;
    const needsReview = items.filter((i) => i.status === "needs_review").length;
    const matchFailed = items.filter((i) => i.status === "match_failed").length;
    const compareNeeded = items.filter((i) => i.status === "compare_needed").length;
    const approved = items.filter((i) => i.status === "approved").length;
    const excluded = items.filter((i) => i.status === "excluded").length;
    return { total: items.length, confirmed, needsReview, matchFailed, compareNeeded, approved, excluded };
  }, [items]);

  // ── Source 분포 ──
  const sourceDistribution = useMemo(() => {
    const search = items.filter((i) => i.sourceType === "search").length;
    const excel = items.filter((i) => i.sourceType === "excel").length;
    const protocol = items.filter((i) => i.sourceType === "protocol").length;
    return { search, excel, protocol };
  }, [items]);

  // ── Handoff ──
  const compareReady = useMemo(
    () => items.filter(canHandoffToCompare),
    [items]
  );

  const quoteReady = useMemo(
    () => items.filter(canHandoffToQuote),
    [items]
  );

  const getHandoffItems = useCallback((): HandoffItem[] => {
    return items
      .filter(canHandoffToCompare)
      .map(toHandoffItem)
      .filter((h): h is HandoffItem => h !== null);
  }, [items]);

  return {
    items,
    addItem,
    addBatch,
    addQueueItem,
    addQueueItems,
    isDuplicate,
    getSimilarItems,
    approve,
    exclude,
    undoApprove,
    restore,
    updateItem,
    selectProduct,
    removeItem,
    clearAll,
    stats,
    sourceDistribution,
    compareReady,
    quoteReady,
    getHandoffItems,
  };
}
