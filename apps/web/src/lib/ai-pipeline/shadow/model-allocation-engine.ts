/**
 * Model Allocation Engine - 리스크 조정 모델 할당 엔진
 *
 * 비용-품질 분석 결과를 기반으로 각 문서 유형/신뢰도 구간에
 * 적합한 AI 모델을 제안합니다.
 *
 * 핵심 안전 규칙:
 * - false-safe 리스크가 0.001이라도 증가하면 모델 다운그레이드를 차단합니다.
 * - false-safe 이력이 있는 세그먼트는 절대 다운그레이드하지 않습니다.
 */

import type { CostQualitySegment } from "./cost-quality-analyzer";

// --- 타입 정의 ---

/** 모델 할당 제안 */
export interface ModelAllocation {
  /** 문서 유형 */
  documentType: string;
  /** 신뢰도 구간 */
  confidenceBand: string;
  /** 현재 사용 중인 모델 */
  currentModel: string;
  /** 제안 모델 */
  suggestedModel: string;
  /** 제안 사유 */
  reason: string;
  /** 예상 비용 절감률 (0~1) */
  expectedCostSaving: number;
  /** false-safe 리스크 증가분 (0~1) */
  falseSafeRiskIncrease: number;
  /** 차단 여부 */
  blocked: boolean;
  /** 차단 사유 (차단 시에만 존재) */
  blockReason: string | null;
}

// --- 모델 계층 정의 (비용 순, 높은 것부터) ---
// (production: DB-backed)
const MODEL_TIERS: Record<string, { tier: number; costPerToken: number }> = {
  "gpt-4o": { tier: 3, costPerToken: 0.03 },
  "gpt-4o-mini": { tier: 2, costPerToken: 0.015 },
  "gpt-3.5-turbo": { tier: 1, costPerToken: 0.002 },
};

// --- 현재 모델 할당 저장소 (production: DB-backed) ---
const currentModelMap = new Map<string, string>();

/**
 * 세그먼트 키를 생성합니다 (문서 유형 + 신뢰도 구간).
 */
function segmentKey(documentType: string, confidenceBand: string): string {
  return `${documentType}::${confidenceBand}`;
}

/**
 * 현재 모델 할당을 설정합니다 (테스트/초기화 용도).
 */
export function setCurrentModel(
  documentType: string,
  confidenceBand: string,
  model: string
): void {
  currentModelMap.set(segmentKey(documentType, confidenceBand), model);
}

/**
 * 현재 할당된 모델을 조회합니다.
 */
function getCurrentModel(
  documentType: string,
  confidenceBand: string
): string {
  return (
    currentModelMap.get(segmentKey(documentType, confidenceBand)) ?? "gpt-4o"
  );
}

/**
 * 모델이 다운그레이드인지 판별합니다.
 */
function isDowngrade(currentModel: string, suggestedModel: string): boolean {
  const currentTier = MODEL_TIERS[currentModel]?.tier ?? 0;
  const suggestedTier = MODEL_TIERS[suggestedModel]?.tier ?? 0;
  return suggestedTier < currentTier;
}

/**
 * 예상 비용 절감률을 계산합니다.
 */
function calculateCostSaving(
  currentModel: string,
  suggestedModel: string
): number {
  const currentCost = MODEL_TIERS[currentModel]?.costPerToken ?? 0;
  const suggestedCost = MODEL_TIERS[suggestedModel]?.costPerToken ?? 0;
  if (currentCost === 0) return 0;
  return (currentCost - suggestedCost) / currentCost;
}

/**
 * false-safe 리스크 증가분을 추정합니다.
 * 다운그레이드 시 tier 차이에 비례하여 리스크가 증가한다고 가정합니다.
 */
function estimateFalseSafeRiskIncrease(
  currentModel: string,
  suggestedModel: string
): number {
  const currentTier = MODEL_TIERS[currentModel]?.tier ?? 0;
  const suggestedTier = MODEL_TIERS[suggestedModel]?.tier ?? 0;
  const tierDiff = currentTier - suggestedTier;
  // 다운그레이드가 아니면 리스크 증가 없음
  if (tierDiff <= 0) return 0;
  // 티어당 0.5% 리스크 증가 추정
  return tierDiff * 0.005;
}

/**
 * 비용-품질 분석 세그먼트를 기반으로 모델 할당을 제안합니다.
 *
 * HARD BLOCK 규칙:
 * 1. falseSafeRiskIncrease > 0 (0.001이라도)이면 차단
 * 2. 세그먼트에 false-safe 이력이 있으면 다운그레이드 절대 불가
 *
 * @param segments 비용-품질 분석 세그먼트 배열
 * @returns 모델 할당 제안 배열
 */
export function proposeModelAllocations(
  segments: CostQualitySegment[]
): ModelAllocation[] {
  const allocations: ModelAllocation[] = [];

  for (const segment of segments) {
    const currentModel = getCurrentModel(
      segment.documentType,
      segment.confidenceBand
    );

    // 비용 효율이 낮은 세그먼트에 대해 더 저렴한 모델 제안 검토
    let suggestedModel = currentModel;
    let reason = "현재 모델 유지 (변경 불필요)";

    // 비용이 높고 신뢰도가 높은 경우 하위 모델 검토
    if (
      segment.confidenceBand === "HIGH" &&
      segment.falseSafeRate === 0 &&
      segment.costEfficiencyRatio > 0
    ) {
      const currentTier = MODEL_TIERS[currentModel]?.tier ?? 0;
      // 한 단계 아래 모델 찾기
      const lowerModel = Object.entries(MODEL_TIERS).find(
        ([, info]) => info.tier === currentTier - 1
      );
      if (lowerModel) {
        suggestedModel = lowerModel[0];
        reason = `높은 신뢰도 구간에서 false-safe 제로 → 비용 절감을 위한 모델 다운그레이드 검토`;
      }
    }

    const expectedCostSaving = calculateCostSaving(currentModel, suggestedModel);
    const falseSafeRiskIncrease = estimateFalseSafeRiskIncrease(
      currentModel,
      suggestedModel
    );

    let blocked = false;
    let blockReason: string | null = null;

    // HARD BLOCK 규칙 1: false-safe 리스크가 0.001이라도 증가하면 차단
    if (falseSafeRiskIncrease > 0) {
      blocked = true;
      blockReason =
        "False-safe 리스크 증가 가능성으로 모델 다운그레이드 차단";
    }

    // HARD BLOCK 규칙 2: false-safe 이력이 있는 세그먼트는 다운그레이드 절대 불가
    if (
      segment.falseSafeRate > 0 &&
      isDowngrade(currentModel, suggestedModel)
    ) {
      blocked = true;
      blockReason =
        "False-safe 이력이 존재하는 세그먼트에서는 모델 다운그레이드가 불가합니다";
    }

    allocations.push({
      documentType: segment.documentType,
      confidenceBand: segment.confidenceBand,
      currentModel,
      suggestedModel,
      reason,
      expectedCostSaving,
      falseSafeRiskIncrease,
      blocked,
      blockReason,
    });
  }

  return allocations;
}
