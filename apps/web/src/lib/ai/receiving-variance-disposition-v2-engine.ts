/**
 * Receiving Variance Disposition v2 Engine — received truth 정리 + discrepancy disposition
 *
 * Receiving Execution → Stock Release 직행 금지. 반드시 이 단계 경유.
 * short/over/damaged/substitute discrepancy → accepted/hold/reject disposition.
 * releasable inventory만 stock release로 넘김.
 */

import type { ReceivingExecSessionV2, ReceivingExecSessionStatus } from "./receiving-execution-resolution-v2-engine";
import type { ReceivingLineRecordV2 } from "./receiving-execution-workspace-v2";

export type VarianceDispositionStatus = "disposition_pending" | "disposition_in_progress" | "disposition_complete" | "disposition_hold";
export type LineDisposition = "accepted" | "accepted_with_note" | "hold_for_review" | "rejected" | "return_to_supplier" | "quarantine";

export interface ReceivingLineDispositionV2 { lineId: string; lineReceiptStatus: string; expectedQty: number; actualQty: number; varianceQty: number; damageFlag: boolean; discrepancyFlag: boolean; substituteFlag: boolean; disposition: LineDisposition; dispositionReason: string; releasableQty: number; holdQty: number; rejectedQty: number; dispositionBy: string | null; dispositionAt: string | null; }

export interface ReceivingVarianceDispositionSessionV2 {
  dispositionSessionId: string; caseId: string; sentStateRecordId: string; execSessionId: string;
  sessionStatus: VarianceDispositionStatus;
  lineDispositions: ReceivingLineDispositionV2[];
  totalReleasableQty: number; totalHoldQty: number; totalRejectedQty: number;
  allDispositionsComplete: boolean; stockReleaseAllowed: boolean;
  openedAt: string; lastUpdatedAt: string; openedBy: string; auditEventRefs: string[];
}

export type DispositionAction = "open_disposition_session" | "set_line_disposition" | "mark_all_dispositions_complete" | "hold_disposition";
export interface DispositionActionPayload { action: DispositionAction; lineId?: string; disposition?: LineDisposition; dispositionReason?: string; reason?: string; actor: string; timestamp: string; }
export interface VarianceDispositionMutationResultV2 { applied: boolean; rejectedReasonIfAny: string | null; updatedSession: ReceivingVarianceDispositionSessionV2; emittedEvents: DispositionEvent[]; }

export type DispositionEventType = "variance_disposition_session_opened" | "variance_line_disposition_set" | "variance_all_dispositions_complete" | "variance_disposition_held" | "variance_stock_release_allowed" | "variance_disposition_mutation_rejected";
export interface DispositionEvent { type: DispositionEventType; caseId: string; dispositionSessionId: string; lineId: string | null; reason: string; actor: string; timestamp: string; }

export function createInitialDispositionSession(caseId: string, sentStateRecordId: string, execSession: ReceivingExecSessionV2, actor: string): ReceivingVarianceDispositionSessionV2 {
  const now = new Date().toISOString();
  const lineDisps: ReceivingLineDispositionV2[] = execSession.lineRecords.map(l => ({ lineId: l.lineId, lineReceiptStatus: l.lineReceiptStatus, expectedQty: l.expectedQty, actualQty: l.actualReceivedQty, varianceQty: l.actualReceivedQty - l.expectedQty, damageFlag: l.damageFlag, discrepancyFlag: l.discrepancyFlag, substituteFlag: l.substituteFlag, disposition: l.lineReceiptStatus === "received_clean" ? "accepted" as const : "hold_for_review" as const, dispositionReason: "", releasableQty: l.lineReceiptStatus === "received_clean" ? l.actualReceivedQty : 0, holdQty: l.lineReceiptStatus !== "received_clean" ? l.actualReceivedQty : 0, rejectedQty: 0, dispositionBy: l.lineReceiptStatus === "received_clean" ? "auto" : null, dispositionAt: l.lineReceiptStatus === "received_clean" ? now : null }));
  const totalReleasable = lineDisps.reduce((s, l) => s + l.releasableQty, 0);
  const totalHold = lineDisps.reduce((s, l) => s + l.holdQty, 0);
  const totalRejected = lineDisps.reduce((s, l) => s + l.rejectedQty, 0);
  const allComplete = lineDisps.every(l => l.dispositionBy !== null);

  return { dispositionSessionId: `dispses_${Date.now().toString(36)}`, caseId, sentStateRecordId, execSessionId: execSession.execSessionId, sessionStatus: allComplete ? "disposition_complete" : "disposition_pending", lineDispositions: lineDisps, totalReleasableQty: totalReleasable, totalHoldQty: totalHold, totalRejectedQty: totalRejected, allDispositionsComplete: allComplete, stockReleaseAllowed: allComplete && totalReleasable > 0, openedAt: now, lastUpdatedAt: now, openedBy: actor, auditEventRefs: [] };
}

export function applyVarianceDispositionMutation(session: ReceivingVarianceDispositionSessionV2, payload: DispositionActionPayload): VarianceDispositionMutationResultV2 {
  const now = payload.timestamp; const events: DispositionEvent[] = [];
  const makeEvent = (type: DispositionEventType, lineId: string | null, reason: string): DispositionEvent => ({ type, caseId: session.caseId, dispositionSessionId: session.dispositionSessionId, lineId, reason, actor: payload.actor, timestamp: now });
  const reject = (reason: string): VarianceDispositionMutationResultV2 => { events.push(makeEvent("variance_disposition_mutation_rejected", null, reason)); return { applied: false, rejectedReasonIfAny: reason, updatedSession: session, emittedEvents: events }; };

  let u = { ...session, lastUpdatedAt: now, lineDispositions: session.lineDispositions.map(l => ({ ...l })) };

  switch (payload.action) {
    case "open_disposition_session": { u.sessionStatus = "disposition_pending"; events.push(makeEvent("variance_disposition_session_opened", null, "Opened")); break; }
    case "set_line_disposition": {
      if (!payload.lineId || !payload.disposition) return reject("Line ID + disposition 필수");
      const line = u.lineDispositions.find(l => l.lineId === payload.lineId);
      if (!line) return reject("Line not found");
      line.disposition = payload.disposition; line.dispositionReason = payload.dispositionReason || ""; line.dispositionBy = payload.actor; line.dispositionAt = now;
      if (payload.disposition === "accepted" || payload.disposition === "accepted_with_note") { line.releasableQty = line.actualQty; line.holdQty = 0; line.rejectedQty = 0; }
      else if (payload.disposition === "hold_for_review" || payload.disposition === "quarantine") { line.releasableQty = 0; line.holdQty = line.actualQty; line.rejectedQty = 0; }
      else if (payload.disposition === "rejected" || payload.disposition === "return_to_supplier") { line.releasableQty = 0; line.holdQty = 0; line.rejectedQty = line.actualQty; }
      u.sessionStatus = "disposition_in_progress";
      u.totalReleasableQty = u.lineDispositions.reduce((s, l) => s + l.releasableQty, 0);
      u.totalHoldQty = u.lineDispositions.reduce((s, l) => s + l.holdQty, 0);
      u.totalRejectedQty = u.lineDispositions.reduce((s, l) => s + l.rejectedQty, 0);
      events.push(makeEvent("variance_line_disposition_set", payload.lineId, `${payload.disposition}: releasable=${line.releasableQty}`));
      break;
    }
    case "mark_all_dispositions_complete": {
      const pending = u.lineDispositions.filter(l => !l.dispositionBy);
      if (pending.length > 0) return reject(`${pending.length}건 disposition 미완료`);
      u.sessionStatus = "disposition_complete"; u.allDispositionsComplete = true;
      u.stockReleaseAllowed = u.totalReleasableQty > 0;
      events.push(makeEvent("variance_all_dispositions_complete", null, `Releasable: ${u.totalReleasableQty}, Hold: ${u.totalHoldQty}, Rejected: ${u.totalRejectedQty}`));
      if (u.stockReleaseAllowed) events.push(makeEvent("variance_stock_release_allowed", null, `Stock release allowed: ${u.totalReleasableQty}`));
      break;
    }
    case "hold_disposition": { u.sessionStatus = "disposition_hold"; events.push(makeEvent("variance_disposition_held", null, payload.reason || "Hold")); break; }
    default: return reject(`Unknown action: ${payload.action}`);
  }
  return { applied: true, rejectedReasonIfAny: null, updatedSession: u, emittedEvents: events };
}
