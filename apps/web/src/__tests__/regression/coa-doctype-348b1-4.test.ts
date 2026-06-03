/**
 * §11.348-B-1 B1-4 (회귀) — COA 동형 (docType 판별자) sentinel
 *
 * SDSDocument 에 docType(sds/coa) 추가(backward-compat default sds) → 동일 인프라로 COA
 * 아카이브 재사용. 컴포넌트 docType prop, 라우트 필터/수신, product 페이지 COA 섹션.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}
const SCHEMA = "prisma/schema.prisma";
const MIGRATION = "prisma/migrations/20260603140000_add_sds_doctype/migration.sql";
const ROUTE = "src/app/api/products/[id]/sds/route.ts";
const COMP = "src/components/safety/sds-documents-section.tsx";
const PAGE = "src/app/products/[id]/page.tsx";

describe("§11.348-B-1 B1-4 — schema docType + migration(backward-compat)", () => {
  it("docType @default(sds) + index", () => {
    const src = read(SCHEMA);
    expect(src).toContain('docType          String    @default("sds")');
    expect(src).toContain("@@index([docType])");
  });
  it("migration = ADD COLUMN default sds (DROP 0)", () => {
    expect(existsSync(join(APP_WEB_ROOT, MIGRATION))).toBe(true);
    const sql = read(MIGRATION);
    expect(sql).toContain('ADD COLUMN     "docType" TEXT NOT NULL DEFAULT \'sds\'');
    expect(sql).not.toContain("DROP");
  });
});

describe("§11.348-B-1 B1-4 — 라우트 docType 필터/수신", () => {
  it("GET ?docType 필터 + POST docType 저장(coa/sds 가드)", () => {
    const src = read(ROUTE);
    expect(src).toContain('searchParams.get("docType")');
    expect(src).toContain('rawDocType === "coa" ? "coa" : "sds"');
    expect(src).toContain("docType,");
  });
});

describe("§11.348-B-1 B1-4 — 컴포넌트 docType prop + COA 마운트", () => {
  it("컴포넌트 docType prop + ?docType 조회 + 업로드 append", () => {
    const src = read(COMP);
    expect(src).toContain('docType?: "sds" | "coa"');
    expect(src).toContain("?docType=${docType}");
    expect(src).toContain('form.append("docType", docType)');
  });
  it("product 페이지에 sds + coa 두 섹션", () => {
    const src = read(PAGE);
    expect(src).toContain('docType="sds"');
    expect(src).toContain('docType="coa"');
  });
});
