/**
 * UI Constants for Design Consistency
 * 
 * 전체 프로젝트에서 일관된 스타일을 사용하기 위한 상수 정의
 */

// Spacing (Padding & Gap)
export const SPACING = {
  CARD_PADDING: "p-4",
  TABLE_CELL_PADDING: "p-3",
  SECTION_GAP: "gap-4",
  CONTENT_PADDING: "px-4 py-6",
  HEADER_PADDING: "px-6 py-4",
} as const;

// Container Styles
export const CONTAINER = {
  CARD: "bg-white border border-slate-200 shadow-sm",
  TABLE: "bg-white border border-slate-200 shadow-sm",
  SIDEBAR: "w-64 bg-white border-r border-slate-200 min-h-screen",
} as const;

// Empty State Messages
export const EMPTY_STATES = {
  NO_RESULTS: "검색 결과가 없습니다.",
  NO_ITEMS: "항목이 없습니다.",
  NO_REQUESTS: "요청이 없습니다.",
  NO_TEMPLATES: "저장된 템플릿이 없습니다.",
  NO_ACTIVITY: "최근 활동이 없습니다.",
  NO_ATTACHMENTS: "첨부 파일이 없습니다.",
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  GENERIC: "오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
  NETWORK: "네트워크 오류가 발생했습니다.",
  AUTH: "인증에 실패했습니다. 다시 로그인해주세요.",
  VALIDATION: "입력값을 확인해주세요.",
  NOT_FOUND: "요청하신 정보를 찾을 수 없습니다.",
} as const;

// Success Messages
export const SUCCESS_MESSAGES = {
  SAVED: "저장되었습니다.",
  UPDATED: "수정되었습니다.",
  DELETED: "삭제되었습니다.",
  SENT: "전송되었습니다.",
  COPIED: "복사되었습니다.",
} as const;

