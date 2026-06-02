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
  | "permission"
  | "output"; // §11.337 — 조회·출력(PDF/CSV 등). 데이터 변경 아님 → 중립 톤.

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
  // #approver-routing-per-user-limit-audit-log
  MEMBER_APPROVAL_LIMIT_CHANGED: { label: "결재 한도 변경", tone: "storage" },
  // #audit-event-type-order (#post-approval-purchase-order-flow cleanup)
  ORDER_CREATED_FROM_POCANDIDATE: { label: "발주 자동 생성", tone: "register" },
  PO_PDF_GENERATED: { label: "발주서 PDF 생성", tone: "register" },
  VENDOR_EMAIL_SENT: { label: "공급사 이메일 발송", tone: "register" },
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
  storage: "bg-yellow-50 text-yellow-700 border-yellow-200",
  alert: "bg-blue-50 text-blue-700 border-blue-200",
  register: "bg-blue-50 text-blue-700 border-blue-200",
  permission: "bg-emerald-50 text-emerald-700 border-emerald-200",
  output: "bg-slate-50 text-slate-600 border-slate-200", // §11.337 조회·출력 중립
};

/**
 * §11.337 (호영님 P2) — action 키 기반 표시 매핑 레이어.
 *   목적: 비-CRUD 이벤트(PDF/CSV 출력·조회)가 저장 시 generic eventType
 *   (예: 옛 quote_pdf_generate = SETTINGS_CHANGED)으로 기록돼도, 화면에서는
 *   action 키로 정확히 "조회·출력"으로 분류 + 사람 읽는 사유 라벨로 치환.
 *
 *   ⚠️ 데이터 무결성(Part 11): 저장된 AuditLog raw record 는 불변.
 *   본 매핑은 표시(파생)에서만 사용 — backfill / 재작성 없음.
 */
export interface AuditActionMeta {
  /** 사람 읽는 사유 문구 (raw action key 노출 대체) */
  reason: string;
  /** 배지 카테고리 라벨 (eventType 기반 라벨을 override) */
  categoryLabel: string;
  tone: AuditEventTone;
}

export const AUDIT_ACTION_MAP: Record<string, AuditActionMeta> = {
  quote_pdf_generate: { reason: "견적서 PDF 생성", categoryLabel: "조회·출력", tone: "output" },
  po_pdf_generate: { reason: "발주서 PDF 생성", categoryLabel: "조회·출력", tone: "output" },
};

/**
 * settings 페이지 mini feed 의 dot color (작은 indicator).
 */
export const AUDIT_TONE_DOT_CLASSES: Record<AuditEventTone, string> = {
  stock: "bg-rose-500",
  storage: "bg-yellow-500",
  alert: "bg-blue-500",
  register: "bg-blue-500",
  permission: "bg-emerald-500",
  output: "bg-slate-400", // §11.337 조회·출력 중립
};
