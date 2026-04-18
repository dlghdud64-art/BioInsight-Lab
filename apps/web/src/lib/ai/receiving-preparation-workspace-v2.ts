/**
 * Receiving Preparation Workspace v2 — 입고 준비 운영면
 * ack confirmed+ready 이후. 예정 수령 대상/inbound expectation 정리.
 *
 * TRUTH CONTRACT:
 * - reads: CanonicalProcurementLineRef[] (from ack resolution), ReceivingReadinessCheckV2
 * - writes: 없음 — workspace는 read-only. resolution engine이 etaWindow/references write.
 * - center: expected line set + ETA/reference completeness + readiness check
 * - rail: ack classification evidence + delivery tracking snapshot
 * - dock: update ETA / update reference / mark prep ready / hold
 * - forbidden: ack truth 재해석, receiving execution 직접 진입
 */

import type { SupplierAckResolutionSessionV2, ReceivingReadinessCheckV2, CanonicalProcurementLineRef } from "./supplier-acknowledgment-resolution-v2-engine";
import type { ReceivingPreparationHandoffGateV2 } from "./receiving-preparation-handoff-gate-v2-engine";

export type ReceivingPrepWorkspaceStatus = "prep_not_started" | "prep_in_progress" | "prep_ready" | "prep_blocked" | "prep_hold";

export interface ReceivingPrepWorkspaceStateV2 {
  workspaceId: string; caseId: string; sentStateRecordId: string; ackResolutionSessionId: string;
  workspaceStatus: ReceivingPrepWorkspaceStatus;
  /** P1 FIX: typed line reference로 강화 — expectedQty 전파 포함. */
  receivingExpectedLineSet: CanonicalProcurementLineRef[]; shipmentReferenceSet: string[]; etaWindow: string;
  receivingReadinessStatus: "ready" | "blocked" | "warning";
  missingReceivingInputs: string[]; warnings: string[];
  receivingExecutionAllowed: boolean;
  operatorNote: string; generatedAt: string;
}

export function buildReceivingPrepWorkspaceStateV2(gate: ReceivingPreparationHandoffGateV2, ackSession: SupplierAckResolutionSessionV2): ReceivingPrepWorkspaceStateV2 {
  const rc = ackSession.receivingReadinessCheck;
  const missing: string[] = []; const warnings: string[] = [];
  if (!rc.etaOrShipmentTimingAvailable) missing.push("ETA/출고 시점");
  if (!rc.deliveryReferenceAvailable) missing.push("배송 참조번호");
  if (!rc.noSubstitutionPending) warnings.push("대체품 미확정");
  if (!rc.noSplitShipmentUnresolved) warnings.push("분할납품 미해결");

  const status: ReceivingPrepWorkspaceStatus = missing.length > 0 ? "prep_blocked" : warnings.length > 0 ? "prep_in_progress" : "prep_ready";
  return { workspaceId: `rcvprepws_${Date.now().toString(36)}`, caseId: ackSession.caseId, sentStateRecordId: ackSession.sentStateRecordId, ackResolutionSessionId: ackSession.ackResolutionSessionId, workspaceStatus: status, receivingExpectedLineSet: ackSession.acceptedLineSet, shipmentReferenceSet: [], etaWindow: "", receivingReadinessStatus: missing.length > 0 ? "blocked" : warnings.length > 0 ? "warning" : "ready", missingReceivingInputs: missing, warnings, receivingExecutionAllowed: missing.length === 0, operatorNote: "", generatedAt: new Date().toISOString() };
}
