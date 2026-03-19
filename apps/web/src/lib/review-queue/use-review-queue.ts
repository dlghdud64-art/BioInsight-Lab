/**
 * Step 1 Review Queue 상태 관리 hook
 *
 * 세 입력 방식(검색/엑셀/프로토콜)이 공유하는 단일 queue.
 * 승인된 항목만 Step 2/3로 handoff.
 */

import { useState, useCallback, useMemo } from "react";
import type {
  ReviewQueueItem,
  ReviewStatus,
  ConfidenceLevel,
  SourceType,
  MatchCandidate,
  HandoffItem,
} from "./types";
import { canHandoffToCompare, canHandoffToQuote, toHandoffItem } from "./types";

function generateId(): string {
  return `rq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useReviewQueue() {
  const [items, setItems] = useState<ReviewQueueItem[]>([]);

  // ── 중복 체크: sourceType + rawInput + catalogNumber + manufacturer ──
  const isDuplicate = useCallback((item: ReviewQueueItem): boolean => {
    return items.some(
      (existing) =>
        existing.sourceType === item.sourceType &&
        existing.rawInput === item.rawInput &&
        existing.catalogNumber === item.catalogNumber &&
        existing.manufacturer === item.manufacturer
    );
  }, [items]);

  // ── normalize된 ReviewQueueItem 직접 추가 (중복 체크 포함) ──
  const addQueueItem = useCallback((item: ReviewQueueItem): { added: boolean; existingId?: string } => {
    const existing = items.find(
      (e) =>
        e.sourceType === item.sourceType &&
        e.rawInput === item.rawInput &&
        e.catalogNumber === item.catalogNumber &&
        e.manufacturer === item.manufacturer
    );
    if (existing) {
      return { added: false, existingId: existing.id };
    }
    setItems((prev) => [...prev, item]);
    return { added: true };
  }, [items]);

  // ── normalize된 배열 일괄 추가 (중복 필터) ──
  const addQueueItems = useCallback((newItems: ReviewQueueItem[]): number => {
    const uniqueItems = newItems.filter(
      (item) =>
        !items.some(
          (e) =>
            e.sourceType === item.sourceType &&
            e.rawInput === item.rawInput &&
            e.catalogNumber === item.catalogNumber &&
            e.manufacturer === item.manufacturer
        )
    );
    if (uniqueItems.length > 0) {
      setItems((prev) => [...prev, ...uniqueItems]);
    }
    return uniqueItems.length;
  }, [items]);

  // ── 항목 추가 (검색/엑셀/프로토콜 공통) ──
  const addItem = useCallback((params: {
    sourceType: SourceType;
    rawInput: string;
    parsedItemName: string;
    manufacturer?: string | null;
    catalogNumber?: string | null;
    spec?: string | null;
    quantity?: number | null;
    unit?: string | null;
    confidence: ConfidenceLevel;
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
      id: generateId(),
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

  // ── 일괄 추가 (엑셀/프로토콜) ──
  const addBatch = useCallback((batchParams: Parameters<typeof addItem>[0][]) => {
    const newItems: ReviewQueueItem[] = batchParams.map((params) => {
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

      return {
        id: generateId(),
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
    });

    setItems((prev) => [...prev, ...newItems]);
  }, []);

  // ── 상태 변경 ──
  const approve = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, status: "confirmed" as const, needsReview: false, reviewReason: null }
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
  }, []);

  // ── 통계 ──
  const stats = useMemo(() => {
    const confirmed = items.filter((i) => i.status === "confirmed").length;
    const needsReview = items.filter((i) => i.status === "needs_review").length;
    const matchFailed = items.filter((i) => i.status === "match_failed").length;
    const excluded = items.filter((i) => i.status === "excluded").length;
    return { total: items.length, confirmed, needsReview, matchFailed, excluded };
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
    approve,
    exclude,
    updateItem,
    selectProduct,
    removeItem,
    clearAll,
    stats,
    compareReady,
    quoteReady,
    getHandoffItems,
  };
}
