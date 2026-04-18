/**
 * Anomaly Heatmap Engine — 다차원 리스크 노출도 히트맵
 *
 * Tenant, DocType, Vendor 클러스터 등 다차원 축을 기반으로
 * 리스크 노출도와 예산 비효율 구간을 시각화 데이터로 산출합니다.
 */

export type HeatmapDimension = "TENANT" | "DOC_TYPE" | "VENDOR" | "CONFIDENCE_BAND" | "STAGE";
export type HeatmapColor = "GREEN" | "YELLOW" | "ORANGE" | "RED";

export interface HeatmapCell {
  dimensionX: string;
  dimensionY: string;
  riskScore: number;         // 0~100
  falseSafeExposure: number; // count
  costInefficiency: number;  // 0~100
  volume: number;
  color: HeatmapColor;
}

export interface HeatmapInput {
  dimensionXValue: string;
  dimensionYValue: string;
  falseSafeCount: number;
  mismatchRate: number;
  fallbackRate: number;
  avgTokenCost: number;
  reviewAvoidedRate: number;
  volume: number;
}

/**
 * 히트맵 셀 생성
 */
export function computeHeatmapCell(input: HeatmapInput): HeatmapCell {
  // Risk score: mismatch + fallback + false-safe weighted
  const riskScore = Math.min(100, Math.round(
    input.mismatchRate * 200 +
    input.fallbackRate * 150 +
    input.falseSafeCount * 20,
  ));

  // Cost inefficiency: high cost + low review avoidance
  const costInefficiency = Math.min(100, Math.round(
    (input.avgTokenCost > 0.01 ? input.avgTokenCost * 1000 : 0) +
    (1 - input.reviewAvoidedRate) * 50,
  ));

  let color: HeatmapColor;
  if (riskScore >= 70 || input.falseSafeCount > 0) color = "RED";
  else if (riskScore >= 40) color = "ORANGE";
  else if (riskScore >= 20) color = "YELLOW";
  else color = "GREEN";

  return {
    dimensionX: input.dimensionXValue,
    dimensionY: input.dimensionYValue,
    riskScore,
    falseSafeExposure: input.falseSafeCount,
    costInefficiency,
    volume: input.volume,
    color,
  };
}

/**
 * 히트맵 생성 — 입력 데이터 배열로부터 그리드 구성
 */
export function generateHeatmap(inputs: HeatmapInput[]): HeatmapCell[] {
  return inputs.map(computeHeatmapCell);
}

/**
 * 핫스팟 식별 — RED 셀만 추출
 */
export function identifyHotspots(heatmap: HeatmapCell[]): HeatmapCell[] {
  return heatmap.filter((c) => c.color === "RED").sort((a, b) => b.riskScore - a.riskScore);
}

/**
 * 비효율 구간 식별 — 비용 높고 볼륨 낮은 셀
 */
export function identifyInefficientCells(heatmap: HeatmapCell[]): HeatmapCell[] {
  return heatmap
    .filter((c) => c.costInefficiency > 50 && c.volume < 100)
    .sort((a, b) => b.costInefficiency - a.costInefficiency);
}
