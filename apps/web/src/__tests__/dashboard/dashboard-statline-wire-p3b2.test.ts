/**
 * §main-dashboard-redesign P3-B2 — StatLine page 배선 + 재무 KPI 이전 sentinel
 *
 * 정본: docs/plans/PLAN_main-dashboard-redesign.md (P3-B2)
 *
 * 검증:
 *   (A) StatLine 배선 — summarySection(P3-B1 훅) 재사용(신규 fetch 0).
 *   (B) 재무 KPI 이전 — ExecutiveSummary "누적 지출"(store 예산축 ₩0 모순) 제거(가드②),
 *       운영 KPI(처리필요·진행발주·이상징후) 보존.
 *   (C) 비차단/무회귀 — stats useQuery + 로딩 게이트 + GlobalEmpty + Pipeline 보존.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const PAGE = readFileSync(join(REPO_ROOT, "src/app/dashboard/page.tsx"), "utf8");
const ES = readFileSync(join(REPO_ROOT, "src/components/dashboard/executive-summary-section.tsx"), "utf8");

// ── (A) StatLine 배선 ───────────────────────────────────────────────────
describe("§main-dashboard-redesign P3-B2 (A) — StatLine 배선", () => {
  it("StatLine import + 렌더", () => {
    expect(PAGE).toMatch(/import \{ StatLine \} from "@\/components\/dashboard\/stat-line"/);
    expect(PAGE).toMatch(/<StatLine/);
  });
  it("summarySection(P3-B1 훅) 재사용 — state/data/retry 주입(신규 fetch 0, 훅 단일)", () => {
    expect(PAGE).toMatch(/<StatLine[\s\S]{0,160}state=\{summarySection\.state\}/);
    expect((PAGE.match(/useDashboardSection<DashboardSummary>/g) || []).length).toBe(1);
  });
});

// ── (B) 재무 KPI 이전 — ExecutiveSummary 누적지출 제거 ─────────────────────
describe("§main-dashboard-redesign P3-B2 (B) — 재무 KPI 이전(가드②)", () => {
  it("ExecutiveSummary 에서 '누적 지출' KPI 카드 제거(₩0 모순 해소)", () => {
    expect(ES).not.toMatch(/label="누적 지출"/);
  });
  it("운영 KPI 보존 — 처리 필요 항목 / 진행 중 발주 / 신규 이상 징후", () => {
    expect(ES).toMatch(/label="처리 필요 항목"/);
    expect(ES).toMatch(/label="진행 중 발주"/);
    expect(ES).toMatch(/label="신규 이상 징후"/);
  });
  it("§11.311 — 3 KPI grid-cols-3 (4→3)", () => {
    expect(ES).toMatch(/grid grid-cols-3 gap-3/);
    expect(ES).not.toMatch(/sm:grid-cols-4/);
  });
});

// ── (C) 비차단 / 무회귀 ─────────────────────────────────────────────────
describe("§main-dashboard-redesign P3-B2 (C) — 비차단·무회귀", () => {
  it("기존 stats useQuery + 로딩 게이트 보존(§11.199b)", () => {
    expect(PAGE).toMatch(/queryKey:\s*\["dashboard-stats"\]/);
    expect(PAGE).toMatch(/isStillLoading/);
  });
  it("GlobalEmpty(P3-B1) + Pipeline(P4-B1) 보존 + ExecutiveSummary 제거(P3a)", () => {
    expect(PAGE).toMatch(/<GlobalEmpty\s*\/>/);
    expect(PAGE).toMatch(/<Pipeline/);
    // §dashboard-shifan-adopt P3a — ExecutiveSummary 제거(운영 KPI3 중복). 운영 KPI 보존 검증은
    //   (B) ES 컴포넌트축(파일 dormant 보존)에서 계속 GREEN.
    expect(PAGE).not.toMatch(/<ExecutiveSummarySection/);
  });
});
