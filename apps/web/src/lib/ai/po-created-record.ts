/**
 * PO Created Record — Quote → Approval → PO Conversion → PO Created → Dispatch Prep
 * 체인의 PO Created stage에 대한 unified computed contract.
 *
 * 고정 규칙 (CLAUDE.md):
 * 1. PO Created는 종료 화면이 아니라 다음 작업의 진입 허브.
 *    → terminal success card 금지. nextAction을 가장 먼저 노출.
 * 2. canonical truth는 흔들지 않는다.
 *    → 이 모듈은 read-only orchestrator이며, 기존 engine state 위의 computed view.
 *    → po-created-engine / po-dispatch-governance-engine / approval/quote snapshot이
 *      각자 source of truth이고, 본 record는 그 join에 해당한다.
 * 3. supplier-facing payload는 internal truth와 분리한다.
 *    → supplierFacingPayloadStatus는 governance evaluator의 결과만 반영하며,
 *      preview UI가 truth를 덮지 못하게 한다.
 * 4. snapshot validity fail은 실제 blocker로 작동한다.
 *    → blockingReasons + reentryAvailableActions에 명시되며,
 *      `Send now` 같은 irreversible action은 진입 허용 목록에서 제거된다.
 * 5. ready_to_send ≠ sent.
 *    → dispatchReadiness는 created truth 단계의 readiness이며,
 *      실제 발송 이벤트(outbound execution state)는 별도로 다룬다.
 *
 * 입력:
 *   - PoCreatedState (po-created-engine)
 *   - DispatchPreparationGovernanceState (po-dispatch-governance-engine)
 *   - linked approval/quote snapshot id 식별자
 *
 * 출력:
 *   - POCreatedRecord (unified next-action 진입 허브 contract)
 */

import type { PoCreatedState } from "./po-created-engine";
import { validatePoCreatedBeforeDispatchPrep, buildPoCreatedDecisionOptions } from "./po-created-engine";
import type {
  DispatchPreparationGovernanceState,
  DispatchGovernanceReadiness,
  DispatchBlocker,
} from "./po-dispatch-governance-engine";
import { canCreateExecution } from "./dispatch-execution-handoff";

// ══════════════════════════════════════════════════════════════════════════════
// Computed types (spec-aligned)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Snapshot 유효성 — quote/approval/conversion 3축
 *
 * - approvalSnapshotValid: 견적 승인 결정 snapshot 유효 여부
 * - quoteSnapshotValid:    승인의 근거가 된 견적 shortlist snapshot 유효 여부
 * - conversionSnapshotValid: 승인 → PO 전환 draft snapshot 유효 여부
 * - reason: 무효 시 사유 (UI에 그대로 노출 가능한 한국어)
 *
 * 어느 하나라도 false면 supplier-facing payload는 build 불가로 간주된다.
 */
export interface POCreatedSnapshotValidity {
  approvalSnapshotValid: boolean;
  quoteSnapshotValid: boolean;
  conversionSnapshotValid: boolean;
  reason: string | null;
}

/**
 * supplier-facing payload 상태 — internal truth와 분리된 외부 송신 대상의 readiness
 *
 * - not_ready: hard blocker가 있어 payload 자체가 미완성
 * - draft:     hard blocker는 없으나 review 권장 (soft blocker / delta 존재)
 * - locked:    payload가 send 가능 상태 (governance ready_to_send 이상)
 * - stale:     이전에 locked였으나 snapshot/supplier/policy 변경으로 invalidated
 */
export type SupplierFacingPayloadStatus = "not_ready" | "draft" | "locked" | "stale";

/**
 * PO Created 진입 허브에서 노출 가능한 다음 액션
 *
 * 주의: 이 목록은 governance evaluator 결과로만 열린다.
 *      optimistic unlock 금지 — UI는 이 list를 그대로 dock 버튼 enable 조건으로 사용.
 */
export type ReentryActionKey =
  | "open_dispatch_prep"
  | "send_now"
  | "schedule_send"
  | "request_correction"
  | "reopen_po_conversion"
  | "hold"
  | "cancel_dispatch_prep";

/**
 * 차단 사유 — blockingReasons[]에 들어가는 단일 항목
 *
 * type/severity는 governance engine의 DispatchBlocker와 정렬한다.
 */
export interface POCreatedBlockingReason {
  code: string;
  severity: "hard" | "soft";
  message: string;
  remediation: string;
}

/**
 * Canonical PO Created Record (computed view)
 *
 * 본 record는 read-only computed 결과로, 어떤 mutation도 발생시키지 않는다.
 * 동일 입력에 대해 동일 출력 보장 (deterministic).
 */
export interface POCreatedRecord {
  /** record identity (computed view 식별용) */
  id: string;

  // ── Linkage (canonical source ids) ──
  /** 정식 PO Created object id (없으면 null — 아직 record 단계) */
  poCreatedObjectId: string | null;
  /** 승인 결정 object id */
  approvalDecisionObjectId: string;
  /** PO 전환 draft object id */
  poConversionDraftObjectId: string;
  /** 견적 shortlist snapshot id (UI 라벨용) */
  quoteShortlistSnapshotId: string;

  // ── Computed surface ──
  /** 가장 먼저 사용자에게 노출해야 하는 다음 작업 */
  nextAction: string;
  /** governance evaluator가 결정한 dispatch readiness 상태 */
  dispatchReadiness: DispatchGovernanceReadiness;
  /** supplier-facing payload 상태 (internal truth와 분리) */
  supplierFacingPayloadStatus: SupplierFacingPayloadStatus;
  /** snapshot 유효성 (quote/approval/conversion 3축) */
  snapshotValidity: POCreatedSnapshotValidity;
  /** 차단 사유 목록 (hard 우선, soft는 권장 표시) */
  blockingReasons: POCreatedBlockingReason[];
  /** 진입 허용 가능한 액션 목록 (dock UI는 이 리스트만 활성화) */
  reentryAvailableActions: ReentryActionKey[];

  // ── Audit ──
  evaluatedAt: string;
}

// ══════════════════════════════════════════════════════════════════════════════
// Builder
// ══════════════════════════════════════════════════════════════════════════════

export interface BuildPoCreatedRecordInput {
  poCreatedState: PoCreatedState;
  dispatchGovernance: DispatchPreparationGovernanceState;
  /** 견적 shortlist snapshot id (UI/audit linkage용) */
  quoteShortlistSnapshotId: string;
  /** 견적 snapshot 자체의 유효성 (quote shortlist 단계) */
  quoteSnapshotValid: boolean;
}

/**
 * 입력으로 받은 canonical state들을 join해 POCreatedRecord computed view를 만든다.
 *
 * 본 함수는 다음을 절대 하지 않는다:
 *  - state mutation
 *  - dispatch governance 재평가 (caller가 evaluator를 호출해 전달해야 함)
 *  - optimistic unlock (action 활성화는 governance 결과로만 결정)
 */
export function buildPoCreatedRecord(input: BuildPoCreatedRecordInput): POCreatedRecord {
  const { poCreatedState, dispatchGovernance, quoteShortlistSnapshotId, quoteSnapshotValid } = input;

  // ── snapshot validity ──
  const snapshotValidity: POCreatedSnapshotValidity = {
    approvalSnapshotValid: dispatchGovernance.approvalSnapshotValid,
    quoteSnapshotValid,
    conversionSnapshotValid: dispatchGovernance.conversionSnapshotValid,
    reason:
      !dispatchGovernance.approvalSnapshotValid || !dispatchGovernance.conversionSnapshotValid || !quoteSnapshotValid
        ? dispatchGovernance.snapshotInvalidationReason || "Snapshot 무효 — 재승인/재전환 필요"
        : null,
  };

  const allSnapshotsValid =
    snapshotValidity.approvalSnapshotValid &&
    snapshotValidity.quoteSnapshotValid &&
    snapshotValidity.conversionSnapshotValid;

  // ── blocking reasons (hard 우선 → soft) ──
  const blockingReasons: POCreatedBlockingReason[] = [];

  if (!quoteSnapshotValid) {
    blockingReasons.push({
      code: "quote_snapshot_invalidated",
      severity: "hard",
      message: "견적 shortlist snapshot 무효",
      remediation: "견적 재평가 후 다시 진행",
    });
  }

  for (const b of dispatchGovernance.hardBlockers) {
    blockingReasons.push(mapBlocker(b));
  }
  for (const b of dispatchGovernance.softBlockers) {
    blockingReasons.push(mapBlocker(b));
  }

  // PO Created 자체의 send-critical 누락은 governance에서도 잡지만,
  // hand-off 이전 단계에서 이미 알 수 있으므로 보강한다.
  const poValidation = validatePoCreatedBeforeDispatchPrep(poCreatedState);
  for (const issue of poValidation.blockingIssues) {
    if (!blockingReasons.some((r) => r.message === issue)) {
      blockingReasons.push({
        code: "po_created_blocking_issue",
        severity: "hard",
        message: issue,
        remediation: poValidation.recommendedNextAction,
      });
    }
  }

  // ── supplier-facing payload status ──
  let supplierFacingPayloadStatus: SupplierFacingPayloadStatus;
  if (!allSnapshotsValid) {
    supplierFacingPayloadStatus = "stale";
  } else if (dispatchGovernance.hardBlockers.length > 0 || !dispatchGovernance.supplierFacingPayloadComplete) {
    supplierFacingPayloadStatus = "not_ready";
  } else if (
    dispatchGovernance.readiness === "ready_to_send" ||
    dispatchGovernance.readiness === "scheduled" ||
    dispatchGovernance.readiness === "sent"
  ) {
    supplierFacingPayloadStatus = "locked";
  } else {
    supplierFacingPayloadStatus = "draft";
  }

  // ── reentry available actions (governance 결과로만 결정 — optimistic unlock 금지) ──
  const reentryAvailableActions: ReentryActionKey[] = [];
  const decisionOptions = buildPoCreatedDecisionOptions(poCreatedState);

  // 항상 회수/보정 경로는 열어둔다 (record 자체는 created truth이므로)
  reentryAvailableActions.push("reopen_po_conversion");
  reentryAvailableActions.push("request_correction");
  reentryAvailableActions.push("cancel_dispatch_prep");

  if (decisionOptions.canHold) {
    reentryAvailableActions.push("hold");
  }

  // dispatch prep 진입은 hard blocker가 없을 때만 (quote snapshot 포함)
  const noHardBlockers =
    dispatchGovernance.hardBlockers.length === 0 && allSnapshotsValid && poValidation.canRecordPoCreated;

  if (noHardBlockers && decisionOptions.canOpenDispatchPrep) {
    reentryAvailableActions.push("open_dispatch_prep");
  }

  // send_now / schedule_send 는 handoff boundary guard 결과로만 결정.
  // 과거에는 inline 조건으로 판정했으나, Batch 2 에서 도입한
  // canCreateExecution 이 governance ↔ execution 경계의 단일 진입점이므로
  // 여기서도 동일 guard 를 호출해 두 경로가 절대 엇나가지 않도록 한다.
  // (optimistic unlock 금지 — guard 결과와 POCreatedRecord 의
  //  reentryAvailableActions 가 항상 일치해야 함)
  const executionGuard = canCreateExecution(dispatchGovernance);
  const sendUnlocked = executionGuard.allowed && noHardBlockers;

  if (sendUnlocked) {
    reentryAvailableActions.push("send_now");
    reentryAvailableActions.push("schedule_send");
  }

  // ── next action message (UI 첫 노출용) ──
  const nextAction = resolveNextActionMessage({
    snapshotValidity,
    dispatchReadiness: dispatchGovernance.readiness,
    blockingReasons,
    sendUnlocked,
    decisionReasonSummary: decisionOptions.decisionReasonSummary,
  });

  return {
    id: `pocreatedrec_${Date.now().toString(36)}`,
    poCreatedObjectId: poCreatedState.poCreatedObjectId,
    approvalDecisionObjectId: poCreatedState.approvalDecisionObjectId,
    poConversionDraftObjectId: poCreatedState.poConversionDraftObjectId,
    quoteShortlistSnapshotId,
    nextAction,
    dispatchReadiness: dispatchGovernance.readiness,
    supplierFacingPayloadStatus,
    snapshotValidity,
    blockingReasons,
    reentryAvailableActions,
    evaluatedAt: new Date().toISOString(),
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════════════════════

function mapBlocker(b: DispatchBlocker): POCreatedBlockingReason {
  return {
    code: b.type,
    severity: b.severity,
    message: b.detail,
    remediation: b.remediationAction,
  };
}

function resolveNextActionMessage(args: {
  snapshotValidity: POCreatedSnapshotValidity;
  dispatchReadiness: DispatchGovernanceReadiness;
  blockingReasons: POCreatedBlockingReason[];
  sendUnlocked: boolean;
  decisionReasonSummary: string;
}): string {
  if (args.snapshotValidity.reason) {
    return args.snapshotValidity.reason;
  }
  const firstHard = args.blockingReasons.find((r) => r.severity === "hard");
  if (firstHard) {
    return `${firstHard.message} → ${firstHard.remediation}`;
  }
  if (args.sendUnlocked) {
    return "발송 준비 완료 — Send now 또는 Schedule send 가능";
  }
  if (args.dispatchReadiness === "needs_review") {
    const firstSoft = args.blockingReasons.find((r) => r.severity === "soft");
    if (firstSoft) {
      return `검토 필요: ${firstSoft.message} → ${firstSoft.remediation}`;
    }
    return "Dispatch Preparation에서 검토 진행";
  }
  if (args.dispatchReadiness === "ready_to_send") {
    return "발송 전 confirmation checklist 완료 필요";
  }
  return args.decisionReasonSummary;
}
