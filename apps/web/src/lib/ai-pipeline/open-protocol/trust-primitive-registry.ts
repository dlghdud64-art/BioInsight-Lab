/**
 * @module trust-primitive-registry
 * @description 신뢰 프리미티브 레지스트리
 *
 * 보증 생태계에서 사용되는 기본 신뢰 구성 요소(프리미티브)를 등록하고 관리한다.
 * 각 프리미티브는 스키마를 갖고, 버전 관리되며, 비활성화(deprecated)될 수 있다.
 */

/** 프리미티브 유형 */
export type PrimitiveType =
  | "EVIDENCE_ENVELOPE"
  | "REVOCATION_TOKEN"
  | "LIMITATION_MARKER"
  | "CAPABILITY_BADGE"
  | "CONFORMANCE_SEAL";

/** 신뢰 프리미티브 */
export interface TrustPrimitive {
  /** 고유 식별자 */
  id: string;
  /** 프리미티브 유형 */
  type: PrimitiveType;
  /** JSON 스키마 정의 */
  schema: Record<string, unknown>;
  /** 버전 */
  version: string;
  /** 설명 */
  description: string;
  /** 등록 시각 */
  registeredAt: number;
  /** 비활성화 여부 */
  deprecated: boolean;
}

/** 프리미티브 인스턴스 검증 결과 */
export interface PrimitiveValidationResult {
  /** 유효 여부 */
  valid: boolean;
  /** 오류 목록 */
  errors: string[];
}

// --- 인메모리 저장소 ---
const primitiveStore: TrustPrimitive[] = [];

/**
 * 신뢰 프리미티브를 등록한다.
 * @param type - 프리미티브 유형
 * @param schema - JSON 스키마
 * @param version - 버전
 * @param description - 설명
 * @returns 등록된 프리미티브
 */
export function registerPrimitive(
  type: PrimitiveType,
  schema: Record<string, unknown>,
  version: string,
  description: string
): TrustPrimitive {
  const primitive: TrustPrimitive = {
    id: `tp-${type.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    schema,
    version,
    description,
    registeredAt: Date.now(),
    deprecated: false,
  };
  primitiveStore.push(primitive);
  return primitive;
}

/**
 * 프리미티브를 ID로 조회한다.
 * @param id - 프리미티브 ID
 * @returns 프리미티브 또는 null
 */
export function getPrimitive(id: string): TrustPrimitive | null {
  return primitiveStore.find((p) => p.id === id) ?? null;
}

/**
 * 프리미티브를 비활성화한다.
 * @param id - 비활성화할 프리미티브 ID
 * @returns 비활성화된 프리미티브 또는 null
 */
export function deprecatePrimitive(id: string): TrustPrimitive | null {
  const primitive = primitiveStore.find((p) => p.id === id);
  if (!primitive) return null;
  primitive.deprecated = true;
  return primitive;
}

/**
 * 활성 프리미티브 목록을 반환한다.
 * @param type - 선택적 유형 필터
 * @returns 활성 프리미티브 배열
 */
export function listActivePrimitives(type?: PrimitiveType): TrustPrimitive[] {
  return primitiveStore.filter(
    (p) => !p.deprecated && (type === undefined || p.type === type)
  );
}

/**
 * 프리미티브 인스턴스가 등록된 스키마에 부합하는지 검증한다.
 * @param primitiveId - 프리미티브 ID
 * @param instance - 검증할 인스턴스 데이터
 * @returns 검증 결과
 */
export function validateInstance(
  primitiveId: string,
  instance: Record<string, unknown>
): PrimitiveValidationResult {
  const primitive = primitiveStore.find((p) => p.id === primitiveId);
  if (!primitive) {
    return { valid: false, errors: ["프리미티브를 찾을 수 없습니다."] };
  }
  if (primitive.deprecated) {
    return { valid: false, errors: ["비활성화된 프리미티브입니다."] };
  }

  const errors: string[] = [];
  const requiredFields = primitive.schema["required"];
  if (Array.isArray(requiredFields)) {
    for (const field of requiredFields) {
      if (typeof field === "string" && !(field in instance)) {
        errors.push(`필수 필드 누락: ${field}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
