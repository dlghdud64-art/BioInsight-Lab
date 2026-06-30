/**
 * §scan-secondary-match → §scan-reverse-match-v2 진화 (호영님 2026-06-30)
 *
 * v1(matchProduct 단방향 fuzzy)을 v2(rankReverseCandidates: 양방향·토큰·신뢰도)로 supersede.
 * route: 미매칭 한정 역매칭, 자동확정 부재, catalogNo 매칭 보존, productCandidates/matchType 응답.
 * UI: 후보 행(승인형) + per-candidate 신뢰도 배지 + [이 품목 선택]=폼 채움, 신규 배너 토큰 보존.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SRC = resolve(__dirname, "../..");
const read = (rel: string) => readFileSync(resolve(SRC, rel), "utf8");

describe("§scan-reverse-match-v2 — route (scan-label 역매칭 v2)", () => {
  const ROUTE = read("app/api/inventory/scan-label/route.ts");

  it("rankReverseCandidates import + 호출(productName/brand)", () => {
    expect(ROUTE).toMatch(/import \{ rankReverseCandidates[\s\S]{0,90}from "@\/lib\/inventory\/reverse-match"/);
    expect(ROUTE).toMatch(/rankReverseCandidates\(\s*\{ productName: merged\.productName, brand: merged\.brand \}/);
  });

  it("미매칭일 때만 역매칭(자동확정 금지 — 역매칭發 matchedProduct 세팅 X)", () => {
    expect(ROUTE).toMatch(/if \(!matchedProduct && \(merged\.productName \|\| merged\.brand\)\)/);
    expect(ROUTE).toMatch(/productCandidates\.length > 0\) matchType = "fuzzy_name"/);
    // catalogNo 매칭의 `matchedProduct = product` 는 허용. 역매칭發 자동확정만 금지.
    expect(ROUTE).not.toMatch(/matchedProduct = (await |productCandidates|rankReverse)/);
  });

  it("응답 shape: matchType + productCandidates", () => {
    expect(ROUTE).toMatch(/matchType,/);
    expect(ROUTE).toMatch(/productCandidates,/);
  });

  it("회귀 0 — 기존 catalogNo findFirst(insensitive) 매칭 보존", () => {
    expect(ROUTE).toMatch(/catalogNumber:\s*\{[\s\S]{0,40}equals: merged\.catalogNo[\s\S]{0,40}mode: "insensitive"/);
  });

  it("v1 supersede — matchProduct 단방향 fuzzy 미사용", () => {
    expect(ROUTE).not.toMatch(/matchProduct\(/);
  });
});

describe("§scan-reverse-match-v2 — UI 승인형 후보 + 신뢰도 배지", () => {
  const MODAL = read("components/inventory/LabelScannerModal.tsx");

  it("ScanApiResponse 후보에 confidence/level 전파", () => {
    expect(MODAL).toMatch(/productCandidates\?:/);
    expect(MODAL).toMatch(/level\?:\s*"high"\s*\|\s*"medium"\s*\|\s*"low"/);
  });

  it("후보 행은 fuzzy & candidates 있을 때만(dead button 0) + cap 3", () => {
    expect(MODAL).toMatch(/scanResult\.matchType === "fuzzy_name" && scanResult\.productCandidates && scanResult\.productCandidates\.length > 0 && \(/);
    expect(MODAL).toMatch(/scanResult\.productCandidates\.slice\(0, 3\)/);
    expect(MODAL).toMatch(/유사 품목 후보/);
  });

  it("per-candidate 신뢰도 배지(높음/보통/낮음, §11.302 톤)", () => {
    expect(MODAL).toMatch(/c\.level === "high" \? "높음"/);
    expect(MODAL).toMatch(/bg-emerald-100 text-emerald-700/);
    expect(MODAL).toMatch(/bg-yellow-100 text-yellow-700/);
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
    expect(MODAL).toMatch(/scanResult\.matchType !== "fuzzy_name" \|\| !scanResult\.productCandidates\?\.length/);
  });
});
