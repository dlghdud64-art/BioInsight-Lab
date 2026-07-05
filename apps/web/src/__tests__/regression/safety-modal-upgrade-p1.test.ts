/**
 * §safety-modal-upgrade P1 (호영님 2026-07-04) — 안전 관리 = 시약(REAGENT) 한정.
 * 핸드오프 §0: 비시약(기구·장비·원료·소모품)이 안전 목록/미등록 KPI에 섞이는 데이터 오류 해소.
 * canonical: 서버 필터(/api/safety/products?category=REAGENT). KPI는 filtered items 파생.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const PAGE = readFileSync(join(__dirname, "..", "..", "app/dashboard/safety/page.tsx"), "utf8");

describe("§safety-modal-upgrade P1 — 시약 카테고리 필터(§SM-S1 P3 org 설정 기반)", () => {
  it("안전 목록 fetch 가 org 설정 category(콤마조인) 서버 필터를 건다 — 기본 REAGENT 무회귀", () => {
    // §SM-S1 P3 — 하드코딩 REAGENT → effectiveCategories(org safetyCategories 합집합) 동적. 설정 없으면 REAGENT.
    expect(PAGE).toMatch(/\/api\/safety\/products\?limit=100&category=\$\{encodeURIComponent\(categoryParam\)\}/);
    expect(PAGE).toMatch(/set\.add\("REAGENT"\)/);
  });
  it("queryKey 에 category 스코프 포함(캐시 정합)", () => {
    expect(PAGE).toMatch(/queryKey:\s*\["safety-products",\s*categoryParam\]/);
  });
  it("비필터(전체 카테고리) fetch 잔재 0 — 비시약 혼입 방지", () => {
    expect(PAGE).not.toMatch(/\/api\/safety\/products\?limit=100"\)/);
  });
  it("KPI 는 items(=시약 필터 결과) 파생 유지 — 별도 하드코딩 카운트 아님", () => {
    expect(PAGE).toMatch(/items\.filter\(\(i\)\s*=>\s*!i\.hasMsds\)/);
  });
});
