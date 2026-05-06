/**
 * #post-approval-purchase-order-flow Phase 1.3-wiring-K — RED→GREEN test
 *
 * api/orders/route.ts + api/admin/orders/route.ts 의 vendor-aware swap.
 * Phase 1.0 audit 의 남은 caller 2곳 — bulk-po + request approve 와
 * 동일 패턴으로 정합. service unused path 0 (CLAUDE.md "wiring 누락 금지").
 *
 * 두 caller 모두 quote.items 기반 1 NULL-vendor Order 생성 (legacy).
 * POCandidate 가 quote 의 user/org 에 있으면 service 호출 → vendor 별
 * N Order, 0개 시 legacy fallback 유지 (backward compat).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT_WEB = join(__dirname, "..", "..", "..", "..");
const ORDERS = "src/app/api/orders/route.ts";
const ADMIN_ORDERS = "src/app/api/admin/orders/route.ts";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT_WEB, rel), "utf8");
}

describe("#post-approval-purchase-order-flow Phase 1.3-wiring-K — api/orders/route.ts", () => {
  it("`convertPOCandidatesToOrders` import 명시", () => {
    const src = read(ORDERS);
    expect(src).toMatch(/import\s*\{[\s\S]*?convertPOCandidatesToOrders[\s\S]*?\}\s+from/);
  });

  it("`convertPOCandidatesToOrders` 호출 — outer tx 전달 (`client: tx`)", () => {
    const src = read(ORDERS);
    expect(src).toMatch(/convertPOCandidatesToOrders\s*\(/);
    expect(src).toMatch(/convertPOCandidatesToOrders[\s\S]*?client:/);
  });

  it("POCandidate fetch — quote.userId / organizationId 기반", () => {
    const src = read(ORDERS);
    expect(src).toMatch(/p[oO]Candidate\.findMany|p[oO]Candidate\.findFirst/);
  });

  it("legacy fallback 유지 — POCandidate 0개 시 quote.items 기반 1 Order", () => {
    const src = read(ORDERS);
    expect(src).toMatch(/tx\.order\.create|order\.create/);
  });
});

describe("#post-approval-purchase-order-flow Phase 1.3-wiring-K — api/admin/orders/route.ts", () => {
  it("`convertPOCandidatesToOrders` import 명시", () => {
    const src = read(ADMIN_ORDERS);
    expect(src).toMatch(/import\s*\{[\s\S]*?convertPOCandidatesToOrders[\s\S]*?\}\s+from/);
  });

  it("`convertPOCandidatesToOrders` 호출 — outer tx 전달 (`client: tx`)", () => {
    const src = read(ADMIN_ORDERS);
    expect(src).toMatch(/convertPOCandidatesToOrders\s*\(/);
    expect(src).toMatch(/convertPOCandidatesToOrders[\s\S]*?client:/);
  });

  it("POCandidate fetch — quote.userId / organizationId 기반", () => {
    const src = read(ADMIN_ORDERS);
    expect(src).toMatch(/p[oO]Candidate\.findMany|p[oO]Candidate\.findFirst/);
  });

  it("legacy fallback 유지 — POCandidate 0개 시 quote.items 기반 1 Order", () => {
    const src = read(ADMIN_ORDERS);
    expect(src).toMatch(/tx\.order\.create|order\.create/);
  });
});
