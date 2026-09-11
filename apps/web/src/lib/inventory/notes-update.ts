/**
 * §inventory-notes-erase (2026-09-11 prod 실측 P1) — 재고 비고(notes) PATCH 값 해석.
 *
 * 🛑 옛 로직(`api/inventory/[id]/route.ts:195`)은 `notes || existing || ''` 였다.
 *   빈 문자열은 falsy 라 기존 값으로 되돌아갔다 — 비고를 지우고 저장하면 DB 쓰기와
 *   성공 토스트와 감사 기록(`inventory_update success`)은 다 남는데 **비고만 그대로**였다.
 *   `||` 폴백이 "비움" 을 "안 넘김" 으로 삼키는 형태다.
 *
 * 계약 — "안 넘김" 과 "비움" 은 다른 사건이다:
 *   undefined     → 기존 유지 (안 넘김)
 *   "" · null     → 비움 → 저장값 null
 *   문자열        → 그 값
 * 🔑 `??` 로 바꾸는 것만으로도 빈 문자열은 통과하지만, `null` 을 "비움" 으로 받으려면
 *   undefined 와 null 을 명시적으로 갈라야 한다. 그래서 분기로 쓴다.
 * 입고일(`date`)이 오면 기존 규칙대로 `[입고일: …]` 을 한 번만 병기한다(회귀 0).
 */
export function resolveNotesUpdate(
  incoming: unknown,
  existing: string | null | undefined,
  date?: string | null,
): string | null {
  let updatedNotes: string =
    incoming === undefined
      ? (existing ?? "")
      : incoming === null
        ? ""
        : String(incoming);
  if (date) {
    const dateNote = `\n[입고일: ${date}]`;
    if (!updatedNotes.includes(dateNote)) updatedNotes = updatedNotes + dateNote;
  }
  return updatedNotes === "" ? null : updatedNotes;
}
