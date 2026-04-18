/**
 * Receiving Preparation Handoff Gate v2 Engine — ack confirmed+ready → receiving prep entry
 *
 * 핵심 규칙: confirmed ≠ receiving-ready. confirmed + receiving-ready일 때만 handoff.
 * 7 receiving readiness preconditions 명시적 판정.
 * ack_confirmed_pending_detail / partial / conditional → followup chain으로 분기.
 */

import type { SupplierAckResolutionSessionV2, AckClassification, ReceivingReadinessCheckV2 } from "./supplier-acknowledgment-resolution-v2-engine";
import type { SentStateRecordV2 } from "./actual-send-fired-transaction-v2-engine";

// ── Gate Status ──
export type ReceivingPrepHandoffGateStatus = "not_eligible" | "ack_dependency_open" | "receiving_readiness_dependency_open" | "eligible_for_receiving_prep" | "receiving_prep_locked_by_policy" | "receiving_prep_entry_opened";

// ── Preconditions ──
export type ReceivingPrepPreconditionKey = "ack_confirmed_ready" | "supplier_accepted_full" | "eta_or_shipment_timing_available" | "line_item_scope_confirmed" | "delivery_reference_available" | "no_substitution_pending" | "no_split_shipment_unresolved" | "quantity_pack_confirmed" | "sent_state_committed" | "no_followup_required" | "no_exception_required";

export interface ReceivingPrepPreconditionResultV2 { preconditionKey: ReceivingPrepPreconditionKey; label: string; status: "satisfied" | "unsatisfied"; reasonIfUnsatisfied: string; blockingLevel: "hard_blocker" | "soft_blocker" | "warning"; }

// ── Candidate ──
export type ReceivingPrepCandidateStatus = "not_candidate" | "candidate_with_blockers" | "candidate_with_warnings" | "candidate_ready_for_entry";

export interface ReceivingPrepEntryCandidateV2 { candidateStatus: ReceivingPrepCandidateStatus; candidateReason: string; ackClassification: AckClassification; receivingReady: boolean; canOpenReceivingPrepWorkspace: boolean; canOnlyPreview: boolean; }

// ── Top-Level Gate ──
export interface ReceivingPreparationHandoffGateV2 {
  receivingPrepHandoffGateId: string; caseId: string; sentStateRecordId: string; ackResolutionSessionId: string;
  gateStatus: ReceivingPrepHandoffGateStatus;
  candidate: ReceivingPrepEntryCandidateV2;
  blockers: string[]; warnings: string[];
  requiredPreconditions: ReceivingPrepPreconditionResultV2[]; unsatisfiedPreconditions: ReceivingPrepPreconditionResultV2[];
  receivingReadinessCheck: ReceivingReadinessCheckV2;
  nextSurfaceLabel: string; generatedAt: string;
}

export function buildReceivingPreparationHandoffGateV2(ackSession: SupplierAckResolutionSessionV2, sentRecord: SentStateRecordV2): ReceivingPreparationHandoffGateV2 {
  const precs: ReceivingPrepPreconditionResultV2[] = [];
  const rc = ackSession.receivingReadinessCheck;

  // Core ack classification
  precs.push({ preconditionKey: "ack_confirmed_ready", label: "Ack confirmed + ready", status: ackSession.ackClassification === "ack_confirmed_ready" ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: ackSession.ackClassification !== "ack_confirmed_ready" ? `Classification: ${ackSession.ackClassification}` : "", blockingLevel: "hard_blocker" });

  // Receiving readiness breakdown
  precs.push({ preconditionKey: "supplier_accepted_full", label: "Supplier 전체 수락", status: rc.supplierAcceptedFull ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: !rc.supplierAcceptedFull ? "전체 수락 미확인" : "", blockingLevel: "hard_blocker" });
  precs.push({ preconditionKey: "eta_or_shipment_timing_available", label: "ETA/출고 시점 확보", status: rc.etaOrShipmentTimingAvailable ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: !rc.etaOrShipmentTimingAvailable ? "ETA 미확보" : "", blockingLevel: "hard_blocker" });
  precs.push({ preconditionKey: "line_item_scope_confirmed", label: "Line item 범위 확정", status: rc.lineItemScopeConfirmed ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: !rc.lineItemScopeConfirmed ? "Line item scope 미확정" : "", blockingLevel: "hard_blocker" });
  precs.push({ preconditionKey: "delivery_reference_available", label: "배송 참조번호 확보", status: rc.deliveryReferenceAvailable ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: !rc.deliveryReferenceAvailable ? "배송 참조번호 없음" : "", blockingLevel: "soft_blocker" });
  precs.push({ preconditionKey: "no_substitution_pending", label: "대체품 미확정 없음", status: rc.noSubstitutionPending ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: !rc.noSubstitutionPending ? "대체품 미확정" : "", blockingLevel: "soft_blocker" });
  precs.push({ preconditionKey: "no_split_shipment_unresolved", label: "분할납품 미해결 없음", status: rc.noSplitShipmentUnresolved ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: !rc.noSplitShipmentUnresolved ? "분할납품 미해결" : "", blockingLevel: "soft_blocker" });
  precs.push({ preconditionKey: "quantity_pack_confirmed", label: "수량/팩 확정", status: rc.quantityPackConfirmed ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: !rc.quantityPackConfirmed ? "수량/팩 미확정" : "", blockingLevel: "hard_blocker" });

  // Upstream truth
  precs.push({ preconditionKey: "sent_state_committed", label: "Sent state committed", status: sentRecord.sentStateCommitted ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: !sentRecord.sentStateCommitted ? "Sent 미커밋" : "", blockingLevel: "hard_blocker" });
  precs.push({ preconditionKey: "no_followup_required", label: "Followup 불필요", status: !ackSession.followupRequired ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: ackSession.followupRequired ? "Followup 필요" : "", blockingLevel: "hard_blocker" });
  precs.push({ preconditionKey: "no_exception_required", label: "Exception 불필요", status: !ackSession.exceptionRequired ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: ackSession.exceptionRequired ? "Exception 필요" : "", blockingLevel: "hard_blocker" });

  const unsatisfied = precs.filter(p => p.status === "unsatisfied");
  const blockers = unsatisfied.filter(p => p.blockingLevel === "hard_blocker" || p.blockingLevel === "soft_blocker").map(p => p.reasonIfUnsatisfied);
  const warnings = unsatisfied.filter(p => p.blockingLevel === "warning").map(p => p.reasonIfUnsatisfied);

  const canOpen = blockers.length === 0 && ackSession.receivingReady && ackSession.ackClassification === "ack_confirmed_ready";
  const candidateStatus: ReceivingPrepCandidateStatus = !ackSession.receivingReady ? "not_candidate" : blockers.length > 0 ? "candidate_with_blockers" : warnings.length > 0 ? "candidate_with_warnings" : "candidate_ready_for_entry";
  const gateStatus: ReceivingPrepHandoffGateStatus = ackSession.ackClassification !== "ack_confirmed_ready" ? "not_eligible" : !ackSession.receivingReady ? "receiving_readiness_dependency_open" : blockers.length > 0 ? "ack_dependency_open" : "eligible_for_receiving_prep";

  return { receivingPrepHandoffGateId: `rcvprepgate_${Date.now().toString(36)}`, caseId: ackSession.caseId, sentStateRecordId: ackSession.sentStateRecordId, ackResolutionSessionId: ackSession.ackResolutionSessionId, gateStatus, candidate: { candidateStatus, candidateReason: blockers.length > 0 ? blockers[0] : canOpen ? "Receiving prep entry 가능" : "미준비", ackClassification: ackSession.ackClassification, receivingReady: ackSession.receivingReady, canOpenReceivingPrepWorkspace: canOpen, canOnlyPreview: !canOpen && ackSession.ackClassification === "ack_confirmed_ready" }, blockers, warnings, requiredPreconditions: precs, unsatisfiedPreconditions: unsatisfied, receivingReadinessCheck: ackSession.receivingReadinessCheck, nextSurfaceLabel: canOpen ? "Receiving Preparation Workspace (Entry Enabled)" : "Receiving Preparation Workspace (Locked)", generatedAt: new Date().toISOString() };
}

export type ReceivingPrepHandoffEventType = "receiving_prep_handoff_gate_computed" | "receiving_prep_entry_eligible" | "receiving_prep_entry_blocked" | "receiving_prep_readiness_dependency_open" | "receiving_prep_entry_enabled";
export interface ReceivingPrepHandoffEvent { type: ReceivingPrepHandoffEventType; caseId: string; ackResolutionSessionId: string; gateId: string; reason: string; actor: string; timestamp: string; }
export function createReceivingPrepHandoffEvent(type: ReceivingPrepHandoffEventType, gate: ReceivingPreparationHandoffGateV2, reason: string, actor: string): ReceivingPrepHandoffEvent { return { type, caseId: gate.caseId, ackResolutionSessionId: gate.ackResolutionSessionId, gateId: gate.receivingPrepHandoffGateId, reason, actor, timestamp: new Date().toISOString() }; }
