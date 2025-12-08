// 제품 카테고리
export const PRODUCT_CATEGORIES: Record<string, string> = {
  REAGENT: "시약",
  TOOL: "기구",
  EQUIPMENT: "장비",
};

// 정렬 옵션
export const SORT_OPTIONS: Record<string, string> = {
  relevance: "관련도",
  price_low: "가격 낮은 순",
  price_high: "가격 높은 순",
  lead_time: "납기 빠른 순",
  review: "리뷰 많은 순",
};

// 견적 상태
export const QUOTE_STATUS = {
  PENDING: "대기 중",
  SENT: "발송 완료",
  RESPONDED: "응답 받음",
  COMPLETED: "완료",
  CANCELLED: "취소",
} as const;

// 사용자 역할