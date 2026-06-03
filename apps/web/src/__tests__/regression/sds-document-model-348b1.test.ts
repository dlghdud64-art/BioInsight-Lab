/**
 * §11.348-B-1 B1-0 (회귀) — SDSDocument 모델 sentinel
 *
 * 기존 라우트(api/sds/*, api/safety/sds, admin/safety)가 참조하던 db.sDSDocument
 * 모델이 schema 에 부재 → 실 client 에서 런타임 깨짐(orphaned). B1-0 가 모델 정규화.
 * 파일 원본은 스토리지(bucket/path), DB엔 메타+링크만. 순수 추가형 migration.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}
const SCHEMA = "prisma/schema.prisma";
const MIGRATION = "prisma/migrations/20260603130000_add_sds_document/migration.sql";

describe("§11.348-B-1 B1-0 — SDSDocument 모델", () => {
  it("모델 + 스토리지 메타(bucket/path) + 추출 필드", () => {
    const src = read(SCHEMA);
    expect(src).toContain("model SDSDocument {");
    expect(src).toContain("bucket           String");
    expect(src).toContain("path             String");
    expect(src).toContain('source           String    @default("upload")');
    expect(src).toContain("extractionStatus String?");
    expect(src).toContain("extractionResult Json?");
  });
  it("Product/Organization 백릴레이션 + FK", () => {
    const src = read(SCHEMA);
    expect(src).toContain("sdsDocuments    SDSDocument[]"); // Product
    expect(src).toContain("sdsDocuments       SDSDocument[]"); // Organization
    expect(src).toContain("product      Product       @relation(fields: [productId]");
    expect(src).toContain("organization Organization? @relation(fields: [organizationId]");
  });
});

describe("§11.348-B-1 B1-0 — migration 순수 추가형", () => {
  it("CREATE TABLE SDSDocument, 기존 테이블 ALTER/DROP 0", () => {
    expect(existsSync(join(APP_WEB_ROOT, MIGRATION))).toBe(true);
    const sql = read(MIGRATION);
    expect(sql).toContain('CREATE TABLE "SDSDocument"');
    expect(sql).not.toContain('ALTER TABLE "Product"');
    expect(sql).not.toContain('ALTER TABLE "Organization"');
    expect(sql).not.toContain("DROP TABLE");
  });
});
