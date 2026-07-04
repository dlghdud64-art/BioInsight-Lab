/**
 * §msds-bulk-registration B-P3 — 일괄 오케스트레이션 API(preview + commit).
 * stateless 2-phase. 실 등록(문서 저장+SDSDocument), 오등록/no-op/fake success 방지.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const R = join(__dirname, "..", "..");
const rd = (p: string) => readFileSync(join(R, p), "utf8");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

describe("§msds-bulk B-P3 — preview(추출·매칭, 미저장)", () => {
  const S = strip(rd("app/api/safety/sds/bulk/route.ts"));
  it("추출 + 매칭 파이프라인 재사용", () => {
    expect(S).toMatch(/extractTextFromPDF/);
    expect(S).toMatch(/extractSafetyInfoFromMSDS/);
    expect(S).toMatch(/matchMsdsToProducts/);
  });
  it("OPENAI 무키 정직 처리 + 파일 수 cap", () => {
    expect(S).toMatch(/extractionAvailable\s*=\s*!!process\.env\.OPENAI_API_KEY/);
    expect(S).toMatch(/MAX_FILES/);
  });
  it("preview 는 미저장(SDSDocument.create 없음)", () => {
    expect(S).not.toMatch(/sDSDocument\.create/);
  });
  it("품목 풀 org 스코프", () => {
    expect(S).toMatch(/organizationMember\.findMany/);
    expect(S).toMatch(/productInventory\.findMany/);
  });
});

describe("§msds-bulk B-P3 — commit(실 등록, 오등록/부분실패 방지)", () => {
  const C = strip(rd("app/api/safety/sds/bulk/commit/route.ts"));
  it("실 등록 = 파일 저장 + SDSDocument 생성 + backfill", () => {
    expect(C).toMatch(/uploadSdsFile/);
    expect(C).toMatch(/sDSDocument\.create/);
    expect(C).toMatch(/backfillHazardFromMsds/);
  });
  it("productId 없음=skip(no-op 아님), pool 밖=forbidden(오등록 방지)", () => {
    expect(C).toMatch(/status:\s*"skipped"/);
    expect(C).toMatch(/allowed\.has\(productId\)/);
    expect(C).toMatch(/status:\s*"forbidden"/);
  });
  it("건별 부분실패 격리 + registered 는 실제 생성 성공만(fake success 금지)", () => {
    expect(C).toMatch(/status:\s*"failed"/);
    expect(C).toMatch(/registeredCount\s*\+=\s*1/);
    expect(C).toMatch(/status:\s*"registered"/);
  });
  it("스토리지 미설정 graceful(silent 성공 금지)", () => {
    expect(C).toMatch(/StorageNotConfiguredError/);
    expect(C).toMatch(/storage_not_configured/);
  });
});
