/**
 * #post-approval-purchase-order-flow Phase 4.3 — RED→GREEN test
 *
 * mobile order tracking — quotes/[id].tsx 안 inline mount.
 *
 * 변경 4 곳:
 *   1. /api/orders/by-quote/[quoteId]/route.ts (NEW) — quote.id → Order GET
 *   2. mobile types/index.ts — OrderDetail interface
 *   3. mobile hooks/useApi.ts — useOrderByQuote + useUpdateOrderStatus
 *   4. mobile app/quotes/[id].tsx — order tracking inline section
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT_WEB = join(__dirname, "..", "..", "..");
const REPO_ROOT = join(__dirname, "..", "..", "..", "..", "..");

function readWeb(rel: string): string {
  return readFileSync(join(REPO_ROOT_WEB, rel), "utf8");
}
function readRepo(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("#post-approval-purchase-order-flow Phase 4.3 — by-quote endpoint", () => {
  const ROUTE = "src/app/api/orders/by-quote/[quoteId]/route.ts";

  it("/api/orders/by-quote/[quoteId] route 신규 file 존재", () => {
    const src = readWeb(ROUTE);
    expect(src.length).toBeGreaterThan(0);
  });

  it("GET handler + auth + quote.id → order findMany (Phase 1.2 — multi-Order per quote)", () => {
    const src = readWeb(ROUTE);
    expect(src).toMatch(/export\s+async\s+function\s+GET/);
    expect(src).toMatch(/auth\(\)/);
    expect(src).toMatch(/db\.order\.findMany[\s\S]*?quoteId/);
  });

  it("ownership 검증 (owner 또는 organizationMember)", () => {
    const src = readWeb(ROUTE);
    expect(src).toMatch(/userId|organizationMember/);
  });
});

describe("#post-approval-purchase-order-flow Phase 4.3 — mobile types", () => {
  const TYPES = "apps/mobile/types/index.ts";

  it("OrderDetail interface export", () => {
    const src = readRepo(TYPES);
    expect(src).toMatch(/(?:export\s+)?interface\s+OrderDetail/);
  });

  it("OrderDetail 의 status / orderNumber / totalAmount field 명시", () => {
    const src = readRepo(TYPES);
    expect(src).toMatch(/orderNumber:\s*string/);
    expect(src).toMatch(/status:\s*string/);
    expect(src).toMatch(/totalAmount:\s*number/);
  });
});

describe("#post-approval-purchase-order-flow Phase 4.3 — mobile hooks", () => {
  const HOOKS = "apps/mobile/hooks/useApi.ts";

  it("useOrderByQuote(quoteId) export + /api/orders/by-quote 호출", () => {
    const src = readRepo(HOOKS);
    expect(src).toMatch(/export\s+function\s+useOrderByQuote/);
    expect(src).toMatch(/\/api\/orders\/by-quote\/\$\{[^}]+\}/);
  });

  it("useUpdateOrderStatus() export + PATCH /api/orders/${id}", () => {
    const src = readRepo(HOOKS);
    expect(src).toMatch(/export\s+function\s+useUpdateOrderStatus/);
    const fnMatch = src.match(/export\s+function\s+useUpdateOrderStatus[\s\S]*?(?=export\s+function|\Z)/);
    expect(fnMatch).not.toBeNull();
    if (fnMatch) {
      expect(fnMatch[0]).toMatch(/\/api\/orders\/\$\{[^}]+\}/);
      // invalidate ['order' or 'order-by-quote']
      expect(fnMatch[0]).toMatch(/queryKey:\s*\[\s*["']order/);
    }
  });
});

describe("#post-approval-purchase-order-flow Phase 4.3 — mobile screen mount", () => {
  const SCREEN = "apps/mobile/app/quotes/[id].tsx";

  it("useOrderByQuote / useUpdateOrderStatus import", () => {
    const src = readRepo(SCREEN);
    expect(src).toMatch(/useOrderByQuote/);
    expect(src).toMatch(/useUpdateOrderStatus/);
  });

  it("주문 추적 한국어 label 명시", () => {
    const src = readRepo(SCREEN);
    expect(src).toMatch(/주문\s*추적|주문\s*상태/);
  });

  it("5 OrderStatus 한국어 (주문 완료 / 확인 / 배송 중 / 배송 완료 / 취소)", () => {
    const src = readRepo(SCREEN);
    expect(src).toContain("주문 완료");
    expect(src).toContain("배송 중");
    expect(src).toContain("배송 완료");
  });

  it("order 미존재 시 hide (Phase 1.2 — orders.map 또는 조건부 렌더)", () => {
    const src = readRepo(SCREEN);
    // Phase 1.2 swap 후: `orders.map` (multi-Order) 또는 기존 `order &&` 패턴
    expect(src).toMatch(/orders\.map|orders\.length|order\s*&&|\!order|order\s*\?/);
  });
});
