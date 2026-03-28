/**
 * Receiving Execution Resolution v2 — 입고 실행 mutation spine
 * line별 실제 수령 기록. discrepancy/damage/substitute 분리. stock release 직행 금지.
 */

import type { ReceivingLineRecordV2, LineReceiptStatusV2 } from "./receiving-execution-workspace-v2";

export type ReceivingExecSessionStatus = "exec_open" | "exec_in_progress" | "exec_complete" | "exec_with_discrepancy" | "exec_hold" | "variance_disposition_required";

export interface ReceivingExecSessionV2 { execSessionId: string; caseId: string; sentStateRecordId: string; prepSessionId: string; sessionStatus: ReceivingExecSessionStatus; lineRecords: ReceivingLineRecordV2[]; totalExpected: number; totalReceived: number; discrepancyLines: string[]; damageLines: string[]; substituteLines: string[]; varianceDispositionRequired: boolean; openedAt: string; lastUpdatedAt: string; openedBy: string; auditEventRefs: string[]; }

export type ReceivingExecAction = "open_exec_session" | "record_line_receipt" | "flag_line_discrepancy" | "flag_line_damage" | "flag_line_substitute" | "complete_execution" | "hold_execution";
export interface ReceivingExecActionPayload { action: ReceivingExecAction; lineId?: string; actualQty?: number; lotNumber?: string; expiryDate?: string; lineStatus?: LineReceiptStatusV2; reason?: string; actor: string; timestamp: string; }
export interface ReceivingExecMutationResultV2 { applied: boolean; rejectedReasonIfAny: string | null; updatedSession: ReceivingExecSessionV2; emittedEvents: ReceivingExecEvent[]; }

export type ReceivingExecEventType = "receiving_exec_session_opened" | "receiving_exec_line_recorded" | "receiving_exec_discrepancy_flagged" | "receiving_exec_damage_flagged" | "receiving_exec_substitute_flagged" | "receiving_exec_completed" | "receiving_exec_held" | "receiving_exec_mutation_rejected";
export interface ReceivingExecEvent { type: ReceivingExecEventType; caseId: string; execSessionId: string; lineId: string | null; reason: string; actor: string; timestamp: string; }

export function createInitialReceivingExecSession(caseId: string, sentStateRecordId: string, prepSessionId: string, lineRecords: ReceivingLineRecordV2[], actor: string): ReceivingExecSessionV2 {
  const now = new Date().toISOString();
  return { execSessionId: `rcvexsn_${Date.now().toString(36)}`, caseId, sentStateRecordId, prepSessionId, sessionStatus: "exec_open", lineRecords: lineRecords.map(l => ({ ...l })), totalExpected: lineRecords.reduce((s, l) => s + l.expectedQty, 0), totalReceived: 0, discrepancyLines: [], damageLines: [], substituteLines: [], varianceDispositionRequired: false, openedAt: now, lastUpdatedAt: now, openedBy: actor, auditEventRefs: [] };
}

export function applyReceivingExecMutation(session: ReceivingExecSessionV2, payload: ReceivingExecActionPayload): ReceivingExecMutationResultV2 {
  const now = payload.timestamp; const events: ReceivingExecEvent[] = [];
  const makeEvent = (type: ReceivingExecEventType, lineId: string | null, reason: string): ReceivingExecEvent => ({ type, caseId: session.caseId, execSessionId: session.execSessionId, lineId, reason, actor: payload.actor, timestamp: now });
  const reject = (reason: string): ReceivingExecMutationResultV2 => { events.push(makeEvent("receiving_exec_mutation_rejected", null, reason)); return { applied: false, rejectedReasonIfAny: reason, updatedSession: session, emittedEvents: events }; };

  let u = { ...session, lastUpdatedAt: now, lineRecords: session.lineRecords.map(l => ({ ...l })), discrepancyLines: [...session.discrepancyLines], damageLines: [...session.damageLines], substituteLines: [...session.substituteLines] };

  switch (payload.action) {
    case "open_exec_session": { u.sessionStatus = "exec_open"; events.push(makeEvent("receiving_exec_session_opened", null, "Opened")); break; }
    case "record_line_receipt": {
      if (!payload.lineId) return reject("Line ID 필수");
      const line = u.lineRecords.find(l => l.lineId === payload.lineId);
      if (!line) return reject("Line not found");
      if (payload.actualQty !== undefined) line.actualReceivedQty = payload.actualQty;
      if (payload.lotNumber) line.lotNumber = payload.lotNumber;
      if (payload.expiryDate) line.expiryDate = payload.expiryDate;
      if (payload.lineStatus) line.lineReceiptStatus = payload.lineStatus;
      else line.lineReceiptStatus = line.actualReceivedQty === line.expectedQty ? "received_clean" : line.actualReceivedQty < line.expectedQty ? "received_short" : "received_over";
      u.sessionStatus = "exec_in_progress";
      u.totalReceived = u.lineRecords.reduce((s, l) => s + l.actualReceivedQty, 0);
      events.push(makeEvent("receiving_exec_line_recorded", payload.lineId, `Qty: ${line.actualReceivedQty}`));
      break;
    }
    case "flag_line_discrepancy": { if (!payload.lineId) return reject("Line ID 필수"); const line = u.lineRecords.find(l => l.lineId === payload.lineId); if (!line) return reject("Not found"); line.discrepancyFlag = true; if (!u.discrepancyLines.includes(payload.lineId)) u.discrepancyLines.push(payload.lineId); events.push(makeEvent("receiving_exec_discrepancy_flagged", payload.lineId, payload.reason || "Discrepancy")); break; }
    case "flag_line_damage": { if (!payload.lineId) return reject("Line ID 필수"); const line = u.lineRecords.find(l => l.lineId === payload.lineId); if (!line) return reject("Not found"); line.damageFlag = true; if (!u.damageLines.includes(payload.lineId)) u.damageLines.push(payload.lineId); events.push(makeEvent("receiving_exec_damage_flagged", payload.lineId, payload.reason || "Damage")); break; }
    case "flag_line_substitute": { if (!payload.lineId) return reject("Line ID 필수"); const line = u.lineRecords.find(l => l.lineId === payload.lineId); if (!line) return reject("Not found"); line.substituteFlag = true; if (!u.substituteLines.includes(payload.lineId)) u.substituteLines.push(payload.lineId); events.push(makeEvent("receiving_exec_substitute_flagged", payload.lineId, payload.reason || "Substitute")); break; }
    case "complete_execution": {
      const pendingLines = u.lineRecords.filter(l => l.lineReceiptStatus === "pending");
      if (pendingLines.length > 0) return reject(`${pendingLines.length}건 line 미처리`);
      const hasIssue = u.discrepancyLines.length > 0 || u.damageLines.length > 0 || u.substituteLines.length > 0;
      u.sessionStatus = hasIssue ? "exec_with_discrepancy" : "exec_complete";
      u.varianceDispositionRequired = hasIssue;
      events.push(makeEvent("receiving_exec_completed", null, hasIssue ? "Complete with discrepancy — variance disposition required" : "Complete clean"));
      break;
    }
    case "hold_execution": { u.sessionStatus = "exec_hold"; events.push(makeEvent("receiving_exec_held", null, payload.reason || "Hold")); break; }
    default: return reject(`Unknown action: ${payload.action}`);
  }
  return { applied: true, rejectedReasonIfAny: null, updatedSession: u, emittedEvents: events };
}
