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
 *
 * 🛑 2차 은퇴 §inventory-dead-tabs-removed (2026-09-26 · 호영님 판정) — 「성공해서 은퇴」가 아니다.
 *   위 재앵커가 잠갔다고 적은 `getCardBg` 는 `inventory-content.tsx` 의 `{false && (…)}`
 *   블록 안에 있었다(HEAD 2531·2552행, 출현 2곳이 **전부**). 「라이브 getCardBg 보유」 는
 *   측정 오류였고, 이 5개 단언은 **처음부터 집행된 적이 없다** — 렌더 0 구역을 재면서 GREEN 이었다.
 *   그 GREEN 이 CLAUDE.md §9 에 「302d-2 로 승계 유지(vitest GREEN 실측)」 로 기록됐다(같은 커밋에서 정정).
 *   → 카드 배경 축의 yellow=주의 잠금은 **지금 없다.** 정책은 §11.283a(KPI 축)가 계속 잠근다.
 *     재앵커는 §③ 미개봉 ×0.3 트랙에서 `inventory-context-panel.tsx`·`InventoryTable.tsx` 의
 *     yellow 톤을 실측해 수행한다 — 토큰이 있다는 것이 아니라 **명제(yellow=주의)가 맞는지**를 먼저 본다.
 *   복원용 원 명제: getCardBg(issueType) switch 가 expired·out_of_stock → bg-red-100 border-red-200 ·
 *     expiring → bg-yellow-100 border-yellow-200 · low_stock·reorder_lead → bg-red-100 border-red-200 ·
 *     no_location → bg-slate-50 중립.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const CONTENT = readFileSync(
  resolve(__dirname, "../../app/dashboard/inventory/inventory-content.tsx"),
  "utf8",
);

describe.skip("§11.302d-2 [은퇴 2026-09-26] · getCardBg 는 {false &&} 안이었다 · 집행된 적 없음", () => {
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
