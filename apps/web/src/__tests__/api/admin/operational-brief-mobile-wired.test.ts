/**
 * §11.155 — 4 surface 가 MobileOperationalBriefSheet import + render.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SURFACES = [
  { path: "../../../app/dashboard/purchases/page.tsx",            label: "Purchase Conversion" },
  { path: "../../../app/dashboard/quotes/page.tsx",                label: "RFQ-Quote" },
  { path: "../../../app/dashboard/inbox/page.tsx",                 label: "Inbox" },
  { path: "../../../app/dashboard/inventory/inventory-content.tsx", label: "Inventory" },
];

describe("§11.155 mobile bottom sheet wiring", () => {
  for (const s of SURFACES) {
    it(`${s.label} 가 MobileOperationalBriefSheet import + render`, () => {
      const src = readFileSync(resolve(__dirname, s.path), "utf8");
      expect(src).toMatch(/MobileOperationalBriefSheet/);
      expect(src).toMatch(/objectLabel:\s*=?|objectLabel=/);
    });
  }
});
