/**
 * §scan-casnumber-500-fix (호영님 2026-06-30) — scan-label 500 회귀 가드
 *
 * 근본원인(확정, Vercel 런타임 스택 + schema 대조):
 *   Product 모델에 casNumber 컬럼이 없는데 scan-label 라우트가
 *   db.product.findFirst({ where: { casNumber }}) 로 매칭 → PrismaClientValidationError
 *   → outer catch 500 → 스캔 전체 실패(OCR 이 CAS 추출 + catalogNo 미매칭 시 항상).
 *   §11.341 동류(schema/코드 드리프트 — prod 에 없는 컬럼 쿼리).
 *
 * Fix: CAS 기반 product 매칭 블록 제거. catalogNo 매칭만 유지.
 *   merged.casNumber 는 응답(parsed spread)에 그대로 노출(표시용) — DB *매칭*만 제거.
 *
 * 가드 2축: (A) 비스키마 casNumber 쿼리 금지, (B) 회귀 0(catalogNo 매칭·응답 spread·인증 게이트 보존).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROUTE_PATH = resolve(__dirname, "../../app/api/inventory/scan-label/route.ts");
const route = readFileSync(ROUTE_PATH, "utf8");

describe("§scan-casnumber-500-fix — 비스키마 casNumber 쿼리 금지 (A)", () => {
  it("prisma where 에 casNumber 조건 0 (Product 스키마 미존재 컬럼)", () => {
    // 활성 쿼리 패턴 casNumber: { ... } 가 없어야 함(주석 언급은 허용).
    expect(route).not.toMatch(/casNumber:\s*\{/);
  });
  it("§scan-casnumber-500-fix trace marker 존재", () => {
    expect(route).toMatch(/§scan-casnumber-500-fix/);
  });
});

describe("§scan-casnumber-500-fix — 회귀 0 (B)", () => {
  it("catalogNo(catalogNumber) 매칭 보존", () => {
    expect(route).toMatch(/catalogNumber:\s*\{/);
    expect(route).toMatch(/merged\.catalogNo/);
  });
  it("응답 parsed spread(merged) 보존 — casNumber 등 표시 필드 유지", () => {
    expect(route).toMatch(/parsed:\s*\{\s*\.\.\.parsed,\s*\.\.\.merged\s*\}/);
  });
  it("인증/권한 게이트 보존(401 + enforceAction inventory_create)", () => {
    expect(route).toMatch(/status:\s*401/);
    expect(route).toMatch(/action:\s*'inventory_create'/);
    expect(route).toMatch(/enforcement\.deny\(\)/);
  });
  it("실패 경로 500 catch + lock fail 보존", () => {
    expect(route).toMatch(/enforcement\?\.fail\(\)/);
    expect(route).toMatch(/status:\s*500/);
  });
});
