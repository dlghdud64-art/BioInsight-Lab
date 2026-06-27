/**
 * §msds-version-validation P4-core — 버전 메타 persistence 배선 (호영님 2026-06-27)
 *
 * POST /api/products/[id]/sds 가 docVersion/issuedAt/expiresAt 를 파싱·저장하고,
 * MSDS 다이얼로그가 그 메타를 전송한다. ("버전·만료 메타 미저장" 표기 해소.)
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO = join(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(join(REPO, rel), "utf8");

const ROUTE = read("src/app/api/products/[id]/sds/route.ts");
const PAGE = read("src/app/dashboard/safety/page.tsx");
const PAGE_CODE = PAGE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

describe("§msds-version P4-core — POST /sds 메타 저장", () => {
  it("docVersion/issuedAt/expiresAt formData 파싱", () => {
    expect(ROUTE).toMatch(/form\.get\("docVersion"\)/);
    expect(ROUTE).toMatch(/form\.get\("issuedAt"\)/);
    expect(ROUTE).toMatch(/form\.get\("expiresAt"\)/);
  });
  it("SDSDocument.create data 에 메타 저장", () => {
    expect(ROUTE).toMatch(/docVersion,/);
    expect(ROUTE).toMatch(/issuedAt,/);
    expect(ROUTE).toMatch(/expiresAt,/);
  });
});

describe("§msds-version P4-core — 다이얼로그 메타 전송 + 표기 해소", () => {
  it("handleMsdsSave 가 메타를 FormData 로 전송", () => {
    expect(PAGE_CODE).toMatch(/fd\.append\("docVersion"/);
    expect(PAGE_CODE).toMatch(/fd\.append\("issuedAt"/);
    expect(PAGE_CODE).toMatch(/fd\.append\("expiresAt"/);
  });
  it("'메타 자동 저장은 준비 중' 미저장 표기 제거", () => {
    expect(PAGE).not.toMatch(/메타 자동 저장은 준비 중/);
  });
});

describe("§msds-version P4-core — classifier 단일 소스 export", () => {
  it("msds-version 모듈이 classify/summarize export", () => {
    const mod = read("src/lib/safety/msds-version.ts");
    expect(mod).toMatch(/export function classifyMsdsVersion/);
    expect(mod).toMatch(/export function summarizeMsdsVersions/);
  });
});
