/**
 * §ko-ux ② — dashboard 영문 라벨 한글화/제거 회귀 가드 (호영님 P1)
 *
 * 권장 확정:
 *   - spend-trend-card: eyebrow "Real-time Spend Tracking" 제거(본제목 "지출 트렌드 분석"으로 충분, ui-wizard §8 장식 영문 금지).
 *   - executive-summary: hover popup "Quick Data Breakdown" → "데이터 상세"(기능 제목 보존).
 *   - executive-summary: 카드 eyebrow "System Insight" → "운영 인사이트"(+ aria-label 동기화).
 *   - 주석의 영문(§ 히스토리, 대문자 "SYSTEM INSIGHT"/"REAL-TIME SPEND")은 보존 — 렌더 문자열만 검사.
 *
 * 방법: readFileSync + regex (격리 node → operator 실 vitest).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const SPEND_PATH = "src/components/dashboard/spend-trend-card.tsx";
const EXEC_PATH = "src/components/dashboard/executive-summary-section.tsx";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§ko-ux ② — spend-trend-card eyebrow 제거", () => {
  it("영문 eyebrow 'Real-time Spend Tracking' 렌더 제거", () => {
    const src = read(SPEND_PATH);
    expect(src).not.toMatch(/Real-time Spend Tracking/);
  });
  it("본제목 '지출 트렌드 분석' 보존", () => {
    const src = read(SPEND_PATH);
    expect(src).toMatch(/지출 트렌드 분석/);
  });
});

describe("§ko-ux ② — executive-summary 영문 라벨 한글화", () => {
  it("'Quick Data Breakdown' → '데이터 상세' (렌더만, § 주석 보존)", () => {
    const src = read(EXEC_PATH);
    expect(src).not.toMatch(/>\s*Quick Data Breakdown/); // JSX 렌더 위치만
    expect(src).toMatch(/데이터 상세/);
  });
  it("카드 eyebrow 'System Insight' → '운영 인사이트' (렌더 + aria-label 동기화, § 주석 보존)", () => {
    const src = read(EXEC_PATH);
    expect(src).not.toMatch(/>\s*System Insight/); // JSX 렌더 위치만
    expect(src).not.toMatch(/aria-label="System Insight/);
    expect(src).toMatch(/운영 인사이트/);
    expect(src).toMatch(/aria-label="운영 인사이트 카드 닫기"/);
  });
});
