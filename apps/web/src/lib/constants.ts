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
export const USER_ROLES = {
  ADMIN: "ADMIN",
  USER: "USER",
} as const;

// 조직 역할
export const ORGANIZATION_ROLES = {
  OWNER: "OWNER",
  ADMIN: "ADMIN",
  MEMBER: "MEMBER",
} as const;

// 템플릿 타입
export const TEMPLATE_TYPES = {
  STANDARD: "standard",
  DETAILED: "detailed",
  SIMPLE: "simple",
} as const;

// 기본 템플릿 컬럼
export const DEFAULT_TEMPLATE_COLUMNS = [
  "productName",
  "vendorName",
  "catalogNumber",
  "specification",
  "grade",
  "unitPrice",
  "currency",
  "quantity",
  "lineTotal",
] as const;