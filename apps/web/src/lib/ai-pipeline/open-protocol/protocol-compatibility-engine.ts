/**
 * @module protocol-compatibility-engine
 * @description 프로토콜 호환성 검증 엔진
 *
 * 외부 참여자의 시스템이 공개 보증 프로토콜과 호환되는지 검증한다.
 * 철회 경로, 이의 제기, 증적 포맷, 주장 포맷, 무결성 증명, 계층 준수 여부를 확인한다.
 * 어댑터가 필요한 경우 요구 사항을 반환한다.
 */

/** 호환성 결과 */
export type CompatibilityResult =
  | "FULLY_COMPATIBLE"
  | "ADAPTER_REQUIRED"
  | "INCOMPATIBLE";

/** 개별 호환성 검사 항목 */
export interface CompatibilityCheck {
  /** 검사 카테고리 */
  category: string;
  /** 통과 여부 */
  passed: boolean;
  /** 상세 설명 */
  details: string;
  /** 어댑터 스펙 (필요한 경우) */
  adapterSpec: string | null;
}

/** 호환성 검증 보고서 */
export interface CompatibilityReport {
  /** 전체 결과 */
  result: CompatibilityResult;
  /** 개별 검사 결과 */
  checks: CompatibilityCheck[];
  /** 검증 시각 */
  checkedAt: number;
}

/** 참여자 시스템 선언 */
export interface SystemDeclaration {
  /** 참여자 ID */
  participantId: string;
  /** 철회 경로 지원 여부 */
  supportsRevocationPath: boolean;
  /** 이의 제기 지원 여부 */
  supportsContestation: boolean;
  /** 지원 증적 포맷 */
  evidenceFormats: string[];
  /** 지원 주장 포맷 */
  assertionFormats: string[];
  /** 무결성 증명 메커니즘 */
  integrityMechanism: string;
  /** 참여자 계층 */
  declaredTier: string;
}

/** 필수 검사 카테고리 */
const REQUIRED_CATEGORIES = [
  "REVOCATION_PATH",
  "CONTESTATION_SUPPORT",
  "EVIDENCE_FORMAT",
  "ASSERTION_FORMAT",
  "INTEGRITY_PROOF",
  "TIER_COMPLIANCE",
] as const;

/** 지원되는 증적 포맷 */
const SUPPORTED_EVIDENCE_FORMATS = ["OPEN_ENVELOPE_V1", "JSON_LD", "W3C_VC"];
/** 지원되는 주장 포맷 */
const SUPPORTED_ASSERTION_FORMATS = ["PORTABLE_ASSERTION_V1", "JSON_LD", "W3C_VC"];
/** 지원되는 무결성 메커니즘 */
const SUPPORTED_INTEGRITY_MECHANISMS = ["HASH_PROOF", "HMAC", "DIGITAL_SIGNATURE", "MERKLE_PROOF"];

/**
 * 시스템 선언을 기반으로 프로토콜 호환성을 검증한다.
 * @param declaration - 참여자 시스템 선언
 * @returns 호환성 검증 보고서
 */
export function checkCompatibility(declaration: SystemDeclaration): CompatibilityReport {
  const checks: CompatibilityCheck[] = [];

  // 1. 철회 경로 지원
  checks.push({
    category: "REVOCATION_PATH",
    passed: declaration.supportsRevocationPath,
    details: declaration.supportsRevocationPath
      ? "철회 경로가 지원됩니다."
      : "철회 경로 미지원 — 프로토콜 필수 요건입니다.",
    adapterSpec: declaration.supportsRevocationPath
      ? null
      : "RevocationPathAdapter: 철회 신호 수신 및 전파 엔드포인트 구현 필요",
  });

  // 2. 이의 제기 지원
  checks.push({
    category: "CONTESTATION_SUPPORT",
    passed: declaration.supportsContestation,
    details: declaration.supportsContestation
      ? "이의 제기가 지원됩니다."
      : "이의 제기 미지원 — 프로토콜 필수 요건입니다.",
    adapterSpec: declaration.supportsContestation
      ? null
      : "ContestationAdapter: 이의 제기 수신·처리 API 구현 필요",
  });

  // 3. 증적 포맷
  const hasEvidenceFormat = declaration.evidenceFormats.some((f) =>
    SUPPORTED_EVIDENCE_FORMATS.includes(f)
  );
  checks.push({
    category: "EVIDENCE_FORMAT",
    passed: hasEvidenceFormat,
    details: hasEvidenceFormat
      ? "호환 가능한 증적 포맷이 존재합니다."
      : `지원되는 증적 포맷 중 호환 항목 없음. 필요: ${SUPPORTED_EVIDENCE_FORMATS.join(", ")}`,
    adapterSpec: hasEvidenceFormat
      ? null
      : "EvidenceFormatAdapter: OPEN_ENVELOPE_V1 형식 변환기 구현 필요",
  });

  // 4. 주장 포맷
  const hasAssertionFormat = declaration.assertionFormats.some((f) =>
    SUPPORTED_ASSERTION_FORMATS.includes(f)
  );
  checks.push({
    category: "ASSERTION_FORMAT",
    passed: hasAssertionFormat,
    details: hasAssertionFormat
      ? "호환 가능한 주장 포맷이 존재합니다."
      : `지원되는 주장 포맷 중 호환 항목 없음. 필요: ${SUPPORTED_ASSERTION_FORMATS.join(", ")}`,
    adapterSpec: hasAssertionFormat
      ? null
      : "AssertionFormatAdapter: PORTABLE_ASSERTION_V1 형식 변환기 구현 필요",
  });

  // 5. 무결성 증명 메커니즘
  const hasIntegrity = SUPPORTED_INTEGRITY_MECHANISMS.includes(declaration.integrityMechanism);
  checks.push({
    category: "INTEGRITY_PROOF",
    passed: hasIntegrity,
    details: hasIntegrity
      ? "무결성 증명 메커니즘이 호환됩니다."
      : `미지원 무결성 메커니즘: ${declaration.integrityMechanism}`,
    adapterSpec: hasIntegrity
      ? null
      : "IntegrityAdapter: HASH_PROOF 또는 DIGITAL_SIGNATURE 메커니즘 구현 필요",
  });

  // 6. 계층 준수
  const validTiers = ["OBSERVER", "CONSUMER", "VERIFIED_PARTICIPANT", "ASSERTION_ISSUER", "PROTOCOL_STEWARD"];
  const tierValid = validTiers.includes(declaration.declaredTier);
  checks.push({
    category: "TIER_COMPLIANCE",
    passed: tierValid,
    details: tierValid
      ? "유효한 계층 선언입니다."
      : `유효하지 않은 계층: ${declaration.declaredTier}`,
    adapterSpec: null,
  });

  // 결과 판정
  const failedChecks = checks.filter((c) => !c.passed);
  const criticalFail = failedChecks.some(
    (c) => c.category === "REVOCATION_PATH" || c.category === "CONTESTATION_SUPPORT"
  );

  let result: CompatibilityResult;
  if (failedChecks.length === 0) {
    result = "FULLY_COMPATIBLE";
  } else if (criticalFail && failedChecks.length > 2) {
    result = "INCOMPATIBLE";
  } else {
    result = "ADAPTER_REQUIRED";
  }

  return { result, checks, checkedAt: Date.now() };
}

/**
 * 호환성 보고서에서 필요한 어댑터 요구 사항을 추출한다.
 * @param report - 호환성 보고서
 * @returns 어댑터 요구 사항 목록
 */
export function getAdapterRequirements(
  report: CompatibilityReport
): { category: string; spec: string }[] {
  return report.checks
    .filter((c) => !c.passed && c.adapterSpec !== null)
    .map((c) => ({ category: c.category, spec: c.adapterSpec! }));
}
