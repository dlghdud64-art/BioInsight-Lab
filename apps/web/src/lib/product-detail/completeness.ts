/**
 * §product-detail PD-B (§04) — 제품 정보 완성도(정직, 분모 고정)
 *
 * 호영님 확정(2026-06-20): 완성도 % = 채워진 8필드 / 8 × 100. 분모 8 고정.
 *   ★ 정직성(첫 세션 ④): 쉬운 필드만 골라 % 부풀리기 금지 — 규제규격·SDS 같은
 *     어려운 필드 포함. 산정 필드 집합은 여기서만 정의(분모 조작 차단).
 *   빈 필드는 "미등록"으로 표기(가짜 채움 0). null/""/"null"/공백 = 미등록.
 */

/** 완성도 산정 8필드(고정). key = Product 필드, label = 미등록 표시용. */
export const COMPLETENESS_FIELDS = [
  { key: "catalogNumber", label: "카탈로그 번호" },
  { key: "specification", label: "규격/용량" },
  { key: "regulatoryCompliance", label: "규제 규격" },
  { key: "grade", label: "등급" },
  { key: "manufacturer", label: "제조사" },
  { key: "usageDescription", label: "사용 용도" },
  { key: "storageCondition", label: "보관 조건" },
  { key: "msdsUrl", label: "SDS/MSDS" },
] as const;

function isEmpty(v: unknown): boolean {
  if (v == null) return true;
  const s = String(v).trim();
  return s === "" || s.toLowerCase() === "null";
}

export interface CompletenessResult {
  pct: number; // 0~100 (분모 = 8 고정)
  known: number;
  total: number; // 항상 8
  missingLabels: string[]; // 미등록 필드 라벨
}

/** 8필드 고정 분모 완성도. 분모를 필드 선택으로 조작하지 않음(정직). */
export function computeCompleteness(product: Record<string, unknown> | null | undefined): CompletenessResult {
  const total = COMPLETENESS_FIELDS.length; // 8 고정
  const missing = COMPLETENESS_FIELDS.filter((f) => isEmpty(product?.[f.key]));
  const known = total - missing.length;
  const pct = Math.round((known / total) * 100);
  return { pct, known, total, missingLabels: missing.map((f) => f.label) };
}

// ─────────────────────────────────────────────────────────────
// §product-detail-refinement 계약② (D6) — 체크리스트 역할별 액션 파생
//   정본: PLAN_product-detail-sourcing-refinement.md §0-B 매트릭스(라벨 × 역할).
//   계산 로직·분모·COMPLETENESS_FIELDS 무변경. missingLabels 옆에 액션만 파생.
//   buyer = 권한 밖 편집(사용 용도·보관 조건·안전 등)은 `정보 요청`/`SDS 요청`(→/support)으로 수렴 → dead button 0.
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

/** 위험도 분류 행(D7) — 완성도 필드 아님(별도 소스, classified===false). 표시 전용. */
const HAZARD_ACTION: { buyer: CompletenessAction; privileged: CompletenessAction } = {
  buyer: { label: "위험도 분류", actionKind: "info_request", href: "/support", actionLabel: "정보 요청" },
  privileged: { label: "위험도 분류", actionKind: "safety_edit", actionLabel: "안전 정보 편집", requiresRole: PRIVILEGED },
};

/**
 * 미등록 필드 key + 역할 → 노출 액션(buyer 는 요청 수렴, privileged 는 편집).
 *   D7: 매핑 누락은 조용히 삼키지 않는다 — privileged 폴백에 info_request 반환 금지. 미정의 필드는 loud throw.
 *   ACTION_BY_FIELD 는 COMPLETENESS_FIELDS 8키 전수 매핑(폴백은 dead branch = 프로그래머 오류 방어).
 */
export function resolveCompletenessAction(fieldKey: string, role: CompletenessRole): CompletenessAction {
  const entry = ACTION_BY_FIELD[fieldKey];
  if (!entry) {
    throw new Error(
      `[completeness] ACTION_BY_FIELD 매핑 누락: "${fieldKey}" — 조용한 info_request 폴백 금지(D7). 8필드 전수 매핑 필요.`,
    );
  }
  return role === "buyer" ? entry.buyer : entry.privileged;
}

/**
 * missingLabels 옆 파생 — 미등록 필드마다 역할별 액션 + (D7) 미분류 시 별도 표시 전용 행.
 *   UI 는 이 배열만 소비(하드코딩 금지). 항목 수는 데이터 파생(D8, `6` 하드코딩 금지).
 *   해당 표시 전용 행은 COMPLETENESS_FIELDS·분모 8 밖(classified===false 일 때만).
 */
export function resolveCompletenessActions(
  product: Record<string, unknown> | null | undefined,
  role: CompletenessRole,
  opts?: { classified?: boolean },
): CompletenessAction[] {
  const rows = COMPLETENESS_FIELDS.filter((f) => isEmpty(product?.[f.key])).map((f) =>
    resolveCompletenessAction(f.key, role),
  );
  // D7 — 미분류(classified === false)면 별도 소스(HAZARD_ACTION)의 표시 전용 행 추가(완성도 필드 아님, 분모 8 보존).
  if (opts?.classified === false) {
    rows.push(role === "buyer" ? HAZARD_ACTION.buyer : HAZARD_ACTION.privileged);
  }
  return rows;
}
