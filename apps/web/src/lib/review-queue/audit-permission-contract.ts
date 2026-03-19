/**
 * audit-permission-contract.ts
 *
 * 감사(Audit) / 권한 변경(Permission Change) 페이지 중앙 계약.
 * 핵심 원칙: 감사는 단순 로그 저장이 아닌, 책임성과 운영 통제를 위한 것이다.
 * 권한 변경은 운영 리스크 이벤트로 취급한다.
 */

// ---------------------------------------------------------------------------
// 1. AuditPageStructure — 페이지 섹션 순서 (반드시 이 순서를 따른다)
// ---------------------------------------------------------------------------

/** 감사 페이지 필수 섹션 순서. UI 렌더링은 이 순서를 준수해야 한다. */
export const AuditPageStructure = {
  Header: 0,
  ScopeRiskSummary: 1,
  PriorityReview: 2,
  FilterSearch: 3,
  EventList: 4,
  EventDetail: 5,
  RelatedActions: 6,
  ExportRetention: 7,
} as const;

export type AuditPageSection = keyof typeof AuditPageStructure;

/** 섹션 순서를 배열로 제공 (렌더 루프용) */
export const AUDIT_PAGE_SECTION_ORDER: AuditPageSection[] = [
  "Header",
  "ScopeRiskSummary",
  "PriorityReview",
  "FilterSearch",
  "EventList",
  "EventDetail",
  "RelatedActions",
  "ExportRetention",
];

// ---------------------------------------------------------------------------
// 2. AuditEventCategory — 감사 이벤트 분류
// ---------------------------------------------------------------------------

/** 감사 이벤트가 속하는 운영 범주 */
export type AuditEventCategory =
  | "role_permission"
  | "member_status"
  | "approval_policy"
  | "budget_control"
  | "document_policy"
  | "integration_setting"
  | "security_policy"
  | "plan_retention"
  | "system_audit_setting";

// ---------------------------------------------------------------------------
// 3. AuditRiskLevel — 위험도 등급
// ---------------------------------------------------------------------------

/** 감사 이벤트 위험도. critical → low 순으로 운영 영향 감소 */
export type AuditRiskLevel = "critical" | "high" | "medium" | "low";

// ---------------------------------------------------------------------------
// 4. AuditReviewState — 감사 검토 상태
// ---------------------------------------------------------------------------

/** 감사 이벤트의 검토 진행 상태 */
export type AuditReviewState =
  | "unreviewed"
  | "acknowledged"
  | "needs_follow_up"
  | "resolved"
  | "escalated";

// ---------------------------------------------------------------------------
// 5. RISK_LEVEL_EXAMPLES — 위험도별 예시 이벤트 (한국어)
// ---------------------------------------------------------------------------

/** 각 위험도에 해당하는 대표 이벤트 예시 */
export const RISK_LEVEL_EXAMPLES: Record<AuditRiskLevel, string[]> = {
  critical: [
    "관리자 권한 신규 부여",
    "MFA 비활성화",
    "감사 보관 기간 축소",
  ],
  high: [
    "승인 단계 축소",
    "연동 권한 확대",
    "다수 멤버 역할 변경",
  ],
  medium: [
    "알림 정책 조정",
    "예산 threshold 변경",
  ],
  low: [
    "일반 설정 문구 변경",
    "표시 옵션 변경",
  ],
};

// ---------------------------------------------------------------------------
// 6. PRIORITY_REVIEW_TRIGGERS — 우선 검토 대상 이벤트 (한국어)
// ---------------------------------------------------------------------------

/** 이 목록에 해당하는 이벤트는 우선 검토(Priority Review) 큐에 노출된다. */
export const PRIORITY_REVIEW_TRIGGERS: string[] = [
  "관리자 권한 신규 부여",
  "승인 정책 단계 축소",
  "MFA/SSO 비활성화",
  "연동 권한 scope 확대",
  "감사 보관 기간 축소",
  "다수 멤버 역할 변경",
  "비정상 시간대 민감 변경",
  "최근 반복 변경/롤백",
];

// ---------------------------------------------------------------------------
// 7. UNUSUAL_ACTIVITY_PATTERNS — 비정상 활동 패턴 (한국어)
// ---------------------------------------------------------------------------

export interface UnusualActivityPattern {
  /** 패턴 식별 라벨 */
  pattern: string;
  /** 패턴 설명 */
  description: string;
  /** 해당 패턴 발견 시 권장 검토 행동 */
  reviewAction: string;
}

/** 비정상 활동 감지 패턴 목록 */
export const UNUSUAL_ACTIVITY_PATTERNS: UnusualActivityPattern[] = [
  {
    pattern: "심야/공휴일 민감 변경",
    description: "업무 시간 외(22:00~06:00) 또는 공휴일에 보안·권한 관련 변경이 발생",
    reviewAction: "변경 사유 확인 및 담당자 직접 검증 요청",
  },
  {
    pattern: "단기 대량 권한 변경",
    description: "30분 이내 동일 행위자가 5건 이상 권한 변경 수행",
    reviewAction: "변경 건별 타당성 검토 및 일괄 롤백 가능 여부 확인",
  },
  {
    pattern: "승인 우회 반복",
    description: "승인 단계 축소 후 즉시 고비용 요청이 승인된 패턴",
    reviewAction: "승인 정책 원복 및 해당 기간 승인 건 재검토",
  },
  {
    pattern: "비활성 계정 권한 부여",
    description: "30일 이상 로그인 이력이 없는 계정에 신규 권한 부여",
    reviewAction: "계정 활성 상태 확인 및 권한 부여 사유 검증",
  },
  {
    pattern: "보관/감사 설정 축소",
    description: "감사 로그 보관 기간 또는 범위가 축소됨",
    reviewAction: "규정 준수 여부 확인 및 축소 사유 문서화 요청",
  },
  {
    pattern: "연동(Integration) 권한 확대",
    description: "외부 연동 서비스의 접근 scope가 확대됨",
    reviewAction: "필요 최소 권한 원칙 준수 여부 검토",
  },
  {
    pattern: "롤백 후 재변경",
    description: "변경 → 롤백 → 동일 변경이 짧은 주기로 반복됨",
    reviewAction: "변경 의도 확인 및 에스컬레이션 여부 판단",
  },
  {
    pattern: "복수 워크스페이스 동시 변경",
    description: "단일 행위자가 짧은 시간 내 여러 워크스페이스의 설정을 동시 변경",
    reviewAction: "일괄 변경 승인 여부 및 영향 범위 확인",
  },
];

// ---------------------------------------------------------------------------
// 8. PermissionChangeDiff — 권한 변경 전/후 비교
// ---------------------------------------------------------------------------

/** 단일 필드에 대한 권한 변경 전후 비교 */
export interface PermissionChangeDiff {
  /** 변경된 필드 라벨 (UI 표시용) */
  fieldLabel: string;
  /** 변경 전 값 */
  beforeValue: string;
  /** 변경 후 값 */
  afterValue: string;
  /** 권한 상승(escalation)인지 여부 */
  isEscalation: boolean;
}

// ---------------------------------------------------------------------------
// 9. AuditActorType — 감사 행위자 유형
// ---------------------------------------------------------------------------

/** 감사 이벤트를 발생시킨 행위자의 유형 */
export type AuditActorType =
  | "user"
  | "admin"
  | "system"
  | "integration"
  | "api_token";

// ---------------------------------------------------------------------------
// 10. AuditScopeLevel — 감사 범위 수준
// ---------------------------------------------------------------------------

/** 감사 이벤트가 영향을 미치는 범위 수준 */
export type AuditScopeLevel =
  | "member"
  | "team"
  | "workspace"
  | "project"
  | "organization";

// ---------------------------------------------------------------------------
// 11. AuditFilterSpec — 감사 필터 명세
// ---------------------------------------------------------------------------

/** 감사 이벤트 목록 필터 조건 */
export interface AuditFilterSpec {
  /** 조회 기간 (ISO date range) */
  period: { from: string; to: string };
  /** 이벤트 범주 필터 */
  eventCategory?: AuditEventCategory[];
  /** 위험도 필터 */
  riskLevel?: AuditRiskLevel[];
  /** 검토 상태 필터 */
  reviewState?: AuditReviewState[];
  /** 행위자 ID 필터 */
  actorId?: string;
  /** 대상 ID 필터 */
  targetId?: string;
  /** 범위 수준 필터 */
  scopeLevel?: AuditScopeLevel;
  /** 소스(출처) 필터 — 예: "web", "api", "integration" */
  source?: string;
}

// ---------------------------------------------------------------------------
// 12. 상태별 안내 문구 (한국어)
// ---------------------------------------------------------------------------

/** 감사 이벤트가 비어 있을 때 안내 */
export const AUDIT_EMPTY_COPY = {
  title: "기록된 감사 이벤트가 없습니다",
  description:
    "조회 기간 내 권한 변경이나 정책 변경 이벤트가 발생하지 않았습니다. 필터 조건을 확인하거나 기간을 넓혀 보세요.",
  actionLabel: "필터 초기화",
  actionHref: "/dashboard/audit",
} as const;

/** 감사 데이터 로드 중 오류 발생 시 안내 */
export const AUDIT_ERROR_COPY = {
  title: "감사 데이터를 불러올 수 없습니다",
  description:
    "일시적인 서버 오류가 발생했습니다. 잠시 후 다시 시도하거나 관리자에게 문의하세요.",
  actionLabel: "다시 시도",
  actionHref: "/dashboard/audit",
} as const;

/** 감사 기능을 사용할 수 없을 때 안내 (플랜 제한 등) */
export const AUDIT_UNAVAILABLE_COPY = {
  title: "감사 기능을 사용할 수 없습니다",
  description:
    "현재 플랜에서는 감사 로그 기능이 제공되지 않습니다. 엔터프라이즈 플랜으로 업그레이드하면 모든 변경 이력을 추적할 수 있습니다.",
  actionLabel: "플랜 업그레이드",
  actionHref: "/dashboard/settings/plans",
} as const;

// ---------------------------------------------------------------------------
// 13. AUDIT_ANTI_PATTERNS — 감사 UI/운영 안티패턴 (한국어)
// ---------------------------------------------------------------------------

/** 감사 페이지 구현 시 반드시 피해야 할 안티패턴 */
export const AUDIT_ANTI_PATTERNS: string[] = [
  "감사 로그를 단순 텍스트 나열로 표시하여 위험도 구분이 불가능한 구조",
  "권한 변경의 전/후 값을 비교 없이 '변경됨'으로만 표시",
  "우선 검토 대상 이벤트를 일반 이벤트와 동일한 우선순위로 노출",
  "비정상 활동 패턴을 감지하지 않고 개별 이벤트만 나열",
  "감사 이벤트 검토 상태(reviewed/unreviewed) 추적 없이 목록만 제공",
  "행위자 유형(사용자/시스템/연동)을 구분하지 않아 책임 추적 불가",
  "감사 보관 기간·정책을 표시하지 않아 데이터 신뢰도 판단 불가",
  "내보내기(Export) 기능 없이 화면 조회만 가능하여 외부 감사 대응 불가",
];

// ---------------------------------------------------------------------------
// 14. auditCodeReviewChecklist — 코드 리뷰 체크리스트 (한국어)
// ---------------------------------------------------------------------------

/** 감사/권한 변경 관련 코드 리뷰 시 확인 항목 */
export const auditCodeReviewChecklist: string[] = [
  "모든 권한 변경 API에 감사 이벤트 기록이 포함되어 있는가?",
  "감사 이벤트에 행위자(actor), 대상(target), 범위(scope)가 모두 기록되는가?",
  "권한 변경 전/후 값(diff)이 명확히 저장되는가?",
  "위험도(riskLevel) 산정 로직이 범주·범위·상승 여부를 모두 고려하는가?",
  "우선 검토 대상 이벤트가 별도 큐로 분리되어 표시되는가?",
  "비정상 시간대(off-hours) 변경이 식별·표시되는가?",
  "감사 이벤트 내보내기 시 민감 정보(PII, 토큰 등)가 마스킹되는가?",
  "감사 보관 기간이 사용자에게 명시되고, 보관 정책 변경도 감사 대상인가?",
  "검토 상태(reviewState) 변경이 별도 감사 이벤트로 기록되는가?",
  "감사 페이지 접근 권한이 ADMIN/OWNER로 제한되어 있는가?",
];

// ---------------------------------------------------------------------------
// 15. REDACTION_TARGETS — 내보내기 시 마스킹 대상
// ---------------------------------------------------------------------------

/** 감사 로그 내보내기(Export) 시 마스킹 또는 제거해야 할 필드 유형 */
export const REDACTION_TARGETS: string[] = [
  "internal ID",
  "IP partial",
  "sensitive comments",
  "security secrets",
  "token/scope detail",
  "PII",
];
