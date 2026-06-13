import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

// §detail-page 정합 — COA/SDS 경계(CHECK constraint) + catalog COA 이전 sentinel.
//   배치: src/__tests__/regression/ (REPO_WEB = 3단계 상승).
//   ⚠️ P1-1(COA 이전)·P1-2(schema/constraint)·P1-3(route lot)은 P2/P3 구현 전 RED(의도).
//      회귀(SDS catalog 유지)는 GREEN.

const REPO_WEB = join(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(join(REPO_WEB, rel), "utf8");

const PAGE = "src/app/products/[id]/page.tsx";
const SCHEMA = "prisma/schema.prisma";
const UPLOAD_ROUTE = "src/app/api/products/[id]/sds/route.ts";
const MIGRATIONS_DIR = "prisma/migrations";

function migrationsContain(pattern: RegExp): boolean {
  const dir = join(REPO_WEB, MIGRATIONS_DIR);
  if (!existsSync(dir)) return false;
  for (const d of readdirSync(dir)) {
    const sql = join(dir, d, "migration.sql");
    if (existsSync(sql) && pattern.test(readFileSync(sql, "utf8"))) return true;
  }
  return false;
}

describe("§detail-page P1-1 — COA 경계: catalog detail 업로드 제거 (P3 RED)", () => {
  it("catalog detail 에 COA 업로드(docType='coa') 제거 — 플래그만", () => {
    const src = read(PAGE);
    expect(src).not.toMatch(/SdsDocumentsSection[^>]*docType=["']coa["']/);
  });

  it("(회귀 GREEN) SDS 는 catalog 유지 — docType='sds' 보존", () => {
    const src = read(PAGE);
    expect(src).toMatch(/docType=["']sds["']/);
  });
});

describe("§detail-page P1-2 — schema inventoryId + CHECK constraint (P2 RED)", () => {
  it("SDSDocument 에 inventoryId(nullable FK) 추가", () => {
    const block = read(SCHEMA).match(/model SDSDocument \{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(block).toMatch(/inventoryId\s+String\?/);
  });

  it("CHECK constraint 양조건 — coa→inventoryId NOT NULL", () => {
    // SQL 본문은 큰따옴표(`"docType"`/`"inventoryId"`)로 식별자 quoting — 매칭 정합.
    expect(migrationsContain(/CHECK[\s\S]*"?docType"?\s*=\s*'coa'[\s\S]*"?inventoryId"?\s+IS\s+NOT\s+NULL/i)).toBe(true);
  });

  it("CHECK constraint 양조건 — sds→inventoryId NULL", () => {
    expect(migrationsContain(/"?docType"?\s*=\s*'sds'[\s\S]*"?inventoryId"?\s+IS\s+NULL/i)).toBe(true);
  });
});

describe("§detail-page P1-3 — 업로드 route lot 처리 (P3 RED)", () => {
  it("COA 업로드 시 inventoryId 수용/요구 (lot-scoped)", () => {
    const src = read(UPLOAD_ROUTE);
    expect(src).toMatch(/inventoryId/);
  });
});
