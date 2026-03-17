/**
 * Console V1 Productization — 용어 동결 & UX 일관성 & 엣지 상태 & 파일럿 준비
 *
 * 모든 운영 콘솔 화면에서 사용하는 정규 용어, 공유 UX 상수,
 * 엣지 상태 헬퍼, 파일럿 워크스루 시나리오를 정의합니다.
 *
 * §1 정규 용어 동결 — 모든 화면에서 동일한 한국어 용어 사용
 * §2 교차 화면 UX 일관성 — 배지, CTA, 타임스탬프 규칙
 * §3 엣지 상태 폴리시 — 빈 큐, 누락 데이터, 실패 상태
 * §4 콘솔 네비게이션 — 모드 전환, 딥링크, 복귀 경로
 * §5 파일럿 준비 — 시나리오, 워크스루, 체크리스트
 *
 * 순수 정의 파일 — DB 호출 없음.
 */

// ══════════════════════════════════════════════════════
// §1: Canonical Terminology Freeze
// ══════════════════════════════════════════════════════

/**
 * 정규 용어집 — 모든 화면에서 이 용어만 사용합니다.
 * 새 용어를 추가하려면 반드시 이 파일에 먼저 등록해야 합니다.
 */
export const CANONICAL_TERMS = {
  // ── Queue & Item ──
  queue_item: "큐 항목",
  active_item: "활성 항목",
  completed_item: "완료 항목",
  failed_item: "실패 항목",

  // ── Assignment States ──
  unassigned: "미배정",
  assigned: "배정됨",
  in_progress: "진행 중",
  blocked: "차단됨",
  handed_off: "인수인계",
  resolved: "완료",

  // ── Assignment Actions ──
  action_claim: "담당",
  action_assign: "배정",
  action_reassign: "재배정",
  action_start: "진행 시작",
  action_block: "차단",
  action_handoff: "인수인계",

  // ── Priority Tiers ──
  tier_urgent: "긴급/차단",
  tier_approval: "승인 대기",
  tier_action: "조치 필요",
  tier_monitor: "모니터링",
  tier_info: "정보",

  // ── Task Status ──
  status_ready: "준비",
  status_review: "검토 필요",
  status_in_progress: "진행 중",
  status_waiting: "응답 대기",
  status_action: "조치 필요",
  status_completed: "완료",
  status_failed: "실패",
  status_blocked: "차단됨",

  // ── Approval Status ──
  approval_none: "",
  approval_pending: "승인 대기",
  approval_approved: "승인됨",
  approval_rejected: "거절됨",

  // ── Owner Roles ──
  role_requester: "요청자",
  role_approver: "승인자",
  role_operator: "운영자",
  role_lead: "리드",

  // ── Console Views ──
  view_all: "전체",
  view_my_work: "내 작업",
  view_unassigned: "미배정",
  view_team_urgent: "팀 긴급",
  view_recent_handoff: "최근 인수인계",

  // ── Console Modes ──
  mode_queue: "운영 큐",
  mode_daily_review: "일일 검토",
  mode_governance: "거버넌스",
  mode_remediation: "개선",

  // ── Daily Review Categories ──
  review_urgent_now: "긴급 현재",
  review_overdue_owned: "초과 보유",
  review_blocked_long: "장기 차단",
  review_handoff_pending: "미인수 인수인계",
  review_urgent_unassigned: "긴급 미배정",
  review_recently_resolved: "최근 완료",
  review_lead_intervention: "리드 개입 필요",

  // ── Review Outcomes ──
  outcome_keep: "현 담당 유지",
  outcome_reassign: "재배정",
  outcome_escalate: "리드 에스컬레이션",
  outcome_blocked_followup: "차단 후속",
  outcome_carry_next: "다음 검토 이월",
  outcome_resolved: "검토 중 해결",

  // ── Escalation Actions ──
  escalation_untouched: "미착수 에스컬레이션",
  escalation_handoff: "미인수 에스컬레이션",
  escalation_blocked: "장기차단 에스컬레이션",
  escalation_reassignment: "반복재배정 에스컬레이션",
  escalation_overdue: "긴급초과 에스컬레이션",

  // ── Cadence Steps ──
  cadence_start: "업무 시작 검토",
  cadence_midday: "오후 에스컬레이션 점검",
  cadence_end: "업무 종료 이월 검토",
  cadence_weekly: "주간 병목 분석",

  // ── SLA Categories ──
  sla_first_action: "최초 조치 지연",
  sla_urgent_resolution: "긴급 해결 시간",
  sla_handoff: "인수인계 수락 시간",
  sla_blocked: "차단 해결 시간",
  sla_reassignment: "재배정 안정성",
  sla_review: "검토 완료율",

  // ── Remediation Statuses ──
  remediation_open: "열림",
  remediation_in_progress: "진행 중",
  remediation_blocked: "차단",
  remediation_resolved: "해결",
  remediation_deferred: "연기",

  // ── Bottleneck Classes ──
  bottleneck_sla: "반복 SLA 위반",
  bottleneck_carry_over: "반복 이월",
  bottleneck_reassignment: "반복 재배정 핫스팟",
  bottleneck_blocked: "차단 장기화 핫스팟",
  bottleneck_handoff: "인수인계 실패 핫스팟",
  bottleneck_latency: "담당 역할 지연 핫스팟",
  bottleneck_throughput: "큐 유형 처리량 핫스팟",

  // ── Governance Signals ──
  signal_unresolved_urgent: "일일 미해결 긴급",
  signal_carry_over: "사유별 이월 현황",
  signal_blocked_aging: "차단 에이징",
  signal_reassignment_hotspots: "재배정 핫스팟",
  signal_first_action_latency: "평균 최초 조치 지연",
  signal_lead_intervention: "리드 개입 건수",
} as const;

export type CanonicalTermKey = keyof typeof CANONICAL_TERMS;

// ══════════════════════════════════════════════════════
// §2: Cross-Surface UX Consistency
// ══════════════════════════════════════════════════════

/** Severity color mapping — consistent across all surfaces */
export const SEVERITY_STYLES = {
  critical: { bg: "bg-red-50", border: "border-red-200", text: "text-red-700", badge: "destructive" as const },
  high: { bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-700", badge: "destructive" as const },
  medium: { bg: "bg-yellow-50", border: "border-yellow-200", text: "text-yellow-700", badge: "outline" as const },
  low: { bg: "bg-gray-50", border: "border-gray-200", text: "text-gray-500", badge: "secondary" as const },
} as const;

/** SLA compliance color thresholds */
export const SLA_COMPLIANCE_STYLES = {
  good: { bg: "bg-green-50", border: "border-green-200", text: "text-green-700", minRate: 0.8 },
  warning: { bg: "bg-yellow-50", border: "border-yellow-200", text: "text-yellow-700", minRate: 0.5 },
  bad: { bg: "bg-red-50", border: "border-red-200", text: "text-red-700", minRate: 0 },
} as const;

/** Get SLA compliance style based on rate */
export function getSLAComplianceStyle(rate: number) {
  if (rate >= SLA_COMPLIANCE_STYLES.good.minRate) return SLA_COMPLIANCE_STYLES.good;
  if (rate >= SLA_COMPLIANCE_STYLES.warning.minRate) return SLA_COMPLIANCE_STYLES.warning;
  return SLA_COMPLIANCE_STYLES.bad;
}

/** Relative time display rules — consistent across all surfaces */
export function formatRelativeTime(date: Date | string, now?: Date): string {
  const _now = now ?? new Date();
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMs = _now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 0) return "방금 전";
  if (diffMin < 1) return "방금 전";
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHour < 24) return `${diffHour}시간 전`;
  if (diffDay < 7) return `${diffDay}일 전`;
  if (diffDay < 30) return `${Math.floor(diffDay / 7)}주 전`;
  return d.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

/** Format duration for SLA/blocked timers */
export function formatDuration(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}분`;
  if (hours < 24) return `${Math.round(hours)}시간`;
  const days = Math.floor(hours / 24);
  const remainHours = Math.round(hours % 24);
  if (remainHours === 0) return `${days}일`;
  return `${days}일 ${remainHours}시간`;
}

/** CTA button variant mapping — consistent across surfaces */
export const CTA_VARIANTS = {
  primary: "default" as const,      // Main action (approve, resolve, claim)
  secondary: "outline" as const,    // Alternative action (reassign, carry-over)
  destructive: "destructive" as const, // Escalation, reject
  ghost: "ghost" as const,          // Dismiss, defer, cancel
} as const;

// ══════════════════════════════════════════════════════
// §3: Critical Edge-State Polish
// ══════════════════════════════════════════════════════

export type EdgeStateId =
  | "empty_queue"
  | "no_remediation"
  | "no_governance_issues"
  | "no_daily_review_items"
  | "blocked_missing_reason"
  | "assignment_no_owner"
  | "stale_missing_timestamp"
  | "action_failed"
  | "action_retrying"
  | "loading"
  | "error";

export interface EdgeStateMessage {
  id: EdgeStateId;
  title: string;
  description: string;
  icon: "empty" | "success" | "warning" | "error" | "loading";
}

export const EDGE_STATE_MESSAGES: Record<EdgeStateId, EdgeStateMessage> = {
  empty_queue: {
    id: "empty_queue",
    title: "큐가 비어 있습니다",
    description: "현재 처리할 항목이 없습니다. 새 항목이 생성되면 여기에 표시됩니다.",
    icon: "empty",
  },
  no_remediation: {
    id: "no_remediation",
    title: "개선 항목 없음",
    description: "현재 진행 중인 개선 항목이 없습니다. 병목이 탐지되면 개선 항목이 생성됩니다.",
    icon: "success",
  },
  no_governance_issues: {
    id: "no_governance_issues",
    title: "거버넌스 이슈 없음",
    description: "모든 SLA가 준수되고 있으며 리드 개입이 필요한 항목이 없습니다.",
    icon: "success",
  },
  no_daily_review_items: {
    id: "no_daily_review_items",
    title: "검토할 항목 없음",
    description: "오늘 검토가 필요한 항목이 없습니다. 긴급 항목이 발생하면 여기에 표시됩니다.",
    icon: "success",
  },
  blocked_missing_reason: {
    id: "blocked_missing_reason",
    title: "차단 사유 미기록",
    description: "이 항목은 차단 상태이지만 사유가 기록되지 않았습니다. 차단 사유를 입력해 주세요.",
    icon: "warning",
  },
  assignment_no_owner: {
    id: "assignment_no_owner",
    title: "담당자 정보 없음",
    description: "배정 상태이지만 담당자 정보를 확인할 수 없습니다.",
    icon: "warning",
  },
  stale_missing_timestamp: {
    id: "stale_missing_timestamp",
    title: "시간 정보 누락",
    description: "이 항목의 시간 정보가 누락되었습니다.",
    icon: "warning",
  },
  action_failed: {
    id: "action_failed",
    title: "작업 실패",
    description: "요청한 작업이 실패했습니다. 다시 시도해 주세요.",
    icon: "error",
  },
  action_retrying: {
    id: "action_retrying",
    title: "재시도 중",
    description: "작업을 다시 시도하고 있습니다. 잠시만 기다려 주세요.",
    icon: "loading",
  },
  loading: {
    id: "loading",
    title: "로딩 중",
    description: "데이터를 불러오고 있습니다.",
    icon: "loading",
  },
  error: {
    id: "error",
    title: "오류 발생",
    description: "데이터를 불러오는 데 실패했습니다. 페이지를 새로고침해 주세요.",
    icon: "error",
  },
};

/** Detect edge states from queue/review data */
export function detectEdgeStates(
  items: Array<{ taskStatus: string; assigneeId: string | null; metadata: Record<string, unknown>; updatedAt: Date | string }>,
): EdgeStateId[] {
  const states: EdgeStateId[] = [];

  if (items.length === 0) {
    states.push("empty_queue");
  }

  for (const item of items) {
    // Blocked but no reason
    const meta = item.metadata ?? {};
    if (item.taskStatus === "BLOCKED" && !meta.blockedReason && !meta.blockedAt) {
      states.push("blocked_missing_reason");
      break; // one warning is enough
    }

    // Assigned but no assigneeId
    if (meta.assignmentState === "assigned" && !item.assigneeId) {
      states.push("assignment_no_owner");
      break;
    }
  }

  return [...new Set(states)];
}

// ══════════════════════════════════════════════════════
// §4: Console Navigation
// ══════════════════════════════════════════════════════

export type ConsoleMode = "queue" | "daily_review" | "governance" | "remediation";

export const CONSOLE_MODE_DEFS: Record<ConsoleMode, {
  label: string;
  description: string;
  primaryAudience: "operator" | "lead" | "both";
  sortOrder: number;
}> = {
  queue: {
    label: "운영 큐",
    description: "실시간 큐 항목 관리",
    primaryAudience: "both",
    sortOrder: 0,
  },
  daily_review: {
    label: "일일 검토",
    description: "일일 운영 검토 및 에스컬레이션",
    primaryAudience: "both",
    sortOrder: 1,
  },
  governance: {
    label: "거버넌스",
    description: "SLA 준수 및 운영 케이던스",
    primaryAudience: "lead",
    sortOrder: 2,
  },
  remediation: {
    label: "개선",
    description: "병목 탐지 및 개선 추적",
    primaryAudience: "lead",
    sortOrder: 3,
  },
};

export const CONSOLE_MODE_LABELS: Record<ConsoleMode, string> = {
  queue: "운영 큐",
  daily_review: "일일 검토",
  governance: "거버넌스",
  remediation: "개선",
};

export const CONSOLE_MODE_ORDER: ConsoleMode[] = ["queue", "daily_review", "governance", "remediation"];

// ══════════════════════════════════════════════════════
// §5: Pilot-Readiness Scenarios
// ══════════════════════════════════════════════════════

export interface PilotScenario {
  id: string;
  title: string;
  audience: "operator" | "lead" | "admin";
  steps: string[];
  expectedOutcome: string;
}

export const PILOT_SCENARIOS: PilotScenario[] = [
  {
    id: "operator_daily_review",
    title: "운영자 일일 검토 워크스루",
    audience: "operator",
    steps: [
      "콘솔 → 일일 검토 모드 전환",
      "긴급 현재 카테고리 확인 → 항목 클릭",
      "에스컬레이션 필요 시 에스컬레이션 버튼 클릭",
      "검토 결과 선택 (현 담당 유지 / 재배정 / 다음 검토 이월)",
      "이월 항목 확인 → 이월 사유 확인",
    ],
    expectedOutcome: "모든 긴급 항목 검토 완료, 이월 항목에 사유 기록됨",
  },
  {
    id: "lead_governance_review",
    title: "리드 거버넌스 검토 워크스루",
    audience: "lead",
    steps: [
      "콘솔 → 거버넌스 모드 전환",
      "운영 케이던스 상태 확인 → 미완료 단계 클릭",
      "SLA 준수 현황 확인 → 위반 항목 드릴다운",
      "리드 개입 필요 항목 확인 → 조치 결정",
      "케이던스 단계 완료 버튼 클릭",
    ],
    expectedOutcome: "SLA 위반 인지, 리드 개입 완료, 케이던스 단계 기록됨",
  },
  {
    id: "lead_remediation_cycle",
    title: "리드 병목 개선 사이클 워크스루",
    audience: "lead",
    steps: [
      "콘솔 → 개선 모드 전환",
      "탐지된 병목 확인 → 심각도 높은 항목 선택",
      "개선 항목 생성 (담당자, 기한, 컨텍스트 입력)",
      "기존 개선 항목 상태 변경 (진행 / 해결 / 연기)",
      "개선 루프 신호 확인 → 개선 없는 핫스팟 확인",
    ],
    expectedOutcome: "반복 병목에 대한 개선 항목 생성됨, 진행 상황 추적 가능",
  },
  {
    id: "what_happens_urgent_unassigned",
    title: "긴급 미배정 항목 발생 시",
    audience: "operator",
    steps: [
      "큐에 긴급 미배정 항목 표시됨",
      "일일 검토에서 '긴급 미배정' 카테고리로 분류",
      "운영자가 담당 버튼 클릭하여 자신에게 배정",
      "SLA 타이머 시작 (최초 조치 4시간, 해결 12시간)",
    ],
    expectedOutcome: "긴급 항목이 즉시 배정되고 SLA 추적 시작",
  },
  {
    id: "what_happens_blocked_aging",
    title: "차단 항목 장기화 시",
    audience: "lead",
    steps: [
      "항목이 48시간 이상 차단 상태 유지",
      "오후 에스컬레이션 점검에서 표면화",
      "리드 개입 트리거 발동 (조치 없는 차단)",
      "거버넌스 모드에서 SLA 위반 확인",
      "개선 모드에서 '차단 장기화 핫스팟' 병목 탐지",
    ],
    expectedOutcome: "차단 해소 조치 또는 개선 항목 생성",
  },
];

/** Admin/operator sanity checklist for pilot */
export const PILOT_CHECKLIST = [
  { id: "queue_loads", label: "운영 큐가 정상 로딩되는가", audience: "admin" as const },
  { id: "modes_switch", label: "4개 모드 전환이 정상 작동하는가", audience: "admin" as const },
  { id: "assignment_works", label: "담당/배정/재배정이 정상 작동하는가", audience: "operator" as const },
  { id: "review_works", label: "일일 검토 결과 선택이 정상 작동하는가", audience: "operator" as const },
  { id: "escalation_works", label: "에스컬레이션이 정상 실행되는가", audience: "operator" as const },
  { id: "cadence_completes", label: "케이던스 단계 완료가 기록되는가", audience: "lead" as const },
  { id: "sla_shows", label: "SLA 준수율이 정확히 표시되는가", audience: "lead" as const },
  { id: "remediation_creates", label: "개선 항목 생성이 가능한가", audience: "lead" as const },
  { id: "remediation_transitions", label: "개선 항목 상태 변경이 작동하는가", audience: "lead" as const },
  { id: "empty_states", label: "빈 상태에서 적절한 메시지가 표시되는가", audience: "admin" as const },
  { id: "error_recovery", label: "오류 발생 시 적절한 메시지와 재시도가 가능한가", audience: "admin" as const },
] as const;

// ══════════════════════════════════════════════════════
// §5 (cont): Pre-existing Stability Classification
// ══════════════════════════════════════════════════════

export type StabilityClassification = "blocker" | "non_blocker" | "deferred";

export interface PreExistingIssue {
  id: string;
  description: string;
  classification: StabilityClassification;
  location: string;
  resolution: string;
}

/**
 * 사전 존재 이슈 목록 — V1 파일럿 전 분류
 *
 * Note: 이 목록은 기존 tsc 및 테스트에서 확인된 사항입니다.
 */
export const PRE_EXISTING_ISSUES: PreExistingIssue[] = [
  {
    id: "tsc_path_aliases",
    description: "monorepo root에서 tsc --noEmit 실행 시 @/ 경로 별칭 2000+ 오류",
    classification: "non_blocker",
    location: "tsconfig.json / monorepo structure",
    resolution: "Next.js 빌드에서는 정상 동작. apps/web/ 내 jest.config.js의 moduleNameMapper로 테스트 정상.",
  },
  {
    id: "service_implicit_any",
    description: "work-queue-service.ts 120, 346, 371행 implicit any 경고",
    classification: "non_blocker",
    location: "apps/web/src/lib/work-queue/work-queue-service.ts",
    resolution: "Prisma 콜백 타입 추론 한계. 기능 영향 없음.",
  },
  {
    id: "activity_type_cast",
    description: "ActivityType enum에 커스텀 이벤트 타입 미등록 → as any 캐스팅 사용",
    classification: "deferred",
    location: "work-queue-service.ts, cadence/remediation log events",
    resolution: "Prisma schema에 ActivityType enum 확장 필요. 기능 동작에 영향 없음.",
  },
  {
    id: "mobile_app_ts_errors",
    description: "apps/mobile/ 디렉토리 NativeProps 타입 오류",
    classification: "non_blocker",
    location: "apps/mobile/app/(tabs)/index.tsx",
    resolution: "모바일 앱 별도 스코프. 운영 콘솔과 무관.",
  },
];

/**
 * V1 블로커 이슈가 있는지 확인합니다.
 */
export function hasBlockerIssues(): boolean {
  return PRE_EXISTING_ISSUES.some((i) => i.classification === "blocker");
}
