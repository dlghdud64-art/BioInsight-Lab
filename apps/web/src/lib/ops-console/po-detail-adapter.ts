/**
 * ops-console/po-detail-adapter.ts
 *
 * PO Detail Execution Console용 어댑터.
 * po-approval-contract + approval execution + acknowledgement + view-models를
 * 하나의 실행 모델로 통합한다.
 *
 * contract.ts는 건드리지 않고 UI adapter 레이어에서만 파생.
 */

import type {
  PurchaseOrderContract,
  PurchaseOrderLineContract,
  ApprovalExecutionContract,
  ApprovalStepContract,
  PurchaseOrderAcknowledgementContract,
  PurchaseOrderLineAcknowledgementContract,
  ApprovalStepType,
} from "../review-queue/po-approval-contract";
import {
  APPROVAL_STEP_TYPE_DESCRIPTIONS,
} from "../review-queue/po-approval-contract";
import {
  resolveRequiredByState,
  resolveIssueReadiness,
  resolveReceivingHandoffReadiness,
  calculateLineProgress,
  type ReadinessLevel,
  type ReceivingReadinessLevel,
} from "../review-queue/po-approval-view-models";

// ---------------------------------------------------------------------------
// 1. PO Execution State — 6단계 실행 흐름을 하나로 표현
// ---------------------------------------------------------------------------

export type POExecutionPhase =
  | "approval_pending"
  | "approval_in_progress"
  | "approval_returned"
  | "approved_not_issued"
  | "issued_ack_pending"
  | "issued_ack_partial"
  | "acknowledged"
  | "receiving_handoff_ready"
  | "partially_received"
  | "received"
  | "closed"
  | "cancelled"
  | "on_hold"
  | "rejected";

export interface POExecutionState {
  /** 현재 실행 단계 */
  phase: POExecutionPhase;
  /** 단계 라벨 (Korean) */
  phaseLabel: string;
  /** 단계 톤 */
  phaseTone: "neutral" | "info" | "warning" | "danger" | "success";
}

// ---------------------------------------------------------------------------
// 2. Approval Progress Summary
// ---------------------------------------------------------------------------

export interface ApprovalProgressSummary {
  /** 전체 상태 라벨 */
  overallLabel: string;
  /** 전체 톤 */
  overallTone: "neutral" | "info" | "warning" | "danger" | "success";
  /** 완료 / 전체 */
  completedCount: number;
  totalCount: number;
  /** 현재 단계 */
  currentStep: ApprovalStepSummary | null;
  /** 대기 승인자 */
  pendingApprovers: string[];
  /** 기한 초과 단계 수 */
  overdueStepCount: number;
  /** 반송 사유 */
  returnReason: string | null;
  /** 조건부 승인 조건 */
  conditionalNotes: string[];
  /** 단계별 요약 */
  steps: ApprovalStepSummary[];
  /** "누가 막고 있는가" 요약 */
  blockerLabel: string | null;
  /** escalation 필요 */
  needsEscalation: boolean;
}

export interface ApprovalStepSummary {
  id: string;
  order: number;
  typeLabel: string;
  statusLabel: string;
  statusTone: "neutral" | "info" | "warning" | "danger" | "success";
  assignees: string[];
  decisionLabel: string | null;
  isOverdue: boolean;
  isCurrent: boolean;
}

// ---------------------------------------------------------------------------
// 3. Issue Readiness
// ---------------------------------------------------------------------------

export interface IssueReadinessSummary {
  readiness: ReadinessLevel;
  label: string;
  blockers: string[];
  missingContext: string[];
  canIssue: boolean;
}

// ---------------------------------------------------------------------------
// 4. Acknowledgement Summary
// ---------------------------------------------------------------------------

export type AckPhase =
  | "not_applicable"
  | "not_sent"
  | "ack_pending"
  | "viewed"
  | "partially_confirmed"
  | "acknowledged"
  | "needs_review"
  | "declined";

export interface AcknowledgementSummary {
  phase: AckPhase;
  phaseLabel: string;
  phaseTone: "neutral" | "info" | "warning" | "danger" | "success";
  vendorRef: string | null;
  promisedShipLabel: string | null;
  promisedDeliveryLabel: string | null;
  lineConfirmations: LineConfirmationSummary[];
  backorderCount: number;
  substituteCount: number;
  issueCount: number;
  followUpOwner: string | null;
  followUpAction: string | null;
  waitingExternalLabel: string | null;
}

export interface LineConfirmationSummary {
  poLineId: string;
  lineNumber: number;
  itemName: string;
  status: string;
  statusLabel: string;
  confirmedQty: number | null;
  backorderQty: number | null;
  confirmedDelivery: string | null;
  hasIssue: boolean;
}

// ---------------------------------------------------------------------------
// 5. Receiving Handoff Readiness
// ---------------------------------------------------------------------------

export interface ReceivingHandoffSummary {
  readiness: ReceivingReadinessLevel;
  label: string;
  blockers: string[];
  nextOwner: string | null;
  targetRoute: string;
  lineReadiness: LineReceivingReadiness[];
  downstreamImpact: string | null;
}

export interface LineReceivingReadiness {
  lineNumber: number;
  itemName: string;
  ready: boolean;
  reason: string | null;
}

// ---------------------------------------------------------------------------
// 6. Line Execution Summary
// ---------------------------------------------------------------------------

export interface LineExecutionSummary {
  id: string;
  lineNumber: number;
  itemLabel: string;
  orderedSummary: string;
  expectedDelivery: string | null;
  fulfillmentLabel: string;
  fulfillmentTone: "neutral" | "info" | "warning" | "danger" | "success";
  substituteFlag: boolean;
  documentCoverage: string;
  riskSummary: string | null;
  receivingRelevance: string;
  nextAction: string | null;
}

// ---------------------------------------------------------------------------
// 7. Upstream Origin Summary
// ---------------------------------------------------------------------------

export interface OriginSummary {
  sourceType: "quote" | "manual" | "reorder" | "contract";
  sourceLabel: string;
  quoteRef: string | null;
  quoteRoute: string | null;
  comparisonRef: string | null;
  vendorSummary: string;
  requiredByLabel: string;
  requiredByTone: "normal" | "due_soon" | "overdue";
  urgencyLabel: string;
  returnRoute: string;
}

// ---------------------------------------------------------------------------
// 8. Unified PO Execution Model
// ---------------------------------------------------------------------------

export interface POExecutionModel {
  poExecutionState: POExecutionState;
  approvalProgress: ApprovalProgressSummary;
  issueReadiness: IssueReadinessSummary;
  acknowledgement: AcknowledgementSummary;
  receivingHandoff: ReceivingHandoffSummary;
  lineExecutions: LineExecutionSummary[];
  origin: OriginSummary;
  blockedReasonSummary: string | null;
  waitingExternalSummary: string | null;
  nextOwnerName: string | null;
  nextRoute: string | null;
  nextActionSummary: string;
}

// ===========================================================================
// Builder Functions
// ===========================================================================

const STEP_STATUS_LABELS: Record<string, string> = {
  waiting: "대기",
  active: "진행 중",
  approved: "승인",
  rejected: "반려",
  returned: "반송",
  skipped: "건너뜀",
  expired: "만료",
};

const STEP_STATUS_TONES: Record<string, "neutral" | "info" | "warning" | "danger" | "success"> = {
  waiting: "neutral",
  active: "info",
  approved: "success",
  rejected: "danger",
  returned: "warning",
  skipped: "neutral",
  expired: "danger",
};

const FULFILLMENT_LABELS: Record<string, string> = {
  open: "미처리",
  confirmed: "확인됨",
  partially_received: "부분 입고",
  received: "입고 완료",
  backordered: "재입고 대기",
  cancelled: "취소",
  issue_flagged: "이슈 발생",
};

const FULFILLMENT_TONES: Record<string, "neutral" | "info" | "warning" | "danger" | "success"> = {
  open: "neutral",
  confirmed: "info",
  partially_received: "warning",
  received: "success",
  backordered: "warning",
  cancelled: "neutral",
  issue_flagged: "danger",
};

const LINE_ACK_LABELS: Record<string, string> = {
  confirmed: "확인",
  backordered: "재입고",
  substituted: "대체품",
  declined: "거절",
  pending: "대기",
};

// ---------------------------------------------------------------------------
// resolveExecutionPhase
// ---------------------------------------------------------------------------

export function resolveExecutionPhase(
  po: PurchaseOrderContract,
  approval: ApprovalExecutionContract | undefined,
  ack: PurchaseOrderAcknowledgementContract | undefined,
): POExecutionState {
  if (po.status === "cancelled") return { phase: "cancelled", phaseLabel: "취소", phaseTone: "neutral" };
  if (po.status === "closed") return { phase: "closed", phaseLabel: "마감", phaseTone: "neutral" };
  if (po.status === "on_hold") return { phase: "on_hold", phaseLabel: "보류", phaseTone: "warning" };
  if (po.status === "rejected") return { phase: "rejected", phaseLabel: "반려", phaseTone: "danger" };
  if (po.status === "received") return { phase: "received", phaseLabel: "입고 완료", phaseTone: "success" };
  if (po.status === "partially_received") return { phase: "partially_received", phaseLabel: "부분 입고", phaseTone: "warning" };

  // Acknowledged + ready for receiving
  if (po.status === "acknowledged") {
    const handoff = resolveReceivingHandoffReadiness(po, ack);
    if (handoff.readiness === "ready") {
      return { phase: "receiving_handoff_ready", phaseLabel: "입고 인계 가능", phaseTone: "success" };
    }
    return { phase: "acknowledged", phaseLabel: "공급사 확인 완료", phaseTone: "success" };
  }

  // Issued — check ack state
  if (po.status === "issued") {
    if (ack?.status === "partially_confirmed") {
      return { phase: "issued_ack_partial", phaseLabel: "부분 확인", phaseTone: "warning" };
    }
    return { phase: "issued_ack_pending", phaseLabel: "공급사 확인 대기", phaseTone: "info" };
  }

  // Approved / ready_to_issue
  if (po.status === "approved" || po.status === "ready_to_issue") {
    return { phase: "approved_not_issued", phaseLabel: "발행 대기", phaseTone: "info" };
  }

  // Approval returned
  if (approval?.status === "returned") {
    return { phase: "approval_returned", phaseLabel: "승인 반송", phaseTone: "warning" };
  }

  // Approval in progress
  if (po.status === "approval_in_progress" || approval?.status === "in_progress") {
    return { phase: "approval_in_progress", phaseLabel: "승인 진행 중", phaseTone: "warning" };
  }

  return { phase: "approval_pending", phaseLabel: "승인 대기", phaseTone: "warning" };
}

// ---------------------------------------------------------------------------
// buildApprovalProgress
// ---------------------------------------------------------------------------

export function buildApprovalProgress(
  approval: ApprovalExecutionContract | undefined,
): ApprovalProgressSummary {
  if (!approval) {
    return {
      overallLabel: "승인 정보 없음",
      overallTone: "neutral",
      completedCount: 0,
      totalCount: 0,
      currentStep: null,
      pendingApprovers: [],
      overdueStepCount: 0,
      returnReason: null,
      conditionalNotes: [],
      steps: [],
      blockerLabel: null,
      needsEscalation: false,
    };
  }

  const completedSteps = approval.steps.filter(
    (s) => s.status === "approved" || s.status === "rejected" || s.status === "skipped",
  );
  const activeStep = approval.steps.find((s) => s.status === "active");
  const overdueSteps = approval.steps.filter((s) => {
    if (!s.slaDueAt || s.status !== "active") return false;
    return new Date(s.slaDueAt).getTime() < Date.now();
  });

  // Return reason
  const returnedStep = approval.steps.find((s) => s.status === "returned");
  const returnReason = returnedStep?.decisions.find((d) => d.decision === "returned")?.comment ?? null;

  // Conditional notes
  const conditionalNotes: string[] = [];
  for (const step of approval.steps) {
    for (const d of step.decisions) {
      if (d.decision === "conditional" && d.conditions) {
        conditionalNotes.push(...d.conditions);
      }
    }
  }

  const steps: ApprovalStepSummary[] = approval.steps.map((s) => ({
    id: s.id,
    order: s.stepOrder,
    typeLabel: APPROVAL_STEP_TYPE_DESCRIPTIONS[s.stepType]?.label ?? s.stepType,
    statusLabel: STEP_STATUS_LABELS[s.status] ?? s.status,
    statusTone: STEP_STATUS_TONES[s.status] ?? "neutral",
    assignees: s.assigneeIds,
    decisionLabel: s.decisions[0]?.comment ?? null,
    isOverdue: !!s.slaDueAt && s.status === "active" && new Date(s.slaDueAt).getTime() < Date.now(),
    isCurrent: s.status === "active",
  }));

  const currentStepSummary = activeStep ? steps.find((s) => s.id === activeStep.id) ?? null : null;

  // Blocker label
  let blockerLabel: string | null = null;
  if (activeStep) {
    const assigneeStr = activeStep.assigneeIds.join(", ");
    const typeLabel = APPROVAL_STEP_TYPE_DESCRIPTIONS[activeStep.stepType]?.label ?? activeStep.stepType;
    blockerLabel = `${typeLabel} — ${assigneeStr} 승인 대기`;
    if (overdueSteps.length > 0) {
      blockerLabel = `${typeLabel} — ${assigneeStr} 승인 SLA 초과`;
    }
  }

  // Overall tone
  let overallTone: ApprovalProgressSummary["overallTone"] = "neutral";
  if (approval.status === "approved") overallTone = "success";
  else if (approval.status === "rejected") overallTone = "danger";
  else if (approval.status === "returned" || approval.status === "expired") overallTone = "warning";
  else if (overdueSteps.length > 0) overallTone = "danger";
  else if (approval.status === "in_progress") overallTone = "info";

  const overallLabelMap: Record<string, string> = {
    not_started: "승인 시작 전",
    in_progress: `승인 ${completedSteps.length}/${approval.steps.length} 진행`,
    approved: "승인 완료",
    rejected: "반려",
    returned: "수정 요청 반송",
    cancelled: "승인 취소",
    expired: "승인 만료",
  };

  return {
    overallLabel: overallLabelMap[approval.status] ?? approval.status,
    overallTone,
    completedCount: completedSteps.length,
    totalCount: approval.steps.length,
    currentStep: currentStepSummary,
    pendingApprovers: activeStep?.assigneeIds ?? [],
    overdueStepCount: overdueSteps.length,
    returnReason,
    conditionalNotes,
    steps,
    blockerLabel,
    needsEscalation: overdueSteps.length > 0,
  };
}

// ---------------------------------------------------------------------------
// buildIssueReadiness
// ---------------------------------------------------------------------------

export function buildIssueReadiness(
  po: PurchaseOrderContract,
  approval: ApprovalExecutionContract | undefined,
): IssueReadinessSummary {
  const base = resolveIssueReadiness(po.status, approval?.status ?? "not_started");
  const missingContext: string[] = [];

  // Check issue context completeness
  if (!po.shipToLocation) missingContext.push("배송지 미입력");
  if (!po.billToEntity) missingContext.push("청구 법인 미입력");
  if (!po.paymentTerms) missingContext.push("결제 조건 미입력");
  if (po.lines.length === 0) missingContext.push("발주 라인 없음");

  // Conditional approval → needs_review
  const hasConditional = approval?.steps.some(
    (s) => s.decisions.some((d) => d.decision === "conditional"),
  );

  let readiness = base.readiness;
  const blockers = [...base.blockers, ...missingContext.map((m) => `발행 조건 미충족: ${m}`)];

  if (readiness === "ready" && (missingContext.length > 0 || hasConditional)) {
    readiness = "needs_review";
  }

  const labelMap: Record<ReadinessLevel, string> = {
    ready: "발행 가능",
    needs_review: "발행 전 검토 필요",
    blocked: "발행 차단",
  };

  return {
    readiness,
    label: labelMap[readiness],
    blockers,
    missingContext,
    canIssue: readiness === "ready",
  };
}

// ---------------------------------------------------------------------------
// buildAcknowledgementSummary
// ---------------------------------------------------------------------------

export function buildAcknowledgementSummary(
  po: PurchaseOrderContract,
  ack: PurchaseOrderAcknowledgementContract | undefined,
): AcknowledgementSummary {
  const issuedStatuses = ["issued", "acknowledged", "partially_received", "received"];
  if (!issuedStatuses.includes(po.status)) {
    return {
      phase: "not_applicable",
      phaseLabel: "발행 전",
      phaseTone: "neutral",
      vendorRef: null,
      promisedShipLabel: null,
      promisedDeliveryLabel: null,
      lineConfirmations: [],
      backorderCount: 0,
      substituteCount: 0,
      issueCount: 0,
      followUpOwner: null,
      followUpAction: null,
      waitingExternalLabel: null,
    };
  }

  if (!ack) {
    return {
      phase: "ack_pending",
      phaseLabel: "공급사 확인 대기",
      phaseTone: "warning",
      vendorRef: null,
      promisedShipLabel: null,
      promisedDeliveryLabel: null,
      lineConfirmations: [],
      backorderCount: 0,
      substituteCount: 0,
      issueCount: 0,
      followUpOwner: po.ownerId,
      followUpAction: "공급사에 발주 확인 요청",
      waitingExternalLabel: "공급사 확인 미응답",
    };
  }

  const phaseMap: Record<string, { phase: AckPhase; label: string; tone: AcknowledgementSummary["phaseTone"] }> = {
    not_sent: { phase: "not_sent", label: "미전송", tone: "neutral" },
    sent: { phase: "ack_pending", label: "확인 대기", tone: "warning" },
    viewed: { phase: "viewed", label: "열람 완료", tone: "info" },
    acknowledged: { phase: "acknowledged", label: "확인 완료", tone: "success" },
    partially_confirmed: { phase: "partially_confirmed", label: "부분 확인", tone: "warning" },
    declined: { phase: "declined", label: "거절", tone: "danger" },
    needs_review: { phase: "needs_review", label: "검토 필요", tone: "warning" },
  };

  const mapped = phaseMap[ack.status] ?? { phase: "ack_pending" as AckPhase, label: ack.status, tone: "neutral" as const };

  const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString("ko-KR") : null;

  const lineConfirmations: LineConfirmationSummary[] = ack.lineConfirmations.map((lc) => {
    const poLine = po.lines.find((l) => l.id === lc.poLineId);
    return {
      poLineId: lc.poLineId,
      lineNumber: poLine?.lineNumber ?? 0,
      itemName: poLine?.itemName ?? "-",
      status: lc.status,
      statusLabel: LINE_ACK_LABELS[lc.status] ?? lc.status,
      confirmedQty: lc.confirmedQuantity ?? null,
      backorderQty: lc.backorderQuantity ?? null,
      confirmedDelivery: fmtDate(lc.confirmedDeliveryAt),
      hasIssue: (lc.issues?.length ?? 0) > 0,
    };
  });

  const backorderCount = lineConfirmations.filter((lc) => lc.status === "backordered").length;
  const substituteCount = lineConfirmations.filter((lc) => lc.status === "substituted").length;
  const issueCount = lineConfirmations.filter((lc) => lc.hasIssue).length;

  // Follow-up logic
  let followUpOwner: string | null = null;
  let followUpAction: string | null = null;
  let waitingExternalLabel: string | null = null;

  if (ack.status === "sent" || ack.status === "viewed") {
    followUpOwner = po.ownerId;
    followUpAction = "공급사 확인 독촉";
    waitingExternalLabel = "공급사 확인 대기 중";
  }
  if (ack.status === "partially_confirmed") {
    followUpOwner = po.ownerId;
    followUpAction = "미확인 품목 공급사 재확인";
    waitingExternalLabel = `${lineConfirmations.filter((l) => l.status === "pending").length}건 미확인`;
  }
  if (ack.status === "needs_review") {
    followUpOwner = po.ownerId;
    followUpAction = "공급사 이슈 검토";
  }
  if (ack.status === "declined") {
    followUpOwner = po.ownerId;
    followUpAction = "대체 공급사 확인 또는 재발주";
  }

  return {
    phase: mapped.phase,
    phaseLabel: mapped.label,
    phaseTone: mapped.tone,
    vendorRef: ack.vendorReferenceNumber ?? null,
    promisedShipLabel: fmtDate(ack.promisedShipAt),
    promisedDeliveryLabel: fmtDate(ack.promisedDeliveryAt),
    lineConfirmations,
    backorderCount,
    substituteCount,
    issueCount,
    followUpOwner,
    followUpAction,
    waitingExternalLabel,
  };
}

// ---------------------------------------------------------------------------
// buildReceivingHandoff
// ---------------------------------------------------------------------------

export function buildReceivingHandoff(
  po: PurchaseOrderContract,
  ack: PurchaseOrderAcknowledgementContract | undefined,
): ReceivingHandoffSummary {
  const base = resolveReceivingHandoffReadiness(po, ack);

  const lineReadiness: LineReceivingReadiness[] = po.lines
    .filter((l) => l.fulfillmentStatus !== "cancelled")
    .map((l) => {
      const lc = ack?.lineConfirmations.find((c) => c.poLineId === l.id);
      const ready = l.fulfillmentStatus !== "issue_flagged" && (!!lc || !!l.expectedDeliveryAt);
      return {
        lineNumber: l.lineNumber,
        itemName: l.itemName,
        ready,
        reason: !ready
          ? l.fulfillmentStatus === "issue_flagged"
            ? "이슈 플래그"
            : "납기 정보 미확인"
          : null,
      };
    });

  const readyCount = lineReadiness.filter((l) => l.ready).length;
  const totalCount = lineReadiness.length;

  const labelMap: Record<ReceivingReadinessLevel, string> = {
    ready: `입고 인계 가능 — ${readyCount}/${totalCount} 라인 준비`,
    partial: `부분 인계 가능 — ${readyCount}/${totalCount} 라인 준비`,
    blocked: "입고 인계 차단",
  };

  let downstreamImpact: string | null = null;
  if (base.readiness === "blocked") {
    downstreamImpact = "입고 배치 생성 불가 → 재고 갱신 지연";
  } else if (base.readiness === "partial") {
    downstreamImpact = "일부 품목만 입고 가능 → 잔량 추적 필요";
  }

  return {
    readiness: base.readiness,
    label: labelMap[base.readiness],
    blockers: base.blockers,
    nextOwner: base.readiness !== "blocked" ? "입고 담당자" : null,
    targetRoute: "/dashboard/receiving",
    lineReadiness,
    downstreamImpact,
  };
}

// ---------------------------------------------------------------------------
// buildLineExecutions
// ---------------------------------------------------------------------------

export function buildLineExecutions(
  po: PurchaseOrderContract,
  ack: PurchaseOrderAcknowledgementContract | undefined,
): LineExecutionSummary[] {
  return po.lines.map((line) => {
    const lc = ack?.lineConfirmations.find((c) => c.poLineId === line.id);

    const docTypes = line.requiredDocuments ?? [];
    const docCoverage = docTypes.length > 0
      ? docTypes.map((d) => d.toUpperCase()).join(" · ")
      : "필수 문서 없음";

    const riskSummary = line.riskFlags.length > 0
      ? line.riskFlags.join(", ")
      : null;

    const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString("ko-KR") : null;
    const expectedDelivery = fmtDate(lc?.confirmedDeliveryAt) ?? fmtDate(line.expectedDeliveryAt);

    // Receiving relevance
    let receivingRelevance = "미처리";
    if (line.fulfillmentStatus === "received") receivingRelevance = "입고 완료";
    else if (line.fulfillmentStatus === "partially_received") receivingRelevance = `${line.receivedQuantity}/${line.orderedQuantity} 입고`;
    else if (line.fulfillmentStatus === "confirmed") receivingRelevance = "입고 대기";
    else if (line.fulfillmentStatus === "backordered") receivingRelevance = "재입고 대기";
    else if (line.fulfillmentStatus === "issue_flagged") receivingRelevance = "이슈 확인 필요";

    // Next action
    let nextAction: string | null = null;
    if (line.fulfillmentStatus === "issue_flagged") nextAction = "이슈 확인";
    else if (line.fulfillmentStatus === "backordered") nextAction = "재입고 추적";
    else if (line.remainingQuantity > 0 && line.fulfillmentStatus !== "open") nextAction = "잔량 입고 대기";

    return {
      id: line.id,
      lineNumber: line.lineNumber,
      itemLabel: `${line.itemName}${line.catalogNumber ? ` (${line.catalogNumber})` : ""}`,
      orderedSummary: `${line.orderedQuantity} ${line.orderedUnit} × ₩${line.unitPrice.toLocaleString("ko-KR")}`,
      expectedDelivery,
      fulfillmentLabel: FULFILLMENT_LABELS[line.fulfillmentStatus] ?? line.fulfillmentStatus,
      fulfillmentTone: FULFILLMENT_TONES[line.fulfillmentStatus] ?? "neutral",
      substituteFlag: line.substituteApproved,
      documentCoverage: docCoverage,
      riskSummary,
      receivingRelevance,
      nextAction,
    };
  });
}

// ---------------------------------------------------------------------------
// buildOriginSummary
// ---------------------------------------------------------------------------

export function buildOriginSummary(
  po: PurchaseOrderContract,
  vendorName: string,
): OriginSummary {
  const sourceLabels: Record<string, string> = {
    quote: "견적 선정 기반",
    manual: "수동 생성",
    reorder: "재주문 전환",
    contract: "단가 계약 기반",
  };

  const dueState = resolveRequiredByState(po.requiredByAt);

  let urgencyLabel = "일반";
  if (dueState.tone === "overdue") urgencyLabel = "긴급 — 납기 초과";
  else if (dueState.tone === "due_soon") urgencyLabel = "주의 — 납기 임박";

  return {
    sourceType: po.sourceType,
    sourceLabel: sourceLabels[po.sourceType] ?? po.sourceType,
    quoteRef: po.quoteRequestId ?? null,
    quoteRoute: po.quoteRequestId ? `/dashboard/quotes/${po.quoteRequestId}` : null,
    comparisonRef: po.quoteComparisonId ?? null,
    vendorSummary: vendorName,
    requiredByLabel: dueState.label,
    requiredByTone: dueState.tone,
    urgencyLabel,
    returnRoute: "/dashboard/purchase-orders",
  };
}

// ---------------------------------------------------------------------------
// buildPOExecutionModel — unified builder
// ---------------------------------------------------------------------------

export function buildPOExecutionModel(
  po: PurchaseOrderContract,
  approval: ApprovalExecutionContract | undefined,
  ack: PurchaseOrderAcknowledgementContract | undefined,
  vendorName: string,
): POExecutionModel {
  const poExecutionState = resolveExecutionPhase(po, approval, ack);
  const approvalProgress = buildApprovalProgress(approval);
  const issueReadiness = buildIssueReadiness(po, approval);
  const acknowledgement = buildAcknowledgementSummary(po, ack);
  const receivingHandoff = buildReceivingHandoff(po, ack);
  const lineExecutions = buildLineExecutions(po, ack);
  const origin = buildOriginSummary(po, vendorName);

  // Blocked reason summary
  let blockedReasonSummary: string | null = null;
  if (issueReadiness.readiness === "blocked" && issueReadiness.blockers.length > 0) {
    blockedReasonSummary = issueReadiness.blockers[0]!;
  } else if (approvalProgress.blockerLabel) {
    blockedReasonSummary = approvalProgress.blockerLabel;
  }

  // Waiting external summary
  let waitingExternalSummary: string | null = null;
  if (acknowledgement.waitingExternalLabel) {
    waitingExternalSummary = acknowledgement.waitingExternalLabel;
  }

  // Next owner
  let nextOwnerName: string | null = null;
  if (poExecutionState.phase === "approval_pending" || poExecutionState.phase === "approval_in_progress") {
    nextOwnerName = approvalProgress.pendingApprovers[0] ?? null;
  } else if (poExecutionState.phase === "approved_not_issued") {
    nextOwnerName = po.ownerId;
  } else if (poExecutionState.phase === "issued_ack_pending") {
    nextOwnerName = "공급사";
  } else if (poExecutionState.phase === "acknowledged" || poExecutionState.phase === "receiving_handoff_ready") {
    nextOwnerName = "입고 담당자";
  }

  // Next route
  let nextRoute: string | null = null;
  if (poExecutionState.phase === "receiving_handoff_ready" || poExecutionState.phase === "acknowledged") {
    nextRoute = "/dashboard/receiving";
  }

  // Next action summary
  const nextActionMap: Partial<Record<POExecutionPhase, string>> = {
    approval_pending: "승인 진행 확인",
    approval_in_progress: approvalProgress.blockerLabel ?? "승인 진행 중",
    approval_returned: "수정 후 재제출",
    approved_not_issued: "발주서 발행",
    issued_ack_pending: "공급사 확인 독촉",
    issued_ack_partial: "미확인 품목 재확인",
    acknowledged: "입고 인계 준비",
    receiving_handoff_ready: "입고 배치 생성",
    partially_received: "잔량 입고 추적",
    received: "마감 처리",
    closed: "완료",
    cancelled: "—",
    on_hold: "보류 해제 확인",
    rejected: "수정 후 재요청",
  };

  return {
    poExecutionState,
    approvalProgress,
    issueReadiness,
    acknowledgement,
    receivingHandoff,
    lineExecutions,
    origin,
    blockedReasonSummary,
    waitingExternalSummary,
    nextOwnerName,
    nextRoute,
    nextActionSummary: nextActionMap[poExecutionState.phase] ?? "확인",
  };
}
