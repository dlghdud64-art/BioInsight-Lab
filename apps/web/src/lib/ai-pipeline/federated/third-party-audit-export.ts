/**
 * @module third-party-audit-export
 * @description 서드파티 감사 수출 패키지
 *
 * 외부 감사 기관에 제출할 감사 패키지를 생성한다.
 * redaction 정책에 따라 민감 데이터를 제거하고,
 * 패키지의 완전성을 검증한다.
 */

/** 감사 패키지 형식 */
export type AuditExportFormat = "JSON" | "XML" | "PDF" | "CSV";

/** 감사 범위 */
export type AuditScope =
  | "FULL"
  | "EVIDENCE_ONLY"
  | "POLICY_ONLY"
  | "COMPLIANCE_SUMMARY"
  | "RISK_ASSESSMENT";

/** redaction 정책 */
export interface RedactionPolicy {
  fieldsToRedact: string[];
  redactionMarker: string;
  preserveStructure: boolean;
}

/** 감사 패키지 섹션 */
export interface AuditSection {
  sectionId: string;
  title: string;
  content: Record<string, unknown>;
  redacted: boolean;
}

/** 감사 패키지 */
export interface AuditPackage {
  id: string;
  requestedBy: string;
  scope: AuditScope;
  generatedAt: Date;
  format: AuditExportFormat;
  redactionPolicy: RedactionPolicy;
  sections: AuditSection[];
}

/** 감사 패키지 생성 요청 */
export interface GenerateAuditPackageInput {
  requestedBy: string;
  scope: AuditScope;
  format: AuditExportFormat;
  redactionPolicy: RedactionPolicy;
  sections: AuditSection[];
}

/** 완전성 검증 결과 */
export interface CompletenessResult {
  complete: boolean;
  missingSections: string[];
  checkedAt: Date;
}

/** 인메모리 감사 패키지 저장소 */
const auditPackageStore: AuditPackage[] = [];

/** 고유 ID 생성 */
let auditSeq = 0;
function nextAuditId(): string {
  auditSeq += 1;
  return `audit-pkg-${auditSeq}`;
}

/**
 * 감사 수출 패키지를 생성한다.
 * @param input 패키지 생성 정보
 * @returns 생성된 감사 패키지
 */
export function generateAuditPackage(
  input: GenerateAuditPackageInput,
): AuditPackage {
  if (input.sections.length === 0) {
    throw new Error("감사 패키지에는 최소 1개 이상의 섹션이 필요합니다.");
  }

  const pkg: AuditPackage = {
    id: nextAuditId(),
    requestedBy: input.requestedBy,
    scope: input.scope,
    generatedAt: new Date(),
    format: input.format,
    redactionPolicy: { ...input.redactionPolicy },
    sections: input.sections.map((s) => ({ ...s })),
  };

  auditPackageStore.push(pkg);
  return pkg;
}

/**
 * 감사 패키지의 섹션에 redaction을 적용한다.
 * @param packageId 대상 패키지 ID
 * @returns redaction 적용된 감사 패키지
 * @throws 패키지를 찾을 수 없는 경우
 */
export function applyRedaction(packageId: string): AuditPackage {
  const pkg = auditPackageStore.find((p) => p.id === packageId);
  if (!pkg) {
    throw new Error(`감사 패키지 '${packageId}'을(를) 찾을 수 없습니다.`);
  }

  const { fieldsToRedact, redactionMarker, preserveStructure } =
    pkg.redactionPolicy;

  for (const section of pkg.sections) {
    for (const field of fieldsToRedact) {
      if (field in section.content) {
        if (preserveStructure) {
          section.content[field] = redactionMarker;
        } else {
          delete section.content[field];
        }
        section.redacted = true;
      }
    }
  }

  return pkg;
}

/**
 * 감사 패키지의 완전성을 검증한다.
 * 범위에 따라 필수 섹션이 모두 포함되어 있는지 확인한다.
 * @param packageId 검증할 패키지 ID
 * @returns 완전성 검증 결과
 */
export function validatePackageCompleteness(
  packageId: string,
): CompletenessResult {
  const pkg = auditPackageStore.find((p) => p.id === packageId);
  if (!pkg) {
    return {
      complete: false,
      missingSections: ["패키지를 찾을 수 없습니다."],
      checkedAt: new Date(),
    };
  }

  const requiredSectionsByScope: Record<AuditScope, string[]> = {
    FULL: [
      "overview",
      "evidence",
      "policies",
      "compliance",
      "risk",
      "conclusions",
    ],
    EVIDENCE_ONLY: ["evidence", "methodology"],
    POLICY_ONLY: ["policies", "enforcement"],
    COMPLIANCE_SUMMARY: ["compliance", "findings"],
    RISK_ASSESSMENT: ["risk", "mitigation", "recommendations"],
  };

  const requiredSections = requiredSectionsByScope[pkg.scope] ?? [];
  const existingSectionIds = new Set(pkg.sections.map((s) => s.sectionId));
  const missingSections = requiredSections.filter(
    (s) => !existingSectionIds.has(s),
  );

  return {
    complete: missingSections.length === 0,
    missingSections,
    checkedAt: new Date(),
  };
}

/**
 * 감사 패키지 수출 이력을 조회한다.
 * @param requestedBy 요청자 ID (선택)
 * @returns 감사 패키지 배열
 */
export function getExportHistory(requestedBy?: string): AuditPackage[] {
  if (requestedBy) {
    return auditPackageStore.filter((p) => p.requestedBy === requestedBy);
  }
  return [...auditPackageStore];
}
