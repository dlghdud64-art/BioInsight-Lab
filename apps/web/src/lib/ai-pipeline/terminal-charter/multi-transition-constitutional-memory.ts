/**
 * @module multi-transition-constitutional-memory
 * @description 시나리오 11 헌법적 메모리 — 다중 전환 질서 보존 원칙.
 * 동시성 직렬화, 위기 우선, 헌법적 가시성 결정론, 역할 충돌 해결,
 * 조정 우선순위 순서, 글로벌 헌법 우위, 지역 규정 준수 존중,
 * 의무 용량 제한, 권한 공백 불허, 헌법 분기 방지,
 * 위기 후 전환 재시작, 재건의 모든 전환 차단 원칙을 기록한다.
 */

import { MultiTransitionScenarioType } from './multi-transition-order-simulation';

// ─────────────────────────────────────────────
// 헌법적 메모리 유형
// ─────────────────────────────────────────────

/** 메모리 카테고리 */
export type MultiTransitionMemoryCategory =
  | 'COORDINATION_PRINCIPLE'
  | 'CONCURRENCY_RULE'
  | 'ARBITRATION_PRECEDENT'
  | 'CRISIS_PROTOCOL';

/** 다중 전환 헌법적 메모리 항목 */
export interface MultiTransitionConstitutionalMemory {
  /** 항목 ID */
  id: string;
  /** 카테고리 */
  category: MultiTransitionMemoryCategory;
  /** 제목 */
  title: string;
  /** 내용 */
  content: string;
  /** 제정일 */
  establishedDate: string;
  /** 최종 검증일 */
  lastValidated: string;
  /** 연관 시나리오 */
  linkedScenarios: MultiTransitionScenarioType[];
  /** 불변 여부 */
  immutable: boolean;
}

// ─────────────────────────────────────────────
// 헌법적 메모리 정의
// ─────────────────────────────────────────────

/**
 * 다중 전환 헌법적 메모리를 반환한다.
 * 12개의 핵심 원칙과 규칙을 포함한다.
 */
export function getMultiTransitionConstitutionalMemories(): MultiTransitionConstitutionalMemory[] {
  const now = '2026-03-14';

  return [
    {
      id: 'MTCM-001',
      category: 'CONCURRENCY_RULE',
      title: '동시성 직렬화 의무',
      content:
        '헌법적 무결성에 영향을 미치는 전환 쌍은 반드시 직렬화해야 한다. ' +
        '특히 승계와 개정이 동시에 발생하면 개정은 승계 완료 후까지 대기해야 한다. ' +
        '이는 권한 이전 중 규칙 변경으로 인한 혼란을 방지하기 위함이다.',
      establishedDate: '2026-03-01',
      lastValidated: now,
      linkedScenarios: [
        MultiTransitionScenarioType.SIMULTANEOUS_SUCCESSION_AND_AMENDMENT,
        MultiTransitionScenarioType.TRIPLE_OVERLAP,
      ],
      immutable: true,
    },
    {
      id: 'MTCM-002',
      category: 'CRISIS_PROTOCOL',
      title: '위기 항상 최우선 원칙',
      content:
        '위기 대응(CRISIS_RESPONSE)은 어떤 상황에서든 최우선 순위를 가진다. ' +
        '위기 발생 시 모든 비위기 전환은 즉시 동결되며, 위기 사령관의 권한이 ' +
        '전환별 역할보다 우선한다. 이 원칙은 예외 없이 적용된다.',
      establishedDate: '2026-03-01',
      lastValidated: now,
      linkedScenarios: [
        MultiTransitionScenarioType.CRISIS_DURING_TRANSITION,
        MultiTransitionScenarioType.TRIPLE_OVERLAP,
      ],
      immutable: true,
    },
    {
      id: 'MTCM-003',
      category: 'COORDINATION_PRINCIPLE',
      title: '헌법적 가시성 결정론',
      content:
        '다중 전환 중 어느 시점에서든 "유효 헌법"은 결정론적으로 산출 가능해야 한다. ' +
        '현재 버전, 보류 개정, 활성 전환을 입력으로 유효 규칙 집합이 유일하게 결정된다. ' +
        '비결정론적 상태가 감지되면 즉시 모든 전환을 동결한다.',
      establishedDate: '2026-03-01',
      lastValidated: now,
      linkedScenarios: [
        MultiTransitionScenarioType.CONSTITUTIONAL_FORK,
        MultiTransitionScenarioType.SIMULTANEOUS_SUCCESSION_AND_AMENDMENT,
      ],
      immutable: true,
    },
    {
      id: 'MTCM-004',
      category: 'COORDINATION_PRINCIPLE',
      title: '역할 충돌 최제한적 해석 원칙',
      content:
        '다중 전환 중 동일 액터가 상충하는 역할을 보유할 때, 가장 제한적인 해석을 ' +
        '적용한다. CRITICAL 수준의 충돌은 거버넌스 패널에 에스컬레이션한다. ' +
        '예: 전임자가 위기 사령관을 겸하면 위기 대응 권한만 행사 가능.',
      establishedDate: '2026-03-01',
      lastValidated: now,
      linkedScenarios: [
        MultiTransitionScenarioType.CRISIS_DURING_TRANSITION,
        MultiTransitionScenarioType.TRIPLE_OVERLAP,
        MultiTransitionScenarioType.AUTHORITY_GAP_DETECTION,
      ],
      immutable: true,
    },
    {
      id: 'MTCM-005',
      category: 'COORDINATION_PRINCIPLE',
      title: '조정 우선순위 순서',
      content:
        '전환 실행 순서는 엄격한 우선순위를 따른다: ' +
        'REFOUNDATION(100) > CRISIS_RESPONSE(90) > SUCCESSION(80) > AMENDMENT(70) > ' +
        'SCOPE_CHANGE(60) > SUNSET(50) > JURISDICTION_CHANGE(40). ' +
        '동일 우선순위 내에서는 먼저 개시된 전환이 우선한다.',
      establishedDate: '2026-03-01',
      lastValidated: now,
      linkedScenarios: [
        MultiTransitionScenarioType.TRIPLE_OVERLAP,
        MultiTransitionScenarioType.OBLIGATION_COLLISION,
        MultiTransitionScenarioType.ROLLBACK_DURING_TRANSITION,
      ],
      immutable: true,
    },
    {
      id: 'MTCM-006',
      category: 'ARBITRATION_PRECEDENT',
      title: '글로벌 헌법 우위 원칙',
      content:
        '지역 전환과 글로벌 전환이 헌법적 사안에서 충돌하면, 글로벌 전환이 항상 우선한다. ' +
        '지역 전환은 글로벌 헌법 규칙을 재정의할 수 없으며, ' +
        '글로벌 개정이나 재건 시 지역은 반드시 정렬해야 한다.',
      establishedDate: '2026-03-01',
      lastValidated: now,
      linkedScenarios: [
        MultiTransitionScenarioType.REGIONAL_DESYNC,
        MultiTransitionScenarioType.CONSTITUTIONAL_FORK,
      ],
      immutable: true,
    },
    {
      id: 'MTCM-007',
      category: 'ARBITRATION_PRECEDENT',
      title: '지역 규정 준수 존중 원칙',
      content:
        '규정 준수 및 규제 사안에서는 지역 전환이 우선한다. ' +
        '글로벌 전환이라 하더라도 지역의 규제 요건을 무시할 수 없다. ' +
        '헌법적 사안과 규정 준수 사안이 동시에 관련되면 타협안을 도출한다.',
      establishedDate: '2026-03-01',
      lastValidated: now,
      linkedScenarios: [
        MultiTransitionScenarioType.REGIONAL_DESYNC,
      ],
      immutable: false,
    },
    {
      id: 'MTCM-008',
      category: 'COORDINATION_PRINCIPLE',
      title: '의무 용량 제한 원칙',
      content:
        '다중 전환으로 인해 누적된 의무가 용량 임계값(기본 50)을 초과하면 ' +
        'OBLIGATION_OVERLOAD가 선언되고 의무 트리아지가 개시된다. ' +
        '트리아지는 헌법적 중요도를 기준으로 KEEP/DEFER/MERGE/DROP을 결정한다.',
      establishedDate: '2026-03-01',
      lastValidated: now,
      linkedScenarios: [
        MultiTransitionScenarioType.OBLIGATION_COLLISION,
        MultiTransitionScenarioType.TRIPLE_OVERLAP,
      ],
      immutable: false,
    },
    {
      id: 'MTCM-009',
      category: 'COORDINATION_PRINCIPLE',
      title: '다중 전환 중 권한 공백 불허 원칙',
      content:
        '어떤 시점에서도 헌법적 권한의 공백이 존재해서는 안 된다. ' +
        '승계와 일몰이 동시에 진행될 때 관할 공백이 감지되면, ' +
        '최소 권한 원칙에 따라 임시 권한 위임을 즉시 시행한다.',
      establishedDate: '2026-03-01',
      lastValidated: now,
      linkedScenarios: [
        MultiTransitionScenarioType.AUTHORITY_GAP_DETECTION,
        MultiTransitionScenarioType.CRISIS_DURING_TRANSITION,
      ],
      immutable: true,
    },
    {
      id: 'MTCM-010',
      category: 'CONCURRENCY_RULE',
      title: '헌법 분기 방지 원칙',
      content:
        '헌법은 항상 단일 정본(canonical version)이어야 한다. ' +
        '다중 전환이 헌법의 서로 다른 버전을 참조하는 "분기" 상태가 감지되면, ' +
        '즉시 모든 전환을 동결하고 통합 절차를 개시한다.',
      establishedDate: '2026-03-01',
      lastValidated: now,
      linkedScenarios: [
        MultiTransitionScenarioType.CONSTITUTIONAL_FORK,
        MultiTransitionScenarioType.REGIONAL_DESYNC,
      ],
      immutable: true,
    },
    {
      id: 'MTCM-011',
      category: 'CRISIS_PROTOCOL',
      title: '위기 후 전환 재시작 의무',
      content:
        '위기가 특정 전환을 무효화한 경우, 해당 전환은 위기 해결 후 처음부터 재시작해야 한다. ' +
        '단순 재개가 아닌 전환 초기 상태로의 완전한 리셋이 필요하며, ' +
        '재시작 전 무결성 검증을 통과해야 한다.',
      establishedDate: '2026-03-01',
      lastValidated: now,
      linkedScenarios: [
        MultiTransitionScenarioType.CRISIS_DURING_TRANSITION,
        MultiTransitionScenarioType.ROLLBACK_DURING_TRANSITION,
      ],
      immutable: true,
    },
    {
      id: 'MTCM-012',
      category: 'CONCURRENCY_RULE',
      title: '재건의 모든 전환 차단 원칙',
      content:
        '재건(REFOUNDATION)이 개시되면 다른 모든 전환은 즉시 차단된다. ' +
        '재건은 시스템 전체를 재구성하므로, 부분적 전환의 병렬 실행은 ' +
        '헌법적 일관성을 파괴할 수 있다. 재건 완료 후 필요한 전환만 재개시된다.',
      establishedDate: '2026-03-01',
      lastValidated: now,
      linkedScenarios: [
        MultiTransitionScenarioType.CONSTITUTIONAL_FORK,
        MultiTransitionScenarioType.TRIPLE_OVERLAP,
      ],
      immutable: true,
    },
  ];
}

// ─────────────────────────────────────────────
// 메모리 무결성 검증
// ─────────────────────────────────────────────

/** 무결성 검증 결과 */
export interface MultiTransitionMemoryIntegrityResult {
  /** 전체 메모리 수 */
  totalMemories: number;
  /** 불변 메모리 수 */
  immutableCount: number;
  /** 카테고리별 분포 */
  categoryDistribution: Record<MultiTransitionMemoryCategory, number>;
  /** 시나리오 커버리지 */
  scenarioCoverage: Record<string, number>;
  /** 무결성 통과 여부 */
  integrityPassed: boolean;
  /** 발견 사항 */
  findings: string[];
}

/**
 * 다중 전환 헌법적 메모리의 무결성을 검증한다.
 * 모든 시나리오가 커버되는지, 카테고리 분포가 적절한지 확인한다.
 */
export function validateMultiTransitionMemoryIntegrity(): MultiTransitionMemoryIntegrityResult {
  const memories = getMultiTransitionConstitutionalMemories();
  const findings: string[] = [];

  // 카테고리별 분포
  const categoryDistribution: Record<MultiTransitionMemoryCategory, number> = {
    COORDINATION_PRINCIPLE: 0,
    CONCURRENCY_RULE: 0,
    ARBITRATION_PRECEDENT: 0,
    CRISIS_PROTOCOL: 0,
  };

  for (const memory of memories) {
    categoryDistribution[memory.category]++;
  }

  // 시나리오 커버리지
  const scenarioCoverage: Record<string, number> = {};
  const allScenarios = Object.values(MultiTransitionScenarioType);

  for (const scenario of allScenarios) {
    scenarioCoverage[scenario] = 0;
  }

  for (const memory of memories) {
    for (const scenario of memory.linkedScenarios) {
      scenarioCoverage[scenario] = (scenarioCoverage[scenario] ?? 0) + 1;
    }
  }

  // 검증 로직
  const immutableCount = memories.filter((m) => m.immutable).length;
  let integrityPassed = true;

  // 모든 카테고리에 최소 1개 이상의 메모리 필요
  for (const [category, count] of Object.entries(categoryDistribution)) {
    if (count === 0) {
      findings.push(`카테고리 ${category}에 메모리가 없습니다`);
      integrityPassed = false;
    }
  }

  // 모든 시나리오가 최소 1개 이상의 메모리로 커버되어야 함
  for (const [scenario, count] of Object.entries(scenarioCoverage)) {
    if (count === 0) {
      findings.push(`시나리오 ${scenario}가 메모리에 의해 커버되지 않습니다`);
      integrityPassed = false;
    }
  }

  // 불변 메모리가 전체의 50% 이상이어야 함
  if (immutableCount < memories.length * 0.5) {
    findings.push(`불변 메모리 비율(${((immutableCount / memories.length) * 100).toFixed(1)}%)이 50% 미만입니다`);
    integrityPassed = false;
  }

  // 모든 메모리의 lastValidated가 30일 이내여야 함
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  for (const memory of memories) {
    if (new Date(memory.lastValidated) < thirtyDaysAgo) {
      findings.push(`메모리 ${memory.id}(${memory.title})의 최종 검증일이 30일을 초과했습니다`);
      integrityPassed = false;
    }
  }

  if (integrityPassed) {
    findings.push('모든 무결성 검증을 통과했습니다');
  }

  return {
    totalMemories: memories.length,
    immutableCount,
    categoryDistribution,
    scenarioCoverage,
    integrityPassed,
    findings,
  };
}
