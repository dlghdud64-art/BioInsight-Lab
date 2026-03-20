/**
 * operator-console-contract.ts
 *
 * Procurement Inbox / Operator Console 중앙 계약.
 *
 * 핵심 원칙:
 *   - Operator Console의 첫 번째 임무는 **우선순위 정렬**이지 단순 표시가 아님.
 *   - Inbox는 알림 아카이브가 아니라 **행동 접수 계층**(action intake layer).
 *   - 운영자는 "지금 처리할 것", "차단된 것", "인수인계할 것"을 명확히 구분해야 함.
 *
 * @module operator-console-contract
 */

// ---------------------------------------------------------------------------
// 1. 콘솔 섹션 순서
// ---------------------------------------------------------------------------

/** Operator Console 페이지의 섹션 렌더링 순서 */
export const OPERATOR_CONSOLE_SECTIONS = [
  "header",
  "todayPrioritySummary",
  "intakeSegments",
  "assignedUnassignedBlocked",
  "primaryWorkQueue",
  "quickActionPreview",
  "exceptionSideQueue",
  "recentOutcome",
] as const;

/** 섹션 키 타입 */
export type OperatorConsoleSection = (typeof OPERATOR_CONSOLE_SECTIONS)[number];

// ---------------------------------------------------------------------------
// 2. 운영 항목 타입
// ---------------------------------------------------------------------------

/** Operator Console에서 다루는 모든 항목 유형 */
export type OperatorItemType =
  | "request"
  | "approval"
  | "budget_risk"
  | "document_issue"
  | "inventory_action"
  | "integration_exception"
  | "manual_review"
  | "escalation_followup";

// ---------------------------------------------------------------------------
// 3. 우선순위
// ---------------------------------------------------------------------------

/** 운영 우선순위 (p0 = 긴급, p3 = 참고) */
export type OperatorPriority = "p0" | "p1" | "p2" | "p3";

// ---------------------------------------------------------------------------
// 4. 소유권 상태
// ---------------------------------------------------------------------------

/** 항목의 소유/할당 상태 */
export type OperatorOwnershipState =
  | "assigned_to_me"
  | "assigned_to_team"
  | "unassigned"
  | "blocked";

// ---------------------------------------------------------------------------
// 5. OperatorInboxItem
// ---------------------------------------------------------------------------

/** Operator 작업함의 단일 항목 */
export interface OperatorInboxItem {
  /** 고유 식별자 */
  id: string;
  /** 항목 유형 */
  itemType: OperatorItemType;
  /** 항목 제목 */
  title: string;
  /** 항목 설명 */
  description: string;
  /** 현재 상태 (도메인별 상태값) */
  status: string;
  /** 우선순위 */
  priority: OperatorPriority;
  /** 소유권 상태 */
  ownershipState: OperatorOwnershipState;
  /** 현재 담당자 정보 */
  owner?: { userId: string; name: string; role: string };
  /** 생성 시각 (ISO 8601) */
  createdAt: string;
  /** 기한 (ISO 8601) */
  dueAt?: string;
  /** SLA 시간 (시간 단위) */
  slaHours?: number;
  /** 생성 이후 경과 시간 (시간 단위) */
  elapsedHours: number;
  /** SLA 초과 여부 */
  isOverdue: boolean;
  /** 차단 여부 */
  isBlocked: boolean;
  /** 차단 사유 (한국어) */
  blockedReason?: string;
  /** 원본 출처 컨텍스트 */
  sourceContext?: { type: string; entityId: string; label: string; href?: string };
  /** 연결된 참조 컨텍스트 목록 */
  linkedContexts?: { type: string; label: string; href: string }[];
  /** 영향도 라벨 (한국어) */
  impactLabel?: string;
  /** 소속 워크스페이스 ID */
  workspaceId: string;
}

// ---------------------------------------------------------------------------
// 6. IntakeSegment
// ---------------------------------------------------------------------------

/** Intake 세그먼트 정의 (좌측 필터 탭 또는 상단 세그먼트) */
export interface IntakeSegment {
  /** 세그먼트 고유 키 */
  key: string;
  /** 세그먼트 표시명 (한국어) */
  label: string;
  /** 해당 세그먼트 항목 수 */
  count: number;
  /** 세그먼트의 기본 우선순위 힌트 */
  priorityHint?: "critical" | "high" | "normal";
  /** 필터 적용 값 */
  filterValue: string;
}

// ---------------------------------------------------------------------------
// 7. 기본 Intake 세그먼트
// ---------------------------------------------------------------------------

/** 기본 Intake 세그먼트 목록 */
export const DEFAULT_INTAKE_SEGMENTS: IntakeSegment[] = [
  {
    key: "new_request",
    label: "신규 요청",
    count: 0,
    priorityHint: "critical",
    filterValue: "new_request",
  },
  {
    key: "approval_pending",
    label: "승인 대기",
    count: 0,
    priorityHint: "high",
    filterValue: "approval_pending",
  },
  {
    key: "budget_risk",
    label: "예산 위험",
    count: 0,
    priorityHint: "high",
    filterValue: "budget_risk",
  },
  {
    key: "document_issue",
    label: "문서 확인 필요",
    count: 0,
    priorityHint: "normal",
    filterValue: "document_issue",
  },
  {
    key: "integration_exception",
    label: "연동 예외",
    count: 0,
    priorityHint: "normal",
    filterValue: "integration_exception",
  },
  {
    key: "blocked_manual",
    label: "차단/수동 검토",
    count: 0,
    priorityHint: "critical",
    filterValue: "blocked_manual",
  },
  {
    key: "followup",
    label: "후속 확인",
    count: 0,
    priorityHint: "normal",
    filterValue: "followup",
  },
];

// ---------------------------------------------------------------------------
// 8. 우선순위 모델
// ---------------------------------------------------------------------------

/** 우선순위별 라벨, 설명, 시각 가중치, 트리거 조건 */
export const OPERATOR_PRIORITY_MODEL = {
  p0: {
    label: "긴급",
    description: "즉시 처리 필요",
    visualWeight: "강조" as const,
    triggers: [
      "SLA 48시간 초과 + 예산 risk",
      "critical blocked + owner 없음",
      "hard stop 예외",
    ],
  },
  p1: {
    label: "오늘 처리",
    description: "금일 내 처리 권장",
    visualWeight: "보통 강조" as const,
    triggers: [
      "SLA 24시간 초과",
      "문서 보강 시 진행 가능",
      "승인 대기 12시간 초과",
    ],
  },
  p2: {
    label: "일반",
    description: "순서대로 처리",
    visualWeight: "기본" as const,
    triggers: [
      "신규 요청 triage",
      "일반 follow-up",
      "정보 갱신",
    ],
  },
  p3: {
    label: "참고",
    description: "낮은 우선순위 또는 정보성",
    visualWeight: "약함" as const,
    triggers: [
      "digest 항목",
      "정보 확인",
      "완료 후 참고",
    ],
  },
} as const;

// ---------------------------------------------------------------------------
// 9. OperatorQuickAction
// ---------------------------------------------------------------------------

/** Operator Console에서 실행 가능한 빠른 동작 */
export interface OperatorQuickAction {
  /** 동작 고유 키 */
  actionKey: string;
  /** 동작 라벨 (한국어) */
  label: string;
  /** 적용 가능한 항목 유형 */
  applicableItemTypes: OperatorItemType[];
  /** 적용 가능한 상태 값 */
  applicableStates: string[];
  /** 파괴적 동작 여부 */
  isDestructive: boolean;
  /** 확인 대화 필요 여부 */
  requiresConfirmation: boolean;
}

/** 모든 OperatorItemType 목록 (all types shortcut) */
const ALL_ITEM_TYPES: OperatorItemType[] = [
  "request",
  "approval",
  "budget_risk",
  "document_issue",
  "inventory_action",
  "integration_exception",
  "manual_review",
  "escalation_followup",
];

// ---------------------------------------------------------------------------
// 10. 기본 빠른 동작 목록
// ---------------------------------------------------------------------------

/** 기본 제공되는 Quick Action 목록 */
export const DEFAULT_QUICK_ACTIONS: OperatorQuickAction[] = [
  {
    actionKey: "approve",
    label: "승인",
    applicableItemTypes: ["approval"],
    applicableStates: ["pending", "review_needed"],
    isDestructive: false,
    requiresConfirmation: true,
  },
  {
    actionKey: "reject",
    label: "반려",
    applicableItemTypes: ["approval"],
    applicableStates: ["pending", "review_needed"],
    isDestructive: true,
    requiresConfirmation: true,
  },
  {
    actionKey: "assign_owner",
    label: "담당자 지정",
    applicableItemTypes: ALL_ITEM_TYPES,
    applicableStates: ["unassigned", "pending", "open"],
    isDestructive: false,
    requiresConfirmation: false,
  },
  {
    actionKey: "budget_exception",
    label: "예산 예외 요청",
    applicableItemTypes: ["budget_risk"],
    applicableStates: ["warning", "limit_exceeded", "pending"],
    isDestructive: false,
    requiresConfirmation: true,
  },
  {
    actionKey: "request_document",
    label: "문서 요청",
    applicableItemTypes: ["document_issue"],
    applicableStates: ["incomplete", "pending", "review_needed"],
    isDestructive: false,
    requiresConfirmation: false,
  },
  {
    actionKey: "retry",
    label: "재시도",
    applicableItemTypes: ["integration_exception"],
    applicableStates: ["failed", "error", "timeout"],
    isDestructive: false,
    requiresConfirmation: true,
  },
  {
    actionKey: "send_to_queue",
    label: "큐로 보내기",
    applicableItemTypes: ["request", "manual_review"],
    applicableStates: ["triaged", "pending", "open"],
    isDestructive: false,
    requiresConfirmation: false,
  },
  {
    actionKey: "open_detail",
    label: "상세 보기",
    applicableItemTypes: ALL_ITEM_TYPES,
    applicableStates: ["*"],
    isDestructive: false,
    requiresConfirmation: false,
  },
  {
    actionKey: "snooze",
    label: "다시 보기 설정",
    applicableItemTypes: ALL_ITEM_TYPES,
    applicableStates: ["*"],
    isDestructive: false,
    requiresConfirmation: false,
  },
  {
    actionKey: "escalate",
    label: "에스컬레이션",
    applicableItemTypes: ALL_ITEM_TYPES,
    applicableStates: ["*"],
    isDestructive: false,
    requiresConfirmation: true,
  },
];

// ---------------------------------------------------------------------------
// 11. Triage 결정
// ---------------------------------------------------------------------------

/** Operator가 항목에 대해 내리는 Triage 결정 */
export interface TriageDecision {
  /** 대상 항목 ID */
  itemId: string;
  /** 배정 대상 사용자 ID */
  assignedTo?: string;
  /** 우선순위 수동 변경 */
  priorityOverride?: OperatorPriority;
  /** 세그먼트 수동 변경 */
  segmentOverride?: string;
  /** 예외 처리 여부 */
  isException: boolean;
  /** 추가 정보 요청 내용 (한국어) */
  additionalInfoRequest?: string;
  /** 라우팅 대상 큐 식별자 */
  routeTo?: string;
  /** Triage 메모 (한국어) */
  triageNote?: string;
  /** Triage 수행자 ID */
  triagedBy: string;
  /** Triage 수행 시각 (ISO 8601) */
  triagedAt: string;
}

// ---------------------------------------------------------------------------
// 12. 교대/인수인계 컨텍스트
// ---------------------------------------------------------------------------

/** 교대(Shift) 및 인수인계 컨텍스트 (선택적 운영 기능) */
export interface ShiftContext {
  /** 교대 고유 ID */
  shiftId: string;
  /** 운영자 ID */
  operatorId: string;
  /** 교대 시작 시각 (ISO 8601) */
  startedAt: string;
  /** 교대 종료 시각 (ISO 8601) */
  endedAt?: string;
  /** 인수인계 메모 */
  handoffNote?: string;
  /** 이월 항목 ID 목록 */
  carryOverItemIds: string[];
  /** 미해결 긴급 항목 수 */
  unresolvedCriticalCount: number;
}

// ---------------------------------------------------------------------------
// 13. 운영 메트릭
// ---------------------------------------------------------------------------

/** Operator Console 운영 성과 메트릭 */
export interface OperatorMetrics {
  /** 기간 라벨 (예: "오늘", "이번 주") */
  periodLabel: string;
  /** 접수→Triage 평균 시간 (시간) */
  intakeToTriageAvgHours: number;
  /** 미할당 항목 평균 체류 시간 (시간) */
  unassignedAgingAvgHours: number;
  /** 차단 해소 평균 시간 (시간) */
  blockedResolutionAvgHours: number;
  /** 수동 개입 비율 (0~1) */
  manualInterventionRate: number;
  /** 당일 해결률 (0~1) */
  sameDayResolutionRate: number;
  /** 에스컬레이션 해소 평균 시간 (시간) */
  escalationClearanceAvgHours: number;
  /** 처리 완료 항목 수 */
  totalProcessed: number;
  /** 신규 접수 항목 수 */
  totalIncoming: number;
}

// ---------------------------------------------------------------------------
// 14. 상태별 Copy
// ---------------------------------------------------------------------------

/** 항목이 없을 때의 안내 문구 */
export const OPERATOR_EMPTY_COPY = {
  title: "현재 바로 처리해야 할 운영 항목이 없습니다",
  subtitle: "긴급 항목부터 확인해보세요",
  actionLabel: "전체 작업 보기",
  actionHref: "/dashboard/operator?view=all",
} as const;

/** 에러 발생 시 안내 문구 */
export const OPERATOR_ERROR_COPY = {
  title: "운영 작업함을 불러오지 못했습니다",
  subtitle: "잠시 후 다시 시도해주세요",
  actionLabel: "다시 시도",
} as const;

/** 권한 없음 시 안내 문구 */
export const OPERATOR_UNAVAILABLE_COPY = {
  title: "현재 권한으로 운영 작업함에 접근할 수 없습니다",
  subtitle: "운영 관리자 권한이 필요합니다",
  actionLabel: "권한 요청하기",
  actionHref: "/dashboard/support",
} as const;

// ---------------------------------------------------------------------------
// 15. 페이지 복귀 시 보존 항목
// ---------------------------------------------------------------------------

/** 상세 페이지 → 목록 복귀 시 보존해야 할 상태 키 */
export const CROSS_PAGE_RETURN_PRESERVES = [
  "currentSegment",
  "activeFilters",
  "ownershipTab",
  "selectionState",
  "sourceItemPosition",
] as const;

// ---------------------------------------------------------------------------
// 16. 안티패턴 목록
// ---------------------------------------------------------------------------

/** Operator Console 구현 시 피해야 할 안티패턴 (한국어) */
export const OPERATOR_ANTI_PATTERNS: string[] = [
  "inbox가 최근 활동 feed처럼 보임",
  "operator가 어디부터 처리할지 알 수 없음",
  "assigned/unassigned/blocked 구분이 없음",
  "예외와 일반 요청이 같은 위계로 섞임",
  "quick action은 있지만 workflow return이 약함",
  "source context가 없어 why now를 모름",
  "console이 read-only monitoring 화면처럼 보임",
  "중앙 model 없이 각 도메인 queue를 억지로 붙임",
];

// ---------------------------------------------------------------------------
// 17. 코드 리뷰 체크리스트
// ---------------------------------------------------------------------------

/** Operator Console 코드 리뷰 시 확인 항목 (한국어) */
export const operatorCodeReviewChecklist: string[] = [
  "OperatorInboxItem 인터페이스를 직접 확장하지 않고 ViewModel을 통해 표시하는가",
  "우선순위 정렬이 OPERATOR_PRIORITY_MODEL 기준을 따르는가",
  "소유권 상태(assigned/unassigned/blocked)가 UI에서 명확히 구분되는가",
  "Quick Action 실행 후 목록 복귀 시 CROSS_PAGE_RETURN_PRESERVES가 유지되는가",
  "예외 항목이 일반 큐와 분리된 별도 사이드 큐에 표시되는가",
  "sourceContext가 없는 항목에 대해 fallback 라벨이 제공되는가",
  "Triage 결정 시 triageNote와 triagedBy가 항상 기록되는가",
  "ShiftContext 인수인계 시 미해결 긴급 항목이 누락되지 않는가",
  "OPERATOR_EMPTY_COPY/ERROR_COPY/UNAVAILABLE_COPY가 각 상태에 정확히 매핑되는가",
  "IntakeSegment count가 서버 응답과 동기화되며 stale 상태를 표시하는가",
];
