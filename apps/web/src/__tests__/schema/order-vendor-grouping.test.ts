/**
 * #post-approval-purchase-order-flow Phase 1.1 — RED→GREEN test
 *
 * Vendor PO grouping (option A — vendor 별 결재/발송/Order 분리):
 *   - `Order.quoteId @unique` 제거 → composite `(quoteId, vendorId)` unique
 *   - `Order.vendorId String?` (Vendor relation, SetNull on vendor delete)
 *   - `Order.poCandidateId String?` (POCandidate 1:1 매핑, SetNull)
 *   - migration directory `*_order_vendor_grouping/migration.sql` 신설
 *
 * canonical truth = Order (DB) — 결재 후 vendor 별 발주서. 1 Quote → N Order
 * (vendor 별). legacy data 의 vendorId NULL backward compat.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const SCHEMA = "prisma/schema.prisma";
const MIGRATIONS_DIR = "prisma/migrations";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("#post-approval-purchase-order-flow Phase 1.1 — schema field", () => {
  it("Order 모델에서 `quoteId String @unique` 단독 제약 제거", () => {
    const src = read(SCHEMA);
    const block = src.match(/model\s+Order\s*\{[\s\S]*?\n\}/);
    expect(block).not.toBeNull();
    if (block) {
      // 단독 @unique 가 quoteId field 줄에 붙어 있으면 안 됨
      // (composite @@unique 는 별도 줄에 위치)
      expect(block[0]).not.toMatch(/quoteId\s+String\s+@unique/);
    }
  });

  it("Order 모델에 composite `@@unique([quoteId, vendorId])` 추가", () => {
    const src = read(SCHEMA);
    const block = src.match(/model\s+Order\s*\{[\s\S]*?\n\}/);
    expect(block).not.toBeNull();
    if (block) {
      expect(block[0]).toMatch(/@@unique\(\[\s*quoteId\s*,\s*vendorId\s*\]\)/);
    }
  });

  it("Order 모델에 `vendorId String?` 필드 + Vendor relation 추가", () => {
    const src = read(SCHEMA);
    const block = src.match(/model\s+Order\s*\{[\s\S]*?\n\}/);
    expect(block).not.toBeNull();
    if (block) {
      expect(block[0]).toMatch(/vendorId\s+String\?/);
      expect(block[0]).toMatch(/vendor\s+Vendor\?\s+@relation/);
    }
  });

  it("Order 모델에 `poCandidateId String?` 필드 + POCandidate relation 추가", () => {
    const src = read(SCHEMA);
    const block = src.match(/model\s+Order\s*\{[\s\S]*?\n\}/);
    expect(block).not.toBeNull();
    if (block) {
      expect(block[0]).toMatch(/poCandidateId\s+String\?/);
      expect(block[0]).toMatch(/poCandidate\s+POCandidate\?\s+@relation/);
    }
  });

  it("Order 모델 vendorId / poCandidateId 인덱스 추가", () => {
    const src = read(SCHEMA);
    const block = src.match(/model\s+Order\s*\{[\s\S]*?\n\}/);
    expect(block).not.toBeNull();
    if (block) {
      expect(block[0]).toMatch(/@@index\(\[\s*vendorId\s*\]\)/);
      expect(block[0]).toMatch(/@@index\(\[\s*poCandidateId\s*\]\)/);
    }
  });

  it("Vendor 모델 reverse relation `orders Order[]` 추가", () => {
    const src = read(SCHEMA);
    const block = src.match(/model\s+Vendor\s*\{[\s\S]*?\n\}/);
    expect(block).not.toBeNull();
    if (block) {
      expect(block[0]).toMatch(/orders\s+Order\[\]/);
    }
  });

  it("POCandidate 모델 reverse relation `orders Order[]` 추가", () => {
    const src = read(SCHEMA);
    const block = src.match(/model\s+POCandidate\s*\{[\s\S]*?\n\}/);
    expect(block).not.toBeNull();
    if (block) {
      expect(block[0]).toMatch(/orders\s+Order\[\]/);
    }
  });
});

describe("#post-approval-purchase-order-flow Phase 1.1 — migration SQL", () => {
  it("order_vendor_grouping migration 디렉토리 존재", () => {
    const dir = join(REPO_ROOT, MIGRATIONS_DIR);
    const entries = readdirSync(dir);
    const found = entries.some((e) => /order_vendor_grouping/i.test(e));
    expect(found).toBe(true);
  });

  it("DROP CONSTRAINT Order_quoteId_key (단독 unique 제거)", () => {
    const dir = join(REPO_ROOT, MIGRATIONS_DIR);
    const entries = readdirSync(dir);
    const target = entries.find((e) => /order_vendor_grouping/i.test(e));
    expect(target).toBeDefined();
    if (target) {
      const sqlPath = join(dir, target, "migration.sql");
      expect(existsSync(sqlPath)).toBe(true);
      const sql = readFileSync(sqlPath, "utf8");
      // host 측 idempotent 패턴 — `IF EXISTS` 허용
      expect(sql).toMatch(/DROP\s+CONSTRAINT\s+(?:IF\s+EXISTS\s+)?"?Order_quoteId_key"?/i);
    }
  });

  it("ADD CONSTRAINT Order_quoteId_vendorId_key (composite unique)", () => {
    const dir = join(REPO_ROOT, MIGRATIONS_DIR);
    const entries = readdirSync(dir);
    const target = entries.find((e) => /order_vendor_grouping/i.test(e));
    expect(target).toBeDefined();
    if (target) {
      const sql = readFileSync(join(dir, target, "migration.sql"), "utf8");
      expect(sql).toMatch(/UNIQUE\s*\(\s*"?quoteId"?\s*,\s*"?vendorId"?\s*\)/i);
    }
  });

  it("ADD COLUMN vendorId + poCandidateId + FK", () => {
    const dir = join(REPO_ROOT, MIGRATIONS_DIR);
    const entries = readdirSync(dir);
    const target = entries.find((e) => /order_vendor_grouping/i.test(e));
    expect(target).toBeDefined();
    if (target) {
      const sql = readFileSync(join(dir, target, "migration.sql"), "utf8");
      expect(sql).toMatch(/ADD\s+COLUMN\s+"?vendorId"?\s+TEXT/i);
      expect(sql).toMatch(/ADD\s+COLUMN\s+"?poCandidateId"?\s+TEXT/i);
      expect(sql).toMatch(/REFERENCES\s+"?Vendor"?/i);
      expect(sql).toMatch(/REFERENCES\s+"?POCandidate"?/i);
    }
  });
});
