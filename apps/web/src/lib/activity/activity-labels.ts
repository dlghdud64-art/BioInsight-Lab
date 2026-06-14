// §log-consolidation P2 — 활동 로그 표시 라벨 단일 소스.
//
// 활동 로그가 standalone(/dashboard/activity-logs)과 통합 surface(/dashboard/audit
// 활동 모드) 두 곳에서 소비되므로, 라벨/색상/분류 helper 를 단일 모듈로 통합해
// 두 surface 간 표시 drift 를 차단한다(canonical 표시 보호).
//
// 데이터 자체는 ActivityLog(Prisma) 가 canonical truth — 본 모듈은 표시 파생만.
//
// §11.299 (호영님 P1) — schema ActivityType enum 30+ 값 모두 한글 매핑.
// 누락 시 raw 영문 enum 노출 회귀 차단.

export const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  // 견적/리스트
  QUOTE_CREATED: "리스트 생성",
  QUOTE_UPDATED: "리스트 수정",
  QUOTE_DELETED: "리스트 삭제",
  QUOTE_SHARED: "리스트 공유",
  QUOTE_VIEWED: "리스트 조회",
  QUOTE_STATUS_CHANGED: "견적 상태 변경",
  QUOTE_DRAFT_GENERATED: "견적 초안 생성",
  QUOTE_DRAFT_REVIEWED: "견적 초안 검토",
  QUOTE_DRAFT_STARTED_FROM_COMPARE: "비교에서 견적 초안 생성",
  // 제품/검색
  PRODUCT_COMPARED: "제품 비교",
  PRODUCT_VIEWED: "제품 조회",
  PRODUCT_FAVORITED: "제품 즐겨찾기",
  SEARCH_PERFORMED: "검색 수행",
  COMPARE_RESULT_VIEWED: "비교 결과 조회",
  COMPARE_SESSION_REOPENED: "비교 세션 재개",
  COMPARE_INQUIRY_DRAFT_STATUS_CHANGED: "비교 문의 초안 상태 변경",
  // 이메일
  EMAIL_DRAFT_GENERATED: "이메일 초안 생성",
  EMAIL_SENT: "이메일 발송",
  VENDOR_REPLY_LOGGED: "공급사 회신 기록",
  // 발주
  ORDER_FOLLOWUP_GENERATED: "발주 후속 조치 생성",
  ORDER_FOLLOWUP_REVIEWED: "발주 후속 조치 검토",
  ORDER_FOLLOWUP_SENT: "발주 후속 조치 발송",
  ORDER_STATUS_CHANGE_PROPOSED: "발주 상태 변경 제안",
  ORDER_STATUS_CHANGE_APPROVED: "발주 상태 변경 승인",
  ORDER_STATUS_CHANGED: "발주 상태 변경",
  // 재고
  INVENTORY_RESTOCK_SUGGESTED: "재발주 제안",
  INVENTORY_RESTOCK_REVIEWED: "재발주 검토",
  // 구매 요청
  PURCHASE_REQUEST_CREATED: "구매 요청 생성",
  PURCHASE_REQUEST_CANCELLED: "구매 요청 취소",
  PURCHASE_REQUEST_REVERSED: "구매 요청 되돌림",
  PURCHASE_RECORD_RECLASSIFIED: "구매 레코드 재분류",
  // AI 작업
  AI_TASK_CREATED: "AI 작업 생성",
  AI_TASK_OPENED: "AI 작업 열기",
  AI_TASK_COMPLETED: "AI 작업 완료",
  AI_TASK_FAILED: "AI 작업 실패",
};

// §11.299 — entity type 한글 매핑 (filter dropdown + 카드 표시).
export const ENTITY_TYPE_LABELS: Record<string, string> = {
  quote: "견적",
  QUOTE: "견적",
  product: "제품",
  PRODUCT: "제품",
  search: "검색",
  SEARCH: "검색",
  order: "발주",
  ORDER: "발주",
  inventory: "재고",
  INVENTORY: "재고",
  vendor: "공급사",
  VENDOR: "공급사",
  user: "사용자",
  USER: "사용자",
  email: "이메일",
  EMAIL: "이메일",
};

export const ACTIVITY_TYPE_COLORS: Record<string, string> = {
  QUOTE_CREATED: "bg-blue-100 text-blue-700 border-blue-200",
  QUOTE_UPDATED: "bg-yellow-100 text-yellow-700 border-yellow-200",
  QUOTE_DELETED: "bg-red-100 text-red-700 border-red-200",
  QUOTE_SHARED: "bg-green-100 text-green-700 border-green-200",
  QUOTE_VIEWED: "bg-purple-100 text-purple-700 border-purple-200",
  PRODUCT_COMPARED: "bg-indigo-100 text-indigo-700 border-indigo-200",
  PRODUCT_VIEWED: "bg-pink-100 text-pink-700 border-pink-200",
  PRODUCT_FAVORITED: "bg-yellow-100 text-yellow-700 border-yellow-200",
  SEARCH_PERFORMED: "bg-cyan-100 text-cyan-700 border-cyan-200",
};

// §11.70 — AI 자동화 처리 분류 (activityType prefix 또는 contains)
export function isAiActivity(activityType: string): boolean {
  return /^AI_|_AI_|RECOMMENDATION|RATIONALE/i.test(activityType);
}

// §11.70 — 경고/오류 활동 분류
export function isAlertActivity(activityType: string): boolean {
  return /ERROR|WARNING|FAILED|EXPIRED/i.test(activityType);
}
