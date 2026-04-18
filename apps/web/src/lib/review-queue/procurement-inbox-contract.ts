/**
 * Procurement Inbox / Operator Console 중앙 계약
 *
 * 핵심 원칙: 콘솔의 첫 번째 역할은 표시(display)가 아니라 우선순위 정렬(priority sorting)이다.
 * Inbox는 알림 보관함이 아니라 행동 접수 계층(action intake layer)이다.
 * 운영자는 지금 처리할 것, 차단된 것, 인계할 것을 명확히 구분할 수 있어야 한다.
 * 검색/견적/승인/예산/문서/연동 예외는 단일 운영 흐름으로 통합한다.
 */

// ---------------------------------------------------------------------------
// 1. 페이지 섹션 순서
// ---------------------------------------------------------------------------

/** 운영 콘솔 페이지의 필수 섹션 순서 */
export const OPERATOR_CONSOLE_SECTIONS = [
  "pageHeader",
  "todayPrioritySummary",
  "intakeSegments",
  "assignedUnassignedBlocked",
  "primaryWorkQueue",
  "quickActionPanel",
  "exceptionSideQueue",
  "recentOutcome",
] as const;

export type OperatorConsoleSection =
  (typeof OPERATOR_CONSOLE_SECTIONS)[number];

// ---------------------------------------------------------------------------
// 2. Inbox 항목 소스
// ---------------------------------------------------------------------------

/** Inbox 항목이 발생한 운영 소스 */
export type InboxItemSource =
  | "quote_request"
  | "approval_request"
  | "budget_risk"
  | "document_missing"
  | "integration_failure"
  | "inventory_alert"
  | "manual_review"
  | "escalation"
  | "vendor_followup"
  | "catalog_quality";

// ---------------------------------------------------------------------------
// 3. Inbox 우선순위
// ---------------------------------------------------------------------------

/** Inbox 항목 우선순위 — 정렬·톤·노출 위치를 결정 */
export type InboxPriority = "urgent" | "today" | "normal" | "reference";

// ---------------------------------------------------------------------------
// 4. Inbox 항목 상태
// ---------------------------------------------------------------------------

/** Inbox 항목 처리 상태 */
export type InboxItemStatus =
  | "new"
  | "assigned"
  | "in_progress"
  | "blocked"
  | "waiting_response"
  | "escalated"
  | "resolved"
  | "dismissed";

// ---------------------------------------------------------------------------
// 5. 우선순위 정렬 순서
// ---------------------------------------------------------------------------

/** 우선순위별 정렬 가중치 — 낮을수록 먼저 표시 */
export const PRIORITY_SORT_ORDER: Record<InboxPriority, number> = {
  urgent: 0,
  today: 1,
  normal: 2,
  reference: 3,
} as const;

// ---------------------------------------------------------------------------
// 6. 우선순위 판정 규칙
// ---------------------------------------------------------------------------

/** 항목 우선순위 판정 규칙 — 조건에 매칭되면 해당 우선순위 부여 */
export const PRIORITY_RULES: readonly {
  condition: string;
  priority: InboxPriority;
  description: string;
}[] = [
  {
    condition: "sla_overdue_or_imminent",
    priority: "urgent",
    description: "SLA 초과 또는 초과 임박(1시간 이내)",
  },
  {
    condition: "critical_high_severity",
    priority: "urgent",
    description: "critical/high severity 예외",
  },
  {
    condition: "unassigned_over_2h",
    priority: "urgent",
    description: "owner 미배정 + 경과 2시간 이상",
  },
  {
    condition: "today_due_approval",
    priority: "today",
    description: "오늘 마감 승인 요청",
  },
  {
    condition: "budget_soft_limit_exceeded",
    priority: "today",
    description: "예산 soft limit 초과 요청",
  },
  {
    condition: "blocked_missing_document",
    priority: "today",
    description: "필수 문서 누락으로 차단된 항목",
  },
  {
    condition: "new_quote_within_24h",
    priority: "today",
    description: "신규 견적 요청(24시간 이내)",
  },
  {
    condition: "general_approval",
    priority: "normal",
    description: "일반 승인 요청",
  },
  {
    condition: "inventory_reorder",
    priority: "normal",
    description: "재고 재발주 알림",
  },
  {
    condition: "vendor_waiting",
    priority: "normal",
    description: "벤더 응답 대기",
  },
  {
    condition: "catalog_quality_issue",
    priority: "reference",
    description: "카탈로그 품질 이슈",
  },
  {
    condition: "completed_review",
    priority: "reference",
    description: "완료된 항목 확인",
  },
] as const;

// ---------------------------------------------------------------------------
// 7. Inbox 항목 인터페이스
// ---------------------------------------------------------------------------

/** Quick Action 유형 */
export type QuickActionType =
  | "approve"
  | "reject"
  | "reassign"
  | "request_document"
  | "request_budget_exception"
  | "manual_reprocess"
  | "send_to_quote_queue"
  | "open_detail"
  | "escalate"
  | "dismiss"
  | "snooze";

/** Inbox 개별 항목 — 운영 콘솔의 최소 처리 단위 */
export interface InboxItem {
  /** 고유 식별자 */
  id: string;
  /** 항목 발생 소스 */
  source: InboxItemSource;
  /** 우선순위 */
  priority: InboxPriority;
  /** 현재 처리 상태 */
  status: InboxItemStatus;
  /** 항목 제목 (한국어) */
  title: string;
  /** 항목 요약 (한국어) */
  summary: string;
  /** 원본 엔티티 유형 (e.g. "QuoteRequest", "ApprovalRequest") */
  sourceEntityType: string;
  /** 원본 엔티티 ID */
  sourceEntityId: string;
  /** 원본 엔티티 표시 라벨 */
  sourceEntityLabel: string;
  /** 담당자 ID */
  ownerId?: string;
  /** 담당자 이름 */
  ownerName?: string;
  /** 배정 시각 (ISO 8601) */
  assignedAt?: string;
  /** 생성 시각 (ISO 8601) */
  createdAt: string;
  /** 마감 시각 (ISO 8601) */
  dueAt?: string;
  /** SLA 기한 (ISO 8601) */
  slaDeadline?: string;
  /** 생성 이후 경과 시간(분) */
  elapsedMinutes: number;
  /** 차단 여부 */
  isBlocked: boolean;
  /** 차단 사유 (한국어) */
  blockedReason?: string;
  /** 에스컬레이션 여부 */
  isEscalated: boolean;
  /** 에스컬레이션 레벨 (0 = 없음) */
  escalationLevel: number;
  /** 현재 항목에서 사용 가능한 빠른 액션 목록 */
  availableQuickActions: QuickActionType[];
  /** 연관 항목 ID 목록 */
  relatedItemIds: string[];
  /** 태그 목록 */
  tags: string[];
}

// ---------------------------------------------------------------------------
// 8. QuickActionType (위 7절에서 정의)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 9. Quick Action 설명
// ---------------------------------------------------------------------------

/** Quick Action별 UI 표시 정보 */
export const QUICK_ACTION_DESCRIPTIONS: Record<
  QuickActionType,
  {
    /** 액션 라벨 (한국어) */
    label: string;
    /** 액션 설명 (한국어) */
    description: string;
    /** 아이콘 식별자 */
    icon?: string;
    /** 톤 — 버튼 스타일 결정 */
    tone: "primary" | "danger" | "secondary" | "warning";
    /** 확인 다이얼로그 필요 여부 */
    requiresConfirm: boolean;
  }
> = {
  approve: {
    label: "승인",
    description: "요청을 승인합니다",
    icon: "check-circle",
    tone: "primary",
    requiresConfirm: true,
  },
  reject: {
    label: "반려",
    description: "요청을 반려합니다",
    icon: "x-circle",
    tone: "danger",
    requiresConfirm: true,
  },
  reassign: {
    label: "재할당",
    description: "다른 담당자에게 이관합니다",
    icon: "user-switch",
    tone: "secondary",
    requiresConfirm: false,
  },
  request_document: {
    label: "문서 요청",
    description: "필수 문서 제출을 요청합니다",
    icon: "file-text",
    tone: "secondary",
    requiresConfirm: false,
  },
  request_budget_exception: {
    label: "예산 예외 요청",
    description: "예산 초과 예외 승인을 요청합니다",
    icon: "alert-triangle",
    tone: "warning",
    requiresConfirm: true,
  },
  manual_reprocess: {
    label: "수동 재처리",
    description: "항목을 수동으로 재처리합니다",
    icon: "refresh-cw",
    tone: "secondary",
    requiresConfirm: true,
  },
  send_to_quote_queue: {
    label: "견적 큐로 이동",
    description: "견적 비교 큐로 보냅니다",
    icon: "send",
    tone: "primary",
    requiresConfirm: false,
  },
  open_detail: {
    label: "상세 보기",
    description: "항목 상세 페이지로 이동합니다",
    icon: "external-link",
    tone: "secondary",
    requiresConfirm: false,
  },
  escalate: {
    label: "에스컬레이션",
    description: "상위 담당자에게 에스컬레이션합니다",
    icon: "arrow-up-circle",
    tone: "warning",
    requiresConfirm: true,
  },
  dismiss: {
    label: "무시",
    description: "이 항목을 inbox에서 제거합니다",
    icon: "eye-off",
    tone: "secondary",
    requiresConfirm: true,
  },
  snooze: {
    label: "다시 알림",
    description: "지정 시간 후 다시 노출합니다",
    icon: "clock",
    tone: "secondary",
    requiresConfirm: false,
  },
} as const;

// ---------------------------------------------------------------------------
// 10. Intake Segment
// ---------------------------------------------------------------------------

/** 소스별 접수 세그먼트 — intake 영역의 요약 카드 */
export interface IntakeSegment {
  /** 세그먼트 ID */
  id: string;
  /** 세그먼트 라벨 (한국어) */
  label: string;
  /** 소스 유형 */
  source: InboxItemSource;
  /** 총 항목 수 */
  count: number;
  /** 긴급 항목 수 */
  urgentCount: number;
  /** 차단된 항목 수 */
  blockedCount: number;
  /** 미배정 항목 수 */
  unassignedCount: number;
  /** 톤 — 세그먼트 카드 색상 결정 */
  tone: "neutral" | "warning" | "danger";
}

// ---------------------------------------------------------------------------
// 11. Today Priority Summary
// ---------------------------------------------------------------------------

/** 오늘의 우선순위 요약 — 콘솔 상단 KPI 영역 */
export interface TodayPrioritySummary {
  /** 긴급 항목 수 */
  urgentCount: number;
  /** 오늘 처리 대상 항목 수 */
  todayCount: number;
  /** 차단된 항목 수 */
  blockedCount: number;
  /** 미배정 항목 수 */
  unassignedCount: number;
  /** 에스컬레이션된 항목 수 */
  escalatedCount: number;
  /** SLA 초과 항목 수 */
  slaOverdueCount: number;
  /** 오늘 처리 완료 항목 수 */
  resolvedTodayCount: number;
  /** 최우선 처리 항목 (상위 3건) */
  topPriorityItems: InboxItem[];
  /** 전체 건강 상태 톤 */
  healthTone: "healthy" | "warning" | "danger";
  /** 건강 상태 라벨 (한국어) */
  healthLabel: string;
}

// ---------------------------------------------------------------------------
// 12. Operator Work Queue Filter
// ---------------------------------------------------------------------------

/** 운영 큐 필터 — 작업 큐 조회 조건 */
export interface OperatorWorkQueueFilter {
  /** 우선순위 필터 */
  priority?: InboxPriority;
  /** 소스 필터 */
  source?: InboxItemSource;
  /** 상태 필터 */
  status?: InboxItemStatus;
  /** 담당자 필터: "me" | "unassigned" | "all" | 특정 사용자 ID */
  assignedTo?: "me" | "unassigned" | "all" | string;
  /** 차단 여부 필터 */
  isBlocked?: boolean;
  /** 에스컬레이션 여부 필터 */
  isEscalated?: boolean;
  /** 날짜 범위 필터 (ISO 8601) */
  dateRange?: { from: string; to: string };
  /** 정렬 기준 */
  sortBy: "priority" | "created" | "due" | "elapsed" | "source";
  /** 정렬 방향 */
  sortOrder: "asc" | "desc";
}

// ---------------------------------------------------------------------------
// 13. Pipeline Bottleneck
// ---------------------------------------------------------------------------

/** 파이프라인 병목 — 단계별 차단/지연 현황 */
export interface PipelineBottleneck {
  /** 파이프라인 단계 */
  stage:
    | "search"
    | "compare"
    | "quote"
    | "approval"
    | "order"
    | "receiving"
    | "inventory";
  /** 단계 라벨 (한국어) */
  stageLabel: string;
  /** 차단 항목 수 */
  blockedCount: number;
  /** 지연 항목 수 */
  delayedCount: number;
  /** 평균 지연 시간(분) */
  avgDelayMinutes: number;
  /** 최대 병목 원인 (한국어) */
  topBlockerLabel: string;
  /** 상세 드릴다운 링크 */
  drillDownHref: string;
}

// ---------------------------------------------------------------------------
// 14. Pipeline Stages
// ---------------------------------------------------------------------------

/** 조달 파이프라인 단계 정의 — 순서대로 */
export const PIPELINE_STAGES = [
  { stage: "search", label: "검색/탐색", order: 1 },
  { stage: "compare", label: "비교/분석", order: 2 },
  { stage: "quote", label: "견적/제출", order: 3 },
  { stage: "approval", label: "승인", order: 4 },
  { stage: "order", label: "발주", order: 5 },
  { stage: "receiving", label: "입고", order: 6 },
  { stage: "inventory", label: "재고 관리", order: 7 },
] as const;

// ---------------------------------------------------------------------------
// 15. Outcome Entry
// ---------------------------------------------------------------------------

/** 최근 처리 결과 — 운영 콘솔 하단 피드 */
export interface OutcomeEntry {
  /** 고유 식별자 */
  id: string;
  /** 수행된 액션 유형 */
  actionType: QuickActionType | string;
  /** 액션 라벨 (한국어) */
  actionLabel: string;
  /** 대상 항목 라벨 */
  targetLabel: string;
  /** 수행자 */
  actor: string;
  /** 완료 시각 (ISO 8601) */
  completedAt: string;
  /** 결과 라벨 (한국어) */
  resultLabel: string;
  /** 실행 취소 가능 여부 */
  undoAvailable: boolean;
}

// ---------------------------------------------------------------------------
// 16. Inbox Source Descriptions
// ---------------------------------------------------------------------------

/** Inbox 소스별 UI 표시 정보 및 기본 우선순위 */
export const INBOX_SOURCE_DESCRIPTIONS: Record<
  InboxItemSource,
  {
    /** 소스 라벨 (한국어) */
    label: string;
    /** 소스 설명 (한국어) */
    description: string;
    /** 기본 우선순위 */
    defaultPriority: InboxPriority;
  }
> = {
  quote_request: {
    label: "견적 요청",
    description: "새로운 견적 요청이 접수되었습니다",
    defaultPriority: "today",
  },
  approval_request: {
    label: "승인 요청",
    description: "승인 대기 중인 요청입니다",
    defaultPriority: "today",
  },
  budget_risk: {
    label: "예산 위험",
    description: "예산 임계치를 초과하거나 초과 위험이 있는 요청입니다",
    defaultPriority: "urgent",
  },
  document_missing: {
    label: "문서 누락",
    description: "필수 문서가 누락되어 진행이 차단됩니다",
    defaultPriority: "today",
  },
  integration_failure: {
    label: "연동 실패",
    description: "외부 시스템 연동에 실패한 항목입니다",
    defaultPriority: "urgent",
  },
  inventory_alert: {
    label: "재고 알림",
    description: "재고 부족 또는 재발주가 필요한 항목입니다",
    defaultPriority: "normal",
  },
  manual_review: {
    label: "수동 검토",
    description: "자동 처리가 불가능하여 수동 검토가 필요합니다",
    defaultPriority: "today",
  },
  escalation: {
    label: "에스컬레이션",
    description: "하위 단계에서 에스컬레이션된 항목입니다",
    defaultPriority: "urgent",
  },
  vendor_followup: {
    label: "벤더 팔로업",
    description: "벤더 응답 대기 또는 재연락이 필요합니다",
    defaultPriority: "normal",
  },
  catalog_quality: {
    label: "카탈로그 품질",
    description: "마스터 데이터 품질 이슈가 감지되었습니다",
    defaultPriority: "reference",
  },
} as const;

// ---------------------------------------------------------------------------
// 17. 상태별 문구 (Empty / Error / Unavailable)
// ---------------------------------------------------------------------------

/** Inbox 비어있을 때 문구 */
export const INBOX_EMPTY_COPY = {
  title: "처리할 항목이 없습니다",
  description:
    "모든 요청이 정상적으로 처리되고 있습니다. 새 항목이 들어오면 여기에 표시됩니다.",
  actionLabel: null,
} as const;

/** Inbox 오류 발생 시 문구 */
export const INBOX_ERROR_COPY = {
  title: "운영 콘솔 정보를 불러오지 못했습니다",
  description: "잠시 후 다시 시도해주세요",
  actionLabel: "다시 시도",
} as const;

/** Inbox 접근 불가 시 문구 */
export const INBOX_UNAVAILABLE_COPY = {
  title: "현재 권한으로 운영 콘솔에 접근할 수 없습니다",
  description: "운영자 이상의 권한이 필요합니다",
  actionLabel: "권한 요청하기",
} as const;

// ---------------------------------------------------------------------------
// 18. 안티패턴 목록
// ---------------------------------------------------------------------------

/** 운영 콘솔 구현 시 피해야 할 안티패턴 (한국어) */
export const INBOX_ANTI_PATTERNS: readonly string[] = [
  "inbox가 최근 활동 목록처럼 보여 처리 순서가 안 보임",
  "operator가 어디부터 봐야 하는지 불명확",
  "예외/승인/문서/예산/연동이 각 화면에 흩어져 있음",
  "같은 항목을 여러 화면에서 반복 확인해야 함",
  "owner 없는 항목이 누적돼도 상단에 안 드러남",
  "high-priority와 low-value feed가 같은 위계",
  "action 후 후속 흐름 복귀가 약함",
  "console이 read-only 현황판처럼 보임",
] as const;

// ---------------------------------------------------------------------------
// 19. 코드 리뷰 체크리스트
// ---------------------------------------------------------------------------

/** 운영 콘솔 코드 리뷰 시 확인 사항 (한국어) */
export const inboxCodeReviewChecklist: readonly string[] = [
  "urgent/today/normal/reference 우선순위가 정렬에 반영되는가",
  "SLA 초과/blocked/unassigned가 상단에 노출되는가",
  "intake segment별 count와 위험 수준이 보이는가",
  "quick action이 항목 유형에 맞게 필터링되는가",
  "파이프라인 병목이 시각화되는가",
  "예외 흡수와 manual intervention 진입점이 있는가",
  "owner assignment와 SLA tracking이 작동하는가",
  "action 후 workflow return이 명확한가",
  "최근 처리 결과(outcome)가 추적 가능한가",
  "모바일에서도 priority summary + urgent items가 먼저 보이는가",
] as const;
