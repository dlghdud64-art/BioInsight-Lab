/**
 * §quote-item-vendor-selection Phase 1 — 스키마·migration sentinel (RED → 적용 GREEN).
 *
 * 계약 (계획서 §0 Chosen Source of Truth):
 *   - QuoteListItem.selectedVendorRequestId: String? (additive nullable — rollback = drop)
 *   - FK → QuoteVendorRequest (vendorName 문자열 아님 — 응답 실존 결속·이름 변경 안전),
 *     onDelete: SetNull (요청 삭제 시 선택 해제 — 고아 FK 금지)
 *   - @@index([selectedVendorRequestId])
 *   - migration 파일 실존 + drift-guard manifest 등재 (§migration-order-drift-guard 게이트)
 *
 * 선택 truth 는 DB 컬럼 — UI state 대체 금지 (계획서 §4).
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const WEB_ROOT = join(__dirname, "..", "..", "..");
const SCHEMA = readFileSync(join(WEB_ROOT, "prisma", "schema.prisma"), "utf8");

function modelBlock(name: string): string {
  const start = SCHEMA.indexOf(`model ${name} {`);
  expect(start).toBeGreaterThan(-1);
  const end = SCHEMA.indexOf("\nmodel ", start + 1);
  return SCHEMA.slice(start, end === -1 ? undefined : end);
}

describe("§quote-item-vendor-selection P1 — QuoteListItem 선택 컬럼", () => {
  it("selectedVendorRequestId String? (additive nullable)", () => {
    const block = modelBlock("QuoteListItem");
    expect(block).toMatch(/selectedVendorRequestId\s+String\?/);
  });

  it("FK 관계 → QuoteVendorRequest, onDelete: SetNull (고아 선택 금지)", () => {
    const block = modelBlock("QuoteListItem");
    expect(block).toMatch(
      /selectedVendorRequest\s+QuoteVendorRequest\?\s+@relation\("QuoteItemSelectedVendor",\s*fields:\s*\[selectedVendorRequestId\],\s*references:\s*\[id\],\s*onDelete:\s*SetNull\)/,
    );
  });

  it("역관계 — QuoteVendorRequest.selectedForItems", () => {
    const block = modelBlock("QuoteVendorRequest");
    expect(block).toMatch(/selectedForItems\s+QuoteListItem\[\]\s+@relation\("QuoteItemSelectedVendor"\)/);
  });

  it("@@index([selectedVendorRequestId])", () => {
    const block = modelBlock("QuoteListItem");
    expect(block).toMatch(/@@index\(\[selectedVendorRequestId\]\)/);
  });
});

describe("§quote-item-vendor-selection P1 — migration 파일·manifest 게이트", () => {
  const MIG_DIR = join(WEB_ROOT, "prisma", "migrations");
  const slug = readdirSync(MIG_DIR).find((d) => d.endsWith("_quote_item_vendor_selection"));

  it("migration 디렉토리 실존 (*_quote_item_vendor_selection)", () => {
    expect(slug).toBeTruthy();
  });

  it("SQL — additive nullable 컬럼 + FK(SET NULL) + index (DROP/NOT NULL 금지)", () => {
    const sql = readFileSync(join(MIG_DIR, slug!, "migration.sql"), "utf8");
    expect(sql).toMatch(/ALTER TABLE "QuoteListItem" ADD COLUMN\s+"selectedVendorRequestId" TEXT;/);
    expect(sql).toMatch(/ON DELETE SET NULL/);
    expect(sql).toMatch(/CREATE INDEX "QuoteListItem_selectedVendorRequestId_idx"/);
    // additive 안전성 — 파괴 구문 0
    expect(sql).not.toMatch(/DROP TABLE|DROP COLUMN|NOT NULL/);
  });

  it("drift-guard manifest 등재 (§migration-order-drift-guard)", () => {
    const manifest = JSON.parse(
      readFileSync(join(WEB_ROOT, "src", "generated", "migration-manifest.json"), "utf8"),
    );
    const names: string[] = (manifest.migrations ?? manifest ?? []).map(
      (m: any) => (typeof m === "string" ? m : m.name),
    );
    expect(names.some((n) => n.endsWith("_quote_item_vendor_selection"))).toBe(true);
  });
});
