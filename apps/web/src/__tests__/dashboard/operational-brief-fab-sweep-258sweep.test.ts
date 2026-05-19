/**
 * §11.258-sweep — §11.257 후속: 다른 5 surface 의 OperationalBriefFloatingEntry +
 *   BarcodeScanFab 겹침 해소 (모바일 한정 hide).
 *
 * §11.257 dashboard 만 처리 → inventory / purchases / purchase-orders / quotes /
 *   work-queue-console 5 surface 모두 모바일에서 동일 겹침 발생 가능. minimum diff
 *   = 5 surface 의 mount 를 `hidden lg:block` wrap.
 *
 * scope §11.258-sweep:
 *   - 5 surface 모두 OperationalBriefFloatingEntry 호출을 `<div className="hidden lg:block">` wrap.
 *   - 모바일 inline link 추가는 §11.258-sweep-2 백로그 (surface 별 헤더 구조 다양 → 별도 결정).
 *
 * canonical truth lock:
 *   - OperationalBriefFloatingEntry controls="operational-brief-popup" 보존 (§11.181).
 *   - BarcodeScanFab mount (dashboard-shell.tsx) 변경 0.
 *   - §11.257 dashboard wrap 패턴 보존 (이미 처리).
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function safeRead(p: string): string {
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

const SURFACES: { name: string; path: string }[] = [
  { name: "inventory", path: "../../app/dashboard/inventory/inventory-content.tsx" },
  { name: "purchase-orders", path: "../../app/dashboard/purchase-orders/page.tsx" },
  { name: "purchases", path: "../../app/dashboard/purchases/page.tsx" },
  { name: "quotes", path: "../../app/dashboard/quotes/page.tsx" },
  { name: "work-queue-console", path: "../../components/dashboard/work-queue-console.tsx" },
];

describe("§11.258-sweep #1 — 5 surface 모바일 hide wrap", () => {
  for (const surface of SURFACES) {
    it(`${surface.name} — OperationalBriefFloatingEntry 가 'hidden lg:block' wrap`, () => {
      const code = safeRead(resolve(__dirname, surface.path));
      // <div className="hidden lg:block"> 안 OperationalBriefFloatingEntry mount.
      expect(code).toMatch(/hidden\s+lg:block[\s\S]{0,300}OperationalBriefFloatingEntry/);
    });
  }

  for (const surface of SURFACES) {
    it(`${surface.name} — §11.258-sweep trace marker`, () => {
      const code = safeRead(resolve(__dirname, surface.path));
      expect(code).toMatch(/§11\.258-sweep|11\.258-sweep|§11\.257/);
    });
  }
});

describe("§11.258-sweep — invariant 보존", () => {
  for (const surface of SURFACES) {
    it(`${surface.name} — controls="operational-brief-popup" 보존 (§11.181 정합)`, () => {
      const code = safeRead(resolve(__dirname, surface.path));
      expect(code).toMatch(/OperationalBriefFloatingEntry[\s\S]{0,200}controls=["']operational-brief-popup["']/);
    });
  }

  it("§11.257 dashboard wrap 패턴 보존 (이미 처리)", () => {
    const dashboardPath = resolve(__dirname, "../../app/dashboard/page.tsx");
    const code = safeRead(dashboardPath);
    expect(code).toMatch(/hidden\s+lg:block[\s\S]{0,300}OperationalBriefFloatingEntry/);
  });

  it("BarcodeScanFab mount (dashboard-shell.tsx) 변경 0", () => {
    const shellPath = resolve(__dirname, "../../app/dashboard/_components/dashboard-shell.tsx");
    const code = safeRead(shellPath);
    expect(code).toMatch(/BarcodeScanFab/);
  });

  it("OperationalBriefFloatingEntry 컴포넌트 시그니처 보존 (변경 0)", () => {
    const componentPath = resolve(__dirname, "../../components/operational-brief/floating-entry.tsx");
    const code = safeRead(componentPath);
    expect(code).toMatch(/fixed\s+bottom-\[72px\]\s+right-4\s+lg:bottom-6\s+lg:right-6/);
  });
});
