/**
 * Request Assembly Workbench — vendor targeting + line assembly + condition + draft snapshot
 *
 * 고정 규칙:
 * 1. compare shortlist를 그대로 submission으로 직행 금지. request assembly가 필수 중간 단계.
 * 2. request candidate ≠ vendor target. 품목 후보와 발신 대상을 분리.
 * 3. request line은 compare raw row 재사용 금지. request context에 맞는 별도 line object.
 * 4. canonical request draft snapshot 없이 submission 진입 금지.
 * 5. center / rail / dock이 동일 request assembly truth를 봐야 함.
 * 6. vendor recommendation ≠ operator selection. AI 제안은 보조, operator가 canonical truth.
 * 7. request assembly는 quote management의 source of truth가 되는 preparation layer.
 */

import type { CompareDecisionSnapshot, CompareDifferenceSummary } from "./compare-review-workbench";

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

export const REQUEST_ASSEMBLY_STATUS_LABELS: Record<RequestAssemblyStatus, string> = {
  request_assembly_ready: "견적 요청 조립 준비",
  request_assembly_open: "견적 요청 조립 중",
  request_draft_recorded: "요청 초안 저장됨",
};

export const REQUEST_ASSEMBLY_SUBSTATUS_LABELS: Record<RequestAssemblySubstatus, string> = {
  awaiting_vendor_targets: "공급사 대상 선택 대기",
  awaiting_request_conditions: "요청 조건 입력 대기",
  assembly_in_progress: "조립 진행 중",
  assembly_blocked: "조립 차단",
  ready_for_submission_prep: "제출 준비 가능",
};

// ══════════════════════════════════════════════════════════════════════════════
// Vendor Target
// ══════════════════════════════════════════════════════════════════════════════

export interface VendorTarget {
  vendorTargetId: string;
  vendorId: string;
  vendorDisplayName: string;
  vendorType: "primary" | "alternative" | "new_inquiry";
  priority: number;
  included: boolean;
  lineCoverage: string[];
  existingRelationship: boolean;
  vendorNote: string | null;
  inquiryFocus: string | null;
}

let _vt = 0;
function vtUid(): string { return `vt_${Date.now()}_${++_vt}`; }

export function buildVendorTargetOption(input: {
  vendorId: string;
  vendorDisplayName: string;
  vendorType: VendorTarget["vendorType"];
  priority: number;
  lineCoverage: string[];
  existingRelationship?: boolean;
}): VendorTarget {
  return {
    vendorTargetId: vtUid(),
    vendorId: input.vendorId,
    vendorDisplayName: input.vendorDisplayName,
    vendorType: input.vendorType,
    priority: input.priority,
    included: true,
    lineCoverage: input.lineCoverage,
    existingRelationship: input.existingRelationship ?? false,
    vendorNote: null,
    inquiryFocus: null,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Request Draft Line (normalized for quote management)
// ══════════════════════════════════════════════════════════════════════════════

export interface RequestDraftLine {
  lineId: string;
  itemId: string | null;
  catalogReference: string | null;
  productName: string;
  requestedQty: number;
  requestedSpecBasis: string | null;
  substituteAllowed: boolean;
  requiredResponseFields: RequestResponseField[];
  requestedLeadTimeInquiry: boolean;
  lineNote: string | null;
  vendorCoverageIds: string[];
  completeness: "complete" | "incomplete" | "blocked";
  incompleteReason: string | null;
}

export type RequestResponseField =
  | "unit_price"
  | "lead_time"
  | "availability"
  | "moq"
  | "substitute_option"
  | "bulk_discount"
  | "shipping_cost";

export const REQUEST_RESPONSE_FIELD_LABELS: Record<RequestResponseField, string> = {
  unit_price: "단가",
  lead_time: "납기",
  availability: "재고 확인",
  moq: "최소 주문량",
  substitute_option: "대체품 제안",
  bulk_discount: "대량 할인",
  shipping_cost: "배송비",
};

let _rdl = 0;
function rdlUid(): string { return `rdl_${Date.now()}_${++_rdl}`; }

export function buildRequestDraftLine(input: {
  itemId?: string | null;
  catalogReference?: string | null;
  productName: string;
  requestedQty: number;
  requestedSpecBasis?: string | null;
  substituteAllowed?: boolean;
  vendorCoverageIds?: string[];
}): RequestDraftLine {
  const incomplete: string[] = [];
  if (!input.requestedQty || input.requestedQty <= 0) incomplete.push("수량 누락");
  if (!input.productName) incomplete.push("품목명 누락");

  return {
    lineId: rdlUid(),
    itemId: input.itemId ?? null,
    catalogReference: input.catalogReference ?? null,
    productName: input.productName,
    requestedQty: input.requestedQty,
    requestedSpecBasis: input.requestedSpecBasis ?? null,
    substituteAllowed: input.substituteAllowed ?? false,
    requiredResponseFields: ["unit_price", "lead_time", "availability"],
    requestedLeadTimeInquiry: true,
    lineNote: null,
    vendorCoverageIds: input.vendorCoverageIds ?? [],
    completeness: incomplete.length > 0 ? "incomplete" : "complete",
    incompleteReason: incomplete.length > 0 ? incomplete.join(", ") : null,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Request Condition Block
// ══════════════════════════════════════════════════════════════════════════════

export interface RequestConditionBlock {
  // ── Purpose ──
  requestPurpose: string | null;
  urgencyLevel: "standard" | "urgent" | "critical";
  responseDeadline: string | null;

  // ── Inquiry scope ──
  inquiryItems: RequestResponseField[];
  substituteAllowedGlobal: boolean;
  leadTimeInquiryRequired: boolean;
  moqInquiryRequired: boolean;

  // ── Context ──
  requesterId: string | null;
  requesterName: string | null;
  projectId: string | null;
  projectName: string | null;
  costCenterId: string | null;
  budgetReference: string | null;

  // ── Attachments ──
  hasAttachments: boolean;
  attachmentNote: string | null;
  referenceDocumentIds: string[];

  // ── Note ──
  generalNote: string | null;
}

export function buildDefaultRequestCondition(): RequestConditionBlock {
  return {
    requestPurpose: null,
    urgencyLevel: "standard",
    responseDeadline: null,
    inquiryItems: ["unit_price", "lead_time", "availability"],
    substituteAllowedGlobal: false,
    leadTimeInquiryRequired: true,
    moqInquiryRequired: false,
    requesterId: null,
    requesterName: null,
    projectId: null,
    projectName: null,
    costCenterId: null,
    budgetReference: null,
    hasAttachments: false,
    attachmentNote: null,
    referenceDocumentIds: [],
    generalNote: null,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Request Assembly State
// ══════════════════════════════════════════════════════════════════════════════

export interface RequestAssemblyState {
  // ── Status ──
  requestAssemblyStatus: RequestAssemblyStatus;
  requestAssemblySubstatus: RequestAssemblySubstatus;
  requestAssemblyOpenedAt: string | null;
  requestAssemblyOpenedBy: string | null;

  // ── Lineage ──
  compareDecisionSnapshotId: string | null;

  // ── Candidates ──
  requestCandidateIds: string[];

  // ── Vendor targets ──
  vendorTargets: VendorTarget[];
  targetVendorIds: string[];

  // ── Lines ──
  requestLines: RequestDraftLine[];

  // ── Conditions ──
  requestCondition: RequestConditionBlock;

  // ── Draft ──
  requestDraftSnapshotId: string | null;
  requestAssemblyDecisionSummary: string | null;
}

export function createInitialRequestAssemblyState(
  compareSnapshot: CompareDecisionSnapshot
): RequestAssemblyState {
  return {
    requestAssemblyStatus: "request_assembly_ready",
    requestAssemblySubstatus: "awaiting_vendor_targets",
    requestAssemblyOpenedAt: null,
    requestAssemblyOpenedBy: null,
    compareDecisionSnapshotId: compareSnapshot.snapshotId,
    requestCandidateIds: compareSnapshot.requestCandidateIds,
    vendorTargets: [],
    targetVendorIds: [],
    requestLines: [],
    requestCondition: buildDefaultRequestCondition(),
    requestDraftSnapshotId: null,
    requestAssemblyDecisionSummary: null,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Open Request Assembly (state transition)
// ══════════════════════════════════════════════════════════════════════════════

export function openRequestAssembly(
  state: RequestAssemblyState,
  openedBy?: string | null
): RequestAssemblyState {
  if (state.requestAssemblyStatus !== "request_assembly_ready") return state;
  return {
    ...state,
    requestAssemblyStatus: "request_assembly_open",
    requestAssemblySubstatus: state.vendorTargets.length > 0
      ? "assembly_in_progress"
      : "awaiting_vendor_targets",
    requestAssemblyOpenedAt: new Date().toISOString(),
    requestAssemblyOpenedBy: openedBy ?? null,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Update Vendor Targets
// ══════════════════════════════════════════════════════════════════════════════

export function updateVendorTargets(
  state: RequestAssemblyState,
  vendors: VendorTarget[]
): RequestAssemblyState {
  const includedVendorIds = vendors.filter(v => v.included).map(v => v.vendorId);

  let substatus = state.requestAssemblySubstatus;
  if (includedVendorIds.length === 0) {
    substatus = "awaiting_vendor_targets";
  } else if (state.requestLines.length === 0) {
    substatus = "awaiting_request_conditions";
  } else {
    substatus = "assembly_in_progress";
  }

  return {
    ...state,
    vendorTargets: vendors,
    targetVendorIds: includedVendorIds,
    requestAssemblySubstatus: substatus,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Update Request Lines
// ══════════════════════════════════════════════════════════════════════════════

export function updateRequestLines(
  state: RequestAssemblyState,
  lines: RequestDraftLine[]
): RequestAssemblyState {
  const hasIncomplete = lines.some(l => l.completeness !== "complete");

  let substatus = state.requestAssemblySubstatus;
  if (state.targetVendorIds.length === 0) {
    substatus = "awaiting_vendor_targets";
  } else if (hasIncomplete) {
    substatus = "assembly_in_progress";
  } else {
    substatus = "assembly_in_progress";
  }

  return {
    ...state,
    requestLines: lines,
    requestAssemblySubstatus: substatus,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Update Request Condition
// ══════════════════════════════════════════════════════════════════════════════

export function updateRequestCondition(
  state: RequestAssemblyState,
  condition: Partial<RequestConditionBlock>
): RequestAssemblyState {
  return {
    ...state,
    requestCondition: { ...state.requestCondition, ...condition },
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Request Assembly Validator
// ══════════════════════════════════════════════════════════════════════════════

export interface RequestAssemblyValidationResult {
  canRecordDraft: boolean;
  blockingIssues: { code: string; message: string }[];
  warnings: { code: string; message: string }[];
  missingItems: string[];
  recommendedNextAction: string;
}

export function validateRequestAssemblyBeforeDraft(
  state: RequestAssemblyState
): RequestAssemblyValidationResult {
  const blocking: { code: string; message: string }[] = [];
  const warnings: { code: string; message: string }[] = [];
  const missingItems: string[] = [];

  // Candidates
  if (state.requestCandidateIds.length === 0) {
    blocking.push({ code: "no_candidates", message: "견적 요청 대상 품목이 없습니다." });
    missingItems.push("견적 요청 대상 품목");
  }

  // Vendor targets
  if (state.targetVendorIds.length === 0) {
    blocking.push({ code: "no_vendor_targets", message: "공급사 대상이 선택되지 않았습니다." });
    missingItems.push("공급사 대상");
  }

  // Request lines
  if (state.requestLines.length === 0) {
    blocking.push({ code: "no_request_lines", message: "요청 품목 라인이 없습니다." });
    missingItems.push("요청 품목 라인");
  }

  // Incomplete lines
  const incompleteLines = state.requestLines.filter(l => l.completeness !== "complete");
  if (incompleteLines.length > 0) {
    blocking.push({
      code: "incomplete_lines",
      message: `${incompleteLines.length}개 라인의 필수 정보가 누락되었습니다.`,
    });
    missingItems.push("라인 필수 정보");
  }

  // Compare snapshot lineage
  if (!state.compareDecisionSnapshotId) {
    blocking.push({ code: "no_compare_lineage", message: "비교 판단 기록이 연결되지 않았습니다." });
    missingItems.push("비교 판단 기록");
  }

  // Request condition basics
  if (!state.requestCondition.requestPurpose) {
    warnings.push({ code: "no_purpose", message: "요청 목적이 입력되지 않았습니다." });
    missingItems.push("요청 목적");
  }

  if (state.requestCondition.inquiryItems.length === 0) {
    warnings.push({ code: "no_inquiry_items", message: "응답 요청 항목이 비어 있습니다." });
    missingItems.push("응답 요청 항목");
  }

  // Vendor-line coverage check
  const uncoveredLines = state.requestLines.filter(l =>
    l.vendorCoverageIds.length === 0 && state.targetVendorIds.length > 0
  );
  if (uncoveredLines.length > 0) {
    warnings.push({
      code: "uncovered_lines",
      message: `${uncoveredLines.length}개 라인에 공급사가 배정되지 않았습니다.`,
    });
  }

  let recommendedNextAction: string;
  if (blocking.length > 0) {
    recommendedNextAction = `필수 항목 ${blocking.length}건 해결 필요`;
  } else if (warnings.length > 0) {
    recommendedNextAction = `주의 ${warnings.length}건 확인 후 초안 저장 가능`;
  } else {
    recommendedNextAction = "요청 초안 저장 가능";
  }

  return {
    canRecordDraft: blocking.length === 0,
    blockingIssues: blocking,
    warnings,
    missingItems,
    recommendedNextAction,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Request Draft Snapshot
// ══════════════════════════════════════════════════════════════════════════════

export interface RequestDraftSnapshot {
  snapshotId: string;
  compareDecisionSnapshotId: string | null;
  requestCandidateIds: string[];
  targetVendorIds: string[];
  vendorTargets: VendorTarget[];
  requestLines: RequestDraftLine[];
  requestCondition: RequestConditionBlock;
  missingInfoSummary: string[];
  operatorDecisionSummary: string | null;
  recordedAt: string;
  recordedBy: string | null;
}

let _rds = 0;
function rdsUid(): string { return `rds_${Date.now()}_${++_rds}`; }

export interface RecordRequestDraftResult {
  success: boolean;
  snapshot: RequestDraftSnapshot | null;
  state: RequestAssemblyState;
  reason: string | null;
}

export function recordRequestDraft(
  state: RequestAssemblyState,
  operatorSummary?: string | null,
  recordedBy?: string | null
): RecordRequestDraftResult {
  // Guard: must be open
  if (state.requestAssemblyStatus !== "request_assembly_open") {
    return {
      success: false,
      snapshot: null,
      state,
      reason: "견적 요청 조립 중에만 초안을 저장할 수 있습니다.",
    };
  }

  // Validate
  const validation = validateRequestAssemblyBeforeDraft(state);
  if (!validation.canRecordDraft) {
    return {
      success: false,
      snapshot: null,
      state: {
        ...state,
        requestAssemblySubstatus: "assembly_blocked",
      },
      reason: `필수 항목 ${validation.blockingIssues.length}건이 해결되지 않았습니다.`,
    };
  }

  // Guard: duplicate
  if (state.requestDraftSnapshotId) {
    return {
      success: false,
      snapshot: null,
      state,
      reason: "이미 요청 초안이 저장되었습니다.",
    };
  }

  const now = new Date().toISOString();

  const snapshot: RequestDraftSnapshot = {
    snapshotId: rdsUid(),
    compareDecisionSnapshotId: state.compareDecisionSnapshotId,
    requestCandidateIds: state.requestCandidateIds,
    targetVendorIds: state.targetVendorIds,
    vendorTargets: state.vendorTargets,
    requestLines: state.requestLines,
    requestCondition: state.requestCondition,
    missingInfoSummary: validation.missingItems,
    operatorDecisionSummary: operatorSummary ?? null,
    recordedAt: now,
    recordedBy: recordedBy ?? null,
  };

  return {
    success: true,
    snapshot,
    state: {
      ...state,
      requestAssemblyStatus: "request_draft_recorded",
      requestAssemblySubstatus: "ready_for_submission_prep",
      requestDraftSnapshotId: snapshot.snapshotId,
      requestAssemblyDecisionSummary: operatorSummary ?? null,
    },
    reason: null,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Request Submission Handoff
// ══════════════════════════════════════════════════════════════════════════════

export interface RequestSubmissionHandoff {
  handoffId: string;
  requestDraftSnapshotId: string;
  compareDecisionSnapshotId: string | null;
  targetVendorIds: string[];
  targetVendorCount: number;
  requestLineCount: number;
  incompleteLineCount: number;
  requestPurpose: string | null;
  urgencyLevel: string;
  missingInfoSummary: string[];
  nextSubmissionAction: string;
  preparedAt: string;
}

let _rsh = 0;
function rshUid(): string { return `rsh_${Date.now()}_${++_rsh}`; }

export function buildRequestSubmissionHandoff(
  snapshot: RequestDraftSnapshot
): RequestSubmissionHandoff {
  const incompleteCount = snapshot.requestLines.filter(l => l.completeness !== "complete").length;

  return {
    handoffId: rshUid(),
    requestDraftSnapshotId: snapshot.snapshotId,
    compareDecisionSnapshotId: snapshot.compareDecisionSnapshotId,
    targetVendorIds: snapshot.targetVendorIds,
    targetVendorCount: snapshot.targetVendorIds.length,
    requestLineCount: snapshot.requestLines.length,
    incompleteLineCount: incompleteCount,
    requestPurpose: snapshot.requestCondition.requestPurpose,
    urgencyLevel: snapshot.requestCondition.urgencyLevel,
    missingInfoSummary: snapshot.missingInfoSummary,
    nextSubmissionAction: incompleteCount > 0
      ? "미완성 라인 보완 후 제출 가능"
      : "견적 요청 제출 준비 가능",
    preparedAt: new Date().toISOString(),
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Resolve Request Assembly Seed (from compare handoff)
// ══════════════════════════════════════════════════════════════════════════════

export interface RequestAssemblySeed {
  compareDecisionSnapshotId: string;
  shortlistedItemIds: string[];
  compareRationaleSummary: string;
  vendorSuggestionIds: string[];
  unresolvedInfoItems: string[];
  defaultRequestCondition: RequestConditionBlock;
}

export function resolveRequestAssemblySeed(
  compareSnapshot: CompareDecisionSnapshot
): RequestAssemblySeed {
  return {
    compareDecisionSnapshotId: compareSnapshot.snapshotId,
    shortlistedItemIds: compareSnapshot.shortlistIds,
    compareRationaleSummary: compareSnapshot.decisionRationale,
    vendorSuggestionIds: [],
    unresolvedInfoItems: compareSnapshot.differenceSummary.unresolved,
    defaultRequestCondition: buildDefaultRequestCondition(),
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Request Assembly Workbench Model (center + rail + dock)
// ══════════════════════════════════════════════════════════════════════════════

export interface RequestAssemblyWorkbenchModel {
  state: RequestAssemblyState;
  validation: RequestAssemblyValidationResult;

  isRequestAssemblyVisible: boolean;

  // ── Header ──
  assemblyBadge: string;
  assemblyColor: "slate" | "amber" | "emerald" | "red" | "blue";

  // ── Dock CTAs ──
  primaryAction: RequestAssemblyDockAction;
  secondaryActions: RequestAssemblyDockAction[];

  // ── Rail checklist ──
  checklistItems: RequestAssemblyChecklistItem[];
}

export interface RequestAssemblyDockAction {
  id: string;
  label: string;
  enabled: boolean;
  reason: string | null;
}

export interface RequestAssemblyChecklistItem {
  label: string;
  status: "done" | "pending" | "blocked";
}

export function buildRequestAssemblyWorkbenchModel(
  state: RequestAssemblyState
): RequestAssemblyWorkbenchModel {
  const validation = validateRequestAssemblyBeforeDraft(state);

  const isVisible = state.requestCandidateIds.length > 0;
  if (!isVisible) {
    return {
      state,
      validation,
      isRequestAssemblyVisible: false,
      assemblyBadge: "—",
      assemblyColor: "slate",
      primaryAction: { id: "noop", label: "—", enabled: false, reason: null },
      secondaryActions: [],
      checklistItems: [],
    };
  }

  // Badge
  let assemblyBadge: string;
  let assemblyColor: RequestAssemblyWorkbenchModel["assemblyColor"];
  switch (state.requestAssemblySubstatus) {
    case "awaiting_vendor_targets":
      assemblyBadge = "공급사 선택 대기";
      assemblyColor = "slate";
      break;
    case "awaiting_request_conditions":
      assemblyBadge = "요청 조건 입력 대기";
      assemblyColor = "slate";
      break;
    case "assembly_in_progress":
      assemblyBadge = "조립 진행 중";
      assemblyColor = "blue";
      break;
    case "assembly_blocked":
      assemblyBadge = "조립 차단";
      assemblyColor = "red";
      break;
    case "ready_for_submission_prep":
      assemblyBadge = "제출 준비 가능";
      assemblyColor = "emerald";
      break;
  }

  // Checklist
  const hasVendors = state.targetVendorIds.length > 0;
  const hasLines = state.requestLines.length > 0;
  const allLinesComplete = state.requestLines.every(l => l.completeness === "complete");
  const hasPurpose = !!state.requestCondition.requestPurpose;
  const hasDraft = !!state.requestDraftSnapshotId;

  const checklist: RequestAssemblyChecklistItem[] = [
    { label: "비교 결과 연결", status: state.compareDecisionSnapshotId ? "done" : "blocked" },
    { label: "공급사 대상 선택", status: hasVendors ? "done" : "pending" },
    { label: "요청 라인 구성", status: hasLines ? (allLinesComplete ? "done" : "pending") : "pending" },
    { label: "요청 조건 입력", status: hasPurpose ? "done" : "pending" },
    { label: "요청 초안 저장", status: hasDraft ? "done" : "pending" },
  ];

  // Dock
  let primaryAction: RequestAssemblyDockAction;
  if (!hasVendors) {
    primaryAction = {
      id: "select_vendors",
      label: "공급사 대상 선택",
      enabled: true,
      reason: null,
    };
  } else if (!hasLines || !allLinesComplete) {
    primaryAction = {
      id: "complete_lines",
      label: "요청 라인 완성",
      enabled: true,
      reason: null,
    };
  } else if (!hasDraft && validation.canRecordDraft) {
    primaryAction = {
      id: "save_draft",
      label: "요청 초안 저장",
      enabled: true,
      reason: null,
    };
  } else if (hasDraft) {
    primaryAction = {
      id: "open_submission_prep",
      label: "제출 준비 시작",
      enabled: true,
      reason: null,
    };
  } else {
    primaryAction = {
      id: "save_draft",
      label: "요청 초안 저장",
      enabled: false,
      reason: `필수 항목 ${validation.blockingIssues.length}건 미해결`,
    };
  }

  const secondaryActions: RequestAssemblyDockAction[] = [];

  if (validation.missingItems.length > 0 && !hasDraft) {
    secondaryActions.push({
      id: "check_missing",
      label: `누락 정보 ${validation.missingItems.length}건`,
      enabled: true,
      reason: null,
    });
  }

  if (hasDraft && primaryAction.id !== "open_submission_prep") {
    secondaryActions.push({
      id: "open_submission_prep",
      label: "제출 준비 시작",
      enabled: true,
      reason: null,
    });
  }

  return {
    state,
    validation,
    isRequestAssemblyVisible: true,
    assemblyBadge,
    assemblyColor,
    primaryAction,
    secondaryActions,
    checklistItems: checklist,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Request Assembly Activity Events
// ══════════════════════════════════════════════════════════════════════════════

export type RequestAssemblyActivityType =
  | "request_assembly_opened"
  | "vendor_targets_updated"
  | "request_lines_updated"
  | "request_condition_updated"
  | "request_draft_recorded"
  | "submission_handoff_prepared"
  | "request_assembly_closed";

export interface RequestAssemblyActivity {
  type: RequestAssemblyActivityType;
  at: string;
  actorId: string | null;
  summary: string;
  snapshotId: string | null;
}

export function createRequestAssemblyActivity(input: {
  type: RequestAssemblyActivityType;
  actorId?: string;
  summary: string;
  snapshotId?: string;
}): RequestAssemblyActivity {
  return {
    type: input.type,
    at: new Date().toISOString(),
    actorId: input.actorId ?? null,
    summary: input.summary,
    snapshotId: input.snapshotId ?? null,
  };
}
