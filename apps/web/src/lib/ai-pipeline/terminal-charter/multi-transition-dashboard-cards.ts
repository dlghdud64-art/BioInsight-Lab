/**
 * @module multi-transition-dashboard-cards
 * @description 다중 전환 헌법적 질서 보존 대시보드 카드.
 * 동시성 모니터, 헌법 일관성, 역할 충돌 추적, 의무 부하,
 * 위기 대비, 조정 순서를 시각화한다.
 */

import type {
  MultiTransitionScorecard,
  RoleCollisionResolution,
  ObligationPileup,
  TransitionCoordinationOrder,
  CrisisPrecedenceResult,
  ConstitutionalVisibilityState,
  ConcurrencyRule,
} from './multi-transition-order-simulation';

// ─────────────────────────────────────────────
// 대시보드 카드 유형
// ─────────────────────────────────────────────

/** 대시보드 카드 메트릭 상태 */
export type MultiTransitionMetricStatus = 'GREEN' | 'YELLOW' | 'RED';

/** 대시보드 카드 메트릭 */
export interface MultiTransitionMetric {
  /** 메트릭 라벨 */
  label: string;
  /** 메트릭 값 */
  value: string | number;
  /** 상태 */
  status: MultiTransitionMetricStatus;
}

/** 다중 전환 대시보드 카드 */
export interface MultiTransitionDashboardCard {
  /** 카드 ID */
  id: string;
  /** 카드 제목 */
  title: string;
  /** 카드 카테고리 */
  category: string;
  /** 메트릭 목록 */
  metrics: MultiTransitionMetric[];
  /** 마지막 업데이트 시각 */
  lastUpdated: string;
}

// ─────────────────────────────────────────────
// 대시보드 카드 생성
// ─────────────────────────────────────────────

/**
 * 다중 전환 대시보드 카드를 생성한다.
 * 6가지 관점에서 다중 전환 상태를 시각화한다.
 */
export function getMultiTransitionDashboardCards(params: {
  scorecard: MultiTransitionScorecard;
  concurrencyMatrix: ConcurrencyRule[];
  visibilityState: ConstitutionalVisibilityState;
  roleCollisions: RoleCollisionResolution;
  obligationPileup: ObligationPileup;
  coordinationOrder: TransitionCoordinationOrder;
  crisisPrecedence?: CrisisPrecedenceResult;
}): MultiTransitionDashboardCard[] {
  const {
    concurrencyMatrix, visibilityState, roleCollisions,
    obligationPileup, coordinationOrder, crisisPrecedence,
  } = params;

  const now = new Date().toISOString();
  const cards: MultiTransitionDashboardCard[] = [];

  // 1. 동시성 모니터
  const activeTransitionCount = visibilityState.activeTransitions.length;
  const serializedPairs = concurrencyMatrix.filter((r) => r.policy === 'SERIALIZE').length;
  const parallelPairs = concurrencyMatrix.filter((r) => r.policy === 'PARALLEL_ALLOWED').length;
  cards.push({
    id: `MTDC-CONCURRENCY-${Date.now()}`,
    title: '동시성 모니터',
    category: 'CONCURRENCY',
    metrics: [
      {
        label: '활성 전환 수',
        value: activeTransitionCount,
        status: activeTransitionCount <= 2 ? 'GREEN' : activeTransitionCount <= 4 ? 'YELLOW' : 'RED',
      },
      {
        label: '직렬화 쌍',
        value: serializedPairs,
        status: serializedPairs <= 5 ? 'GREEN' : serializedPairs <= 10 ? 'YELLOW' : 'RED',
      },
      {
        label: '병렬 허용 쌍',
        value: parallelPairs,
        status: 'GREEN',
      },
    ],
    lastUpdated: now,
  });

  // 2. 헌법 일관성
  const unresolvedConflicts = visibilityState.conflicts.filter((c) => !c.resolved).length;
  cards.push({
    id: `MTDC-COHERENCE-${Date.now()}`,
    title: '헌법 일관성',
    category: 'COHERENCE',
    metrics: [
      {
        label: '유효 버전',
        value: visibilityState.currentVersion,
        status: 'GREEN',
      },
      {
        label: '보류 개정',
        value: visibilityState.pendingAmendments.filter((a) => a.status === 'PENDING').length,
        status: visibilityState.pendingAmendments.length <= 2 ? 'GREEN' : visibilityState.pendingAmendments.length <= 5 ? 'YELLOW' : 'RED',
      },
      {
        label: '충돌 감지',
        value: unresolvedConflicts,
        status: unresolvedConflicts === 0 ? 'GREEN' : unresolvedConflicts <= 2 ? 'YELLOW' : 'RED',
      },
    ],
    lastUpdated: now,
  });

  // 3. 역할 충돌 추적기
  const totalActors = new Set(
    visibilityState.activeTransitions.flatMap((t) => t.involvedActors)
  ).size;
  cards.push({
    id: `MTDC-ROLE-${Date.now()}`,
    title: '역할 충돌 추적기',
    category: 'ROLE_COLLISION',
    metrics: [
      {
        label: '전환 참여 액터',
        value: totalActors,
        status: 'GREEN',
      },
      {
        label: '충돌 감지',
        value: roleCollisions.totalCollisions,
        status: roleCollisions.totalCollisions === 0 ? 'GREEN' : roleCollisions.totalCollisions <= 3 ? 'YELLOW' : 'RED',
      },
      {
        label: '해결 완료',
        value: roleCollisions.resolvedCount,
        status: roleCollisions.escalatedCount === 0 ? 'GREEN' : 'RED',
      },
    ],
    lastUpdated: now,
  });

  // 4. 의무 부하
  cards.push({
    id: `MTDC-OBLIGATION-${Date.now()}`,
    title: '의무 부하',
    category: 'OBLIGATION_LOAD',
    metrics: [
      {
        label: '총 의무',
        value: obligationPileup.totalActiveObligations,
        status: obligationPileup.totalActiveObligations <= 30 ? 'GREEN' : obligationPileup.totalActiveObligations <= 50 ? 'YELLOW' : 'RED',
      },
      {
        label: '용량 사용률',
        value: `${obligationPileup.loadPercentage.toFixed(1)}%`,
        status: obligationPileup.loadPercentage <= 70 ? 'GREEN' : obligationPileup.loadPercentage <= 100 ? 'YELLOW' : 'RED',
      },
      {
        label: '과적 위험',
        value: obligationPileup.overloadRisk ? '위험' : '안전',
        status: obligationPileup.overloadRisk ? 'RED' : 'GREEN',
      },
    ],
    lastUpdated: now,
  });

  // 5. 위기 대비
  const frozenCount = crisisPrecedence?.policy.frozenTransitions.length ?? 0;
  const crisisCommander = crisisPrecedence?.policy.crisisCommanderActorId ?? '없음';
  const postCrisisPending = crisisPrecedence?.policy.postCrisisResumeTargets.length ?? 0;
  cards.push({
    id: `MTDC-CRISIS-${Date.now()}`,
    title: '위기 대비',
    category: 'CRISIS_READINESS',
    metrics: [
      {
        label: '동결 전환',
        value: frozenCount,
        status: frozenCount === 0 ? 'GREEN' : frozenCount <= 3 ? 'YELLOW' : 'RED',
      },
      {
        label: '위기 사령관',
        value: crisisCommander,
        status: crisisCommander !== '없음' ? 'GREEN' : 'YELLOW',
      },
      {
        label: '위기 후 대기',
        value: postCrisisPending,
        status: postCrisisPending <= 2 ? 'GREEN' : postCrisisPending <= 5 ? 'YELLOW' : 'RED',
      },
    ],
    lastUpdated: now,
  });

  // 6. 조정 순서
  cards.push({
    id: `MTDC-COORDINATION-${Date.now()}`,
    title: '조정 순서',
    category: 'COORDINATION_ORDER',
    metrics: [
      {
        label: '전환 큐 깊이',
        value: coordinationOrder.orderedPlan.length,
        status: coordinationOrder.orderedPlan.length <= 3 ? 'GREEN' : coordinationOrder.orderedPlan.length <= 6 ? 'YELLOW' : 'RED',
      },
      {
        label: '우선순위 역전',
        value: coordinationOrder.priorityInversions,
        status: coordinationOrder.priorityInversions === 0 ? 'GREEN' : coordinationOrder.priorityInversions <= 2 ? 'YELLOW' : 'RED',
      },
      {
        label: '차단 전환',
        value: coordinationOrder.blockedCount,
        status: coordinationOrder.blockedCount === 0 ? 'GREEN' : coordinationOrder.blockedCount <= 2 ? 'YELLOW' : 'RED',
      },
    ],
    lastUpdated: now,
  });

  return cards;
}
