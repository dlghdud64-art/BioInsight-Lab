/**
 * @module constitutional-closure-engine
 * @description 헌법적 종결 엔진 — 시스템의 헌법적 종결 준비 상태를 스캔하고,
 * 미해결 모호성, 사용되지 않는 경로, 중복 패턴을 식별한다.
 * 모든 모호성이 해결되어야만 CONSTITUTIONALLY_CLOSED 상태에 도달할 수 있다.
 */

/** 종결 상태 */
export type ClosureStatus =
  | "NOT_READY_FOR_CLOSURE"
  | "CLOSURE_IN_PROGRESS"
  | "CONSTITUTIONALLY_CLOSED";

/** 종결 점검 항목 */
export interface ClosureCheck {
  /** 점검 고유 ID */
  id: string;
  /** 점검 카테고리 */
  category: string;
  /** 점검 설명 */
  description: string;
  /** 통과 여부 */
  passed: boolean;
  /** 차단 사유 (미통과 시) */
  blocker: string | null;
}

/** 미해결 모호성 */
export interface UnresolvedAmbiguity {
  /** 모호성 고유 ID */
  id: string;
  /** 관련 영역 */
  area: string;
  /** 설명 */
  description: string;
  /** 등록 일시 */
  registeredAt: Date;
  /** 해결 여부 */
  resolved: boolean;
  /** 해결 일시 */
  resolvedAt: Date | null;
}

/** 사용되지 않는 경로 */
export interface StalePathway {
  /** 경로 ID */
  id: string;
  /** 경로 설명 */
  description: string;
  /** 마지막 사용 일시 */
  lastUsedAt: Date | null;
  /** 제거 여부 */
  removed: boolean;
}

/** 중복 패턴 */
export interface DuplicatePattern {
  /** 패턴 ID */
  id: string;
  /** 원본 참조 */
  originalRef: string;
  /** 중복 참조 */
  duplicateRef: string;
  /** 설명 */
  description: string;
}

/** 종결 보고서 */
export interface ClosureReport {
  /** 현재 종결 상태 */
  status: ClosureStatus;
  /** 점검 항목 목록 */
  checks: ClosureCheck[];
  /** 미해결 모호성 목록 */
  unresolvedAmbiguities: UnresolvedAmbiguity[];
  /** 사용되지 않는 경로 목록 */
  stalePathways: StalePathway[];
  /** 중복 패턴 목록 */
  duplicatePatterns: DuplicatePattern[];
}

/** 인메모리 저장소 */
const ambiguities: UnresolvedAmbiguity[] = [];
const stalePathways: StalePathway[] = [];
const duplicatePatterns: DuplicatePattern[] = [];

/**
 * 종결을 위한 전체 스캔을 수행한다.
 * @param externalChecks - 외부에서 주입하는 추가 점검 항목 (선택)
 * @returns 종결 보고서
 */
export function scanForClosure(externalChecks?: ClosureCheck[]): ClosureReport {
  const checks: ClosureCheck[] = externalChecks ?? getDefaultChecks();
  const unresolved = ambiguities.filter((a) => !a.resolved);
  const activeStale = stalePathways.filter((s) => !s.removed);

  let status: ClosureStatus;
  const allChecksPassed = checks.every((c) => c.passed);

  if (allChecksPassed && unresolved.length === 0 && activeStale.length === 0) {
    status = "CONSTITUTIONALLY_CLOSED";
  } else if (checks.some((c) => c.passed)) {
    status = "CLOSURE_IN_PROGRESS";
  } else {
    status = "NOT_READY_FOR_CLOSURE";
  }

  return {
    status,
    checks,
    unresolvedAmbiguities: unresolved,
    stalePathways: activeStale,
    duplicatePatterns: [...duplicatePatterns],
  };
}

/**
 * 현재 종결 상태만 반환한다.
 * @returns 종결 상태
 */
export function getClosureStatus(): ClosureStatus {
  const report = scanForClosure();
  return report.status;
}

/**
 * 모호성을 해결 처리한다.
 * @param ambiguityId - 해결할 모호성 ID
 * @returns 해결 성공 여부
 */
export function resolveAmbiguity(ambiguityId: string): boolean {
  const item = ambiguities.find((a) => a.id === ambiguityId);
  if (!item || item.resolved) return false;

  item.resolved = true;
  item.resolvedAt = new Date();
  return true;
}

/**
 * 사용되지 않는 경로를 제거 처리한다.
 * @param pathwayId - 제거할 경로 ID
 * @returns 제거 성공 여부
 */
export function removeStalePathway(pathwayId: string): boolean {
  const item = stalePathways.find((s) => s.id === pathwayId);
  if (!item || item.removed) return false;

  item.removed = true;
  return true;
}

/**
 * 모호성을 등록한다.
 * @param area - 관련 영역
 * @param description - 설명
 * @returns 등록된 모호성
 */
export function registerAmbiguity(
  area: string,
  description: string
): UnresolvedAmbiguity {
  const entry: UnresolvedAmbiguity = {
    id: `AMB-${Date.now()}-${ambiguities.length}`,
    area,
    description,
    registeredAt: new Date(),
    resolved: false,
    resolvedAt: null,
  };
  ambiguities.push(entry);
  return entry;
}

/**
 * 사용되지 않는 경로를 등록한다.
 * @param description - 경로 설명
 * @param lastUsedAt - 마지막 사용 일시
 * @returns 등록된 경로
 */
export function registerStalePathway(
  description: string,
  lastUsedAt: Date | null
): StalePathway {
  const entry: StalePathway = {
    id: `STALE-${Date.now()}-${stalePathways.length}`,
    description,
    lastUsedAt,
    removed: false,
  };
  stalePathways.push(entry);
  return entry;
}

/**
 * 중복 패턴을 등록한다.
 * @param originalRef - 원본 참조
 * @param duplicateRef - 중복 참조
 * @param description - 설명
 * @returns 등록된 중복 패턴
 */
export function registerDuplicatePattern(
  originalRef: string,
  duplicateRef: string,
  description: string
): DuplicatePattern {
  const entry: DuplicatePattern = {
    id: `DUP-${Date.now()}-${duplicatePatterns.length}`,
    originalRef,
    duplicateRef,
    description,
  };
  duplicatePatterns.push(entry);
  return entry;
}

/** 기본 점검 항목 생성 */
function getDefaultChecks(): ClosureCheck[] {
  const unresolved = ambiguities.filter((a) => !a.resolved);
  const activeStale = stalePathways.filter((s) => !s.removed);

  return [
    {
      id: "CC-001",
      category: "모호성",
      description: "모든 모호성이 해결되었는가",
      passed: unresolved.length === 0,
      blocker:
        unresolved.length > 0
          ? `미해결 모호성 ${unresolved.length}건 존재`
          : null,
    },
    {
      id: "CC-002",
      category: "경로",
      description: "사용되지 않는 경로가 모두 제거되었는가",
      passed: activeStale.length === 0,
      blocker:
        activeStale.length > 0
          ? `미제거 경로 ${activeStale.length}건 존재`
          : null,
    },
    {
      id: "CC-003",
      category: "중복",
      description: "중복 패턴이 식별·기록되었는가",
      passed: true,
      blocker: null,
    },
  ];
}
