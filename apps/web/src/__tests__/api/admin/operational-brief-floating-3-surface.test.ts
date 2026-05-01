/**
 * §11.177 #operational-brief-floating-entry-inventory-receiving-work-queue
 *
 * 3 surface (inventory-content / work-queue console / purchase-orders list)
 * 에 OperationalBriefFloatingEntry mount 검증.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.177 3 surface floating entry mount", () => {
  it("inventory-content.tsx — OperationalBriefFloatingEntry import + 사용 + selectedItem 토글 / displayInventories[0] hydrate", () => {
    const src = read("src/app/dashboard/inventory/inventory-content.tsx");
    expect(src).toMatch(/OperationalBriefFloatingEntry/);
    expect(src).toMatch(/operational-brief\/floating-entry/);
    expect(src).toMatch(/setSelectedItem\(\s*null\s*\)/);
    expect(src).toMatch(/setSelectedItem\(\s*displayInventories\[0\]/);
  });

  it("work-queue-console.tsx — OperationalBriefFloatingEntry import + 사용 + groups 첫 item hydrate", () => {
    const src = read("src/components/dashboard/work-queue-console.tsx");
    expect(src).toMatch(/OperationalBriefFloatingEntry/);
    expect(src).toMatch(/from\s+["']@\/components\/operational-brief\/floating-entry["']/);
    expect(src).toMatch(/groups\.find\(g\s*=>\s*g\.items\.length\s*>\s*0\)/);
    expect(src).toMatch(/setSelectedItem\(firstItem\)/);
  });

  it("purchase-orders/page.tsx — OperationalBriefFloatingEntry import + inbox auto_open=p0 lead", () => {
    const src = read("src/app/dashboard/purchase-orders/page.tsx");
    expect(src).toMatch(/OperationalBriefFloatingEntry/);
    expect(src).toMatch(/from\s+["']@\/components\/operational-brief\/floating-entry["']/);
    expect(src).toMatch(/\/dashboard\/inbox\?auto_open=p0/);
    expect(src).toMatch(/router\.push\(["']\/dashboard\/inbox\?auto_open=p0["']\)/);
  });
});

describe("§11.177 lock §11.142 호환 — facts 0 노출", () => {
  it("3 surface 모두 floating entry 자체에서 facts (status/blocker/nextAction) 노출 0", () => {
    const SURFACES = [
      "src/app/dashboard/inventory/inventory-content.tsx",
      "src/components/dashboard/work-queue-console.tsx",
      "src/app/dashboard/purchase-orders/page.tsx",
    ];
    for (const path of SURFACES) {
      const src = read(path);
      // OperationalBriefFloatingEntry 호출 부 ~ 닫는 `/>` 사이에 facts 노출 prop 없음
      const m = src.match(/<OperationalBriefFloatingEntry[\s\S]*?\/>/);
      expect(m, `${path} 에 OperationalBriefFloatingEntry mount 없음`).not.toBeNull();
      const block = m![0];
      // facts/status/blocker/nextAction prop 미사용
      expect(block).not.toMatch(/\bstatus\s*=/);
      expect(block).not.toMatch(/\bblocker\s*=/);
      expect(block).not.toMatch(/\bnextAction\s*=/);
      expect(block).not.toMatch(/\bfacts\s*=/);
    }
  });
});
