/**
 * #post-approval-purchase-order-flow Phase 1.3-wiring-D — RED→GREEN test
 *
 * request approve route 의 vendor-aware service wiring.
 *
 * 현재 흐름 (legacy):
 *   결재 통과 → tx.order.create 직접 호출 (1 Order, vendor 정보 없음)
 *
 * 본 batch wiring 후:
 *   결재 통과 → POCandidate fetch (quote.id 기반)
 *     ≥ 1: convertPOCandidatesToOrders({ client: tx }) → vendor 별 N Order
 *     0: legacy quote.items 기반 1 Order fallback
 *   PurchaseRequest.orderId = 첫 Order id (1:1 schema 유지)
 *
 * canonical truth = Order (DB). 결재 통과 자동 vendor PO 생성 흐름의
 * service wiring (LabAxis OS 핵심 가치).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT_WEB = join(__dirname, "..", "..", "..", "..");
const ROUTE = "src/app/api/request/[id]/approve/route.ts";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT_WEB, rel), "utf8");
}

describe("#post-approval-purchase-order-flow Phase 1.3-wiring-D — request approve service wiring", () => {
  it("`convertPOCandidatesToOrders` import 명시", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/import\s*\{[\s\S]*?convertPOCandidatesToOrders[\s\S]*?\}\s+from/);
  });

  it("`convertPOCandidatesToOrders` 호출 — outer tx 전달 (`client: tx`)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/convertPOCandidatesToOrders\s*\(/);
    expect(src).toMatch(/convertPOCandidatesToOrders[\s\S]*?client:/);
  });

  it("POCandidate fetch — quote.id 기반 (tx.pOCandidate.findMany)", () => {
    const src = read(ROUTE);
    // Prisma camelCase: POCandidate → pOCandidate
    expect(src).toMatch(/p[oO]Candidate\.findMany|p[oO]Candidate\.findFirst/);
  });

  it("legacy fallback — POCandidate 0개 시 quote.items 기반 1 Order", () => {
    const src = read(ROUTE);
    // tx.order.create 가 fallback path 로 남아 있어야 (POCandidate 0개 시).
    expect(src).toMatch(/tx\.order\.create|order\.create/);
  });

  it("PurchaseRequest.orderId 정합 — multi-Order 시 첫 Order id 매핑", () => {
    const src = read(ROUTE);
    // tx.purchaseRequest.update with orderId 패턴 유지
    expect(src).toMatch(/purchaseRequest\.update[\s\S]*?orderId/);
  });
});
