/**
 * Compliance Links 유틸리티
 * 제품에 적용 가능한 규제/절차 링크 필터링
 */

import { Product } from "@prisma/client";

export interface ComplianceLink {
  id: string;
  organizationId: string | null;
  title: string;
  url: string;
  description: string | null;
  priority: number;
  enabled: boolean;
  linkType: "official" | "organization";
  tags: string[] | null;
  rules: ComplianceLinkRules | null;
}

export interface ComplianceLinkRules {
  hazardCodesAny?: string[]; // 위험 코드 중 하나라도 있으면 매칭
  pictogramsAny?: string[]; // 피크토그램 중 하나라도 있으면 매칭
  categoryIn?: string[]; // 카테고리가 포함되면 매칭
  missingSds?: boolean; // SDS가 없으면 매칭
}

/**
 * 제품에 적용 가능한 링크 필터링
 */
export function filterComplianceLinksForProduct(
  links: ComplianceLink[],
  product: Product,
  organizationId?: string | null
): ComplianceLink[] {
  return links.filter((link) => {
    // 활성화된 링크만 표시
    if (!link.enabled) {
      return false;
    }

    // 조직별 링크는 해당 조직에만 표시
    if (link.organizationId && link.organizationId !== organizationId) {
      return false;
    }

    // 규칙이 없으면 항상 표시
    if (!link.rules) {
      return true;
    }

    const rules = link.rules;

    // hazardCodesAny 체크
    if (rules.hazardCodesAny && rules.hazardCodesAny.length > 0) {
      const productHazardCodes = Array.isArray(product.hazardCodes)
        ? product.hazardCodes
        : [];
      const hasMatchingHazardCode = rules.hazardCodesAny.some((code) =>
        productHazardCodes.includes(code)
      );
      if (!hasMatchingHazardCode) {
        return false;
      }
    }

    // pictogramsAny 체크
    if (rules.pictogramsAny && rules.pictogramsAny.length > 0) {
      const productPictograms = Array.isArray(product.pictograms)
        ? product.pictograms
        : [];
      const hasMatchingPictogram = rules.pictogramsAny.some((pictogram) =>
        productPictograms.includes(pictogram)
      );
      if (!hasMatchingPictogram) {
        return false;
      }
    }

    // categoryIn 체크
    if (rules.categoryIn && rules.categoryIn.length > 0) {
      if (!rules.categoryIn.includes(product.category as string)) {
        return false;
      }
    }

    // missingSds 체크
    if (rules.missingSds !== undefined) {
      const hasSds = !!product.msdsUrl;
      if (rules.missingSds && hasSds) {
        return false;
      }
      if (!rules.missingSds && !hasSds) {
        return false;
      }
    }

    return true;
  });
}

/**
 * 규칙 설명 생성 (관리자용 힌트)
 */
export function getRuleDescription(rules: ComplianceLinkRules | null): string {
  if (!rules) {
    return "모든 제품에 적용";
  }

  const conditions: string[] = [];

  if (rules.hazardCodesAny && rules.hazardCodesAny.length > 0) {
    conditions.push(`위험 코드: ${rules.hazardCodesAny.join(", ")}`);
  }

  if (rules.pictogramsAny && rules.pictogramsAny.length > 0) {
    conditions.push(`피크토그램: ${rules.pictogramsAny.join(", ")}`);
  }

  if (rules.categoryIn && rules.categoryIn.length > 0) {
    conditions.push(`카테고리: ${rules.categoryIn.join(", ")}`);
  }

  if (rules.missingSds !== undefined) {
    conditions.push(rules.missingSds ? "SDS 없음" : "SDS 있음");
  }

  return conditions.length > 0 ? conditions.join(", ") : "조건 없음";
}

