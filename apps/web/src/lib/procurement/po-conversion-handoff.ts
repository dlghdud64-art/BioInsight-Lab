/**
 * PO Conversion Handoff Pipeline
 *
 * approval → PO conversion의 canonical handoff를 하나의 pipeline으로 고정.
 *
 * 고정 규칙:
 * 1. PO conversion entry는 approved 이후에만 열린다. approval bypass 금지.
 * 2. POConversionDraft seed는 approve commit 시 즉시 생성. auto-create PO 금지.
 * 3. approved = decision truth. po_conversion = 다음 작업 stage. 혼동 금지.
 * 4. PO draft는 seeded → editing → ready_for_po_creation 순서로만 진행.
 * 5. PO creation 확정은 별도 operator action. approve만으로 PO 확정 금지.
 * 6. source linkage: requestAssembly → compare → quote → approval → PO 전체 traceable.
 */

import type { ProcurementCase, ProcurementStage } from "./procurement-case";
import type { ApprovalDraft, ApprovalDecisionRecord } from "./approval-workbench";
import type { ExtendedPOConversionDraft, PODraftStatus } from "./approval-decision-pipeline";
import { createExtendedPOConversionDraft } from "./approval-decision-pipeline";
import { createAuditEvent, type ApprovalAuditEvent } from "./approval-post-decision";

// ══════════════════════════════════════════════════════════════════════════════
// Handoff Eligibility
// ══════════════════════════════════════════════════════════════════════════════

export interface POConversionHandoffEligibility {
  eligible: boolean;
  blockers: string[];
}

export function checkPOConversionHandoffEligibility(
  procCase: ProcurementCase,
  draft: ApprovalDraft | null,
  latestDecision: ApprovalDecisionRecord | null
): POConversionHandoffEligibility {
  const blockers: string[] = [];

  if (procCase.stage !== "approved" && procCase.stage !== "po_conversion") {
    blockers.push("case_not_approved");
  }
  if (procCase.approvalStatus !== "approved") {
    blockers.push("approval_not_approved");
  }
  if (!draft || draft.status !== "approved") {
    blockers.push("draft_not_approved");
  }
  if (!draft?.selectedSupplierId) {
    blockers.push("no_selected_supplier");
  }
  if (!latestDecision || latestDecision.decision !== "approved") {
    blockers.push("no_approval_decision_record");
  }

  return { eligible: blockers.length === 0, blockers };
}

// ══════════════════════════════════════════════════════════════════════════════
// Handoff Pipeline (approve → PO seed → stage transition)
// ══════════════════════════════════════════════════════════════════════════════

export interface POConversionHandoffResult {
  poDraft: ExtendedPOConversionDraft;
  caseUpdate: Partial<ProcurementCase>;
  auditEvent: ApprovalAuditEvent;
}

export function executePOConversionHandoff(input: {
  procCase: ProcurementCase;
  draft: ApprovalDraft;
  decisionRecordId: string;
  approvedBy?: string;
}): POConversionHandoffResult {
  const now = new Date().toISOString();

  const poDraft = createExtendedPOConversionDraft({
    procurementCaseId: input.procCase.procurementCaseId,
    sourceApprovalDecisionId: input.decisionRecordId,
    sourceRequestAssemblyId: input.procCase.sourceRequestAssemblyId,
    sourceCompareSessionId: input.procCase.sourceCompareSessionId,
    selectedSupplierId: input.draft.selectedSupplierId!,
    itemIds: input.procCase.itemIds,
    rationale: input.draft.reviewRationale,
    approvedBy: input.approvedBy,
  });

  const caseUpdate: Partial<ProcurementCase> = {
    stage: "po_conversion" as ProcurementStage,
    updatedAt: now,
  };

  const auditEvent = createAuditEvent({
    procurementCaseId: input.procCase.procurementCaseId,
    approvalDraftId: input.draft.approvalDraftId,
    type: "po_conversion_draft_created",
    actorId: input.approvedBy,
    summary: `PO 전환 준비 시작 — ${poDraft.poConversionDraftId}`,
    metadata: {
      poDraftId: poDraft.poConversionDraftId,
      selectedSupplierId: input.draft.selectedSupplierId,
      quotedTotal: input.draft.quoteSummarySnapshot.lowestQuotedTotal,
    },
  });

  return { poDraft, caseUpdate, auditEvent };
}

// ══════════════════════════════════════════════════════════════════════════════
// PO Draft Progression
// ══════════════════════════════════════════════════════════════════════════════

export function advancePODraftStatus(
  current: PODraftStatus,
  target: PODraftStatus
): PODraftStatus | null {
  const validTransitions: Record<PODraftStatus, PODraftStatus[]> = {
    seeded: ["editing"],
    editing: ["ready_for_po_creation"],
    ready_for_po_creation: [], // PO creation은 별도 action
  };

  if (!validTransitions[current]?.includes(target)) return null;
  return target;
}

// ══════════════════════════════════════════════════════════════════════════════
// PO Conversion Workbench Model
// ══════════════════════════════════════════════════════════════════════════════

export interface POConversionWorkbenchModel {
  procurementCase: ProcurementCase | null;
  poDraft: ExtendedPOConversionDraft | null;
  handoffEligibility: POConversionHandoffEligibility;
  sourceTrail: POSourceTrail;
  shouldRender: boolean;
  nextActionLabel: string | null;
}

export interface POSourceTrail {
  requestAssemblyId: string | null;
  compareSessionId: string | null;
  selectedDecisionItemId: string | null;
  approvalDraftId: string | null;
  approvalDecisionId: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
}

export function buildPOConversionWorkbenchModel(input: {
  procCase: ProcurementCase | null;
  poDraft: ExtendedPOConversionDraft | null;
  approvalDraft: ApprovalDraft | null;
  latestDecision: ApprovalDecisionRecord | null;
}): POConversionWorkbenchModel {
  const { procCase, poDraft, approvalDraft, latestDecision } = input;

  if (!procCase) {
    return {
      procurementCase: null,
      poDraft: null,
      handoffEligibility: { eligible: false, blockers: ["no_case"] },
      sourceTrail: emptySourceTrail(),
      shouldRender: false,
      nextActionLabel: null,
    };
  }

  const eligibility = checkPOConversionHandoffEligibility(procCase, approvalDraft, latestDecision);

  const sourceTrail: POSourceTrail = {
    requestAssemblyId: procCase.sourceRequestAssemblyId,
    compareSessionId: procCase.sourceCompareSessionId,
    selectedDecisionItemId: procCase.selectedDecisionItemId,
    approvalDraftId: approvalDraft?.approvalDraftId ?? null,
    approvalDecisionId: latestDecision ? `${latestDecision.procurementCaseId}_${latestDecision.createdAt}` : null,
    approvedAt: poDraft?.approvalSnapshot.approvedAt ?? null,
    approvedBy: poDraft?.approvalSnapshot.approvedBy ?? null,
  };

  let nextActionLabel: string | null = null;
  if (poDraft) {
    switch (poDraft.draftStatus) {
      case "seeded": nextActionLabel = "PO 전환 조건 검토 시작"; break;
      case "editing": nextActionLabel = "PO 생성 준비 완료 확인"; break;
      case "ready_for_po_creation": nextActionLabel = "PO 생성 요청"; break;
    }
  } else if (eligibility.eligible) {
    nextActionLabel = "PO 전환 준비 시작";
  }

  return {
    procurementCase: procCase,
    poDraft,
    handoffEligibility: eligibility,
    sourceTrail,
    shouldRender: procCase.stage === "approved" || procCase.stage === "po_conversion",
    nextActionLabel,
  };
}

function emptySourceTrail(): POSourceTrail {
  return {
    requestAssemblyId: null,
    compareSessionId: null,
    selectedDecisionItemId: null,
    approvalDraftId: null,
    approvalDecisionId: null,
    approvedAt: null,
    approvedBy: null,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Full Chain Traceability
// ══════════════════════════════════════════════════════════════════════════════

export interface FullProcurementChainTrace {
  procurementCaseId: string;
  stages: {
    sourcing: { query: string | null; compareSessionId: string | null };
    compare: { selectedDecisionItemId: string | null };
    request: { requestAssemblyId: string };
    quote: { supplierIds: string[]; respondedCount: number };
    approval: { decision: string | null; approvedAt: string | null };
    poConversion: { draftId: string | null; status: PODraftStatus | null };
  };
}

export function buildFullProcurementChainTrace(input: {
  procCase: ProcurementCase;
  poDraft: ExtendedPOConversionDraft | null;
  latestDecision: ApprovalDecisionRecord | null;
}): FullProcurementChainTrace {
  return {
    procurementCaseId: input.procCase.procurementCaseId,
    stages: {
      sourcing: {
        query: null, // sourcing query는 case에서 직접 추적 불가 — future enhancement
        compareSessionId: input.procCase.sourceCompareSessionId,
      },
      compare: {
        selectedDecisionItemId: input.procCase.selectedDecisionItemId,
      },
      request: {
        requestAssemblyId: input.procCase.sourceRequestAssemblyId,
      },
      quote: {
        supplierIds: input.procCase.supplierIds,
        respondedCount: input.procCase.procurementSummary.respondedSuppliers,
      },
      approval: {
        decision: input.latestDecision?.decision ?? null,
        approvedAt: input.latestDecision?.createdAt ?? null,
      },
      poConversion: {
        draftId: input.poDraft?.poConversionDraftId ?? null,
        status: input.poDraft?.draftStatus ?? null,
      },
    },
  };
}
