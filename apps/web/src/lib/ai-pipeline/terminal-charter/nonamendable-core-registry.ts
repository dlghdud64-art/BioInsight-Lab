/**
 * @module nonamendable-core-registry
 * @description 개정 불가 코어 레지스트리 — 승인 계보, 롤백 무결성, False-safe 격리 등
 * 영구적으로 불변인 핵심 원칙을 등록하고 보호한다.
 * 모든 수정 시도는 HARD BLOCK되며 위반 로그가 영구 기록된다.
 */

/** 코어 원칙 카테고리 */
export type CoreCategory =
  | "APPROVAL_LINEAGE"
  | "ROLLBACK_INTEGRITY"
  | "FALSE_SAFE_CONTAINMENT"
  | "AUDIT_IMMUTABILITY"
  | "SCOPE_EXPANSION_BLOCK"
  | "EVIDENCE_PRESERVATION";

/** 코어 원칙 */
export interface CorePrinciple {
  /** 원칙 고유 식별자 */
  id: string;
  /** 원칙 이름 */
  name: string;
  /** 원칙 설명 */
  description: string;
  /** 카테고리 */
  category: CoreCategory;
  /** 등록 일시 */
  registeredAt: Date;
  /** 위반 횟수 */
  violationCount: number;
}

/** 위반 로그 항목 */
export interface ViolationLogEntry {
  /** 위반 대상 원칙 ID */
  principleId: string;
  /** 시도된 수정 내용 */
  attemptedModification: string;
  /** 시도자 */
  attemptedBy: string;
  /** 차단 일시 */
  blockedAt: Date;
  /** 차단 사유 */
  reason: string;
}

/** 수정 차단 결과 */
export interface BlockResult {
  /** 차단 여부 */
  blocked: true;
  /** 대상 원칙 ID */
  principleId: string;
  /** 차단 사유 */
  reason: string;
  /** 차단 일시 */
  blockedAt: Date;
}

/** 인메모리 코어 원칙 저장소 */
const coreRegistry: Map<string, CorePrinciple> = new Map();

/** 인메모리 위반 로그 (영구 보존, 삭제 불가) */
const violationLog: ViolationLogEntry[] = [];

/** 기본 코어 원칙 초기화 */
function ensureDefaults(): void {
  if (coreRegistry.size > 0) return;

  const defaults: Array<{ id: string; name: string; description: string; category: CoreCategory }> = [
    {
      id: "CORE-001",
      name: "승인 계보 불변성",
      description: "모든 승인 체인의 계보는 수정·삭제·재작성이 불가능하다.",
      category: "APPROVAL_LINEAGE",
    },
    {
      id: "CORE-002",
      name: "롤백 무결성",
      description: "롤백 이력과 원본 상태는 어떤 경우에도 변조할 수 없다.",
      category: "ROLLBACK_INTEGRITY",
    },
    {
      id: "CORE-003",
      name: "False-safe 격리",
      description: "안전 장치의 오작동 시 격리 메커니즘은 항상 안전한 방향으로 동작한다.",
      category: "FALSE_SAFE_CONTAINMENT",
    },
    {
      id: "CORE-004",
      name: "감사 추적 불변성",
      description: "감사 로그는 추가만 가능하며 수정·삭제가 영구 금지된다.",
      category: "AUDIT_IMMUTABILITY",
    },
    {
      id: "CORE-005",
      name: "범위 확장 차단",
      description: "불변 코어에 대한 범위 확장이나 예외 추가는 차단된다.",
      category: "SCOPE_EXPANSION_BLOCK",
    },
    {
      id: "CORE-006",
      name: "증거 보존",
      description: "모든 결정, 위반, 예외의 증거는 영구 보존되어야 한다.",
      category: "EVIDENCE_PRESERVATION",
    },
  ];

  for (const d of defaults) {
    coreRegistry.set(d.id, {
      ...d,
      registeredAt: new Date(),
      violationCount: 0,
    });
  }
}

/**
 * 코어 원칙을 등록한다.
 * @param principle - 등록할 원칙 (id, name, description, category)
 * @returns 등록된 원칙
 */
export function registerPrinciple(
  principle: Omit<CorePrinciple, "registeredAt" | "violationCount">
): CorePrinciple {
  ensureDefaults();

  if (coreRegistry.has(principle.id)) {
    // 이미 등록된 원칙은 수정 불가 — 위반 기록
    violationLog.push({
      principleId: principle.id,
      attemptedModification: "중복 등록 시도 (기존 원칙 덮어쓰기)",
      attemptedBy: "system",
      blockedAt: new Date(),
      reason: "코어 원칙은 한번 등록되면 재등록할 수 없다.",
    });
    return coreRegistry.get(principle.id)!;
  }

  const registered: CorePrinciple = {
    ...principle,
    registeredAt: new Date(),
    violationCount: 0,
  };
  coreRegistry.set(registered.id, registered);
  return registered;
}

/**
 * 원칙 위반 여부를 확인한다.
 * @param principleId - 확인할 원칙 ID
 * @returns 위반 기록이 있으면 true
 */
export function isPrincipleViolated(principleId: string): boolean {
  ensureDefaults();
  const principle = coreRegistry.get(principleId);
  return principle ? principle.violationCount > 0 : false;
}

/**
 * 수정 시도를 차단하고 위반을 기록한다.
 * 모든 수정 시도는 HARD BLOCK되며 영구 기록된다.
 * @param principleId - 수정 대상 원칙 ID
 * @param attemptedModification - 시도된 수정 내용
 * @param attemptedBy - 시도자
 * @returns 차단 결과
 */
export function blockModificationAttempt(
  principleId: string,
  attemptedModification: string,
  attemptedBy: string
): BlockResult {
  ensureDefaults();

  const principle = coreRegistry.get(principleId);
  const reason = principle
    ? `코어 원칙 [${principle.name}]은(는) 개정 불가 — 수정 시도가 영구 차단됨`
    : `알 수 없는 원칙 ID [${principleId}]에 대한 수정 시도 차단`;

  // 위반 카운트 증가
  if (principle) {
    principle.violationCount += 1;
  }

  // 위반 로그 영구 기록
  const entry: ViolationLogEntry = {
    principleId,
    attemptedModification,
    attemptedBy,
    blockedAt: new Date(),
    reason,
  };
  violationLog.push(entry);

  return {
    blocked: true,
    principleId,
    reason,
    blockedAt: entry.blockedAt,
  };
}

/**
 * 전체 코어 레지스트리를 반환한다.
 * @returns 등록된 모든 코어 원칙 배열
 */
export function getCoreRegistry(): CorePrinciple[] {
  ensureDefaults();
  return Array.from(coreRegistry.values());
}

/**
 * 위반 로그 전체를 반환한다. 로그는 삭제 불가.
 * @returns 위반 로그 배열 (불변 복사본)
 */
export function getViolationLog(): ViolationLogEntry[] {
  return [...violationLog];
}
