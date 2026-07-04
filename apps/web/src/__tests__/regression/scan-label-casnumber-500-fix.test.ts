/**
 * §scan-casnumber-500-fix (호영님 2026-06-30) — scan-label 500 회귀 가드
 *
 * 근본원인(확정, Vercel 런타임 스택 + schema 대조):
 *   Product 모델에 casNumber 컬럼이 없는데 scan-label 라우트가
 *   db.product.findFirst({ where: { casNumber }}) 로 매칭 → PrismaClientValidationError
 *   → outer catch 500 → 스캔 전체 실패(OCR 이 CAS 추출 + catalogNo 미매칭 시 항상).
 *   §11.341 동류(schema/코드 드리프트 — prod 에 없는 컬럼 쿼리).
 *
 * Fix(2026-06-30): CAS 매칭 블록 제거(당시 casNumber 컬럼 부재).
 * 갱신(2026-07-04 §scan-cas-match-restore): casNo 컬럼(P1) 추가로 CAS 매칭 복원.
 *   ⚠ 여전히 **비스키마 `casNumber` 컬럼 쿼리는 금지**(실 컬럼은 `casNo`) — 이 500 보호는 영구 유지.
 *   CAS 는 auto-match 아닌 후보로만(오매칭 방지). 상세: scan-cas-match-restore.test.ts.
 *
 * 가드 2축: (A) 비스키마 `casNumber:` 쿼리 금지(500 보호), (B) 회귀 0(catalogNo 매칭·응답 spread·인증 게이트 보존).
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
  it("500 보호 marker 존재(제거 이력 또는 복원 marker)", () => {
    // §scan-cas-match-restore(2026-07-04)로 marker 갱신. 500 보호(casNo 사용)는 유지.
    expect(route).toMatch(/§scan-cas-match-restore|§scan-casnumber-500-fix/);
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
