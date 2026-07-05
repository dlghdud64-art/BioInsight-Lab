/**
 * §SM-S1 P3 (호영님 2026-07-05) — 안전 페이지 카테고리 토글 + fetch 배선(트랙 종료).
 * P3b: 하드코딩 REAGENT → effectiveCategories(소속 org safetyCategories 합집합, 없으면 REAGENT=무회귀) 콤마조인 fetch.
 * P3a: ADMIN/OWNER org별 토글 → csrfFetch PATCH safety-settings 실저장 → orgs 무효화 → 목록 즉시 재스코프(dead-button 아님).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const PAGE = readFileSync(join(__dirname, "..", "..", "app/dashboard/safety/page.tsx"), "utf8");

describe("§SM-S1 P3 — 안전 카테고리 토글 + fetch 배선", () => {
  it("P3b fetch = org effectiveCategories(콤마조인), 기본 REAGENT 무회귀", () => {
    expect(PAGE).toMatch(/const effectiveCategories = useMemo/);
    expect(PAGE).toMatch(/set\.add\("REAGENT"\)/);
    expect(PAGE).toMatch(/category=\$\{encodeURIComponent\(categoryParam\)\}/);
    expect(PAGE).toMatch(/queryKey:\s*\["safety-products",\s*categoryParam\]/);
  });
  it("P3a 토글 csrfFetch PATCH 실저장(dead-button 아님) + ADMIN/OWNER만", () => {
    expect(PAGE).toMatch(/csrfFetch\(`\/api\/organizations\/\$\{orgId\}\/safety-settings`/);
    expect(PAGE).toMatch(/method: "PATCH"/);
    expect(PAGE).toMatch(/const adminOrgs = useMemo/);
    expect(PAGE).toMatch(/o\.role === "ADMIN" \|\| o\.role === "OWNER"/);
    expect(PAGE).toMatch(/\{adminOrgs\.length > 0 &&/); // VIEWER 미노출
  });
  it("저장 후 orgs 무효화 → 즉시 재스코프(orgsQuery/safety-orgs 정합)", () => {
    expect(PAGE).toMatch(/queryKey:\s*\["safety-orgs"\]/);
    expect(PAGE).toMatch(/invalidateQueries\(\{ queryKey: \["safety-orgs"\] \}\)/);
  });
});
