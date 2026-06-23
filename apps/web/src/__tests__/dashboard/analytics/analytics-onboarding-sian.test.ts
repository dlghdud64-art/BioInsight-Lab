/**
 * §11.244-sian Phase 1 — 지출 분석 빈상태 온보딩 sentinel
 *
 * 정본: 호영님(CEO) 지시 — analytics-app.jsx Improved 중 honesty 무위험 부분만 포팅.
 *
 * 검증(격리 readFileSync+regex → operator 실 vitest):
 *   (A) 빈상태 판정 canonical 신호 (spendDataEmpty = !hasMonthlyData && topSpending.length === 0)
 *   (B) 온보딩 히어로 문구 + CTA 2개 (실제 라우트 /app/search · /dashboard/budget)
 *   (C) 활성화 3단계 체크리스트 (워크스페이스 / 예산 등록 / 첫 발주) + derive (하드코딩 금지)
 *   (D) KPI 4 "언제 채워지는지" 힌트 + ghost bar
 *   (E) 미리보기 차트 2개 — "미리보기"/"대기" 칩 + honesty 캡션 ("예시")
 *   (F) honesty: AiReportModal 미도입 + 샘플 savings/dependency 수치 부재
 *   (G) 회귀 0 — SpendTrendAreaChart / fetchAnalyticsDashboard / TeamAnalyticsView / 기존 testid 보존
 *   (H) dead button 0 — 온보딩 CTA 는 모두 <Link href=...> (no-op onClick 금지)
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

const PAGE = read("src/app/dashboard/analytics/page.tsx");

// ── (A) 빈상태 판정 canonical 신호 ───────────────────────────────
describe("§11.244-sian (A) — 빈상태 판정 canonical 신호", () => {
  it("spendDataEmpty 는 hasMonthlyData + topSpending.length 으로 derive", () => {
    expect(PAGE).toMatch(/const spendDataEmpty\s*=\s*!hasMonthlyData\s*&&\s*topSpending\.length\s*===\s*0/);
  });
  it("온보딩 분기는 빈상태에서만 노출 (!isLoading && spendDataEmpty)", () => {
    expect(PAGE).toMatch(/\{!isLoading && spendDataEmpty &&/);
    expect(PAGE).toMatch(/data-testid="analytics-onboarding"/);
  });
  it("데이터-있음 경로는 !spendDataEmpty 로 보존 (변경 0)", () => {
    expect(PAGE).toMatch(/\{!spendDataEmpty && \(<>/);
  });
});

// ── (B) 온보딩 히어로 + CTA ──────────────────────────────────────
describe("§11.244-sian (B) — 온보딩 히어로 문구 + CTA", () => {
  it("eyebrow: 활성화까지 N단계 (derive — onboardingRemaining)", () => {
    expect(PAGE).toMatch(/분석 활성화까지 \{onboardingRemaining\}단계/);
  });
  it("h2 본문 문구", () => {
    expect(PAGE).toMatch(/첫 발주가 완료되면 지출 분석이 자동으로 켜집니다/);
    expect(PAGE).toMatch(/모두 실제 발주 데이터에서 계산됩니다/);
    expect(PAGE).toMatch(/지금은 0건 수집됨/);
  });
  it("CTA 2개 실제 라우트 연결 (/app/search · /dashboard/budget)", () => {
    expect(PAGE).toMatch(/소싱에서 시작/);
    expect(PAGE).toMatch(/예산 먼저 등록/);
    expect(PAGE).toMatch(/href="\/app\/search"/);
    expect(PAGE).toMatch(/href="\/dashboard\/budget"/);
  });
});

// ── (C) 활성화 3단계 체크리스트 + derive ────────────────────────
describe("§11.244-sian (C) — 활성화 3단계 체크리스트 derive", () => {
  it("3단계 라벨 (워크스페이스 / 예산 등록 / 첫 발주)", () => {
    expect(PAGE).toMatch(/워크스페이스 생성/);
    expect(PAGE).toMatch(/label: "예산 등록"/);
    expect(PAGE).toMatch(/label: "첫 발주 완료"/);
  });
  it("예산 단계 done 은 budget.total 기반 (budgetRegistered = budget.total > 0)", () => {
    expect(PAGE).toMatch(/const budgetRegistered\s*=\s*budget\.total\s*>\s*0/);
    expect(PAGE).toMatch(/done:\s*budgetRegistered/);
  });
  it("첫 발주 단계 done 은 !spendDataEmpty derive", () => {
    expect(PAGE).toMatch(/done:\s*!spendDataEmpty/);
  });
  it("완료 칩은 derive (onboardingDoneCount / onboardingSteps.length) — 하드코딩 부재", () => {
    expect(PAGE).toMatch(/const onboardingDoneCount\s*=\s*onboardingSteps\.filter/);
    expect(PAGE).toMatch(/\{onboardingDoneCount\} \/ \{onboardingSteps\.length\} 완료/);
    // 하드코딩된 "1 / 3 완료" / "2 / 3 완료" 등 금지
    expect(PAGE).not.toMatch(/[0-9] \/ 3 완료/);
  });
});

// ── (D) KPI 4 힌트 + ghost bar ──────────────────────────────────
describe("§11.244-sian (D) — KPI 4 힌트 + ghost bar", () => {
  it("각 KPI 에 '언제 채워지는지' 힌트", () => {
    expect(PAGE).toMatch(/예산 등록 시 채워집니다/);
    expect(PAGE).toMatch(/발주 완료 시 채워집니다/);
    expect(PAGE).toMatch(/발주 데이터로 AI 자동 산출/);
    expect(PAGE).toMatch(/발주 3건\+ 누적 시 산출/);
  });
  it("소진율 KPI 값은 canonical (budgetRegistered ? usageRate : 미등록)", () => {
    expect(PAGE).toMatch(/budgetRegistered\s*\?\s*`\$\{budget\.usageRate\}%`\s*:\s*"미등록"/);
  });
});

// ── (E) 미리보기 차트 2개 — 칩 + honesty 캡션 ───────────────────
describe("§11.244-sian (E) — 미리보기 차트 honesty 라벨/캡션", () => {
  it("미리보기 칩 + 대기 칩 존재", () => {
    expect(PAGE).toMatch(/미리보기/);
    expect(PAGE).toMatch(/대기/);
  });
  it("honesty 캡션 — '예시' 명시 (실제 수치 아님)", () => {
    expect(PAGE).toMatch(/발주 데이터가 쌓이면 이렇게 표시됩니다 \(예시/);
    expect(PAGE).toMatch(/데이터가 축적되면 자동 생성됩니다 \(예시/);
  });
  it("sparkline 은 장식 인라인 SVG (점선 strokeDasharray)", () => {
    expect(PAGE).toMatch(/PREVIEW_SPARK_POINTS/);
    expect(PAGE).toMatch(/strokeDasharray="4 4"/);
  });
});

// ── (F) honesty — AiReportModal 미도입 + 샘플 수치 부재 ─────────
describe("§11.244-sian (F) — AiReportModal 미도입 (Phase 2)", () => {
  it("AiReportModal 미포팅", () => {
    expect(PAGE).not.toContain("AiReportModal");
  });
  it("온보딩 미리보기에 가짜 실수치 부재 (sparkline 외 mockup 절감/의존도 수치 0)", () => {
    // 온보딩 KPI 절감 기회 / 의존도는 canonical 0 표현 ("--") — 날조 금액 부재
    expect(PAGE).not.toMatch(/savingsSample|dependencySample|mockSavings|예시 절감액 ₩/);
  });
});

// ── (G) 회귀 0 — 데이터-있음 경로 / 기존 차트 / wiring 보존 ──────
describe("§11.244-sian (G) — 회귀 0 (기존 자산 보존)", () => {
  it("SpendTrendAreaChart 실제/mockup 렌더 보존", () => {
    expect(PAGE).toMatch(/<SpendTrendAreaChart data=\{monthlySpending\} variant="real"/);
    expect(PAGE).toMatch(/<SpendTrendAreaChart data=\{MOCKUP_MONTHLY_DATA\} variant="mockup"/);
  });
  it("fetchAnalyticsDashboard 패칭 보존", () => {
    expect(PAGE).toMatch(/async function fetchAnalyticsDashboard/);
    expect(PAGE).toMatch(/queryFn: fetchAnalyticsDashboard/);
  });
  it("TeamAnalyticsView / 기존 탭 / AI 리포트 버튼 보존", () => {
    expect(PAGE).toMatch(/<TeamAnalyticsView \/>/);
    expect(PAGE).toMatch(/AI 리포트 생성/);
    expect(PAGE).toMatch(/카테고리별 지출 통계/);
  });
});

// ── (H) dead button 0 — 온보딩 CTA 는 모두 Link ─────────────────
describe("§11.244-sian (H) — dead button 0", () => {
  it("온보딩 영역 CTA 는 onClick no-op 없이 Link href 연결", () => {
    // 온보딩 hero/체크리스트 CTA 에 빈 onClick={() => {}} 부재
    expect(PAGE).not.toMatch(/onClick=\{\(\) => \{\}\}/);
    expect(PAGE).not.toMatch(/onClick=\{\(\) => undefined\}/);
  });
});
