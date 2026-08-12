/**
 * Receiving Execution Resolution v2 — 입고 실행 mutation spine
 * line별 실제 수령 기록. discrepancy/damage/substitute 분리. stock release 직행 금지.
 *
 * ⚠️ WRITE-PATH RESOLUTION — pure read-only resolution이 아님.
 * - canonical write scope: lineRecords[].actualReceivedQty, lotNumber, expiryDate, lineReceiptStatus,
 *   damageFlag, discrepancyFlag, substituteFlag, discrepancyLines, damageLines, substituteLines
 * - single writer: 이 엔진만 actual receipt truth를 최초 기록
 * - input source trust: ReceivingPrepSessionV2.receivingExpectedLineSet (CanonicalProcurementLineRef)
 * - downstream consumer: receiving-variance-disposition (lineRecords 읽기만)
 * - forbidden: stock release 직접 생성 금지 — variance disposition 경유 필수
 */

import type { ReceivingLineRecordV2, LineReceiptStatusV2 } from "./receiving-execution-workspace-v2";


/**
 * §execution-id-collision (2026-08-12) — execution id 생성.
 *
 * 이전: `${prefix}${Date.now().toString(36)}` — **같은 밀리초 안에 생성되면 충돌**한다.
 *   실측(dispatch-execution-handoff H5): 서로 다른 idempotencyKey 로 만든 두 execution 이
 *   같은 executionId 를 받았다. 두 실행이 같은 id 를 가지면 발송·입고 이력이 뒤섞인다 —
 *   구매 운영에서 회수 불가능한 오류다.
 *   시간 의존이라 **간헐 실패**했고, 그래서 오래 "flaky 테스트" 로 위장돼 있었다.
 *
 * 지금: 전역 `crypto.randomUUID()` (Web Crypto).
 *   `node:crypto` 를 쓰지 않는 이유 — 이 엔진들을 **클라이언트 컴포넌트가 import** 한다
 *   (예: components/approval/dispatch-execution-workbench.tsx). 전역 API 는 Node 19+ 와
 *   브라우저 양쪽에서 동작한다.
 *   런타임 생성값이라 **마이그레이션 불요**. 접두사는 유지한다.
 */
export type ReceivingExecSessionStatus = "exec_open" | "exec_in_progress" | "exec_complete" | "exec_with_discrepancy" | "exec_hold" | "variance_disposition_required";

export interface ReceivingExecSessionV2 { execSessionId: string; caseId: string; sentStateRecordId: string; prepSessionId: string; sessionStatus: ReceivingExecSessionStatus; lineRecords: ReceivingLineRecordV2[]; totalExpected: number; totalReceived: number; discrepancyLines: string[]; damageLines: string[]; substituteLines: string[]; varianceDispositionRequired: boolean; openedAt: string; lastUpdatedAt: string; openedBy: string; auditEventRefs: string[]; }

export type ReceivingExecAction = "open_exec_session" | "record_line_receipt" | "flag_line_discrepancy" | "flag_line_damage" | "flag_line_substitute" | "complete_execution" | "hold_execution";
export interface ReceivingExecActionPayload { action: ReceivingExecAction; lineId?: string; actualQty?: number; lotNumber?: string; expiryDate?: string; lineStatus?: LineReceiptStatusV2; reason?: string; actor: string; timestamp: string; }
export interface ReceivingExecMutationResultV2 { applied: boolean; rejectedReasonIfAny: string | null; updatedSession: ReceivingExecSessionV2; emittedEvents: ReceivingExecEvent[]; }

export type ReceivingExecEventType = "receiving_exec_session_opened" | "receiving_exec_line_recorded" | "receiving_exec_discrepancy_flagged" | "receiving_exec_damage_flagged" | "receiving_exec_substitute_flagged" | "receiving_exec_completed" | "receiving_exec_held" | "receiving_exec_mutation_rejected";
export interface ReceivingExecEvent { type: ReceivingExecEventType; caseId: string; execSessionId: string; lineId: string | null; reason: string; actor: string; timestamp: string; }

export function createInitialReceivingExecSession(caseId: string, sentStateRecordId: string, prepSessionId: string, lineRecords: ReceivingLineRecordV2[], actor: string): ReceivingExecSessionV2 {
  const now = new Date().toISOString();
  return { execSessionId: `rcvexsn_${crypto.randomUUID()}`, caseId, sentStateRecordId, prepSessionId, sessionStatus: "exec_open", lineRecords: lineRecords.map(l => ({ ...l })), totalExpected: lineRecords.reduce((s, l) => s + l.expectedQty, 0), totalReceived: 0, discrepancyLines: [], damageLines: [], substituteLines: [], varianceDispositionRequired: false, openedAt: now, lastUpdatedAt: now, openedBy: actor, auditEventRefs: [] };
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
