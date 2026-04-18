/**
 * Supplier Acknowledgment Handoff Gate v2 — tracking → supplier ack entry eligibility
 *
 * delivery tracking과 supplier acknowledgment는 다른 층.
 * tracking = 전달 상태 추적, ack = 상대방 수신/확인/회신 의사 이벤트.
 */

import type { DeliveryTrackingWorkspaceStateV2, DeliveryTrackingRecordV2, DeliveryStatus } from "./delivery-tracking-workspace-v2";
import type { SentStateRecordV2 } from "./actual-send-fired-transaction-v2-engine";

export type SupplierAckHandoffGateStatus = "not_eligible" | "tracking_dependency_open" | "eligible_for_supplier_ack_entry" | "supplier_ack_locked_by_policy" | "supplier_ack_entry_opened";

export type SupplierAckPreconditionKey = "sent_state_committed" | "tracking_created" | "delivery_status_acceptable" | "no_tracking_exception_unresolved" | "payload_snapshot_available" | "recipient_confirmed";

export interface SupplierAckPreconditionResultV2 { preconditionKey: SupplierAckPreconditionKey; label: string; status: "satisfied" | "unsatisfied"; reasonIfUnsatisfied: string; blockingLevel: "hard_blocker" | "soft_blocker" | "warning"; }

export type SupplierAckCandidateStatus = "not_candidate" | "candidate_with_blockers" | "candidate_with_warnings" | "candidate_ready_for_entry";

export interface SupplierAckHandoffGateV2 {
  supplierAckHandoffGateId: string; caseId: string; sentStateRecordId: string; trackingRecordId: string | null;
  gateStatus: SupplierAckHandoffGateStatus;
  candidateStatus: SupplierAckCandidateStatus; candidateReason: string;
  blockers: string[]; warnings: string[];
  requiredPreconditions: SupplierAckPreconditionResultV2[]; unsatisfiedPreconditions: SupplierAckPreconditionResultV2[];
  canOpenSupplierAckWorkspace: boolean;
  supplierAckStatus: "not_received"; nextSurfaceLabel: string; generatedAt: string;
}

export function buildSupplierAckHandoffGateV2(trackingWs: DeliveryTrackingWorkspaceStateV2, record: SentStateRecordV2, trackingRecord: DeliveryTrackingRecordV2 | null): SupplierAckHandoffGateV2 {
  const precs: SupplierAckPreconditionResultV2[] = [];
  precs.push({ preconditionKey: "sent_state_committed", label: "Sent state committed", status: record.sentStateCommitted ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: !record.sentStateCommitted ? "Sent 미커밋" : "", blockingLevel: "hard_blocker" });
  precs.push({ preconditionKey: "tracking_created", label: "Tracking 생성됨", status: trackingRecord ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: !trackingRecord ? "Tracking 미생성" : "", blockingLevel: "soft_blocker" });

  const acceptableStatuses: DeliveryStatus[] = ["in_transit", "delivered", "delivery_attempted"];
  const deliveryOk = trackingRecord && acceptableStatuses.includes(trackingRecord.deliveryStatus);
  precs.push({ preconditionKey: "delivery_status_acceptable", label: "Delivery 상태 허용 범위", status: deliveryOk ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: !deliveryOk ? `Delivery status: ${trackingRecord?.deliveryStatus ?? "no tracking"}` : "", blockingLevel: "soft_blocker" });

  const noException = !trackingRecord?.trackingException;
  precs.push({ preconditionKey: "no_tracking_exception_unresolved", label: "Tracking exception 없음", status: noException ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: !noException ? "Tracking exception 미해소" : "", blockingLevel: "warning" });

  precs.push({ preconditionKey: "payload_snapshot_available", label: "Payload snapshot 가용", status: record.firedPayloadSnapshot.vendorId ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: !record.firedPayloadSnapshot.vendorId ? "Payload 없음" : "", blockingLevel: "warning" });
  precs.push({ preconditionKey: "recipient_confirmed", label: "Recipient 확인됨", status: record.firedPayloadSnapshot.recipientContact ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: !record.firedPayloadSnapshot.recipientContact ? "Recipient 없음" : "", blockingLevel: "warning" });

  const unsatisfied = precs.filter(p => p.status === "unsatisfied");
  const blockers = unsatisfied.filter(p => p.blockingLevel === "hard_blocker" || p.blockingLevel === "soft_blocker").map(p => p.reasonIfUnsatisfied);
  const warnings = unsatisfied.filter(p => p.blockingLevel === "warning").map(p => p.reasonIfUnsatisfied);
  const canOpen = blockers.length === 0 && record.sentStateCommitted;
  const candidateStatus: SupplierAckCandidateStatus = !record.sentStateCommitted ? "not_candidate" : blockers.length > 0 ? "candidate_with_blockers" : warnings.length > 0 ? "candidate_with_warnings" : "candidate_ready_for_entry";
  const gateStatus: SupplierAckHandoffGateStatus = !record.sentStateCommitted ? "not_eligible" : blockers.length > 0 ? "tracking_dependency_open" : "eligible_for_supplier_ack_entry";

  return { supplierAckHandoffGateId: `sackgate_${Date.now().toString(36)}`, caseId: record.caseId, sentStateRecordId: record.sentStateRecordId, trackingRecordId: trackingRecord?.trackingRecordId ?? null, gateStatus, candidateStatus, candidateReason: blockers.length > 0 ? blockers[0] : canOpen ? "Supplier ack entry 가능" : "미준비", blockers, warnings, requiredPreconditions: precs, unsatisfiedPreconditions: unsatisfied, canOpenSupplierAckWorkspace: canOpen, supplierAckStatus: "not_received", nextSurfaceLabel: canOpen ? "Supplier Acknowledgment Workspace (Entry Enabled)" : "Supplier Acknowledgment Workspace (Locked)", generatedAt: new Date().toISOString() };
}
