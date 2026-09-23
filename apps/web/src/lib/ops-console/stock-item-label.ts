/**
 * 재고 항목의 화면 표시 라벨 — §stock-item-label (2026-09-22 · 호영님 판정 · 커밋 4/4)
 *
 * 🛑 `inventoryItemId` 는 내부 키다(예: `inv-item-fbs`). 화면 문구에 그대로 넣으면 사용자가 키를 읽는다.
 *    작업함 제목에서 먼저 드러났고(§inbox-seed-cutoff), 전역 sweep 에서 형제 슬롯 11곳이 더 나왔다 —
 *    차단 사유 문구 · 명령 라벨 · 재진입 요약 · 중복 사유. 시드 여부와 무관한 별개 결함이다(호영님).
 *
 * 규칙: 표시명(`itemDisplayName`)이 있으면 그것을, 없으면 **없다고 말한다**(「품목명 미확인」).
 *   내부 키로 대체하지 않는다 — 키를 보여주는 것은 정보가 아니라 노출이다.
 *
 * ⚠️ 이 fallback 이 실제로 뜨면 그건 표시명을 못 채우는 **생산자 쪽 결함**이다(별건 큐).
 */
export const STOCK_ITEM_LABEL_FALLBACK = "품목명 미확인";

export function stockItemLabel(x: { itemDisplayName?: string }): string {
  const name = x.itemDisplayName?.trim();
  return name && name.length > 0 ? name : STOCK_ITEM_LABEL_FALLBACK;
}
