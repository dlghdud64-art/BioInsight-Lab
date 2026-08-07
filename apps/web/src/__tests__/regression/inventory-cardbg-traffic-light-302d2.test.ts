/**
 * §11.302d-2 #inventory-cardbg-traffic-light — [RETIRED 세대 잠금 → 승계 재앵커]
 *
 * 원 계약(신호등 batch): getCardBg() switch 신호등 정합. 원 판본은 dead file
 * (inventory-main, importer 0) 의 구현을 잠갔다.
 *
 * ⚠️ 은퇴·재앵커 (2026-08-06, §inventory-dead-file-cleanup 2차 — 호영님 분류표 승인):
 *   라이브(inventory-content)는 자체 getCardBg(issueType) switch 를 보유 —
 *   신호등 intent 동일, 케이스 상이 1건: no_location 은 구세대 bg-pn/30 →
 *   라이브 bg-slate-50 (라이브가 현행 truth — utility 중립 intent 는 동일).
 *   아래는 라이브 구현 실측 기준의 재앵커 잠금.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const CONTENT = readFileSync(
  resolve(__dirname, "../../app/dashboard/inventory/inventory-content.tsx"),
  "utf8",
);

describe("§11.302d-2 [재앵커] — 라이브 getCardBg(issueType) 신호등 정합", () => {
  it("getCardBg switch 라이브 실존", () => {
    expect(CONTENT).toMatch(/const getCardBg = \(issueType: IssueType\) => \{/);
  });

  it('"expired" / "out_of_stock" — bg-red-100 border-red-200 (긴급)', () => {
    expect(CONTENT).toMatch(/case "expired":\s*\n\s*case "out_of_stock":[\s\S]{0,200}bg-red-100 border-red-200/);
  });

  it('"expiring" — bg-yellow-100 border-yellow-200 (검토)', () => {
    expect(CONTENT).toMatch(/case "expiring":[\s\S]{0,120}bg-yellow-100 border-yellow-200/);
  });

  it('"low_stock" / "reorder_lead" — bg-red-100 border-red-200 (긴급)', () => {
    expect(CONTENT).toMatch(/case "low_stock":\s*\n\s*case "reorder_lead":[\s\S]{0,120}bg-red-100 border-red-200/);
  });

  it('"no_location" — bg-slate-50 중립 (utility, 구세대 bg-pn\/30 의 라이브 재앵커)', () => {
    expect(CONTENT).toMatch(/case "no_location":[\s\S]{0,120}bg-slate-50 border-slate-200/);
  });
});
