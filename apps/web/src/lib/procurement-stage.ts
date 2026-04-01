/**
 * Procurement Stage Mapping
 *
 * Core stage pipeline (approval-free by default):
 * search → compare → request_assembly → request_submitted
 * → quote_queue → quote_waiting → quote_partial → quote_received → quote_compare_review
 * → po_conversion_candidate → po_ready → po_created → receiving → stocked
 *
 * Approval은 core stage가 아닌 optional policy layer로 분리:
 * - approval_policy: "none" | "external_manual" | "in_app_light"
 * - approval_status: "not_required" | "external_approval_required" | ...
 *
 * DB 스키마 변경 없이 기존 QuoteStatus enum을 활용합니다.
 */

// ── Core Procurement Stage ──────────────────────────────────────

export type ProcurementStage =
  | "quote_queue"              // 요청 접수, 아직 미발송
  | "quote_waiting"            // 발송 완료, 응답 대기
  | "quote_partial"            // 일부 응답 도착
  | "quote_received"           // 전체 응답 도착
  | "quote_compare_review"     // 비교 검토 필요
  | "po_conversion_candidate"  // 발주 실행 후보 (승인 정책에 따라 바로 또는 외부 승인 확인 후)
  | "po_ready"                 // 발주 전환 가능
  | "po_created"               // 발주 생성 완료
  | "cancelled"                // 취소
  | "blocked"                  // 차단
  | "hold";                    // 보류

// ── Approval Policy (optional layer) ────────────────────────────

export type ApprovalPolicy = "none" | "external_manual" | "in_app_light";

export type ApprovalStatus =
  | "not_required"
  | "external_approval_required"
  | "external_approval_pending"
  | "externally_approved"
  | "externally_rejected"
  | "in_app_approval_pending"
  | "in_app_approved"
  | "in_app_rejected";

export interface ApprovalReadyPackage {
  selectedQuoteId: string;
  selectionReasonSummary: string;
  blockerStatus: "clear" | "has_exceptions";
  exceptionFlags: string[];
  reviewerNote: string;
  vendorSummary: string;
  amountSummary: number;
  leadTimeSummary: string;
  attachedDocsSummary: string[];
  budgetImpact: string;
}

// ── Stage Info ──────────────────────────────────────────────────

export interface StageInfo {
  stage: ProcurementStage;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  priority: number;
  nextAction: string;
  queueTarget: "quote" | "po" | "done" | "cancelled";
}

const STAGE_MAP: Record<ProcurementStage, Omit<StageInfo, "stage">> = {
  quote_queue:             { label: "요청 접수",      color: "text-slate-400",   bgColor: "bg-el",              borderColor: "border-bd",             priority: 5, nextAction: "발송 대기",     queueTarget: "quote" },
  quote_waiting:           { label: "회신 대기",      color: "text-amber-400",   bgColor: "bg-amber-600/10",    borderColor: "border-amber-600/30",   priority: 3, nextAction: "응답 확인",     queueTarget: "quote" },
  quote_partial:           { label: "일부 회신",      color: "text-blue-400",    bgColor: "bg-blue-600/10",     borderColor: "border-blue-600/30",    priority: 2, nextAction: "추가 응답 대기", queueTarget: "quote" },
  quote_received:          { label: "응답 완료",      color: "text-emerald-400", bgColor: "bg-emerald-600/10",  borderColor: "border-emerald-600/30", priority: 1, nextAction: "비교 검토",     queueTarget: "quote" },
  quote_compare_review:    { label: "비교 검토 필요", color: "text-purple-400",  bgColor: "bg-purple-600/10",   borderColor: "border-purple-600/30",  priority: 0, nextAction: "비교 검토",     queueTarget: "quote" },
  po_conversion_candidate: { label: "발주 실행 후보", color: "text-blue-400",    bgColor: "bg-blue-600/10",     borderColor: "border-blue-600/30",    priority: 2, nextAction: "발주 실행 준비", queueTarget: "po" },
  po_ready:                { label: "발주 가능",      color: "text-emerald-400", bgColor: "bg-emerald-600/10",  borderColor: "border-emerald-600/30", priority: 1, nextAction: "발주 생성",     queueTarget: "po" },
  po_created:              { label: "발주 완료",      color: "text-emerald-400", bgColor: "bg-emerald-600/10",  borderColor: "border-emerald-600/30", priority: 5, nextAction: "입고 대기",     queueTarget: "done" },
  cancelled:               { label: "취소됨",         color: "text-red-400",     bgColor: "bg-red-600/5",       borderColor: "border-red-600/20",     priority: 9, nextAction: "—",             queueTarget: "cancelled" },
  blocked:                 { label: "차단",           color: "text-red-400",     bgColor: "bg-red-600/10",      borderColor: "border-red-600/30",     priority: 0, nextAction: "차단 해제",     queueTarget: "quote" },
  hold:                    { label: "보류",           color: "text-slate-400",   bgColor: "bg-slate-600/10",    borderColor: "border-slate-600/30",   priority: 7, nextAction: "재개",          queueTarget: "quote" },
};

export function getStageInfo(stage: ProcurementStage): StageInfo {
  const info = STAGE_MAP[stage];
  return { stage, ...info };
}

/**
 * Policy-aware next action label을 반환합니다.
 * approval_policy에 따라 동일 stage에서 다른 CTA 문구를 줘야 할 때 사용합니다.
 */
export function getNextActionLabel(stage: ProcurementStage, policy: ApprovalPolicy = "none"): string {
  if (stage === "po_conversion_candidate") {
    switch (policy) {
      case "none": return "발주 실행 준비";
      case "external_manual": return "승인 증빙 연결";
      case "in_app_light": return "간이 승인 확인";
    }
  }
  return getStageInfo(stage).nextAction;
}

/**
 * Approval policy 기준으로 PO 실행이 가능한지 판단합니다.
 * 승인 source of truth는 외부 시스템에 두고, LabAxis는 확인 결과만 반영합니다.
 */
export function canConvertToPO(policy: ApprovalPolicy, approvalStatus: ApprovalStatus): boolean {
  switch (policy) {
    case "none": return true;
    case "external_manual": return approvalStatus === "externally_approved";
    case "in_app_light": return approvalStatus === "in_app_approved";
  }
}

// ── Stage Derivation ────────────────────────────────────────────

export function deriveStage(
  quoteStatus: string,
  vendorRequestCount: number = 0,
  respondedCount: number = 0,
  isOverdue: boolean = false,
): ProcurementStage {
  if (quoteStatus === "CANCELLED") return "cancelled";
  if (quoteStatus === "PURCHASED") return "po_created";

  if (quoteStatus === "COMPLETED") {
    // COMPLETED = 견적 비교/정리 완료 → 발주 전환 후보
    return "po_conversion_candidate";
  }

  if (quoteStatus === "RESPONDED") {
    return "quote_compare_review";
  }

  if (quoteStatus === "SENT") {
    if (respondedCount > 0 && respondedCount >= vendorRequestCount) {
      return "quote_received";
    }
    if (respondedCount > 0) {
      return "quote_partial";
    }
    return "quote_waiting";
  }

  return "quote_queue";
}

// ── Queue Stage Groups ──────────────────────────────────────────

/** 견적관리 워크큐에 보여야 할 stage 목록 */
export const QUOTE_QUEUE_STAGES: ProcurementStage[] = [
  "quote_queue", "quote_waiting", "quote_partial",
  "quote_received", "quote_compare_review",
  "blocked", "hold",
];

/** 발주실행 큐에 보여야 할 stage 목록 */
export const PO_QUEUE_STAGES: ProcurementStage[] = [
  "po_conversion_candidate", "po_ready",
  "blocked", "hold",
];
