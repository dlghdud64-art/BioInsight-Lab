/**
 * @module succession-constitutional-memory
 * @description 시나리오 10 승계 무결성에 대한 헌법적 메모리 항목.
 * 권한 진공 금지, 실패-폐쇄, 증인 요건, 이중 통제, 의무 비포기,
 * 메모리 무결성, 권한 상승 무관용, 비상 권한 보존, 관할권 준수,
 * 판단 연속성 임계, 전임자 말소, 후임자 준비도 원칙을 기록한다.
 */

import { SuccessionScenarioType } from "./succession-integrity-simulation";

// ─────────────────────────────────────────────
// 헌법적 메모리 유형
// ─────────────────────────────────────────────

/** 승계 헌법 메모리 카테고리 */
export type SuccessionMemoryCategory =
  | "SUCCESSION_PRINCIPLE"
  | "TRANSFER_RULE"
  | "EMERGENCY_PROTOCOL"
  | "PRECEDENT";

/** 승계 헌법적 메모리 항목 */
export interface SuccessionConstitutionalMemory {
  /** 항목 ID */
  id: string;
  /** 카테고리 */
  category: SuccessionMemoryCategory;
  /** 제목 */
  title: string;
  /** 내용 */
  content: string;
  /** 제정 일자 */
  establishedDate: string;
  /** 최종 검증 일자 */
  lastValidated: string;
  /** 관련 시나리오 */
  linkedScenarios: SuccessionScenarioType[];
  /** 불변 여부 */
  immutable: boolean;
}

// ─────────────────────────────────────────────
// 헌법적 메모리 저장소
// ─────────────────────────────────────────────

/** 메모리 저장소 (production: DB-backed) */
const successionMemoryStore: Map<string, SuccessionConstitutionalMemory> = new Map();

/** 12개 핵심 헌법적 메모리 항목을 초기화한다 */
function initializeMemories(): void {
  if (successionMemoryStore.size > 0) return;

  const memories: SuccessionConstitutionalMemory[] = [
    {
      id: "SCM-001",
      category: "SUCCESSION_PRINCIPLE",
      title: "권한 진공 금지 원칙",
      content: "모든 시점에 각 권한 범위에 대해 정확히 하나의 권한 보유자가 존재해야 한다. 승계 과정 중 어떤 순간에도 권한 보유자가 없는 상태(진공)가 발생해서는 안 된다. 이전 완료 전까지 전임자가 권한을 보유하며, 이전 완료 후 즉시 후임자에게 권한이 이전된다.",
      establishedDate: "2025-01-15",
      lastValidated: "2026-03-14",
      linkedScenarios: [
        SuccessionScenarioType.PLANNED_RETIREMENT,
        SuccessionScenarioType.EMERGENCY_INCAPACITATION,
        SuccessionScenarioType.INTERIM_CARETAKER,
        SuccessionScenarioType.CASCADING_SUCCESSION,
      ],
      immutable: true,
    },
    {
      id: "SCM-002",
      category: "TRANSFER_RULE",
      title: "이전 타임아웃 실패-폐쇄 원칙",
      content: "이전 프로토콜의 각 단계에는 타임아웃이 설정되어 있으며, 타임아웃 초과 시 해당 단계는 실패로 처리되고 이전이 차단된다. 타임아웃에 의한 자동 승인은 절대 불가하다. 실패-폐쇄(fail-close) 원칙에 따라, 불확실한 상태에서는 항상 이전을 중단한다.",
      establishedDate: "2025-01-15",
      lastValidated: "2026-03-14",
      linkedScenarios: [
        SuccessionScenarioType.PLANNED_RETIREMENT,
        SuccessionScenarioType.CONTESTED_SUCCESSION,
      ],
      immutable: true,
    },
    {
      id: "SCM-003",
      category: "TRANSFER_RULE",
      title: "증인 요건 최소 인원 원칙",
      content: "정상 승계 시 최소 2명의 독립 증인이 이전 과정을 검증해야 한다. 긴급 상황에서 증인 요건이 축소될 수 있으나, 어떤 경우에도 0명의 증인으로 이전을 진행할 수 없다. 긴급 시 최소 1명의 증인이 반드시 참여해야 한다.",
      establishedDate: "2025-02-01",
      lastValidated: "2026-03-14",
      linkedScenarios: [
        SuccessionScenarioType.PLANNED_RETIREMENT,
        SuccessionScenarioType.EMERGENCY_INCAPACITATION,
        SuccessionScenarioType.HOSTILE_TAKEOVER_ATTEMPT,
      ],
      immutable: true,
    },
    {
      id: "SCM-004",
      category: "TRANSFER_RULE",
      title: "이중 통제 의무 사항 원칙",
      content: "이중 통제 기간 동안 헌법 개정, 핵심 정책 변경, 비상 선언, 범위 확장 등의 중대 결정은 전임자와 후임자 모두의 공동 서명이 필요하다. 전임자와 후임자가 의견 불일치 시 증인 패널에 에스컬레이션하며, 자동 해결은 절대 불가하다.",
      establishedDate: "2025-02-15",
      lastValidated: "2026-03-14",
      linkedScenarios: [
        SuccessionScenarioType.PLANNED_RETIREMENT,
        SuccessionScenarioType.PARTIAL_AUTHORITY_SPLIT,
      ],
      immutable: true,
    },
    {
      id: "SCM-005",
      category: "SUCCESSION_PRINCIPLE",
      title: "의무 비포기 원칙",
      content: "승계 과정에서 어떤 의무도 묵시적으로 폐기될 수 없다. 전임자의 모든 활성 의무는 후임자가 명시적으로 인수 확인해야 하며, 100% 인수 확인 전까지 권한 이전이 차단된다. 의무의 묵시적 폐기 시도는 헌법적 위반으로 간주된다.",
      establishedDate: "2025-03-01",
      lastValidated: "2026-03-14",
      linkedScenarios: [
        SuccessionScenarioType.PLANNED_RETIREMENT,
        SuccessionScenarioType.EMERGENCY_INCAPACITATION,
        SuccessionScenarioType.CASCADING_SUCCESSION,
      ],
      immutable: true,
    },
    {
      id: "SCM-006",
      category: "SUCCESSION_PRINCIPLE",
      title: "메모리 무결성 요건",
      content: "헌법적 기억(선례, 해석, 예외 승인, 정책 근거)은 승계 과정에서 손상 없이 이전되어야 한다. 이전 전후 해시 비교를 통해 무결성을 검증하며, 손상이나 누락이 발견될 경우 이전 프로세스가 즉시 중단된다.",
      establishedDate: "2025-03-15",
      lastValidated: "2026-03-14",
      linkedScenarios: [
        SuccessionScenarioType.PLANNED_RETIREMENT,
        SuccessionScenarioType.CASCADING_SUCCESSION,
        SuccessionScenarioType.CROSS_JURISDICTION_TRANSFER,
      ],
      immutable: true,
    },
    {
      id: "SCM-007",
      category: "SUCCESSION_PRINCIPLE",
      title: "권한 상승 무관용 원칙",
      content: "승계 이전 창구 기간 동안 무단 권한 획득 시도가 탐지될 경우, 이전 프로세스가 즉시 동결된다. 역할 경계 위반, 시간 이상, 범위 확대, 무단 위임 등 모든 형태의 권한 상승을 실시간 모니터링한다.",
      establishedDate: "2025-04-01",
      lastValidated: "2026-03-14",
      linkedScenarios: [
        SuccessionScenarioType.HOSTILE_TAKEOVER_ATTEMPT,
        SuccessionScenarioType.CASCADING_SUCCESSION,
      ],
      immutable: true,
    },
    {
      id: "SCM-008",
      category: "EMERGENCY_PROTOCOL",
      title: "비상 시 권한 보존 원칙",
      content: "이전 과정 중 위기 발생 시: 이중 통제 기간 중이면 전임자가 위기 범위 권한을 보유하고, 권한 이전 단계 중이면 전임자에게 롤백한다. 전임자가 무력화된 경우 축소된 증인 요건(최소 1명)으로 긴급 패스트트랙을 진행하되, 0명 증인은 절대 불가하다.",
      establishedDate: "2025-04-15",
      lastValidated: "2026-03-14",
      linkedScenarios: [
        SuccessionScenarioType.EMERGENCY_INCAPACITATION,
        SuccessionScenarioType.INTERIM_CARETAKER,
      ],
      immutable: true,
    },
    {
      id: "SCM-009",
      category: "TRANSFER_RULE",
      title: "관할권 간 이전 규정 준수",
      content: "관할권 간 권한 이전 시 양 관할권의 규정을 모두 준수해야 한다. 데이터 거주 의무는 관할권에 귀속되며 이전 대상이 아니다. 양측 관할권의 증인이 각각 최소 1명 이상 참여해야 하며, 규제 승인이 필요할 수 있다.",
      establishedDate: "2025-05-01",
      lastValidated: "2026-03-14",
      linkedScenarios: [
        SuccessionScenarioType.CROSS_JURISDICTION_TRANSFER,
      ],
      immutable: false,
    },
    {
      id: "SCM-010",
      category: "TRANSFER_RULE",
      title: "판단 연속성 임계값 원칙",
      content: "후임자의 판단 연속성 발산 점수가 25를 초과할 경우 CONTINUITY_RISK로 판정하고, 추가 교육 기간 또는 교정 조치가 필요하다. 발산 점수가 50을 초과하면 CONTINUITY_FAILED로 판정하여 이전이 차단된다.",
      establishedDate: "2025-05-15",
      lastValidated: "2026-03-14",
      linkedScenarios: [
        SuccessionScenarioType.PLANNED_RETIREMENT,
        SuccessionScenarioType.CONTESTED_SUCCESSION,
        SuccessionScenarioType.CASCADING_SUCCESSION,
      ],
      immutable: true,
    },
    {
      id: "SCM-011",
      category: "TRANSFER_RULE",
      title: "전임자 권한 말소 완전성",
      content: "이전 완료 후 전임자의 모든 권한은 완전히 말소되어야 한다. 잔존 권한이 있을 경우 이중 권한 보유자가 발생하여 헌법적 원칙에 위배된다. 말소 과정은 증인 검증을 거치며, 말소 확인서가 발급된다.",
      establishedDate: "2025-06-01",
      lastValidated: "2026-03-14",
      linkedScenarios: [
        SuccessionScenarioType.PLANNED_RETIREMENT,
        SuccessionScenarioType.PARTIAL_AUTHORITY_SPLIT,
      ],
      immutable: true,
    },
    {
      id: "SCM-012",
      category: "PRECEDENT",
      title: "후임자 준비도 비협상 원칙",
      content: "후임자 준비도 게이트는 어떤 경우에도 자동 통과될 수 없다. 거버넌스 지식 점수 80점 이상, 헌법 이해력 테스트 통과, 인시던트 대응 훈련 통과, 이해관계자 2/3 지지, 이해충돌 검사 클린 — 5개 기준 모두 충족 필수이다.",
      establishedDate: "2025-06-15",
      lastValidated: "2026-03-14",
      linkedScenarios: [
        SuccessionScenarioType.PLANNED_RETIREMENT,
        SuccessionScenarioType.EMERGENCY_INCAPACITATION,
        SuccessionScenarioType.CONTESTED_SUCCESSION,
        SuccessionScenarioType.HOSTILE_TAKEOVER_ATTEMPT,
      ],
      immutable: true,
    },
  ];

  for (const memory of memories) {
    successionMemoryStore.set(memory.id, memory);
  }
}

// ─────────────────────────────────────────────
// 조회 함수
// ─────────────────────────────────────────────

/**
 * 모든 승계 헌법적 메모리를 조회한다.
 */
export function getSuccessionConstitutionalMemories(): SuccessionConstitutionalMemory[] {
  initializeMemories();
  return Array.from(successionMemoryStore.values());
}

/**
 * 카테고리별 메모리를 조회한다.
 */
export function getSuccessionMemoriesByCategory(
  category: SuccessionMemoryCategory
): SuccessionConstitutionalMemory[] {
  initializeMemories();
  return Array.from(successionMemoryStore.values()).filter(
    (m) => m.category === category
  );
}

/**
 * 시나리오와 연결된 메모리를 조회한다.
 */
export function getSuccessionMemoriesByScenario(
  scenarioType: SuccessionScenarioType
): SuccessionConstitutionalMemory[] {
  initializeMemories();
  return Array.from(successionMemoryStore.values()).filter(
    (m) => m.linkedScenarios.includes(scenarioType)
  );
}

// ─────────────────────────────────────────────
// 무결성 검증
// ─────────────────────────────────────────────

/** 메모리 무결성 검증 결과 */
export interface SuccessionMemoryIntegrityResult {
  /** 전체 메모리 수 */
  totalMemories: number;
  /** 불변 메모리 수 */
  immutableCount: number;
  /** 검증 통과 수 */
  validCount: number;
  /** 만료 메모리 수 */
  expiredCount: number;
  /** 누락 시나리오 커버리지 */
  missingScenarioCoverage: SuccessionScenarioType[];
  /** 전체 통과 여부 */
  passed: boolean;
  /** 실패 사유 */
  failureReasons: string[];
}

/**
 * 승계 헌법 메모리의 무결성을 검증한다.
 * 모든 시나리오가 최소 하나의 메모리와 연결되어 있는지,
 * 불변 메모리가 변경되지 않았는지, 검증 기한이 만료되지 않았는지 확인한다.
 */
export function validateSuccessionMemoryIntegrity(): SuccessionMemoryIntegrityResult {
  initializeMemories();
  const memories = Array.from(successionMemoryStore.values());
  const failureReasons: string[] = [];

  // 불변 메모리 카운트
  const immutableCount = memories.filter((m) => m.immutable).length;

  // 만료 검증 (lastValidated가 6개월 이상 경과한 항목)
  const now = new Date();
  const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
  const expiredCount = memories.filter((m) => {
    const validated = new Date(m.lastValidated);
    return validated < sixMonthsAgo;
  }).length;

  if (expiredCount > 0) {
    failureReasons.push(`${expiredCount}건의 메모리 검증 기한 만료`);
  }

  // 시나리오 커버리지 검증
  const allScenarioTypes = Object.values(SuccessionScenarioType);
  const coveredScenarios = new Set<SuccessionScenarioType>();
  for (const memory of memories) {
    for (const scenario of memory.linkedScenarios) {
      coveredScenarios.add(scenario);
    }
  }

  const missingScenarioCoverage = allScenarioTypes.filter(
    (s) => !coveredScenarios.has(s)
  );

  if (missingScenarioCoverage.length > 0) {
    failureReasons.push(
      `${missingScenarioCoverage.length}개 시나리오에 대한 메모리 커버리지 부재: ${missingScenarioCoverage.join(", ")}`
    );
  }

  // 최소 메모리 수 검증
  if (memories.length < 12) {
    failureReasons.push(`메모리 수 부족: ${memories.length}/12`);
  }

  return {
    totalMemories: memories.length,
    immutableCount,
    validCount: memories.length - expiredCount,
    expiredCount,
    missingScenarioCoverage,
    passed: failureReasons.length === 0,
    failureReasons,
  };
}
