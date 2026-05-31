/**
 * §11.333 #layout-width-inventory-brief — Regression sentinel
 *
 * 호영님 P2 (호영님 spec §11.333 직접 명명, 충돌 0, 2026-05-30):
 *   Part A — 레이아웃 폭 일관성 (운영 화면 wide 정책):
 *   - purchases/page.tsx + safety/page.tsx 옛 max-w-7xl(1280px) 제한 → max-w-full
 *   - 다른 운영 화면 (dashboard/quotes/inventory/purchase-orders/receiving/spend) 와 정합
 *   - settings = max-w-6xl narrow (의도) 보존
 *
 *   Part B — 재고 운영 브리핑 패널 UI 정정:
 *   - 4 useState default: Lot/Flow/Actions = true 펼침, History = false 접힘
 *   - 4 펼치기 button: text-[10px] → text-xs (12px) + text-slate-500 → text-slate-700 + min-h-[32px] → min-h-[36px]
 *   - §11.302 신호등 정합 보존
 *
 * canonical 보존:
 *   - settings/page.tsx max-w-6xl narrow 보존
 *   - inventory-context-panel.tsx 다른 wiring (caller props / disposal-strip / 상태 배너) 보존
 *   - §11.320 / §11.322 작업 결정 일부 번복 (Lot/Flow/Actions 펼침 시작) — 호영님 spec §11.333 P2 우선
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.333 Part A — 운영 화면 wide 정책 정합", () => {
  it("purchases/page.tsx max-w-7xl 제거 → max-w-full (운영 화면 wide)", () => {
    const src = read("src/app/dashboard/purchases/page.tsx");
    expect(src).not.toMatch(/<div className="max-w-7xl mx-auto space-y-4">/);
    expect(src).toMatch(/<div className="max-w-full mx-auto space-y-4">/);
  });

  it("safety/page.tsx max-w-7xl 제거 → max-w-full", () => {
    const src = read("src/app/dashboard/safety/page.tsx");
    expect(src).not.toMatch(/<div className="max-w-7xl mx-auto space-y-5">/);
    expect(src).toMatch(/<div className="max-w-full mx-auto space-y-5">/);
  });

  it("settings/page.tsx max-w-6xl narrow 보존 (의도된 폼 화면)", () => {
    const src = read("src/app/dashboard/settings/page.tsx");
    expect(src).toMatch(/max-w-6xl mx-auto/);
  });

  it("inventory-main + inventory-content max-w-full 보존 (이미 wide)", () => {
    const main = read("src/app/dashboard/inventory/inventory-main.tsx");
    const content = read("src/app/dashboard/inventory/inventory-content.tsx");
    expect(main).toMatch(/w-full max-w-full px-3 sm:px-4 md:px-6 py-4 md:py-8/);
    expect(content).toMatch(/w-full max-w-full px-3 sm:px-4 md:px-6 py-4 md:py-8/);
  });
});

describe("§11.333 Part B — 재고 운영 브리핑 패널 기본 펼침 정책", () => {
  it("LOT / Flow / Actions = useState(true) 기본 펼침", () => {
    const src = read("src/components/inventory/inventory-context-panel.tsx");
    expect(src).toMatch(/const \[isLotSectionExpanded, setIsLotSectionExpanded\] = useState\(true\)/);
    expect(src).toMatch(/const \[isFlowSectionExpanded, setIsFlowSectionExpanded\] = useState\(true\)/);
    expect(src).toMatch(/const \[isActionsSectionExpanded, setIsActionsSectionExpanded\] = useState\(true\)/);
  });

  it("History = useState(false) 기본 접힘 보존 (보조 정보)", () => {
    const src = read("src/components/inventory/inventory-context-panel.tsx");
    expect(src).toMatch(/const \[isHistorySectionExpanded, setIsHistorySectionExpanded\] = useState\(false\)/);
  });
});

describe("§11.333 Part B — 펼치기 button 가독성 (text-xs + text-slate-700 + min-h-[36px])", () => {
  it("옛 text-[10px] text-slate-500 min-h-[32px] 패턴 잔존 0", () => {
    const src = read("src/components/inventory/inventory-context-panel.tsx");
    expect(src).not.toMatch(/text-\[10px\] font-medium text-slate-500 hover:text-slate-900 transition-colors min-h-\[32px\]/);
  });

  it("신 text-xs + text-slate-700 + min-h-[36px] + font-semibold 적용", () => {
    const src = read("src/components/inventory/inventory-context-panel.tsx");
    const matches = (src.match(/text-xs font-semibold text-slate-700 hover:text-slate-950 transition-colors min-h-\[36px\] px-2 -mx-2 inline-flex items-center gap-1/g) || []).length;
    // 4 접기 button (Lot/Flow/Actions/History)
    expect(matches).toBeGreaterThanOrEqual(4);
  });
});

describe("§11.333 — canonical 보존 (caller props + §11.320/§11.322 다른 결정)", () => {
  it("InventoryContextPanel props 시그니처 보존 (caller 영향 0)", () => {
    const src = read("src/components/inventory/inventory-context-panel.tsx");
    expect(src).toMatch(/InventoryContextPanel/);
  });

  it("§11.320 상태 배너 + 액션 button 보존", () => {
    const src = read("src/components/inventory/inventory-context-panel.tsx");
    expect(src).toMatch(/data-testid="inventory-context-status-banner"/);
    expect(src).toMatch(/data-testid="inventory-context-primary-actions"/);
  });

  it("§11.322 인라인 row 4 testid (current/safety/expiring/shortest) 보존", () => {
    const src = read("src/components/inventory/inventory-context-panel.tsx");
    expect(src).toMatch(/data-testid="inventory-context-kpi-current"/);
    expect(src).toMatch(/data-testid="inventory-context-kpi-shortest-lot"/);
  });
});
