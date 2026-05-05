/**
 * #post-approval-purchase-order-flow Phase 1.3-wiring — RED→GREEN test
 *
 * bulk-po route 의 vendor-aware Order 생성 wiring 강제.
 *
 * Phase 1.2 schema 변경 (Quote → Order 1:N) 후 bulk-po route 의 회귀 fix +
 * Phase 1.3 service (`convertPOCandidatesToOrders`) wiring:
 *   1. `q.order` 단수 → `q.orders` 복수 (1:N relation 정합)
 *   2. `q.order !== null` check → `q.orders.length > 0` (이미 발주된 견적)
 *   3. `convertPOCandidatesToOrders` import + 호출 (service unused 0)
 *   4. POCandidate fetch (quote.id 기반 결재 통과 candidate)
 *   5. legacy fallback — POCandidate 0개 시 quote.items 기반 1 Order
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT_WEB = join(__dirname, "..", "..", "..", "..");
const ROUTE = "src/app/api/work-queue/purchase-conversion/bulk-po/route.ts";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT_WEB, rel), "utf8");
}

describe("#post-approval-purchase-order-flow Phase 1.3-wiring — bulk-po schema 정합", () => {
  it("`q.orders` 복수 fetch (Quote.orders Order[] 1:N relation 정합)", () => {
    const src = read(ROUTE);
    // `order: { select` 단수 fetch 가 더 이상 없어야 함. 복수 `orders:` 패턴.
    expect(src).toMatch(/orders:\s*\{\s*select/);
  });

  it("`q.orders.length` 또는 `q.orders.some` 패턴 — 이미 발주된 견적 check", () => {
    const src = read(ROUTE);
    // 단수 `q.order !== null` 또는 `q.order` 가 더 이상 없어야 함
    expect(src).not.toMatch(/q\.order\s*!==\s*null/);
    expect(src).toMatch(/q\.orders\.length|q\.orders\.some|orders\.length/);
  });
});

describe("#post-approval-purchase-order-flow Phase 1.3-wiring — service wiring", () => {
  it("`convertPOCandidatesToOrders` import 명시", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/import\s*\{[\s\S]*?convertPOCandidatesToOrders[\s\S]*?\}\s+from/);
  });

  it("`convertPOCandidatesToOrders` 호출 — outer tx 전달", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/convertPOCandidatesToOrders\s*\(/);
    // outer tx 전달 — `client:` option 명시
    expect(src).toMatch(/convertPOCandidatesToOrders[\s\S]*?client:/);
  });

  it("POCandidate fetch — quote.id 기반 결재 통과 candidate 조회", () => {
    const src = read(ROUTE);
    // Prisma 의 model name camelCase 매핑: `POCandidate` → `pOCandidate`.
    expect(src).toMatch(/p[oO]Candidate\.findMany|p[oO]Candidate\.findFirst/);
  });

  it("legacy fallback — POCandidate 0개 시 quote.items 기반 Order 생성", () => {
    const src = read(ROUTE);
    // `tx.order.create` 가 fallback path 로 남아 있어야 (POCandidate 0개 시).
    expect(src).toMatch(/tx\.order\.create|order\.create/);
  });
});
