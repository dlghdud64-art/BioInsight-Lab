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
const MIGRATION = "prisma/migrations/20260603130000_add_sds_document/migration.sql";

describe("§11.348-B-1 B1-0 — SDSDocument 모델", () => {
  it("모델 + 스토리지 메타(bucket/path) + 추출 필드", () => {
    const src = foldWs(read(SCHEMA));
    expect(src).toContain("model SDSDocument {");
    expect(src).toContain("bucket String");
    expect(src).toContain("path String");
    expect(src).toContain('source String @default("upload")');
    expect(src).toContain("extractionStatus String?");
    expect(src).toContain("extractionResult Json?");
  });
  it("Product/Organization 백릴레이션 + FK", () => {
    /* 🛑 2026-09-07 재작성 — 이전 판본은 **공백 정렬**을 핀했다:
     *     toContain("sdsDocuments    SDSDocument[]")      ← 4칸 기대, 실제 12칸
     *     toContain("sdsDocuments       SDSDocument[]")   ← 7칸 기대, 실제 27칸
     *   Prisma 는 모델 안 최장 필드명에 맞춰 열을 정렬한다. 더 긴 이름의 필드가
     *   추가되면 **관계없는 줄의 공백이 통째로 밀린다** — 계약은 그대로인데 RED 가 된다.
     *   실측: 4단언 중 2건 FAIL 이었으나 공백을 무시하면 4/4 충족이었다.
     *   그리고 `it()` 은 첫 실패만 보고해 두 번째 FAIL 이 숨어 있었다
     *   (CLAUDE.md "sentinel 승계는 it() 블록 전체 대조").
     *
     *   잠글 명제는 "백릴레이션과 FK 가 실재한다" 이지 "몇 칸 띄어져 있다" 가 아니다.
     *   공백을 접어서 본다. */
    const src = read(SCHEMA).replace(/[ \t]+/g, " ");

    /* 🛑 전역 `toContain` 으로는 **어느 모델의 것인지 가릴 수 없다.**
     *   실측(2026-09-07 주입 프로브): `sdsDocuments SDSDocument[]` 는 스키마 전체에 4곳
     *   (Organization·Product·ProductLot·다른 1곳) 있어, Product 것을 지워도
     *   `count >= 2` 가 통과했다 — 검출력 0인 단언이 land 될 뻔했다(4원칙 ④ 대체 매칭).
     *   → 모델 블록을 잘라 **그 안에서** 본다. 창은 `model X {` ↔ 대응 닫는 `}`. */
    function modelBlock(name: string): string {
      const start = src.indexOf(`model ${name} {`);
      expect(start).toBeGreaterThan(-1);
      const end = src.indexOf("\n}", start);
      return src.slice(start, end === -1 ? src.length : end);
    }

    // 백릴레이션 — 모델별로 각각 단언한다(경로는 OR 로 묶지 않는다)
    expect(modelBlock("Product")).toContain("sdsDocuments SDSDocument[]");
    expect(modelBlock("Organization")).toContain("sdsDocuments SDSDocument[]");

    // FK — SDSDocument 쪽 소유 관계
    const sds = modelBlock("SDSDocument");
    expect(sds).toContain("product Product @relation(fields: [productId]");
    expect(sds).toContain("organization Organization? @relation(fields: [organizationId]");
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
