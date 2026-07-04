/**
 * §msds-audit-versioning (호영님 2026-07-04)
 *  AV-P1 감사: ActivityType.MSDS_REGISTERED + createActivityLog(누가·언제) 배선.
 *  AV-P2 버전: 신규 SDS 업로드 시 이전 현행본 supersede(최신본 추적).
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
const R = join(__dirname, "..", "..");
const rd = (p: string) => readFileSync(join(R, p), "utf8");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

describe("§msds-audit-versioning AV-P1 — 감사 enum + migration", () => {
  it("ActivityType 에 MSDS_REGISTERED", () => {
    expect(rd("../prisma/schema.prisma")).toMatch(/MSDS_REGISTERED/);
  });
  it("enum-add migration(additive·IF NOT EXISTS·비파괴)", () => {
    const p = join(R, "..", "prisma/migrations/20260704140000_activitytype_msds_registered/migration.sql");
    expect(existsSync(p)).toBe(true);
    const sql = readFileSync(p, "utf8");
    expect(sql).toMatch(/ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'MSDS_REGISTERED'/);
    expect(sql).not.toMatch(/DROP TYPE|DROP VALUE/i);
  });
});

describe("§msds-audit-versioning AV-P2 — supersession 헬퍼", () => {
  const H = strip(rd("lib/safety/supersede-sds.ts"));
  it("이전 현행본만 supersede(keep 제외, sds·현행 한정)", () => {
    expect(H).toMatch(/updateMany/);
    expect(H).toMatch(/supersededAt:\s*null/);
    expect(H).toMatch(/id:\s*\{\s*not:\s*keepDocId\s*\}/);
    expect(H).toMatch(/data:\s*\{\s*supersededAt:\s*new Date\(\)/);
  });
});

describe("§msds-audit-versioning — 배선(bulk + 단일)", () => {
  it("bulk commit: supersede + 감사 로그(best-effort)", () => {
    const C = strip(rd("app/api/safety/sds/bulk/commit/route.ts"));
    expect(C).toMatch(/supersedePriorSds\(productId, doc\.id\)/);
    expect(C).toMatch(/ActivityType\.MSDS_REGISTERED/);
  });
  it("단일 업로드: supersede + 감사 로그(sds 한정)", () => {
    const S = strip(rd("app/api/products/[id]/sds/route.ts"));
    expect(S).toMatch(/supersedePriorSds\(productId, doc\.id\)/);
    expect(S).toMatch(/ActivityType\.MSDS_REGISTERED/);
  });
});
