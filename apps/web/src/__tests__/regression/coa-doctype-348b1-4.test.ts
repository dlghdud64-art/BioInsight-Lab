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

/**
 * 🛑 공백 접기 (호영님 2026-09-08 승인) — Prisma **열 정렬을 핀하지 않는다.**
 *
 *   Prisma 는 모델 안 최장 필드명에 맞춰 열을 정렬한다. 더 긴 이름의 필드가 하나
 *   추가되면 **관계없는 줄의 공백이 통째로 밀린다** — 계약은 그대로인데 RED 가 된다.
 *   2026-09-07 §11.348-B-1 이 정확히 그렇게 깨졌다(4칸 기대 · 실제 12칸).
 *
 *   잠글 명제는 "이 필드가 이 타입으로 실재한다" 이지 "몇 칸 띄어져 있다" 가 아니다.
 *   → 건초더미와 바늘을 **같은 규칙으로** 접어서 본다(공백 런 → 1칸).
 *   스윕 실측: 이 형태가 저장소 전체에 14건 / 3파일 있었다.
 */
const foldWs = (s: string): string => s.replace(/[ \t]+/g, " ");
const SCHEMA = "prisma/schema.prisma";
const MIGRATION = "prisma/migrations/20260603140000_add_sds_doctype/migration.sql";
const ROUTE = "src/app/api/products/[id]/sds/route.ts";
const COMP = "src/components/safety/sds-documents-section.tsx";
const PAGE = "src/app/products/[id]/page.tsx";

describe("§11.348-B-1 B1-4 — schema docType + migration(backward-compat)", () => {
  it("docType @default(sds) + index", () => {
    const src = foldWs(read(SCHEMA));
    expect(src).toContain('docType String @default("sds")');
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
    // qs 조립이 `docType=${docType}` (상위서 ? prefix, #inventory-lot-entity P4 restockId 병합).
    expect(src).toContain("docType=${docType}");
    expect(src).toContain('form.append("docType", docType)');
  });
  it("product 페이지 SDS 섹션 (COA는 §detail-page P1-1 로 inventory 패널 lot-scope 이전)", () => {
    const src = read(PAGE);
    expect(src).toContain('docType="sds"');
    expect(src).not.toContain('docType="coa"');
  });
});
