/**
 * 시민 조율 프리미티브 (Civil Coordination Primitives)
 *
 * 자동화가 아닌 책임 추적(accountability tracking)을 위한
 * 조율 프리미티브 정의 및 조합 엔진.
 */

/** 프리미티브 종류 */
export type PrimitiveKind =
  | "BOUNDED_CLAIM"
  | "REVOCATION_TOKEN"
  | "SCOPE_MARKER"
  | "LIMITATION_DECLARATION"
  | "ACCOUNTABILITY_ANCHOR";

/** 조율 프리미티브 */
export interface CoordinationPrimitive {
  /** 고유 식별자 */
  id: string;
  /** 프리미티브 종류 */
  kind: PrimitiveKind;
  /** 발행자 ID */
  issuerId: string;
  /** 적용 범위 */
  scope: string;
  /** 한계 목록 */
  limitations: string[];
  /** 책임 추적 체인 */
  accountabilityChain: string[];
  /** 생성 시각 */
  createdAt: number;
  /** 만료 시각 (null이면 무기한) */
  expiresAt: number | null;
}

/** 프리미티브 검증 결과 */
export interface PrimitiveValidation {
  /** 유효 여부 */
  valid: boolean;
  /** 사유 목록 */
  reasons: string[];
}

// ─── 인메모리 저장소 ───
const primitiveStore = new Map<string, CoordinationPrimitive>();

/**
 * 프리미티브 생성
 * @param kind 프리미티브 종류
 * @param issuerId 발행자
 * @param scope 적용 범위
 * @param limitations 한계 목록
 * @param accountabilityChain 책임 체인
 * @param expiresAt 만료 시각 (선택)
 */
export function createPrimitive(
  kind: PrimitiveKind,
  issuerId: string,
  scope: string,
  limitations: string[],
  accountabilityChain: string[],
  expiresAt?: number | null
): CoordinationPrimitive {
  const id = `prim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const primitive: CoordinationPrimitive = {
    id,
    kind,
    issuerId,
    scope,
    limitations,
    accountabilityChain,
    createdAt: Date.now(),
    expiresAt: expiresAt ?? null,
  };

  primitiveStore.set(id, primitive);
  return primitive;
}

/**
 * 프리미티브 조합 — 다수의 프리미티브를 하나의 복합 프리미티브로 합성
 * 한계(limitations)는 합집합, 책임 체인은 연결된다.
 */
export function composePrimitives(
  primitives: CoordinationPrimitive[],
  composedScope: string,
  composerId: string
): CoordinationPrimitive {
  if (primitives.length === 0) {
    throw new Error("조합할 프리미티브가 없습니다.");
  }

  // 한계 합집합
  const mergedLimitations = Array.from(
    new Set(primitives.flatMap((p) => p.limitations))
  );

  // 책임 체인 연결
  const mergedChain = primitives.flatMap((p) => p.accountabilityChain);
  mergedChain.push(composerId);

  // 가장 빠른 만료
  const expirations = primitives
    .map((p) => p.expiresAt)
    .filter((e): e is number => e !== null);
  const earliestExpiry = expirations.length > 0 ? Math.min(...expirations) : null;

  return createPrimitive(
    "BOUNDED_CLAIM",
    composerId,
    composedScope,
    mergedLimitations,
    mergedChain,
    earliestExpiry
  );
}

/**
 * 프리미티브 유효성 검증
 */
export function validatePrimitive(primitive: CoordinationPrimitive): PrimitiveValidation {
  const reasons: string[] = [];

  if (!primitive.id) reasons.push("ID가 비어 있습니다.");
  if (!primitive.issuerId) reasons.push("발행자 ID가 비어 있습니다.");
  if (!primitive.scope) reasons.push("적용 범위가 비어 있습니다.");
  if (primitive.accountabilityChain.length === 0) {
    reasons.push("책임 체인이 비어 있습니다.");
  }
  if (primitive.expiresAt !== null && primitive.expiresAt < Date.now()) {
    reasons.push("프리미티브가 이미 만료되었습니다.");
  }

  return { valid: reasons.length === 0, reasons };
}

/**
 * 프리미티브 분해 — 복합 프리미티브의 책임 체인을 역추적하여
 * 원본 발행자 목록 반환
 */
export function decomposePrimitive(primitive: CoordinationPrimitive): {
  issuers: string[];
  limitations: string[];
  scope: string;
} {
  return {
    issuers: [...primitive.accountabilityChain],
    limitations: [...primitive.limitations],
    scope: primitive.scope,
  };
}
