/**
 * Stock Release Resolution v2 Engine — release action → inventory mutation → audit
 *
 * ⚠️ WRITE-PATH RESOLUTION:
 * - canonical write scope: releaseLines[].releaseStatus, locationAssigned, binAssigned, totalReleasedQty
 * - single writer: 이 엔진만 actual stock release truth를 최초 기록
 * - input source trust: ReceivingVarianceDispositionSessionV2 (releasable subset only)
 * - downstream consumer: available-inventory-projection, reorder-trigger
 * - forbidden: hold/rejected qty를 release 대상에 포함, disposition 미완료 시 release
 */

import type { StockReleaseLineV2 } from "./stock-release-workspace-v2";

export type StockReleaseSessionStatusV2 = "release_open" | "release_in_progress" | "release_complete" | "release_partial" | "release_hold";

export interface StockReleaseSessionV2 {
  releaseSessionId: string; caseId: string; sentStateRecordId: string; dispositionSessionId: string;
  sessionStatus: StockReleaseSessionStatusV2;
  releaseLines: StockReleaseLineV2[];
  totalReleasableQty: number; totalReleasedQty: number;
  allLinesReleased: boolean;
  releasedAt: string | null; releasedBy: string | null;
  openedAt: string; lastUpdatedAt: string; openedBy: string;
  auditEventRefs: string[];
}

export type StockReleaseAction = "open_release_session" | "assign_location" | "execute_line_release" | "complete_release" | "hold_release";
export interface StockReleaseActionPayload { action: StockReleaseAction; lineId?: string; location?: string; bin?: string; reason?: string; actor: string; timestamp: string; }
export interface StockReleaseMutationResultV2 { applied: boolean; rejectedReasonIfAny: string | null; updatedSession: StockReleaseSessionV2; emittedEvents: StockReleaseEvent[]; }

export type StockReleaseEventType = "stock_release_session_opened" | "stock_release_location_assigned" | "stock_release_line_released" | "stock_release_completed" | "stock_release_held" | "stock_release_mutation_rejected";
export interface StockReleaseEvent { type: StockReleaseEventType; caseId: string; releaseSessionId: string; lineId: string | null; reason: string; actor: string; timestamp: string; }

export function createInitialStockReleaseSession(caseId: string, sentStateRecordId: string, dispositionSessionId: string, releaseLines: StockReleaseLineV2[], actor: string): StockReleaseSessionV2 {
  const now = new Date().toISOString();
  return { releaseSessionId: `stkrlsn_${Date.now().toString(36)}`, caseId, sentStateRecordId, dispositionSessionId, sessionStatus: "release_open", releaseLines: releaseLines.map(l => ({ ...l })), totalReleasableQty: releaseLines.reduce((s, l) => s + l.releasableQty, 0), totalReleasedQty: 0, allLinesReleased: false, releasedAt: null, releasedBy: null, openedAt: now, lastUpdatedAt: now, openedBy: actor, auditEventRefs: [] };
}

export function applyStockReleaseMutation(session: StockReleaseSessionV2, payload: StockReleaseActionPayload): StockReleaseMutationResultV2 {
  const now = payload.timestamp; const events: StockReleaseEvent[] = [];
  const makeEvent = (type: StockReleaseEventType, lineId: string | null, reason: string): StockReleaseEvent => ({ type, caseId: session.caseId, releaseSessionId: session.releaseSessionId, lineId, reason, actor: payload.actor, timestamp: now });
  const reject = (reason: string): StockReleaseMutationResultV2 => { events.push(makeEvent("stock_release_mutation_rejected", null, reason)); return { applied: false, rejectedReasonIfAny: reason, updatedSession: session, emittedEvents: events }; };

  let u = { ...session, lastUpdatedAt: now, releaseLines: session.releaseLines.map(l => ({ ...l })) };

  switch (payload.action) {
    case "open_release_session": { u.sessionStatus = "release_open"; events.push(makeEvent("stock_release_session_opened", null, "Opened")); break; }
    case "assign_location": {
      if (!payload.lineId || !payload.location) return reject("Line ID + location 필수");
      const line = u.releaseLines.find(l => l.lineId === payload.lineId);
      if (!line) return reject("Line not found");
      line.locationAssigned = payload.location; line.binAssigned = payload.bin || "";
      u.sessionStatus = "release_in_progress";
      events.push(makeEvent("stock_release_location_assigned", payload.lineId, `Location: ${payload.location}`));
      break;
    }
    case "execute_line_release": {
      if (!payload.lineId) return reject("Line ID 필수");
      const line = u.releaseLines.find(l => l.lineId === payload.lineId);
      if (!line) return reject("Line not found");
      if (!line.locationAssigned) return reject("Location 미배정 — release 불가");
      if (line.releaseStatus === "released") return reject("이미 released");
      line.releaseStatus = "released";
      u.totalReleasedQty = u.releaseLines.filter(l => l.releaseStatus === "released").reduce((s, l) => s + l.releasableQty, 0);
      events.push(makeEvent("stock_release_line_released", payload.lineId, `Released: ${line.releasableQty}`));
      break;
    }
    case "complete_release": {
      const unreleased = u.releaseLines.filter(l => l.releaseStatus !== "released");
      if (unreleased.length > 0) return reject(`${unreleased.length}건 line 미release`);
      u.sessionStatus = "release_complete"; u.allLinesReleased = true; u.releasedAt = now; u.releasedBy = payload.actor;
      events.push(makeEvent("stock_release_completed", null, `Total released: ${u.totalReleasedQty}`));
      break;
    }
    case "hold_release": { u.sessionStatus = "release_hold"; events.push(makeEvent("stock_release_held", null, payload.reason || "Hold")); break; }
    default: return reject(`Unknown action: ${payload.action}`);
  }
  return { applied: true, rejectedReasonIfAny: null, updatedSession: u, emittedEvents: events };
}
