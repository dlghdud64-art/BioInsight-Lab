/**
 * §inventory-reorder-surface-unify P3b — ReorderReviewSheet 바로 발주 purchasing-off 게이팅
 *   (PLAN: docs/plans/PLAN_inventory-reorder-surface-unify.md)
 *
 * honesty: ENABLE_PURCHASING off 시 "바로 발주"(PO) disabled + 정직 사유(§purchasing-hide 일관, dead button 아님).
 *   [견적 요청]·검토는 불변(live). §11.310 query-string/PO draft wiring + vendor-0 disable 보존.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}
const SHEET = "src/components/inventory/ReorderReviewSheet.tsx";

describe("§inventory-reorder-surface-unify P3b — 바로 발주 purchasing-off 게이팅", () => {
  const src = read(SHEET);
  it("ENABLE_PURCHASING flag 조회(getFlag)", () => {
    expect(src).toMatch(/from "@\/lib\/feature-flags"/);
    expect(src).toMatch(/getFlag\("ENABLE_PURCHASING"\)/);
  });
  /* ⛔ 은퇴 (2026-08-19) — "바로 발주 disabled = !hasVendor || !purchasingOn"
   *    (d) 결정 은퇴. acb71541 §reorder-quote-handoff 1b(호영님 지시문 2026-08-05)가
   *    "공급사 0 → 바로 발주 **hide**(dead button 제거) + 대체 안내" 로 교체했다.
   *    정책(dead button 0)은 살아 있고 구현 형태만 바뀌었으므로 낡음이 아니라 결정 교체다.
   *    승계: inventory-mobile-reorder-gate.test.ts L157 (hasVendor && … direct-purchase-cta)
   *    아래 it 이 그 교체의 나머지 절반(대체 안내)을 잠근다 — 은퇴로 생기던 구멍을 같이 막는다. */
  it("공급사 0 → 바로 발주 hide 의 대체 안내가 있다 (1b 후속 계약)", () => {
    /* hide 자체는 mobile-reorder-gate 가 잠근다. 여기서는 **숨긴 자리의 사유**를 잠근다.
     * 🛑 둘 중 하나만 있으면 "버튼도 없고 설명도 없는" 화면이 GREEN 으로 통과한다. */
    expect(src).toMatch(/data-testid="reorder-review-direct-purchase-hidden-note"/);
    expect(src).toMatch(/바로 발주는 공급사·단가 확정 후 가능합니다/);
    expect(src).toMatch(/!hasVendor && \(/);
  });
  it("handleDirectPurchase 가드에 purchasing-off 포함", () => {
    expect(src).toMatch(/if \(!hasVendor \|\| !purchasingOn\) return/);
  });
  it("off 시 정직 사유 노출(dead button 아님) — testid + 안내 문구", () => {
    expect(src).toMatch(/data-testid="reorder-review-purchasing-off"/);
    expect(src).toMatch(/발주 기능은 준비 중입니다/);
    expect(src).toMatch(/!purchasingOn && \(/);
  });
});

describe("§inventory-reorder-surface-unify P3b — 회귀 0 (§11.310 보존)", () => {
  const src = read(SHEET);
  /* ⛔ 은퇴 (2026-08-19) — "견적 요청(live) 불변 — quotes query string"
   *    (d) 결정 은퇴. acb71541 이 옛 형태를 **"초안 미생성 no-op 핸드오프"** 로 진단하고
   *    POST /api/quotes 실생성 → ?prepare={id} 직행으로 교체했다. 옛 계약이 결함이었다.
   *
   *    🛑 이 단언은 reorder-quote-handoff.test.ts L82 와 **정면 충돌**해 왔다:
   *         여기    toMatch(… dashboard/quotes?${params …)   있어야 한다
   *         L82  not.toMatch(… dashboard/quotes?${params …)   없어야 한다
   *       어떤 소스 상태에서도 하나는 반드시 RED 다. 공존이 불가능한데 공존해 왔다.
   *       → sentinel 도입 시 **기존 sentinel 과의 배타 충돌 검사**가 없다는 뜻이다(후보 ⑨).
   *
   *    승계 완전 — reorder-quote-handoff.test.ts L40~78 이 새 계약 8건을 잠근다
   *    (POST 실호출 · csrfFetch · ?prepare= 직행 · 실패 시 이동 0 · pending · 훅 순서 · 출처 메타). */
  it("견적 요청 CTA 는 live 로 남는다 (testid 보존)", () => {
    expect(src).toMatch(/data-testid="reorder-review-request-quote-cta"/);
  });
  it("바로 발주 PO draft wiring 불변 — purchase-orders/new + prefill", () => {
    expect(src).toMatch(/router\.push\(`\/dashboard\/purchase-orders\/new\?\$\{params\.toString\(\)\}`\)/);
    expect(src).toMatch(/prefill:\s*["']reorder-recommendation["']/);
  });
  it("amber/orange 0 (§11.310 색상 정합) — 사유 문구 muted slate", () => {
    expect(src).not.toMatch(/bg-amber-|text-amber-|bg-orange-/);
  });
});
