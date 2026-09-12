/**
 * §inventory-edit-blank-fields (호영님 2026-09-12) — 숫자 필드의 "안 넘김" 과 "비움" 을 가른다.
 *
 * resolveNotesUpdate 의 형제다. 같은 결함이 숫자 축에서 반복됐다:
 *   폼   `s.safetyStock ? parseFloat(s.safetyStock) : undefined`  ← 비우면 키가 통째로 사라진다
 *   서버 `Number("")` = 0                                        ← 빈 값이 0 으로 읽힌다
 * 두 경로 모두 "비움" 을 표현하지 못한다. 그런데 **안전재고 0 은 "미설정" 이 아니라
 * "0개까지 괜찮다"** 이다 — 알림 조건이 `safetyStock > 0` 이라 0 이면 경고가 영영 안 뜬다.
 *
 * 계약 — 세 값만 받는다:
 *   undefined   안 넘김        → 기존 유지
 *   null · ""   비움           → 저장값 null (미설정)
 *   그 밖        숫자로 해석    → NaN 이면 호출부가 400 (여기서 삼키지 않는다)
 */
export function resolveNumericUpdate(raw: unknown): number | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (typeof raw === "string" && raw.trim() === "") return null;
  return typeof raw === "string" ? Number(raw.replace(/,/g, "")) : Number(raw);
}
