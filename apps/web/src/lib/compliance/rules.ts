/**
 * 규칙 평가 로직
 * ComplianceLinkTemplate의 rules를 평가하여 제품에 적용되는지 판단
 */

export interface ComplianceLinkRules {
  hazardCodesAny?: string[]; // 위험 코드 중 하나라도 포함되면 true
  pictogramsAny?: string[]; // 피크토그램 중 하나라도 포함되면 true
  categoryIn?: string[]; // 카테고리가 목록에 포함되면 true
  vendorIn?: string[]; // 벤더가 목록에 포함되면 true
  missingSds?: boolean; // SDS 누락 여부
}

export interface ProductSafetyInfo {
  hazardCodes?: string[] | null;
  pictograms?: string[] | null;
  category?: string | null;
  vendorName?: string | null;
  hasSds?: boolean;
}

/**
 * 제품이 규칙을 만족하는지 평가
 * 모든 조건이 AND로 평가됨 (모든 조건을 만족해야 함)
 */
export function evaluateRules(
  rules: ComplianceLinkRules | null | undefined,
  product: ProductSafetyInfo
): boolean {
  // 규칙이 없으면 모든 제품에 적용
  if (!rules) {
    return true;
  }

  // hazardCodesAny 체크
  if (rules.hazardCodesAny && rules.hazardCodesAny.length > 0) {
    const productHazardCodes = product.hazardCodes || [];
    const hasMatchingHazardCode = rules.hazardCodesAny.some(ruleCode =>
      productHazardCodes.includes(ruleCode)
    );
    if (!hasMatchingHazardCode) {
      return false;
    }
  }

  // pictogramsAny 체크
  if (rules.pictogramsAny && rules.pictogramsAny.length > 0) {
    const productPictograms = product.pictograms || [];
    const hasMatchingPictogram = rules.pictogramsAny.some(rulePicto =>
      productPictograms.includes(rulePicto)
    );
    if (!hasMatchingPictogram) {
      return false;
    }
  }

  // categoryIn 체크
  if (rules.categoryIn && rules.categoryIn.length > 0) {
    if (!product.category || !rules.categoryIn.includes(product.category)) {
      return false;
    }
  }

  // vendorIn 체크
  if (rules.vendorIn && rules.vendorIn.length > 0) {
    if (!product.vendorName || !rules.vendorIn.includes(product.vendorName)) {
      return false;
    }
  }

  // missingSds 체크
  if (rules.missingSds !== undefined) {
    const productMissingSds = !product.hasSds;
    if (productMissingSds !== rules.missingSds) {
      return false;
    }
  }

  // 모든 조건을 만족함
  return true;
}

/**
 * 여러 링크 템플릿 중 제품에 적용되는 것만 필터링
 */
export interface ComplianceLinkTemplate {
  id: string;
  organizationId: string;
  title: string;
  url: string;
  description?: string | null;
  tags?: string[] | null;
  rules?: ComplianceLinkRules | null;
  priority: number;
  enabled: boolean;
}

export function filterApplicableLinks(
  templates: ComplianceLinkTemplate[],
  product: ProductSafetyInfo
): ComplianceLinkTemplate[] {
  return templates
    .filter(template => template.enabled)
    .filter(template => evaluateRules(template.rules as ComplianceLinkRules, product))
    .sort((a, b) => a.priority - b.priority); // priority 낮을수록 우선순위 높음
}

/**
 * 규칙 설명 생성 (사람이 읽을 수 있는 형태)
 */
export function describeRules(rules: ComplianceLinkRules | null | undefined): string {
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

  if (rules.vendorIn && rules.vendorIn.length > 0) {
    conditions.push(`벤더: ${rules.vendorIn.join(", ")}`);
  }

  if (rules.missingSds !== undefined) {
    conditions.push(rules.missingSds ? "SDS 누락" : "SDS 보유");
  }

  return conditions.length > 0 ? conditions.join(" / ") : "모든 제품에 적용";
}

/**
 * 규칙 유효성 검사
 */
export function validateRules(rules: any): { valid: boolean; error?: string } {
  if (!rules) {
    return { valid: true };
  }

  if (typeof rules !== "object") {
    return { valid: false, error: "규칙은 객체여야 합니다" };
  }

  const allowedKeys = ["hazardCodesAny", "pictogramsAny", "categoryIn", "vendorIn", "missingSds"];
  const providedKeys = Object.keys(rules);
  const invalidKeys = providedKeys.filter(key => !allowedKeys.includes(key));

  if (invalidKeys.length > 0) {
    return { valid: false, error: `허용되지 않은 규칙 키: ${invalidKeys.join(", ")}` };
  }

  // 배열 타입 검증
  const arrayKeys = ["hazardCodesAny", "pictogramsAny", "categoryIn", "vendorIn"];
  for (const key of arrayKeys) {
    if (rules[key] !== undefined && !Array.isArray(rules[key])) {
      return { valid: false, error: `${key}는 배열이어야 합니다` };
    }
  }

  // boolean 타입 검증
  if (rules.missingSds !== undefined && typeof rules.missingSds !== "boolean") {
    return { valid: false, error: "missingSds는 boolean이어야 합니다" };
  }

  return { valid: true };
}
