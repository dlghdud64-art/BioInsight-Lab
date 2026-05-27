/**
 * Delivery Tracking Handoff Gate v2 — sent outcome → tracking entry eligibility
 *
 * sent_state_committed + tracking_handoff_ready → tracking 단계 진입 판정.
 * tracking ≠ supplier ack. 외부 전달 상태 추적 체인 시작점.
 */

import type { SentOutcomeWorkspaceStateV2, SentOutcomeWorkspaceStatus } from "./sent-outcome-workspace-v2";
import type { SentStateRecordV2 } from "./actual-send-fired-transaction-v2-engine";

export type TrackingHandoffGateStatus = "not_eligible" | "sent_outcome_dependency_open" | "eligible_for_tracking_entry" | "tracking_locked_by_policy" | "tracking_entry_opened";
export type TrackingHandoffGatePhase = "precheck" | "eligibility_review" | "entry_pending" | "entry_enabled" | "entry_open" | "policy_locked";

export type TrackingPreconditionKey = "sent_state_committed" | "fire_execution_success" | "sent_outcome_verified" | "no_unresolved_sent_issues" | "payload_snapshot_available" | "recipient_snapshot_available" | "channel_response_available" | "authorization_audit_verified";

export interface TrackingPreconditionResultV2 { preconditionKey: TrackingPreconditionKey; label: string; status: "satisfied" | "unsatisfied"; reasonIfUnsatisfied: string; derivedFrom: string; blockingLevel: "hard_blocker" | "soft_blocker" | "warning"; }

export type TrackingCandidateStatus = "not_candidate" | "candidate_with_blockers" | "candidate_with_warnings" | "candidate_ready_for_entry" | "candidate_entry_locked";

export interface TrackingEntryCandidateV2 { candidateStatus: TrackingCandidateStatus; candidateReason: string; sentStateCommitted: boolean; trackingCreated: boolean; canOpenTrackingWorkspace: boolean; canOnlyPreview: boolean; }

export interface DeliveryTrackingHandoffGateV2 {
  trackingHandoffGateId: string; caseId: string; handoffPackageId: string; sentStateRecordId: string;
  gateStatus: TrackingHandoffGateStatus; gatePhase: TrackingHandoffGatePhase;
  candidate: TrackingEntryCandidateV2;
  blockers: string[]; warnings: string[];
  requiredPreconditions: TrackingPreconditionResultV2[]; unsatisfiedPreconditions: TrackingPreconditionResultV2[];
  trackingStatus: "not_created"; supplierAckStatus: "not_received";
  nextSurfaceLabel: string; generatedAt: string;
}

export function buildDeliveryTrackingHandoffGateV2(sentOutcome: SentOutcomeWorkspaceStateV2, record: SentStateRecordV2): DeliveryTrackingHandoffGateV2 {
  const precs: TrackingPreconditionResultV2[] = [];
  precs.push({ preconditionKey: "sent_state_committed", label: "Sent state committed", status: record.sentStateCommitted ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: !record.sentStateCommitted ? "Sent state 미커밋" : "", derivedFrom: "sentStateRecord", blockingLevel: "hard_blocker" });
  precs.push({ preconditionKey: "fire_execution_success", label: "Fire execution 성공", status: record.fireExecutionStatus === "fire_success" ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: record.fireExecutionStatus !== "fire_success" ? `Fire status: ${record.fireExecutionStatus}` : "", derivedFrom: "sentStateRecord", blockingLevel: "hard_blocker" });
  precs.push({ preconditionKey: "sent_outcome_verified", label: "Sent outcome 검증됨", status: sentOutcome.workspaceStatus === "tracking_handoff_ready" ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: sentOutcome.workspaceStatus !== "tracking_handoff_ready" ? `Outcome status: ${sentOutcome.workspaceStatus}` : "", derivedFrom: "sentOutcomeWorkspace", blockingLevel: "hard_blocker" });
  precs.push({ preconditionKey: "no_unresolved_sent_issues", label: "미해결 sent 이슈 없음", status: sentOutcome.canProceedToTrackingHandoff ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: !sentOutcome.canProceedToTrackingHandoff ? "Sent outcome 미해결 이슈" : "", derivedFrom: "sentOutcomeWorkspace", blockingLevel: "hard_blocker" });
  precs.push({ preconditionKey: "payload_snapshot_available", label: "Payload snapshot 가용", status: record.firedPayloadSnapshot.vendorId ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: !record.firedPayloadSnapshot.vendorId ? "Payload snapshot 없음" : "", derivedFrom: "firedPayloadSnapshot", blockingLevel: "soft_blocker" });
  precs.push({ preconditionKey: "recipient_snapshot_available", label: "Recipient snapshot 가용", status: record.firedPayloadSnapshot.recipientContact ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: !record.firedPayloadSnapshot.recipientContact ? "Recipient 없음" : "", derivedFrom: "firedPayloadSnapshot", blockingLevel: "soft_blocker" });
  precs.push({ preconditionKey: "channel_response_available", label: "Channel response 확인", status: record.fireExecutionStatus === "fire_success" ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: record.fireExecutionStatus !== "fire_success" ? "Channel response 없음" : "", derivedFrom: "fireExecution", blockingLevel: "warning" });
  precs.push({ preconditionKey: "authorization_audit_verified", label: "Authorization/audit 검증됨", status: record.firedAuthorizationSnapshot.auditChainIntact ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: !record.firedAuthorizationSnapshot.auditChainIntact ? "Audit chain 미검증" : "", derivedFrom: "firedAuthorizationSnapshot", blockingLevel: "warning" });

  const unsatisfied = precs.filter(p => p.status === "unsatisfied");
  const blockers = unsatisfied.filter(p => p.blockingLevel === "hard_blocker" || p.blockingLevel === "soft_blocker").map(p => p.reasonIfUnsatisfied);
  const warnings = unsatisfied.filter(p => p.blockingLevel === "warning").map(p => p.reasonIfUnsatisfied);

  const canOpen = blockers.length === 0 && sentOutcome.canProceedToTrackingHandoff;
  const candidateStatus: TrackingCandidateStatus = !sentOutcome.canProceedToTrackingHandoff ? "not_candidate" : blockers.length > 0 ? "candidate_with_blockers" : warnings.length > 0 ? "candidate_with_warnings" : "candidate_ready_for_entry";

  const gateStatus: TrackingHandoffGateStatus = !sentOutcome.canProceedToTrackingHandoff ? "not_eligible" : blockers.length > 0 ? "sent_outcome_dependency_open" : "eligible_for_tracking_entry";

  return { trackingHandoffGateId: `trkhgate_${Date.now().toString(36)}`, caseId: record.caseId, handoffPackageId: record.handoffPackageId, sentStateRecordId: record.sentStateRecordId, gateStatus, gatePhase: canOpen ? "entry_enabled" : "precheck", candidate: { candidateStatus, candidateReason: blockers.length > 0 ? blockers[0] : canOpen ? "Tracking entry 가능" : "Sent outcome 미준비", sentStateCommitted: record.sentStateCommitted, trackingCreated: false, canOpenTrackingWorkspace: canOpen, canOnlyPreview: !canOpen && sentOutcome.sentStateCommitted }, blockers, warnings, requiredPreconditions: precs, unsatisfiedPreconditions: unsatisfied, trackingStatus: "not_created", supplierAckStatus: "not_received", nextSurfaceLabel: canOpen ? "Delivery Tracking Workspace (Entry Enabled)" : "Delivery Tracking Workspace (Locked Preview Only)", generatedAt: new Date().toISOString() };
}

export type TrackingHandoffEventType = "delivery_tracking_handoff_gate_computed" | "delivery_tracking_entry_eligible" | "delivery_tracking_entry_blocked" | "delivery_tracking_entry_enabled";
export interface TrackingHandoffEvent { type: TrackingHandoffEventType; caseId: string; sentStateRecordId: string; gateId: string; reason: string; actor: string; timestamp: string; }
export function createTrackingHandoffEvent(type: TrackingHandoffEventType, gate: DeliveryTrackingHandoffGateV2, reason: string, actor: string): TrackingHandoffEvent { return { type, caseId: gate.caseId, sentStateRecordId: gate.sentStateRecordId, gateId: gate.trackingHandoffGateId, reason, actor, timestamp: new Date().toISOString() }; }
