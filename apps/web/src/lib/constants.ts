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
  RESEARCHER: "연구자",
  BUYER: "구매 담당자",
  SUPPLIER: "공급사",
  ADMIN: "관리자",
} as const;

// 조직 역할
export const ORGANIZATION_ROLES = {
  VIEWER: "조회자",
  REQUESTER: "요청자",
  APPROVER: "승인자",
  ADMIN: "관리자",
} as const;

// PDF 처리 모드
export type PDFMode = "server-upload" | "paste-only";

// 환경 변수에서 PDF 모드 가져오기 (기본값: paste-only)
export const PDF_MODE: PDFMode =
  (process.env.PDF_MODE as PDFMode) || "paste-only";

// PDF 업로드 모드 활성화 여부
export const PDF_UPLOAD_ENABLED = PDF_MODE === "server-upload";

// 템플릿 타입
export const TEMPLATE_TYPES = {
  RND: "R&D",
  QC: "QC",
  PRODUCTION: "PRODUCTION",
  CUSTOM: "CUSTOM",
} as const;

export type TemplateType = typeof TEMPLATE_TYPES[keyof typeof TEMPLATE_TYPES];

// 기본 템플릿 컬럼 정의
export const DEFAULT_TEMPLATE_COLUMNS = {
  RND: [
    { key: "lineNumber", label: "Line No.", required: true, order: 1 },
    { key: "productName", label: "제품명", required: true, order: 2 },
    { key: "vendor", label: "벤더", required: true, order: 3 },
    { key: "catalogNumber", label: "카탈로그 번호", required: false, order: 4 },
    { key: "specification", label: "규격/용량", required: false, order: 5 },
    { key: "grade", label: "Grade", required: false, order: 6 },
    { key: "unitPrice", label: "단가", required: true, order: 7 },
    { key: "currency", label: "통화", required: true, order: 8 },
    { key: "quantity", label: "수량", required: true, order: 9 },
    { key: "lineTotal", label: "금액", required: true, order: 10 },
    { key: "notes", label: "비고", required: false, order: 11 },
  ],
  QC: [
    { key: "lineNumber", label: "Line No.", required: true, order: 1 },
    { key: "productName", label: "제품명", required: true, order: 2 },
    { key: "vendor", label: "벤더", required: true, order: 3 },
    { key: "catalogNumber", label: "카탈로그 번호", required: true, order: 4 },
    { key: "specification", label: "규격/용량", required: true, order: 5 },
    { key: "grade", label: "Grade/규격", required: true, order: 6 },
    { key: "regulatoryCompliance", label: "규제/약전", required: false, order: 7 },
    { key: "unitPrice", label: "단가", required: true, order: 8 },
    { key: "currency", label: "통화", required: true, order: 9 },
    { key: "quantity", label: "수량", required: true, order: 10 },
    { key: "lineTotal", label: "금액", required: true, order: 11 },
    { key: "notes", label: "비고 (SOP 영향 여부)", required: false, order: 12 },
  ],
  PRODUCTION: [
    { key: "lineNumber", label: "Line No.", required: true, order: 1 },
    { key: "productName", label: "제품명", required: true, order: 2 },
    { key: "vendor", label: "벤더", required: true, order: 3 },
    { key: "catalogNumber", label: "카탈로그 번호", required: false, order: 4 },
    { key: "specification", label: "규격/용량", required: true, order: 5 },
    { key: "unitPrice", label: "단가", required: true, order: 6 },
    { key: "currency", label: "통화", required: true, order: 7 },
    { key: "quantity", label: "수량 (대량)", required: true, order: 8 },
    { key: "lineTotal", label: "금액", required: true, order: 9 },
    { key: "leadTime", label: "납기", required: true, order: 10 },
    { key: "notes", label: "비고 (공급 리스크 등)", required: false, order: 11 },
  ],
} as const;

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
  RESEARCHER: "연구자",
  BUYER: "구매 담당자",
  SUPPLIER: "공급사",
  ADMIN: "관리자",
} as const;

// 조직 역할
export const ORGANIZATION_ROLES = {
  VIEWER: "조회자",
  REQUESTER: "요청자",
  APPROVER: "승인자",
  ADMIN: "관리자",
} as const;

// PDF 처리 모드
export type PDFMode = "server-upload" | "paste-only";

// 환경 변수에서 PDF 모드 가져오기 (기본값: paste-only)
export const PDF_MODE: PDFMode =
  (process.env.PDF_MODE as PDFMode) || "paste-only";

// PDF 업로드 모드 활성화 여부
export const PDF_UPLOAD_ENABLED = PDF_MODE === "server-upload";

// 템플릿 타입
export const TEMPLATE_TYPES = {
  RND: "R&D",
  QC: "QC",
  PRODUCTION: "PRODUCTION",
  CUSTOM: "CUSTOM",
} as const;

export type TemplateType = typeof TEMPLATE_TYPES[keyof typeof TEMPLATE_TYPES];

// 기본 템플릿 컬럼 정의
export const DEFAULT_TEMPLATE_COLUMNS = {
  RND: [
    { key: "lineNumber", label: "Line No.", required: true, order: 1 },
    { key: "productName", label: "제품명", required: true, order: 2 },
    { key: "vendor", label: "벤더", required: true, order: 3 },
    { key: "catalogNumber", label: "카탈로그 번호", required: false, order: 4 },
    { key: "specification", label: "규격/용량", required: false, order: 5 },
    { key: "grade", label: "Grade", required: false, order: 6 },
    { key: "unitPrice", label: "단가", required: true, order: 7 },
    { key: "currency", label: "통화", required: true, order: 8 },
    { key: "quantity", label: "수량", required: true, order: 9 },
    { key: "lineTotal", label: "금액", required: true, order: 10 },
    { key: "notes", label: "비고", required: false, order: 11 },
  ],
  QC: [
    { key: "lineNumber", label: "Line No.", required: true, order: 1 },
    { key: "productName", label: "제품명", required: true, order: 2 },
    { key: "vendor", label: "벤더", required: true, order: 3 },
    { key: "catalogNumber", label: "카탈로그 번호", required: true, order: 4 },
    { key: "specification", label: "규격/용량", required: true, order: 5 },
    { key: "grade", label: "Grade/규격", required: true, order: 6 },
    { key: "regulatoryCompliance", label: "규제/약전", required: false, order: 7 },
    { key: "unitPrice", label: "단가", required: true, order: 8 },
    { key: "currency", label: "통화", required: true, order: 9 },
    { key: "quantity", label: "수량", required: true, order: 10 },
    { key: "lineTotal", label: "금액", required: true, order: 11 },
    { key: "notes", label: "비고 (SOP 영향 여부)", required: false, order: 12 },
  ],
  PRODUCTION: [
    { key: "lineNumber", label: "Line No.", required: true, order: 1 },
    { key: "productName", label: "제품명", required: true, order: 2 },
    { key: "vendor", label: "벤더", required: true, order: 3 },
    { key: "catalogNumber", label: "카탈로그 번호", required: false, order: 4 },
    { key: "specification", label: "규격/용량", required: true, order: 5 },
    { key: "unitPrice", label: "단가", required: true, order: 6 },
    { key: "currency", label: "통화", required: true, order: 7 },
    { key: "quantity", label: "수량 (대량)", required: true, order: 8 },
    { key: "lineTotal", label: "금액", required: true, order: 9 },
    { key: "leadTime", label: "납기", required: true, order: 10 },
    { key: "notes", label: "비고 (공급 리스크 등)", required: false, order: 11 },
  ],
} as const;

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
  RESEARCHER: "연구자",
  BUYER: "구매 담당자",
  SUPPLIER: "공급사",
  ADMIN: "관리자",
} as const;

// 조직 역할
export const ORGANIZATION_ROLES = {
  VIEWER: "조회자",
  REQUESTER: "요청자",
  APPROVER: "승인자",
  ADMIN: "관리자",
} as const;

// PDF 처리 모드
export type PDFMode = "server-upload" | "paste-only";

// 환경 변수에서 PDF 모드 가져오기 (기본값: paste-only)
export const PDF_MODE: PDFMode =
  (process.env.PDF_MODE as PDFMode) || "paste-only";

// PDF 업로드 모드 활성화 여부
export const PDF_UPLOAD_ENABLED = PDF_MODE === "server-upload";

// 템플릿 타입
export const TEMPLATE_TYPES = {
  RND: "R&D",
  QC: "QC",
  PRODUCTION: "PRODUCTION",
  CUSTOM: "CUSTOM",
} as const;

export type TemplateType = typeof TEMPLATE_TYPES[keyof typeof TEMPLATE_TYPES];

// 기본 템플릿 컬럼 정의
export const DEFAULT_TEMPLATE_COLUMNS = {
  RND: [
    { key: "lineNumber", label: "Line No.", required: true, order: 1 },
    { key: "productName", label: "제품명", required: true, order: 2 },
    { key: "vendor", label: "벤더", required: true, order: 3 },
    { key: "catalogNumber", label: "카탈로그 번호", required: false, order: 4 },
    { key: "specification", label: "규격/용량", required: false, order: 5 },
    { key: "grade", label: "Grade", required: false, order: 6 },
    { key: "unitPrice", label: "단가", required: true, order: 7 },
    { key: "currency", label: "통화", required: true, order: 8 },
    { key: "quantity", label: "수량", required: true, order: 9 },
    { key: "lineTotal", label: "금액", required: true, order: 10 },
    { key: "notes", label: "비고", required: false, order: 11 },
  ],
  QC: [
    { key: "lineNumber", label: "Line No.", required: true, order: 1 },
    { key: "productName", label: "제품명", required: true, order: 2 },
    { key: "vendor", label: "벤더", required: true, order: 3 },
    { key: "catalogNumber", label: "카탈로그 번호", required: true, order: 4 },
    { key: "specification", label: "규격/용량", required: true, order: 5 },
    { key: "grade", label: "Grade/규격", required: true, order: 6 },
    { key: "regulatoryCompliance", label: "규제/약전", required: false, order: 7 },
    { key: "unitPrice", label: "단가", required: true, order: 8 },
    { key: "currency", label: "통화", required: true, order: 9 },
    { key: "quantity", label: "수량", required: true, order: 10 },
    { key: "lineTotal", label: "금액", required: true, order: 11 },
    { key: "notes", label: "비고 (SOP 영향 여부)", required: false, order: 12 },
  ],
  PRODUCTION: [
    { key: "lineNumber", label: "Line No.", required: true, order: 1 },
    { key: "productName", label: "제품명", required: true, order: 2 },
    { key: "vendor", label: "벤더", required: true, order: 3 },
    { key: "catalogNumber", label: "카탈로그 번호", required: false, order: 4 },
    { key: "specification", label: "규격/용량", required: true, order: 5 },
    { key: "unitPrice", label: "단가", required: true, order: 6 },
    { key: "currency", label: "통화", required: true, order: 7 },
    { key: "quantity", label: "수량 (대량)", required: true, order: 8 },
    { key: "lineTotal", label: "금액", required: true, order: 9 },
    { key: "leadTime", label: "납기", required: true, order: 10 },
    { key: "notes", label: "비고 (공급 리스크 등)", required: false, order: 11 },
  ],
} as const;
