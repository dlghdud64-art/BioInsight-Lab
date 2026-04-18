/**
 * Quote Compare Review Engine — 견적 비교 판단 상태 모델 + matrix + diff summary + decision snapshot + approval handoff
 *
 * 고정 규칙:
 * 1. quote compare = normalized quote object 기준 canonical 비교 판단.
 * 2. raw quote를 compare basis로 쓰지 말 것.
 * 3. shortlist / follow-up / excluded vendor를 분리 관리.
 * 4. canonical compare decision snapshot 없이 approval 진입 금지.
 * 5. difference summary를 matrix보다 먼저 노출.
 */

import type { NormalizedQuoteObject, NormalizedQuoteLine } from "./quote-normalization-engine";

// ══════════════════════════════════════════════════════════════════════════════
// Compare Status
// ══════════════════════════════════════════════════════════════════════════════

export type QuoteCompareStatus =
  | "quote_compare_open"
  | "quote_compare_in_progress"
  | "quote_compare_decision_recorded";

export type QuoteCompareSubstatus =
  | "awaiting_compare_basis"
  | "difference_review_active"
  | "shortlist_pending"
  | "compare_blocked"
  | "ready_for_approval_handoff";

// ══════════════════════════════════════════════════════════════════════════════
// Compare State
// ══════════════════════════════════════════════════════════════════════════════

export interface QuoteCompareReviewState {
  quoteCompareStatus: QuoteCompareStatus;
  substatus: QuoteCompareSubstatus;
  quoteCompareOpenedAt: string;
  quoteCompareOpenedBy: "queue_handoff" | "manual";
  quoteWorkqueueObjectId: string;
  normalizedQuoteObjectIds: string[];
  comparableVendorCount: number;
  mappedRequestLineCount: number;
  shortlistVendorIds: string[];
  excludedVendorIds: string[];
  followupVendorIds: string[];
  quoteCompareDecisionSnapshotId: string | null;
  compareBlockedFlag: boolean;
  compareBlockedReason: string | null;
  // ── Lineage ──
  requestSubmissionEventId: string;
}

export function createInitialQuoteCompareState(
  workqueueObjectId: string,
  requestSubmissionEventId: string,
  normalizedQuotes: NormalizedQuoteObject[],
): QuoteCompareReviewState {
  const vendorIds = normalizedQuotes.map((q) => q.vendorTargetId);
  const allLineIds = new Set(normalizedQuotes.flatMap((q) => q.mappedRequestLineIds));

  return {
    quoteCompareStatus: "quote_compare_open",
    substatus: normalizedQuotes.length >= 2 ? "difference_review_active" : "compare_blocked",
    quoteCompareOpenedAt: new Date().toISOString(),
    quoteCompareOpenedBy: "queue_handoff",
    quoteWorkqueueObjectId: workqueueObjectId,
    normalizedQuoteObjectIds: normalizedQuotes.map((q) => q.id),
    comparableVendorCount: vendorIds.length,
    mappedRequestLineCount: allLineIds.size,
    shortlistVendorIds: [...vendorIds],
    excludedVendorIds: [],
    followupVendorIds: [],
    quoteCompareDecisionSnapshotId: null,
    compareBlockedFlag: normalizedQuotes.length < 2,
    compareBlockedReason: normalizedQuotes.length < 2 ? "비교 가능 공급사 2개 미만" : null,
    requestSubmissionEventId,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Difference Summary
// ══════════════════════════════════════════════════════════════════════════════

export interface QuoteCompareDiffItem {
  label: string;
  advantageVendor: string;
  delta: string;
  signal: "positive" | "neutral" | "warning";
}

export interface QuoteCompareDifferenceSummary {
  lowestPrice: QuoteCompareDiffItem | null;
  fastestLeadTime: QuoteCompareDiffItem | null;
  bestStock: QuoteCompareDiffItem | null;
  moqWarning: QuoteCompareDiffItem | null;
  substituteSignal: QuoteCompareDiffItem | null;
  incompleteQuoteWarning: string | null;
  operatorCheckpoints: string[];
}

export function buildQuoteCompareDifferenceSummary(
  normalizedQuotes: NormalizedQuoteObject[],
): QuoteCompareDifferenceSummary {
  const allLines = normalizedQuotes.flatMap((q) =>
    q.normalizedQuoteLines.map((l) => ({ ...l, vendorId: q.vendorTargetId })),
  );

  // Price comparison
  const priceLines = allLines.filter((l) => l.normalizedUnitPrice !== null && l.normalizedUnitPrice > 0);
  let lowestPrice: QuoteCompareDiffItem | null = null;
  if (priceLines.length >= 2) {
    const sorted = [...priceLines].sort((a, b) => (a.normalizedUnitPrice || 0) - (b.normalizedUnitPrice || 0));
    const cheapest = sorted[0];
    const next = sorted[1];
    const diff = (next.normalizedUnitPrice || 0) - (cheapest.normalizedUnitPrice || 0);
    const pct = Math.round((diff / (next.normalizedUnitPrice || 1)) * 100);
    lowestPrice = {
      label: `${cheapest.vendorId}이(가) ${pct}% 저렴`,
      advantageVendor: cheapest.vendorId,
      delta: `₩${diff.toLocaleString("ko-KR")} 차이`,
      signal: "positive",
    };
  }

  // Lead time comparison
  const leadLines = allLines.filter((l) => l.normalizedLeadTimeDays !== null && l.normalizedLeadTimeDays > 0);
  let fastestLeadTime: QuoteCompareDiffItem | null = null;
  if (leadLines.length >= 2) {
    const sorted = [...leadLines].sort((a, b) => (a.normalizedLeadTimeDays || 0) - (b.normalizedLeadTimeDays || 0));
    const fastest = sorted[0];
    const next = sorted[1];
    const diff = (next.normalizedLeadTimeDays || 0) - (fastest.normalizedLeadTimeDays || 0);
    if (diff > 0) {
      fastestLeadTime = {
        label: `${fastest.vendorId}이(가) ${diff}일 빠름`,
        advantageVendor: fastest.vendorId,
        delta: `${diff}영업일 차이`,
        signal: "positive",
      };
    }
  }

  // Stock comparison
  const inStockVendors = normalizedQuotes.filter((q) =>
    q.normalizedQuoteLines.some((l) => l.normalizedStockAvailability === "in_stock"),
  );
  const bestStock: QuoteCompareDiffItem | null = inStockVendors.length > 0
    ? { label: `${inStockVendors[0].vendorTargetId} 재고 보유`, advantageVendor: inStockVendors[0].vendorTargetId, delta: `${inStockVendors.length}개 공급사 재고`, signal: "positive" }
    : null;

  // MOQ warning
  const highMoqLines = allLines.filter((l) => l.normalizedMOQ !== null && l.normalizedMOQ > 5);
  const moqWarning: QuoteCompareDiffItem | null = highMoqLines.length > 0
    ? { label: `${highMoqLines[0].vendorId} MOQ ${highMoqLines[0].normalizedMOQ}개`, advantageVendor: "", delta: "MOQ 확인 필요", signal: "warning" }
    : null;

  // Substitute
  const substituteVendors = normalizedQuotes.filter((q) =>
    q.normalizedQuoteLines.some((l) => l.substituteOffered),
  );
  const substituteSignal: QuoteCompareDiffItem | null = substituteVendors.length > 0
    ? { label: `${substituteVendors[0].vendorTargetId} 대체품 제안`, advantageVendor: substituteVendors[0].vendorTargetId, delta: `${substituteVendors.length}개 공급사`, signal: "neutral" }
    : null;

  const incompleteQuotes = normalizedQuotes.filter((q) =>
    q.normalizedQuoteLines.some((l) => !l.isComplete),
  );
  const incompleteQuoteWarning = incompleteQuotes.length > 0
    ? `${incompleteQuotes.length}개 공급사 견적이 불완전합니다`
    : null;

  const operatorCheckpoints: string[] = [];
  if (incompleteQuoteWarning) operatorCheckpoints.push(incompleteQuoteWarning);
  if (moqWarning) operatorCheckpoints.push("MOQ 조건 확인 필요");
  if (substituteVendors.length > 0) operatorCheckpoints.push("대체품 제안 검토 필요");

  return { lowestPrice, fastestLeadTime, bestStock, moqWarning, substituteSignal, incompleteQuoteWarning, operatorCheckpoints };
}

// ══════════════════════════════════════════════════════════════════════════════
// Compare Readiness Validator
// ══════════════════════════════════════════════════════════════════════════════

export interface QuoteCompareValidation {
  canRecordCompareDecision: boolean;
  blockingIssues: string[];
  warnings: string[];
  missingDecisionItems: string[];
  recommendedNextAction: string;
}

export function validateQuoteCompareBeforeDecision(
  state: QuoteCompareReviewState,
  normalizedQuotes: NormalizedQuoteObject[],
): QuoteCompareValidation {
  const blockingIssues: string[] = [];
  const warnings: string[] = [];
  const missingDecisionItems: string[] = [];

  if (normalizedQuotes.length < 2) {
    blockingIssues.push("비교 가능 견적이 2개 미만입니다");
  }

  if (state.shortlistVendorIds.length === 0 && state.followupVendorIds.length === 0) {
    blockingIssues.push("shortlist 또는 추가 확인 vendor가 하나도 없습니다");
  }

  const followupInShortlist = state.followupVendorIds.filter((id) => state.shortlistVendorIds.includes(id));
  if (followupInShortlist.length > 0) {
    warnings.push(`${followupInShortlist.length}개 vendor가 shortlist와 추가 확인에 동시에 있습니다`);
  }

  const incompleteQuotes = normalizedQuotes.filter((q) => q.normalizedQuoteLines.some((l) => !l.isComplete));
  const incompleteInShortlist = incompleteQuotes.filter((q) => state.shortlistVendorIds.includes(q.vendorTargetId));
  if (incompleteInShortlist.length > 0) {
    warnings.push(`shortlist 중 ${incompleteInShortlist.length}개 vendor의 견적이 불완전합니다`);
  }

  return {
    canRecordCompareDecision: blockingIssues.length === 0,
    blockingIssues,
    warnings,
    missingDecisionItems,
    recommendedNextAction: blockingIssues.length > 0
      ? "차단 사항을 먼저 해결하세요"
      : warnings.length > 0
        ? "경고 항목을 검토하고 비교 결과를 저장하세요"
        : "비교 결과를 저장하고 approval 검토로 보내세요",
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Compare Decision Snapshot
// ══════════════════════════════════════════════════════════════════════════════

export interface QuoteCompareDecisionSnapshot {
  id: string;
  quoteWorkqueueObjectId: string;
  requestSubmissionEventId: string;
  normalizedQuoteObjectIds: string[];
  comparableVendorIds: string[];
  shortlistVendorIds: string[];
  excludedVendorIds: string[];
  followupVendorIds: string[];
  compareRationaleSummary: string;
  blockingSummary: string[];
  warningSummary: string[];
  recordedAt: string;
  recordedBy: string;
}

export function buildQuoteCompareDecisionSnapshot(
  state: QuoteCompareReviewState,
  rationale: string,
): QuoteCompareDecisionSnapshot {
  return {
    id: `qcdec_${Date.now().toString(36)}`,
    quoteWorkqueueObjectId: state.quoteWorkqueueObjectId,
    requestSubmissionEventId: state.requestSubmissionEventId,
    normalizedQuoteObjectIds: state.normalizedQuoteObjectIds,
    comparableVendorIds: [...state.shortlistVendorIds, ...state.followupVendorIds],
    shortlistVendorIds: state.shortlistVendorIds,
    excludedVendorIds: state.excludedVendorIds,
    followupVendorIds: state.followupVendorIds,
    compareRationaleSummary: rationale,
    blockingSummary: [],
    warningSummary: [],
    recordedAt: new Date().toISOString(),
    recordedBy: "operator",
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Approval Handoff
// ══════════════════════════════════════════════════════════════════════════════

export interface ApprovalWorkbenchHandoff {
  quoteCompareDecisionSnapshotId: string;
  requestSubmissionEventId: string;
  shortlistVendorIds: string[];
  followupVendorIds: string[];
  compareRationaleSummary: string;
  commercialRiskSummary: string;
  approvalReadiness: "ready" | "pending_followup" | "blocked";
}

export function buildApprovalWorkbenchHandoff(
  snapshot: QuoteCompareDecisionSnapshot,
): ApprovalWorkbenchHandoff {
  const hasFollowup = snapshot.followupVendorIds.length > 0;
  return {
    quoteCompareDecisionSnapshotId: snapshot.id,
    requestSubmissionEventId: snapshot.requestSubmissionEventId,
    shortlistVendorIds: snapshot.shortlistVendorIds,
    followupVendorIds: snapshot.followupVendorIds,
    compareRationaleSummary: snapshot.compareRationaleSummary,
    commercialRiskSummary: hasFollowup
      ? `${snapshot.followupVendorIds.length}개 공급사 추가 확인 필요`
      : "상업 리스크 없음",
    approvalReadiness: snapshot.shortlistVendorIds.length === 0
      ? "blocked"
      : hasFollowup
        ? "pending_followup"
        : "ready",
  };
}
