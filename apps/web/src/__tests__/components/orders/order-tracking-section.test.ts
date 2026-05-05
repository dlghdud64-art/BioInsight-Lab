/**
 * #post-approval-purchase-order-flow Phase 4.2 — Order tracking UI test
 *
 * components/orders/order-tracking-section.tsx (NEW) — Quote 의 Order
 * detail + status 변경 dropdown.
 *
 * Lock:
 *   - quote.id 기반 order fetch (Quote → Order 1:1)
 *   - 5 OrderStatus 한국어 label (ORDERED 주문완료 / CONFIRMED 확인됨 /
 *     SHIPPING 배송중 / DELIVERED 배송완료 / CANCELLED 취소됨)
 *   - status 변경 dropdown + 저장 button (PATCH /api/orders/[id])
 *   - dead button 0 (order 미존재 시 hide)
 *   - mutation pending state + error toast
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
const COMPONENT = "src/components/orders/order-tracking-section.tsx";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("#post-approval-purchase-order-flow Phase 4.2 — component file", () => {
  it("order-tracking-section.tsx 신규 file 존재", () => {
    const src = read(COMPONENT);
    expect(src.length).toBeGreaterThan(0);
  });

  it("export default function 또는 named export", () => {
    const src = read(COMPONENT);
    expect(src).toMatch(/export\s+(?:default\s+)?function\s+OrderTrackingSection/);
  });
});

describe("#post-approval-purchase-order-flow Phase 4.2 — Order fetch + mutation", () => {
  it("orders detail fetch (/api/orders/[id])", () => {
    const src = read(COMPONENT);
    expect(src).toMatch(/\/api\/orders\/\$\{[^}]+\}/);
  });

  it("PATCH mutation 호출", () => {
    const src = read(COMPONENT);
    expect(src).toMatch(/method:\s*["']PATCH["']/);
  });

  it("body 에 status 변경 (partial update)", () => {
    const src = read(COMPONENT);
    expect(src).toMatch(/status[\s\S]{0,100}body|body[\s\S]{0,200}status/);
  });

  it("onSuccess invalidate ['order' or 'orders']", () => {
    const src = read(COMPONENT);
    expect(src).toMatch(/invalidateQueries[\s\S]*?["']order/);
  });
});

describe("#post-approval-purchase-order-flow Phase 4.2 — 5 OrderStatus 한국어 label", () => {
  it("5 status 모두 한국어 label 명시 (주문완료 / 확인됨 / 배송중 / 배송완료 / 취소됨)", () => {
    const src = read(COMPONENT);
    expect(src).toContain("주문 완료");
    expect(src).toContain("확인");
    expect(src).toContain("배송 중");
    expect(src).toContain("배송 완료");
    expect(src).toContain("취소");
  });

  it("OrderStatus enum 5 values 매핑 (ORDERED/CONFIRMED/SHIPPING/DELIVERED/CANCELLED)", () => {
    const src = read(COMPONENT);
    expect(src).toContain("ORDERED");
    expect(src).toContain("CONFIRMED");
    expect(src).toContain("SHIPPING");
    expect(src).toContain("DELIVERED");
    expect(src).toContain("CANCELLED");
  });
});

describe("#post-approval-purchase-order-flow Phase 4.2 — dead button 0", () => {
  it("order 미존재 시 hide (return null 또는 fallback)", () => {
    const src = read(COMPONENT);
    expect(src).toMatch(/return\s+null|!order/);
  });

  it("저장 button — pending state 분기 (저장 중...)", () => {
    const src = read(COMPONENT);
    expect(src).toMatch(/isPending|저장 중|isLoading/);
  });
});
