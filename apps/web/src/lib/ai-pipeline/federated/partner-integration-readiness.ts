/**
 * @module partner-integration-readiness
 * @description 파트너 통합 준비도 게이트
 *
 * 파트너가 연합 네트워크에 통합되기 위한 8가지 필수 조건을
 * 점검하고 준비도 리포트를 생성한다.
 */

import { getPartner } from "./trust-registry";
import { getActiveContracts } from "./trust-contracts";
import { checkConsent } from "./consent-revocation";

/** 준비도 점검 카테고리 */
export type ReadinessCategory =
  | "TRUST_LEVEL"
  | "CONTRACT_ACTIVE"
  | "CONSENT_GRANTED"
  | "API_COMPATIBILITY"
  | "EVIDENCE_FORMAT"
  | "SECURITY_COMPLIANCE"
  | "DATA_RESIDENCY"
  | "SLA_AGREEMENT";

/** 준비도 점검 항목 */
export interface ReadinessCheck {
  checkId: string;
  partnerId: string;
  category: ReadinessCategory;
  passed: boolean;
  details: string;
}

/** 준비도 리포트 */
export interface ReadinessReport {
  partnerId: string;
  checks: ReadinessCheck[];
  overallReady: boolean;
  passedCount: number;
  totalCount: number;
  generatedAt: Date;
}

/** 파트너 메타데이터 (외부 검증에 사용) */
export interface PartnerCapabilities {
  apiVersion?: string;
  supportedFormats?: string[];
  securityCertifications?: string[];
  dataResidencyRegion?: string;
  slaAgreed?: boolean;
}

/**
 * 파트너의 통합 준비도를 점검한다.
 * 8가지 카테고리를 순차적으로 확인한다.
 * @param partnerId 점검할 파트너 ID
 * @param requestingOrgId 요청 조직 ID
 * @param capabilities 파트너 역량 메타데이터
 * @returns 준비도 점검 결과 배열
 */
export function checkPartnerReadiness(
  partnerId: string,
  requestingOrgId: string,
  capabilities: PartnerCapabilities = {},
): ReadinessCheck[] {
  const checks: ReadinessCheck[] = [];
  let checkSeq = 0;

  function addCheck(
    category: ReadinessCategory,
    passed: boolean,
    details: string,
  ): void {
    checkSeq += 1;
    checks.push({
      checkId: `readiness-${partnerId}-${checkSeq}`,
      partnerId,
      category,
      passed,
      details,
    });
  }

  // 1. 신뢰 수준 점검
  const partner = getPartner(partnerId);
  if (!partner) {
    addCheck("TRUST_LEVEL", false, "파트너가 신뢰 등록소에 등록되어 있지 않습니다.");
  } else if (
    partner.trustLevel === "SUSPENDED" ||
    partner.trustLevel === "REVOKED"
  ) {
    addCheck(
      "TRUST_LEVEL",
      false,
      `파트너 신뢰 수준이 '${partner.trustLevel}'이므로 통합 불가합니다.`,
    );
  } else {
    addCheck("TRUST_LEVEL", true, `신뢰 수준: ${partner.trustLevel}`);
  }

  // 2. 활성 계약 점검
  const contracts = getActiveContracts(partnerId);
  if (contracts.length === 0) {
    addCheck("CONTRACT_ACTIVE", false, "활성 계약이 없습니다.");
  } else {
    addCheck("CONTRACT_ACTIVE", true, `활성 계약 ${contracts.length}건`);
  }

  // 3. 동의 점검
  const hasConsent = checkConsent(
    partnerId,
    requestingOrgId,
    "FULL_FEDERATION",
  );
  if (!hasConsent) {
    addCheck(
      "CONSENT_GRANTED",
      false,
      "FULL_FEDERATION 동의가 부여되지 않았습니다.",
    );
  } else {
    addCheck("CONSENT_GRANTED", true, "FULL_FEDERATION 동의가 활성 상태입니다.");
  }

  // 4. API 호환성 점검
  const requiredApiVersion = "v2";
  if (!capabilities.apiVersion) {
    addCheck("API_COMPATIBILITY", false, "API 버전 정보가 제공되지 않았습니다.");
  } else if (!capabilities.apiVersion.startsWith(requiredApiVersion)) {
    addCheck(
      "API_COMPATIBILITY",
      false,
      `API 버전 '${capabilities.apiVersion}'이(가) 요구사항(${requiredApiVersion})에 부합하지 않습니다.`,
    );
  } else {
    addCheck(
      "API_COMPATIBILITY",
      true,
      `API 버전 ${capabilities.apiVersion} 호환`,
    );
  }

  // 5. 증거 형식 점검
  const requiredFormats = ["JSON", "XML"];
  const supportedFormats = capabilities.supportedFormats ?? [];
  const hasAllFormats = requiredFormats.every((f) =>
    supportedFormats.includes(f),
  );
  if (!hasAllFormats) {
    addCheck(
      "EVIDENCE_FORMAT",
      false,
      `필수 증거 형식(${requiredFormats.join(", ")})이 지원되지 않습니다. 현재: ${supportedFormats.join(", ") || "없음"}`,
    );
  } else {
    addCheck("EVIDENCE_FORMAT", true, "필수 증거 형식이 모두 지원됩니다.");
  }

  // 6. 보안 인증 점검
  const requiredCerts = ["ISO27001"];
  const certs = capabilities.securityCertifications ?? [];
  const hasRequiredCerts = requiredCerts.every((c) => certs.includes(c));
  if (!hasRequiredCerts) {
    addCheck(
      "SECURITY_COMPLIANCE",
      false,
      `필수 보안 인증(${requiredCerts.join(", ")})이 확인되지 않았습니다.`,
    );
  } else {
    addCheck("SECURITY_COMPLIANCE", true, "보안 인증 요건을 충족합니다.");
  }

  // 7. 데이터 거주지 점검
  const allowedRegions = ["KR", "US", "EU", "JP"];
  if (!capabilities.dataResidencyRegion) {
    addCheck(
      "DATA_RESIDENCY",
      false,
      "데이터 거주지 정보가 제공되지 않았습니다.",
    );
  } else if (!allowedRegions.includes(capabilities.dataResidencyRegion)) {
    addCheck(
      "DATA_RESIDENCY",
      false,
      `데이터 거주지 '${capabilities.dataResidencyRegion}'이(가) 허용 지역에 포함되지 않습니다.`,
    );
  } else {
    addCheck(
      "DATA_RESIDENCY",
      true,
      `데이터 거주지: ${capabilities.dataResidencyRegion}`,
    );
  }

  // 8. SLA 합의 점검
  if (!capabilities.slaAgreed) {
    addCheck("SLA_AGREEMENT", false, "SLA 합의가 이루어지지 않았습니다.");
  } else {
    addCheck("SLA_AGREEMENT", true, "SLA 합의 완료");
  }

  return checks;
}

/**
 * 파트너의 통합 준비도 리포트를 생성한다.
 * @param partnerId 점검할 파트너 ID
 * @param requestingOrgId 요청 조직 ID
 * @param capabilities 파트너 역량 메타데이터
 * @returns 준비도 리포트
 */
export function getReadinessReport(
  partnerId: string,
  requestingOrgId: string,
  capabilities: PartnerCapabilities = {},
): ReadinessReport {
  const checks = checkPartnerReadiness(
    partnerId,
    requestingOrgId,
    capabilities,
  );
  const passedCount = checks.filter((c) => c.passed).length;

  return {
    partnerId,
    checks,
    overallReady: passedCount === checks.length,
    passedCount,
    totalCount: checks.length,
    generatedAt: new Date(),
  };
}
