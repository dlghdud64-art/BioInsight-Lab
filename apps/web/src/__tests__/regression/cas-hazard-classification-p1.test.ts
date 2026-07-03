/**
 * §cas-hazard-classification P1 (호영님 2026-07-04) — Product.casNo 스키마 + migration.
 *
 * 위험분류의 선행조건 = CAS 저장. OCR은 casNumber를 추출하나 저장 필드가 없어 폐기되던
 * 문제를 canonical 필드로 해소. 미분류(unknown) 상태는 분류기 출력 개념 → P2/P3.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..", "..");
const SCHEMA = readFileSync(join(ROOT, "prisma/schema.prisma"), "utf8");
const PRODUCT = SCHEMA.match(/model Product \{[\s\S]*?\n\}/)?.[0] ?? "";

describe("§cas-hazard P1 — casNo canonical 필드", () => {
  it("Product 모델에 casNo String? 필드 존재", () => {
    expect(PRODUCT).toMatch(/\n\s*casNo\s+String\?/);
  });
  it("기존 안전 필드(msdsUrl·hazardCodes·pictograms) 보존", () => {
    expect(PRODUCT).toMatch(/\n\s*msdsUrl\s+String\?/);
    expect(PRODUCT).toMatch(/\n\s*hazardCodes\s+Json\?/);
    expect(PRODUCT).toMatch(/\n\s*pictograms\s+Json\?/);
  });
});

describe("§cas-hazard P1 — migration (additive, 무손실)", () => {
  const MIG = join(ROOT, "prisma/migrations/20260704120000_add_product_cas_no/migration.sql");
  it("migration 파일 존재", () => {
    expect(existsSync(MIG)).toBe(true);
  });
  it("ADD COLUMN casNo (additive) — DROP/파괴적 구문 없음", () => {
    const sql = readFileSync(MIG, "utf8");
    expect(sql).toMatch(/ALTER TABLE "Product" ADD COLUMN "casNo" TEXT/);
    expect(sql).not.toMatch(/DROP TABLE|TRUNCATE|DELETE FROM/i);
  });
});
