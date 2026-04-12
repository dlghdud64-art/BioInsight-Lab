/**
 * Dispatch Prep Invalidation — governance event emitters
 *
 * PO 데이터 변경, dispatch readiness 전이, 차단, 예약, 취소 이벤트를
 * governance bus로 발행한다. 현재는 console log stub — bus 연결 시 교체.
 */

export type DispatchReadinessState = "idle" | "ready" | "blocked" | "scheduled" | "cancelled";

// ── Event payloads ──

export interface PoDataChangedAfterApprovalPayload {
  caseId: string;
  poNumber: string;
  previousUpdatedAt: string | null;
  newUpdatedAt: string;
  approvalDecidedAt: string;
  changedFields: string[];
}

export interface DispatchPrepReadinessChangedPayload {
  caseId: string;
  poNumber: string;
  fromReadiness: DispatchReadinessState | null;
  toReadiness: DispatchReadinessState;
  blockerReasons: string[];
}

export interface DispatchPrepBlockedPayload {
  caseId: string;
  poNumber: string;
  blockerReasons: string[];
}

export interface DispatchPrepSendScheduledPayload {
  caseId: string;
  poNumber: string;
  scheduledFor: string;
}

export interface DispatchPrepCancelledPayload {
  caseId: string;
  poNumber: string;
  reason: string;
}

// ── Emitters (stub — governance bus 연결 시 실제 발행으로 교체) ──

export function emitPoDataChangedAfterApproval(
  _payload: PoDataChangedAfterApprovalPayload,
): void {
  // stub
}

export function emitDispatchPrepReadinessChanged(
  _payload: DispatchPrepReadinessChangedPayload,
): void {
  // stub
}

export function emitDispatchPrepBlocked(
  _payload: DispatchPrepBlockedPayload,
): void {
  // stub
}

export function emitDispatchPrepSendScheduled(
  _payload: DispatchPrepSendScheduledPayload,
): void {
  // stub
}

export function emitDispatchPrepCancelled(
  _payload: DispatchPrepCancelledPayload,
): void {
  // stub
}
