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
 *
 * 🛑 2차 은퇴 §inventory-dead-tabs-removed (2026-09-26 · 호영님 판정) — 「성공해서 은퇴」가 아니다.
 *   위 2026-08-06 재앵커가 옮겨 간 자리(「우선 사용」 Badge)는 `inventory-content.tsx` 의
 *   `{false && (…)}` 블록 안이었다(HEAD 2603행). 즉 이 잠금은 **처음부터 집행된 적이 없다** —
 *   렌더 0 구역을 재면서 GREEN 이었고, 그 GREEN 이 「라이브 승계 완료」 로 기록됐다.
 *   dead **파일** 은 걸렀지만 같은 파일 안의 dead **구역** 은 그 축이 보지 못했다.
 *   → 카드 배경·배지 축의 yellow=주의 잠금은 **지금 없다.** 정책(yellow=주의)은 §11.283a(KPI 축)가
 *     계속 잠그고 있다. 재앵커는 §③ 미개봉 ×0.3 트랙에서 `inventory-context-panel.tsx` ·
 *     `InventoryTable.tsx` 의 yellow 톤을 실제로 재서 수행한다(토큰 존재가 아니라 명제 일치를 먼저 확인).
 *   ✅ 재앵커 완료 (2026-09-26 · §inventory-state-tone): 재보니 맞지 않았다 — 안전재고 미만·재발주 필요가
 *      표·패널에서 yellow/blue 였다. 호영님이 「283a 를 정본으로 red 통일」 을 판정했고, 색 판정이
 *      `lib/inventory/state-tone.ts` 한 곳으로 모였다. 명제가 돌아간 자리는
 *      `regression/inventory-state-tone-single-source.test.ts` 이고, 앵커는 구현 내부명·라인이 아니라
 *      **함수의 입출력**이다. 아래 .skip 은 이관 기록으로 남긴다.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const CONTENT = readFileSync(
  resolve(__dirname, "../../app/dashboard/inventory/inventory-content.tsx"),
  "utf8",
);

describe("§11.302d-1 [RETIRED → 승계] — 라이브 badge 신호등 잠금", () => {
  /* 🛑 은퇴 (2026-09-26) — 이 명제가 물던 자리가 `{false &&` 안이었다. 헤더 참조.
   *   원 단언(복원용): CONTENT 가 `§11.302d-3 우선 사용 Badge` 주석을 갖고,
   *   `bg-yellow-100 text-yellow-700 border-yellow-200` 가 「우선 사용」 텍스트 앞 200자 안에 있다. */
  it.skip('"우선 사용" Badge · 검토 spec (yellow-100 · yellow-200) · 은퇴: 앵커가 {false &&} 안이었다', () => {
    expect(CONTENT).toMatch(/§11\.302d-3 우선 사용 Badge/);
    expect(CONTENT).toMatch(/bg-yellow-100 text-yellow-700 border-yellow-200[^"]*"[^>]*>[\s\S]{0,200}우선 사용/);
  });

  it("issue 긴급 색상 — bg-red-100 계열 라이브 실존 (긴급=red 의미 보존)", () => {
    expect(CONTENT).toMatch(/bg-red-100 text-red-700/);
  });
});
