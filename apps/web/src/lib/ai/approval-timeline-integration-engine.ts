/**
 * Approval Timeline Integration Engine — approval event를 stage timeline에 연결
 *
 * 모든 approval lifecycle event를 DispatchV2StageTimeline에 canonical하게 기록.
 * operator가 "왜 막혔는지 / 왜 재승인인지 / 누가 승인했는지"를 timeline에서 확인 가능.
 *
 * 기록 대상 9종:
 * 1. approval_requested — 승인 요청 생성
 * 2. approval_blocked — 정책/역할에 의해 차단
 * 3. approval_granted — 승인 완료 (snapshot 발급)
 * 4. self_approval_denied — Tier 3 self-approve 차단
 * 5. snapshot_invalidated — payload/policy hash 불일치로 무효화
 * 6. reapproval_required — 재승인 요청
 * 7. snapshot_consumed — snapshot 소비 (실행 unlock)
 * 8. execution_unlocked — fire/release/recovery 실행 해금
 * 9. approval_expired_unused — 미사용 snapshot 만료
 */

import type { DispatchV2StageTimeline, StageTransitionEntry, StageTransitionType } from "./dispatch-v2-stage-timeline-v2-engine";
import { addTransitionEntry } from "./dispatch-v2-stage-timeline-v2-engine";
import type { StageActionKey } from "./dispatch-v2-permission-policy-engine";

// ── Approval Timeline Event Type ──
export type ApprovalTimelineEventType =
  | "approval_requested"
  | "approval_blocked"
  | "approval_granted"
  | "self_approval_denied"
  | "snapshot_invalidated"
  | "reapproval_required"
  | "snapshot_consumed"
  | "execution_unlocked"
  | "approval_expired_unused";

// ── Approval Timeline Entry ──
export interface ApprovalTimelineEntry {
  eventType: ApprovalTimelineEventType;
  caseId: string;
  actionKey: StageActionKey;
  stage: string;
  actorId: string;
  targetActorId: string | null;
  snapshotId: string | null;
  reason: string;
  policyConstraints: string[];
  sodViolations: string[];
  timestamp: string;
}

// ── Map approval event → stage transition type ──
const APPROVAL_TO_TRANSITION_TYPE: Record<ApprovalTimelineEventType, StageTransitionType> = {
  approval_requested: "normal_advance",
  approval_blocked: "gate_blocked",
  approval_granted: "gate_passed",
  self_approval_denied: "gate_blocked",
  snapshot_invalidated: "gate_blocked",
  reapproval_required: "gate_blocked",
  snapshot_consumed: "normal_advance",
  execution_unlocked: "gate_passed",
  approval_expired_unused: "gate_blocked",
};

/**
 * recordApprovalEvent — approval event를 stage timeline에 추가
 */
export function recordApprovalEvent(
  timeline: DispatchV2StageTimeline,
  entry: ApprovalTimelineEntry,
): DispatchV2StageTimeline {
  const transitionType = APPROVAL_TO_TRANSITION_TYPE[entry.eventType];

  const transitionEntry: Omit<StageTransitionEntry, "entryId"> = {
    caseId: entry.caseId,
    sentStateRecordId: null,
    fromStage: `approval:${entry.stage}`,
    toStage: getToStage(entry),
    transitionType,
    gateId: null,
    sessionId: entry.snapshotId,
    actor: entry.actorId,
    timestamp: entry.timestamp,
    reason: `[${entry.eventType}] ${entry.reason}`,
    blockerSummary: entry.eventType === "approval_blocked" || entry.eventType === "self_approval_denied"
      ? [...entry.policyConstraints, ...entry.sodViolations]
      : [],
    warningSummary: [],
    invariantChecked: null,
    invariantResult: "not_applicable",
    lineRefsAffected: [],
    recoveryRecordId: null,
  };

  return addTransitionEntry(timeline, transitionEntry);
}

function getToStage(entry: ApprovalTimelineEntry): string {
  switch (entry.eventType) {
    case "approval_granted":
    case "snapshot_consumed":
    case "execution_unlocked":
      return `approved:${entry.stage}`;
    case "approval_blocked":
    case "self_approval_denied":
    case "snapshot_invalidated":
    case "reapproval_required":
    case "approval_expired_unused":
      return `blocked:${entry.stage}`;
    case "approval_requested":
      return `pending_approval:${entry.stage}`;
    default:
      return entry.stage;
  }
}

/**
 * getApprovalHistory — timeline에서 approval 관련 entry만 추출
 */
export function getApprovalHistory(timeline: DispatchV2StageTimeline): StageTransitionEntry[] {
  return timeline.entries.filter(e =>
    e.fromStage.startsWith("approval:") ||
    e.toStage.startsWith("approved:") ||
    e.toStage.startsWith("blocked:") ||
    e.toStage.startsWith("pending_approval:")
  );
}

/**
 * getApprovalBlockedReasons — 특정 stage에서 approval이 막힌 이유들
 */
export function getApprovalBlockedReasons(timeline: DispatchV2StageTimeline, stage: string): string[] {
  return timeline.entries
    .filter(e => e.fromStage === `approval:${stage}` && (e.transitionType === "gate_blocked"))
    .flatMap(e => e.blockerSummary);
}

/**
 * wasApprovalGranted — 특정 stage에서 approval이 성공했는지
 */
export function wasApprovalGranted(timeline: DispatchV2StageTimeline, stage: string): boolean {
  return timeline.entries.some(e =>
    e.toStage === `approved:${stage}` && e.transitionType === "gate_passed"
  );
}

/**
 * getSnapshotConsumedEvents — snapshot 소비 이력
 */
export function getSnapshotConsumedEvents(timeline: DispatchV2StageTimeline): StageTransitionEntry[] {
  return timeline.entries.filter(e =>
    e.reason.includes("[snapshot_consumed]") || e.reason.includes("[execution_unlocked]")
  );
}
