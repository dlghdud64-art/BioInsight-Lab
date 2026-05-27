/**
 * S1 — Runtime Gate
 *
 * 공통 reject pipeline + audit 연결.
 * 모든 deny/reject/invalid transition → 단일 reject 함수로 수렴.
 */

import { randomUUID } from "crypto";
import type {
  S1LifecycleState,
  S1ReleaseMode,
  BaselineStatus,
  TransitionRequest,
  TransitionResult,
  ActionPermissionResult,
  RejectEvent,
} from "../../types/stabilization";
import { emitStabilizationAuditEvent } from "../audit/audit-events";
import { guardLifecycleTransition, guardReleaseModeTransition, guardCanonicalCombination } from "./transition-guard";
import { checkActionPermission } from "./action-permission-map";

// ── Reject Event Store ──

const _rejectEvents: RejectEvent[] = [];

/** 공통 reject pipeline */
export function emitRejectEvent(
  reasonCode: string,
  currentState: S1LifecycleState,
  targetState: S1LifecycleState | null,
  releaseMode: S1ReleaseMode,
  baselineStatus: BaselineStatus,
  requestedAction: string,
  actor: string,
  correlationId: string
): RejectEvent {
  const event: RejectEvent = {
    reasonCode,
    currentState,
    targetState,
    releaseMode,
    baselineStatus,
    requestedAction,
    actor,
    correlationId,
    timestamp: new Date(),
  };
  _rejectEvents.push(event);

  // audit에도 기록
  emitStabilizationAuditEvent({
    eventType: reasonCode.startsWith("ACTION_") || reasonCode.startsWith("DEV_") || reasonCode.startsWith("EXPANSION_")
      ? "ACTION_DENIED"
      : reasonCode.startsWith("INVALID_CANONICAL")
        ? "INVALID_COMBINATION_REJECTED"
        : "TRANSITION_REJECTED",
    baselineId: "",
    baselineVersion: "",
    baselineHash: "",
    snapshotId: "",
    correlationId,
    documentType: "",
    performedBy: actor,
    detail: `${reasonCode}: ${requestedAction} from ${currentState}/${releaseMode}/${baselineStatus}`,
  });

  return event;
}

/** reject event 조회 */
export function getRejectEvents(): RejectEvent[] {
  return [..._rejectEvents];
}

/** 전체 runtime gate — transition 요청 처리 */
export function requestTransition(req: TransitionRequest): TransitionResult {
  // 1. canonical combination guard
  const comboCheck = guardCanonicalCombination(
    req.currentState,
    req.releaseMode,
    req.baselineStatus,
    { stabilizationOnly: true, featureExpansionAllowed: false, devOnlyPathAllowed: false }
  );
  if (!comboCheck.allowed) {
    emitRejectEvent(
      comboCheck.reasonCode,
      req.currentState,
      req.targetState,
      req.releaseMode,
      req.baselineStatus,
      `TRANSITION:${req.currentState}->${req.targetState}`,
      req.actor,
      req.correlationId
    );
    return comboCheck;
  }

  // 2. lifecycle transition guard
  const transResult = guardLifecycleTransition(req);
  if (!transResult.allowed) {
    emitRejectEvent(
      transResult.reasonCode,
      req.currentState,
      req.targetState,
      req.releaseMode,
      req.baselineStatus,
      `TRANSITION:${req.currentState}->${req.targetState}`,
      req.actor,
      req.correlationId
    );
    return transResult;
  }

  // audit allowed transition
  emitStabilizationAuditEvent({
    eventType: "TRANSITION_ALLOWED",
    baselineId: "",
    baselineVersion: "",
    baselineHash: "",
    snapshotId: "",
    correlationId: req.correlationId,
    documentType: "",
    performedBy: req.actor,
    detail: `${req.currentState} → ${req.targetState} in ${req.releaseMode}`,
  });

  return transResult;
}

/** 전체 runtime gate — action 요청 처리 */
export function requestAction(
  lifecycle: S1LifecycleState,
  release: S1ReleaseMode,
  baseline: BaselineStatus,
  action: string,
  actor: string,
  correlationId: string
): ActionPermissionResult {
  const result = checkActionPermission(lifecycle, release, action);

  if (!result.allowed) {
    emitRejectEvent(
      result.reasonCode,
      lifecycle,
      null,
      release,
      baseline,
      action,
      actor,
      correlationId
    );
  } else {
    emitStabilizationAuditEvent({
      eventType: "ACTION_ALLOWED",
      baselineId: "",
      baselineVersion: "",
      baselineHash: "",
      snapshotId: "",
      correlationId,
      documentType: "",
      performedBy: actor,
      detail: `${action} allowed in ${lifecycle}/${release}`,
    });
  }

  return result;
}

/** 테스트용 — 상태 리셋 */
export function _resetRejectEvents(): void {
  _rejectEvents.length = 0;
}
