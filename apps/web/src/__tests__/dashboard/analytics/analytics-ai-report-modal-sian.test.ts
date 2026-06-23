/**
 * §analytics-ai-report-sian Phase 2 — AI 지출 리포트 "예시 미리보기" 모달 sentinel
 *
 * 정본: 호영님(CEO) 결정 — "리포트 예시 명시".
 *   시안형 AI 지출 리포트(분기요약·절감Top3·공급사 의존도·AI 권고)를 생성하는
 *   실 endpoint 는 없음 → 정직하게 "예시 미리보기"(format preview) 로만 노출.
 *
 * 검증(격리 readFileSync+regex → operator 실 vitest):
 *   (A) 모달 state + 트리거 버튼 + 모달 markup 존재
 *   (B) honesty — 예시 고지 문구 ≥2 (헤더 "예시 미리보기" + 상단 배너 + 풋터 고지)
 *   (C) 4 섹션 — 분기 요약 / AI 절감 기회 Top3 / 공급사 의존도 / AI 권고
 *   (D) dead button 0 — PDF 저장 버튼 부재, 닫기만 (실 다운로드 동작 없음)
 *   (E) 회귀 0 — 온보딩(spendDataEmpty/testid) · SpendTrendAreaChart · fetchAnalyticsDashboard 보존
 *   (F) 색상 — amber/orange 금지 (yellow/slate/blue/emerald)
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

const PAGE = read("src/app/dashboard/analytics/page.tsx");

// ── (A) 모달 state + 트리거 + markup ─────────────────────────────
describe("§analytics-ai-report-sian (A) — 모달 존재", () => {
  it("reportModalOpen state 존재", () => {
    expect(PAGE).toMatch(/const \[reportModalOpen, setReportModalOpen\] = useState/);
  });
  it("트리거 버튼 — 'AI 리포트 예시' + setReportModalOpen(true)", () => {
    expect(PAGE).toContain("AI 리포트 예시");
    expect(PAGE).toMatch(/onClick=\{\(\) => setReportModalOpen\(true\)\}/);
  });
  it("모달 markup — data-testid + 조건부 렌더", () => {
    expect(PAGE).toMatch(/reportModalOpen && \(/);
    expect(PAGE).toContain('data-testid="ai-report-modal"');
  });
  it("헤더 — 'AI 지출 리포트 · 예시 미리보기'", () => {
    expect(PAGE).toContain("AI 지출 리포트 · 예시 미리보기");
  });
});

// ── (B) honesty — 예시 고지 문구 ≥2 ─────────────────────────────
describe("§analytics-ai-report-sian (B) — 예시 고지 (honesty)", () => {
  it("상단 배너 — '예시 리포트입니다.'", () => {
    expect(PAGE).toContain("예시 리포트입니다.");
  });
  it("배너 — '아래 수치는 샘플'", () => {
    expect(PAGE).toContain("아래 수치는 샘플");
  });
  it("풋터 — '예시 데이터 기준 · 실제 리포트는 발주 누적 시 생성'", () => {
    expect(PAGE).toContain("예시 데이터 기준 · 실제 리포트는 발주 누적 시 생성");
  });
  it("고지 위치 ≥2곳 보장 (헤더 미리보기 + 배너 + 풋터)", () => {
    const markers = [
      /예시 미리보기/,
      /예시 리포트입니다\./,
      /예시 데이터 기준/,
    ].filter((re) => re.test(PAGE)).length;
    expect(markers).toBeGreaterThanOrEqual(2);
  });
});

// ── (C) 4 섹션 ───────────────────────────────────────────────────
describe("§analytics-ai-report-sian (C) — 4 섹션", () => {
  it("분기 요약 (총지출/예산소진율/AI절감)", () => {
    expect(PAGE).toContain("분기 요약");
    expect(PAGE).toContain("총지출");
    expect(PAGE).toContain("예산 소진율");
  });
  it("AI 절감 기회 Top3 (대체품/통합발주/단가재협상)", () => {
    expect(PAGE).toContain("AI 절감 기회 Top 3");
    expect(PAGE).toContain("대체품 전환");
    expect(PAGE).toContain("통합 발주");
    expect(PAGE).toContain("단가 재협상");
  });
  it("공급사 의존도 (바)", () => {
    expect(PAGE).toMatch(/공급사 의존도[\s\S]{0,400}공급사 A/);
  });
  it("AI 권고 (리스트)", () => {
    expect(PAGE).toContain("AI 권고");
  });
});

// ── (D) dead button 0 — PDF 저장 버튼 부재 ───────────────────────
describe("§analytics-ai-report-sian (D) — dead button 0", () => {
  it("PDF 저장 버튼 부재 (실 다운로드 동작 없음)", () => {
    // 주석 설명 텍스트("PDF 저장 버튼 없음 — dead button 금지")는 실 버튼 아님 → 주석(/* */·//) 제거 후 코드만 검사.
    const code = PAGE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    expect(code).not.toContain("PDF 저장");
    expect(code).not.toMatch(/PDF\s*다운로드|리포트\s*다운로드/);
  });
  it("닫기 버튼 존재 (setReportModalOpen(false))", () => {
    expect(PAGE).toMatch(/onClick=\{\(\) => setReportModalOpen\(false\)\}/);
  });
});

// ── (E) 회귀 0 ───────────────────────────────────────────────────
describe("§analytics-ai-report-sian (E) — 회귀 0 (온보딩/차트/fetch 보존)", () => {
  it("빈상태 온보딩 분기 (spendDataEmpty + testid) 보존", () => {
    expect(PAGE).toContain("const spendDataEmpty =");
    expect(PAGE).toContain('data-testid="analytics-onboarding"');
  });
  it("SpendTrendAreaChart 보존", () => {
    expect(PAGE).toContain("SpendTrendAreaChart");
  });
  it("fetchAnalyticsDashboard 보존", () => {
    expect(PAGE).toContain("async function fetchAnalyticsDashboard");
  });
  it("기존 실 endpoint AI 리포트 생성 버튼(runAiAnalysis) 보존", () => {
    expect(PAGE).toContain("AI 리포트 생성");
    expect(PAGE).toContain("/api/analytics/ai-insight");
  });
});

// ── (F) 색상 — amber/orange 금지 (모달 범위) ─────────────────────
describe("§analytics-ai-report-sian (F) — amber/orange 금지", () => {
  it("모달 블록에 amber-/orange- 클래스 없음", () => {
    const start = PAGE.indexOf('data-testid="ai-report-modal"');
    const end = PAGE.indexOf("{/* ═══", start); // 모달 이후 다음 블록 경계
    const modalBlock = end > start ? PAGE.slice(start, end) : PAGE.slice(start, start + 8000);
    expect(modalBlock).not.toMatch(/\bamber-\d|\borange-\d/);
  });
});
