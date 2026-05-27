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
  /**
   * procurementCaseId → 평가 당시의 input snapshot.
   *
   * dismiss / drift 재평가 경로에서 caller 가 input 을 다시 조립하지 않아도
   * 되도록 store 가 canonical evaluation input 을 함께 보관한다.
   * recommendation 객체와 1:1 관계이며, 동일 case 의 재평가 시 덮어쓰인다.
   */
  inputSnapshots: Record<string, FastTrackEvaluationInput>;
  /** 마지막 evaluateItem() 호출 결과 (UI 디버깅/toast 용) */
  lastRecommendation: FastTrackRecommendationObject | null;
  /** 사용자가 일괄 승인으로 수락한 이력 (ActionLedger 데이터 소스) */
  acceptanceLog: FastTrackAcceptanceLogEntry[];
  /**
   * 이미 Ledger 에 기록한 recommendationObjectId 집합.
   *
   * 동일 case 가 stale → eligible 루프를 돌아 다시 accepted 로 전이되어도
   * objectId 는 평가 시각 단위로 새로 생성되므로 legit 재승인과 중복 기록을
   * 구분할 수 있다. markAccepted 는 이 집합을 consult 해 중복 append 를 차단한다.
   */
  loggedRecommendationObjectIds: Set<string>;

  // ── Evaluation ──
  /**
   * 단일 case 평가. 내부적으로 publisher 를 호출해 governance bus 이벤트를
   * 자동 발행한다. 결과 recommendation 과 evaluation input 은 store 에 캐시된다.
   */
  evaluateItem: (input: FastTrackEvaluationInput) => EvaluateAndPublishResult;
  /** 여러 case 를 한 번에 평가 (BOM/견적 도착 후 일괄 사용) */
  bulkEvaluate: (inputs: FastTrackEvaluationInput[]) => EvaluateAndPublishResult[];

  // ── Selection helpers ──
  /** eligible 상태인 recommendation 만 반환 (Queue Fast-Track 섹션 렌더링용) */
  getEligible: () => FastTrackRecommendationObject[];
  /** store 가 보관 중인 input snapshot 을 반환 (없으면 null) */
  getInputSnapshot: (procurementCaseId: string) => FastTrackEvaluationInput | null;

  // ── User actions ──
  /**
   * 사용자가 일괄 승인 버튼 클릭 후 호출. recommendation 상태를 accepted 로
   * 전이하고 acceptanceLog 에 한 줄 추가. 실제 order state mutation 은
   * caller (orders page) 가 useOrderQueueStore.finalizeApproval 로 수행한다.
   *
   * Dedup 규칙: 동일 recommendationObjectId 는 한 번만 Ledger 에 기록된다.
   * (stale → eligible 루프가 돌아 다시 accepted 되어도 objectId 가 같으면 skip.
   *  drift 재평가로 새 objectId 가 부여되면 legit 재승인으로 간주해 허용한다.)
   *
   * caller 는 vendorName 을 명시 전달해야 한다 (evaluationSnapshot 에는
   * vendorId 만 있으므로 display-friendly label 을 store 에서 재유도하지 않는다).
   */
  markAccepted: (
    entries: Array<{ procurementCaseId: string; vendorName: string }>,
    actor: string,
  ) => FastTrackAcceptanceLogEntry[];

  /**
   * 사용자가 명시적으로 권장을 거부.
   *
   * 기존에는 caller 가 input 을 재조립해서 넘겼지만, 이제 store 가 보관한
   * inputSnapshot 을 사용하므로 procurementCaseId 만 전달하면 된다.
   */
  dismissRecommendation: (procurementCaseId: string, reason: string) => void;

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
  inputSnapshots: {},
  lastRecommendation: null,
  acceptanceLog: [],
  loggedRecommendationObjectIds: new Set<string>(),

  evaluateItem: (input) => {
    const previous = get().recommendations[input.procurementCaseId] ?? null;
    const result = evaluateAndPublishFastTrack(input, previous);
    set((state) => ({
      recommendations: {
        ...state.recommendations,
        [input.procurementCaseId]: result.recommendation,
      },
      inputSnapshots: {
        ...state.inputSnapshots,
        [input.procurementCaseId]: input,
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

  getInputSnapshot: (procurementCaseId) => {
    return get().inputSnapshots[procurementCaseId] ?? null;
  },

  markAccepted: (entries, actor) => {
    const now = new Date().toISOString();
    const accepted: FastTrackAcceptanceLogEntry[] = [];
    const state = get();
    const recs = state.recommendations;
    const alreadyLogged = state.loggedRecommendationObjectIds;

    for (const entry of entries) {
      const rec = recs[entry.procurementCaseId];
      if (!rec || rec.recommendationStatus !== "eligible") {
        // eligible 이 아닌 case 는 optimistic unlock 금지 — 조용히 스킵.
        continue;
      }
      // Dedup: 동일 recommendationObjectId 가 이미 Ledger 에 기록됐다면
      // stale → eligible → accepted 루프의 잔상이므로 append 를 차단한다.
      // (drift 재평가로 새 objectId 가 부여된 경우는 여기를 통과함)
      if (alreadyLogged.has(rec.objectId)) {
        continue;
      }
      accepted.push({
        id: `${entry.procurementCaseId}::${rec.objectId}`,
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

    set((prev) => {
      const nextLogged = new Set(prev.loggedRecommendationObjectIds);
      accepted.forEach((a) => nextLogged.add(a.recommendationObjectId));
      return {
        // 수락된 case 의 recommendation 상태를 accepted 로 전이 (Queue 섹션에서 사라짐)
        recommendations: {
          ...prev.recommendations,
          ...Object.fromEntries(
            accepted.map((a) => [
              a.procurementCaseId,
              {
                ...prev.recommendations[a.procurementCaseId],
                recommendationStatus: "accepted" as const,
                updatedAt: now,
              },
            ]),
          ),
        },
        acceptanceLog: [...accepted, ...prev.acceptanceLog],
        loggedRecommendationObjectIds: nextLogged,
      };
    });

    return accepted;
  },

  dismissRecommendation: (procurementCaseId, reason) => {
    const state = get();
    const prev = state.recommendations[procurementCaseId];
    if (!prev) return;
    const input = state.inputSnapshots[procurementCaseId];
    if (!input) {
      // snapshot 이 없으면 publish 하지 않는다 — caller 가 evaluateItem 을
      // 먼저 호출하지 않은 경로이므로 조용히 스킵한다.
      return;
    }
    publishFastTrackDismissed(input, prev, reason);
    set((s) => ({
      recommendations: {
        ...s.recommendations,
        [procurementCaseId]: {
          ...prev,
          recommendationStatus: "dismissed",
          updatedAt: new Date().toISOString(),
        },
      },
    }));
  },

  clearRecommendation: (procurementCaseId) => {
    set((state) => {
      const { [procurementCaseId]: _removedRec, ...restRecs } = state.recommendations;
      const { [procurementCaseId]: _removedInput, ...restInputs } = state.inputSnapshots;
      return { recommendations: restRecs, inputSnapshots: restInputs };
    });
  },

  reset: () =>
    set({
      recommendations: {},
      inputSnapshots: {},
      lastRecommendation: null,
      acceptanceLog: [],
      loggedRecommendationObjectIds: new Set<string>(),
    }),
}));
