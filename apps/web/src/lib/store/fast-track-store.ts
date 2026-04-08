/**
 * Fast-Track Store — "즉시 승인 가능" 권장 in-memory 보관소
 *
 * 역할:
 * - evaluateFastTrack() + publisher 조합으로 recommendation 을 계산하고 캐시한다.
 * - drift 감지는 publisher 내부에서 처리되므로 본 store 는 previous 를 주입만 한다.
 * - 사용자의 [일괄 승인] 수락 이력을 acceptanceLog 로 보관해 ActionLedger 가 소비한다.
 *
 * 고정 규칙 (ARCHITECTURE.md / CLAUDE.md):
 * 1. canonical truth 를 흔들지 않는다. recommendation 은 computed view 일 뿐이며,
 *    실제 주문 상태 mutation 은 useOrderQueueStore.finalizeApproval 경유만 허용.
 * 2. AI 가 대신 승인하지 않는다. 본 store 는 eligible 표시만 하고,
 *    markAccepted() 는 caller 가 사용자 클릭 후에 호출한다.
 * 3. Zustand store 지만 persistence 미사용 — 세션 internal state.
 * 4. 동일 procurementCaseId 로 evaluateItem 을 다시 부르면 publisher 가 drift 를
 *    감지해 stale 전이 이벤트를 발행하거나 재평가 결과를 반환한다.
 */
"use client";

import { create } from "zustand";
import type { FastTrackRecommendationObject } from "@/lib/ontology/types";
import {
  evaluateAndPublishFastTrack,
  publishFastTrackDismissed,
  type EvaluateAndPublishResult,
} from "@/lib/ontology/fast-track/fast-track-publisher";
import type { FastTrackEvaluationInput } from "@/lib/ontology/fast-track/fast-track-engine";

// ══════════════════════════════════════════════════════════════════════════════
// Acceptance Log — ActionLedger 소비용 read-only 기록
// ══════════════════════════════════════════════════════════════════════════════

export interface FastTrackAcceptanceLogEntry {
  /** 고유 id (procurementCaseId + acceptedAt) */
  id: string;
  procurementCaseId: string;
  vendorName: string;
  totalAmount: number;
  acceptedBy: string;
  acceptedAt: string;
  /** 수락 시점의 reason code 목록 (ActionLedger 서브라인 노출용) */
  reasonCodes: string[];
  /** 수락 시점의 recommendation objectId — audit 추적용 */
  recommendationObjectId: string;
}

// ══════════════════════════════════════════════════════════════════════════════
// Store state
// ══════════════════════════════════════════════════════════════════════════════

interface FastTrackState {
  /** procurementCaseId → 최신 recommendation (stale/dismissed/accepted 포함) */
  recommendations: Record<string, FastTrackRecommendationObject>;
  /** 마지막 evaluateItem() 호출 결과 (UI 디버깅/toast 용) */
  lastRecommendation: FastTrackRecommendationObject | null;
  /** 사용자가 일괄 승인으로 수락한 이력 (ActionLedger 데이터 소스) */
  acceptanceLog: FastTrackAcceptanceLogEntry[];

  // ── Evaluation ──
  /**
   * 단일 case 평가. 내부적으로 publisher 를 호출해 governance bus 이벤트를
   * 자동 발행한다. 결과 recommendation 은 store 에 캐시된다.
   */
  evaluateItem: (input: FastTrackEvaluationInput) => EvaluateAndPublishResult;
  /** 여러 case 를 한 번에 평가 (BOM/견적 도착 후 일괄 사용) */
  bulkEvaluate: (inputs: FastTrackEvaluationInput[]) => EvaluateAndPublishResult[];

  // ── Selection helpers ──
  /** eligible 상태인 recommendation 만 반환 (Queue Fast-Track 섹션 렌더링용) */
  getEligible: () => FastTrackRecommendationObject[];

  // ── User actions ──
  /**
   * 사용자가 일괄 승인 버튼 클릭 후 호출. recommendation 상태를 accepted 로
   * 전이하고 acceptanceLog 에 한 줄 추가. 실제 order state mutation 은
   * caller (orders page) 가 useOrderQueueStore.finalizeApproval 로 수행한다.
   *
   * caller 는 vendorName 을 명시 전달해야 한다 (evaluationSnapshot 에는
   * vendorId 만 있으므로 display-friendly label 을 store 에서 재유도하지 않는다).
   */
  markAccepted: (
    entries: Array<{ procurementCaseId: string; vendorName: string }>,
    actor: string,
  ) => FastTrackAcceptanceLogEntry[];

  /** 사용자가 명시적으로 권장을 거부 */
  dismissRecommendation: (
    input: FastTrackEvaluationInput,
    reason: string,
  ) => void;

  /** 특정 case 만 store 에서 제거 (fetch 무효화 경로) */
  clearRecommendation: (procurementCaseId: string) => void;
  /** 전체 초기화 (테스트/로그아웃 경로) */
  reset: () => void;
}

// ══════════════════════════════════════════════════════════════════════════════
// Store
// ══════════════════════════════════════════════════════════════════════════════

export const useFastTrackStore = create<FastTrackState>((set, get) => ({
  recommendations: {},
  lastRecommendation: null,
  acceptanceLog: [],

  evaluateItem: (input) => {
    const previous = get().recommendations[input.procurementCaseId] ?? null;
    const result = evaluateAndPublishFastTrack(input, previous);
    set((state) => ({
      recommendations: {
        ...state.recommendations,
        [input.procurementCaseId]: result.recommendation,
      },
      lastRecommendation: result.recommendation,
    }));
    return result;
  },

  bulkEvaluate: (inputs) => {
    // bulk 실행은 sequential 로 처리해 각 case 의 previous 가 이전 결과로
    // 덮이지 않도록 한다 (동일 case 의 중복 입력이 들어와도 마지막 결과만 반영).
    const results: EvaluateAndPublishResult[] = [];
    for (const input of inputs) {
      results.push(get().evaluateItem(input));
    }
    return results;
  },

  getEligible: () => {
    return Object.values(get().recommendations).filter(
      (r) => r.recommendationStatus === "eligible",
    );
  },

  markAccepted: (entries, actor) => {
    const now = new Date().toISOString();
    const accepted: FastTrackAcceptanceLogEntry[] = [];
    const recs = get().recommendations;

    for (const entry of entries) {
      const rec = recs[entry.procurementCaseId];
      if (!rec || rec.recommendationStatus !== "eligible") {
        // eligible 이 아닌 case 는 optimistic unlock 금지 — 조용히 스킵.
        continue;
      }
      accepted.push({
        id: `${entry.procurementCaseId}::${now}`,
        procurementCaseId: entry.procurementCaseId,
        vendorName: entry.vendorName,
        totalAmount: rec.evaluationSnapshot.totalAmount,
        acceptedBy: actor,
        acceptedAt: now,
        reasonCodes: rec.reasons.map((r) => r.code),
        recommendationObjectId: rec.objectId,
      });
    }

    if (accepted.length === 0) return [];

    set((state) => ({
      // 수락된 case 의 recommendation 상태를 accepted 로 전이 (Queue 섹션에서 사라짐)
      recommendations: {
        ...state.recommendations,
        ...Object.fromEntries(
          accepted.map((a) => [
            a.procurementCaseId,
            {
              ...state.recommendations[a.procurementCaseId],
              recommendationStatus: "accepted" as const,
              updatedAt: now,
            },
          ]),
        ),
      },
      acceptanceLog: [...accepted, ...state.acceptanceLog],
    }));

    return accepted;
  },

  dismissRecommendation: (input, reason) => {
    const prev = get().recommendations[input.procurementCaseId];
    if (!prev) return;
    publishFastTrackDismissed(input, prev, reason);
    set((state) => ({
      recommendations: {
        ...state.recommendations,
        [input.procurementCaseId]: {
          ...prev,
          recommendationStatus: "dismissed",
          updatedAt: new Date().toISOString(),
        },
      },
    }));
  },

  clearRecommendation: (procurementCaseId) => {
    set((state) => {
      const { [procurementCaseId]: _removed, ...rest } = state.recommendations;
      return { recommendations: rest };
    });
  },

  reset: () => set({ recommendations: {}, lastRecommendation: null, acceptanceLog: [] }),
}));
