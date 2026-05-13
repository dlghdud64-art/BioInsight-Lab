import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildInventoryDisposalPriority,
  summarizeInventoryDisposalPriorities,
} from "../../../lib/inventory/disposal-readiness";

const ROUTE_PATH = resolve(__dirname, "../../../app/api/inventory/route.ts");
const HELPER_PATH = resolve(__dirname, "../../../lib/inventory/disposal-readiness.ts");

describe("#inventory-disposal-priority-api contract", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-13T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("adds disposal priority data to the inventory read response", () => {
    const routeSource = readFileSync(ROUTE_PATH, "utf8");

    expect(routeSource).toMatch(/buildInventoryDisposalPriority/);
    expect(routeSource).toMatch(/disposalPriority/);
    expect(routeSource).toMatch(/disposalPrioritySummary/);
    expect(routeSource).toMatch(/summarizeInventoryDisposalPriorities/);
  });

  it("keeps disposal before reorder for expired lots with quantity", () => {
    const priority = buildInventoryDisposalPriority({
      id: "inv-1",
      lotNumber: "LOT-EXPIRED-1",
      currentQuantity: 1,
      unit: "box",
      safetyStock: 5,
      location: "Freezer A",
      expiryDate: "2026-05-01T00:00:00.000Z",
    });

    expect(priority.status).toBe("disposal_required");
    expect(priority.useProhibited).toBe(true);
    expect(priority.primaryAction).toBe("confirm_disposal");
    expect(priority.secondaryAction).toBe("reorder_after_disposal");
    expect(priority.reorderBlockedUntil).toBe("disposal_completed");
    expect(priority.lotSummary).toMatchObject({
      lotId: "LOT-EXPIRED-1",
      qty: 1,
      expiry: "2026-05-01T00:00:00.000Z",
      location: "Freezer A",
      reason: "expired_lot_use_prohibited",
    });
    expect(priority.lotSummary.stockImpact).toMatchObject({
      beforeQty: 1,
      disposalQty: 1,
      afterDisposalQty: 0,
      safetyStock: 5,
      belowSafetyAfterDisposal: true,
    });
  });

  it("summarizes deferred reorder as a disposal-first queue", () => {
    const summary = summarizeInventoryDisposalPriorities([
      {
        id: "inv-1",
        lotNumber: "LOT-EXPIRED-1",
        currentQuantity: 1,
        safetyStock: 5,
        expiryDate: "2026-05-01T00:00:00.000Z",
      },
      {
        id: "inv-2",
        lotNumber: "LOT-OK-1",
        currentQuantity: 9,
        safetyStock: 3,
        expiryDate: "2026-07-01T00:00:00.000Z",
      },
    ]);

    expect(summary).toMatchObject({
      total: 2,
      expiredLotCount: 1,
      disposalRequiredCount: 1,
      reorderDeferredCount: 1,
      primaryActionOrder: ["confirm_disposal", "reorder_after_disposal"],
    });
  });

  it("documents the API fields Agent Board expects to see", () => {
    const helperSource = readFileSync(HELPER_PATH, "utf8");

    expect(helperSource).toMatch(/lotId/);
    expect(helperSource).toMatch(/qty/);
    expect(helperSource).toMatch(/expiry/);
    expect(helperSource).toMatch(/location/);
    expect(helperSource).toMatch(/reason/);
    expect(helperSource).toMatch(/stockImpact/);
    expect(helperSource.indexOf("confirm_disposal")).toBeLessThan(
      helperSource.indexOf("reorder_after_disposal")
    );
  });
});
