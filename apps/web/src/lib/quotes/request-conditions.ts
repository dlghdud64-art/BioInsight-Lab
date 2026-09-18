/**
 * §quote-request-conditions (2026-09-18 · 릴레이 A안 승인) — 견적 요청 조건을 **발송 문구·품목 메모로 합성**한다.
 *
 * ── 왜 ──
 * 견적 요청 위저드(Step 2)가 요청 목적·긴급도·공급 전략·품목별 대체품 허용을 본문에 실어 보냈는데,
 * 서버 zod 스키마에 키가 없어 조용히 탈락했다(2026-09-17 워크스루 · 입력 4개 중 저장 0).
 * 화면은 「제출 검토」 에서 그 값을 요약해 보여준 뒤 버렸다.
 *
 * ── A안 (DB 변경 없음) ──
 *   요청 목적·긴급도·공급 전략 → 공급사에게 가는 요청 문구(Quote.description)의 「요청 조건」 블록
 *   품목별 대체품 허용          → 품목 메모(QuoteListItem.notes)
 *
 * 🛑 한계 (릴레이 조건 · 2026-09-18): 구조화 값을 **텍스트로 녹인다.** 긴급도별 필터·공급 전략별 집계는
 *   이 형태로는 불가능하다. 실제 고객이 「긴급 건만 보기」 류를 요구하는 시점이 B안(Quote·QuoteListItem 열 추가 ·
 *   prod DDL · 호영님 승인) 판단 시점이다. 지금 미리 하지 않는다.
 *   계약: __tests__/regression/quote-form-fields-persisted.test.ts
 */

export type SupplierStrategy = "compare" | "preferred" | "directed";

export interface RequestConditionInput {
  purpose?: string | null;
  urgency?: string | null;
  supplierStrategy?: string | null;
  suppliers?: string[] | null;
}

function clean(v: string | null | undefined): string {
  return typeof v === "string" ? v.trim() : "";
}

/** 공급 전략 라벨 — 위저드 선택지(비교 견적 · 선호 공급사 있음 · 지정 공급사)와 같은 말로 쓴다 */
export function supplierStrategyLabel(strategy: string | null | undefined, suppliers?: string[] | null): string | null {
  const names = (suppliers ?? []).map((s) => clean(s)).filter(Boolean);
  const list = names.length > 0 ? ` (${names.join(", ")})` : "";
  switch (clean(strategy)) {
    case "compare":
      return "비교 견적 · 2~3곳 비교 후 선정";
    case "preferred":
      return `선호 공급사 우선 · 비교 병행${list}`;
    case "directed":
      return `지정 공급사만 진행${list}`;
    default:
      return null;
  }
}

/** 요청 조건 줄 — 값이 없는 줄은 쓰지 않는다(없는 값을 기본값으로 채우지 않는다) */
export function buildRequestConditionLines(input: RequestConditionInput): string[] {
  const lines: string[] = [];
  const purpose = clean(input.purpose);
  if (purpose) lines.push(`요청 목적: ${purpose}`);
  const urgency = clean(input.urgency);
  if (urgency) lines.push(`긴급도: ${urgency}`);
  const strategy = supplierStrategyLabel(input.supplierStrategy, input.suppliers);
  if (strategy) lines.push(`공급 전략: ${strategy}`);
  return lines;
}

/** 요청 문구 끝에 붙일 「요청 조건」 블록 · 조건이 하나도 없으면 빈 문자열 */
export function requestConditionBlock(input: RequestConditionInput): string {
  const lines = buildRequestConditionLines(input);
  return lines.length > 0 ? `\n\n[요청 조건]\n${lines.join("\n")}` : "";
}

/** 품목별 대체품 허용 → 품목 메모 한 조각 · 값이 없으면 null(추정하지 않는다) */
export function substituteNote(allowSubstitute: boolean | null | undefined): string | null {
  if (allowSubstitute === true) return "대체품 허용";
  if (allowSubstitute === false) return "대체 불가";
  return null;
}

/** 기존 품목 메모와 대체품 표기를 합친다 */
export function mergeItemNotes(notes: string | null | undefined, allowSubstitute: boolean | null | undefined): string | undefined {
  const parts = [clean(notes), substituteNote(allowSubstitute) ?? ""].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : undefined;
}
