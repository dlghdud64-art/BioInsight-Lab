import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const WEB_ROOT = join(__dirname, "..", "..", "..", "..");

function read(rel: string): string {
  return readFileSync(join(WEB_ROOT, rel), "utf8");
}

describe("order dispatch readiness API contract", () => {
  it("centralizes supplier/contact readiness fields for order responses", () => {
    const src = read("src/lib/orders/dispatch-readiness.ts");

    expect(src).toContain("buildOrderDispatchReadiness");
    expect(src).toContain("supplierId");
    expect(src).toContain("contactId");
    expect(src).toContain("missingContactReason");
    expect(src).toContain("canSendToSupplier");
    expect(src).toContain("missing_supplier_contact");
    expect(src).toContain("supplier_not_selected");
  });

  it("POST /api/orders returns dispatch readiness with the created order", () => {
    const src = read("src/app/api/orders/route.ts");

    expect(src).toMatch(/buildOrderDispatchReadiness\(result\.order\)/);
    expect(src).toMatch(/dispatchReadiness/);
    expect(src).toMatch(/include:\s*\{\s*items:\s*true,\s*vendor:\s*true\s*\}/);
  });

  it("GET /api/orders/by-quote/[quoteId] returns per-order and summary dispatch readiness", () => {
    const src = read("src/app/api/orders/by-quote/[quoteId]/route.ts");

    expect(src).toMatch(/include:\s*\{\s*items:\s*true,\s*vendor:\s*true\s*\}/);
    expect(src).toMatch(/ordersWithDispatchReadiness/);
    expect(src).toMatch(/buildOrderDispatchReadiness\(order\)/);
    expect(src).toMatch(/summarizeOrderDispatchReadiness\(authorized\)/);
    expect(src).toMatch(/summarizeOrderDispatchReadiness\(\[\]\)/);
  });

  it("POST /api/admin/orders returns the same dispatch readiness contract", () => {
    const src = read("src/app/api/admin/orders/route.ts");

    expect(src).toMatch(/buildOrderDispatchReadiness\(result\.order\)/);
    expect(src).toMatch(/dispatchReadiness/);
    expect(src).toMatch(/include:\s*\{\s*items:\s*true,\s*vendor:\s*true\s*\}/);
  });
});
