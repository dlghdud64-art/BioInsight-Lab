/**
 * @module multi-transition-order-simulation
 * @description E2E 시나리오 11 — 다중 전환 헌법적 질서 보존 시뮬레이션.
 * 승계, 개정, 위기 대응, 범위 변경, 관할권 변경, 일몰, 재건 등
 * 여러 전환이 동시에 발생할 때 헌법적 질서가 보존되는지 검증한다.
 *
 * 주요 기능:
 * 1. 다중 전환 시나리오 카탈로그 (8개 시나리오)
 * 2. 동시성 정책 매트릭스
 * 3. 헌법적 가시성 상태 관리
 * 4. 역할 충돌 감지
 * 5. 조정 순서 규칙
 * 6. 지역/글로벌 중재
 * 7. 의무 과적 감지
 * 8. 위기 우선 프로토콜
 * 9. 다중 전환 스코어카드
 * 10. 강화 백로그
 * 11. 전체 시뮬레이션 러너
 */

// ════════════════════════════════════════════════════════════════
// Part 1: 다중 전환 시나리오 카탈로그
// ════════════════════════════════════════════════════════════════

/** 다중 전환 시나리오 유형 */
export enum MultiTransitionScenarioType {
  /** 11A: 승계 + 개정 동시 발생 */
  SIMULTANEOUS_SUCCESSION_AND_AMENDMENT = 'SIMULTANEOUS_SUCCESSION_AND_AMENDMENT',
  /** 11B: 전환 중 위기 발생 */
  CRISIS_DURING_TRANSITION = 'CRISIS_DURING_TRANSITION',
  /** 11C: 승계 + 개정 + 위기 3중 겹침 */
  TRIPLE_OVERLAP = 'TRIPLE_OVERLAP',
  /** 11D: 지역 간 비동기 전환 */
  REGIONAL_DESYNC = 'REGIONAL_DESYNC',
  /** 11E: 전환 중 롤백 필요 */
  ROLLBACK_DURING_TRANSITION = 'ROLLBACK_DURING_TRANSITION',
  /** 11F: 권한 공백 감지 */
  AUTHORITY_GAP_DETECTION = 'AUTHORITY_GAP_DETECTION',
  /** 11G: 의무 충돌 (다중 전환 간) */
  OBLIGATION_COLLISION = 'OBLIGATION_COLLISION',
  /** 11H: 헌법 분기 위험 */
  CONSTITUTIONAL_FORK = 'CONSTITUTIONAL_FORK',
}

/** 전환 유형 */
export enum TransitionType {
  /** 승계 */
  SUCCESSION = 'SUCCESSION',
  /** 개정 */
  AMENDMENT = 'AMENDMENT',
  /** 위기 대응 */
  CRISIS_RESPONSE = 'CRISIS_RESPONSE',
  /** 범위 변경 */
  SCOPE_CHANGE = 'SCOPE_CHANGE',
  /** 관할권 변경 */
  JURISDICTION_CHANGE = 'JURISDICTION_CHANGE',
  /** 일몰 */
  SUNSET = 'SUNSET',
  /** 재건 */
  REFOUNDATION = 'REFOUNDATION',
}

/** 겹치는 전환 정보 */
export interface OverlappingTransition {
  /** 전환 ID */
  transitionId: string;
  /** 전환 유형 */
  type: TransitionType;
  /** 시작 시각 */
  startedAt: string;
  /** 현재 상태 */
  status: 'ACTIVE' | 'FROZEN' | 'COMPLETED' | 'ROLLED_BACK' | 'BLOCKED';
  /** 관련 액터 ID 목록 */
  involvedActors: string[];
  /** 영향 범위 */
  scope: 'LOCAL' | 'GLOBAL';
  /** 관할 지역 (LOCAL인 경우) */
  jurisdiction?: string;
}

/** 다중 전환 시나리오 */
export interface MultiTransitionScenario {
  /** 시나리오 유형 */
  type: MultiTransitionScenarioType;
  /** 시나리오 설명 */
  description: string;
  /** 겹치는 전환 목록 */
  overlappingTransitions: OverlappingTransition[];
  /** 전제 조건 */
  preconditions: string[];
  /** 기대 결과 */
  expectedOutcome: string;
  /** 위험 요소 */
  riskFactors: string[];
  /** 헌법적 제약 */
  constitutionalConstraints: string[];
}

/**
 * 시나리오 카탈로그를 생성한다.
 * 8개의 다중 전환 시나리오를 정의한다.
 */
export function getMultiTransitionScenarioCatalog(): MultiTransitionScenario[] {
  return [
    {
      type: MultiTransitionScenarioType.SIMULTANEOUS_SUCCESSION_AND_AMENDMENT,
      description: '승계와 개정이 동시에 발생하여 권한 이전 중 규칙 변경이 겹치는 상황',
      overlappingTransitions: [
        {
          transitionId: 'T-11A-SUCC',
          type: TransitionType.SUCCESSION,
          startedAt: '2026-03-01T00:00:00Z',
          status: 'ACTIVE',
          involvedActors: ['predecessor-001', 'successor-001'],
          scope: 'GLOBAL',
        },
        {
          transitionId: 'T-11A-AMEND',
          type: TransitionType.AMENDMENT,
          startedAt: '2026-03-02T00:00:00Z',
          status: 'ACTIVE',
          involvedActors: ['proposer-001', 'reviewer-001'],
          scope: 'GLOBAL',
        },
      ],
      preconditions: [
        '승계 절차가 공식적으로 개시되어야 한다',
        '개정안이 정식 제출되어 검토 단계에 있어야 한다',
        '두 전환 모두 동일한 헌법 조항에 영향을 미쳐야 한다',
      ],
      expectedOutcome: '개정은 승계 완료 후까지 직렬화(SERIALIZE)되어 대기한다',
      riskFactors: [
        '승계 대상자가 개정 내용을 인지하지 못할 위험',
        '개정 지연으로 인한 거버넌스 공백',
        '승계 완료 후 개정안의 적합성 재검토 필요',
      ],
      constitutionalConstraints: [
        '승계 중 헌법 변경 금지 원칙',
        '개정안은 현임 및 후임 모두의 검토를 거쳐야 한다',
      ],
    },
    {
      type: MultiTransitionScenarioType.CRISIS_DURING_TRANSITION,
      description: '승계 또는 개정 진행 중 위기가 발생하여 즉각적인 대응이 필요한 상황',
      overlappingTransitions: [
        {
          transitionId: 'T-11B-SUCC',
          type: TransitionType.SUCCESSION,
          startedAt: '2026-03-01T00:00:00Z',
          status: 'ACTIVE',
          involvedActors: ['predecessor-001', 'successor-001'],
          scope: 'GLOBAL',
        },
        {
          transitionId: 'T-11B-CRISIS',
          type: TransitionType.CRISIS_RESPONSE,
          startedAt: '2026-03-05T00:00:00Z',
          status: 'ACTIVE',
          involvedActors: ['crisis-commander-001'],
          scope: 'GLOBAL',
        },
      ],
      preconditions: [
        '승계 절차가 진행 중이어야 한다',
        '위기 이벤트가 발생하여 즉각 대응이 필요하다',
      ],
      expectedOutcome: '전임자가 위기 대응 권한을 유지하고, 승계는 위기 해결 후 재개된다',
      riskFactors: [
        '전임자의 위기 대응 권한 범위 불명확',
        '위기 해결 후 승계 무결성 확인 필요',
        '위기 중 내린 결정의 후임자 구속력',
      ],
      constitutionalConstraints: [
        '위기 시 전임자 권한 유지 원칙',
        '위기 해결 후 승계 재개 시 무결성 검증 의무',
      ],
    },
    {
      type: MultiTransitionScenarioType.TRIPLE_OVERLAP,
      description: '승계, 개정, 위기가 동시에 겹치는 최악의 시나리오',
      overlappingTransitions: [
        {
          transitionId: 'T-11C-SUCC',
          type: TransitionType.SUCCESSION,
          startedAt: '2026-03-01T00:00:00Z',
          status: 'FROZEN',
          involvedActors: ['predecessor-001', 'successor-001'],
          scope: 'GLOBAL',
        },
        {
          transitionId: 'T-11C-AMEND',
          type: TransitionType.AMENDMENT,
          startedAt: '2026-03-02T00:00:00Z',
          status: 'FROZEN',
          involvedActors: ['proposer-001'],
          scope: 'GLOBAL',
        },
        {
          transitionId: 'T-11C-CRISIS',
          type: TransitionType.CRISIS_RESPONSE,
          startedAt: '2026-03-03T00:00:00Z',
          status: 'ACTIVE',
          involvedActors: ['crisis-commander-001', 'predecessor-001'],
          scope: 'GLOBAL',
        },
      ],
      preconditions: [
        '승계와 개정이 이미 동시 진행 중이어야 한다',
        '위기가 추가로 발생하여 3중 겹침이 되어야 한다',
      ],
      expectedOutcome: '위기 대응만 활성, 승계·개정 모두 동결. 위기 해결 후 순서대로 재개',
      riskFactors: [
        '전환 재개 순서 혼란',
        '동결된 전환의 상태 손실',
        '위기 해결 후 개정안 유효성 변경 가능성',
      ],
      constitutionalConstraints: [
        '위기 시 모든 비위기 전환 동결',
        '동결 전환의 상태 무결성 보장',
        '위기 후 재개 시 헌법적 일관성 검증',
      ],
    },
    {
      type: MultiTransitionScenarioType.REGIONAL_DESYNC,
      description: '지역 간 비동기적 전환으로 헌법 적용의 일관성이 위협받는 상황',
      overlappingTransitions: [
        {
          transitionId: 'T-11D-LOCAL-A',
          type: TransitionType.JURISDICTION_CHANGE,
          startedAt: '2026-03-01T00:00:00Z',
          status: 'ACTIVE',
          involvedActors: ['regional-auth-A'],
          scope: 'LOCAL',
          jurisdiction: 'REGION-A',
        },
        {
          transitionId: 'T-11D-LOCAL-B',
          type: TransitionType.SCOPE_CHANGE,
          startedAt: '2026-03-03T00:00:00Z',
          status: 'ACTIVE',
          involvedActors: ['regional-auth-B'],
          scope: 'LOCAL',
          jurisdiction: 'REGION-B',
        },
        {
          transitionId: 'T-11D-GLOBAL',
          type: TransitionType.AMENDMENT,
          startedAt: '2026-03-05T00:00:00Z',
          status: 'ACTIVE',
          involvedActors: ['central-authority'],
          scope: 'GLOBAL',
        },
      ],
      preconditions: [
        '복수 지역이 각각 독립적으로 전환을 진행하고 있어야 한다',
        '글로벌 개정이 지역 전환과 동시에 발생해야 한다',
      ],
      expectedOutcome: '글로벌 헌법 개정이 지역 전환보다 우선하며, 지역은 글로벌에 정렬해야 한다',
      riskFactors: [
        '지역 간 헌법 해석 차이',
        '글로벌 개정과 지역 규정 충돌',
        '동기화 지연으로 인한 불일치 창',
      ],
      constitutionalConstraints: [
        '글로벌 헌법 조항이 지역 규정에 우선한다',
        '지역 규정 변경은 글로벌 헌법과 일치해야 한다',
      ],
    },
    {
      type: MultiTransitionScenarioType.ROLLBACK_DURING_TRANSITION,
      description: '진행 중인 전환에서 오류 발견으로 롤백이 필요한 상황',
      overlappingTransitions: [
        {
          transitionId: 'T-11E-AMEND',
          type: TransitionType.AMENDMENT,
          startedAt: '2026-03-01T00:00:00Z',
          status: 'ACTIVE',
          involvedActors: ['proposer-001', 'reviewer-001'],
          scope: 'GLOBAL',
        },
        {
          transitionId: 'T-11E-SCOPE',
          type: TransitionType.SCOPE_CHANGE,
          startedAt: '2026-03-02T00:00:00Z',
          status: 'ACTIVE',
          involvedActors: ['scope-authority-001'],
          scope: 'GLOBAL',
        },
      ],
      preconditions: [
        '두 전환이 동시에 진행 중이어야 한다',
        '하나의 전환에서 헌법 위반이 발견되어야 한다',
      ],
      expectedOutcome: '위반된 전환만 롤백되고, 다른 전환은 무결성 검증 후 계속 진행',
      riskFactors: [
        '롤백 범위 결정의 어려움',
        '전환 간 의존성으로 연쇄 롤백 가능성',
        '롤백 중 추가 전환 요청',
      ],
      constitutionalConstraints: [
        '롤백은 원자적이어야 한다 (부분 롤백 불가)',
        '연쇄 영향 분석 후 독립 전환만 계속 진행',
      ],
    },
    {
      type: MultiTransitionScenarioType.AUTHORITY_GAP_DETECTION,
      description: '다중 전환의 틈새에서 권한 공백이 발생하는 상황',
      overlappingTransitions: [
        {
          transitionId: 'T-11F-SUCC',
          type: TransitionType.SUCCESSION,
          startedAt: '2026-03-01T00:00:00Z',
          status: 'ACTIVE',
          involvedActors: ['predecessor-001', 'successor-001'],
          scope: 'GLOBAL',
        },
        {
          transitionId: 'T-11F-SUNSET',
          type: TransitionType.SUNSET,
          startedAt: '2026-03-01T00:00:00Z',
          status: 'ACTIVE',
          involvedActors: ['sunset-executor-001'],
          scope: 'LOCAL',
          jurisdiction: 'LEGACY-SYSTEM',
        },
      ],
      preconditions: [
        '승계와 일몰이 동시에 진행되어야 한다',
        '일몰 대상 시스템이 승계 대상자의 관할이어야 한다',
      ],
      expectedOutcome: '권한 공백이 감지되고, 임시 권한 위임으로 공백이 메워진다',
      riskFactors: [
        '권한 공백 기간 동안 무권한 행위 발생',
        '임시 위임의 범위 초과',
        '공백 감지 지연',
      ],
      constitutionalConstraints: [
        '어떤 시점에서도 권한 공백은 허용되지 않는다',
        '임시 위임은 최소 권한 원칙을 따라야 한다',
      ],
    },
    {
      type: MultiTransitionScenarioType.OBLIGATION_COLLISION,
      description: '다중 전환이 상충하는 의무를 동시에 부과하는 상황',
      overlappingTransitions: [
        {
          transitionId: 'T-11G-AMEND-1',
          type: TransitionType.AMENDMENT,
          startedAt: '2026-03-01T00:00:00Z',
          status: 'ACTIVE',
          involvedActors: ['proposer-001'],
          scope: 'GLOBAL',
        },
        {
          transitionId: 'T-11G-AMEND-2',
          type: TransitionType.AMENDMENT,
          startedAt: '2026-03-02T00:00:00Z',
          status: 'ACTIVE',
          involvedActors: ['proposer-002'],
          scope: 'GLOBAL',
        },
        {
          transitionId: 'T-11G-SCOPE',
          type: TransitionType.SCOPE_CHANGE,
          startedAt: '2026-03-03T00:00:00Z',
          status: 'ACTIVE',
          involvedActors: ['scope-authority-001'],
          scope: 'LOCAL',
          jurisdiction: 'REGION-C',
        },
      ],
      preconditions: [
        '복수 개정안이 동시에 진행 중이어야 한다',
        '개정안들이 상충하는 의무를 부과해야 한다',
      ],
      expectedOutcome: '충돌하는 의무가 감지되고, 헌법적 중요도 기준으로 우선순위가 결정된다',
      riskFactors: [
        '의무 충돌 미감지 위험',
        '우선순위 결정 기준 불명확',
        '충돌 해소 시 일부 의무 누락',
      ],
      constitutionalConstraints: [
        '상충하는 의무 동시 발효 금지',
        '의무 충돌 시 헌법적 중요도 기준 적용',
      ],
    },
    {
      type: MultiTransitionScenarioType.CONSTITUTIONAL_FORK,
      description: '다중 전환이 헌법의 서로 다른 버전을 참조하여 분기 위험이 생기는 상황',
      overlappingTransitions: [
        {
          transitionId: 'T-11H-AMEND',
          type: TransitionType.AMENDMENT,
          startedAt: '2026-03-01T00:00:00Z',
          status: 'ACTIVE',
          involvedActors: ['proposer-001'],
          scope: 'GLOBAL',
        },
        {
          transitionId: 'T-11H-JURIS',
          type: TransitionType.JURISDICTION_CHANGE,
          startedAt: '2026-03-02T00:00:00Z',
          status: 'ACTIVE',
          involvedActors: ['jurisdiction-authority-001'],
          scope: 'LOCAL',
          jurisdiction: 'REGION-D',
        },
        {
          transitionId: 'T-11H-REFOUND',
          type: TransitionType.REFOUNDATION,
          startedAt: '2026-03-04T00:00:00Z',
          status: 'ACTIVE',
          involvedActors: ['refoundation-council-001'],
          scope: 'GLOBAL',
        },
      ],
      preconditions: [
        '개정과 관할권 변경이 진행 중이어야 한다',
        '재건이 개시되어 모든 전환이 차단되어야 한다',
      ],
      expectedOutcome: '재건이 모든 전환을 차단하고, 헌법 분기가 방지된다',
      riskFactors: [
        '재건 개시 전 이미 부분 적용된 개정',
        '관할권 변경이 재건과 불일치',
        '헌법 버전 분기 감지 실패',
      ],
      constitutionalConstraints: [
        '재건은 모든 다른 전환을 즉시 차단한다',
        '헌법은 항상 단일 정본이어야 한다',
        '분기 감지 시 즉시 동결 및 통합',
      ],
    },
  ];
}

// ════════════════════════════════════════════════════════════════
// Part 2: 동시성 정책 매트릭스
// ════════════════════════════════════════════════════════════════

/** 동시성 정책 유형 */
export type ConcurrencyPolicy = 'SERIALIZE' | 'PARALLEL_ALLOWED' | 'CONDITIONAL';

/** 동시성 규칙 */
export interface ConcurrencyRule {
  /** 전환 A */
  transitionA: TransitionType;
  /** 전환 B */
  transitionB: TransitionType;
  /** 정책 */
  policy: ConcurrencyPolicy;
  /** 조건부 정책의 조건 */
  condition?: string;
  /** 우선 전환 */
  priorityWinner?: TransitionType;
  /** 근거 */
  rationale: string;
}

/**
 * 동시성 매트릭스를 구축한다.
 * 어떤 전환 쌍이 병렬 실행 가능한지, 직렬화해야 하는지 정의한다.
 */
export function buildConcurrencyMatrix(): ConcurrencyRule[] {
  return [
    {
      transitionA: TransitionType.SUCCESSION,
      transitionB: TransitionType.AMENDMENT,
      policy: 'SERIALIZE',
      priorityWinner: TransitionType.SUCCESSION,
      rationale: '승계 중 헌법 변경은 권한 이전 무결성을 해칠 수 있으므로 개정은 승계 완료 후 진행',
    },
    {
      transitionA: TransitionType.SUCCESSION,
      transitionB: TransitionType.CRISIS_RESPONSE,
      policy: 'CONDITIONAL',
      condition: '전임자가 위기 대응 권한을 유지하고, 승계는 동결',
      priorityWinner: TransitionType.CRISIS_RESPONSE,
      rationale: '위기 대응은 항상 최우선이며, 전임자가 위기 사령관 역할을 유지한다',
    },
    {
      transitionA: TransitionType.AMENDMENT,
      transitionB: TransitionType.CRISIS_RESPONSE,
      policy: 'SERIALIZE',
      priorityWinner: TransitionType.CRISIS_RESPONSE,
      rationale: '개정은 위기 해결 시까지 동결된다',
    },
    {
      transitionA: TransitionType.REFOUNDATION,
      transitionB: TransitionType.SUCCESSION,
      policy: 'SERIALIZE',
      priorityWinner: TransitionType.REFOUNDATION,
      rationale: '재건은 모든 다른 전환을 차단한다',
    },
    {
      transitionA: TransitionType.REFOUNDATION,
      transitionB: TransitionType.AMENDMENT,
      policy: 'SERIALIZE',
      priorityWinner: TransitionType.REFOUNDATION,
      rationale: '재건이 진행 중이면 개정은 무의미하다',
    },
    {
      transitionA: TransitionType.REFOUNDATION,
      transitionB: TransitionType.CRISIS_RESPONSE,
      policy: 'SERIALIZE',
      priorityWinner: TransitionType.REFOUNDATION,
      rationale: '재건은 시스템 전체를 재구성하므로 위기 대응도 재건 프로세스 내에서 처리',
    },
    {
      transitionA: TransitionType.REFOUNDATION,
      transitionB: TransitionType.SCOPE_CHANGE,
      policy: 'SERIALIZE',
      priorityWinner: TransitionType.REFOUNDATION,
      rationale: '재건 중 범위 변경은 차단된다',
    },
    {
      transitionA: TransitionType.REFOUNDATION,
      transitionB: TransitionType.JURISDICTION_CHANGE,
      policy: 'SERIALIZE',
      priorityWinner: TransitionType.REFOUNDATION,
      rationale: '재건 중 관할권 변경은 차단된다',
    },
    {
      transitionA: TransitionType.REFOUNDATION,
      transitionB: TransitionType.SUNSET,
      policy: 'SERIALIZE',
      priorityWinner: TransitionType.REFOUNDATION,
      rationale: '재건이 일몰을 포함할 수 있으므로 독립 일몰은 차단',
    },
    {
      transitionA: TransitionType.SCOPE_CHANGE,
      transitionB: TransitionType.JURISDICTION_CHANGE,
      policy: 'PARALLEL_ALLOWED',
      rationale: '범위 변경과 관할권 변경은 영향 범위가 다를 수 있어 병렬 가능',
    },
    {
      transitionA: TransitionType.SCOPE_CHANGE,
      transitionB: TransitionType.SUNSET,
      policy: 'CONDITIONAL',
      condition: '일몰 대상이 범위 변경 영역과 겹치지 않는 경우 병렬 허용',
      rationale: '범위 변경 대상과 일몰 대상이 겹치면 충돌 가능',
    },
    {
      transitionA: TransitionType.AMENDMENT,
      transitionB: TransitionType.SCOPE_CHANGE,
      policy: 'CONDITIONAL',
      condition: '개정 내용이 범위 변경과 무관한 조항인 경우 병렬 허용',
      rationale: '개정과 범위 변경이 같은 조항에 영향을 주면 충돌 위험',
    },
    {
      transitionA: TransitionType.SUCCESSION,
      transitionB: TransitionType.SUNSET,
      policy: 'CONDITIONAL',
      condition: '일몰 대상이 승계 대상자의 관할이 아닌 경우 병렬 허용',
      priorityWinner: TransitionType.SUCCESSION,
      rationale: '승계와 일몰이 같은 관할에 영향을 주면 권한 공백 위험',
    },
    {
      transitionA: TransitionType.CRISIS_RESPONSE,
      transitionB: TransitionType.SCOPE_CHANGE,
      policy: 'SERIALIZE',
      priorityWinner: TransitionType.CRISIS_RESPONSE,
      rationale: '위기 대응 중 범위 변경은 동결된다',
    },
    {
      transitionA: TransitionType.CRISIS_RESPONSE,
      transitionB: TransitionType.SUNSET,
      policy: 'SERIALIZE',
      priorityWinner: TransitionType.CRISIS_RESPONSE,
      rationale: '위기 대응 중 일몰은 동결된다',
    },
    {
      transitionA: TransitionType.CRISIS_RESPONSE,
      transitionB: TransitionType.JURISDICTION_CHANGE,
      policy: 'SERIALIZE',
      priorityWinner: TransitionType.CRISIS_RESPONSE,
      rationale: '위기 대응 중 관할권 변경은 동결된다',
    },
    {
      transitionA: TransitionType.SUCCESSION,
      transitionB: TransitionType.SCOPE_CHANGE,
      policy: 'CONDITIONAL',
      condition: '범위 변경이 승계 대상자의 관할이 아닌 경우 병렬 허용',
      priorityWinner: TransitionType.SUCCESSION,
      rationale: '승계 중 관련 범위 변경은 승계 완료 후 진행',
    },
    {
      transitionA: TransitionType.SUCCESSION,
      transitionB: TransitionType.JURISDICTION_CHANGE,
      policy: 'SERIALIZE',
      priorityWinner: TransitionType.SUCCESSION,
      rationale: '승계 중 관할권 변경은 권한 이전 복잡성을 증가시킨다',
    },
    {
      transitionA: TransitionType.AMENDMENT,
      transitionB: TransitionType.SUNSET,
      policy: 'PARALLEL_ALLOWED',
      rationale: '개정과 일몰은 일반적으로 영향 범위가 다르므로 병렬 가능',
    },
    {
      transitionA: TransitionType.AMENDMENT,
      transitionB: TransitionType.JURISDICTION_CHANGE,
      policy: 'CONDITIONAL',
      condition: '개정 내용이 관할권 변경 대상과 무관한 경우 병렬 허용',
      rationale: '개정이 관할권 규정에 영향을 주면 충돌 위험',
    },
    {
      transitionA: TransitionType.SUNSET,
      transitionB: TransitionType.JURISDICTION_CHANGE,
      policy: 'PARALLEL_ALLOWED',
      rationale: '일몰과 관할권 변경은 일반적으로 독립적으로 진행 가능',
    },
  ];
}

/**
 * 주어진 전환 쌍의 동시성 규칙을 조회한다.
 */
export function lookupConcurrencyRule(
  a: TransitionType,
  b: TransitionType,
  matrix: ConcurrencyRule[]
): ConcurrencyRule | undefined {
  return matrix.find(
    (r) =>
      (r.transitionA === a && r.transitionB === b) ||
      (r.transitionA === b && r.transitionB === a)
  );
}

// ════════════════════════════════════════════════════════════════
// Part 3: 헌법적 가시성 상태
// ════════════════════════════════════════════════════════════════

/** 헌법적 규칙 */
export interface ConstitutionalRule {
  /** 규칙 ID */
  ruleId: string;
  /** 규칙 내용 */
  content: string;
  /** 불변 여부 */
  immutable: boolean;
  /** 버전 */
  version: number;
}

/** 보류 중인 개정 */
export interface PendingAmendmentEntry {
  /** 개정 ID */
  amendmentId: string;
  /** 대상 규칙 ID */
  targetRuleId: string;
  /** 제안 내용 */
  proposedContent: string;
  /** 상태 */
  status: 'PENDING' | 'FROZEN' | 'APPLIED' | 'REJECTED';
  /** 출처 전환 ID */
  sourceTransitionId: string;
}

/** 헌법적 가시성 상태 */
export interface ConstitutionalVisibilityState {
  /** 현재 헌법 버전 */
  currentVersion: number;
  /** 보류 중인 개정 목록 */
  pendingAmendments: PendingAmendmentEntry[];
  /** 활성 전환 목록 */
  activeTransitions: OverlappingTransition[];
  /** 유효 규칙 (버전 + 보류 개정 반영) */
  effectiveRules: ConstitutionalRule[];
  /** 충돌 감지 결과 */
  conflicts: ConstitutionalConflict[];
}

/** 헌법적 충돌 */
export interface ConstitutionalConflict {
  /** 충돌 ID */
  conflictId: string;
  /** 충돌하는 규칙 ID */
  ruleId: string;
  /** 충돌하는 전환 A ID */
  transitionIdA: string;
  /** 충돌하는 전환 B ID */
  transitionIdB: string;
  /** 충돌 설명 */
  description: string;
  /** 해결 상태 */
  resolved: boolean;
}

/**
 * 유효 헌법을 해석한다.
 * 기본 헌법에 진행 중인 변경 사항을 병합하여 현재 유효한 규칙 집합을 결정한다.
 */
export function resolveEffectiveConstitution(
  baseRules: ConstitutionalRule[],
  pendingAmendments: PendingAmendmentEntry[],
  activeTransitions: OverlappingTransition[]
): ConstitutionalVisibilityState {
  const effectiveRules = baseRules.map((rule) => ({ ...rule }));
  const conflicts: ConstitutionalConflict[] = [];
  const appliedAmendments = pendingAmendments.filter((a) => a.status === 'APPLIED');

  // 적용된 개정 반영
  for (const amendment of appliedAmendments) {
    const targetIdx = effectiveRules.findIndex((r) => r.ruleId === amendment.targetRuleId);
    if (targetIdx >= 0) {
      const target = effectiveRules[targetIdx];
      if (target.immutable) {
        conflicts.push({
          conflictId: `CONFLICT-IMM-${amendment.amendmentId}`,
          ruleId: target.ruleId,
          transitionIdA: amendment.sourceTransitionId,
          transitionIdB: 'CORE',
          description: `불변 규칙 ${target.ruleId}에 대한 개정 시도`,
          resolved: false,
        });
      } else {
        effectiveRules[targetIdx] = {
          ...target,
          content: amendment.proposedContent,
          version: target.version + 1,
        };
      }
    }
  }

  // 동일 규칙에 대한 복수 보류 개정 충돌 감지
  const pendingOnly = pendingAmendments.filter((a) => a.status === 'PENDING');
  const ruleAmendmentMap = new Map<string, PendingAmendmentEntry[]>();
  for (const amendment of pendingOnly) {
    const existing = ruleAmendmentMap.get(amendment.targetRuleId);
    if (existing) {
      existing.push(amendment);
    } else {
      ruleAmendmentMap.set(amendment.targetRuleId, [amendment]);
    }
  }

  Array.from(ruleAmendmentMap.entries()).forEach(([ruleId, amendments]) => {
    if (amendments.length > 1) {
      for (let i = 0; i < amendments.length - 1; i++) {
        conflicts.push({
          conflictId: `CONFLICT-DUP-${ruleId}-${i}`,
          ruleId,
          transitionIdA: amendments[i].sourceTransitionId,
          transitionIdB: amendments[i + 1].sourceTransitionId,
          description: `규칙 ${ruleId}에 대해 ${amendments.length}개의 보류 개정이 충돌`,
          resolved: false,
        });
      }
    }
  });

  const maxVersion = effectiveRules.reduce((max, r) => Math.max(max, r.version), 0);

  return {
    currentVersion: maxVersion,
    pendingAmendments,
    activeTransitions,
    effectiveRules,
    conflicts,
  };
}

// ════════════════════════════════════════════════════════════════
// Part 4: 역할 충돌 감지
// ════════════════════════════════════════════════════════════════

/** 역할 충돌 심각도 */
export type RoleCollisionSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/** 역할 충돌 */
export interface RoleCollision {
  /** 액터 ID */
  actorId: string;
  /** 역할 A */
  roleA: string;
  /** 역할 B */
  roleB: string;
  /** 전환 출처 A */
  transitionSourceA: string;
  /** 전환 출처 B */
  transitionSourceB: string;
  /** 심각도 */
  severity: RoleCollisionSeverity;
  /** 해결 방법 */
  resolution: string;
}

/** 역할 충돌 해결 결과 */
export interface RoleCollisionResolution {
  /** 감지된 충돌 수 */
  totalCollisions: number;
  /** 충돌 목록 */
  collisions: RoleCollision[];
  /** 해결된 충돌 수 */
  resolvedCount: number;
  /** 에스컬레이션 필요 충돌 수 */
  escalatedCount: number;
}

/**
 * 다중 전환 중 역할 충돌을 감지한다.
 * 같은 액터가 서로 다른 전환에서 상충하는 역할을 보유할 때 감지한다.
 */
export function detectRoleCollisions(
  transitions: OverlappingTransition[]
): RoleCollisionResolution {
  const collisions: RoleCollision[] = [];
  const actorRoleMap = new Map<string, Array<{ role: string; transitionId: string; type: TransitionType }>>();

  // 각 전환에서 액터의 역할을 수집
  for (const transition of transitions) {
    for (const actorId of transition.involvedActors) {
      const role = inferRoleFromTransition(actorId, transition);
      const existing = actorRoleMap.get(actorId);
      if (existing) {
        existing.push({ role, transitionId: transition.transitionId, type: transition.type });
      } else {
        actorRoleMap.set(actorId, [{ role, transitionId: transition.transitionId, type: transition.type }]);
      }
    }
  }

  // 충돌 감지
  Array.from(actorRoleMap.entries()).forEach(([actorId, roles]) => {
    if (roles.length > 1) {
      for (let i = 0; i < roles.length; i++) {
        for (let j = i + 1; j < roles.length; j++) {
          const roleA = roles[i];
          const roleB = roles[j];
          if (roleA.role !== roleB.role) {
            const severity = evaluateCollisionSeverity(roleA.role, roleB.role);
            collisions.push({
              actorId,
              roleA: roleA.role,
              roleB: roleB.role,
              transitionSourceA: roleA.transitionId,
              transitionSourceB: roleB.transitionId,
              severity,
              resolution: severity === 'CRITICAL'
                ? '거버넌스 패널 에스컬레이션 필요'
                : '가장 제한적인 해석 적용',
            });
          }
        }
      }
    }
  });

  const escalatedCount = collisions.filter((c) => c.severity === 'CRITICAL').length;
  const resolvedCount = collisions.filter((c) => c.severity !== 'CRITICAL').length;

  return {
    totalCollisions: collisions.length,
    collisions,
    resolvedCount,
    escalatedCount,
  };
}

/** 전환에서 액터의 역할을 추론한다 */
function inferRoleFromTransition(actorId: string, transition: OverlappingTransition): string {
  if (actorId.startsWith('predecessor')) return 'PREDECESSOR';
  if (actorId.startsWith('successor')) return 'SUCCESSOR';
  if (actorId.startsWith('crisis-commander')) return 'CRISIS_COMMANDER';
  if (actorId.startsWith('proposer')) return 'AMENDMENT_PROPOSER';
  if (actorId.startsWith('reviewer')) return 'AMENDMENT_REVIEWER';
  if (actorId.startsWith('scope-authority')) return 'SCOPE_AUTHORITY';
  if (actorId.startsWith('sunset-executor')) return 'SUNSET_EXECUTOR';
  if (actorId.startsWith('regional-auth')) return 'REGIONAL_AUTHORITY';
  if (actorId.startsWith('jurisdiction-authority')) return 'JURISDICTION_AUTHORITY';
  if (actorId.startsWith('central-authority')) return 'CENTRAL_AUTHORITY';
  if (actorId.startsWith('refoundation-council')) return 'REFOUNDATION_COUNCIL';
  return `PARTICIPANT_IN_${transition.type}`;
}

/** 충돌 심각도를 평가한다 */
function evaluateCollisionSeverity(roleA: string, roleB: string): RoleCollisionSeverity {
  const criticalPairs: string[][] = [
    ['PREDECESSOR', 'CRISIS_COMMANDER'],
    ['SUCCESSOR', 'AMENDMENT_PROPOSER'],
    ['CRISIS_COMMANDER', 'AMENDMENT_PROPOSER'],
    ['PREDECESSOR', 'SUCCESSOR'],
  ];
  const pairKey = [roleA, roleB].sort();
  for (const pair of criticalPairs) {
    const sortedPair = [...pair].sort();
    if (pairKey[0] === sortedPair[0] && pairKey[1] === sortedPair[1]) {
      return 'CRITICAL';
    }
  }
  if (roleA.includes('AUTHORITY') || roleB.includes('AUTHORITY')) return 'HIGH';
  if (roleA.includes('EXECUTOR') || roleB.includes('EXECUTOR')) return 'MEDIUM';
  return 'LOW';
}

// ════════════════════════════════════════════════════════════════
// Part 5: 조정 순서 규칙
// ════════════════════════════════════════════════════════════════

/** 전환 우선순위 맵 (높을수록 우선) */
const TRANSITION_PRIORITY: Record<TransitionType, number> = {
  [TransitionType.REFOUNDATION]: 100,
  [TransitionType.CRISIS_RESPONSE]: 90,
  [TransitionType.SUCCESSION]: 80,
  [TransitionType.AMENDMENT]: 70,
  [TransitionType.SCOPE_CHANGE]: 60,
  [TransitionType.SUNSET]: 50,
  [TransitionType.JURISDICTION_CHANGE]: 40,
};

/** 전환 조정 순서 항목 */
export interface TransitionCoordinationEntry {
  /** 전환 ID */
  transitionId: string;
  /** 전환 유형 */
  type: TransitionType;
  /** 우선순위 */
  priority: number;
  /** 시작 시각 */
  startedAt: string;
  /** 실행 순서 */
  executionOrder: number;
  /** 차단 상태 */
  blocked: boolean;
  /** 차단 사유 */
  blockedBy?: string;
}

/** 전환 조정 순서 */
export interface TransitionCoordinationOrder {
  /** 정렬된 실행 계획 */
  orderedPlan: TransitionCoordinationEntry[];
  /** 우선순위 역전 횟수 */
  priorityInversions: number;
  /** 차단된 전환 수 */
  blockedCount: number;
}

/**
 * 활성 전환들의 실행 순서를 결정한다.
 * 우선순위: REFOUNDATION > CRISIS_RESPONSE > SUCCESSION > AMENDMENT > SCOPE_CHANGE > SUNSET > JURISDICTION_CHANGE
 * 동일 우선순위 내에서는 먼저 개시된 전환이 우선한다.
 */
export function resolveTransitionOrder(
  activeTransitions: OverlappingTransition[]
): TransitionCoordinationOrder {
  const sorted = [...activeTransitions].sort((a, b) => {
    const priorityDiff = TRANSITION_PRIORITY[b.type] - TRANSITION_PRIORITY[a.type];
    if (priorityDiff !== 0) return priorityDiff;
    return new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime();
  });

  const concurrencyMatrix = buildConcurrencyMatrix();
  const entries: TransitionCoordinationEntry[] = [];
  let priorityInversions = 0;
  let blockedCount = 0;

  for (let i = 0; i < sorted.length; i++) {
    const transition = sorted[i];
    let blocked = false;
    let blockedBy: string | undefined;

    // 상위 우선순위 전환과의 충돌 확인
    for (let j = 0; j < i; j++) {
      const higher = sorted[j];
      const rule = lookupConcurrencyRule(transition.type, higher.type, concurrencyMatrix);
      if (rule && rule.policy === 'SERIALIZE' && rule.priorityWinner !== transition.type) {
        blocked = true;
        blockedBy = higher.transitionId;
        blockedCount++;
        break;
      }
    }

    // REFOUNDATION이 있으면 나머지 모두 차단
    if (sorted.some((t) => t.type === TransitionType.REFOUNDATION) &&
        transition.type !== TransitionType.REFOUNDATION) {
      blocked = true;
      blockedBy = sorted.find((t) => t.type === TransitionType.REFOUNDATION)?.transitionId;
      if (!entries.some((e) => e.transitionId === transition.transitionId && e.blocked)) {
        blockedCount++;
      }
    }

    entries.push({
      transitionId: transition.transitionId,
      type: transition.type,
      priority: TRANSITION_PRIORITY[transition.type],
      startedAt: transition.startedAt,
      executionOrder: i + 1,
      blocked,
      blockedBy,
    });
  }

  // 우선순위 역전 탐지
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      if (entries[j].priority > entries[i].priority && !entries[j].blocked) {
        priorityInversions++;
      }
    }
  }

  return {
    orderedPlan: entries,
    priorityInversions,
    blockedCount,
  };
}

// ════════════════════════════════════════════════════════════════
// Part 6: 지역/글로벌 중재
// ════════════════════════════════════════════════════════════════

/** 중재 결과 유형 */
export type ArbitrationOutcome =
  | 'GLOBAL_WINS'
  | 'LOCAL_WINS'
  | 'COMPROMISE_REQUIRED'
  | 'ESCALATE_TO_GOVERNANCE';

/** 중재 정책 */
export interface ArbitrationPolicy {
  /** 중재 ID */
  arbitrationId: string;
  /** 지역 전환 */
  localTransition: OverlappingTransition;
  /** 글로벌 전환 */
  globalTransition: OverlappingTransition;
  /** 충돌 영역 */
  conflictArea: string;
  /** 중재 결과 */
  outcome: ArbitrationOutcome;
  /** 근거 */
  rationale: string;
}

/**
 * 지역 전환과 글로벌 전환의 충돌을 중재한다.
 * 헌법적 사안은 글로벌 우선, 규정 준수 사안은 지역 우선.
 */
export function arbitrateLocalGlobal(
  localTransition: OverlappingTransition,
  globalTransition: OverlappingTransition,
  conflictArea: string
): ArbitrationPolicy {
  const isConstitutionalMatter = conflictArea.includes('헌법') ||
    conflictArea.includes('constitutional') ||
    globalTransition.type === TransitionType.AMENDMENT ||
    globalTransition.type === TransitionType.REFOUNDATION;

  const isComplianceMatter = conflictArea.includes('규정') ||
    conflictArea.includes('compliance') ||
    conflictArea.includes('regulatory');

  let outcome: ArbitrationOutcome;
  let rationale: string;

  if (isConstitutionalMatter && isComplianceMatter) {
    outcome = 'COMPROMISE_REQUIRED';
    rationale = '헌법적 사안과 규정 준수 사안이 동시에 관련되어 타협안 필요';
  } else if (isConstitutionalMatter) {
    outcome = 'GLOBAL_WINS';
    rationale = '헌법적 사안은 글로벌 전환이 항상 우선한다';
  } else if (isComplianceMatter) {
    outcome = 'LOCAL_WINS';
    rationale = '규정 준수/규제 사안은 지역 전환이 우선한다';
  } else {
    outcome = 'ESCALATE_TO_GOVERNANCE';
    rationale = '헌법적 사안도 규정 준수 사안도 아닌 경우 거버넌스 패널 에스컬레이션';
  }

  return {
    arbitrationId: `ARB-${Date.now()}`,
    localTransition,
    globalTransition,
    conflictArea,
    outcome,
    rationale,
  };
}

// ════════════════════════════════════════════════════════════════
// Part 7: 의무 과적 감지
// ════════════════════════════════════════════════════════════════

/** 의무 과적 상태 */
export interface ObligationPileup {
  /** 총 활성 의무 수 */
  totalActiveObligations: number;
  /** 전환에서 신규 추가된 의무 수 */
  newFromTransitions: number;
  /** 용량 임계값 (기본 50) */
  capacityThreshold: number;
  /** 과적 위험 여부 */
  overloadRisk: boolean;
  /** 현재 부하율 (%) */
  loadPercentage: number;
  /** 과적 시 트리아지 결과 */
  triageResult?: ObligationTriageResult;
}

/** 트리아지된 의무 */
export interface TriagedObligation {
  /** 의무 ID */
  obligationId: string;
  /** 의무 내용 */
  content: string;
  /** 헌법적 중요도 (1-10) */
  constitutionalImportance: number;
  /** 트리아지 판정 */
  triageDecision: 'KEEP' | 'DEFER' | 'MERGE' | 'DROP';
  /** 출처 전환 ID */
  sourceTransitionId: string;
}

/** 의무 트리아지 결과 */
export interface ObligationTriageResult {
  /** 유지 의무 수 */
  keptCount: number;
  /** 연기 의무 수 */
  deferredCount: number;
  /** 병합 의무 수 */
  mergedCount: number;
  /** 삭제 의무 수 */
  droppedCount: number;
  /** 트리아지된 의무 목록 */
  obligations: TriagedObligation[];
}

/**
 * 의무 과적을 감지한다.
 * 다중 전환에서 누적된 의무가 용량을 초과하는지 확인한다.
 */
export function detectObligationPileup(
  existingObligations: number,
  transitions: OverlappingTransition[],
  capacityThreshold: number = 50
): ObligationPileup {
  // 각 전환 유형별 예상 의무 생성 수
  const obligationPerTransition: Record<TransitionType, number> = {
    [TransitionType.REFOUNDATION]: 20,
    [TransitionType.SUCCESSION]: 12,
    [TransitionType.CRISIS_RESPONSE]: 8,
    [TransitionType.AMENDMENT]: 5,
    [TransitionType.SCOPE_CHANGE]: 6,
    [TransitionType.JURISDICTION_CHANGE]: 7,
    [TransitionType.SUNSET]: 4,
  };

  const newFromTransitions = transitions.reduce(
    (sum, t) => sum + (obligationPerTransition[t.type] ?? 3),
    0
  );

  const totalActiveObligations = existingObligations + newFromTransitions;
  const loadPercentage = (totalActiveObligations / capacityThreshold) * 100;
  const overloadRisk = totalActiveObligations > capacityThreshold;

  const result: ObligationPileup = {
    totalActiveObligations,
    newFromTransitions,
    capacityThreshold,
    overloadRisk,
    loadPercentage,
  };

  if (overloadRisk) {
    result.triageResult = triageObligations(totalActiveObligations, transitions);
  }

  return result;
}

/**
 * 의무 트리아지를 수행한다.
 * 헌법적 중요도 기준으로 의무를 분류한다.
 */
export function triageObligations(
  totalObligations: number,
  transitions: OverlappingTransition[]
): ObligationTriageResult {
  const obligations: TriagedObligation[] = [];
  let seq = 0;

  for (const transition of transitions) {
    const count = getEstimatedObligationCount(transition.type);
    for (let i = 0; i < count; i++) {
      seq++;
      const importance = calculateConstitutionalImportance(transition.type, i);
      obligations.push({
        obligationId: `OBL-${transition.transitionId}-${seq}`,
        content: `${transition.type} 전환 관련 의무 #${i + 1}`,
        constitutionalImportance: importance,
        triageDecision: importance >= 8 ? 'KEEP' : importance >= 5 ? 'DEFER' : importance >= 3 ? 'MERGE' : 'DROP',
        sourceTransitionId: transition.transitionId,
      });
    }
  }

  return {
    keptCount: obligations.filter((o) => o.triageDecision === 'KEEP').length,
    deferredCount: obligations.filter((o) => o.triageDecision === 'DEFER').length,
    mergedCount: obligations.filter((o) => o.triageDecision === 'MERGE').length,
    droppedCount: obligations.filter((o) => o.triageDecision === 'DROP').length,
    obligations,
  };
}

/** 전환 유형별 예상 의무 수를 반환한다 */
function getEstimatedObligationCount(type: TransitionType): number {
  const counts: Record<TransitionType, number> = {
    [TransitionType.REFOUNDATION]: 5,
    [TransitionType.SUCCESSION]: 4,
    [TransitionType.CRISIS_RESPONSE]: 3,
    [TransitionType.AMENDMENT]: 2,
    [TransitionType.SCOPE_CHANGE]: 2,
    [TransitionType.JURISDICTION_CHANGE]: 2,
    [TransitionType.SUNSET]: 1,
  };
  return counts[type] ?? 1;
}

/** 헌법적 중요도를 계산한다 */
function calculateConstitutionalImportance(type: TransitionType, index: number): number {
  const baseImportance: Record<TransitionType, number> = {
    [TransitionType.REFOUNDATION]: 9,
    [TransitionType.CRISIS_RESPONSE]: 8,
    [TransitionType.SUCCESSION]: 7,
    [TransitionType.AMENDMENT]: 6,
    [TransitionType.SCOPE_CHANGE]: 5,
    [TransitionType.JURISDICTION_CHANGE]: 4,
    [TransitionType.SUNSET]: 3,
  };
  // 첫 번째 의무가 가장 중요, 이후 감소
  return Math.max(1, (baseImportance[type] ?? 5) - index);
}

// ════════════════════════════════════════════════════════════════
// Part 8: 위기 우선 프로토콜
// ════════════════════════════════════════════════════════════════

/** 위기 우선 정책 */
export interface CrisisPrecedencePolicy {
  /** 위기 ID */
  crisisTransitionId: string;
  /** 동결된 전환 목록 */
  frozenTransitions: string[];
  /** 위기 사령관 */
  crisisCommanderActorId: string;
  /** 위기 후 재개 대상 */
  postCrisisResumeTargets: string[];
  /** 위기로 인해 무효화된 전환 */
  invalidatedTransitions: string[];
  /** 정책 적용 시각 */
  appliedAt: string;
}

/** 위기 우선 적용 결과 */
export interface CrisisPrecedenceResult {
  /** 정책 */
  policy: CrisisPrecedencePolicy;
  /** 수정된 전환 목록 */
  modifiedTransitions: OverlappingTransition[];
  /** 무결성 검증 필요 전환 */
  integrityCheckRequired: string[];
}

/**
 * 위기 우선 프로토콜을 적용한다.
 * 위기 발생 시 모든 비위기 전환을 동결하고, 위기 사령관 권한을 설정한다.
 */
export function applyCrisisPrecedence(
  crisisTransition: OverlappingTransition,
  allTransitions: OverlappingTransition[]
): CrisisPrecedenceResult {
  const crisisCommander = crisisTransition.involvedActors[0] ?? 'unknown-commander';
  const frozenTransitions: string[] = [];
  const invalidatedTransitions: string[] = [];
  const postCrisisResumeTargets: string[] = [];
  const integrityCheckRequired: string[] = [];

  const modifiedTransitions = allTransitions.map((t) => {
    if (t.transitionId === crisisTransition.transitionId) {
      return { ...t, status: 'ACTIVE' as const };
    }

    // 재건은 위기 사령관에 의해 관리됨
    if (t.type === TransitionType.REFOUNDATION) {
      frozenTransitions.push(t.transitionId);
      integrityCheckRequired.push(t.transitionId);
      return { ...t, status: 'FROZEN' as const };
    }

    // 진행 중인 전환 중 위기와 충돌 가능한 것들 식별
    if (t.status === 'ACTIVE') {
      frozenTransitions.push(t.transitionId);
      postCrisisResumeTargets.push(t.transitionId);
      integrityCheckRequired.push(t.transitionId);

      // 위기가 특정 전환을 무효화할 수 있음 (시뮬레이션)
      if (t.type === TransitionType.SCOPE_CHANGE || t.type === TransitionType.JURISDICTION_CHANGE) {
        // 위기 상황에서 범위/관할권 변경은 무효화될 가능성이 높음
        const invalidationProbability = 0.3;
        if (deterministicRandom(t.transitionId) < invalidationProbability) {
          invalidatedTransitions.push(t.transitionId);
          return { ...t, status: 'ROLLED_BACK' as const };
        }
      }

      return { ...t, status: 'FROZEN' as const };
    }

    return { ...t };
  });

  const policy: CrisisPrecedencePolicy = {
    crisisTransitionId: crisisTransition.transitionId,
    frozenTransitions,
    crisisCommanderActorId: crisisCommander,
    postCrisisResumeTargets,
    invalidatedTransitions,
    appliedAt: new Date().toISOString(),
  };

  return {
    policy,
    modifiedTransitions,
    integrityCheckRequired,
  };
}

/** 결정론적 의사 난수 (테스트 재현성) */
function deterministicRandom(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 32bit int
  }
  return Math.abs(hash % 100) / 100;
}

// ════════════════════════════════════════════════════════════════
// Part 9: 다중 전환 스코어카드
// ════════════════════════════════════════════════════════════════

/** 다중 전환 평가 차원 */
export enum MultiTransitionDimension {
  /** 동시성 안전 */
  CONCURRENCY_SAFETY = 'CONCURRENCY_SAFETY',
  /** 헌법 일관성 */
  CONSTITUTIONAL_COHERENCE = 'CONSTITUTIONAL_COHERENCE',
  /** 역할 명확성 */
  ROLE_CLARITY = 'ROLE_CLARITY',
  /** 의무 관리 가능성 */
  OBLIGATION_MANAGEABILITY = 'OBLIGATION_MANAGEABILITY',
  /** 위기 대비 */
  CRISIS_READINESS = 'CRISIS_READINESS',
  /** 질서 보존 */
  ORDER_PRESERVATION = 'ORDER_PRESERVATION',
}

/** 차원 점수 */
export interface MultiTransitionDimensionScore {
  /** 차원 */
  dimension: MultiTransitionDimension;
  /** 점수 (0-100) */
  score: number;
  /** 가중치 */
  weight: number;
  /** 발견 사항 */
  findings: string[];
  /** 위험 수준 */
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

/** 스코어카드 판정 */
export type MultiTransitionVerdict =
  | 'ORDER_PRESERVED'
  | 'ORDER_STRAINED'
  | 'ORDER_AT_RISK';

/** 스코어카드 결정 */
export type MultiTransitionDecision =
  | 'SYSTEM_STABLE'
  | 'REQUIRES_TRANSITION_THROTTLING'
  | 'ESCALATE_TO_REFOUNDATION';

/** 다중 전환 스코어카드 */
export interface MultiTransitionScorecard {
  /** 차원별 점수 */
  dimensions: MultiTransitionDimensionScore[];
  /** 가중 평균 */
  weightedAverage: number;
  /** 판정 */
  verdict: MultiTransitionVerdict;
  /** 결정 */
  decision: MultiTransitionDecision;
  /** 생성 시각 */
  generatedAt: string;
}

/**
 * 다중 전환 스코어카드를 생성한다.
 */
export function generateMultiTransitionScorecard(params: {
  concurrencyMatrix: ConcurrencyRule[];
  visibilityState: ConstitutionalVisibilityState;
  roleCollisions: RoleCollisionResolution;
  obligationPileup: ObligationPileup;
  coordinationOrder: TransitionCoordinationOrder;
  crisisPrecedence?: CrisisPrecedenceResult;
}): MultiTransitionScorecard {
  const { concurrencyMatrix, visibilityState, roleCollisions, obligationPileup, coordinationOrder, crisisPrecedence } = params;

  const dimensions: MultiTransitionDimensionScore[] = [];

  // 1. 동시성 안전
  const parallelCount = concurrencyMatrix.filter((r) => r.policy === 'PARALLEL_ALLOWED').length;
  const serializeCount = concurrencyMatrix.filter((r) => r.policy === 'SERIALIZE').length;
  const concurrencyScore = Math.max(0, 100 - (coordinationOrder.priorityInversions * 20) - (coordinationOrder.blockedCount > 3 ? 20 : 0));
  dimensions.push({
    dimension: MultiTransitionDimension.CONCURRENCY_SAFETY,
    score: concurrencyScore,
    weight: 0.2,
    findings: [
      `병렬 허용 쌍: ${parallelCount}개`,
      `직렬화 쌍: ${serializeCount}개`,
      `우선순위 역전: ${coordinationOrder.priorityInversions}건`,
      `차단된 전환: ${coordinationOrder.blockedCount}개`,
    ],
    riskLevel: concurrencyScore >= 80 ? 'LOW' : concurrencyScore >= 60 ? 'MEDIUM' : concurrencyScore >= 40 ? 'HIGH' : 'CRITICAL',
  });

  // 2. 헌법 일관성
  const conflictCount = visibilityState.conflicts.length;
  const unresolvedConflicts = visibilityState.conflicts.filter((c) => !c.resolved).length;
  const coherenceScore = Math.max(0, 100 - (conflictCount * 15) - (unresolvedConflicts * 25));
  dimensions.push({
    dimension: MultiTransitionDimension.CONSTITUTIONAL_COHERENCE,
    score: coherenceScore,
    weight: 0.25,
    findings: [
      `유효 헌법 버전: ${visibilityState.currentVersion}`,
      `보류 개정: ${visibilityState.pendingAmendments.length}건`,
      `충돌 감지: ${conflictCount}건`,
      `미해결 충돌: ${unresolvedConflicts}건`,
    ],
    riskLevel: coherenceScore >= 80 ? 'LOW' : coherenceScore >= 60 ? 'MEDIUM' : coherenceScore >= 40 ? 'HIGH' : 'CRITICAL',
  });

  // 3. 역할 명확성
  const roleScore = Math.max(0, 100 - (roleCollisions.totalCollisions * 10) - (roleCollisions.escalatedCount * 25));
  dimensions.push({
    dimension: MultiTransitionDimension.ROLE_CLARITY,
    score: roleScore,
    weight: 0.15,
    findings: [
      `총 역할 충돌: ${roleCollisions.totalCollisions}건`,
      `해결된 충돌: ${roleCollisions.resolvedCount}건`,
      `에스컬레이션 필요: ${roleCollisions.escalatedCount}건`,
    ],
    riskLevel: roleScore >= 80 ? 'LOW' : roleScore >= 60 ? 'MEDIUM' : roleScore >= 40 ? 'HIGH' : 'CRITICAL',
  });

  // 4. 의무 관리 가능성
  const obligationScore = obligationPileup.overloadRisk
    ? Math.max(0, 100 - ((obligationPileup.loadPercentage - 100) * 2))
    : Math.min(100, 100 - (obligationPileup.loadPercentage - 50));
  dimensions.push({
    dimension: MultiTransitionDimension.OBLIGATION_MANAGEABILITY,
    score: Math.max(0, Math.min(100, obligationScore)),
    weight: 0.15,
    findings: [
      `총 활성 의무: ${obligationPileup.totalActiveObligations}개`,
      `전환 신규 의무: ${obligationPileup.newFromTransitions}개`,
      `부하율: ${obligationPileup.loadPercentage.toFixed(1)}%`,
      `과적 위험: ${obligationPileup.overloadRisk ? '예' : '아니오'}`,
    ],
    riskLevel: !obligationPileup.overloadRisk ? 'LOW' : obligationPileup.loadPercentage > 150 ? 'CRITICAL' : obligationPileup.loadPercentage > 120 ? 'HIGH' : 'MEDIUM',
  });

  // 5. 위기 대비
  const hasCrisis = crisisPrecedence !== undefined;
  const frozenCount = crisisPrecedence?.policy.frozenTransitions.length ?? 0;
  const invalidatedCount = crisisPrecedence?.policy.invalidatedTransitions.length ?? 0;
  const crisisScore = hasCrisis
    ? Math.max(0, 100 - (invalidatedCount * 15) - (frozenCount > 5 ? 10 : 0))
    : 85; // 위기 없으면 기본 양호
  dimensions.push({
    dimension: MultiTransitionDimension.CRISIS_READINESS,
    score: crisisScore,
    weight: 0.15,
    findings: [
      `위기 발생 여부: ${hasCrisis ? '예' : '아니오'}`,
      `동결된 전환: ${frozenCount}개`,
      `무효화된 전환: ${invalidatedCount}개`,
      `무결성 검증 필요: ${crisisPrecedence?.integrityCheckRequired.length ?? 0}개`,
    ],
    riskLevel: crisisScore >= 80 ? 'LOW' : crisisScore >= 60 ? 'MEDIUM' : crisisScore >= 40 ? 'HIGH' : 'CRITICAL',
  });

  // 6. 질서 보존
  const orderScore = Math.min(100, Math.round(
    (concurrencyScore * 0.3 + coherenceScore * 0.3 + roleScore * 0.2 + obligationScore * 0.1 + crisisScore * 0.1)
  ));
  dimensions.push({
    dimension: MultiTransitionDimension.ORDER_PRESERVATION,
    score: Math.max(0, Math.min(100, orderScore)),
    weight: 0.1,
    findings: [
      `동시성 안전: ${concurrencyScore}`,
      `헌법 일관성: ${coherenceScore}`,
      `역할 명확성: ${roleScore}`,
      `의무 관리: ${Math.round(obligationScore)}`,
      `위기 대비: ${crisisScore}`,
    ],
    riskLevel: orderScore >= 80 ? 'LOW' : orderScore >= 60 ? 'MEDIUM' : orderScore >= 40 ? 'HIGH' : 'CRITICAL',
  });

  // 가중 평균
  const weightedAverage = dimensions.reduce(
    (sum, d) => sum + d.score * d.weight,
    0
  );

  // 판정
  let verdict: MultiTransitionVerdict;
  if (weightedAverage >= 75) {
    verdict = 'ORDER_PRESERVED';
  } else if (weightedAverage >= 50) {
    verdict = 'ORDER_STRAINED';
  } else {
    verdict = 'ORDER_AT_RISK';
  }

  // 결정
  let decision: MultiTransitionDecision;
  if (verdict === 'ORDER_PRESERVED') {
    decision = 'SYSTEM_STABLE';
  } else if (verdict === 'ORDER_STRAINED') {
    decision = 'REQUIRES_TRANSITION_THROTTLING';
  } else {
    decision = 'ESCALATE_TO_REFOUNDATION';
  }

  return {
    dimensions,
    weightedAverage,
    verdict,
    decision,
    generatedAt: new Date().toISOString(),
  };
}

// ════════════════════════════════════════════════════════════════
// Part 10: 강화 백로그
// ════════════════════════════════════════════════════════════════

/** 백로그 우선순위 */
export type MultiTransitionBacklogPriority = 'P0' | 'P1' | 'P2' | 'P3';

/** 다중 전환 백로그 항목 */
export interface MultiTransitionBacklogItem {
  /** 항목 ID */
  id: string;
  /** 우선순위 */
  priority: MultiTransitionBacklogPriority;
  /** 제목 */
  title: string;
  /** 설명 */
  description: string;
  /** 출처 차원 */
  source: MultiTransitionDimension;
  /** 예상 노력 (시간) */
  estimatedEffort: number;
}

/**
 * 스코어카드 결과로부터 강화 백로그를 자동 생성한다.
 */
export function generateMultiTransitionBacklog(
  scorecard: MultiTransitionScorecard
): MultiTransitionBacklogItem[] {
  const items: MultiTransitionBacklogItem[] = [];
  let seq = 0;

  for (const dim of scorecard.dimensions) {
    if (dim.riskLevel === 'CRITICAL') {
      seq++;
      items.push({
        id: `MT-BL-P0-${seq}`,
        priority: 'P0',
        title: `[긴급] ${dim.dimension} 차원 위험 해소`,
        description: `${dim.dimension} 점수 ${dim.score}으로 CRITICAL 수준. 발견: ${dim.findings.join('; ')}`,
        source: dim.dimension,
        estimatedEffort: 40,
      });
    } else if (dim.riskLevel === 'HIGH') {
      seq++;
      items.push({
        id: `MT-BL-P1-${seq}`,
        priority: 'P1',
        title: `[높음] ${dim.dimension} 차원 개선`,
        description: `${dim.dimension} 점수 ${dim.score}으로 HIGH 수준. 발견: ${dim.findings.join('; ')}`,
        source: dim.dimension,
        estimatedEffort: 24,
      });
    } else if (dim.riskLevel === 'MEDIUM') {
      seq++;
      items.push({
        id: `MT-BL-P2-${seq}`,
        priority: 'P2',
        title: `[중간] ${dim.dimension} 차원 모니터링 강화`,
        description: `${dim.dimension} 점수 ${dim.score}으로 MEDIUM 수준. 발견: ${dim.findings.join('; ')}`,
        source: dim.dimension,
        estimatedEffort: 12,
      });
    } else if (dim.score < 95) {
      seq++;
      items.push({
        id: `MT-BL-P3-${seq}`,
        priority: 'P3',
        title: `[낮음] ${dim.dimension} 차원 최적화`,
        description: `${dim.dimension} 점수 ${dim.score}. 추가 최적화 여지 있음`,
        source: dim.dimension,
        estimatedEffort: 8,
      });
    }
  }

  return items;
}

// ════════════════════════════════════════════════════════════════
// Part 11: 전체 시뮬레이션 러너
// ════════════════════════════════════════════════════════════════

/** 타임라인 이벤트 */
export interface MultiTransitionTimelineEvent {
  /** 시각 */
  timestamp: string;
  /** 이벤트 유형 */
  eventType: string;
  /** 관련 전환 ID */
  transitionId: string;
  /** 설명 */
  description: string;
}

/** 시나리오 결과 */
export interface MultiTransitionScenarioResult {
  /** 시나리오 유형 */
  scenarioType: MultiTransitionScenarioType;
  /** 동시성 정책 적용 결과 */
  concurrencyApplied: boolean;
  /** 헌법적 가시성 상태 */
  visibilityState: ConstitutionalVisibilityState;
  /** 역할 충돌 결과 */
  roleCollisions: RoleCollisionResolution;
  /** 조정 순서 결과 */
  coordinationOrder: TransitionCoordinationOrder;
  /** 지역/글로벌 중재 결과 */
  arbitrationResults: ArbitrationPolicy[];
  /** 의무 과적 결과 */
  obligationPileup: ObligationPileup;
  /** 위기 우선 결과 */
  crisisPrecedence?: CrisisPrecedenceResult;
  /** 스코어카드 */
  scorecard: MultiTransitionScorecard;
  /** 백로그 */
  backlog: MultiTransitionBacklogItem[];
  /** 타임라인 */
  timeline: MultiTransitionTimelineEvent[];
}

/** 시뮬레이션 보고서 */
export interface MultiTransitionSimulationReport {
  /** 시뮬레이션 ID */
  simulationId: string;
  /** 시나리오 결과 목록 */
  scenarioResults: MultiTransitionScenarioResult[];
  /** 종합 스코어카드 */
  aggregateScorecard: MultiTransitionScorecard;
  /** 종합 결정 */
  decision: MultiTransitionDecision;
  /** 전체 백로그 */
  backlog: MultiTransitionBacklogItem[];
  /** 전체 타임라인 */
  timeline: MultiTransitionTimelineEvent[];
  /** 시뮬레이션 시작 시각 */
  startedAt: string;
  /** 시뮬레이션 완료 시각 */
  completedAt: string;
}

/**
 * 다중 전환 시뮬레이션을 실행한다.
 * 8개의 시나리오를 순차적으로 실행하고, 종합 보고서를 생성한다.
 */
export function runMultiTransitionSimulation(): MultiTransitionSimulationReport {
  const simulationId = `MT-SIM-${Date.now()}`;
  const startedAt = new Date().toISOString();
  const scenarios = getMultiTransitionScenarioCatalog();
  const concurrencyMatrix = buildConcurrencyMatrix();
  const scenarioResults: MultiTransitionScenarioResult[] = [];
  const allTimeline: MultiTransitionTimelineEvent[] = [];
  const allBacklog: MultiTransitionBacklogItem[] = [];

  for (const scenario of scenarios) {
    const timeline: MultiTransitionTimelineEvent[] = [];

    // Step 1: 겹치는 전환 초기화
    timeline.push({
      timestamp: new Date().toISOString(),
      eventType: 'INIT',
      transitionId: scenario.type,
      description: `시나리오 ${scenario.type} 초기화: ${scenario.overlappingTransitions.length}개 전환`,
    });

    // Step 2: 동시성 정책 적용
    let concurrencyApplied = false;
    for (let i = 0; i < scenario.overlappingTransitions.length; i++) {
      for (let j = i + 1; j < scenario.overlappingTransitions.length; j++) {
        const tA = scenario.overlappingTransitions[i];
        const tB = scenario.overlappingTransitions[j];
        const rule = lookupConcurrencyRule(tA.type, tB.type, concurrencyMatrix);
        if (rule) {
          concurrencyApplied = true;
          timeline.push({
            timestamp: new Date().toISOString(),
            eventType: 'CONCURRENCY_CHECK',
            transitionId: `${tA.transitionId}|${tB.transitionId}`,
            description: `${tA.type} + ${tB.type} → ${rule.policy}`,
          });
        }
      }
    }

    // Step 3: 헌법적 가시성 확인
    const baseRules = generateTestConstitutionalRules();
    const pendingAmendments = generateTestPendingAmendments(scenario);
    const visibilityState = resolveEffectiveConstitution(
      baseRules,
      pendingAmendments,
      scenario.overlappingTransitions
    );

    timeline.push({
      timestamp: new Date().toISOString(),
      eventType: 'VISIBILITY_CHECK',
      transitionId: scenario.type,
      description: `헌법적 가시성: 버전 ${visibilityState.currentVersion}, 충돌 ${visibilityState.conflicts.length}건`,
    });

    // Step 4: 역할 충돌 감지
    const roleCollisions = detectRoleCollisions(scenario.overlappingTransitions);

    timeline.push({
      timestamp: new Date().toISOString(),
      eventType: 'ROLE_CHECK',
      transitionId: scenario.type,
      description: `역할 충돌: ${roleCollisions.totalCollisions}건 (에스컬레이션: ${roleCollisions.escalatedCount}건)`,
    });

    // Step 5: 조정 순서 적용
    const coordinationOrder = resolveTransitionOrder(scenario.overlappingTransitions);

    timeline.push({
      timestamp: new Date().toISOString(),
      eventType: 'COORDINATION',
      transitionId: scenario.type,
      description: `조정 순서: ${coordinationOrder.orderedPlan.map((e) => `${e.type}(${e.executionOrder})`).join(', ')}`,
    });

    // Step 6: 지역/글로벌 중재
    const arbitrationResults: ArbitrationPolicy[] = [];
    const localTransitions = scenario.overlappingTransitions.filter((t) => t.scope === 'LOCAL');
    const globalTransitions = scenario.overlappingTransitions.filter((t) => t.scope === 'GLOBAL');

    for (const local of localTransitions) {
      for (const global of globalTransitions) {
        const arbitration = arbitrateLocalGlobal(local, global, '헌법적 규정 준수 사안');
        arbitrationResults.push(arbitration);

        timeline.push({
          timestamp: new Date().toISOString(),
          eventType: 'ARBITRATION',
          transitionId: `${local.transitionId}|${global.transitionId}`,
          description: `중재: ${local.type} vs ${global.type} → ${arbitration.outcome}`,
        });
      }
    }

    // Step 7: 의무 과적 감지
    const existingObligations = 20 + Math.floor(deterministicRandom(scenario.type) * 30);
    const obligationPileup = detectObligationPileup(existingObligations, scenario.overlappingTransitions);

    timeline.push({
      timestamp: new Date().toISOString(),
      eventType: 'OBLIGATION_CHECK',
      transitionId: scenario.type,
      description: `의무 부하: ${obligationPileup.loadPercentage.toFixed(1)}%, 과적: ${obligationPileup.overloadRisk ? '예' : '아니오'}`,
    });

    // Step 8: 위기 우선 처리 (해당하는 경우)
    let crisisPrecedence: CrisisPrecedenceResult | undefined;
    const crisisTransition = scenario.overlappingTransitions.find(
      (t) => t.type === TransitionType.CRISIS_RESPONSE
    );
    if (crisisTransition) {
      crisisPrecedence = applyCrisisPrecedence(crisisTransition, scenario.overlappingTransitions);

      timeline.push({
        timestamp: new Date().toISOString(),
        eventType: 'CRISIS_PRECEDENCE',
        transitionId: crisisTransition.transitionId,
        description: `위기 우선: 동결 ${crisisPrecedence.policy.frozenTransitions.length}건, 무효화 ${crisisPrecedence.policy.invalidatedTransitions.length}건`,
      });
    }

    // Step 9: 스코어카드 생성
    const scorecard = generateMultiTransitionScorecard({
      concurrencyMatrix,
      visibilityState,
      roleCollisions,
      obligationPileup,
      coordinationOrder,
      crisisPrecedence,
    });

    timeline.push({
      timestamp: new Date().toISOString(),
      eventType: 'SCORECARD',
      transitionId: scenario.type,
      description: `스코어: ${scorecard.weightedAverage.toFixed(1)}, 판정: ${scorecard.verdict}, 결정: ${scorecard.decision}`,
    });

    // Step 10: 백로그 생성
    const backlog = generateMultiTransitionBacklog(scorecard);

    timeline.push({
      timestamp: new Date().toISOString(),
      eventType: 'BACKLOG',
      transitionId: scenario.type,
      description: `백로그: ${backlog.length}건 (P0: ${backlog.filter((b) => b.priority === 'P0').length}, P1: ${backlog.filter((b) => b.priority === 'P1').length})`,
    });

    const result: MultiTransitionScenarioResult = {
      scenarioType: scenario.type,
      concurrencyApplied,
      visibilityState,
      roleCollisions,
      coordinationOrder,
      arbitrationResults,
      obligationPileup,
      crisisPrecedence,
      scorecard,
      backlog,
      timeline,
    };

    scenarioResults.push(result);
    allTimeline.push(...timeline);
    allBacklog.push(...backlog);
  }

  // 종합 스코어카드 생성
  const aggregateScorecard = computeAggregateScorecard(scenarioResults);

  const completedAt = new Date().toISOString();

  return {
    simulationId,
    scenarioResults,
    aggregateScorecard,
    decision: aggregateScorecard.decision,
    backlog: allBacklog,
    timeline: allTimeline,
    startedAt,
    completedAt,
  };
}

// ════════════════════════════════════════════════════════════════
// 내부 유틸리티 함수
// ════════════════════════════════════════════════════════════════

/** 종합 스코어카드를 산출한다 */
function computeAggregateScorecard(
  results: MultiTransitionScenarioResult[]
): MultiTransitionScorecard {
  const dimensionAverages = new Map<MultiTransitionDimension, { totalScore: number; count: number; weight: number; allFindings: string[]; worstRisk: string }>();

  for (const result of results) {
    for (const dim of result.scorecard.dimensions) {
      const existing = dimensionAverages.get(dim.dimension);
      if (existing) {
        existing.totalScore += dim.score;
        existing.count++;
        existing.allFindings.push(...dim.findings);
        if (riskSeverity(dim.riskLevel) > riskSeverity(existing.worstRisk)) {
          existing.worstRisk = dim.riskLevel;
        }
      } else {
        dimensionAverages.set(dim.dimension, {
          totalScore: dim.score,
          count: 1,
          weight: dim.weight,
          allFindings: [...dim.findings],
          worstRisk: dim.riskLevel,
        });
      }
    }
  }

  const dimensions: MultiTransitionDimensionScore[] = [];
  Array.from(dimensionAverages.entries()).forEach(([dimension, agg]) => {
    const avgScore = agg.totalScore / agg.count;
    dimensions.push({
      dimension,
      score: Math.round(avgScore),
      weight: agg.weight,
      findings: [`평균 점수: ${avgScore.toFixed(1)} (${agg.count}개 시나리오)`, `최악 위험 수준: ${agg.worstRisk}`],
      riskLevel: agg.worstRisk as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    });
  });

  const weightedAverage = dimensions.reduce((sum, d) => sum + d.score * d.weight, 0);

  let verdict: MultiTransitionVerdict;
  if (weightedAverage >= 75) {
    verdict = 'ORDER_PRESERVED';
  } else if (weightedAverage >= 50) {
    verdict = 'ORDER_STRAINED';
  } else {
    verdict = 'ORDER_AT_RISK';
  }

  let decision: MultiTransitionDecision;
  if (verdict === 'ORDER_PRESERVED') {
    decision = 'SYSTEM_STABLE';
  } else if (verdict === 'ORDER_STRAINED') {
    decision = 'REQUIRES_TRANSITION_THROTTLING';
  } else {
    decision = 'ESCALATE_TO_REFOUNDATION';
  }

  return {
    dimensions,
    weightedAverage,
    verdict,
    decision,
    generatedAt: new Date().toISOString(),
  };
}

/** 위험 수준 심각도 수치화 */
function riskSeverity(level: string): number {
  switch (level) {
    case 'LOW': return 0;
    case 'MEDIUM': return 1;
    case 'HIGH': return 2;
    case 'CRITICAL': return 3;
    default: return 0;
  }
}

/** 테스트용 헌법적 규칙을 생성한다 */
function generateTestConstitutionalRules(): ConstitutionalRule[] {
  return [
    { ruleId: 'CR-001', content: '승인 계보 추적 의무', immutable: true, version: 1 },
    { ruleId: 'CR-002', content: '롤백 무결성 보장', immutable: true, version: 1 },
    { ruleId: 'CR-003', content: 'False-safe 격리 원칙', immutable: true, version: 1 },
    { ruleId: 'CR-004', content: '개정 프로토콜 절차', immutable: false, version: 3 },
    { ruleId: 'CR-005', content: '갱신 주기 규정', immutable: false, version: 2 },
    { ruleId: 'CR-006', content: '의무 이행 기한', immutable: false, version: 2 },
    { ruleId: 'CR-007', content: '위기 대응 프로토콜', immutable: false, version: 4 },
    { ruleId: 'CR-008', content: '승계 절차 규정', immutable: false, version: 1 },
    { ruleId: 'CR-009', content: '지역 규정 준수 요건', immutable: false, version: 2 },
    { ruleId: 'CR-010', content: '감사 및 보고 의무', immutable: false, version: 3 },
  ];
}

/** 시나리오별 테스트용 보류 개정을 생성한다 */
function generateTestPendingAmendments(scenario: MultiTransitionScenario): PendingAmendmentEntry[] {
  const amendments: PendingAmendmentEntry[] = [];

  const amendmentTransitions = scenario.overlappingTransitions.filter(
    (t) => t.type === TransitionType.AMENDMENT
  );

  for (const transition of amendmentTransitions) {
    amendments.push({
      amendmentId: `AMEND-${transition.transitionId}`,
      targetRuleId: 'CR-004',
      proposedContent: `개정된 개정 프로토콜 (${transition.transitionId} 기반)`,
      status: 'PENDING',
      sourceTransitionId: transition.transitionId,
    });
  }

  // 다중 개정이 같은 규칙을 수정하는 경우 추가 (충돌 시뮬레이션)
  if (scenario.type === MultiTransitionScenarioType.OBLIGATION_COLLISION) {
    amendments.push({
      amendmentId: `AMEND-COLLISION-1`,
      targetRuleId: 'CR-006',
      proposedContent: '의무 이행 기한을 30일로 단축',
      status: 'PENDING',
      sourceTransitionId: scenario.overlappingTransitions[0]?.transitionId ?? 'unknown',
    });
    amendments.push({
      amendmentId: `AMEND-COLLISION-2`,
      targetRuleId: 'CR-006',
      proposedContent: '의무 이행 기한을 90일로 연장',
      status: 'PENDING',
      sourceTransitionId: scenario.overlappingTransitions[1]?.transitionId ?? 'unknown',
    });
  }

  // 헌법 분기 시나리오: 불변 규칙 개정 시도
  if (scenario.type === MultiTransitionScenarioType.CONSTITUTIONAL_FORK) {
    amendments.push({
      amendmentId: `AMEND-FORK-IMMUTABLE`,
      targetRuleId: 'CR-001',
      proposedContent: '승인 계보 추적 의무 완화 (위반 시도)',
      status: 'APPLIED',
      sourceTransitionId: scenario.overlappingTransitions[0]?.transitionId ?? 'unknown',
    });
  }

  return amendments;
}
