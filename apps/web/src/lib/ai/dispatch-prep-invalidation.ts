/**
 * Dispatch Prep Invalidation — governance event emitters
 *
 * PO 데이터 변경, dispatch readiness 전이, 차단, 예약, 취소 이벤트를
 * governance bus로 발행한다.
 *
 * 각 emitter는 payload → GovernanceEvent 변환 후 전역 bus에 publish.
 */

import {
  getGlobalGovernanceEventBus,
  createGovernanceEvent,
  type GovernanceEventSeverity,
} from "./governance-event-bus";

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

// ── Readiness → severity 매핑 ──

function readinessSeverity(state: DispatchReadinessState): GovernanceEventSeverity {
  if (state === "blocked" || state === "cancelled") return "critical";
  if (state === "idle") return "warning";
  return "info";
}

// ── Emitters — governance bus 실제 발행 ──

export function emitPoDataChangedAfterApproval(
  payload: PoDataChangedAfterApprovalPayload,
): void {
  const bus = getGlobalGovernanceEventBus();
  bus.publish(
    createGovernanceEvent("dispatch_prep", "po_data_changed_after_approval", {
      caseId: payload.caseId,
      poNumber: payload.poNumber,
      fromStatus: "approved",
      toStatus: "data_changed",
      actor: "system",
      detail: `승인 후 PO 데이터 변경 — ${payload.changedFields.join(", ")}`,
      severity: "critical",
      chainStage: "dispatch_prep",
      affectedObjectIds: [payload.caseId, payload.poNumber],
      payload: {
        previousUpdatedAt: payload.previousUpdatedAt,
        newUpdatedAt: payload.newUpdatedAt,
        approvalDecidedAt: payload.approvalDecidedAt,
        changedFields: payload.changedFields,
      },
    }),
  );
}

export function emitDispatchPrepReadinessChanged(
  payload: DispatchPrepReadinessChangedPayload,
): void {
  const bus = getGlobalGovernanceEventBus();
  bus.publish(
    createGovernanceEvent("dispatch_prep", "dispatch_prep_readiness_changed", {
      caseId: payload.caseId,
      poNumber: payload.poNumber,
      fromStatus: payload.fromReadiness ?? "unknown",
      toStatus: payload.toReadiness,
      actor: "system",
      detail: `Dispatch readiness: ${payload.fromReadiness ?? "없음"} → ${payload.toReadiness}${payload.blockerReasons.length > 0 ? ` (차단: ${payload.blockerReasons[0]})` : ""}`,
      severity: readinessSeverity(payload.toReadiness),
      chainStage: "dispatch_prep",
      affectedObjectIds: [payload.caseId, payload.poNumber],
      payload: {
        fromReadiness: payload.fromReadiness,
        toReadiness: payload.toReadiness,
        blockerReasons: payload.blockerReasons,
      },
    }),
  );
}

export function emitDispatchPrepBlocked(
  payload: DispatchPrepBlockedPayload,
): void {
  const bus = getGlobalGovernanceEventBus();
  bus.publish(
    createGovernanceEvent("dispatch_prep", "dispatch_prep_blocked", {
      caseId: payload.caseId,
      poNumber: payload.poNumber,
      fromStatus: "active",
      toStatus: "blocked",
      actor: "system",
      detail: `Dispatch prep 차단 — ${payload.blockerReasons[0] ?? "사유 미기재"}`,
      severity: "critical",
      chainStage: "dispatch_prep",
      affectedObjectIds: [payload.caseId, payload.poNumber],
      payload: { blockerReasons: payload.blockerReasons },
    }),
  );
}

export function emitDispatchPrepSendScheduled(
  payload: DispatchPrepSendScheduledPayload,
): void {
  const bus = getGlobalGovernanceEventBus();
  bus.publish(
    createGovernanceEvent("dispatch_prep", "dispatch_prep_send_scheduled", {
      caseId: payload.caseId,
      poNumber: payload.poNumber,
      fromStatus: "ready_to_send",
      toStatus: "scheduled",
      actor: "system",
      detail: `발송 예약 — ${payload.scheduledFor}`,
      severity: "info",
      chainStage: "dispatch_prep",
      affectedObjectIds: [payload.caseId, payload.poNumber],
      payload: { scheduledFor: payload.scheduledFor },
    }),
  );
}

export function emitDispatchPrepCancelled(
  payload: DispatchPrepCancelledPayload,
): void {
  const bus = getGlobalGovernanceEventBus();
  bus.publish(
    createGovernanceEvent("dispatch_prep", "dispatch_prep_cancelled", {
      caseId: payload.caseId,
      poNumber: payload.poNumber,
      fromStatus: "active",
      toStatus: "cancelled",
      actor: "system",
      detail: `Dispatch prep 취소 — ${payload.reason}`,
      severity: "critical",
      chainStage: "dispatch_prep",
      affectedObjectIds: [payload.caseId, payload.poNumber],
      payload: { reason: payload.reason },
    }),
  );
}
