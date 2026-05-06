/**
 * #post-approval-purchase-order-flow Phase 2.3 step 1 — RED→GREEN test
 *
 * Order schema 에 PDF 영속화 field 추가:
 *   - Order.poDocumentUrl String? — storage URL (host config 후 S3/Cloudinary/Supabase)
 *   - Order.poDocumentGeneratedAt DateTime? — 생성 시각 (재생성 정합)
 *
 * step 1 = schema + migration 만, storage upload + UI 다운로드 link 는
 * step 2 별도 mini-batch (host config 의존).
 *
 * 직전 #approver-routing 패턴 정합 — schema swap 만 surgical, caller wiring
 * 분리.
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

describe("#post-approval-purchase-order-flow Phase 2.3 step 1 — schema field", () => {
  it("Order 모델에 `poDocumentUrl String?` 필드 추가", () => {
    const src = read(SCHEMA);
    const block = src.match(/model\s+Order\s*\{[\s\S]*?\n\}/);
    expect(block).not.toBeNull();
    if (block) {
      expect(block[0]).toMatch(/poDocumentUrl\s+String\?/);
    }
  });

  it("Order 모델에 `poDocumentGeneratedAt DateTime?` 필드 추가", () => {
    const src = read(SCHEMA);
    const block = src.match(/model\s+Order\s*\{[\s\S]*?\n\}/);
    expect(block).not.toBeNull();
    if (block) {
      expect(block[0]).toMatch(/poDocumentGeneratedAt\s+DateTime\?/);
    }
  });
});

describe("#post-approval-purchase-order-flow Phase 2.3 step 1 — migration SQL", () => {
  it("order_po_document_url migration 디렉토리 존재", () => {
    const dir = join(REPO_ROOT, MIGRATIONS_DIR);
    const entries = readdirSync(dir);
    const found = entries.some((e) => /order_po_document_url/i.test(e));
    expect(found).toBe(true);
  });

  it("ALTER TABLE 2 ADD COLUMN — poDocumentUrl + poDocumentGeneratedAt", () => {
    const dir = join(REPO_ROOT, MIGRATIONS_DIR);
    const entries = readdirSync(dir);
    const target = entries.find((e) => /order_po_document_url/i.test(e));
    expect(target).toBeDefined();
    if (target) {
      const sqlPath = join(dir, target, "migration.sql");
      expect(existsSync(sqlPath)).toBe(true);
      const sql = readFileSync(sqlPath, "utf8");
      expect(sql).toMatch(/ADD\s+COLUMN[\s\S]*?"?poDocumentUrl"?/i);
      expect(sql).toMatch(/ADD\s+COLUMN[\s\S]*?"?poDocumentGeneratedAt"?/i);
    }
  });
});
