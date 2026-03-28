/**
 * Request Assembly Engine — 견적 요청 조립 상태 모델 + validator + snapshot
 *
 * 고정 규칙:
 * 1. request assembly = compare 결과를 견적 요청으로 조립하는 별도 운영 단계.
 * 2. request candidate (품목) ≠ vendor target (공급사) — 분리 관리.
 * 3. request line = canonical draft line (이후 quote management 기준).
 * 4. canonical request draft snapshot 없이 submission 진행 금지.
 * 5. compare shortlist를 그대로 submission으로 직행 금지.
 */

import type { CompareDecisionSnapshot, RequestCandidateHandoff } from "./compare-review-engine";

// ══════════════════════════════════════════════════════════════════════════════
// Request Assembly Status
// ══════════════════════════════════════════════════════════════════════════════

export type RequestAssemblyStatus =
  | "request_assembly_ready"
  | "request_assembly_open"
  | "request_draft_recorded";

export type RequestAssemblySubstatus =
  | "awaiting_vendor_targets"
  | "awaiting_request_conditions"
  | "assembly_in_progress"
  | "assembly_blocked"
  | "ready_for_submission_prep";

// ══════════════════════════════════════════════════════════════════════════════
// Request Assembly State
// ══════════════════════════════════════════════════════════════════════════════

export interface RequestAssemblyState {
  requestAssemblyStatus: RequestAssemblyStatus;
  substatus: RequestAssemblySubstatus;
  requestAssemblyOpenedAt: string | null;
  requestAssemblyOpenedBy: "compare_handoff" | "manual" | null;
  compareDecisionSnapshotId: string | null;
  requestCandidateIds: string[];
  targetVendors: VendorTarget[];
  requestLines: RequestDraftLine[];
  requestConditions: RequestConditionDraft;
  requestDraftSnapshotId: string | null;
  requestAssemblyDecisionSummary: string | null;
}

export function createInitialRequestAssemblyState(
  handoff: RequestCandidateHandoff,
  candidateInfos: RequestCandidateInfo[],
): RequestAssemblyState {
  const lines = buildRequestDraftLines(candidateInfos);
  const vendors = buildVendorTargetOptions(candidateInfos);

  return {
    requestAssemblyStatus: "request_assembly_open",
    substatus: vendors.length === 0 ? "awaiting_vendor_targets" : "assembly_in_progress",
    requestAssemblyOpenedAt: new Date().toISOString(),
    requestAssemblyOpenedBy: "compare_handoff",
    compareDecisionSnapshotId: handoff.compareDecisionSnapshotId,
    requestCandidateIds: handoff.requestCandidateIds,
    targetVendors: vendors,
    requestLines: lines,
    requestConditions: buildDefaultRequestConditions(),
    requestDraftSnapshotId: null,
    requestAssemblyDecisionSummary: null,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Request Candidate Info (from product data)
// ══════════════════════════════════════════════════════════════════════════════

export interface RequestCandidateInfo {
  id: string;
  name: string;
  brand: string;
  catalogNumber?: string;
  spec?: string;
  priceKRW: number;
  leadTimeDays: number;
  vendorName?: string;
  vendorId?: string;
}

// ══════════════════════════════════════════════════════════════════════════════
// Vendor Target
// ══════════════════════════════════════════════════════════════════════════════

export interface VendorTarget {
  vendorId: string;
  vendorDisplayName: string;
  included: boolean;
  priority: number;
  lineCoverage: string[];
  vendorNote: string;
}

export function buildVendorTargetOptions(
  candidates: RequestCandidateInfo[],
): VendorTarget[] {
  const vendorMap = new Map<string, { name: string; lineIds: string[] }>();
  candidates.forEach((c) => {
    const vid = c.vendorId || c.vendorName || "unknown";
    const vname = c.vendorName || "미지정 공급사";
    if (!vendorMap.has(vid)) {
      vendorMap.set(vid, { name: vname, lineIds: [] });
    }
    vendorMap.get(vid)!.lineIds.push(c.id);
  });

  return Array.from(vendorMap.entries()).map(([vid, info], idx) => ({
    vendorId: vid,
    vendorDisplayName: info.name,
    included: true,
    priority: idx + 1,
    lineCoverage: info.lineIds,
    vendorNote: "",
  }));
}

// ══════════════════════════════════════════════════════════════════════════════
// Request Draft Line
// ══════════════════════════════════════════════════════════════════════════════

export interface RequestDraftLine {
  lineId: string;
  itemId: string;
  itemName: string;
  catalogReference: string;
  requestedQty: number;
  requestedSpecBasis: string;
  substituteAllowed: boolean;
  requiredResponseFields: string[];
  requestedLeadTimeInquiry: boolean;
  lineNote: string;
  isComplete: boolean;
}

export function buildRequestDraftLines(
  candidates: RequestCandidateInfo[],
): RequestDraftLine[] {
  return candidates.map((c) => ({
    lineId: `rline_${c.id.slice(0, 8)}_${Date.now().toString(36)}`,
    itemId: c.id,
    itemName: c.name,
    catalogReference: c.catalogNumber || "",
    requestedQty: 1,
    requestedSpecBasis: c.spec || "",
    substituteAllowed: false,
    requiredResponseFields: ["단가", "납기", "재고"],
    requestedLeadTimeInquiry: true,
    lineNote: "",
    isComplete: !!(c.catalogNumber || c.name),
  }));
}

// ══════════════════════════════════════════════════════════════════════════════
// Request Condition Draft
// ══════════════════════════════════════════════════════════════════════════════

export interface RequestConditionDraft {
  purpose: string;
  urgency: "normal" | "urgent" | "critical";
  responseRequirements: string[];
  substituteScope: "none" | "same_brand" | "equivalent";
  inquiryItems: string[];
  attachmentIncluded: boolean;
  requesterContext: string;
}

export function buildDefaultRequestConditions(): RequestConditionDraft {
  return {
    purpose: "",
    urgency: "normal",
    responseRequirements: ["단가", "납기", "재고 유무", "MOQ"],
    substituteScope: "none",
    inquiryItems: [],
    attachmentIncluded: false,
    requesterContext: "",
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Request Assembly Validator
// ══════════════════════════════════════════════════════════════════════════════

export interface RequestAssemblyValidation {
  canRecordDraft: boolean;
  blockingIssues: string[];
  warnings: string[];
  missingItems: string[];
  recommendedNextAction: string;
}

export function validateRequestAssemblyBeforeDraft(
  state: RequestAssemblyState,
): RequestAssemblyValidation {
  const blockingIssues: string[] = [];
  const warnings: string[] = [];
  const missingItems: string[] = [];

  if (state.requestCandidateIds.length === 0) {
    blockingIssues.push("요청 후보가 없습니다");
  }

  const includedVendors = state.targetVendors.filter((v) => v.included);
  if (includedVendors.length === 0) {
    blockingIssues.push("공급사 대상이 선택되지 않았습니다");
  }

  const incompleteLines = state.requestLines.filter((l) => !l.isComplete);
  if (incompleteLines.length > 0) {
    warnings.push(`${incompleteLines.length}개 라인이 불완전합니다`);
    incompleteLines.forEach((l) => missingItems.push(`${l.itemName}: 정보 보완 필요`));
  }

  if (!state.requestConditions.purpose) {
    warnings.push("요청 목적이 비어 있습니다");
  }

  const linesWithoutQty = state.requestLines.filter((l) => l.requestedQty <= 0);
  if (linesWithoutQty.length > 0) {
    warnings.push(`${linesWithoutQty.length}개 라인의 수량이 0입니다`);
  }

  return {
    canRecordDraft: blockingIssues.length === 0,
    blockingIssues,
    warnings,
    missingItems,
    recommendedNextAction: blockingIssues.length > 0
      ? "차단 사항을 먼저 해결하세요"
      : warnings.length > 0
        ? "경고 항목을 검토하고 요청 초안을 저장하세요"
        : "요청 초안을 저장하세요",
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Request Draft Snapshot
// ══════════════════════════════════════════════════════════════════════════════

export interface RequestDraftSnapshot {
  id: string;
  compareDecisionSnapshotId: string | null;
  requestCandidateIds: string[];
  targetVendorIds: string[];
  requestDraftLines: RequestDraftLine[];
  requestConditionSummary: RequestConditionDraft;
  missingInfoSummary: string[];
  operatorDecisionSummary: string;
  recordedAt: string;
  recordedBy: string;
}

export function buildRequestDraftSnapshot(
  state: RequestAssemblyState,
): RequestDraftSnapshot {
  return {
    id: `rdraft_${Date.now().toString(36)}`,
    compareDecisionSnapshotId: state.compareDecisionSnapshotId,
    requestCandidateIds: state.requestCandidateIds,
    targetVendorIds: state.targetVendors.filter((v) => v.included).map((v) => v.vendorId),
    requestDraftLines: state.requestLines,
    requestConditionSummary: state.requestConditions,
    missingInfoSummary: state.requestLines.filter((l) => !l.isComplete).map((l) => `${l.itemName}: 불완전`),
    operatorDecisionSummary: state.requestAssemblyDecisionSummary || "",
    recordedAt: new Date().toISOString(),
    recordedBy: "operator",
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Submission Handoff
// ══════════════════════════════════════════════════════════════════════════════

export interface RequestSubmissionHandoff {
  requestDraftSnapshotId: string;
  targetVendorIds: string[];
  lineCount: number;
  conditionSummary: string;
  isReady: boolean;
}

export function buildRequestSubmissionHandoff(
  snapshot: RequestDraftSnapshot,
): RequestSubmissionHandoff {
  return {
    requestDraftSnapshotId: snapshot.id,
    targetVendorIds: snapshot.targetVendorIds,
    lineCount: snapshot.requestDraftLines.length,
    conditionSummary: snapshot.requestConditionSummary.purpose || "목적 미지정",
    isReady: snapshot.targetVendorIds.length > 0 && snapshot.requestDraftLines.length > 0,
  };
}
