/**
 * Sent Outcome Workspace v2 — post-fire canonical sent truth review surface
 *
 * irreversible mutation 직후 첫 운영면.
 * sent_state_committed 이후 무엇이 실제로 커밋되었는지 읽고 정리.
 * dispatched ≠ sent. tracking/ack은 다음 단계.
 *
 * TRUTH CONTRACT (read-only surface):
 * - reads: SentStateRecordV2 (firedPayloadSnapshot, firedAuthorizationSnapshot, fireExecutionStatus)
 * - writes: 없음 — post-commit read + decision routing surface
 * - center: fired payload/recipient/authorization review + failure triage
 * - rail: commit snapshot evidence + channel response
 * - dock: tracking handoff / retry / correction routing
 * - forbidden: sent truth 재작성, tracking/ack truth 미리 확정
 */

import type { SentStateRecordV2, FiredPayloadSnapshotV2, FiredAuthorizationSnapshotV2, FireExecutionStatus, FireFailureClass } from "./actual-send-fired-transaction-v2-engine";

// ── Workspace Status ──
export type SentOutcomeWorkspaceStatus = "reviewing_sent_outcome" | "sent_outcome_verified" | "sent_outcome_with_issues" | "sent_outcome_failed" | "tracking_handoff_ready" | "correction_required";

// ── Sent Outcome Review Section ──
export type SentOutcomeSectionKey = "fired_payload_review" | "fired_recipient_review" | "fired_authorization_audit_review" | "channel_response_review" | "failure_triage_review" | "tracking_handoff_readiness_review";
export type SentOutcomeSectionStatus = "ready" | "warning" | "blocked" | "attention_required" | "verified";

export interface SentOutcomeCheckSectionStateV2 {
  sectionKey: SentOutcomeSectionKey; sectionTitle: string; sectionStatus: SentOutcomeSectionStatus; priorityRank: number;
  reviewIntent: string; whyThisMatters: string;
  resolvedItems: string[]; unresolvedItems: string[]; warnings: string[];
  operatorActionRequired: string; canResolveInPlace: boolean; nextBestActionLabel: string;
}

// ── Sent Outcome State ──
export interface SentOutcomeWorkspaceStateV2 {
  workspaceId: string; caseId: string; handoffPackageId: string; sentStateRecordId: string;
  workspaceStatus: SentOutcomeWorkspaceStatus;
  fireExecutionStatus: FireExecutionStatus; failureClass: FireFailureClass | null;
  sentStateCommitted: boolean; dispatched: false; trackingCreated: false; supplierAckReceived: false;
  firedPayloadSnapshot: FiredPayloadSnapshotV2; firedAuthorizationSnapshot: FiredAuthorizationSnapshotV2;
  checkSectionStates: SentOutcomeCheckSectionStateV2[];
  activeSectionKey: SentOutcomeSectionKey | null;
  operatorFocusOrder: SentOutcomeSectionKey[];
  canProceedToTrackingHandoff: boolean; canRetryFire: boolean; canRouteToCorrection: boolean;
  operatorReviewNote: string;
  generatedAt: string;
}

const META: Record<SentOutcomeSectionKey, { title: string; intent: string; risk: string }> = {
  fired_payload_review: { title: "발송된 Payload 검토", intent: "실제 발송된 supplier-facing payload snapshot 검토", risk: "발송된 내용과 의도한 내용 불일치 시 대응 지연" },
  fired_recipient_review: { title: "발송 수신자 검토", intent: "실제 발송된 수신자/contact 확인", risk: "잘못된 수신자로 발송 시 복구 불가" },
  fired_authorization_audit_review: { title: "발송 Authorization / Audit 검토", intent: "발송 actor/authorization/audit chain 확인", risk: "Actor trace gap 시 사후 추적 불가" },
  channel_response_review: { title: "Channel Response 검토", intent: "전송 채널의 응답/receipt 확인", risk: "전송 실패 미감지 시 tracking 누락" },
  failure_triage_review: { title: "Failure Triage 검토", intent: "발송 실패 여부 분류 및 retry/correction 판단", risk: "실패 미분류 시 복구 경로 불명확" },
  tracking_handoff_readiness_review: { title: "Tracking Handoff 준비 검토", intent: "delivery tracking 단계로 넘길 수 있는지 확인", risk: "미준비 상태에서 tracking 진입 시 tracking truth 오염" },
};

function buildSentOutcomeSection(key: SentOutcomeSectionKey, rank: number, record: SentStateRecordV2): SentOutcomeCheckSectionStateV2 {
  const m = META[key]; const resolved: string[] = []; const unresolved: string[] = []; const warnings: string[] = [];

  switch (key) {
    case "fired_payload_review":
      if (record.firedPayloadSnapshot.vendorId) resolved.push("vendorId"); else unresolved.push("vendorId");
      if (record.firedPayloadSnapshot.lineItemCount > 0) resolved.push("lineItems"); else unresolved.push("lineItems");
      if (record.firedPayloadSnapshot.internalOnlyExcludedCount > 0) resolved.push("exclusion confirmed");
      break;
    case "fired_recipient_review":
      if (record.firedPayloadSnapshot.recipientContact) resolved.push("recipient contact"); else unresolved.push("recipient contact");
      if (record.firedPayloadSnapshot.vendorId) resolved.push("vendor"); else unresolved.push("vendor");
      break;
    case "fired_authorization_audit_review":
      if (record.firedAuthorizationSnapshot.auditChainIntact) resolved.push("audit chain");
      if (record.firedAuthorizationSnapshot.provenanceLineageComplete) resolved.push("provenance");
      if (record.firedAuthorizationSnapshot.exclusionGuardConfirmed) resolved.push("exclusion guard");
      if (!record.firedAuthorizationSnapshot.auditChainIntact) unresolved.push("audit chain broken");
      break;
    case "channel_response_review":
      if (record.fireExecutionStatus === "fire_success") resolved.push("fire success");
      else warnings.push(`fire status: ${record.fireExecutionStatus}`);
      break;
    case "failure_triage_review":
      if (record.fireExecutionStatus === "fire_success") resolved.push("no failure");
      else if (record.failureClass) unresolved.push(`failure: ${record.failureClass}`);
      break;
    case "tracking_handoff_readiness_review":
      if (record.sentStateCommitted && record.fireExecutionStatus === "fire_success") resolved.push("sent committed + fire success");
      else unresolved.push("sent state not committed or fire not success");
      if (!record.trackingCreated) resolved.push("tracking not yet created — clean handoff possible");
      break;
  }

  const status: SentOutcomeSectionStatus = unresolved.length > 0 ? "blocked" : warnings.length > 0 ? "warning" : "verified";
  return { sectionKey: key, sectionTitle: m.title, sectionStatus: status, priorityRank: rank, reviewIntent: m.intent, whyThisMatters: m.risk, resolvedItems: resolved, unresolvedItems: unresolved, warnings, operatorActionRequired: unresolved.length > 0 ? `${m.title} 미해결 항목 확인` : warnings.length > 0 ? `${m.title} 경고 검토` : `${m.title} 확인 완료`, canResolveInPlace: unresolved.length === 0, nextBestActionLabel: unresolved.length > 0 ? `${m.title} 해소` : `${m.title} 완료` };
}

export function buildSentOutcomeWorkspaceStateV2(record: SentStateRecordV2): SentOutcomeWorkspaceStateV2 {
  const sections = ([
    "fired_payload_review", "fired_recipient_review", "fired_authorization_audit_review",
    "channel_response_review", "failure_triage_review", "tracking_handoff_readiness_review",
  ] as SentOutcomeSectionKey[]).map((key, i) => buildSentOutcomeSection(key, i + 1, record));

  const hasBlocker = sections.some(s => s.sectionStatus === "blocked");
  const hasWarning = sections.some(s => s.sectionStatus === "warning");
  const allVerified = sections.every(s => s.sectionStatus === "verified");
  const isFailed = record.fireExecutionStatus !== "fire_success";

  const status: SentOutcomeWorkspaceStatus =
    isFailed ? "sent_outcome_failed"
    : hasBlocker ? "sent_outcome_with_issues"
    : allVerified ? "tracking_handoff_ready"
    : hasWarning ? "sent_outcome_with_issues"
    : "reviewing_sent_outcome";

  const focus: SentOutcomeSectionKey[] = [];
  const blocked = sections.filter(s => s.sectionStatus === "blocked").map(s => s.sectionKey);
  const warned = sections.filter(s => s.sectionStatus === "warning").map(s => s.sectionKey);
  const rest = sections.filter(s => !blocked.includes(s.sectionKey) && !warned.includes(s.sectionKey)).map(s => s.sectionKey);
  focus.push(...blocked, ...warned, ...rest);

  return {
    workspaceId: `sentws_${Date.now().toString(36)}`, caseId: record.caseId, handoffPackageId: record.handoffPackageId, sentStateRecordId: record.sentStateRecordId,
    workspaceStatus: status, fireExecutionStatus: record.fireExecutionStatus, failureClass: record.failureClass,
    sentStateCommitted: record.sentStateCommitted, dispatched: false, trackingCreated: false, supplierAckReceived: false,
    firedPayloadSnapshot: record.firedPayloadSnapshot, firedAuthorizationSnapshot: record.firedAuthorizationSnapshot,
    checkSectionStates: sections, activeSectionKey: focus[0] || null, operatorFocusOrder: focus,
    canProceedToTrackingHandoff: allVerified && record.sentStateCommitted && record.fireExecutionStatus === "fire_success",
    canRetryFire: isFailed && (record.failureClass === "transport_channel_failure" || record.failureClass === "timeout" || record.failureClass === "system_failure"),
    canRouteToCorrection: hasBlocker,
    operatorReviewNote: "", generatedAt: new Date().toISOString(),
  };
}

export type SentOutcomeEventType = "sent_outcome_workspace_opened" | "sent_outcome_section_reviewed" | "sent_outcome_verified" | "sent_outcome_failure_triaged" | "sent_outcome_tracking_handoff_ready" | "sent_outcome_correction_routed" | "sent_outcome_retry_requested";
export interface SentOutcomeEvent { type: SentOutcomeEventType; caseId: string; sentStateRecordId: string; workspaceId: string; sectionKeyIfAny: SentOutcomeSectionKey | null; reason: string; actor: string; timestamp: string; }
export function createSentOutcomeEvent(type: SentOutcomeEventType, ws: SentOutcomeWorkspaceStateV2, sectionKey: SentOutcomeSectionKey | null, reason: string, actor: string): SentOutcomeEvent { return { type, caseId: ws.caseId, sentStateRecordId: ws.sentStateRecordId, workspaceId: ws.workspaceId, sectionKeyIfAny: sectionKey, reason, actor, timestamp: new Date().toISOString() }; }
