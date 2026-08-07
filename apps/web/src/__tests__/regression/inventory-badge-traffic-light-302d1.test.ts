/**
 * §11.302d-1 #inventory-badge-traffic-light — [RETIRED 세대 잠금 → 승계 재앵커]
 *
 * 원 계약(신호등 batch): inventory-main Badge 4곳(재고 부족 ×3 긴급 red-100 +
 * 우선 사용 ×1 검토 yellow-100) swap. 원 판본은 dead file(importer 0) 의
 * 라인 위치 종속 잠금이었다.
 *
 * ⚠️ 은퇴 (2026-08-06, §inventory-dead-file-cleanup 2차 — 호영님 분류표 승인):
 *   재고 badge 표면은 라이브(inventory-content)에서 §11.302d-3 세대로 재구현 —
 *   의도된 대체(미배송 아님). 신호등 intent 중 라이브에 실존하는 계약만 승계 잠금.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const CONTENT = readFileSync(
  resolve(__dirname, "../../app/dashboard/inventory/inventory-content.tsx"),
  "utf8",
);

describe("§11.302d-1 [RETIRED → 승계] — 라이브 badge 신호등 잠금", () => {
  it('"우선 사용" Badge — 검토 spec (yellow-100 · yellow-200, §11.302d-3 라이브 세대)', () => {
    expect(CONTENT).toMatch(/§11\.302d-3 우선 사용 Badge/);
    expect(CONTENT).toMatch(/bg-yellow-100 text-yellow-700 border-yellow-200[^"]*"[^>]*>[\s\S]{0,200}우선 사용/);
  });

  it("issue 긴급 색상 — bg-red-100 계열 라이브 실존 (긴급=red 의미 보존)", () => {
    expect(CONTENT).toMatch(/bg-red-100 text-red-700/);
  });
});
