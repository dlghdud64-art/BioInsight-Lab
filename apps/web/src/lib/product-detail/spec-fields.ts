/**
 * §product-detail PD-F (§03/§01) — 추가 스펙 raw key 한글화 + null/빈값 숨김
 *
 * 지시문 §01·§03: DB 컬럼명(SOURCE·TESTITEM·INTERNALGRADE·PURCHASEYEARS 등 대문자 raw)을
 *   화면에 그대로 노출 금지 + null/빈값 렌더 금지.
 *   - 화이트리스트 매핑(raw key → 한글 라벨)만 노출.
 *   - 매핑 없는 raw 대문자 컬럼형 키는 숨김(내부 필드 누출 방지 — §03 금지).
 *   - 사람이 읽는 키(pH, 순도, Grade 등)는 그대로 노출(정상 스펙).
 *   - null/""/"null"/공백 = 값 없음 → 행 자체 미렌더(§02 원칙1).
 */

/** raw 컬럼 → 한글 라벨 화이트리스트(대문자 정규화 키). */
export const SPEC_FIELD_LABELS: Record<string, string> = {
  SOURCE: "출처",
  TESTITEM: "시험 항목",
  PURCHASEYEARS: "구매 이력",
  FORMAT: "형태",
  SENSITIVITY: "감도",
  TARGET: "대상",
  "SAMPLE TYPE": "시료 종류",
  MAKER: "제조사",
};
// ★ §11.344(호영님 2026-06-20): 자사 grade(A~E)·INTERNALGRADE 는 상세 미노출.
//   GRADE/INTERNALGRADE 등 grade 계열 키는 매핑하지 않고 아래 getDisplaySpecs 에서 숨김.

/** 대문자/언더스코어 위주의 raw 컬럼형 키(=내부 필드)인지. */
const RAW_COLUMN_KEY = /^[A-Z][A-Z0-9_ ]*$/;

function isEmpty(v: unknown): boolean {
  if (v == null) return true;
  const s = String(v).trim();
  return s === "" || s.toLowerCase() === "null";
}

export interface DisplaySpec {
  label: string;
  value: string;
}

/**
 * specifications JSON → 표시용 스펙 목록.
 *   - null/빈값 제거, 화이트리스트 한글 매핑, 매핑 없는 raw 대문자 컬럼 숨김.
 */
export function getDisplaySpecs(specifications: unknown): DisplaySpec[] {
  if (!specifications || typeof specifications !== "object") return [];
  const out: DisplaySpec[] = [];
  for (const [key, value] of Object.entries(specifications as Record<string, unknown>)) {
    if (isEmpty(value)) continue; // §02 원칙1 — null/빈값 미렌더
    if (/grade/i.test(key)) continue; // ★ §11.344 — grade 계열(자사 A~E·INTERNALGRADE) 상세 미노출(호영님 결정)
    const norm = key.trim().toUpperCase();
    const mapped = SPEC_FIELD_LABELS[norm];
    if (mapped) {
      out.push({ label: mapped, value: String(value).trim() });
      continue;
    }
    // 매핑 없는 raw 대문자 컬럼 → 숨김(내부 필드 누출 방지, §03)
    if (RAW_COLUMN_KEY.test(key.trim())) continue;
    // 사람 가독 키(이미 한글/혼합)는 그대로
    out.push({ label: key.trim(), value: String(value).trim() });
  }
  return out;
}
