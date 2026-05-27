/**
 * Source of Truth Matrix — 데이터 도메인별 소유권(Write Authority) 정의
 *
 * Dual-write 구조를 엄격히 금지하고, 타 시스템의 소유권 침범을 차단합니다.
 */

export type DataDomain =
  | "POLICY"
  | "AUDIT"
  | "DOCUMENT_VERIFICATION"
  | "PURCHASE_ORDER"
  | "INVOICE"
  | "INVENTORY_LOT"
  | "BUDGET"
  | "USER_IDENTITY"
  | "ORGANIZATION"
  | "PRODUCT_CATALOG"
  | "VENDOR_MASTER"
  | "TICKET";

export interface SoTEntry {
  domain: DataDomain;
  writeAuthority: string;    // system ID that owns writes
  readAllowed: string[];     // systems allowed to read
  description: string;
  enforcementLevel: "HARD_BLOCK" | "WARN_AND_LOG";
}

const MATRIX: SoTEntry[] = [
  { domain: "POLICY", writeAuthority: "PLATFORM", readAllowed: ["*"], description: "정책/임계치/Auto-verify 설정", enforcementLevel: "HARD_BLOCK" },
  { domain: "AUDIT", writeAuthority: "PLATFORM", readAllowed: ["DWH", "COMPLIANCE"], description: "감사 로그/결재 증적", enforcementLevel: "HARD_BLOCK" },
  { domain: "DOCUMENT_VERIFICATION", writeAuthority: "PLATFORM", readAllowed: ["ERP", "DWH"], description: "문서 검증 결과/AI 판정", enforcementLevel: "HARD_BLOCK" },
  { domain: "PURCHASE_ORDER", writeAuthority: "ERP", readAllowed: ["PLATFORM", "DWH"], description: "구매 발주/승인", enforcementLevel: "HARD_BLOCK" },
  { domain: "INVOICE", writeAuthority: "ERP", readAllowed: ["PLATFORM", "FINANCE", "DWH"], description: "인보이스 원장", enforcementLevel: "HARD_BLOCK" },
  { domain: "INVENTORY_LOT", writeAuthority: "WMS", readAllowed: ["PLATFORM", "ERP", "DWH"], description: "재고 Lot/유효기한", enforcementLevel: "HARD_BLOCK" },
  { domain: "BUDGET", writeAuthority: "FINANCE", readAllowed: ["PLATFORM", "ERP"], description: "예산 한도/집행", enforcementLevel: "HARD_BLOCK" },
  { domain: "USER_IDENTITY", writeAuthority: "IAM", readAllowed: ["PLATFORM", "ERP", "WMS"], description: "사용자 인증/권한", enforcementLevel: "HARD_BLOCK" },
  { domain: "ORGANIZATION", writeAuthority: "IAM", readAllowed: ["*"], description: "조직 구조/부서", enforcementLevel: "HARD_BLOCK" },
  { domain: "PRODUCT_CATALOG", writeAuthority: "ERP", readAllowed: ["PLATFORM", "WMS"], description: "제품 마스터", enforcementLevel: "HARD_BLOCK" },
  { domain: "VENDOR_MASTER", writeAuthority: "ERP", readAllowed: ["PLATFORM"], description: "벤더 마스터", enforcementLevel: "HARD_BLOCK" },
  { domain: "TICKET", writeAuthority: "TICKETING", readAllowed: ["PLATFORM", "DWH"], description: "인시던트/티켓", enforcementLevel: "HARD_BLOCK" },
];

/**
 * 특정 도메인의 Write Authority 조회
 */
export function getWriteAuthority(domain: DataDomain): string {
  const entry = MATRIX.find((e) => e.domain === domain);
  return entry?.writeAuthority ?? "UNKNOWN";
}

/**
 * 쓰기 권한 검증 — 소유권 침범 차단
 */
export function validateWriteAccess(params: {
  domain: DataDomain;
  requestingSystem: string;
}): { allowed: boolean; reason: string | null } {
  const entry = MATRIX.find((e) => e.domain === params.domain);
  if (!entry) {
    return { allowed: false, reason: `Unknown data domain: ${params.domain}` };
  }

  if (entry.writeAuthority === params.requestingSystem) {
    return { allowed: true, reason: null };
  }

  return {
    allowed: false,
    reason: `SoT 위반: ${params.domain} 도메인의 Write Authority는 ${entry.writeAuthority}입니다. ${params.requestingSystem}의 쓰기 접근이 차단되었습니다.`,
  };
}

/**
 * 읽기 권한 검증
 */
export function validateReadAccess(params: {
  domain: DataDomain;
  requestingSystem: string;
}): boolean {
  const entry = MATRIX.find((e) => e.domain === params.domain);
  if (!entry) return false;
  return entry.readAllowed.includes("*") || entry.readAllowed.includes(params.requestingSystem);
}

/**
 * 전체 매트릭스 조회
 */
export function getFullMatrix(): SoTEntry[] {
  return [...MATRIX];
}

/**
 * 특정 시스템이 소유하는 모든 도메인 조회
 */
export function getOwnedDomains(systemId: string): SoTEntry[] {
  return MATRIX.filter((e) => e.writeAuthority === systemId);
}
