/**
 * 안전 정보 시각화 유틸리티
 */
// §cas-hazard-classification T1 — 미분류(unknown) 판정용 canonical 분류기.
import { classifyByCas } from "@/lib/safety/cas-ghs-table";

export interface SafetyLevel {
  level: "low" | "medium" | "high" | "critical" | "unknown";
  color: string;
  bgColor: string;
  borderColor: string;
  label: string;
}

/**
 * 위험 코드로부터 안전 수준 계산
 */
export function getSafetyLevelFromHazardCodes(hazardCodes: string[] | null | undefined): SafetyLevel {
  if (!hazardCodes || hazardCodes.length === 0) {
    return {
      level: "low",
      color: "text-green-700",
      bgColor: "bg-green-50",
      borderColor: "border-green-200",
      label: "낮음",
    };
  }

  // 고위험 코드 확인
  const criticalCodes = ["H300", "H310", "H330", "H350", "H360", "H370", "H372"];
  const highRiskCodes = ["H301", "H311", "H331", "H314", "H318", "H340", "H341"];
  
  const hasCritical = hazardCodes.some((code) => criticalCodes.includes(code));
  const hasHighRisk = hazardCodes.some((code) => highRiskCodes.includes(code));

  if (hasCritical) {
    return {
      level: "critical",
      color: "text-red-700",
      bgColor: "bg-red-50",
      borderColor: "border-red-300",
      label: "매우 위험",
    };
  }

  if (hasHighRisk) {
    return {
      level: "high",
      color: "text-red-700",
      bgColor: "bg-red-50",
      borderColor: "border-red-200",
      label: "위험",
    };
  }

  if (hazardCodes.length > 0) {
    return {
      level: "medium",
      color: "text-yellow-700",
      bgColor: "bg-yellow-50",
      borderColor: "border-yellow-200",
      label: "주의",
    };
  }

  return {
    level: "low",
    color: "text-green-700",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
    label: "낮음",
  };
}

/**
 * 피크토그램으로부터 안전 수준 계산
 */
export function getSafetyLevelFromPictograms(pictograms: string[] | null | undefined): SafetyLevel {
  if (!pictograms || pictograms.length === 0) {
    return {
      level: "low",
      color: "text-green-700",
      bgColor: "bg-green-50",
      borderColor: "border-green-200",
      label: "낮음",
    };
  }

  // 고위험 피크토그램
  const criticalPictograms = ["skull", "flame", "explosive"];
  const highRiskPictograms = ["corrosive", "health-hazard", "environment"];

  const hasCritical = pictograms.some((p) => criticalPictograms.includes(p));
  const hasHighRisk = pictograms.some((p) => highRiskPictograms.includes(p));

  if (hasCritical) {
    return {
      level: "critical",
      color: "text-red-700",
      bgColor: "bg-red-50",
      borderColor: "border-red-300",
      label: "매우 위험",
    };
  }

  if (hasHighRisk) {
    return {
      level: "high",
      color: "text-red-700",
      bgColor: "bg-red-50",
      borderColor: "border-red-200",
      label: "위험",
    };
  }

  return {
    level: "medium",
    color: "text-yellow-700",
    bgColor: "bg-yellow-50",
    borderColor: "border-yellow-200",
    label: "주의",
  };
}

/**
 * 제품의 전체 안전 수준 계산
 */
export function getProductSafetyLevel(product: {
  hazardCodes?: string[] | null;
  pictograms?: string[] | null;
  msdsUrl?: string | null;
  casNo?: string | null;
}): SafetyLevel {
  // §cas-hazard-classification T1 — 미분류(unknown) 정합(안전페이지 어댑터와 동일 판정).
  //   저장 hazardCodes/pictograms 없고 casNo 정적표 미매칭 → "미분류"(낮음으로 오도 금지).
  const hasCodes = Array.isArray(product.hazardCodes) && product.hazardCodes.length > 0;
  const hasPictos = Array.isArray(product.pictograms) && product.pictograms.length > 0;
  const casResult = classifyByCas(product.casNo);
  if (!hasCodes && !hasPictos && !casResult.matched) {
    return {
      level: "unknown",
      color: "text-slate-500",
      bgColor: "bg-slate-100",
      borderColor: "border-slate-300",
      label: "미분류",
    };
  }
  // casNo 매칭이나 저장 코드 없으면 정적표 코드로 파생(어댑터 정합).
  const effectiveHazardCodes = hasCodes ? product.hazardCodes! : casResult.hazardCodes;
  const hazardLevel = getSafetyLevelFromHazardCodes(effectiveHazardCodes);
  const pictogramLevel = getSafetyLevelFromPictograms(product.pictograms);

  // 더 높은 수준을 반환
  const levels = ["low", "medium", "high", "critical"];
  const maxLevel = Math.max(
    levels.indexOf(hazardLevel.level),
    levels.indexOf(pictogramLevel.level)
  );

  const finalLevel = levels[maxLevel] as "low" | "medium" | "high" | "critical";

  // MSDS가 없으면 수준을 한 단계 올림
  if (!product.msdsUrl && finalLevel !== "critical") {
    const adjustedIndex = Math.min(maxLevel + 1, levels.length - 1);
    const adjustedLevel = levels[adjustedIndex] as "low" | "medium" | "high" | "critical";
    
    return {
      level: adjustedLevel,
      // §11.302d-6c-2 — high("위험") orange → red 격상 (critical 과 위험계열 통일,
      //   호영님 옵션 A). critical border-red-300 / high border-red-200 으로 미세 구분.
      color: adjustedLevel === "critical" ? "text-red-700" : adjustedLevel === "high" ? "text-red-700" : "text-yellow-700",
      bgColor: adjustedLevel === "critical" ? "bg-red-50" : adjustedLevel === "high" ? "bg-red-50" : "bg-yellow-50",
      borderColor: adjustedLevel === "critical" ? "border-red-300" : adjustedLevel === "high" ? "border-red-200" : "border-yellow-200",
      label: adjustedLevel === "critical" ? "매우 위험 (MSDS 없음)" : adjustedLevel === "high" ? "위험 (MSDS 없음)" : "주의 (MSDS 없음)",
    };
  }

  return finalLevel === "critical"
    ? hazardLevel
    : finalLevel === "high"
    ? hazardLevel
    : pictogramLevel;
}

/**
 * 위험 코드 설명
 */
export const HAZARD_CODE_DESCRIPTIONS: Record<string, string> = {
  H300: "치명적 독성 (경구)",
  H301: "독성 (경구)",
  H310: "치명적 독성 (피부)",
  H311: "독성 (피부)",
  H330: "치명적 독성 (흡입)",
  H331: "독성 (흡입)",
  H314: "심각한 화상 및 눈 손상",
  H318: "심각한 눈 손상",
  H340: "유전독성 가능성",
  H341: "유전독성 의심",
  H350: "발암 가능성",
  H360: "생식 독성",
  H370: "기관 손상",
  H372: "장기간 노출 시 기관 손상",
  H290: "금속 부식성",
};

/**
 * 피크토그램 설명
 */
export const PICTOGRAM_DESCRIPTIONS: Record<string, string> = {
  skull: "치명적 독성",
  flame: "인화성",
  explosive: "폭발성",
  corrosive: "부식성",
  health_hazard: "건강 위험",
  exclamation: "주의",
  environment: "환경 위험",
  gas_cylinder: "가스 실린더",
};

/**
 * PPE 설명
 */
export const PPE_DESCRIPTIONS: Record<string, string> = {
  gloves: "장갑",
  goggles: "보안경",
  "lab_coat": "실험복",
  "face_shield": "면보호구",
  "respirator": "호흡보호구",
  "safety_shoes": "안전화",
};

