/**
 * @module canonical-control-spine
 * @description 정규 통제 척추 — 모든 Phase에서 파생된 통제 항목을 중복 제거하고
 * 단일 정규 척추(canonical spine)로 통합한다.
 * 안전, 거버넌스, 감사, 운영, 컴플라이언스, 복원력 카테고리로 분류된다.
 */

/** 통제 카테고리 */
export type ControlCategory =
  | "SAFETY"
  | "GOVERNANCE"
  | "AUDIT"
  | "OPERATIONS"
  | "COMPLIANCE"
  | "RESILIENCE";

/** 정규 통제 항목 */
export interface CanonicalControl {
  /** 통제 고유 ID */
  id: string;
  /** 카테고리 */
  category: ControlCategory;
  /** 설명 */
  description: string;
  /** 원본 Phase 출처 */
  sourcePhases: string[];
  /** 중복 제거된 원본 ID 목록 */
  deduplicatedFrom: string[];
  /** 정규화 여부 — 항상 true */
  canonical: true;
}

/** 척추 통계 */
export interface SpineStats {
  /** 전체 정규 통제 수 */
  totalControls: number;
  /** 카테고리별 통제 수 */
  byCategory: Record<ControlCategory, number>;
  /** 중복 제거 전 원본 수 */
  originalCount: number;
  /** 중복 제거율 (%) */
  deduplicationRate: number;
}

/** 인메모리 척추 저장소 */
const spine: CanonicalControl[] = [];

/**
 * 정규 통제 척추를 구축한다.
 * 입력된 원시 통제 항목들을 중복 제거하고 정규화한다.
 * @param rawControls - 원시 통제 항목 배열
 * @returns 구축된 정규 통제 배열
 */
export function buildCanonicalSpine(
  rawControls: Array<{
    id: string;
    category: ControlCategory;
    description: string;
    sourcePhase: string;
  }>
): CanonicalControl[] {
  // 설명 기반 중복 그룹화
  const groups = new Map<string, typeof rawControls>();

  for (const ctrl of rawControls) {
    const key = normalizeDescription(ctrl.description);
    const existing = groups.get(key);
    if (existing) {
      existing.push(ctrl);
    } else {
      groups.set(key, [ctrl]);
    }
  }

  // 기존 척추 초기화 후 재구축
  spine.length = 0;
  let idx = 0;

  groups.forEach((group) => {
    const primary = group[0];
    const phasesSet: Record<string, boolean> = {};
    group.forEach((g: { id: string; category: ControlCategory; description: string; sourcePhase: string }) => {
      phasesSet[g.sourcePhase] = true;
    });
    const canonicalControl: CanonicalControl = {
      id: `CANON-${String(idx + 1).padStart(3, "0")}`,
      category: primary.category,
      description: primary.description,
      sourcePhases: Object.keys(phasesSet),
      deduplicatedFrom: group.length > 1 ? group.map((g: { id: string; category: ControlCategory; description: string; sourcePhase: string }) => g.id) : [],
      canonical: true,
    };
    spine.push(canonicalControl);
    idx++;
  });

  return [...spine];
}

/**
 * 카테고리별 통제 항목을 반환한다.
 * @param category - 조회할 카테고리
 * @returns 해당 카테고리의 정규 통제 배열
 */
export function getControlsByCategory(
  category: ControlCategory
): CanonicalControl[] {
  return spine.filter((c) => c.category === category);
}

/**
 * 현재 척추에서 중복 항목을 찾는다.
 * @returns 중복 제거된 항목들 (deduplicatedFrom이 비어있지 않은 항목)
 */
export function findDuplicates(): CanonicalControl[] {
  return spine.filter((c) => c.deduplicatedFrom.length > 0);
}

/**
 * 척추 통계를 반환한다.
 * @returns 척추 통계 객체
 */
export function getSpineStats(): SpineStats {
  const byCategory: Record<ControlCategory, number> = {
    SAFETY: 0,
    GOVERNANCE: 0,
    AUDIT: 0,
    OPERATIONS: 0,
    COMPLIANCE: 0,
    RESILIENCE: 0,
  };

  let originalCount = 0;
  for (const ctrl of spine) {
    byCategory[ctrl.category]++;
    originalCount += Math.max(1, ctrl.deduplicatedFrom.length);
  }

  const deduplicationRate =
    originalCount > 0
      ? Math.round(((originalCount - spine.length) / originalCount) * 100)
      : 0;

  return {
    totalControls: spine.length,
    byCategory,
    originalCount,
    deduplicationRate,
  };
}

/** 설명 문자열을 정규화하여 비교 키로 사용 */
function normalizeDescription(desc: string): string {
  return desc
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
