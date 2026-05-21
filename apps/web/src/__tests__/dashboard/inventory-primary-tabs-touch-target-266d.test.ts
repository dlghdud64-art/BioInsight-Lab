/**
 * §11.266d #inventory-primary-tabs-touch-target — inventory 1차 탭 44x44
 *   (§11.266 P1 cluster 4/5, §11.264h family cross-cutting concern 확장)
 *
 * §11.266 Phase 0 audit P2 — inventory 1차 탭 (재고/대시/입고/입출고 흐름)
 * button (line ~1565) 의 `px-4 py-2.5 text-sm` (py-2.5 = 10px*2 + text-sm ~20px)
 * = ~36-40px → 44x44 미달. 모바일 + 데스크탑 양쪽 영향. inventory surface
 * main navigation entry → 자주 사용. Apple HIG / Material / WCAG 2.1 SC 2.5.5
 * Target Size 표준 미달.
 *
 * Fix (minimum diff, Tailwind class addition):
 *   기존: relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium
 *         transition-colors whitespace-nowrap ${active ? ... : ...}
 *   신규: relative inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2.5
 *         text-sm font-medium transition-colors whitespace-nowrap ${...}
 *   - flex → inline-flex (inline tab natural — sibling 과 row 안 배치)
 *   - min-h-[44px] = 세로 44px 보장
 *   - px-4 py-2.5 / text-sm / transition-colors / whitespace-nowrap / tone
 *     모두 보존
 *
 * canonical truth lock:
 *   - setActiveInventoryTab(tab.key) onClick 보존 (4 tab key)
 *   - active 시각 (text-blue-600 + absolute bottom border bg-blue-600) 보존
 *   - 비활성 시각 (text-slate-400 hover:text-slate-600) 보존
 *   - tab.icon / tab.label / tab.suffix / tab.badge 보존
 *   - bg-rose-500 badge (lot expiring count) 보존
 *   - absolute bottom-0 active indicator 보존
 *   - whitespace-nowrap (탭 텍스트 wrap 차단) 보존
 *
 * Out-of-scope:
 *   - 2차 탭 (lot-tracking 안 sub-tab) — 별도 cluster 검토
 *   - tab.badge text-[10px] — visual subordinate, 44px 영향 X
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../app/dashboard/inventory/inventory-content.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("§11.266d #1 — inventory 1차 탭 44x44 touch target", () => {
  it("§11.266d trace marker comment 존재", () => {
    expect(page).toMatch(/§11\.266d/);
  });

  it("1차 탭 button className 에 min-h-[44px] 추가 (gap-1.5 뒤)", () => {
    expect(page).toMatch(
      /relative inline-flex items-center gap-1\.5 min-h-\[44px\] px-4 py-2\.5 text-sm/,
    );
  });

  it("1차 탭 flex → inline-flex swap (inline tab 자연)", () => {
    // 기존 'relative flex items-center' 가 'relative inline-flex items-center' 로 swap
    expect(page).toContain("relative inline-flex items-center");
  });
});

describe("§11.266d #2 — invariant 보존 (canonical truth)", () => {
  it("setActiveInventoryTab(tab.key) tab transition 보존", () => {
    expect(page).toContain("setActiveInventoryTab(tab.key);");
  });

  it("active 시각 (text-blue-600) + 비활성 (text-slate-400 hover:text-slate-600) 분기 보존", () => {
    expect(page).toMatch(
      /activeInventoryTab === tab\.key \? "text-blue-600" : "text-slate-400 hover:text-slate-600"/,
    );
  });

  it("tab.icon + tab.label render 보존", () => {
    expect(page).toMatch(/\{tab\.icon\}\s*\n?\s*\{tab\.label\}/);
  });

  it("tab.badge (bg-rose-500) render 보존", () => {
    expect(page).toMatch(
      /tab\.badge !== null && <span className="inline-flex h-4\.5 min-w-\[18px\] items-center justify-center rounded-full bg-rose-500/,
    );
  });

  it("active bottom indicator (absolute bottom-0 left-2 right-2 h-0.5 bg-blue-600) 보존", () => {
    expect(page).toMatch(
      /activeInventoryTab === tab\.key && <span className="absolute bottom-0 left-2 right-2 h-0\.5 rounded-full bg-blue-600"/,
    );
  });

  it("whitespace-nowrap (탭 텍스트 wrap 차단) 보존", () => {
    expect(page).toContain("whitespace-nowrap");
  });

  it("transition-colors 보존", () => {
    expect(page).toContain("transition-colors");
  });

  it("tab.suffix (text-[10px] text-blue-500) 보존", () => {
    expect(page).toMatch(
      /"suffix" in tab && tab\.suffix && <span className="text-\[10px\] font-bold text-blue-500/,
    );
  });

  it("현재 품목 관리 탭은 no-op CTA가 아니라 비활성 사유를 노출", () => {
    expect(page).toContain("labaxis-inventory-manage-tab");
    expect(page).toContain("현재 품목 관리 화면입니다. 운영 현황이나 조치 시작을 선택하면 화면이 전환됩니다.");
    expect(page).toContain('data-testid="labaxis-inventory-manage-current-reason"');
    expect(page).toContain("disabled:cursor-default disabled:opacity-100");
  });
});
