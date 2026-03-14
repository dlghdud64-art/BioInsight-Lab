/**
 * 공익 우선 라우터
 *
 * 시민적 태그가 부착된 워크플로우에 우선 레인을 보장한다.
 * 공공 안전·감사·긴급 복구·취약 인구 관련 워크플로우는
 * 항상 표준 트래픽보다 우선적으로 처리된다.
 */

/** 시민적 태그 */
export type CivicTag =
  | 'PUBLIC_SAFETY'
  | 'AUDIT'
  | 'EMERGENCY_RECOVERY'
  | 'VULNERABLE_POPULATION'
  | 'STANDARD';

/** 우선 레인 정의 */
export interface PriorityLane {
  /** 시민적 태그 */
  tag: CivicTag;
  /** 우선순위 (1이 최고, 5가 최저) */
  priority: number;
  /** 보장 여부 (true면 항상 우선 배정) */
  guaranteed: boolean;
  /** 최대 허용 지연 시간 (ms) */
  maxLatencyMs: number;
}

/** 워크플로우 */
export interface Workflow {
  /** 워크플로우 ID */
  id: string;
  /** 워크플로우 설명 */
  description: string;
  /** 안전 관련 여부 */
  isSafetyRelated: boolean;
  /** 감사 관련 여부 */
  isAuditRelated: boolean;
  /** 긴급 복구 여부 */
  isEmergencyRecovery: boolean;
  /** 취약 인구 관련 여부 */
  servesVulnerablePopulation: boolean;
}

/** 라우팅 결과 */
export interface RoutingResult {
  workflowId: string;
  assignedTag: CivicTag;
  lane: PriorityLane;
  routedAt: string;
}

/** 우선 레인 통계 */
export interface PriorityLaneStats {
  tag: CivicTag;
  totalRouted: number;
  averageLatencyMs: number;
  guaranteedCount: number;
}

// ─── 기본 우선 레인 설정 ───

const PRIORITY_LANES: ReadonlyArray<PriorityLane> = [
  { tag: 'PUBLIC_SAFETY', priority: 1, guaranteed: true, maxLatencyMs: 100 },
  { tag: 'EMERGENCY_RECOVERY', priority: 1, guaranteed: true, maxLatencyMs: 150 },
  { tag: 'VULNERABLE_POPULATION', priority: 2, guaranteed: true, maxLatencyMs: 300 },
  { tag: 'AUDIT', priority: 2, guaranteed: true, maxLatencyMs: 500 },
  { tag: 'STANDARD', priority: 5, guaranteed: false, maxLatencyMs: 5000 },
];

// ─── 인메모리 라우팅 이력 ───

const routingHistory: RoutingResult[] = [];

/**
 * 워크플로우에 시민적 태그를 부착한다.
 * @param workflow 워크플로우 정보
 * @returns 부착된 시민적 태그
 */
export function tagWorkflow(workflow: Workflow): CivicTag {
  if (workflow.isSafetyRelated) {
    return 'PUBLIC_SAFETY';
  }
  if (workflow.isEmergencyRecovery) {
    return 'EMERGENCY_RECOVERY';
  }
  if (workflow.servesVulnerablePopulation) {
    return 'VULNERABLE_POPULATION';
  }
  if (workflow.isAuditRelated) {
    return 'AUDIT';
  }
  return 'STANDARD';
}

/**
 * 시민적 우선순위에 따라 워크플로우를 라우팅한다.
 * 시민적 태그가 부착된 워크플로우는 항상 표준 트래픽보다 우선 레인을 배정받는다.
 * @param workflow 워크플로우 정보
 * @returns 라우팅 결과
 */
export function routeByCivicPriority(workflow: Workflow): RoutingResult {
  const tag = tagWorkflow(workflow);
  const lane = PRIORITY_LANES.find((l) => l.tag === tag) ?? PRIORITY_LANES[PRIORITY_LANES.length - 1];

  const result: RoutingResult = {
    workflowId: workflow.id,
    assignedTag: tag,
    lane: { ...lane },
    routedAt: new Date().toISOString(),
  };

  routingHistory.push(result);
  return result;
}

/**
 * 우선 레인별 통계를 반환한다.
 * @returns 각 레인별 라우팅 통계
 */
export function getPriorityLaneStats(): PriorityLaneStats[] {
  const statsMap = new Map<CivicTag, { total: number; guaranteed: number }>();

  for (const lane of PRIORITY_LANES) {
    statsMap.set(lane.tag, { total: 0, guaranteed: 0 });
  }

  for (const entry of routingHistory) {
    const stat = statsMap.get(entry.assignedTag);
    if (stat) {
      stat.total += 1;
      if (entry.lane.guaranteed) {
        stat.guaranteed += 1;
      }
    }
  }

  return PRIORITY_LANES.map((lane) => {
    const stat = statsMap.get(lane.tag) ?? { total: 0, guaranteed: 0 };
    return {
      tag: lane.tag,
      totalRouted: stat.total,
      averageLatencyMs: lane.maxLatencyMs * 0.5, // 추정 평균
      guaranteedCount: stat.guaranteed,
    };
  });
}
