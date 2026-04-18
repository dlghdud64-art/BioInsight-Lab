/**
 * Fast-Track Event Publisher
 *
 * 책임:
 * - evaluateFastTrack()의 결과를 governance event bus에 publish하는 얇은 오케스트레이터
 * - 이전 Recommendation 대비 상태 전이(not_eligible ↔ eligible, eligible → stale)를 감지해
 *   해당 이벤트 타입만 선택적으로 발행한다
 *
 * 고정 규칙:
 * 1. 본 모듈은 canonical truth를 흔들지 않는다. evaluateFastTrack의 deterministic 결과를
 *    그대로 반환하고, 변화가 있을 때만 publish한다.
 * 2. AI가 대신 행동하지 않는다. 이벤트는 UI 알림/Queue invalidate용이지 auto-approve 트리거 아님.
 * 3. 이전 상태 저장은 caller 책임이다. 본 모듈은 pure function 지향이라
 *    module-level 메모리에 무엇도 보관하지 않는다.
 * 4. 동일 입력 + 동일 previous → 동일 출력 (deterministic). 테스트 가능.
 * 5. 동일 eventId 재발행 방지는 governance-bridge의 dedupeKey가 처리하므로,
 *    본 publisher는 조건을 만족하면 publish한다. dedupe 책임을 지지 않는다.
 */

import {
  createGovernanceEvent,
  getGlobalGovernanceEventBus,
  type GovernanceDomain,
  type GovernanceEvent,
  type GovernanceEventSeverity,
} from "@/lib/ai/governance-event-bus";

import type { FastTrackRecommendationObject, FastTrackStatus } from "../types";

import {
  evaluateFastTrack,
  detectFastTrackSnapshotDrift,
  type FastTrackEvaluationInput,
} from "./fast-track-engine";

// ══════════════════════════════════════════════════════════════════════════════
// Constants
// ══════════════════════════════════════════════════════════════════════════════

const FAST_TRACK_DOMAIN: GovernanceDomain = "quote_chain";

/** 외부에 노출되는 event type 문자열 — governance-bridge의 매칭 키와 정확히 일치해야 함 */
export const FAST_TRACK_EVENT_TYPES = {
  eligible: "fast_track_eligible",
  stale: "fast_track_stale",
  notEligible: "fast_track_not_eligible",
  dismissed: "fast_track_dismissed",
} as const;

export type FastTrackEventType =
  (typeof FAST_TRACK_EVENT_TYPES)[keyof typeof FAST_TRACK_EVENT_TYPES];

// ══════════════════════════════════════════════════════════════════════════════
// Publisher API
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Fast-Track 평가를 수행하고 필요 시 governance event를 publish한다.
 *
 * @param input         평가 대상 input
 * @param previous      이전 Recommendation (없으면 최초 평가)
 * @returns             새 Recommendation + publish된 이벤트 목록
 */
export interface EvaluateAndPublishResult {
  /** 이번 평가 결과 — caller는 이것을 저장해 다음 호출의 previous로 전달한다 */
  recommendation: FastTrackRecommendationObject;
  /** 이번 호출에서 publish된 이벤트 (0~n개) */
  publishedEvents: GovernanceEvent[];
  /** 상태 전이가 실제로 발생했는지 */
  transitioned: boolean;
}

export function evaluateAndPublishFastTrack(
  input: FastTrackEvaluationInput,
  previous: FastTrackRecommendationObject | null,
): EvaluateAndPublishResult {
  // ── 1. drift 감지 (previous가 있을 때만) ────────────────────────────────────
  //
  // drift가 있으면 "stale"로 먼저 전이시키고, 그 후 새 평가를 수행한다.
  // stale 전환 이벤트는 별도로 발행한다 — Queue에서 기존 권장을 회수하도록.
  const events: GovernanceEvent[] = [];
  let effectivePrevious = previous;

  if (previous && previous.recommendationStatus === "eligible") {
    const drift = detectFastTrackSnapshotDrift(previous, input);
    if (drift.isStale) {
      const staleEvent = publishTransitionEvent({
        input,
        fromStatus: previous.recommendationStatus,
        toStatus: "stale",
        eventType: FAST_TRACK_EVENT_TYPES.stale,
        severity: "warning",
        detail: `Fast-Track 권장 무효화 — ${drift.reason}`,
        affectedObjectIds: collectAffectedObjectIds(input),
        payload: {
          previousObjectId: previous.objectId,
          driftReason: drift.reason,
        },
      });
      events.push(staleEvent);
      // drift가 있으면 previous를 없는 것으로 간주하고 재평가해야 함
      effectivePrevious = null;
    }
  }

  // ── 2. 새 평가 수행 ─────────────────────────────────────────────────────────
  const current = evaluateFastTrack(input);

  // ── 3. 상태 전이 감지 및 이벤트 발행 ────────────────────────────────────────
  const prevStatus: FastTrackStatus | "none" = effectivePrevious?.recommendationStatus ?? "none";
  const nextStatus = current.recommendationStatus;

  const transitionEvent = maybeBuildTransitionEvent({
    input,
    current,
    prevStatus,
    nextStatus,
  });

  if (transitionEvent) {
    events.push(transitionEvent);
  }

  return {
    recommendation: current,
    publishedEvents: events,
    transitioned: events.length > 0,
  };
}

/**
 * 사용자가 Fast-Track 권장을 거부(dismiss)했을 때 호출.
 * Recommendation status를 `dismissed`로 표시하고 이벤트 publish.
 * 실제 mutation은 caller가 수행한다 (본 함수는 이벤트만 만든다).
 */
export function publishFastTrackDismissed(
  input: FastTrackEvaluationInput,
  previous: FastTrackRecommendationObject,
  reason: string,
): GovernanceEvent {
  return publishTransitionEvent({
    input,
    fromStatus: previous.recommendationStatus,
    toStatus: "dismissed",
    eventType: FAST_TRACK_EVENT_TYPES.dismissed,
    severity: "info",
    detail: `Fast-Track 권장 거부 — ${reason}`,
    affectedObjectIds: collectAffectedObjectIds(input),
    payload: {
      previousObjectId: previous.objectId,
      dismissReason: reason,
    },
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// Internal helpers
// ══════════════════════════════════════════════════════════════════════════════

interface TransitionEventArgs {
  input: FastTrackEvaluationInput;
  fromStatus: string;
  toStatus: string;
  eventType: FastTrackEventType;
  severity: GovernanceEventSeverity;
  detail: string;
  affectedObjectIds: string[];
  payload: Record<string, unknown>;
}

function publishTransitionEvent(args: TransitionEventArgs): GovernanceEvent {
  const event = createGovernanceEvent(FAST_TRACK_DOMAIN, args.eventType, {
    caseId: args.input.procurementCaseId,
    poNumber: "", // Fast-Track은 PO 생성 전 단계
    fromStatus: args.fromStatus,
    toStatus: args.toStatus,
    actor: "fast_track_publisher",
    detail: args.detail,
    severity: args.severity,
    chainStage: null,
    affectedObjectIds: args.affectedObjectIds,
    payload: {
      source: "fast_track",
      procurementCaseId: args.input.procurementCaseId,
      vendorId: args.input.vendorId,
      vendorName: args.input.vendorName,
      totalAmount: args.input.totalAmount,
      ...args.payload,
    },
  });
  getGlobalGovernanceEventBus().publish(event);
  return event;
}

interface MaybeTransitionArgs {
  input: FastTrackEvaluationInput;
  current: FastTrackRecommendationObject;
  prevStatus: FastTrackStatus | "none";
  nextStatus: FastTrackStatus;
}

function maybeBuildTransitionEvent(args: MaybeTransitionArgs): GovernanceEvent | null {
  const { input, current, prevStatus, nextStatus } = args;

  // ── eligible 진입 ────────────────────────────────────────────────────────
  // 최초 평가(none) 또는 not_eligible/stale/dismissed에서 eligible로 전환
  const becameEligible =
    nextStatus === "eligible" &&
    (prevStatus === "none" || prevStatus === "not_eligible" || prevStatus === "stale" || prevStatus === "dismissed");

  if (becameEligible) {
    const reasonLine = current.reasons.map((r) => r.message).join(" · ");
    return publishTransitionEvent({
      input,
      fromStatus: prevStatus,
      toStatus: "eligible",
      eventType: FAST_TRACK_EVENT_TYPES.eligible,
      severity: "info",
      detail: `즉시 승인 가능 — ${input.vendorName} (${reasonLine || "기본 조건 충족"})`,
      affectedObjectIds: collectAffectedObjectIds(input),
      payload: {
        recommendationObjectId: current.objectId,
        safetyScore: current.safetyScore,
        reasonCodes: current.reasons.map((r) => r.code),
      },
    });
  }

  // ── not_eligible 진입 ────────────────────────────────────────────────────
  // eligible → not_eligible (drift 없이 조건만 바뀐 경우, 예: 수동 이력 데이터 보정)
  const becameNotEligible = nextStatus === "not_eligible" && prevStatus === "eligible";

  if (becameNotEligible) {
    const blockerLine = current.blockers.map((b) => b.message).join(" · ");
    return publishTransitionEvent({
      input,
      fromStatus: prevStatus,
      toStatus: "not_eligible",
      eventType: FAST_TRACK_EVENT_TYPES.notEligible,
      severity: "warning",
      detail: `Fast-Track 자격 상실 — ${blockerLine || "조건 미충족"}`,
      affectedObjectIds: collectAffectedObjectIds(input),
      payload: {
        recommendationObjectId: current.objectId,
        blockerCodes: current.blockers.map((b) => b.code),
      },
    });
  }

  // 나머지 경우(미변화 / none → not_eligible 등)는 publish 하지 않는다.
  return null;
}

function collectAffectedObjectIds(input: FastTrackEvaluationInput): string[] {
  return [
    `case:${input.procurementCaseId}`,
    `vendor:${input.vendorId}`,
    ...input.items.map((i) => `product:${i.productId}`),
  ];
}
