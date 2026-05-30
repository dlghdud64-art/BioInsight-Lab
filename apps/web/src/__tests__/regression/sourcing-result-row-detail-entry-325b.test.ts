/**
 * §11.325b #product-detail-entry-wiring — Regression sentinel (Phase 1 RED)
 *
 * 호영님 P1 즉시 (구 spec §11.321, 번호 충돌로 §11.325 매핑, §11.325b 배선 batch):
 *
 *   §11.325 Truth Reconciliation 결과:
 *   - /products/[id]/page.tsx 라우트 존재 (1293 lines 풀 구현)
 *   - 비로그인 ProductCard = 카드 본체 Link wrap (정상 배선)
 *   - 워크벤치 sourcing-result-row.tsx = onSelect → rail ProductDetailSummary trigger (동작 정상)
 *   - 시각 affordance 부재: ChevronRight (line 319) onClick 0 dead UI, 명시적 라벨 0
 *
 *   호영님 4 결정:
 *   1. 옵션 A — 명시적 "상세 보기" button 추가
 *   2. ChevronRight wiring 추가(제거 X) + cursor-pointer + hover affordance + button 동일 동작
 *   3. 상세 진입 표면 = product-detail-summary.tsx 패널 (same-canvas), /products/[id] = 비로그인만
 *   4. P1 즉시
 *
 *   본 sentinel = Phase 1 RED. Phase 2 GREEN target:
 *   - 명시적 "상세 보기" button 신설 (onSelect 호출)
 *   - ChevronRight onClick={onSelect} + cursor-pointer + hover affordance
 *   - canonical 보존: onSelect / isSelected / 비교 추가 / 견적 담기 / showDetailLink
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const ROW_PATH = "src/app/_workbench/_components/sourcing-result-row.tsx";
const RAIL_PATH = "src/app/_workbench/_components/sourcing-context-rail.tsx";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.325b — 명시적 '상세 보기' button 신설 (Phase 2 GREEN target)", () => {
  it("상세 보기 button testid + onSelect wiring", () => {
    const src = read(ROW_PATH);
    expect(src).toMatch(/data-testid="sourcing-result-row-detail-cta"/);
    // button onClick → onSelect (또는 setActiveResultId trigger)
    expect(src).toMatch(/data-testid="sourcing-result-row-detail-cta"[\s\S]{0,300}onClick=\{[^}]*onSelect/);
  });

  it("상세 보기 button 라벨 '상세 보기' 명시", () => {
    const src = read(ROW_PATH);
    expect(src).toMatch(/상세 보기/);
  });
});

describe("§11.325b — ChevronRight dead UI wiring 추가 (Phase 2 GREEN target)", () => {
  it("ChevronRight onClick={onSelect} wiring + button 으로 wrap", () => {
    const src = read(ROW_PATH);
    // ChevronRight 를 <button> 또는 onClick 가진 요소로 wrap (단순 className 시각 only 패턴 제거)
    expect(src).toMatch(/<button[^>]*onClick=\{[^}]*onSelect[\s\S]{0,200}<ChevronRight/);
  });

  it("ChevronRight cursor-pointer + hover affordance 명확", () => {
    const src = read(ROW_PATH);
    // ChevronRight 또는 wrap button 에 cursor-pointer 또는 group-hover 색상 분기 (이미 있음, hover affordance 명시화)
    expect(src).toMatch(/cursor-pointer|hover:text-/);
  });
});

describe("§11.325b — canonical 보존 (호영님 spec 4 결정 정합)", () => {
  it("카드 본체 onSelect 보존 (rail trigger 패턴)", () => {
    const src = read(ROW_PATH);
    // line 208 onClick={onSelect} 보존
    expect(src).toMatch(/onClick=\{onSelect\}/);
  });

  it("isSelected prop / 선택 시각 보존", () => {
    const src = read(ROW_PATH);
    expect(src).toMatch(/isSelected/);
  });

  it("비교 추가 / 견적 담기 wiring 보존 (onToggleCompare / onToggleRequest)", () => {
    const src = read(ROW_PATH);
    expect(src).toMatch(/onToggleCompare/);
    expect(src).toMatch(/onToggleRequest/);
  });
});

describe("§11.325b — sourcing-context-rail ProductDetailSummary same-canvas 보존", () => {
  it("rail 안 ProductDetailSummary import + render 보존 (same-canvas 패널 패턴)", () => {
    const src = read(RAIL_PATH);
    expect(src).toMatch(/import\s*\{[^}]*ProductDetailSummary/);
    expect(src).toMatch(/<ProductDetailSummary/);
  });

  it("showDetailLink={true} 보존 — /products/[id] 보조 link (비로그인 진입로 정합)", () => {
    const src = read(RAIL_PATH);
    expect(src).toMatch(/showDetailLink=\{true\}/);
  });
});
