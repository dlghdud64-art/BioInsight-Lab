/**
 * §pricing-refresh P4b-1 (PLAN_pricing-refresh) — 아카이브 조회 숨김(NOT_ARCHIVED)
 *
 * P4a cron 이 archivedAt 세팅한 데이터를 list(GET) 조회에서 숨김(archivedAt: null 필터).
 *   - quotes/orders/inventory GET 3곳에 적용.
 *   - 안전: env 미설정 시 모든 행 archivedAt=null → 필터 영향 0(현행 유지).
 *   - 기존 where 조건(owner/status) 보존. (배너 UX + 복구는 P4b-2.)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const Q = read("app/api/quotes/route.ts");
const O = read("app/api/orders/route.ts");
const I = read("app/api/inventory/route.ts");

describe("§pricing-refresh P4b-1 — 조회 숨김(3곳)", () => {
  it("quotes GET — baseWhere 병합 + archivedAt: null", () => {
    expect(Q).toMatch(/\.\.\.baseWhere,\s*archivedAt: null/);
  });
  it("orders GET — where.archivedAt = null", () => {
    expect(O).toMatch(/where\.archivedAt = null/);
  });
  it("inventory GET — where.archivedAt = null", () => {
    expect(I).toMatch(/where\.archivedAt = null/);
  });
});

describe("§pricing-refresh P4b-1 — 회귀 0(기존 조건 보존)", () => {
  it("quotes ownerCondition/status 보존", () => {
    expect(Q).toMatch(/ownerCondition/);
    expect(Q).toMatch(/statusFilter/);
  });
  it("orders owner/status + inventory ownerCondition 보존", () => {
    expect(O).toMatch(/userId: session\.user\.id/);
    expect(I).toMatch(/\.\.\.ownerCondition/);
  });
});
