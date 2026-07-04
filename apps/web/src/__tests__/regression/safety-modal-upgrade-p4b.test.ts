/**
 * §safety-modal-upgrade P4b (호영님 2026-07-04, operator) — 물질(Product) 대표 점검 저장 엔드포인트 + 배선.
 * POST /api/products/[id]/inspection (lot route mirror). auth→enforce→owner/org→$transaction(create+lastInspectedAt+audit).
 * 제출 정직-disabled(P4a) → 실배선 반전. 가짜성공 0. lot 엔드포인트 무접촉.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
const R = join(__dirname, "..", "..");
const PAGE = readFileSync(join(R, "app/dashboard/safety/page.tsx"), "utf8");
const ROUTE_PATH = join(R, "app/api/products/[id]/inspection/route.ts");
const ROUTE = existsSync(ROUTE_PATH) ? readFileSync(ROUTE_PATH, "utf8") : "";

describe("§safety-modal-upgrade P4b — 물질 점검 엔드포인트", () => {
  it("POST /api/products/[id]/inspection 존재 + productId 물질 점검 저장", () => {
    expect(ROUTE).toMatch(/export async function POST/);
    expect(ROUTE).toMatch(/db\.product\.findUnique/);
    expect(ROUTE).toMatch(/tx\.inspection\.create/);
    expect(ROUTE).toMatch(/productId: params\.id/);
    expect(ROUTE).toMatch(/lastInspectedAt/);
  });
  it("auth·권한(owner/org)·enforcement·감사 게이트", () => {
    expect(ROUTE).toMatch(/await auth\(\)/);
    expect(ROUTE).toMatch(/isOwner/);
    expect(ROUTE).toMatch(/isOrgMember/);
    expect(ROUTE).toMatch(/enforceAction/);
    expect(ROUTE).toMatch(/createAuditLog/);
    expect(ROUTE).toMatch(/AuditEntityType\.INSPECTION/);
  });
  it("이상 발견 시 심각도·조치 검증(400)", () => {
    expect(ROUTE).toMatch(/SEVERITY_REQUIRED/);
    expect(ROUTE).toMatch(/ACTION_REQUIRED/);
  });
});

describe("§safety-modal-upgrade P4b — 클라 배선(정직-disabled 반전)", () => {
  it("handleInspSaveMaterial fetch + 버튼 onClick enable", () => {
    expect(PAGE).toMatch(/handleInspSaveMaterial/);
    expect(PAGE).toMatch(/\/api\/products\/\$\{productId\}\/inspection/);
    expect(PAGE).toMatch(/onClick=\{handleInspSaveMaterial\}/);
    // 항상-disabled(배선 준비 중) 정직표기 제거 — 조건부 disabled로 반전.
    expect(PAGE).not.toMatch(/물질 대표 점검 저장 배선 준비 중/);
  });
  it("가짜성공 0 — setTimeout 로컬 flip 없음", () => {
    expect(PAGE).not.toMatch(/setTimeout\([^)]*setInspDialogOpen/);
  });
  it("회귀 0 — lot 엔드포인트(/api/inventory/[id]/inspection) 별도 존속", () => {
    expect(existsSync(join(R, "app/api/inventory/[id]/inspection/route.ts"))).toBe(true);
  });
});
