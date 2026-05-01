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

  it("Sheet right side 640 너비 (mobile w-full)", () => {
    const src = read(PATH);
    expect(src).toMatch(/<SheetContent[\s\S]*?side="right"[\s\S]*?w-full sm:w-\[640px\]/);
  });

  it("priority list (상위 5건) + brief detail stack 분기", () => {
    const src = read(PATH);
    expect(src).toMatch(/sortedItems\.slice\(0,\s*5\)/);
    expect(src).toMatch(/PopupPriorityList/);
    expect(src).toMatch(/PopupBriefDetail/);
  });

  it("brief detail — 4-section + 4-cell MetricCell + amber alert", () => {
    const src = read(PATH);
    expect(src).toMatch(/RESOLVER 판별 근거[\s\S]*?grid-cols-2/);
    const metricCells = src.match(/<MetricCell\b/g) ?? [];
    expect(metricCells.length).toBe(4);
    expect(src).toMatch(/bg-amber-50[\s\S]*?border-amber-200/);
  });

  it("OPERATIONAL BRIEFING eyebrow + LAST UPDATED + 상황요약 + 다음 조치", () => {
    const src = read(PATH);
    expect(src).toMatch(/OPERATIONAL BRIEFING/);
    expect(src).toMatch(/LAST UPDATED/);
    expect(src).toMatch(/상황 요약/);
    expect(src).toMatch(/다음 조치/);
  });

  it("CTA — 상세 페이지 navigate (popup close 후 router.push)", () => {
    const src = read(PATH);
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

  it("useOperationalBriefPopup 호출 + onClick fallback 으로 popup.open()", () => {
    const src = read(PATH);
    expect(src).toMatch(/useOperationalBriefPopup\(\)/);
    expect(src).toMatch(/onClick\s*\?\?\s*popup\.open/);
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
