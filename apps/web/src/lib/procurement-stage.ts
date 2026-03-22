/**
 * Procurement Stage Mapping
 *
 * Quote 모델의 기존 QuoteStatus + QuoteVendorRequest 상태를
 * 운영형 stage pipeline으로 매핑합니다.
 *
 * 파이프라인:
 * search_selected → request_draft → request_submitted
 * → quote_queue → quote_waiting → quote_partial → quote_received → quote_compare_review
 * → approval_ready → approval_review → approved
 * → po_ready → po_created → receiving → stocked
 *
 * DB 스키마 변경 없이 기존 QuoteStatus enum을 활용합니다.
 */

export type ProcurementStage =
  | "quote_queue"           // 요청 접수, 아직 미발송
  | "quote_waiting"         // 발송 완료, 응답 대기
  | "quote_partial"         // 일부 응답 도착
  | "quote_received"        // 전체 응답 도착
  | "quote_compare_review"  // 비교 검토 필요
  | "approval_ready"        // 승인 준비 (견적 정리 완료)
  | "approval_review"       // 승인 검토 중
  | "approved"              // 승인 완료
  | "po_ready"              // 발주 전환 가능
  | "po_created"            // 발주 생성 완료
  | "cancelled"             // 취소
  | "blocked"               // 차단
  | "hold";                 // 보류

export interface StageInfo {
  stage: ProcurementStage;
  label: string;
  color: string;        // tailwind text color
  bgColor: string;      // tailwind bg color
  borderColor: string;  // tailwind border color
  priority: number;     // 낮을수록 긴급
  nextAction: string;
  queueTarget: "quote" | "approval" | "po" | "done" | "cancelled";
}

const STAGE_MAP: Record<ProcurementStage, Omit<StageInfo, "stage">> = {
  quote_queue:          { label: "요청 접수",      color: "text-slate-400",   bgColor: "bg-el",              borderColor: "border-bd",             priority: 5, nextAction: "발송 대기",     queueTarget: "quote" },
  quote_waiting:        { label: "회신 대기",      color: "text-amber-400",   bgColor: "bg-amber-600/10",    borderColor: "border-amber-600/30",   priority: 3, nextAction: "응답 확인",     queueTarget: "quote" },
  quote_partial:        { label: "일부 회신",      color: "text-blue-400",    bgColor: "bg-blue-600/10",     borderColor: "border-blue-600/30",    priority: 2, nextAction: "추가 응답 대기", queueTarget: "quote" },
  quote_received:       { label: "응답 완료",      color: "text-emerald-400", bgColor: "bg-emerald-600/10",  borderColor: "border-emerald-600/30", priority: 1, nextAction: "비교 검토",     queueTarget: "quote" },
  quote_compare_review: { label: "비교 검토 필요", color: "text-purple-400",  bgColor: "bg-purple-600/10",   borderColor: "border-purple-600/30",  priority: 0, nextAction: "비교 검토",     queueTarget: "quote" },
  approval_ready:       { label: "승인 준비",      color: "text-blue-400",    bgColor: "bg-blue-600/10",     borderColor: "border-blue-600/30",    priority: 2, nextAction: "승인 요청",     queueTarget: "approval" },
  approval_review:      { label: "승인 검토 중",   color: "text-amber-400",   bgColor: "bg-amber-600/10",    borderColor: "border-amber-600/30",   priority: 1, nextAction: "승인 판단",     queueTarget: "approval" },
  approved:             { label: "승인 완료",      color: "text-emerald-400", bgColor: "bg-emerald-600/10",  borderColor: "border-emerald-600/30", priority: 3, nextAction: "발주 전환",     queueTarget: "po" },
  po_ready:             { label: "발주 가능",      color: "text-blue-400",    bgColor: "bg-blue-600/10",     borderColor: "border-blue-600/30",    priority: 1, nextAction: "발주 생성",     queueTarget: "po" },
  po_created:           { label: "발주 완료",      color: "text-emerald-400", bgColor: "bg-emerald-600/10",  borderColor: "border-emerald-600/30", priority: 5, nextAction: "입고 대기",     queueTarget: "done" },
  cancelled:            { label: "취소됨",         color: "text-red-400",     bgColor: "bg-red-600/5",       borderColor: "border-red-600/20",     priority: 9, nextAction: "—",             queueTarget: "cancelled" },
  blocked:              { label: "차단",           color: "text-red-400",     bgColor: "bg-red-600/10",      borderColor: "border-red-600/30",     priority: 0, nextAction: "차단 해제",     queueTarget: "quote" },
  hold:                 { label: "보류",           color: "text-slate-400",   bgColor: "bg-slate-600/10",    borderColor: "border-slate-600/30",   priority: 7, nextAction: "재개",          queueTarget: "quote" },
};

export function getStageInfo(stage: ProcurementStage): StageInfo {
  const info = STAGE_MAP[stage];
  return { stage, ...info };
}

/**
 * QuoteStatus + VendorRequest 상태 조합으로 operational stage를 결정합니다.
 *
 * @param quoteStatus - Prisma QuoteStatus enum 값
 * @param vendorRequestCount - 총 vendor request 수
 * @param respondedCount - 응답 도착한 vendor request 수
 * @param isOverdue - 납기 초과 여부
 */
export function deriveStage(
  quoteStatus: string,
  vendorRequestCount: number = 0,
  respondedCount: number = 0,
  isOverdue: boolean = false,
): ProcurementStage {
  if (quoteStatus === "CANCELLED") return "cancelled";
  if (quoteStatus === "PURCHASED") return "po_created";

  if (quoteStatus === "COMPLETED") {
    // COMPLETED = 견적 비교/정리 완료 → 승인 단계로
    return "approval_ready";
  }

  if (quoteStatus === "RESPONDED") {
    // 전체 응답 도착 → 비교 검토 필요
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

  // PENDING = 아직 vendor에게 발송 안 됨
  return "quote_queue";
}

/** 견적관리 워크큐에 보여야 할 stage 목록 */
export const QUOTE_QUEUE_STAGES: ProcurementStage[] = [
  "quote_queue", "quote_waiting", "quote_partial",
  "quote_received", "quote_compare_review",
  "blocked", "hold",
];

/** 구매 승인 큐에 보여야 할 stage 목록 */
export const APPROVAL_QUEUE_STAGES: ProcurementStage[] = [
  "approval_ready", "approval_review", "approved",
  "blocked", "hold",
];

/** 발주전환 큐에 보여야 할 stage 목록 */
export const PO_QUEUE_STAGES: ProcurementStage[] = [
  "approved", "po_ready",
  "blocked", "hold",
];
