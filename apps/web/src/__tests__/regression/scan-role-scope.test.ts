/**
 * §scan-role-scope — 단건 라벨 스캔 vs 대량 import 권한 분리 sentinel
 *
 * 호영님 결정(2026-06-16): 단건 라벨 스캔은 수동 등록(inventory_create)의 빠른 입력 방식.
 *   입력 방식(스캔/수동)으로 권한이 갈리는 불일치 제거 — scan-label 을 sensitive_data_import
 *   (buyer/ops_admin) → inventory_create(requester 허용)로 하향. 대량 유입(import/bulk)은 엄격 유지.
 *
 * canonical: server enforceAction 권위 보존(우회 0). 본 변경은 action 스코프 한정.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const ROOT = join(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const SCAN = read("src/app/api/inventory/scan-label/route.ts");
const IMPORT = read("src/app/api/inventory/import/route.ts");
const BULK = read("src/app/api/inventory/bulk/route.ts");
const GUARD = read("src/lib/security/server-authorization-guard.ts");

describe("§scan-role-scope — 단건 스캔 = inventory_create(requester 허용)", () => {
  it("scan-label = inventory_create (sensitive_data_import 아님)", () => {
    expect(SCAN).toMatch(/action:\s*['"]inventory_create['"]/);
    expect(SCAN).not.toMatch(/action:\s*['"]sensitive_data_import['"]/);
  });
  it("inventory_create 정책에 requester 포함(연구원 단건 등록 허용)", () => {
    expect(GUARD).toMatch(/inventory_create:\s*\[[^\]]*['"]requester['"]/);
  });
});

describe("§scan-role-scope — 대량 import 엄격 유지(buyer/ops_admin)", () => {
  it("inventory/import = sensitive_data_import 유지(대량 검증 안 된 유입)", () => {
    expect(IMPORT).toMatch(/action:\s*['"]sensitive_data_import['"]/);
  });
  it("inventory/bulk = inventory_import 유지", () => {
    expect(BULK).toMatch(/action:\s*['"]inventory_import['"]/);
  });
  it("sensitive_data_import 정책 = buyer/ops_admin (requester 제외)", () => {
    expect(GUARD).toMatch(/sensitive_data_import:\s*\[\s*['"]buyer['"]\s*,\s*['"]ops_admin['"]\s*\]/);
  });
});
