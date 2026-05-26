/**
 * §11.309a #inventory-restock-ocr-link — Regression sentinel (Phase A)
 *
 * 호영님 P0 (2026-05-26) — 스마트 입고 backend MVP Phase A:
 *   1. InventoryRestock 확장 (ocrJobId + extractedData) + OcrJob FK + index
 *   2. OcrJob back-relation (restocks InventoryRestock[])
 *   3. Migration SQL 작성 (20260526120000_inventory_restock_ocr_link)
 *   4. claude-structurer 에 structureInvoiceWithClaude + INVOICE_STRUCTURE_PROMPT
 *      신규 export (라벨 함수 변경 0 — 회귀 보호)
 *
 * Q19 강제 — schema 변경 시 dry-run 보고 → 호영님 "진행" 회신 → apply.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const SCHEMA_PATH = "prisma/schema.prisma";
const MIGRATION_PATH = "prisma/migrations/20260526120000_inventory_restock_ocr_link/migration.sql";
const CLAUDE_STRUCTURER_PATH = "src/lib/ocr/claude-structurer.ts";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.309a — Prisma schema InventoryRestock 확장", () => {
  it("InventoryRestock model 에 ocrJobId 컬럼 + nullable", () => {
    const src = read(SCHEMA_PATH);
    expect(src).toMatch(/model InventoryRestock\s*\{[\s\S]*?ocrJobId\s+String\?/);
  });

  it("InventoryRestock 에 extractedData Json? 컬럼", () => {
    const src = read(SCHEMA_PATH);
    expect(src).toMatch(/model InventoryRestock\s*\{[\s\S]*?extractedData\s+Json\?/);
  });

  it("InventoryRestock 에 OcrJob relation (SetNull)", () => {
    const src = read(SCHEMA_PATH);
    expect(src).toMatch(/ocrJob\s+OcrJob\?\s+@relation\(fields:\s*\[ocrJobId\],\s*references:\s*\[id\],\s*onDelete:\s*SetNull\)/);
  });

  it("InventoryRestock 에 @@index([ocrJobId])", () => {
    const src = read(SCHEMA_PATH);
    expect(src).toMatch(/@@index\(\[ocrJobId\]\)/);
  });
});

describe("§11.309a — Prisma schema OcrJob back-relation", () => {
  it("OcrJob model 에 restocks InventoryRestock[] back-relation", () => {
    const src = read(SCHEMA_PATH);
    expect(src).toMatch(/model OcrJob\s*\{[\s\S]*?restocks\s+InventoryRestock\[\]/);
  });

  it("OcrJob 기존 indexes 보존 (회귀 0)", () => {
    const src = read(SCHEMA_PATH);
    expect(src).toMatch(/@@index\(\[organizationId,\s*type\]\)/);
    expect(src).toMatch(/@@index\(\[imageHash\]\)/);
  });
});

describe("§11.309a — Migration SQL 정합", () => {
  it("migration 파일 존재", () => {
    expect(existsSync(join(REPO_ROOT, MIGRATION_PATH))).toBe(true);
  });

  it("ALTER TABLE InventoryRestock ADD COLUMN ocrJobId TEXT + extractedData JSONB", () => {
    const src = read(MIGRATION_PATH);
    expect(src).toMatch(/ALTER TABLE "InventoryRestock"[\s\S]*?ADD COLUMN "ocrJobId" TEXT/);
    expect(src).toMatch(/ADD COLUMN "extractedData" JSONB/);
  });

  it("FK 제약 (REFERENCES OcrJob, ON DELETE SET NULL)", () => {
    const src = read(MIGRATION_PATH);
    expect(src).toMatch(/CONSTRAINT "InventoryRestock_ocrJobId_fkey"[\s\S]*?REFERENCES "OcrJob"\("id"\)[\s\S]*?ON DELETE SET NULL/);
  });

  it("CREATE INDEX InventoryRestock_ocrJobId_idx", () => {
    const src = read(MIGRATION_PATH);
    expect(src).toMatch(/CREATE INDEX "InventoryRestock_ocrJobId_idx" ON "InventoryRestock"\("ocrJobId"\)/);
  });

  it("Rollback SQL 주석 포함 (DROP COLUMN x2 + DROP CONSTRAINT + DROP INDEX)", () => {
    const src = read(MIGRATION_PATH);
    expect(src).toMatch(/DROP COLUMN "ocrJobId"/);
    expect(src).toMatch(/DROP COLUMN "extractedData"/);
    expect(src).toMatch(/DROP CONSTRAINT "InventoryRestock_ocrJobId_fkey"/);
    expect(src).toMatch(/DROP INDEX "InventoryRestock_ocrJobId_idx"/);
  });
});

describe("§11.309a — claude-structurer 거래명세서 분기 신규", () => {
  it("structureInvoiceWithClaude 함수 export", () => {
    const src = read(CLAUDE_STRUCTURER_PATH);
    expect(src).toMatch(/export\s+async\s+function\s+structureInvoiceWithClaude/);
  });

  it("INVOICE_STRUCTURE_PROMPT export (audit)", () => {
    const src = read(CLAUDE_STRUCTURER_PATH);
    expect(src).toMatch(/export\s*\{\s*INVOICE_STRUCTURE_PROMPT\s*\}/);
  });

  it("INVOICE_STRUCTURE_PROMPT 가 ParsedQuoteDocument shape 명시", () => {
    const src = read(CLAUDE_STRUCTURER_PATH);
    expect(src).toMatch(/"vendor":\s*\{/);
    expect(src).toMatch(/"items":\s*\[/);
    expect(src).toMatch(/"totalAmount"/);
    expect(src).toMatch(/거래명세서/);
  });

  it("ClaudeStructureInvoiceResult interface — parsed/confidence/itemCount/cost/latency", () => {
    const src = read(CLAUDE_STRUCTURER_PATH);
    expect(src).toMatch(/interface\s+ClaudeStructureInvoiceResult/);
    expect(src).toMatch(/parsed:\s*ParsedQuoteDocument/);
    expect(src).toMatch(/itemCount:\s*number/);
  });

  it("claude-haiku-4-5 모델 사용 (§11.290 정합)", () => {
    const src = read(CLAUDE_STRUCTURER_PATH);
    expect(src).toMatch(/model:\s*"claude-haiku-4-5"/);
  });

  it("ANTHROPIC_API_KEY 미설정 시 ClaudeStructurerNotConfiguredError throw (graceful degradation)", () => {
    const src = read(CLAUDE_STRUCTURER_PATH);
    // invoice 분기도 같은 error 패턴
    const invoiceFnIdx = src.indexOf("structureInvoiceWithClaude");
    const tailFromInvoice = src.slice(invoiceFnIdx);
    expect(tailFromInvoice).toMatch(/ClaudeStructurerNotConfiguredError/);
    expect(tailFromInvoice).toMatch(/ANTHROPIC_API_KEY/);
  });
});

describe("§11.309a — 회귀 0 (기존 라벨 함수 보존)", () => {
  it("structureWithClaude (라벨) 함수 보존 export", () => {
    const src = read(CLAUDE_STRUCTURER_PATH);
    expect(src).toMatch(/export\s+async\s+function\s+structureWithClaude\(/);
  });

  it("STRUCTURE_PROMPT (라벨) export 보존", () => {
    const src = read(CLAUDE_STRUCTURER_PATH);
    expect(src).toMatch(/export\s*\{\s*STRUCTURE_PROMPT\s*\}/);
  });

  it("ClaudeStructurerNotConfiguredError export 보존", () => {
    const src = read(CLAUDE_STRUCTURER_PATH);
    expect(src).toMatch(/export\s+class\s+ClaudeStructurerNotConfiguredError/);
  });

  it("ClaudeStructureInput interface 보존", () => {
    const src = read(CLAUDE_STRUCTURER_PATH);
    expect(src).toMatch(/export\s+interface\s+ClaudeStructureInput/);
  });
});
