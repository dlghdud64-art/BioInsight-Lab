/**
 * §scan-secondary-match (호영님 2026-06-30) — catalogNo 미매칭 시 name+brand fuzzy 후보(승인형).
 *   (PLAN_scan-secondary-match)
 *
 * route: scan-label 가 catalogNo 미매칭일 때만 matchProduct(fuzzy) 호출 → productCandidates/matchType 응답.
 *        기존 catalogNo findFirst(insensitive) 보존, fuzzy 로 matchedProduct 자동확정 금지.
 * UI: LabelScannerModal 후보 행(matchType fuzzy & candidates 있을 때만) + [이 품목 선택]=updateField 3필드.
 *     신규 품목 calm 배너 보존(후보 시 런타임 양보, 토큰 보존).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SRC = resolve(__dirname, "../..");
const read = (rel: string) => readFileSync(resolve(SRC, rel), "utf8");

describe("§scan-secondary-match — route (scan-label fuzzy 연동)", () => {
  const ROUTE = read("app/api/inventory/scan-label/route.ts");

  it("matchProduct import + catalogNumber 생략 호출(Tier1 skip → fuzzy)", () => {
    expect(ROUTE).toMatch(/import \{ matchProduct[\s\S]{0,80}from "@\/lib\/inventory\/product-matcher"/);
    expect(ROUTE).toMatch(/matchProduct\(\s*\{ productName: merged\.productName, brand: merged\.brand \}/);
  });

  it("미매칭일 때만 fuzzy 후보(자동확정 금지 — matchedProduct fuzzy 세팅 X)", () => {
    expect(ROUTE).toMatch(/if \(!matchedProduct && \(merged\.productName \|\| merged\.brand\)\)/);
    // fuzzy 결과는 productCandidates/matchType 으로만 — matchedProduct 에 대입하지 않음
    expect(ROUTE).toMatch(/matchType = "fuzzy_name"/);
    expect(ROUTE).not.toMatch(/matchedProduct = fuzzy/);
  });

  it("응답 shape: matchType + productCandidates", () => {
    expect(ROUTE).toMatch(/matchType,/);
    expect(ROUTE).toMatch(/productCandidates,/);
  });

  it("회귀 0 — 기존 catalogNo findFirst(insensitive) 매칭 보존", () => {
    expect(ROUTE).toMatch(/catalogNumber:\s*\{[\s\S]{0,40}equals: merged\.catalogNo[\s\S]{0,40}mode: "insensitive"/);
  });
});

describe("§scan-secondary-match — UI 승인형 후보(LabelScannerModal)", () => {
  const MODAL = read("components/inventory/LabelScannerModal.tsx");

  it("ScanApiResponse 에 matchType + productCandidates", () => {
    expect(MODAL).toMatch(/matchType\?:\s*"fuzzy_name"\s*\|\s*null/);
    expect(MODAL).toMatch(/productCandidates\?:/);
  });

  it("후보 행은 fuzzy & candidates 있을 때만(dead button 0)", () => {
    expect(MODAL).toMatch(/scanResult\.matchType === "fuzzy_name" && scanResult\.productCandidates && scanResult\.productCandidates\.length > 0 && \(/);
    expect(MODAL).toMatch(/유사 품목 후보/);
  });

  it("[이 품목 선택] = 폼 채움(updateField 3필드, canonical 무접촉)", () => {
    expect(MODAL).toMatch(/updateField\("productName", c\.name\)/);
    expect(MODAL).toMatch(/updateField\("brand", c\.brand \?\? ""\)/);
    expect(MODAL).toMatch(/updateField\("catalogNumber", c\.catalogNumber \?\? ""\)/);
    expect(MODAL).toMatch(/이 품목 선택/);
  });

  it("회귀 0 — 신규 품목 calm 배너 토큰 보존(§scan-manual-path)", () => {
    expect(MODAL).toMatch(/!scanResult\.matchedProduct && \(/);
    expect(MODAL).toMatch(/DB에 없는 신규 품목입니다/);
    // 후보 존재 시 배너 런타임 양보 게이트
    expect(MODAL).toMatch(/scanResult\.matchType !== "fuzzy_name" \|\| !scanResult\.productCandidates\?\.length/);
  });
});
