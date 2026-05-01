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

describe("§11.177 3 surface floating entry mount (§11.181 popup default 로 marshall 됨)", () => {
  const SURFACES: { name: string; path: string }[] = [
    { name: "inventory-content", path: "src/app/dashboard/inventory/inventory-content.tsx" },
    { name: "work-queue-console", path: "src/components/dashboard/work-queue-console.tsx" },
    { name: "purchase-orders/page", path: "src/app/dashboard/purchase-orders/page.tsx" },
  ];

  for (const { name, path } of SURFACES) {
    it(`${name} — OperationalBriefFloatingEntry import + onClick prop 없음 (popup context default)`, () => {
      const src = read(path);
      expect(src).toMatch(/OperationalBriefFloatingEntry/);
      expect(src).toMatch(/operational-brief\/floating-entry/);
      const m = src.match(/<OperationalBriefFloatingEntry[\s\S]*?\/>/);
      expect(m, `${name} FAB mount 없음`).not.toBeNull();
      expect(m![0]).not.toMatch(/\bonClick\s*=/);
    });
  }
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
