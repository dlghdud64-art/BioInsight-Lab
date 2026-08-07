/**
 * §11.302c #inventory-kpi-traffic-light — [RETIRED 세대 잠금 → 승계 재앵커]
 *
 * 원 계약(호영님 P0 2026-05-25): KPI 3개(재주문 필요/만료 임박/폐기 검토) + 신호등
 * 색상 체계. 원 판본은 inventory-main.tsx 의 구현 내부명(outOfStockCount/
 * discardCount/grid literal)을 잠갔다.
 *
 * ⚠️ 은퇴 (2026-08-06, §inventory-dead-file-cleanup 2차 — 호영님 분류표 승인):
 *   inventory-main 은 importer 0 dead file. KPI 표면은 이후 세대(§inventory-redesign
 *   07-09 · §stock-risk-consolidation canonical isReorderNeeded · §reorder-quote-handoff
 *   1a 08-05)로 재설계돼 구현 내부명이 전면 교체됨 — 의도된 대체(미배송 아님).
 *   신호등 intent 의 현행 잠금: §11.283a(모바일 KPI 숫자·도트 게이팅 재앵커) +
 *   §11.283c-2(app-wide amber/orange 폐지, 라이브 재앵커 완료).
 *   여기서는 구세대 구현의 부활만 차단한다.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const CONTENT = readFileSync(
  resolve(__dirname, "../../app/dashboard/inventory/inventory-content.tsx"),
  "utf8",
);

describe("§11.302c [RETIRED] — 구세대 KPI 구현 부활 차단", () => {
  it("구세대 내부명(dead file 세대) 라이브 재도입 0", () => {
    // dead file 복붙으로 구세대 KPI 계산이 라이브에 되살아나는 것 차단.
    // 재주문 판정의 현행 canonical 은 공유 lib isReorderNeeded (§stock-risk-consolidation).
    expect(CONTENT).not.toMatch(/const outOfStockCount\s*=\s*displayInventories\.filter/);
    expect(CONTENT).not.toMatch(/const discardCount\s*=\s*displayInventories\.filter/);
  });

  it("재주문 판정 canonical 유지 — isReorderNeeded 공유 lib", () => {
    expect(CONTENT).toMatch(/isReorderNeeded/);
  });
});
