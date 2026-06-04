import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

const PILOT = "scripts/pilot/pilot.ts";
const SEED = "scripts/pilot/pilot-seed.ts";

describe("§11.366 G-3 — pilot 내부키 박멸 (export 바코드/조직명/발주번호 누출 0)", () => {
  it("inv 내부키 id (inv-pilot-*) 0", () => {
    const src = read(PILOT);
    expect(src).not.toMatch(/inv-pilot-/);
  });

  it("order 내부키 id (order-pilot-*) + ORD-PILOT 발주번호 0", () => {
    const src = read(PILOT);
    expect(src).not.toMatch(/order-pilot-cell/);
    expect(src).not.toMatch(/ORD-PILOT/);
  });

  it("조직명/워크스페이스명 내부키(#P01 ADR-002 / Pilot Internal) 0 → 데모명", () => {
    const src = read(PILOT);
    expect(src).not.toMatch(/Pilot Internal Org \(#/);
    expect(src).not.toMatch(/Pilot Internal Workspace \(#/);
    expect(src).toMatch(/PILOT_ORG_NAME = "데모 연구소"/);
    expect(src).toMatch(/PILOT_WORKSPACE_NAME = "데모 워크스페이스"/);
  });

  it("발주번호 = ORD-2026-0001 (PILOT 제거)", () => {
    const src = read(PILOT);
    expect(src).toMatch(/orderNumber: "ORD-2026-0001"/);
  });

  describe("(A) upsert 키 자연키 이전 — id cuid 자동 + idempotent 보존", () => {
    it("inv upsert = @@unique([organizationId,productId]) 키", () => {
      const src = read(SEED);
      expect(src).toMatch(/organizationId_productId:\s*\{/);
      expect(src).not.toMatch(/productInventory\.upsert\(\{\s*where:\s*\{\s*id:\s*spec\.id/);
    });

    it("order upsert = orderNumber(@unique) 키 — quoteId는 [quoteId,vendorId] 복합이라 단독 불가", () => {
      const src = read(SEED);
      expect(src).toMatch(/where:\s*\{\s*orderNumber:\s*spec\.orderNumber\s*\}/);
      expect(src).not.toMatch(/order\.upsert\(\{[\s\S]{0,120}where:\s*\{\s*quoteId:\s*spec\.quoteId\s*\}/);
    });

    it("inv/order create 에서 내부키 id 미지정 (cuid 자동)", () => {
      const src = read(PILOT);
      // PilotInventorySpec / PilotOrderSpec 에 readonly id 필드 없음 → IDS export 폐기(주석 설명은 허용).
      expect(src).not.toMatch(/export const PILOT_INVENTORY_IDS/);
      expect(src).not.toMatch(/export const PILOT_ORDER_IDS/);
      expect(src).not.toMatch(/readonly id: string;\s*\n\s*readonly productId: string;/);
    });
  });

  describe("회귀 0 — cleanup 안전성 보존", () => {
    it("inv cleanup = org onDelete:Cascade (id 기반 정리 불필요)", () => {
      const src = read(PILOT);
      expect(src).toMatch(/ProductInventory\.organizationId 는 onDelete: Cascade/);
    });

    it("product/vendor/quote PK 는 보존 (미노출 내부 PK — 과변경 0)", () => {
      const src = read(SEED);
      // product/vendor/quote 는 여전히 where:{id:spec.id} (미노출이라 불변).
      expect(src).toMatch(/where:\s*\{\s*id:\s*spec\.id\s*\}/);
    });
  });
});
