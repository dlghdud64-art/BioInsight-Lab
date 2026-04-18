/**
 * ops-console/receiving-detail-adapter.ts
 *
 * Receiving Detail Execution Console용 어댑터.
 * receiving-inbound-contract를 기반으로 실행 모델을 구성한다.
 * contract.ts는 건드리지 않고 UI adapter 레이어에서만 파생.
 */

import type {
  ReceivingBatchContract,
  ReceivingLineReceiptContract,
  ReceivedLotRecordContract,
  ReceivingBatchStatus,
} from "../review-queue/receiving-inbound-contract";
import type { PurchaseOrderContract } from "../review-queue/po-approval-contract";

// ---------------------------------------------------------------------------
// 1. Receiving Execution State
// ---------------------------------------------------------------------------

export type ReceivingExecutionPhase =
  | "expected"
  | "arrived"
  | "inspection_pending"
  | "inspection_in_progress"
  | "docs_missing"
  | "quarantine_active"
  | "ready_to_post"
  | "partial_posting"
  | "posted"
  | "issue_flagged"
  | "closed"
  | "cancelled";

export interface ReceivingExecutionState {
  phase: ReceivingExecutionPhase;
  phaseLabel: string;
  phaseTone: "neutral" | "info" | "warning" | "danger" | "success";
}

// ---------------------------------------------------------------------------
// 2. Receipt Progress Summary
// ---------------------------------------------------------------------------

export interface ReceiptProgressSummary {
  totalLines: number;
  receivedLines: number;
  partialLines: number;
  missingLines: number;
  overReceivedLines: number;
  rejectedLines: number;
  totalOrdered: number;
  totalReceived: number;
  label: string;
}

// ---------------------------------------------------------------------------
// 3. Inspection Summary
// ---------------------------------------------------------------------------

export interface InspectionSummary {
  totalRequired: number;
  passed: number;
  failed: number;
  pending: number;
  conditionalPass: number;
  reinspectRequired: number;
  label: string;
  tone: "neutral" | "info" | "warning" | "danger" | "success";
  blockerLabel: string | null;
}

// ---------------------------------------------------------------------------
// 4. Document Summary
// ---------------------------------------------------------------------------

export interface DocumentSummary {
  completeLines: number;
  partialLines: number;
  missingLines: number;
  needsReviewLines: number;
  totalLines: number;
  label: string;
  tone: "neutral" | "info" | "warning" | "danger" | "success";
  missingTypes: string[];
}

// ---------------------------------------------------------------------------
// 5. Lot Capture Summary
// ---------------------------------------------------------------------------

export interface LotCaptureSummary {
  totalLots: number;
  usableLots: number;
  quarantinedLots: number;
  blockedLots: number;
  expiredLots: number;
  missingExpiryLots: number;
  label: string;
  tone: "neutral" | "info" | "warning" | "danger" | "success";
}

export interface LotDetailRow {
  id: string;
  lineNumber: number;
  itemName: string;
  lotNumber: string;
  quantity: number;
  unit: string;
  expiryLabel: string;
  expiryTone: "safe" | "expiring_soon" | "expired" | "missing";
  quarantineLabel: string;
  quarantineTone: "neutral" | "warning" | "danger" | "success";
  documentCoverage: string;
  postingState: string;
  riskBadges: string[];
  nextAction: string | null;
}

// ---------------------------------------------------------------------------
// 6. Posting Readiness
// ---------------------------------------------------------------------------

export type PostingReadiness = "ready" | "partial" | "blocked";

export interface PostingReadinessSummary {
  readiness: PostingReadiness;
  label: string;
  blockers: string[];
  postableLineCount: number;
  blockedLineCount: number;
  totalLineCount: number;
}

// ---------------------------------------------------------------------------
// 7. Inventory Release / Stock-Risk Handoff Summary
// ---------------------------------------------------------------------------

export interface InventoryReleaseSummary {
  postedLots: number;
  quarantinedLots: number;
  availableAfterPosting: number;
  quarantinedAfterPosting: number;
  label: string;
}

export interface StockRiskHandoffSummary {
  needed: boolean;
  label: string;
  nextOwner: string | null;
  targetRoute: string;
  followUpReasons: string[];
}

// ---------------------------------------------------------------------------
// 8. Line Execution Summary
// ---------------------------------------------------------------------------

export interface ReceivingLineExecution {
  id: string;
  lineNumber: number;
  itemLabel: string;
  orderedVsReceived: string;
  conditionLabel: string;
  conditionTone: "neutral" | "warning" | "danger" | "success";
  documentLabel: string;
  documentTone: "neutral" | "warning" | "danger" | "success";
  inspectionLabel: string;
  inspectionTone: "neutral" | "info" | "warning" | "danger" | "success";
  lotSummary: string;
  postingRelevance: string;
  nextAction: string | null;
}

// ---------------------------------------------------------------------------
// 9. Origin Summary
// ---------------------------------------------------------------------------

export interface ReceivingOriginSummary {
  sourceType: "purchase_order" | "manual_return" | "transfer" | "sample";
  sourceLabel: string;
  poRef: string | null;
  poRoute: string | null;
  vendorSummary: string;
  arrivalLabel: string;
  trackingLabel: string | null;
  returnRoute: string;
}

// ---------------------------------------------------------------------------
// 10. Unified Receiving Execution Model
// ---------------------------------------------------------------------------

export interface ReceivingExecutionModel {
  receivingExecutionState: ReceivingExecutionState;
  receiptProgress: ReceiptProgressSummary;
  inspection: InspectionSummary;
  document: DocumentSummary;
  lotCapture: LotCaptureSummary;
  lotDetails: LotDetailRow[];
  postingReadiness: PostingReadinessSummary;
  inventoryRelease: InventoryReleaseSummary;
  stockRiskHandoff: StockRiskHandoffSummary;
  lineExecutions: ReceivingLineExecution[];
  origin: ReceivingOriginSummary;
  blockedReasonSummary: string | null;
  nextOwnerName: string | null;
  nextRoute: string | null;
  nextActionSummary: string;
}

// ===========================================================================
// Builder Functions
// ===========================================================================

const CONDITION_LABELS: Record<string, string> = {
  ok: "양호",
  damaged: "파손",
  leaking: "누수",
  temperature_excursion: "온도 이탈",
  packaging_issue: "포장 불량",
  label_issue: "라벨 문제",
  unknown: "미확인",
};

const CONDITION_TONES: Record<string, "neutral" | "warning" | "danger" | "success"> = {
  ok: "success",
  damaged: "danger",
  leaking: "danger",
  temperature_excursion: "danger",
  packaging_issue: "warning",
  label_issue: "warning",
  unknown: "neutral",
};

const DOC_LABELS: Record<string, string> = {
  complete: "완료",
  partial: "부분",
  missing: "누락",
  not_required: "불요",
  needs_review: "검토 필요",
};

const DOC_TONES: Record<string, "neutral" | "warning" | "danger" | "success"> = {
  complete: "success",
  partial: "warning",
  missing: "danger",
  not_required: "neutral",
  needs_review: "warning",
};

const INSPECTION_LABELS: Record<string, string> = {
  not_required: "불요",
  pending: "대기",
  in_progress: "진행",
  passed: "합격",
  failed: "불합격",
  conditional_pass: "조건부",
  reinspect_required: "재검수",
};

const INSPECTION_TONES: Record<string, "neutral" | "info" | "warning" | "danger" | "success"> = {
  not_required: "neutral",
  pending: "warning",
  in_progress: "info",
  passed: "success",
  failed: "danger",
  conditional_pass: "warning",
  reinspect_required: "danger",
};

// ---------------------------------------------------------------------------
// resolveReceivingExecutionPhase
// ---------------------------------------------------------------------------

export function resolveReceivingExecutionPhase(rb: ReceivingBatchContract): ReceivingExecutionState {
  if (rb.status === "cancelled") return { phase: "cancelled", phaseLabel: "취소", phaseTone: "neutral" };
  if (rb.status === "closed") return { phase: "closed", phaseLabel: "마감", phaseTone: "neutral" };
  if (rb.status === "posted") return { phase: "posted", phaseLabel: "반영 완료", phaseTone: "success" };
  if (rb.status === "expected") return { phase: "expected", phaseLabel: "입고 예정", phaseTone: "neutral" };

  const hasDocMissing = rb.lineReceipts.some((l) => l.documentStatus === "partial" || l.documentStatus === "missing");
  const hasQuarantine = rb.lineReceipts.some((l) => l.lotRecords.some((lot) => lot.quarantineStatus === "quarantined" || lot.quarantineStatus === "blocked"));
  const hasInspectionPending = rb.lineReceipts.some(
    (l) => l.inspectionRequired && (l.inspectionStatus === "pending" || l.inspectionStatus === "in_progress"),
  );
  const isPosted = (rb.status as any) === "posted" || (rb.status as any) === "closed";
  const canPost = !hasDocMissing && !hasQuarantine && !hasInspectionPending && !isPosted;

  if (rb.status === "issue_flagged") return { phase: "issue_flagged", phaseLabel: "이슈 발생", phaseTone: "danger" };

  if (hasQuarantine) return { phase: "quarantine_active", phaseLabel: "격리 활성", phaseTone: "danger" };
  if (hasDocMissing) return { phase: "docs_missing", phaseLabel: "문서 누락", phaseTone: "warning" };

  if (rb.status === "inspection_in_progress" || hasInspectionPending) {
    return { phase: "inspection_in_progress", phaseLabel: "검수 진행", phaseTone: "warning" };
  }

  if (rb.status === "ready_to_post" || canPost) {
    return { phase: "ready_to_post", phaseLabel: "반영 준비", phaseTone: "info" };
  }

  if (rb.status === "arrived") return { phase: "arrived", phaseLabel: "도착", phaseTone: "info" };

  return { phase: "inspection_pending", phaseLabel: "검수 대기", phaseTone: "warning" };
}

// ---------------------------------------------------------------------------
// buildReceiptProgress
// ---------------------------------------------------------------------------

export function buildReceiptProgress(rb: ReceivingBatchContract): ReceiptProgressSummary {
  const lines = rb.lineReceipts;
  const received = lines.filter((l) => l.receiptStatus === "received" || l.receiptStatus === "posted");
  const partial = lines.filter((l) => l.receiptStatus === "partially_received");
  const missing = lines.filter((l) => l.receiptStatus === "missing");
  const over = lines.filter((l) => l.receiptStatus === "over_received");
  const rejected = lines.filter((l) => l.receiptStatus === "rejected");

  const totalOrdered = lines.reduce((s, l) => s + (l.orderedQuantity ?? 0), 0);
  const totalReceived = lines.reduce((s, l) => s + l.receivedQuantity, 0);

  return {
    totalLines: lines.length,
    receivedLines: received.length,
    partialLines: partial.length,
    missingLines: missing.length,
    overReceivedLines: over.length,
    rejectedLines: rejected.length,
    totalOrdered,
    totalReceived,
    label: `${totalReceived}/${totalOrdered} 수령 · ${received.length}/${lines.length} 라인 완료`,
  };
}

// ---------------------------------------------------------------------------
// buildInspectionSummary
// ---------------------------------------------------------------------------

export function buildInspectionSummary(rb: ReceivingBatchContract): InspectionSummary {
  const required = rb.lineReceipts.filter((l) => l.inspectionRequired);
  const passed = required.filter((l) => l.inspectionStatus === "passed").length;
  const failed = required.filter((l) => l.inspectionStatus === "failed").length;
  const pending = required.filter((l) => l.inspectionStatus === "pending" || l.inspectionStatus === "in_progress").length;
  const conditional = required.filter((l) => l.inspectionStatus === "conditional_pass").length;
  const reinspect = required.filter((l) => l.inspectionStatus === "reinspect_required").length;

  let tone: InspectionSummary["tone"] = "neutral";
  let blockerLabel: string | null = null;

  if (required.length === 0) {
    return { totalRequired: 0, passed: 0, failed: 0, pending: 0, conditionalPass: 0, reinspectRequired: 0, label: "검수 불요", tone: "neutral", blockerLabel: null };
  }

  if (failed > 0) { tone = "danger"; blockerLabel = `${failed}건 불합격 — 재고 반영 차단`; }
  else if (pending > 0) { tone = "warning"; blockerLabel = `${pending}건 검수 대기`; }
  else if (reinspect > 0) { tone = "warning"; blockerLabel = `${reinspect}건 재검수 필요`; }
  else if (conditional > 0) { tone = "warning"; }
  else { tone = "success"; }

  return {
    totalRequired: required.length,
    passed,
    failed,
    pending,
    conditionalPass: conditional,
    reinspectRequired: reinspect,
    label: `검수 ${passed}/${required.length} 합격`,
    tone,
    blockerLabel,
  };
}

// ---------------------------------------------------------------------------
// buildDocumentSummary
// ---------------------------------------------------------------------------

export function buildDocumentSummary(rb: ReceivingBatchContract): DocumentSummary {
  const lines = rb.lineReceipts;
  const complete = lines.filter((l) => l.documentStatus === "complete" || l.documentStatus === "not_required").length;
  const partial = lines.filter((l) => l.documentStatus === "partial").length;
  const missing = lines.filter((l) => l.documentStatus === "missing").length;
  const needsReview = lines.filter((l) => l.documentStatus === "needs_review").length;

  const missingTypes: string[] = [];
  for (const line of lines) {
    for (const lot of line.lotRecords) {
      if (!lot.coaAttached) missingTypes.push("COA");
      if (!lot.msdsAttached) missingTypes.push("MSDS");
    }
  }
  const uniqueMissing = [...new Set(missingTypes)];

  let tone: DocumentSummary["tone"] = "neutral";
  if (missing > 0) tone = "danger";
  else if (partial > 0 || needsReview > 0) tone = "warning";
  else tone = "success";

  return {
    completeLines: complete,
    partialLines: partial,
    missingLines: missing,
    needsReviewLines: needsReview,
    totalLines: lines.length,
    label: missing > 0 ? `${missing}건 문서 누락` : partial > 0 ? `${partial}건 부분 첨부` : "문서 완료",
    tone,
    missingTypes: uniqueMissing,
  };
}

// ---------------------------------------------------------------------------
// buildLotCaptureSummary + buildLotDetails
// ---------------------------------------------------------------------------

export function buildLotCaptureSummary(rb: ReceivingBatchContract): LotCaptureSummary {
  const allLots = rb.lineReceipts.flatMap((l) => l.lotRecords);
  const usable = allLots.filter((l) => l.quarantineStatus === "released" || l.quarantineStatus === "not_applicable");
  const quarantined = allLots.filter((l) => l.quarantineStatus === "quarantined");
  const blocked = allLots.filter((l) => l.quarantineStatus === "blocked");

  const now = Date.now();
  const expired = allLots.filter((l) => l.expiryDate && new Date(l.expiryDate).getTime() < now);
  const missingExpiry = allLots.filter((l) => !l.expiryDate);

  let tone: LotCaptureSummary["tone"] = "neutral";
  if (blocked.length > 0 || expired.length > 0) tone = "danger";
  else if (quarantined.length > 0 || missingExpiry.length > 0) tone = "warning";
  else tone = "success";

  return {
    totalLots: allLots.length,
    usableLots: usable.length,
    quarantinedLots: quarantined.length,
    blockedLots: blocked.length,
    expiredLots: expired.length,
    missingExpiryLots: missingExpiry.length,
    label: `${allLots.length} lot — ${usable.length} 사용가능 · ${quarantined.length} 격리`,
    tone,
  };
}

export function buildLotDetails(rb: ReceivingBatchContract): LotDetailRow[] {
  const now = Date.now();
  const rows: LotDetailRow[] = [];

  for (const line of rb.lineReceipts) {
    for (const lot of line.lotRecords) {
      // Expiry
      let expiryLabel = "미입력";
      let expiryTone: LotDetailRow["expiryTone"] = "missing";
      if (lot.expiryDate) {
        const exp = new Date(lot.expiryDate);
        const diffDays = (exp.getTime() - now) / (1000 * 60 * 60 * 24);
        expiryLabel = exp.toLocaleDateString("ko-KR");
        if (diffDays < 0) { expiryLabel += " (만료)"; expiryTone = "expired"; }
        else if (diffDays <= 90) { expiryLabel += ` (${Math.ceil(diffDays)}일)` ; expiryTone = "expiring_soon"; }
        else { expiryTone = "safe"; }
      }

      // Quarantine
      const qMap: Record<string, { label: string; tone: LotDetailRow["quarantineTone"] }> = {
        not_applicable: { label: "해당없음", tone: "neutral" },
        pending: { label: "판정 대기", tone: "warning" },
        quarantined: { label: "격리", tone: "danger" },
        released: { label: "출고 허가", tone: "success" },
        blocked: { label: "차단", tone: "danger" },
      };
      const q = qMap[lot.quarantineStatus] ?? { label: lot.quarantineStatus, tone: "neutral" as const };

      // Document coverage
      const docs: string[] = [];
      if (lot.coaAttached) docs.push("COA");
      if (lot.msdsAttached) docs.push("MSDS");
      if (lot.validationAttached) docs.push("Val");
      if (lot.warrantyAttached) docs.push("War");
      const docCoverage = docs.length > 0 ? docs.join(" · ") : "없음";

      // Posting state
      let postingState = lot.inventoryPostingId ? "반영됨" : "미반영";
      if (lot.quarantineStatus === "quarantined" || lot.quarantineStatus === "blocked") postingState = "차단";

      // Risk badges
      const riskBadges: string[] = [];
      if (lot.labelStatus === "mismatch") riskBadges.push("라벨 불일치");
      if (lot.labelStatus === "missing") riskBadges.push("라벨 누락");
      if (expiryTone === "expired") riskBadges.push("만료");
      if (expiryTone === "expiring_soon") riskBadges.push("만료 임박");
      if (!lot.coaAttached) riskBadges.push("COA 없음");

      // Next action
      let nextAction: string | null = null;
      if (lot.quarantineStatus === "quarantined") nextAction = "격리 검사";
      else if (lot.quarantineStatus === "blocked") nextAction = "차단 해소";
      else if (expiryTone === "expired") nextAction = "만료 처리";
      else if (!lot.coaAttached) nextAction = "COA 확보";
      else if (lot.labelStatus !== "ok") nextAction = "라벨 확인";

      rows.push({
        id: lot.id,
        lineNumber: line.lineNumber,
        itemName: line.itemName,
        lotNumber: lot.lotNumber,
        quantity: lot.quantity,
        unit: lot.unit,
        expiryLabel,
        expiryTone,
        quarantineLabel: q.label,
        quarantineTone: q.tone,
        documentCoverage: docCoverage,
        postingState,
        riskBadges,
        nextAction,
      });
    }
  }
  return rows;
}

// ---------------------------------------------------------------------------
// buildPostingReadiness
// ---------------------------------------------------------------------------

export function buildPostingReadiness(rb: ReceivingBatchContract): PostingReadinessSummary {
  const isPosted = rb.status === "posted" || rb.status === "closed";
  if (isPosted) {
    return { readiness: "ready", label: "반영 완료", blockers: [], postableLineCount: rb.lineReceipts.length, blockedLineCount: 0, totalLineCount: rb.lineReceipts.length };
  }

  const blockers: string[] = [];
  let blockedCount = 0;

  for (const line of rb.lineReceipts) {
    let lineBlocked = false;
    if (line.documentStatus === "missing" || line.documentStatus === "partial") {
      if (!blockers.includes("문서 미첨부 라인 존재")) blockers.push("문서 미첨부 라인 존재");
      lineBlocked = true;
    }
    if (line.inspectionRequired && line.inspectionStatus !== "passed" && line.inspectionStatus !== "not_required" && line.inspectionStatus !== "conditional_pass") {
      if (!blockers.includes("검수 미완료 라인 존재")) blockers.push("검수 미완료 라인 존재");
      lineBlocked = true;
    }
    if (line.lotRecords.some((lot) => lot.quarantineStatus === "quarantined" || lot.quarantineStatus === "blocked")) {
      if (!blockers.includes("격리 품목 미해결")) blockers.push("격리 품목 미해결");
      lineBlocked = true;
    }
    if (lineBlocked) blockedCount++;
  }

  const postableCount = rb.lineReceipts.length - blockedCount;

  if (blockers.length === 0) {
    return { readiness: "ready", label: "재고 반영 가능", blockers: [], postableLineCount: postableCount, blockedLineCount: 0, totalLineCount: rb.lineReceipts.length };
  }
  if (postableCount > 0) {
    return { readiness: "partial", label: `부분 반영 가능 (${postableCount}/${rb.lineReceipts.length})`, blockers, postableLineCount: postableCount, blockedLineCount: blockedCount, totalLineCount: rb.lineReceipts.length };
  }
  return { readiness: "blocked", label: "재고 반영 차단", blockers, postableLineCount: 0, blockedLineCount: blockedCount, totalLineCount: rb.lineReceipts.length };
}

// ---------------------------------------------------------------------------
// buildInventoryRelease + buildStockRiskHandoff
// ---------------------------------------------------------------------------

export function buildInventoryRelease(rb: ReceivingBatchContract): InventoryReleaseSummary {
  const allLots = rb.lineReceipts.flatMap((l) => l.lotRecords);
  const posted = allLots.filter((l) => !!l.inventoryPostingId);
  const quarantined = allLots.filter((l) => l.quarantineStatus === "quarantined" || l.quarantineStatus === "blocked");
  const available = posted.filter((l) => l.quarantineStatus === "released" || l.quarantineStatus === "not_applicable");

  return {
    postedLots: posted.length,
    quarantinedLots: quarantined.length,
    availableAfterPosting: available.reduce((s, l) => s + l.quantity, 0),
    quarantinedAfterPosting: quarantined.reduce((s, l) => s + l.quantity, 0),
    label: posted.length > 0
      ? `${posted.length} lot 반영 · ${quarantined.length} lot 격리`
      : "미반영",
  };
}

export function buildStockRiskHandoff(rb: ReceivingBatchContract): StockRiskHandoffSummary {
  const isPosted = rb.status === "posted" || rb.status === "closed";
  const hasQuarantine = rb.lineReceipts.some((l) => l.lotRecords.some((lot) => lot.quarantineStatus === "quarantined" || lot.quarantineStatus === "blocked"));
  const hasExpiringLots = rb.lineReceipts.some((l) => l.lotRecords.some((lot) => {
    if (!lot.expiryDate) return false;
    return (new Date(lot.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24) <= 90;
  }));

  const reasons: string[] = [];
  if (hasQuarantine) reasons.push("격리 품목 재고 영향 확인");
  if (hasExpiringLots) reasons.push("만료 임박 lot 관리");
  if (isPosted) reasons.push("재고 수준 재계산");

  return {
    needed: isPosted || hasQuarantine || hasExpiringLots,
    label: reasons.length > 0 ? `재고 위험 확인 필요 (${reasons.length}건)` : "후속 조치 불요",
    nextOwner: reasons.length > 0 ? "재고 관리자" : null,
    targetRoute: "/dashboard/stock-risk",
    followUpReasons: reasons,
  };
}

// ---------------------------------------------------------------------------
// buildReceivingLineExecutions
// ---------------------------------------------------------------------------

export function buildReceivingLineExecutions(rb: ReceivingBatchContract): ReceivingLineExecution[] {
  return rb.lineReceipts.map((line) => {
    const orderedVsReceived = line.orderedQuantity
      ? `${line.receivedQuantity}/${line.orderedQuantity} ${line.receivedUnit}`
      : `${line.receivedQuantity} ${line.receivedUnit}`;

    const lotCount = line.lotRecords.length;
    const quarantinedLots = line.lotRecords.filter((l) => l.quarantineStatus === "quarantined" || l.quarantineStatus === "blocked").length;
    const lotSummary = quarantinedLots > 0
      ? `${lotCount} lot (${quarantinedLots} 격리)`
      : `${lotCount} lot`;

    // Posting relevance
    const postedLots = line.lotRecords.filter((l) => !!l.inventoryPostingId).length;
    let postingRelevance = "미반영";
    if (postedLots === lotCount && lotCount > 0) postingRelevance = "반영 완료";
    else if (postedLots > 0) postingRelevance = `${postedLots}/${lotCount} 반영`;
    else if (line.documentStatus === "missing" || line.inspectionStatus === "failed") postingRelevance = "차단";

    // Next action
    let nextAction: string | null = null;
    if (line.inspectionRequired && (line.inspectionStatus === "pending" || line.inspectionStatus === "in_progress")) {
      nextAction = "검수 완료";
    } else if (line.inspectionStatus === "failed") {
      nextAction = "불합격 처리";
    } else if (line.inspectionStatus === "reinspect_required") {
      nextAction = "재검수";
    } else if (line.documentStatus === "missing" || line.documentStatus === "partial") {
      nextAction = "문서 확보";
    } else if (quarantinedLots > 0) {
      nextAction = "격리 검사";
    }

    return {
      id: line.id,
      lineNumber: line.lineNumber,
      itemLabel: `${line.itemName}${line.catalogNumber ? ` (${line.catalogNumber})` : ""}`,
      orderedVsReceived,
      conditionLabel: CONDITION_LABELS[line.conditionStatus] ?? line.conditionStatus,
      conditionTone: CONDITION_TONES[line.conditionStatus] ?? "neutral",
      documentLabel: DOC_LABELS[line.documentStatus] ?? line.documentStatus,
      documentTone: DOC_TONES[line.documentStatus] ?? "neutral",
      inspectionLabel: INSPECTION_LABELS[line.inspectionStatus] ?? line.inspectionStatus,
      inspectionTone: INSPECTION_TONES[line.inspectionStatus] ?? "neutral",
      lotSummary,
      postingRelevance,
      nextAction,
    };
  });
}

// ---------------------------------------------------------------------------
// buildReceivingOrigin
// ---------------------------------------------------------------------------

export function buildReceivingOrigin(
  rb: ReceivingBatchContract,
  linkedPO: PurchaseOrderContract | undefined,
  vendorName: string,
): ReceivingOriginSummary {
  const sourceLabels: Record<string, string> = {
    purchase_order: "발주 기반",
    manual_return: "수동 반품",
    transfer: "이관",
    sample: "샘플",
  };

  return {
    sourceType: rb.sourceType,
    sourceLabel: sourceLabels[rb.sourceType] ?? rb.sourceType,
    poRef: linkedPO?.poNumber ?? null,
    poRoute: linkedPO ? `/dashboard/purchase-orders/${linkedPO.id}` : null,
    vendorSummary: vendorName,
    arrivalLabel: new Date(rb.receivedAt).toLocaleDateString("ko-KR"),
    trackingLabel: rb.trackingNumber ?? null,
    returnRoute: "/dashboard/receiving",
  };
}

// ---------------------------------------------------------------------------
// buildReceivingExecutionModel — unified builder
// ---------------------------------------------------------------------------

export function buildReceivingExecutionModel(
  rb: ReceivingBatchContract,
  linkedPO: PurchaseOrderContract | undefined,
  vendorName: string,
): ReceivingExecutionModel {
  const receivingExecutionState = resolveReceivingExecutionPhase(rb);
  const receiptProgress = buildReceiptProgress(rb);
  const inspection = buildInspectionSummary(rb);
  const document = buildDocumentSummary(rb);
  const lotCapture = buildLotCaptureSummary(rb);
  const lotDetails = buildLotDetails(rb);
  const postingReadiness = buildPostingReadiness(rb);
  const inventoryRelease = buildInventoryRelease(rb);
  const stockRiskHandoff = buildStockRiskHandoff(rb);
  const lineExecutions = buildReceivingLineExecutions(rb);
  const origin = buildReceivingOrigin(rb, linkedPO, vendorName);

  // Blocked reason
  let blockedReasonSummary: string | null = null;
  if (postingReadiness.readiness === "blocked" && postingReadiness.blockers.length > 0) {
    blockedReasonSummary = postingReadiness.blockers[0]!;
  } else if (inspection.blockerLabel) {
    blockedReasonSummary = inspection.blockerLabel;
  }

  // Next owner
  let nextOwnerName: string | null = null;
  if (receivingExecutionState.phase === "inspection_pending" || receivingExecutionState.phase === "inspection_in_progress") {
    nextOwnerName = "검수 담당자";
  } else if (receivingExecutionState.phase === "ready_to_post") {
    nextOwnerName = "재고 반영 담당자";
  } else if (receivingExecutionState.phase === "posted") {
    nextOwnerName = stockRiskHandoff.nextOwner;
  }

  // Next route
  let nextRoute: string | null = null;
  if (receivingExecutionState.phase === "posted") {
    nextRoute = "/dashboard/stock-risk";
  }

  // Next action summary
  const nextActionMap: Partial<Record<ReceivingExecutionPhase, string>> = {
    expected: "도착 확인",
    arrived: "수령 확인 + 검수 시작",
    inspection_pending: "검수 시작",
    inspection_in_progress: inspection.blockerLabel ?? "검수 완료",
    docs_missing: "문서 확보",
    quarantine_active: "격리 검사 실행",
    ready_to_post: "재고 반영",
    partial_posting: "잔여 반영",
    posted: "재고 위험 확인",
    issue_flagged: "이슈 해결",
    closed: "완료",
    cancelled: "—",
  };

  return {
    receivingExecutionState,
    receiptProgress,
    inspection,
    document,
    lotCapture,
    lotDetails,
    postingReadiness,
    inventoryRelease,
    stockRiskHandoff,
    lineExecutions,
    origin,
    blockedReasonSummary,
    nextOwnerName,
    nextRoute,
    nextActionSummary: nextActionMap[receivingExecutionState.phase] ?? "확인",
  };
}
