/**
 * expired lot disposal card flow — 만료 로트는 재발주보다 폐기가 먼저다
 *   (CLAUDE.md Product Constraints: 「inventory generic reorder 가 expired lot dispose 보다
 *    먼저 뜨는 방향 금지」의 집행 센티넬)
 *
 * 🛑 재앵커 §inventory-dead-tabs-removed (2026-09-26 · 호영님 판정).
 *   이 검사는 `inventory-content.tsx` 의 `InventoryCard` 를 읽고 있었는데, 그 카드는
 *   `{false && (…)}` 블록 안에서만 렌더돼 **소비자가 0**이었다. 즉 이 명제는
 *   **집행된 적이 없다** — 성공해서 옮기는 것이 아니라, 잘못된 자리를 재고 있었다.
 *   라이브 집행 자리는 `inventory-context-panel.tsx` 다(`visibleActions` 가 reorder 를 뺀다).
 *
 * ⚠️ 같이 사라진 것 — 안내 문구 2개는 **라이브에 없다**:
 *      「재입고 요청보다 폐기 처리를 먼저 진행해야 합니다.」 · 「재주문 검토는 폐기 후 진행」
 *   둘 다 죽은 카드 안에만 있었으므로 사용자가 본 적이 없다. 문구로 안내할지는 별건
 *   (§③ 미개봉 ×0.3 트랙에서 패널 문안과 함께 판단).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), "utf8");
const PANEL = read("src/components/inventory/inventory-context-panel.tsx");
const CONTENT = read("src/app/dashboard/inventory/inventory-content.tsx");

describe("expired lot disposal card flow · 라이브 집행(context panel)", () => {
  it("만료 로트 판정이 canonical 파생이다", () => {
    expect(PANEL).toContain("const isExpiredLotWithQty");
    expect(PANEL).toMatch(/isExpiredLotWithQty =\s*expiryDays !== null && expiryDays <= 0 && item\.currentQuantity > 0/);
  });

  it("🛑 만료 로트면 액션 목록에서 reorder 가 빠진다", () => {
    /* 창을 선언 블록으로 연다 — 고정 폭 슬라이스는 필드가 하나 늘면 밖으로 밀린다. */
    const i = PANEL.indexOf("const visibleActions = isExpiredLotWithQty");
    expect(i).toBeGreaterThan(0);
    const block = PANEL.slice(i, PANEL.indexOf(";", PANEL.indexOf(": actions", i)));
    expect(block).toMatch(/actions\.filter\(\(action\) => action\.type !== "reorder"\)/);
    expect(block).toMatch(/:\s*actions/);
  });

  it("🛑 재발주 카드 자체가 만료 case 에서 렌더되지 않는다", () => {
    expect(PANEL).toMatch(/if \(isExpiredLotWithQty\) return null;/);
  });

  it("폐기 진입이 살아 있다 (dead button 0)", () => {
    expect(PANEL).toContain("openDisposalDock");
    expect(CONTENT).toContain("openDisposalDock");
  });
});

describe("expired lot disposal card flow · 폐기 후 재주문 핸드오프", () => {
  it("폐기 독에서 재주문 검토로 넘기는 경로가 남아 있다", () => {
    expect(CONTENT).toContain("onNavigateToReorder={(productName) => {");
    expect(CONTENT).toContain("openReorderReview(matchingItem)");
  });
});
