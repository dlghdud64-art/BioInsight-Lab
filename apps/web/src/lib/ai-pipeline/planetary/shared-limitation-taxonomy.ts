/**
 * 공유 한계 분류 체계 (Shared Limitation Taxonomy)
 *
 * 네트워크 전반에서 사용되는 표준화된 한계(limitation) 분류.
 * CRITICAL: 한계 없는 단언(assertion)은 무효이며 거부된다.
 */

/** 한계 범주 */
export type LimitationCategory =
  | "REGIONAL_RESTRICTION"
  | "DISPUTED_CLAIM"
  | "REVIEW_REQUIRED"
  | "TEMPORAL_BOUND"
  | "SCOPE_RESTRICTION"
  | "CONDITIONAL_VALIDITY";

/** 표준 한계 */
export interface StandardLimitation {
  /** 고유 식별자 */
  id: string;
  /** 한계 범주 */
  category: LimitationCategory;
  /** 설명 */
  description: string;
  /** 적용자 */
  appliedBy: string;
  /** 적용 시각 */
  appliedAt: number;
  /** 만료 시각 (null이면 무기한) */
  expiresAt: number | null;
}

// ─── 인메모리 저장소 ───
// assetId → StandardLimitation[]
const limitationStore = new Map<string, StandardLimitation[]>();

/**
 * 한계 적용
 *
 * @param assetId 대상 자산 ID
 * @param category 한계 범주
 * @param description 설명
 * @param appliedBy 적용자
 * @param expiresAt 만료 시각 (선택)
 */
export function applyLimitation(
  assetId: string,
  category: LimitationCategory,
  description: string,
  appliedBy: string,
  expiresAt?: number | null
): StandardLimitation {
  const limitation: StandardLimitation = {
    id: `lim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    category,
    description,
    appliedBy,
    appliedAt: Date.now(),
    expiresAt: expiresAt ?? null,
  };

  const existing = limitationStore.get(assetId) ?? [];
  existing.push(limitation);
  limitationStore.set(assetId, existing);

  return limitation;
}

/**
 * 한계 제거
 *
 * @param assetId 자산 ID
 * @param limitationId 제거할 한계 ID
 * @returns 제거 성공 여부
 */
export function removeLimitation(assetId: string, limitationId: string): boolean {
  const existing = limitationStore.get(assetId);
  if (!existing) return false;

  const idx = existing.findIndex((l) => l.id === limitationId);
  if (idx === -1) return false;

  existing.splice(idx, 1);
  return true;
}

/**
 * 한계 존재 검증 — 자산에 최소 1개의 유효한 한계가 있는지 확인
 *
 * CRITICAL: 한계 없는 자산은 무효
 *
 * @param assetId 자산 ID
 * @returns 유효한 한계가 존재하면 true
 */
export function validateLimitationPresence(assetId: string): boolean {
  const existing = limitationStore.get(assetId);
  if (!existing || existing.length === 0) return false;

  // 만료되지 않은 한계가 하나라도 있어야 유효
  const now = Date.now();
  return existing.some((l) => l.expiresAt === null || l.expiresAt > now);
}

/**
 * 자산별 한계 목록 조회
 */
export function getLimitationsByAsset(assetId: string): StandardLimitation[] {
  return [...(limitationStore.get(assetId) ?? [])];
}
