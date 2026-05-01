/**
 * §11.181 #operational-brief-popup-self-contained
 *
 * Provider + Popup + DashboardShell mount + FloatingEntry default 검증.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.181 OperationalBriefPopupProvider + hook", () => {
  const PATH = "src/components/operational-brief/popup-context.tsx";

  it("파일 존재 + 'use client'", () => {
    expect(existsSync(join(REPO_ROOT, PATH))).toBe(true);
    expect(read(PATH)).toMatch(/"use client"/);
  });

  it("Provider + hook + noop fallback export", () => {
    const src = read(PATH);
    expect(src).toMatch(/export\s+function\s+OperationalBriefPopupProvider/);
    expect(src).toMatch(/export\s+function\s+useOperationalBriefPopup/);
    expect(src).toMatch(/NOOP_VALUE/);
  });

  it("context value — isOpen / open / close / selectedItemId / setSelectedItemId", () => {
    const src = read(PATH);
    expect(src).toMatch(/isOpen[^;]*?boolean/);
    expect(src).toMatch(/open:\s*\(\)\s*=>\s*void/);
    expect(src).toMatch(/close:\s*\(\)\s*=>\s*void/);
    expect(src).toMatch(/selectedItemId/);
  });

  it("close() 시 selectedItemId reset (next open 은 list 부터)", () => {
    const src = read(PATH);
    expect(src).toMatch(/close[\s\S]*?setIsOpen\(false\)[\s\S]*?setSelectedItemId\(null\)/);
  });
});

describe("§11.181 OperationalBriefPopup Sheet 컴포넌트", () => {
  const PATH = "src/components/operational-brief/popup.tsx";

  it("파일 존재 + 'use client'", () => {
    expect(existsSync(join(REPO_ROOT, PATH))).toBe(true);
    expect(read(PATH)).toMatch(/"use client"/);
  });

  it("§11.182/183 — Sheet modal 분기 (mobile=true, desktop=false) + width 400 desktop", () => {
    const src = read(PATH);
    // §11.183 — modal={isMobile} (mobile dim, desktop non-modal)
    expect(src).toMatch(/SheetPrimitive\.Root[\s\S]*?modal=\{isMobile\}/);
    // desktop 너비 md:w-[400px]
    expect(src).toMatch(/md:w-\[400px\]/);
    // SheetContent 사용 안 함 (자체 SheetPrimitive.Content)
    expect(src).toMatch(/SheetPrimitive\.Content/);
  });

  it("§11.183 — useIsMobile hook + matchMedia(max-width: 767px) + cleanup", () => {
    const src = read(PATH);
    expect(src).toMatch(/function\s+useIsMobile/);
    expect(src).toMatch(/matchMedia\(["'`]\(max-width:\s*767px\)["'`]\)/);
    expect(src).toMatch(/removeEventListener\(["']change["']/);
  });

  it("§11.183 — mobile bottom sheet vs desktop right rail responsive className", () => {
    const src = read(PATH);
    // mobile: max-md inset-x-0 bottom-0 h-[85vh] rounded-t-2xl
    expect(src).toMatch(/max-md:inset-x-0[\s\S]*?max-md:bottom-0[\s\S]*?max-md:h-\[85vh\][\s\S]*?max-md:rounded-t-2xl/);
    // desktop: md:inset-y-0 md:right-0 md:h-full md:w-[400px]
    expect(src).toMatch(/md:inset-y-0[\s\S]*?md:right-0[\s\S]*?md:h-full[\s\S]*?md:w-\[400px\]/);
    // animation 분기: mobile slide-from-bottom, desktop slide-from-right
    expect(src).toMatch(/max-md:data-\[state=open\]:slide-in-from-bottom/);
    expect(src).toMatch(/md:data-\[state=open\]:slide-in-from-right/);
  });

  it("§11.183 — mobile only Overlay mount (desktop dim 0) + onInteractOutside 분기", () => {
    const src = read(PATH);
    // {isMobile && <SheetPrimitive.Overlay ...>} — mobile만 backdrop
    expect(src).toMatch(/\{isMobile\s*&&[\s\S]*?<SheetPrimitive\.Overlay/);
    // onInteractOutside 안에서 desktop만 preventDefault (mobile은 backdrop close 허용)
    expect(src).toMatch(/onInteractOutside[\s\S]*?if\s*\(\s*!isMobile\s*\)\s*e\.preventDefault/);
  });

  it("priority list (상위 5건) + brief detail stack 분기", () => {
    const src = read(PATH);
    expect(src).toMatch(/sortedItems\.slice\(0,\s*5\)/);
    expect(src).toMatch(/PopupPriorityList/);
    expect(src).toMatch(/PopupBriefDetail/);
  });

  it("brief detail — 4-section + 4-cell MetricCell + amber alert (§11.182 판단 근거)", () => {
    const src = read(PATH);
    // §11.182 — RESOLVER 라벨 제거, "판단 근거" 사용
    expect(src).toMatch(/판단 근거[\s\S]*?grid-cols-2/);
    expect(src).not.toMatch(/RESOLVER 판별 근거/);
    const metricCells = src.match(/<MetricCell\b/g) ?? [];
    expect(metricCells.length).toBe(4);
    expect(src).toMatch(/bg-amber-50[\s\S]*?border-amber-200/);
  });

  it("§11.182 — 한국어 eyebrow + raw key 제거 (OPERATIONAL BRIEFING 0)", () => {
    const src = read(PATH);
    // 한국어 "운영 브리핑" eyebrow 사용
    expect(src).toMatch(/운영 브리핑/);
    // 영문 OPERATIONAL BRIEFING 비노출
    expect(src).not.toMatch(/OPERATIONAL BRIEFING/);
    expect(src).toMatch(/상황 요약/);
    expect(src).toMatch(/다음 조치/);
  });

  it("§11.182 — priority enum → 사람 라벨 (즉시/높음/보통/낮음)", () => {
    const src = read(PATH);
    expect(src).toMatch(/PRIORITY_HUMAN[\s\S]*?p0:\s*"즉시"/);
    expect(src).toMatch(/p1:\s*"높음"/);
    expect(src).toMatch(/p2:\s*"보통"/);
    expect(src).toMatch(/p3:\s*"낮음"/);
  });

  it("§11.182/184 — owner raw ID → 사람 라벨 매핑 + prefix fallback + 미배정", () => {
    const src = read(PATH);
    expect(src).toMatch(/OWNER_HUMAN_LABEL/);
    expect(src).toMatch(/"user-inv-001":\s*"재고 운영"/);
    expect(src).toMatch(/formatOwner/);
    expect(src).toMatch(/미배정/);
    // §11.184 — prefix-based smart fallback (raw ID 노출 0)
    expect(src).toMatch(/OWNER_PREFIX_LABEL/);
    expect(src).toMatch(/prefix:\s*"user-inv-",\s*label:\s*"재고 운영"/);
    expect(src).toMatch(/prefix:\s*"user-proc-",\s*label:\s*"구매 운영"/);
    // 마지막 fallback "담당자" — raw ID 노출 절대 0
    expect(src).toMatch(/"담당자"/);
  });

  it("§11.182 — CTA copy = item.nextAction (canonical, dead button 0)", () => {
    const src = read(PATH);
    expect(src).toMatch(/ctaLabel\s*=\s*item\.nextAction/);
    // ctaLabel falsy 시 CTA 미렌더 (dead button 0)
    expect(src).toMatch(/\{ctaLabel\s*&&/);
    // CTA 클릭 시 popup close + entityRoute navigate
    expect(src).toMatch(/onClose\(\)[\s\S]*?router\.push\(item\.entityRoute\)/);
  });
});

describe("§11.181 dashboard shell mount", () => {
  const PATH = "src/app/dashboard/_components/dashboard-shell.tsx";

  it("OperationalBriefPopupProvider import + JSX 감싸기", () => {
    const src = read(PATH);
    expect(src).toMatch(/import\s+\{\s*OperationalBriefPopupProvider\s*\}/);
    expect(src).toMatch(/<OperationalBriefPopupProvider>/);
    expect(src).toMatch(/<\/OperationalBriefPopupProvider>/);
  });

  it("OperationalBriefPopup import + mount", () => {
    const src = read(PATH);
    expect(src).toMatch(/import\s+\{\s*OperationalBriefPopup\s*\}/);
    expect(src).toMatch(/<OperationalBriefPopup\s*\/>/);
  });
});

describe("§11.181 FloatingEntry default = popup open", () => {
  const PATH = "src/components/operational-brief/floating-entry.tsx";

  it("useOperationalBriefPopup 호출 + handleClick useCallback (§11.181b — minify-safe)", () => {
    const src = read(PATH);
    expect(src).toMatch(/useOperationalBriefPopup\(\)/);
    // §11.181b — handleClick 이 useCallback 으로 wrap, body 안에서 onClick 분기 + popup.open()
    expect(src).toMatch(/handleClick\s*=\s*useCallback/);
    expect(src).toMatch(/popup\.open\(\)/);
  });

  it("open prop 미지정 시 popup.isOpen 으로 derive (aria-expanded 동기)", () => {
    const src = read(PATH);
    expect(src).toMatch(/openProp\s*\?\?\s*popup\.isOpen/);
  });
});

describe("§11.181 7 surface FAB onClick prop 제거", () => {
  const SURFACES: { name: string; path: string }[] = [
    { name: "dashboard", path: "src/app/dashboard/page.tsx" },
    { name: "inbox", path: "src/app/dashboard/inbox/page.tsx" },
    { name: "purchases", path: "src/app/dashboard/purchases/page.tsx" },
    { name: "quotes", path: "src/app/dashboard/quotes/page.tsx" },
    { name: "inventory-content", path: "src/app/dashboard/inventory/inventory-content.tsx" },
    { name: "work-queue-console", path: "src/components/dashboard/work-queue-console.tsx" },
    { name: "purchase-orders-list", path: "src/app/dashboard/purchase-orders/page.tsx" },
  ];

  for (const { name, path } of SURFACES) {
    it(`${name} — FAB block 안에 onClick prop 없음 (default popup 사용)`, () => {
      const src = read(path);
      const m = src.match(/<OperationalBriefFloatingEntry[\s\S]*?\/>/);
      expect(m, `${name} FAB mount 없음`).not.toBeNull();
      const block = m![0];
      expect(block).not.toMatch(/\bonClick\s*=/);
    });
  }
});
