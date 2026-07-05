/**
 * §SM-S1 P1 (호영님 2026-07-05) — 조직 안전(MSDS) 관리 대상 카테고리 설정(operator, migration 적용).
 * Organization.safetyCategories String[] @default(["REAGENT"]) additive·무회귀. 엔드포인트 GET(멤버)+PATCH(ADMIN/OWNER),
 * REAGENT 고정 + 유효 ProductCategory 만. P3 계약: 저장/읽기 string[] → 안전 페이지 콤마조인(P2 파싱).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const R = join(__dirname, "..", "..");
const SCHEMA = readFileSync(join(R, "..", "prisma/schema.prisma"), "utf8");
const ROUTE = readFileSync(join(R, "app/api/organizations/[id]/safety-settings/route.ts"), "utf8");

describe("§SM-S1 P1 — org safetyCategories 설정", () => {
  it("스키마 safetyCategories String[] @default(['REAGENT']) additive", () => {
    expect(SCHEMA).toMatch(/safetyCategories\s+String\[\]\s+@default\(\["REAGENT"\]\)/);
  });
  it("엔드포인트 GET(멤버 읽기) + PATCH(ADMIN/OWNER 쓰기)", () => {
    expect(ROUTE).toMatch(/export async function GET/);
    expect(ROUTE).toMatch(/export async function PATCH/);
    expect(ROUTE).toMatch(/membership\.role !== "ADMIN" && membership\.role !== "OWNER"/);
  });
  it("REAGENT 고정(항상 포함) + 유효 ProductCategory 만", () => {
    expect(ROUTE).toMatch(/Array\.from\(new Set\(\["REAGENT", \.\.\.filtered\]\)\)/);
    expect(ROUTE).toMatch(/VALID_CATEGORIES = new Set\(\["REAGENT", "TOOL", "EQUIPMENT", "RAW_MATERIAL", "CONSUMABLE"\]\)/);
  });
});
