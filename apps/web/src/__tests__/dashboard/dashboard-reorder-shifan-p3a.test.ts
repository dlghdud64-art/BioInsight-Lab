/**
 * §dashboard-shifan-adopt P3a — 시안 단일 흐름 재배열 + 운영 KPI3 제거 sentinel
 *
 * 정본: docs/plans/PLAN_dashboard-shifan-adopt.md (Phase 3 / P3a)
 *
 * 검증(격리 readFileSync+regex → operator 실 vitest):
 *   (A) 시안 순서: StatLine → NextStepBanner → ActionInbox → Pipeline → 차트 → 빠른작업.
 *   (B) ExecutiveSummary(운영 KPI3 + 레거시 SystemInsightCard) 제거 — import/JSX 0(dead import 0).
 *   (C) 갭1: 재무 StatLine "재무 현황" h2 제거(시안=헤더 직하 3카드).
 *   (D) 가드: §11.199b 로딩게이트 무수정 + summary 단일 진실 훅 단일(신규 fetch 0) + awareness 보존.
 *
 * ⚠️ P3b(중단 2-col 재구성 + 예산집행률 카드 + 카테고리 mockup 제거)는 별도 sentinel.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const PAGE = readFileSync(join(REPO_ROOT, "src/app/dashboard/page.tsx"), "utf8");

// ── (A) 시안 단일 흐름 순서 ──────────────────────────────────────────────
describe("§dashboard-shifan-adopt P3a (A) — 시안 순서 재배열", () => {
  const iStat = PAGE.indexOf("<StatLine");
  const iNext = PAGE.indexOf("<NextStepBanner");
  const iInbox = PAGE.indexOf("<ActionInbox");
  const iPipe = PAGE.indexOf("<Pipeline");
  const iChart = PAGE.indexOf("<SpendTrendCard");
  const iQuick = PAGE.indexOf("<OperatorQuickActions");

  it("핵심 모듈 전부 렌더(인덱스 양수)", () => {
    for (const [n, v] of Object.entries({ iStat, iNext, iInbox, iPipe, iChart, iQuick })) {
      expect(v, n).toBeGreaterThan(0);
    }
  });
  it("StatLine → NextStepBanner → ActionInbox → Pipeline 순", () => {
    expect(iStat).toBeLessThan(iNext);
    expect(iNext).toBeLessThan(iInbox);
    expect(iInbox).toBeLessThan(iPipe);
  });
  it("Pipeline → 빠른작업(2-col) → 차트(하단) 순 — P3b 중단 재구성 반영", () => {
    // §dashboard-shifan-adopt P3b — 중단=예산&지출 카드+빠른작업(2-col), 지출트렌드/카테고리는 하단 이동.
    expect(iPipe).toBeLessThan(iQuick);
    expect(iQuick).toBeLessThan(iChart);
  });
  it("재배열 마커 주석", () => {
    expect(PAGE).toMatch(/§dashboard-shifan-adopt P3a — 시안 단일 흐름 재배열/);
  });
});

// ── (B) ExecutiveSummary 제거(dead import 0) ─────────────────────────────
describe("§dashboard-shifan-adopt P3a (B) — 운영 KPI3 제거", () => {
  it("ExecutiveSummarySection JSX 미렌더", () => {
    expect(PAGE).not.toMatch(/<ExecutiveSummarySection/);
  });
  it("executive-summary-section import 제거(dead import 0)", () => {
    expect(PAGE).not.toMatch(/components\/dashboard\/executive-summary-section/);
  });
  it("ExecutiveSummary 전용 prop(reorderReviewCount/deltas) 호출부 제거", () => {
    expect(PAGE).not.toContain("reorderReviewCount={stats.lowStockAlerts}");
  });
});

// ── (C) 갭1 — 재무 현황 h2 제거 ──────────────────────────────────────────
describe("§dashboard-shifan-adopt P3a (C) — StatLine h2 제거(갭1)", () => {
  it("'재무 현황' 헤더 미노출(시안=헤더 직하 3카드)", () => {
    // 주석 외 실제 h2 라벨 0. (주석은 '재무 현황' 따옴표 포함 — 라벨 패턴과 구분)
    expect(PAGE).not.toMatch(/<h2[^>]*>재무 현황<\/h2>/);
  });
  it("StatLine 자체는 보존(재무 KPI 소스)", () => {
    expect(PAGE).toMatch(/<StatLine/);
  });
});

// ── (D) 가드 — 로딩게이트/단일훅/awareness 보존 ───────────────────────────
describe("§dashboard-shifan-adopt P3a (D) — 가드 보존", () => {
  it("§11.199b 로딩게이트 무수정(isStillLoading/loadTimedOut)", () => {
    expect(PAGE).toMatch(/isStillLoading/);
    expect(PAGE).toMatch(/loadTimedOut/);
  });
  it("summary 단일 진실 훅 단일 — 신규 fetch 0", () => {
    expect((PAGE.match(/useDashboardSection<DashboardSummary>/g) || []).length).toBe(1);
  });
  it("awareness 보존 — NextStepBanner/ActionInbox/GlobalEmpty/Pipeline 전부 렌더", () => {
    expect(PAGE).toMatch(/<NextStepBanner/);
    expect(PAGE).toMatch(/<ActionInbox/);
    expect(PAGE).toMatch(/<GlobalEmpty\s*\/>/);
    expect(PAGE).toMatch(/<Pipeline/);
  });
});
