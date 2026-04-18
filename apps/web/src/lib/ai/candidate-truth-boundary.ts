/**
 * Candidate Truth Boundary — presentation seed ≠ canonical candidate truth
 *
 * CLAUDE.md 규칙:
 * - canonical store field가 존재하는 경우 presentation seed가 절대 override하지 못한다.
 * - 최소 우선 canonical 대상: supplier, amount, approval-linked status, execution-linked field
 * - mock seed는 truth가 아니라는 점이 코드 계약으로 드러나게 한다.
 * - 추후 DB persistence로 전환 가능한 candidate repository 경계를 열어둔다.
 *
 * 본 모듈은:
 * 1. CanonicalCandidateFields — canonical truth에 해당하는 field 목록을 타입으로 정의
 * 2. PresentationSeed<T> — canonical field를 Readonly로 래핑해 override 불가 계약
 * 3. mergeCandidateWithSeed() — canonical truth + presentation seed를 안전하게 합성
 * 4. CandidateRepository<T> — 추후 DB persistence 전환 가능한 경계 인터페이스
 */

// ══════════════════════════════════════════════
// Canonical field keys — 이 필드는 presentation seed로 override 불가
// ══════════════════════════════════════════════

/**
 * PO / order candidate 에서 canonical truth 로 보호되는 필드 키.
 *
 * 이 키에 해당하는 값은 source of truth (governance engine, approval snapshot,
 * execution engine) 에서만 설정되며, UI preview / overlay / mock seed 로 덮어쓸 수 없다.
 */
export const CANONICAL_CANDIDATE_FIELD_KEYS = [
  // supplier identity
  "supplierId",
  "supplierName",
  "supplierEmail",
  // financial
  "totalAmount",
  "currency",
  "unitPrice",
  // approval-linked
  "approvalStatus",
  "approvalDecisionId",
  "approvalDecidedAt",
  "approvalSnapshotValid",
  // execution-linked
  "executionStatus",
  "sentAt",
  "scheduledAt",
  "outboundExecutionId",
  // conversion-linked
  "poNumber",
  "conversionSnapshotValid",
  "poConversionDraftId",
] as const;

export type CanonicalCandidateFieldKey = (typeof CANONICAL_CANDIDATE_FIELD_KEYS)[number];

// ══════════════════════════════════════════════
// PresentationSeed — canonical field는 readonly optional로 격하
// ══════════════════════════════════════════════

/**
 * Presentation seed 타입 — canonical field는 읽기 전용 + optional 로 격하되어
 * seed가 canonical truth를 override 할 수 없음을 타입 레벨에서 보장한다.
 *
 * Usage:
 * ```ts
 * type OrderSeed = PresentationSeed<OrderCandidate>;
 * // OrderSeed.supplierId 는 readonly & optional → canonical truth 보호
 * // OrderSeed.displayNote 는 원본 그대로 → presentation 전용 필드
 * ```
 */
export type PresentationSeed<T> = {
  readonly [K in keyof T as K extends CanonicalCandidateFieldKey ? K : never]?: T[K];
} & {
  [K in keyof T as K extends CanonicalCandidateFieldKey ? never : K]?: T[K];
} & {
  /** 이 seed가 truth가 아님을 나타내는 marker. runtime 체크에 사용. */
  readonly __presentationSeed: true;
};

// ══════════════════════════════════════════════
// Safe merge — canonical truth는 seed로 덮이지 않음
// ══════════════════════════════════════════════

/**
 * canonical truth와 presentation seed를 안전하게 합성한다.
 *
 * 규칙:
 * - canonical field는 truth 값이 존재하면 seed 값을 무시한다.
 * - canonical field가 truth에 없고(null/undefined) seed에 있으면 seed 값을 사용한다.
 * - non-canonical field는 seed 값으로 보충한다 (truth에 없을 때만).
 *
 * @returns canonical truth가 보호된 merged result
 */
export function mergeCandidateWithSeed<T extends Record<string, unknown>>(
  canonicalTruth: T,
  seed: Partial<T> & { __presentationSeed?: true },
): T {
  const result = { ...canonicalTruth };

  for (const key of Object.keys(seed)) {
    if (key === "__presentationSeed") continue;

    const isCanonical = (CANONICAL_CANDIDATE_FIELD_KEYS as readonly string[]).includes(key);
    const truthValue = (canonicalTruth as Record<string, unknown>)[key];

    if (isCanonical) {
      // canonical field: null/undefined 일 때만 seed 로 채움.
      // empty string 등 "의도된 빈 값" 도 truth 로 보존 (보수적 보호).
      if (truthValue !== null && truthValue !== undefined) {
        continue;
      }
    } else {
      // non-canonical (presentation) field: null/undefined/empty string 이면 seed 로 보충.
      // presentation 영역은 empty string 을 unset 으로 간주하여 fallback 을 허용한다.
      if (truthValue !== null && truthValue !== undefined && truthValue !== "") {
        continue;
      }
    }

    (result as Record<string, unknown>)[key] = (seed as Record<string, unknown>)[key];
  }

  return result;
}

/**
 * seed가 canonical field를 override 시도하는지 검사한다.
 * 개발 중 assertion / logging 에 사용.
 *
 * @returns override 시도 중인 canonical field 키 목록 (빈 배열이면 안전)
 */
export function detectCanonicalOverrideAttempts<T extends Record<string, unknown>>(
  canonicalTruth: T,
  seed: Partial<T>,
): string[] {
  const violations: string[] = [];

  for (const key of Object.keys(seed)) {
    if (key === "__presentationSeed") continue;

    const isCanonical = (CANONICAL_CANDIDATE_FIELD_KEYS as readonly string[]).includes(key);
    if (!isCanonical) continue;

    const truthValue = (canonicalTruth as Record<string, unknown>)[key];
    const seedValue = (seed as Record<string, unknown>)[key];

    if (
      truthValue !== null &&
      truthValue !== undefined &&
      seedValue !== null &&
      seedValue !== undefined &&
      truthValue !== seedValue
    ) {
      violations.push(key);
    }
  }

  return violations;
}

// ══════════════════════════════════════════════
// CandidateRepository — 추후 DB persistence 전환 경계
// ══════════════════════════════════════════════

/**
 * Candidate Repository Interface
 *
 * 현재는 in-memory (Zustand store) 기반이지만,
 * 이 인터페이스를 통해 추후 Supabase/DB persistence로 교체 가능하다.
 *
 * 계약:
 * - getCanonical(): canonical truth 반환 (presentation seed 미포함)
 * - upsertCanonical(): canonical field만 업데이트 가능
 * - getSeedOverlay(): presentation seed 반환
 * - getMerged(): canonical + seed 합성 결과 반환 (mergeCandidateWithSeed 사용)
 */
export interface CandidateRepository<T extends Record<string, unknown>> {
  /** canonical truth 반환 — presentation seed 미포함 */
  getCanonical(id: string): T | null;
  /** canonical field만 업데이트. presentation field는 무시됨. */
  upsertCanonical(id: string, data: Partial<T>): void;
  /** presentation seed 반환 */
  getSeedOverlay(id: string): Partial<T> | null;
  /** canonical + seed 합성 결과 반환 */
  getMerged(id: string): T | null;
  /** canonical truth 삭제 (invalidation 시) */
  clearCanonical(id: string): void;
}
