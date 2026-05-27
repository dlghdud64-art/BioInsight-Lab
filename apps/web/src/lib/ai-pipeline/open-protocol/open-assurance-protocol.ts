/**
 * @module open-assurance-protocol
 * @description 공개 보증 프로토콜 스펙
 *
 * 기관 간 보증 교환을 위한 표준 프로토콜을 정의한다.
 * 모든 보증은 철회 가능하며, 호환성 선언을 통해 상호운용성을 보장한다.
 * 철회 신호는 지연 없이 전파되어야 한다.
 */

/** 프로토콜 버전 (semver) */
export type ProtocolVersion = string;

/** 보증 교환 메시지 */
export interface AssuranceExchange {
  /** 교환 고유 식별자 */
  id: string;
  /** 발행자 ID */
  issuerId: string;
  /** 보증 대상 ID */
  subjectId: string;
  /** 주장 유형 */
  assertionType: string;
  /** 증적 데이터 */
  evidence: Record<string, unknown>;
  /** 철회 엔드포인트 */
  revocationEndpoint: string;
  /** 호환성 선언 */
  compatibilityDeclaration: CompatibilityDeclaration;
  /** 발행 시각 */
  issuedAt: number;
}

/** 호환성 선언 */
export interface CompatibilityDeclaration {
  /** 프로토콜 버전 */
  protocolVersion: ProtocolVersion;
  /** 지원하는 주장 포맷 */
  supportedFormats: string[];
  /** 철회 경로 지원 여부 */
  supportsRevocation: boolean;
  /** 이의 제기 지원 여부 */
  supportsContestation: boolean;
}

/** 철회 전파 상태 */
export type PropagationStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED";

/** 철회 신호 */
export interface RevocationSignal {
  /** 철회 대상 주장 ID */
  assertionId: string;
  /** 철회 수행자 */
  revokedBy: string;
  /** 철회 사유 */
  reason: string;
  /** 철회 시각 */
  revokedAt: number;
  /** 전파 상태 */
  propagationStatus: PropagationStatus;
}

/** 프로토콜 정의 */
export interface ProtocolDefinition {
  /** 프로토콜 버전 */
  version: ProtocolVersion;
  /** 필수 기능 */
  requiredCapabilities: string[];
  /** 지원 주장 유형 */
  supportedAssertionTypes: string[];
  /** 정의 시각 */
  definedAt: number;
}

// --- 인메모리 저장소 ---
const protocolStore: ProtocolDefinition[] = [];
const exchangeStore: AssuranceExchange[] = [];
const revocationStore: RevocationSignal[] = [];

/**
 * 프로토콜을 정의한다.
 * @param version - semver 버전 문자열
 * @param requiredCapabilities - 필수 기능 목록
 * @param supportedAssertionTypes - 지원 주장 유형 목록
 * @returns 정의된 프로토콜
 */
export function defineProtocol(
  version: ProtocolVersion,
  requiredCapabilities: string[],
  supportedAssertionTypes: string[]
): ProtocolDefinition {
  const definition: ProtocolDefinition = {
    version,
    requiredCapabilities,
    supportedAssertionTypes,
    definedAt: Date.now(),
  };
  protocolStore.push(definition);
  return definition;
}

/**
 * 보증을 발행한다.
 * @param params - 보증 교환 파라미터 (id 제외)
 * @returns 발행된 보증 교환
 */
export function issueAssurance(
  params: Omit<AssuranceExchange, "id" | "issuedAt">
): AssuranceExchange {
  const exchange: AssuranceExchange = {
    ...params,
    id: `ae-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    issuedAt: Date.now(),
  };
  exchangeStore.push(exchange);
  return exchange;
}

/**
 * 보증을 철회한다. 철회 신호를 즉시 생성하고 전파를 시작한다.
 * @param assertionId - 철회할 주장 ID
 * @param revokedBy - 철회 수행자
 * @param reason - 철회 사유
 * @returns 생성된 철회 신호
 */
export function revokeAssurance(
  assertionId: string,
  revokedBy: string,
  reason: string
): RevocationSignal {
  const signal: RevocationSignal = {
    assertionId,
    revokedBy,
    reason,
    revokedAt: Date.now(),
    propagationStatus: "PENDING",
  };
  revocationStore.push(signal);
  return signal;
}

/**
 * 주장의 철회 상태를 확인한다.
 * @param assertionId - 확인할 주장 ID
 * @returns 철회 신호 또는 null (철회되지 않은 경우)
 */
export function checkRevocationStatus(assertionId: string): RevocationSignal | null {
  return revocationStore.find((s) => s.assertionId === assertionId) ?? null;
}

/**
 * 호환성 선언을 생성한다.
 * @param protocolVersion - 프로토콜 버전
 * @param supportedFormats - 지원 포맷 목록
 * @param supportsRevocation - 철회 지원 여부
 * @param supportsContestation - 이의 제기 지원 여부
 * @returns 호환성 선언
 */
export function declareCompatibility(
  protocolVersion: ProtocolVersion,
  supportedFormats: string[],
  supportsRevocation: boolean,
  supportsContestation: boolean
): CompatibilityDeclaration {
  return {
    protocolVersion,
    supportedFormats,
    supportsRevocation,
    supportsContestation,
  };
}
