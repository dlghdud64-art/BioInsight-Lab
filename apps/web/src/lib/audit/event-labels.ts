/**
 * §11.99 #audit-event-label-helper-extract
 *
 * AuditEventType → (Korean label, action tone) 매핑 helper.
 * 두 surface (`/dashboard/audit` page + `/dashboard/settings` recent
 * activity feed) 에서 일관 사용. 향후 enum 추가 시 본 파일만 업데이트.
 *
 * 5-tone 카테고리:
 *   - stock      = 부정 변경 (deletion/decrement) — rose
 *   - storage    = 조건 변경 (update/setting modify) — amber
 *   - alert      = 자동 알림 (export/import/auto-trigger) — blue
 *   - register   = 신규 entity 등록 — blue/emerald
 *   - permission = role/auth 변경 — emerald/purple
 */

export type AuditEventTone =
  | "stock"
  | "storage"
  | "alert"
  | "register"
  | "permission";

export interface AuditEventLabel {
  label: string;
  tone: AuditEventTone;
}

/**
 * AuditEventType (Prisma enum) → 한국어 라벨 + tone 매핑.
 * Prisma 의 `AuditEventType` enum 19 values 모두 매핑.
 * 미매핑 enum 은 caller 가 fallback 처리 (eventType raw 표시).
 */
export const AUDIT_EVENT_LABELS: Record<string, AuditEventLabel> = {
  USER_LOGIN: { label: "로그인", tone: "permission" },
  USER_LOGOUT: { label: "로그아웃", tone: "permission" },
  USER_CREATED: { label: "사용자 등록", tone: "register" },
  USER_UPDATED: { label: "사용자 수정", tone: "storage" },
  USER_DELETED: { label: "사용자 삭제", tone: "stock" },
  PERMISSION_CHANGED: { label: "권한 변경", tone: "permission" },
  SETTINGS_CHANGED: { label: "설정 변경", tone: "storage" },
  DATA_EXPORTED: { label: "데이터 내보내기", tone: "alert" },
  DATA_IMPORTED: { label: "데이터 가져오기", tone: "alert" },
  SSO_CONFIGURED: { label: "SSO 설정", tone: "permission" },
  ORGANIZATION_CREATED: { label: "조직 생성", tone: "register" },
  ORGANIZATION_UPDATED: { label: "조직 수정", tone: "storage" },
  ORGANIZATION_DELETED: { label: "조직 삭제", tone: "stock" },
  INGESTION_RECEIVED: { label: "외부 입력 수신", tone: "alert" },
  DOCUMENT_CLASSIFIED: { label: "문서 분류", tone: "register" },
  EXTRACTION_COMPLETED: { label: "AI 추출 완료", tone: "register" },
  ENTITY_LINKED: { label: "DB 연결", tone: "register" },
  VERIFICATION_COMPLETED: { label: "검증 완료", tone: "storage" },
  WORK_QUEUE_TASK_GENERATED: { label: "작업 생성", tone: "register" },
  // #approver-routing-event-type-enum-add — 결재 라우팅 dedicated events
  WORKSPACE_THRESHOLD_CHANGED: { label: "결재 임계치 변경", tone: "storage" },
  PURCHASE_REQUEST_CREATED: { label: "결재 요청 생성", tone: "register" },
};

/**
 * Filter dropdown 용 "전체 액션" 포함 options.
 */
export function buildEventTypeOptions(): Array<{ value: string; label: string }> {
  return [
    { value: "all", label: "전체 액션" },
    ...Object.entries(AUDIT_EVENT_LABELS).map(([value, { label }]) => ({
      value,
      label,
    })),
  ];
}

/**
 * AuditEventType → Tailwind class string (badge tone).
 * §11.81 audit page 의 ACTION_TONE 패턴.
 */
export const AUDIT_TONE_CLASSES: Record<AuditEventTone, string> = {
  stock: "bg-rose-50 text-rose-700 border-rose-200",
  storage: "bg-amber-50 text-amber-700 border-amber-200",
  alert: "bg-blue-50 text-blue-700 border-blue-200",
  register: "bg-blue-50 text-blue-700 border-blue-200",
  permission: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

/**
 * settings 페이지 mini feed 의 dot color (작은 indicator).
 */
export const AUDIT_TONE_DOT_CLASSES: Record<AuditEventTone, string> = {
  stock: "bg-rose-500",
  storage: "bg-amber-500",
  alert: "bg-blue-500",
  register: "bg-blue-500",
  permission: "bg-emerald-500",
};
