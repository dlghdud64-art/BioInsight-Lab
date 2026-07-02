/**
 * §inbound-detail-mobile-redesign (호영님 2026-07-02) — 입고 상세 모바일 시안 시트 반영.
 *
 * 결정: 라이브 입고 상세 모바일이 데스크탑 dense dock(OperationalDetailShell)로 렌더되던 것을
 *       시안 시트(#07: 헤더+스텝퍼+수령/검수 KPI+단일 통합 blocker 카드+라인 카드+footer)로 교체.
 * 원칙: 모바일 전용(lg:hidden), 데스크탑 shell 무접촉(hidden lg:block), canonical model 바인딩,
 *       CTA 는 commandSurface 실 액션 wiring(dead button 0 — 비활성은 disabled+blockedReasons).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}
const COMP = read("src/components/receiving/mobile-receiving-detail.tsx");
const PAGE = read("src/app/dashboard/receiving/[receivingId]/page.tsx");

describe("§inbound-detail-mobile-redesign — 시안 구조", () => {
  it("모바일 전용(lg:hidden) 시트 컴포넌트", () => {
    expect(COMP).toMatch(/lg:hidden/);
    expect(COMP).toMatch(/재고 반영까지 남은 \{blockerCount\}가지/);
  });
  it("스텝퍼·수령/검수 KPI·라인 카드 존재", () => {
    expect(COMP).toMatch(/PHASE_STEPS/);
    expect(COMP).toMatch(/수령 수량/);
    expect(COMP).toMatch(/검수 합격/);
    expect(COMP).toMatch(/model\.lineExecutions\.map/);
  });
  it("canonical model 필드 바인딩(파생 store 진실)", () => {
    expect(COMP).toMatch(/model\.receiptProgress/);
    expect(COMP).toMatch(/model\.inspection/);
    expect(COMP).toMatch(/model\.lotCapture/);
  });
});

describe("§inbound-detail-mobile-redesign — CTA 실 액션 wiring(dead button 0)", () => {
  it("footer 재고 반영 = commandSurface.primaryCommand.onExecute + 비활성 blockedReasons", () => {
    expect(COMP).toMatch(/commandSurface\.primaryCommand/);
    expect(COMP).toMatch(/primary\.onExecute/);
    expect(COMP).toMatch(/disabled=\{!primary \|\| !primary\.canExecute\}/);
    expect(COMP).toMatch(/primary\.blockedReasons/);
  });
  it("blocker row CTA = 실 커맨드 onExecute + canExecute 게이트", () => {
    expect(COMP).toMatch(/cmd\.canExecute \? cmd\.onExecute : undefined/);
    expect(COMP).toMatch(/disabled=\{!cmd\.canExecute\}/);
  });
});

describe("§inbound-detail-mobile-redesign — 데스크탑 shell 무접촉(회귀 0)", () => {
  it("페이지: 모바일 컴포넌트 마운트 + 데스크탑 shell hidden lg:block 보존", () => {
    expect(PAGE).toMatch(/<MobileReceivingDetail/);
    expect(PAGE).toMatch(/<div className="hidden lg:block">\s*<OperationalDetailShell/);
    expect(PAGE).toMatch(/OperationalDetailShell/);
  });
});
