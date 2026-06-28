/**
 * §11.302d-6a-4-γ #dashboard-page-amber-removed — Regression sentinel
 *
 * 호영님 P1 sweep batch 4/4 (3/3) — dashboard/page.tsx. §11.302d-6a
 * (critical surfaces) 종결 batch.
 *
 * 본 의도(불변): dashboard/page.tsx 전체에 amber/orange Tailwind class 0
 *   (yellow 톤만). 이 core 가드는 아래 describe #1 가 완전 커버한다.
 *
 * §dashboard-dedup 진화(호영님 2026-06-28):
 *   - StatLine(재무 KPI3) 복원 — 확정 발주액 canonical 보존.
 *   - "즉시 처리"(urgentItems) 모바일 블록 = ActionInbox 중복 → 제거. 이에 딸린
 *     severity-key(inventoryRisk/stockRisk/quoteRisk/riskBorder, urgentItems
 *     severity "red"|"amber", border-l-red/yellow-500, noMovement yellow,
 *     "이번달지출 KPI 중복"용 spendingRisk)는 소멸.
 *   - recommendedActions 트림(호영님 수용) — r-quote(견적 검토) / r-po-conversion
 *     (발주 전환) 제거. r-compare 보존.
 *   → 위 severity-literal/yellow-swap/r-quote 단언은 대상 소멸로 retire. no-amber
 *     본 의도는 describe #1(전체 file)이 그대로 강제하므로 보호 공백 0.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const PATH = "src/app/dashboard/page.tsx";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.302d-6a-4-γ — amber/orange Tailwind class 0 (전체 file, 본 의도)", () => {
  it("bg-amber-* class 0", () => {
    const src = read(PATH);
    expect(src).not.toMatch(/bg-amber-\d/);
  });

  it("text-amber-* class 0", () => {
    const src = read(PATH);
    expect(src).not.toMatch(/text-amber-\d/);
  });

  it("border-amber-* / border-l-amber-* class 0", () => {
    const src = read(PATH);
    expect(src).not.toMatch(/border-amber-\d/);
    expect(src).not.toMatch(/border-l-amber-\d/);
  });

  it("orange Tailwind class 0 (noMovement / handoffStall)", () => {
    const src = read(PATH);
    expect(src).not.toMatch(/(bg|text|border|border-l)-orange-\d/);
  });
});

describe("§11.302d-6a-4-γ — 회귀 0 (생존 wiring 보존)", () => {
  it("spendingRisk 전용 var 부재 (이번달지출 KPI 중복 제거)", () => {
    const src = read(PATH);
    expect(src).not.toMatch(/spendingRisk/);
  });

  it("recommendedActions 비교 판정(r-compare) wiring 보존", () => {
    const src = read(PATH);
    expect(src).toMatch(/id:\s*"r-compare"/);
  });

  it("handleNavigateOrOverlay wiring 보존", () => {
    const src = read(PATH);
    expect(src).toMatch(/handleNavigateOrOverlay/);
  });
});

describe("§11.302d-6a-4-γ — retire 회귀 가드 (urgentItems severity-key 소멸)", () => {
  it("urgentItems severity 'red'|'amber' union 부재", () => {
    const src = read(PATH);
    expect(src).not.toMatch(/severity:\s*"red"\s*\|\s*"amber"/);
  });

  it("r-quote / r-po-conversion 트림(호영님 수용) — dashboard quick-action 부재", () => {
    const src = read(PATH);
    expect(src).not.toMatch(/id:\s*"r-quote"/);
    expect(src).not.toMatch(/id:\s*"r-po-conversion"/);
  });
});
