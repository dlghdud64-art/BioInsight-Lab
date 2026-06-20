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
