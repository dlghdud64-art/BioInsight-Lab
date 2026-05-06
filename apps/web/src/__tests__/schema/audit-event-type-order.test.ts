/**
 * #audit-event-type-order — RED→GREEN test
 *
 * #post-approval-purchase-order-flow cluster 의 audit eventType cleanup.
 * 직전 cluster lessons #6 정합 — service / 2 route 의 audit log eventType
 * `SETTINGS_CHANGED` 재사용 → dedicated enum 으로 cleanup.
 *
 * 신규 3 enum (직전 #approver-routing-event-type-enum-add 패턴 정합):
 *   - ORDER_CREATED_FROM_POCANDIDATE — Phase 1.3 service (vendor 별 Order 생성)
 *   - PO_PDF_GENERATED — Phase 2.2 route (PDF 생성 + stream)
 *   - VENDOR_EMAIL_SENT — Phase 3.2 route (vendor email 발송)
 *
 * caller 정합 (3곳):
 *   - lib/orders/convert-pocandidate-to-orders.ts
 *   - app/api/orders/[id]/generate-pdf/route.ts
 *   - app/api/orders/[id]/send-email/route.ts
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const SCHEMA = "prisma/schema.prisma";
const MIGRATIONS_DIR = "prisma/migrations";
const LABELS = "src/lib/audit/event-labels.ts";
const SERVICE = "src/lib/orders/convert-pocandidate-to-orders.ts";
const PDF_ROUTE = "src/app/api/orders/[id]/generate-pdf/route.ts";
const EMAIL_ROUTE = "src/app/api/orders/[id]/send-email/route.ts";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("#audit-event-type-order — schema enum", () => {
  it("AuditEventType 에 ORDER_CREATED_FROM_POCANDIDATE value 추가", () => {
    const src = read(SCHEMA);
    const block = src.match(/enum\s+AuditEventType\s*\{[\s\S]*?\n\}/);
    expect(block).not.toBeNull();
    if (block) {
      expect(block[0]).toMatch(/ORDER_CREATED_FROM_POCANDIDATE/);
    }
  });

  it("AuditEventType 에 PO_PDF_GENERATED value 추가", () => {
    const src = read(SCHEMA);
    const block = src.match(/enum\s+AuditEventType\s*\{[\s\S]*?\n\}/);
    expect(block).not.toBeNull();
    if (block) {
      expect(block[0]).toMatch(/PO_PDF_GENERATED/);
    }
  });

  it("AuditEventType 에 VENDOR_EMAIL_SENT value 추가", () => {
    const src = read(SCHEMA);
    const block = src.match(/enum\s+AuditEventType\s*\{[\s\S]*?\n\}/);
    expect(block).not.toBeNull();
    if (block) {
      expect(block[0]).toMatch(/VENDOR_EMAIL_SENT/);
    }
  });
});

describe("#audit-event-type-order — migration SQL", () => {
  it("audit_event_type_order migration 디렉토리 존재", () => {
    const dir = join(REPO_ROOT, MIGRATIONS_DIR);
    const entries = readdirSync(dir);
    const found = entries.some((e) => /audit_event_type_order/i.test(e));
    expect(found).toBe(true);
  });

  it("ALTER TYPE 3 ADD VALUE IF NOT EXISTS", () => {
    const dir = join(REPO_ROOT, MIGRATIONS_DIR);
    const entries = readdirSync(dir);
    const target = entries.find((e) => /audit_event_type_order/i.test(e));
    expect(target).toBeDefined();
    if (target) {
      const sqlPath = join(dir, target, "migration.sql");
      expect(existsSync(sqlPath)).toBe(true);
      const sql = readFileSync(sqlPath, "utf8");
      expect(sql).toMatch(/ADD\s+VALUE\s+IF\s+NOT\s+EXISTS\s+'ORDER_CREATED_FROM_POCANDIDATE'/i);
      expect(sql).toMatch(/ADD\s+VALUE\s+IF\s+NOT\s+EXISTS\s+'PO_PDF_GENERATED'/i);
      expect(sql).toMatch(/ADD\s+VALUE\s+IF\s+NOT\s+EXISTS\s+'VENDOR_EMAIL_SENT'/i);
    }
  });
});

describe("#audit-event-type-order — event-labels Korean", () => {
  it("3 enum 한국어 label entry 추가", () => {
    const src = read(LABELS);
    expect(src).toMatch(/ORDER_CREATED_FROM_POCANDIDATE:\s*\{/);
    expect(src).toMatch(/PO_PDF_GENERATED:\s*\{/);
    expect(src).toMatch(/VENDOR_EMAIL_SENT:\s*\{/);
  });
});

describe("#audit-event-type-order — caller eventType swap", () => {
  it("convert-pocandidate-to-orders.ts: SETTINGS_CHANGED → ORDER_CREATED_FROM_POCANDIDATE", () => {
    const src = read(SERVICE);
    expect(src).toMatch(/eventType:\s*["']ORDER_CREATED_FROM_POCANDIDATE["']/);
  });

  it("generate-pdf route: SETTINGS_CHANGED → PO_PDF_GENERATED", () => {
    const src = read(PDF_ROUTE);
    expect(src).toMatch(/eventType:\s*["']PO_PDF_GENERATED["']/);
  });

  it("send-email route: SETTINGS_CHANGED → VENDOR_EMAIL_SENT", () => {
    const src = read(EMAIL_ROUTE);
    expect(src).toMatch(/eventType:\s*["']VENDOR_EMAIL_SENT["']/);
  });
});
