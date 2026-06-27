/**
 * §msds-version-validation P4-surface — 버전상태 단일 소스 노출 (호영님 2026-06-27)
 *
 * /api/safety/products 가 버전 메타를 include → adapter 가 버전상태 집계(msdsVersionSummary, 단일 소스)
 * → 안전 페이지 MSDS 점검 준비 패널의 "MSDS 버전 검증"(최신본/구버전 의심/출처 없음) 표기.
 * KOSHA 라이브 대조 아님 = "메타 기반 추정" 정직 라벨.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO = join(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(join(REPO, rel), "utf8");

const ROUTE = read("src/app/api/safety/products/route.ts");
const ADAPTER = read("src/lib/safety/product-to-safety-item.ts");
const PAGE = read("src/app/dashboard/safety/page.tsx");
const PAGE_CODE = PAGE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

describe("§msds-version P4-surface — API/adapter 단일 소스", () => {
  it("/api/safety/products sdsDocuments 가 버전 메타 include", () => {
    expect(ROUTE).toMatch(/docVersion: true/);
    expect(ROUTE).toMatch(/issuedAt: true/);
    expect(ROUTE).toMatch(/expiresAt: true/);
    expect(ROUTE).toMatch(/supersededAt: true/);
  });
  it("adapter 가 classifyMsdsVersion 으로 msdsVersionSummary 집계", () => {
    expect(ADAPTER).toMatch(/classifyMsdsVersion/);
    expect(ADAPTER).toMatch(/msdsVersionSummary/);
    expect(ADAPTER).toMatch(/return \{ items, productIdByLocalId, msdsVersionSummary \}/);
  });
});

describe("§msds-version P4-surface — 페이지 버전 검증 패널", () => {
  it("페이지가 msdsVersionSummary 캡처(단일 소스)", () => {
    expect(PAGE_CODE).toMatch(/setMsdsVersionSummary/);
    expect(PAGE_CODE).toMatch(/msdsVersionSummary: vsum/);
  });
  it("버전 검증 패널 3상태(최신본/구버전 의심/출처 없음) + 단일 소스 참조", () => {
    expect(PAGE_CODE).toMatch(/MSDS 버전 검증/);
    expect(PAGE_CODE).toMatch(/최신본 확보/);
    expect(PAGE_CODE).toMatch(/구버전 의심/);
    expect(PAGE_CODE).toMatch(/출처 없음/);
    expect(PAGE_CODE).toMatch(/n: msdsVersionSummary\.current/);
    expect(PAGE_CODE).toMatch(/n: msdsVersionSummary\.stale/);
    expect(PAGE_CODE).toMatch(/n: msdsVersionSummary\.unknown/);
  });
  it("KOSHA 과대표기 금지 — '메타 기반 추정' 정직 라벨 + GMP 이력 보관 노트", () => {
    expect(PAGE_CODE).toMatch(/메타 기반 추정/);
    expect(PAGE_CODE).toMatch(/삭제 없이 이력 보관/);
  });
});
