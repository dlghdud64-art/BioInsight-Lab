/**
 * §pricing-refresh P4a (PLAN_pricing-refresh) — 보존 만료 아카이브 cron(soft)
 *
 * 무료 만료 데이터 soft 아카이브(archivedAt 세팅). hard delete 0.
 *   - env 미설정/무효 = skip(아카이브 0, 현행 무해). dryRun=1 = 카운트만(write 0).
 *   - FREE + 가입 cutoff 이후(grandfather 보호) + createdAt < now−3개월 → archivedAt=now.
 *   - 유료(TEAM/ORG) 제외. updateMany(soft) only — delete/deleteMany 0.
 *   - vercel.json cron 등록.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const CRON = readFileSync(join(ROOT, "app/api/cron/retention-archive/route.ts"), "utf8");
const VERCEL = readFileSync(join(ROOT, "..", "vercel.json"), "utf8");

describe("§pricing-refresh P4a — 아카이브 cron 안전", () => {
  it("env 미설정/무효 = skip(아카이브 0)", () => {
    expect(CRON).toMatch(/process\.env\.PRICING_ENFORCE_CUTOFF/);
    expect(CRON).toMatch(/if \(!cutoffRaw\) return \{ skipped/);
    expect(CRON).toMatch(/Number\.isNaN\(cutoff\.getTime\(\)\)/);
  });
  it("dryRun=1 = 카운트만(write 0)", () => {
    expect(CRON).toMatch(/dryRun/);
    expect(CRON).toMatch(/if \(dryRun\)/);
    expect(CRON).toMatch(/db\.quote\.count/);
  });
  it("FREE + 가입 cutoff 이후(grandfather) + 유료 제외", () => {
    expect(CRON).toMatch(/createdAt: \{ gte: cutoff \}/);
    expect(CRON).toMatch(/plan: \{ in: \["TEAM", "ORGANIZATION"\] \}/);
    expect(CRON).toMatch(/!paidIds\.has\(id\)/);
  });
  it("rolling 3개월(RETENTION_MONTHS) + createdAt < threshold", () => {
    expect(CRON).toMatch(/RETENTION_MONTHS/);
    expect(CRON).toMatch(/setMonth\(threshold\.getMonth\(\) - RETENTION_MONTHS\)/);
    expect(CRON).toMatch(/createdAt: \{ lt: threshold \}/);
  });
});

describe("§pricing-refresh P4a — soft only(hard delete 0)", () => {
  it("updateMany(archivedAt) — delete/deleteMany 0", () => {
    expect(CRON).toMatch(/updateMany\(\{ where: baseWhere, data: \{ archivedAt: now \} \}\)/);
    expect(CRON).not.toMatch(/\.delete\(|deleteMany/);
  });
  it("3 모델 모두 아카이브(quote·order·productInventory)", () => {
    expect(CRON).toMatch(/db\.quote\.updateMany/);
    expect(CRON).toMatch(/db\.order\.updateMany/);
    expect(CRON).toMatch(/db\.productInventory\.updateMany/);
  });
});

describe("§pricing-refresh P4a — cron 등록", () => {
  it("vercel.json retention-archive cron", () => {
    expect(VERCEL).toMatch(/\/api\/cron\/retention-archive/);
  });
});
