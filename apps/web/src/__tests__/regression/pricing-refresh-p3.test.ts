/**
 * §pricing-refresh P3 (PLAN_pricing-refresh) — 데이터 보존 entitlement(schema + 판정)
 *
 * 무료 데이터 createdAt + 3개월(rolling) 이후 아카이브(soft archivedAt). 3 모델(Quote/Order/ProductInventory).
 *   - grandfather: PRICING_ENFORCE_CUTOFF 이후 가입자만. 미설정 = 아카이브 0(현행 무해).
 *   - hard delete 0(soft archivedAt). 실제 세팅/조회숨김/cron = P4.
 * migrate(컬럼 추가)는 별도 dry-run→보고→"진행" 게이트(본 sentinel 은 schema 파일·판정 로직만).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const SCHEMA = readFileSync(
  join(ROOT, "..", "prisma/schema.prisma"),
  "utf8",
);
const RET = readFileSync(join(ROOT, "lib/billing/retention.ts"), "utf8");

describe("§pricing-refresh P3 — schema archivedAt(soft, 3 모델)", () => {
  it("Quote/Order/ProductInventory 에 archivedAt DateTime? (≥3)", () => {
    const matches = SCHEMA.match(/archivedAt\s+DateTime\?/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(3);
  });
});

describe("§pricing-refresh P3 — 보존 판정 helper", () => {
  it("isRetentionExpired + RETENTION_MONTHS 3", () => {
    expect(RET).toMatch(/export function isRetentionExpired/);
    expect(RET).toMatch(/RETENTION_MONTHS = 3/);
  });
  it("env 미설정/무효 = 아카이브 0(현행 무해)", () => {
    expect(RET).toMatch(/process\.env\.PRICING_ENFORCE_CUTOFF/);
    expect(RET).toMatch(/if \(!cutoffRaw\) return false/);
  });
  it("grandfather(cutoff 이전 가입) + 유료 보존 + rolling 3개월", () => {
    expect(RET).toMatch(/userCreatedAt < cutoff\) return false/);
    expect(RET).toMatch(/plan !== SubscriptionPlan\.FREE\) return false/);
    expect(RET).toMatch(/getMonth\(\) - RETENTION_MONTHS/);
  });
  it("조회 필터 NOT_ARCHIVED(archivedAt null = 노출)", () => {
    expect(RET).toMatch(/NOT_ARCHIVED/);
    expect(RET).toMatch(/archivedAt: null/);
  });
});

describe("§pricing-refresh P3 — hard delete 0(soft only)", () => {
  it("retention helper 는 판정/필터만 — db.delete/deleteMany 0", () => {
    expect(RET).not.toMatch(/\.delete\(|deleteMany/);
  });
});
