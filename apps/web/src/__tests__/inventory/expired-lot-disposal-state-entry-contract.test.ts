import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { LABAXIS_STATE_ENTRY_PROFILES } from "../../lib/browser-pilot/state-entry-contract";

const inventorySource = readFileSync(
  resolve(process.cwd(), "src/app/dashboard/inventory/inventory-content.tsx"),
  "utf8",
);

const tableSource = readFileSync(
  resolve(process.cwd(), "src/components/inventory/InventoryTable.tsx"),
  "utf8",
);

const dockSource = readFileSync(
  resolve(process.cwd(), "src/components/inventory/lot-disposal-panel.tsx"),
  "utf8",
);

describe("inventory disposal state-entry contract", () => {
  it("keeps the browser pilot route locked to inventory disposal", () => {
    expect(LABAXIS_STATE_ENTRY_PROFILES["inventory-disposal"].route).toBe(
      "/dashboard/inventory",
    );
  });

  it("exposes required state-entry anchors for expired lot disposal", () => {
    const required =
      LABAXIS_STATE_ENTRY_PROFILES["inventory-disposal"].requiredTestIds;

    expect(inventorySource).toContain(required.priorityBanner);
    expect(tableSource).toContain(required.expiredLotRow);
    expect(inventorySource).toContain(required.disposalCta);
    expect(dockSource).toContain(required.disposalDock);
    expect(dockSource).toContain(required.disposalImpactSummary);
  });
});
