/**
 * §product-detail PD-B (§04) — 제품 정보 완성도(정직)
 *
 * 호영님 확정(2026-06-20): 완성도 % = 채워진 필드 / 산정 필드 × 100.
 *   빈 필드는 "미등록"으로 표기(가짜 채움 0). null/""/"null"/공백 = 미등록.
 *
 * §completeness-category-denominator (호영님 2026-07-26) — CEO 결정 교체:
 *   분모 8 고정 → **카테고리 적용 필드 분모**. 핀셋(TOOL)에 SDS·규제규격을 요구하지 않는다
 *   (비해당 필드를 미완성으로 경고하던 범주 오류 해소).
 *   ⛔ 부풀리기 방지는 3중 가드로 계승(구 정직론): ①universal 5 하한 ②category=DB canonical
 *      (제품별 토글 불가) ③null/미상 → 8 전부. "쉬운 필드 골라 %↑" 는 여전히 불가능.
 */

/** 완성도 산정 8필드. key = Product 필드, label = 미등록 표시용.
 *  appliesTo 생략 = universal(전 카테고리 분모 포함). 지정 시 그 카테고리에만 산정. */
export const COMPLETENESS_FIELDS = [
  { key: "catalogNumber", label: "카탈로그 번호" }, // universal
  { key: "specification", label: "규격/용량" }, // universal
  { key: "regulatoryCompliance", label: "규제 규격", appliesTo: ["REAGENT", "RAW_MATERIAL"] },
  { key: "grade", label: "등급" }, // universal
  { key: "manufacturer", label: "제조사" }, // universal
  { key: "usageDescription", label: "사용 용도" }, // universal
  { key: "storageCondition", label: "보관 조건", appliesTo: ["REAGENT", "RAW_MATERIAL", "CONSUMABLE"] },
  { key: "msdsUrl", label: "SDS/MSDS", appliesTo: ["REAGENT", "RAW_MATERIAL"] },
] as const;

/** universal 필드(appliesTo 없음) — 안티-부풀리기 하한(항상 분모 포함). */
const UNIVERSAL_COUNT = COMPLETENESS_FIELDS.filter((f) => !("appliesTo" in f)).length; // = 5

/** 조건부 필드가 인정하는 canonical 카테고리 집합(safety-settings VALID_CATEGORIES 정합).
 *  이 집합 밖(garbage·오타·미래 값)은 "미상" 으로 간주 → 전 필드 요구(부풀리기 0). */
const KNOWN_CATEGORIES = new Set(["REAGENT", "TOOL", "EQUIPMENT", "CONSUMABLE", "RAW_MATERIAL"]);

/**
 * category 에 적용되는 산정 필드.
 *   - appliesTo 없음(universal) → 항상 포함.
 *   - appliesTo 있음 → category 가 목록에 있을 때만 포함.
 *   - category null/미상/미정의 → **전 필드 포함**(보수적 폴백, 부풀리기 0).
 * 결과 분모는 항상 universal 하한(5) 이상 — 카테고리로 5 미만 못 만든다.
 */
export function applicableFields(category: string | null | undefined): typeof COMPLETENESS_FIELDS[number][] {
  // 미상 = null/공백 OR canonical 집합 밖(garbage·오타). 미정의 값을 TOOL 처럼 5 로 깎으면
  //   부풀리기 갭이 열린다 → KNOWN_CATEGORIES 밖은 전부 8(전 필드) 요구.
  const norm = category == null ? "" : String(category).trim();
  const unknown = norm === "" || !KNOWN_CATEGORIES.has(norm);
  const fields = COMPLETENESS_FIELDS.filter((f) => {
    if (!("appliesTo" in f)) return true; // universal
    if (unknown) return true; // 미상 = 전 필드 요구(관대 처리 금지)
    return (f.appliesTo as readonly string[]).includes(norm);
  });
  // 하한 가드 — 논리상 universal 만으로 이미 충족(5)이나 명시적 방어.
  return fields.length >= UNIVERSAL_COUNT ? fields : [...COMPLETENESS_FIELDS];
}

function isEmpty(v: unknown): boolean {
  if (v == null) return true;
  const s = String(v).trim();
  return s === "" || s.toLowerCase() === "null";
}

export interface CompletenessResult {
  pct: number; // 0~100
  known: number;
  total: number; // 카테고리 적용 필드 수(≥ 5)
  missingLabels: string[]; // 미등록 필드 라벨(적용 필드 한정)
}

/** 카테고리 적용 필드 분모 완성도. 분모 = applicableFields(category).length (≥ 5). */
export function computeCompleteness(product: Record<string, unknown> | null | undefined): CompletenessResult {
  const fields = applicableFields(product?.category as string | null | undefined);
  const total = fields.length;
  const missing = fields.filter((f) => isEmpty(product?.[f.key]));
  const known = total - missing.length;
  const pct = total > 0 ? Math.round((known / total) * 100) : 100;
  return { pct, known, total, missingLabels: missing.map((f) => f.label) };
}

// ─────────────────────────────────────────────────────────────
// §product-detail-refinement 계약② (D6) — 체크리스트 역할별 액션 파생
//   정본: PLAN_product-detail-sourcing-refinement.md §0-B 매트릭스(라벨 × 역할).
//   계산 로직·분모·COMPLETENESS_FIELDS 무변경. missingLabels 옆에 액션만 파생.
//   buyer = 권한 밖(사용 용도·보관 조건 등 편집)은 `정보 요청`/`SDS 요청`(→/support)으로 수렴 → dead button 0.
//   ADMIN·SUPPLIER = 편집 액션(스펙 편집·안전 정보 편집·SDS 업로드). disabled 버튼 미사용.
// ─────────────────────────────────────────────────────────────

export type CompletenessRole = "buyer" | "ADMIN" | "SUPPLIER";

export type CompletenessActionKind =
  | "info_request" // /support 정보 요청
  | "sds_request" // /support SDS 요청
  | "sds_upload" // SdsDocumentsSection 업로드
  | "spec_edit" // 스펙 편집 Dialog
  | "safety_edit"; // 안전 정보 편집 Dialog

export interface CompletenessAction {
  /** 미등록 필드 라벨(무엇이 비었는지). */
  label: string;
  /** 노출 액션 종류. */
  actionKind: CompletenessActionKind;
  /** 이동 링크(정보/SDS 요청). 편집 액션은 Dialog handler 라 href 없음. */
  href?: string;
  /** 노출 액션 라벨(버튼 텍스트). */
  actionLabel: string;
  /** 이 편집 액션에 필요한 역할(정보 요청은 undefined = 전 역할). */
  requiresRole?: CompletenessRole[];
}

const PRIVILEGED: CompletenessRole[] = ["ADMIN", "SUPPLIER"];

/** §0-B 매트릭스 — 완성도 필드 key → 역할별 액션(buyer / ADMIN·SUPPLIER). */
export const ACTION_BY_FIELD: Record<
  string,
  { buyer: CompletenessAction; privileged: CompletenessAction }
> = {
  specification: {
    buyer: { label: "규격/용량", actionKind: "info_request", href: "/support", actionLabel: "정보 요청" },
    privileged: { label: "규격/용량", actionKind: "spec_edit", actionLabel: "스펙 편집", requiresRole: PRIVILEGED },
  },
  regulatoryCompliance: {
    buyer: { label: "규제 규격", actionKind: "info_request", href: "/support", actionLabel: "정보 요청" },
    privileged: { label: "규제 규격", actionKind: "info_request", href: "/support", actionLabel: "정보 요청" },
  },
  usageDescription: {
    buyer: { label: "사용 용도", actionKind: "info_request", href: "/support", actionLabel: "정보 요청" },
    privileged: { label: "사용 용도", actionKind: "spec_edit", actionLabel: "스펙 편집", requiresRole: PRIVILEGED },
  },
  storageCondition: {
    buyer: { label: "보관 조건", actionKind: "info_request", href: "/support", actionLabel: "정보 요청" },
    privileged: { label: "보관 조건", actionKind: "safety_edit", actionLabel: "안전 정보 편집", requiresRole: PRIVILEGED },
  },
  msdsUrl: {
    buyer: { label: "SDS/MSDS", actionKind: "sds_request", href: "/support", actionLabel: "SDS 요청" },
    privileged: { label: "SDS/MSDS", actionKind: "sds_upload", actionLabel: "SDS 업로드", requiresRole: PRIVILEGED },
  },
  // §product-detail-refinement D7 — 8필드 전수 매핑(누락 3필드 보강). privileged = 스펙 편집.
  catalogNumber: {
    buyer: { label: "카탈로그 번호", actionKind: "info_request", href: "/support", actionLabel: "정보 요청" },
    privileged: { label: "카탈로그 번호", actionKind: "spec_edit", actionLabel: "스펙 편집", requiresRole: PRIVILEGED },
  },
  grade: {
    buyer: { label: "등급", actionKind: "info_request", href: "/support", actionLabel: "정보 요청" },
    privileged: { label: "등급", actionKind: "spec_edit", actionLabel: "스펙 편집", requiresRole: PRIVILEGED },
  },
  manufacturer: {
    buyer: { label: "제조사", actionKind: "info_request", href: "/support", actionLabel: "정보 요청" },
    privileged: { label: "제조사", actionKind: "spec_edit", actionLabel: "스펙 편집", requiresRole: PRIVILEGED },
  },
};

/**
 * 미등록 필드 key + 역할 → 노출 액션(buyer 는 요청 수렴, privileged 는 편집).
 *   ⚠️ 매핑 누락은 조용히 삼키지 않는다 — privileged 폴백에 info_request 반환 금지. 미정의 필드는 loud throw.
 *   ACTION_BY_FIELD 는 COMPLETENESS_FIELDS 8키 전수 매핑(폴백은 dead branch = 프로그래머 오류 방어).
 */
export function resolveCompletenessAction(fieldKey: string, role: CompletenessRole): CompletenessAction {
  const entry = ACTION_BY_FIELD[fieldKey];
  if (!entry) {
    throw new Error(
      `[completeness] ACTION_BY_FIELD 매핑 누락: "${fieldKey}" — 조용한 info_request 폴백 금지. 8필드 전수 매핑 필요.`,
    );
  }
  return role === "buyer" ? entry.buyer : entry.privileged;
}

/**
 * missingLabels 옆 파생 — 미등록 필드마다 역할별 액션. UI 는 이 배열만 소비(하드코딩 금지).
 * 항목 수는 데이터 파생(D8, `6` 하드코딩 금지).
 *
 * ⛔ D7(위험도 분류 행) 철회 — 2026-07-26.
 *   체크리스트는 **사용자가 직접 채울 수 있는 결손**만 담는다. 위험도는 `casNo` 에서 파생되는 값이라
 *   누구도 "등록" 할 수 없고, `정보 요청` 버튼도 실질 대상이 없었다(액션 불가능한 파생값).
 *   미분류 사실은 히어로 키팩트 `안전 위험도: 미분류`(getProductSafetyLevel)가 이미 고지하므로
 *   canonical 규칙(미분류를 '일반'으로 오도 금지)은 그대로 지켜진다. 여기 행은 중복이었다.
 */
export function resolveCompletenessActions(
  product: Record<string, unknown> | null | undefined,
  role: CompletenessRole,
): CompletenessAction[] {
  // §completeness-category-denominator — 체크리스트도 적용 필드만(분모와 동일 집합).
  //   TOOL 에 SDS·규제규격 행이 뜨던 범주 오류 해소. 분모에서 빠진 필드는 목록에도 없다.
  return applicableFields(product?.category as string | null | undefined)
    .filter((f) => isEmpty(product?.[f.key]))
    .map((f) => resolveCompletenessAction(f.key, role));
}
