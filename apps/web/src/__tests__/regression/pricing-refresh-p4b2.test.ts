/**
 * §pricing-refresh P4b-2 (PLAN_pricing-refresh) — 업그레이드 시 아카이브 복구
 *
 * 유료 업그레이드(FREE→TEAM/ORG) 시 보존 만료로 숨겨졌던 데이터를 복구(archivedAt=null, soft).
 *   - billing POST upgrade 의 subscription upsert 직후. org 멤버 전체.
 *   - hard delete 0(updateMany 복구만). "차단되는데 복구 0" 불친절 해소(정직성).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const BILL = readFileSync(
  join(__dirname, "..", "..", "app/api/billing/route.ts"),
  "utf8",
);

describe("§pricing-refresh P4b-2 — 업그레이드 아카이브 복구", () => {
  it("유료(plan!==FREE) 업그레이드 시 복구 분기", () => {
    expect(BILL).toMatch(/plan !== "FREE"/);
    expect(BILL).toMatch(/archivedAt: \{ not: null \}/);
  });
  it("org 멤버 전체 3 모델 archivedAt=null 복구", () => {
    expect(BILL).toMatch(/organizationMember\.findMany/);
    expect(BILL).toMatch(/db\.quote\.updateMany/);
    expect(BILL).toMatch(/db\.order\.updateMany/);
    expect(BILL).toMatch(/db\.productInventory\.updateMany/);
    expect(BILL).toMatch(/data: \{ archivedAt: null \}/);
  });
  it("soft 복구 — restoreWhere 는 archivedAt 세팅분만(updateMany, hard delete 0)", () => {
    expect(BILL).toMatch(/restoreWhere = \{ userId: \{ in: memberIds \}, archivedAt: \{ not: null \} \}/);
  });
});
