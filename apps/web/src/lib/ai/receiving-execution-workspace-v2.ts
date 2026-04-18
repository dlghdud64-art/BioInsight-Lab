/**
 * Receiving Execution Workspace v2 — 실제 입고 처리 운영면
 * 수령 수량/상태 기록. stock release 직행 금지 — receiving resolution 경유 필수.
 *
 * TRUTH CONTRACT:
 * - reads: CanonicalProcurementLineRef[] (from prep session — expectedQty/unit 전파)
 * - writes: 없음 — workspace는 read-only. resolution engine이 lineRecords write.
 * - center: line-level receipt capture (qty/lot/expiry/damage/discrepancy/substitute)
 * - rail: prep session evidence + ack classification snapshot
 * - dock: record receipt / flag discrepancy / flag damage / complete execution / hold
 * - forbidden: stock release 직행 — variance disposition 경유 필수
 */

import type { ReceivingPrepSessionV2 } from "./receiving-preparation-resolution-v2-engine";
import type { ReceivingExecHandoffGateV2 } from "./receiving-execution-handoff-gate-v2-engine";

export type ReceivingExecWorkspaceStatus = "execution_not_started" | "execution_in_progress" | "execution_complete" | "execution_with_discrepancy" | "execution_hold";
export type LineReceiptStatusV2 = "pending" | "received_clean" | "received_short" | "received_over" | "received_damaged" | "received_substitute" | "not_received";

export interface ReceivingLineRecordV2 { lineId: string; expectedQty: number; actualReceivedQty: number; unit: string; lotNumber: string; expiryDate: string; lineReceiptStatus: LineReceiptStatusV2; damageFlag: boolean; discrepancyFlag: boolean; substituteFlag: boolean; receivingNote: string; }

export interface ReceivingExecWorkspaceStateV2 {
  workspaceId: string; caseId: string; sentStateRecordId: string; prepSessionId: string;
  workspaceStatus: ReceivingExecWorkspaceStatus;
  lineRecords: ReceivingLineRecordV2[];
  totalExpectedQty: number; totalReceivedQty: number;
  hasDiscrepancy: boolean; hasDamage: boolean; hasSubstitute: boolean;
  canCompleteExecution: boolean; canRouteDiscrepancy: boolean;
  operatorNote: string; generatedAt: string;
}

export function buildReceivingExecWorkspaceStateV2(gate: ReceivingExecHandoffGateV2, prepSession: ReceivingPrepSessionV2): ReceivingExecWorkspaceStateV2 {
  /** P1 FIX: typed CanonicalProcurementLineRef에서 expectedQty와 unit을 전파. */
  const lines: ReceivingLineRecordV2[] = prepSession.receivingExpectedLineSet.map((lineRef) => ({ lineId: lineRef.lineRefId, expectedQty: lineRef.expectedQty, actualReceivedQty: 0, unit: lineRef.unit, lotNumber: "", expiryDate: "", lineReceiptStatus: "pending" as const, damageFlag: false, discrepancyFlag: false, substituteFlag: false, receivingNote: "" }));
  const totalExpected = lines.reduce((s, l) => s + l.expectedQty, 0);
  return { workspaceId: `rcvexws_${Date.now().toString(36)}`, caseId: prepSession.caseId, sentStateRecordId: prepSession.sentStateRecordId, prepSessionId: prepSession.prepSessionId, workspaceStatus: "execution_not_started", lineRecords: lines, totalExpectedQty: totalExpected, totalReceivedQty: 0, hasDiscrepancy: false, hasDamage: false, hasSubstitute: false, canCompleteExecution: false, canRouteDiscrepancy: false, operatorNote: "", generatedAt: new Date().toISOString() };
}
