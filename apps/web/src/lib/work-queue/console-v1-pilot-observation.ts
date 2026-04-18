/**
 * Ops Console V1 — Post-Merge Pilot Observation
 *
 * 파일럿 운영에서 실제 사용 마찰과 운영 리스크를 관찰하고 최소 보정한다.
 *
 * §1 관찰 항목 정의 — 5개 핵심 관찰 포인트
 * §2 이슈 분류 체계 — blocker / friction / defer
 * §3 관찰 로그 구조 — 관찰 기록 축적 형식
 * §4 Non-Blocker 우선순위 재평가 — 6건 실측 기반 재분류
 * §5 V1.1 보정 목록 vs V2 이월 목록 분리 기준
 *
 * 순수 정의 파일 — DB 호출 없음.
 */

// ══════════════════════════════════════════════════════
// §1: Observation Points
// ══════════════════════════════════════════════════════

export type ObservationPointId =
  | "sync_failure_frequency"
  | "cta_refetch_delay"
  | "remediation_creation_friction"
  | "governance_access_frequency"
  | "blocked_missing_reason_frequency";

export interface ObservationPoint {
  id: ObservationPointId;
  label: string;
  description: string;
  metric: string;
  threshold: string;
  actionIfExceeded: string;
}

export const OBSERVATION_POINTS: Record<ObservationPointId, ObservationPoint> = {
  sync_failure_frequency: {
    id: "sync_failure_frequency",
    label: "동기화 실패 빈도",
    description: "useSyncOpsQueue 실패 시 stale 데이터가 표시되는 빈도",
    metric: "일일 실패 횟수 / 총 동기화 시도",
    threshold: "5% 이상 실패 시 조치",
    actionIfExceeded: "실패 배너 표시 + 수동 새로고침 버튼 추가",
  },
  cta_refetch_delay: {
    id: "cta_refetch_delay",
    label: "CTA 실행 후 리프레시 지연",
    description: "CTA 실행 → 큐 데이터 갱신까지 체감 지연",
    metric: "mutation settle → query refetch 완료 시간 (ms)",
    threshold: "2초 이상 체감 시 조치",
    actionIfExceeded: "낙관적 업데이트 적용 또는 완료 토스트 추가",
  },
  remediation_creation_friction: {
    id: "remediation_creation_friction",
    label: "개선 항목 생성 마찰",
    description: "리드가 개선 항목을 생성하려 할 때 UI 진입점 부재",
    metric: "파일럿 중 개선 생성 시도 횟수",
    threshold: "주 2회 이상 생성 시도 시 폼 추가",
    actionIfExceeded: "RemediationView에 '새 개선' 인라인 폼 추가",
  },
  governance_access_frequency: {
    id: "governance_access_frequency",
    label: "거버넌스/개선 모드 접근 빈도",
    description: "운영자(비리드)의 거버넌스/개선 탭 접근 빈도",
    metric: "운영자 역할 사용자의 거버넌스/개선 모드 전환 횟수",
    threshold: "운영자 접근이 전체의 30% 이상 시 역할 분리 앞당김",
    actionIfExceeded: "CONSOLE_MODE_DEFS audience 기반 UI 필터링 구현",
  },
  blocked_missing_reason_frequency: {
    id: "blocked_missing_reason_frequency",
    label: "차단 사유 누락 빈도",
    description: "blocked 상태이나 blockedReason이 없는 항목 비율",
    metric: "blocked && !blockedReason 항목 수 / 전체 blocked 항목 수",
    threshold: "20% 이상 시 조치",
    actionIfExceeded: "ConsoleQueueCard에 '사유 누락' 경고 배지 추가",
  },
};

// ══════════════════════════════════════════════════════
// §2: Pilot Issue Classification
// ══════════════════════════════════════════════════════

export type PilotIssueClass = "blocker" | "friction" | "defer";

export interface PilotIssue {
  id: string;
  title: string;
  classification: PilotIssueClass;
  observedAt: string; // ISO date
  observationPoint: ObservationPointId | null;
  description: string;
  resolution: string;
  resolvedAt: string | null;
}

/**
 * 파일럿 중 발견된 이슈를 분류합니다.
 */
export function classifyPilotIssue(
  metricValue: number,
  threshold: number,
  isStructural: boolean,
): PilotIssueClass {
  if (isStructural) return "blocker";
  if (metricValue >= threshold) return "friction";
  return "defer";
}

// ══════════════════════════════════════════════════════
// §3: Observation Log Structure
// ══════════════════════════════════════════════════════

export interface ObservationLogEntry {
  date: string; // ISO date
  observationPointId: ObservationPointId;
  metricValue: number;
  note: string;
  reporter: string;
}

export interface PilotObservationSummary {
  startDate: string;
  endDate: string | null;
  totalEntries: number;
  entriesByPoint: Record<ObservationPointId, number>;
  issuesFound: PilotIssue[];
  blockerCount: number;
  frictionCount: number;
  deferCount: number;
}

/**
 * 관찰 로그 항목들로부터 요약을 생성합니다.
 */
export function buildObservationSummary(
  entries: ObservationLogEntry[],
  issues: PilotIssue[],
  startDate: string,
): PilotObservationSummary {
  const entriesByPoint: Record<ObservationPointId, number> = {
    sync_failure_frequency: 0,
    cta_refetch_delay: 0,
    remediation_creation_friction: 0,
    governance_access_frequency: 0,
    blocked_missing_reason_frequency: 0,
  };

  entries.forEach((entry: ObservationLogEntry) => {
    if (entriesByPoint[entry.observationPointId] !== undefined) {
      entriesByPoint[entry.observationPointId]++;
    }
  });

  return {
    startDate,
    endDate: null,
    totalEntries: entries.length,
    entriesByPoint,
    issuesFound: issues,
    blockerCount: issues.filter((i: PilotIssue) => i.classification === "blocker").length,
    frictionCount: issues.filter((i: PilotIssue) => i.classification === "friction").length,
    deferCount: issues.filter((i: PilotIssue) => i.classification === "defer").length,
  };
}

// ══════════════════════════════════════════════════════
// §4: Non-Blocker Priority Reassessment
// ══════════════════════════════════════════════════════

export type PriorityAction = "v1.1_fix" | "v2_defer" | "monitor";

export interface NonBlockerReassessment {
  issueId: string;
  title: string;
  originalPriority: "non_blocker";
  observedImpact: "high" | "medium" | "low" | "not_observed";
  action: PriorityAction;
  rationale: string;
}

/**
 * Non-blocker 6건의 초기 재평가 프레임.
 * 파일럿 관찰 후 observedImpact를 업데이트하여 최종 결정.
 */
export const NON_BLOCKER_REASSESSMENTS: NonBlockerReassessment[] = [
  {
    issueId: "NB-01",
    title: "productization 유틸 UI 미연결",
    originalPriority: "non_blocker",
    observedImpact: "not_observed",
    action: "monitor",
    rationale: "용어 의미적 일관성은 유지됨. formatRelativeTime 등 유틸 연결은 UX 개선 시 자연 반영.",
  },
  {
    issueId: "NB-02",
    title: "엣지 상태 세분화 메시지 UI 미반영",
    originalPriority: "non_blocker",
    observedImpact: "not_observed",
    action: "monitor",
    rationale: "blocked_missing_reason 관찰 결과에 따라 v1.1 또는 defer 결정.",
  },
  {
    issueId: "NB-03",
    title: "work-queue-service.ts as any 9건",
    originalPriority: "non_blocker",
    observedImpact: "low",
    action: "v2_defer",
    rationale: "Prisma enum 캐스팅. 런타임 영향 없음. schema migration 시 자연 해결.",
  },
  {
    issueId: "NB-04",
    title: "use-work-queue.ts error as any 2건",
    originalPriority: "non_blocker",
    observedImpact: "low",
    action: "v2_defer",
    rationale: "에러 표시 정상 동작. 타입 안전 에러 클래스는 V2 리팩터 스코프.",
  },
  {
    issueId: "NB-05",
    title: "일일 검토 날짜 칩 count=0 표시",
    originalPriority: "non_blocker",
    observedImpact: "not_observed",
    action: "v1.1_fix",
    rationale: "사소한 시각적 혼란이나 수정 비용 최소. UX 보정 패스에서 함께 처리.",
  },
  {
    issueId: "NB-06",
    title: "에러 상태 재시도 메커니즘 없음",
    originalPriority: "non_blocker",
    observedImpact: "not_observed",
    action: "monitor",
    rationale: "파일럿 환경 안정성에 따라 결정. 빈번한 API 실패 시 v1.1 조치.",
  },
];

/**
 * V1.1 보정 대상 목록을 반환합니다.
 */
export function getV11Fixes(): NonBlockerReassessment[] {
  return NON_BLOCKER_REASSESSMENTS.filter(
    (r: NonBlockerReassessment) => r.action === "v1.1_fix",
  );
}

/**
 * V2 이월 대상 목록을 반환합니다.
 */
export function getV2Defers(): NonBlockerReassessment[] {
  return NON_BLOCKER_REASSESSMENTS.filter(
    (r: NonBlockerReassessment) => r.action === "v2_defer",
  );
}

/**
 * 모니터링 지속 대상 목록을 반환합니다.
 */
export function getMonitorItems(): NonBlockerReassessment[] {
  return NON_BLOCKER_REASSESSMENTS.filter(
    (r: NonBlockerReassessment) => r.action === "monitor",
  );
}

// ══════════════════════════════════════════════════════
// §5: V1.1 vs V2 Separation Criteria
// ══════════════════════════════════════════════════════

export interface ScopeDecisionCriteria {
  id: string;
  question: string;
  v11Condition: string;
  v2Condition: string;
}

export const SCOPE_DECISION_CRITERIA: ScopeDecisionCriteria[] = [
  {
    id: "SC-01",
    question: "구조 변경이 필요한가?",
    v11Condition: "기존 컴포넌트 내 수정으로 해결 가능",
    v2Condition: "새 컴포넌트, 새 API, 또는 schema 변경 필요",
  },
  {
    id: "SC-02",
    question: "운영자 워크플로우를 차단하는가?",
    v11Condition: "마찰이 있으나 워크플로우 완료 가능",
    v2Condition: "마찰이 없거나, 대안 경로 존재",
  },
  {
    id: "SC-03",
    question: "파일럿에서 실제 관찰되었는가?",
    v11Condition: "파일럿 중 2회 이상 보고됨",
    v2Condition: "이론적 우려이나 실제 보고 없음",
  },
  {
    id: "SC-04",
    question: "수정 범위가 제한적인가?",
    v11Condition: "3개 파일 이내 수정",
    v2Condition: "4개 이상 파일 또는 cross-cutting 변경",
  },
];

/**
 * 파일럿 관찰 완료 여부를 판단합니다.
 */
export function isPilotObservationComplete(summary: PilotObservationSummary): boolean {
  // 최소 관찰 기간: 5일, 최소 로그 수: 10건
  if (summary.totalEntries < 10) return false;
  // 5개 관찰 포인트 모두 최소 1건 이상 기록
  const allPointsCovered = Object.values(summary.entriesByPoint).every(
    (count: number) => count >= 1,
  );
  return allPointsCovered;
}

/**
 * 파일럿 종료 조건 — 관찰 완료 + 블로커 0건
 */
export function canClosePilot(summary: PilotObservationSummary): boolean {
  return isPilotObservationComplete(summary) && summary.blockerCount === 0;
}
