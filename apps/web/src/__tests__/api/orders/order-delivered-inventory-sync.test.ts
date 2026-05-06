/**
 * #post-approval-receiving-auto-wiring — RED→GREEN test
 *
 * Phase 5 receiving wiring (#post-approval-purchase-order-flow plan 의 마지막
 * sub-track). Order PATCH 에서 status DELIVERED 진입 시 InventoryRestock
 * 자동 생성 — `runDeliveryInventorySync` helper 호출.
 *
 * 기존: admin status route 만 wiring (api/admin/orders/[id]/status).
 * 신규: 일반 사용자 PATCH (api/orders/[id]) 도 동일 정합.
 *
 * Lock:
 *   - status === "DELIVERED" + before.status !== "DELIVERED" 분기 (idempotent)
 *   - transaction 안 호출 (Order update + sync atomic)
 *   - try/catch graceful (sync 실패 시 logging, mutation 결과 그대로)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT_WEB = join(__dirname, "..", "..", "..", "..");
const ROUTE = "src/app/api/orders/[id]/route.ts";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT_WEB, rel), "utf8");
}

describe("#post-approval-receiving-auto-wiring — Phase 4.1 PATCH route", () => {
  it("`runDeliveryInventorySync` import 명시", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/import\s*\{[\s\S]*?runDeliveryInventorySync[\s\S]*?\}\s+from/);
  });

  it("PATCH 안 db.$transaction 사용 — Order update + sync atomic", () => {
    const src = read(ROUTE);
    // PATCH function block 안 $transaction 호출
    // §11.211 후속 hot fix — javascript regex 는 `\Z` 미지원 (PCRE 전용).
    // PATCH 가 route.ts 의 마지막 export 라 string end 까지 greedy match.
    const patchBlock = src.match(/export\s+async\s+function\s+PATCH[\s\S]*$/);
    expect(patchBlock).not.toBeNull();
    if (patchBlock) {
      expect(patchBlock[0]).toMatch(/db\.\$transaction/);
    }
  });

  it("status DELIVERED 진입 시 sync 호출 (idempotent — before.status 비교)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/runDeliveryInventorySync/);
    // DELIVERED 분기 + before.status 비교
    expect(src).toMatch(/DELIVERED[\s\S]*?before\.status|before\.status[\s\S]*?DELIVERED/);
  });

  it("try/catch graceful — sync 실패 시 mutation 결과 보존", () => {
    const src = read(ROUTE);
    // runDeliveryInventorySync 호출 부근 try/catch
    expect(src).toMatch(/try\s*\{[\s\S]*?runDeliveryInventorySync|runDeliveryInventorySync[\s\S]*?catch/);
  });
});
