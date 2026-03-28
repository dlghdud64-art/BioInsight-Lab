/**
 * Compare Review Center Engine — canonical review state + option status + structured rationale + reopen meta + handoff
 *
 * 고정 규칙:
 * 1. compare review center = reopen 이후 실제 판단을 잠그는 canonical work surface.
 * 2. rail은 보조 조회, center + dock에서 최종 결정.
 * 3. preview/AI 설명이 actual compare truth를 덮지 않음.
 * 4. shortlist 1개 이상 + rationale 최소 조건 충족 시에만 review complete.
 * 5. approval handoff는 review complete 이후에만.
 * 6. reopen = reset이 아니라 revision.
 */

// ══════════════════════════════════════════════════════════════════════════════
// Review Status
// ══════════════════════════════════════════════════════════════════════════════

export type CompareReviewCenterStatus = "active_review" | "completed" | "handoff_ready";

// ══════════════════════════════════════════════════════════════════════════════
// Option Review Status
// ══════════════════════════════════════════════════════════════════════════════

export type OptionReviewStatus = "pending_review" | "shortlisted" | "excluded" | "needs_followup";

// ══════════════════════════════════════════════════════════════════════════════
// Structured Rationale
// ══════════════════════════════════════════════════════════════════════════════

export type SelectionReasonCode = "price" | "lead_time" | "preferred_vendor" | "availability" | "spec_match" | "policy_fit" | "prior_history" | "other";
export type ExclusionReasonCode = "price_too_high" | "lead_time_too_long" | "spec_mismatch" | "availability_issue" | "vendor_risk" | "policy_violation" | "other";

export interface StructuredRationale {
  selectionReasonCodes: SelectionReasonCode[];
  selectionNote: string;
  exclusionReasonCodes: ExclusionReasonCode[];
  exclusionNote: string;
}

// ══════════════════════════════════════════════════════════════════════════════
// Compare Option
// ══════════════════════════════════════════════════════════════════════════════

export interface CompareOption {
  optionId: string;
  supplier: string;
  itemName: string;
  packSpec: string;
  leadTimeDays: number | null;
  priceKRW: number | null;
  availability: "in_stock" | "limited" | "out_of_stock" | "unknown";
  riskFlags: string[];
  reviewStatus: OptionReviewStatus;
  rationale: StructuredRationale;
}

// ══════════════════════════════════════════════════════════════════════════════
// Reopen Meta
// ══════════════════════════════════════════════════════════════════════════════

export interface CompareReopenMeta {
  isReopened: boolean;
  reopenedAt: string | null;
  reopenedBy: string | null;
  reopenReason: string;
  reopenCount: number;
  previousShortlistIds: string[];
  previousExcludedIds: string[];
}

// ══════════════════════════════════════════════════════════════════════════════
// Compare Review Center State
// ══════════════════════════════════════════════════════════════════════════════

export interface CompareReviewCenterState {
  compareReviewCenterStatus: CompareReviewCenterStatus;
  compareId: string;
  requestReference: string;
  options: CompareOption[];
  reopenMeta: CompareReopenMeta;
  decisionSummary: CompareDecisionSummary | null;
  lastModifiedAt: string;
  nextRequiredAction: string;
}

export interface CompareDecisionSummary {
  shortlistedOptionIds: string[];
  selectionReasonCodes: SelectionReasonCode[];
  selectionNote: string;
  exclusionSummary: string;
  followupRequired: boolean;
  handoffTarget: string;
}

export function createInitialCompareReviewCenterState(
  compareId: string,
  requestReference: string,
  options: CompareOption[],
  reopenMeta?: Partial<CompareReopenMeta>,
): CompareReviewCenterState {
  return {
    compareReviewCenterStatus: "active_review",
    compareId,
    requestReference,
    options,
    reopenMeta: {
      isReopened: reopenMeta?.isReopened ?? false,
      reopenedAt: reopenMeta?.reopenedAt ?? null,
      reopenedBy: reopenMeta?.reopenedBy ?? null,
      reopenReason: reopenMeta?.reopenReason ?? "",
      reopenCount: reopenMeta?.reopenCount ?? 0,
      previousShortlistIds: reopenMeta?.previousShortlistIds ?? [],
      previousExcludedIds: reopenMeta?.previousExcludedIds ?? [],
    },
    decisionSummary: null,
    lastModifiedAt: new Date().toISOString(),
    nextRequiredAction: "후보안을 검토하고 shortlist를 확정하세요",
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Option Actions
// ══════════════════════════════════════════════════════════════════════════════

export function updateOptionReviewStatus(
  state: CompareReviewCenterState,
  optionId: string,
  newStatus: OptionReviewStatus,
  rationale?: Partial<StructuredRationale>,
): CompareReviewCenterState {
  return {
    ...state,
    options: state.options.map((opt) =>
      opt.optionId === optionId
        ? {
            ...opt,
            reviewStatus: newStatus,
            rationale: {
              ...opt.rationale,
              ...rationale,
            },
          }
        : opt,
    ),
    lastModifiedAt: new Date().toISOString(),
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Review Completion Validator
// ══════════════════════════════════════════════════════════════════════════════

export interface CompareReviewCompletionValidation {
  canMarkCompleted: boolean;
  canHandoffToApproval: boolean;
  blockingIssues: string[];
  warnings: string[];
  recommendedNextAction: string;
}

export function validateCompareReviewCompletion(
  state: CompareReviewCenterState,
): CompareReviewCompletionValidation {
  const blocking: string[] = [];
  const warnings: string[] = [];

  const shortlisted = state.options.filter((o) => o.reviewStatus === "shortlisted");
  const excluded = state.options.filter((o) => o.reviewStatus === "excluded");
  const pending = state.options.filter((o) => o.reviewStatus === "pending_review");
  const followup = state.options.filter((o) => o.reviewStatus === "needs_followup");

  if (shortlisted.length === 0) {
    blocking.push("shortlist가 1개 이상 필요합니다");
  }

  // Check rationale for shortlisted
  const shortlistWithoutReason = shortlisted.filter(
    (o) => o.rationale.selectionReasonCodes.length === 0,
  );
  if (shortlistWithoutReason.length > 0) {
    blocking.push(`${shortlistWithoutReason.length}개 shortlist에 선택 이유가 없습니다`);
  }

  // Check rationale for excluded
  const excludedWithoutReason = excluded.filter(
    (o) => o.rationale.exclusionReasonCodes.length === 0,
  );
  if (excludedWithoutReason.length > 0) {
    warnings.push(`${excludedWithoutReason.length}개 제외에 제외 이유가 없습니다`);
  }

  if (pending.length > 0) {
    warnings.push(`${pending.length}개 옵션이 아직 미검토 상태입니다`);
  }

  if (followup.length > 0) {
    warnings.push(`${followup.length}개 옵션이 추가 확인 필요 상태입니다`);
  }

  const canComplete = blocking.length === 0;
  const canHandoff = canComplete && state.compareReviewCenterStatus === "completed";

  return {
    canMarkCompleted: canComplete,
    canHandoffToApproval: canHandoff,
    blockingIssues: blocking,
    warnings,
    recommendedNextAction: blocking.length > 0
      ? "차단 사항 해결"
      : !canComplete
        ? "shortlist 확정 후 완료"
        : canHandoff
          ? "Approval로 넘기기"
          : "검토 완료로 표시",
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Mark Review Completed
// ══════════════════════════════════════════════════════════════════════════════

export function markCompareReviewCompleted(
  state: CompareReviewCenterState,
): CompareReviewCenterState {
  const shortlisted = state.options.filter((o) => o.reviewStatus === "shortlisted");
  const excluded = state.options.filter((o) => o.reviewStatus === "excluded");
  const followup = state.options.filter((o) => o.reviewStatus === "needs_followup");

  const allSelectionCodes = shortlisted.flatMap((o) => o.rationale.selectionReasonCodes);
  const uniqueSelectionCodes = [...new Set(allSelectionCodes)];

  return {
    ...state,
    compareReviewCenterStatus: "completed",
    decisionSummary: {
      shortlistedOptionIds: shortlisted.map((o) => o.optionId),
      selectionReasonCodes: uniqueSelectionCodes,
      selectionNote: shortlisted.map((o) => o.rationale.selectionNote).filter(Boolean).join("; "),
      exclusionSummary: `${excluded.length}개 제외`,
      followupRequired: followup.length > 0,
      handoffTarget: "approval",
    },
    nextRequiredAction: followup.length > 0
      ? "후속 확인 요청 후 Approval로 넘기기"
      : "Approval로 넘기기",
    lastModifiedAt: new Date().toISOString(),
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Mark Handoff Ready
// ══════════════════════════════════════════════════════════════════════════════

export function markCompareReviewHandoffReady(
  state: CompareReviewCenterState,
): CompareReviewCenterState {
  return {
    ...state,
    compareReviewCenterStatus: "handoff_ready",
    nextRequiredAction: "Approval workbench에서 최종 승인 검토",
    lastModifiedAt: new Date().toISOString(),
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Approval Handoff
// ══════════════════════════════════════════════════════════════════════════════

export interface CompareReviewApprovalHandoff {
  compareId: string;
  requestReference: string;
  shortlistedOptionIds: string[];
  selectionReasonCodes: SelectionReasonCode[];
  selectionNote: string;
  exclusionSummary: string;
  followupRequired: boolean;
  reopenMeta: CompareReopenMeta;
  handoffReadiness: "ready" | "pending" | "blocked";
}

export function buildCompareReviewApprovalHandoff(
  state: CompareReviewCenterState,
): CompareReviewApprovalHandoff {
  const ds = state.decisionSummary;
  return {
    compareId: state.compareId,
    requestReference: state.requestReference,
    shortlistedOptionIds: ds?.shortlistedOptionIds ?? [],
    selectionReasonCodes: ds?.selectionReasonCodes ?? [],
    selectionNote: ds?.selectionNote ?? "",
    exclusionSummary: ds?.exclusionSummary ?? "",
    followupRequired: ds?.followupRequired ?? false,
    reopenMeta: state.reopenMeta,
    handoffReadiness: state.compareReviewCenterStatus === "handoff_ready" ? "ready" : "pending",
  };
}
