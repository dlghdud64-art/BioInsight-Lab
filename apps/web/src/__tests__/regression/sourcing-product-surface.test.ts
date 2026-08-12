/**
 * 소싱 제품 surface 정리 (§1-2④⑤⑥⑦) 회귀 가드
 *
 * P1 ① 퀵뷰 액션 정리 / P2 ② 라벨 통일 / P3 ③ 상세 정리.
 * sandbox vitest 실행(보강 후) → GREEN, 불가 시 "실행 불가" 명시.
 * 패턴: readFileSync + regex (DB/mount 무의존 lint-style).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(join(APP_WEB_ROOT, rel), "utf8");

const PEEK = "src/app/_workbench/_components/product-detail-summary.tsx";
const RAIL = "src/app/_workbench/_components/sourcing-context-rail.tsx";
const ROW = "src/app/_workbench/_components/sourcing-result-row.tsx";
const DETAIL = "src/app/products/[id]/page.tsx";

describe("§1-2④ P1 — 퀵뷰 액션 정리", () => {
  it("peek 액션바 = showCandidateActions 게이트(퀵뷰 억제 가능)", () => {
    const src = read(PEEK);
    expect(src).toMatch(/showCandidateActions/);
    expect(src).toMatch(/showCandidateActions\s*!==\s*false/);
  });
  it("peek 전진 CTA = 강한 primary '전체 상세 보기' (약한 링크 승격)", () => {
    const src = read(PEEK);
    expect(src).toMatch(/전체 상세 보기/);
    expect(src).not.toMatch(/전체 상세 페이지/);
    expect(src).toMatch(/전체 상세 보기[\s\S]{0,200}bg-blue-600|bg-blue-600[\s\S]{0,200}전체 상세 보기/);
  });
  it("퀵뷰(sourcing-context-rail)는 후보 추가 억제 = showCandidateActions={false}", () => {
    const src = read(RAIL);
    expect(src).toMatch(/<ProductDetailSummary[\s\S]{0,600}showCandidateActions=\{false\}/);
  });
  it("회귀 0 — 행(row)은 비교 추가/견적 담기 보존", () => {
    const src = read(ROW);
    expect(src).toMatch(/비교 추가/);
    expect(src).toMatch(/견적 담기/);
  });
});

describe("§1-2⑦ P2 — 라벨 통일(동의어 제거)", () => {
  it("peek 액션 라벨 = 비교 추가/견적 담기 (후보 추가 동의어 제거)", () => {
    const src = read(PEEK);
    expect(src).not.toMatch(/비교 후보에 추가/);
    expect(src).not.toMatch(/견적 후보에 추가/);
    expect(src).toMatch(/비교 추가/);
    expect(src).toMatch(/견적 담기/);
  });
  // supersede(§product-detail-refinement 계약④): 상세 라벨이 '비교 추가' → '비교 검토'(보조 2분할).
  //   잠그는 의도는 특정 라벨이 아니라 **동의어 난립 금지 · 비교 진입이 단일 라벨일 것**.
  it("상세 = 비교 진입 라벨 단일화(동의어 '바로 비교' 0)", () => {
    const src = read(DETAIL);
    expect(src).not.toMatch(/바로 비교/);
    expect(src).toMatch(/비교 검토/);
  });
  it("멤버십 상태 라벨 = '후보' 군더더기 제거", () => {
    const peek = read(PEEK);
    const rail = read(RAIL);
    expect(peek).not.toMatch(/비교 후보에 포함됨|견적 후보에 포함됨/);
    expect(rail).not.toMatch(/비교 후보에 포함됨|견적 후보에 포함됨/);
  });
});

describe("§1-2⑤⑥ P3 — 상세 정리", () => {
  it("'AI로 생성' 별도 AI 버튼 제거(관통원칙) — usageDescription DB값은 유지", () => {
    const src = read(DETAIL);
    expect(src).not.toMatch(/AI로 생성/);
    expect(src).toMatch(/usageDescription/);
  });
  it("찜하기 진입점 제거", () => {
    const src = read(DETAIL);
    expect(src).not.toMatch(/찜하기/);
  });
  it("리뷰 섹션 렌더 제거", () => {
    const src = read(DETAIL);
    expect(src).not.toMatch(/<ReviewSection/);
  });
  /**
   * 승계 (§sourcing-quote-flow v1.1 §4, 호영님 2026-08-12) — 개인화 추천은 검색/홈 맥락이라
   * 제품 상세에서 제거. **대체품 추천은 존치**(판단 재료) — 그쪽으로 보존 대상을 옮긴다.
   */
  it("회귀 0 — 대체품 추천 보존 / 개인화 추천은 §v1.1 §4 로 제거", () => {
    const src = read(DETAIL);
    expect(src).toMatch(/<AlternativeProductsSection/);
    expect(src).not.toMatch(/<PersonalizedRecommendations/);
  });
});

// §11.344 확장 — 상세 페이지도 자사 grade(A~E) UI 비노출(데이터 product.grade 는 보존)
describe("§1-2⑤ P3 — 상세 grade 비노출(§11.344 확장)", () => {
  it("상세 페이지에 product.grade 렌더 0 (데이터는 DB 보존)", () => {
    const src = read(DETAIL);
    expect(src).not.toMatch(/\{product\.grade\}/);
  });
});
