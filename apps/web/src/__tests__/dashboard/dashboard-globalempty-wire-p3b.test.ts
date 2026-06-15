/**
 * §main-dashboard-redesign P3-B1 — GlobalEmpty page 배선 sentinel
 *
 * 정본: docs/plans/PLAN_main-dashboard-redesign.md (P3-B 탑재)
 *
 * 검증:
 *   (A) summary 단일 진실 훅(useDashboardSection) 배선 — /api/dashboard/summary, allEmpty.
 *   (B) GlobalEmpty 렌더 게이트 — state==='empty' + OnboardingHero 미표시(상호배타, 중복 0).
 *   (C) 비차단/무회귀 — 기존 stats useQuery + 로딩 게이트 + ExecutiveSummary 보존.
 *   (D) StatLine 미배선(P3-B2 대기 — KPI 교체는 P4 ActionInbox 후).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const PAGE = readFileSync(join(REPO_ROOT, "src/app/dashboard/page.tsx"), "utf8");

// ── (A) summary 훅 배선 ─────────────────────────────────────────────────
describe("§main-dashboard-redesign P3-B1 (A) — summary 단일 진실 훅 배선", () => {
  it("useDashboardSection import + 호출(/api/dashboard/summary)", () => {
    expect(PAGE).toMatch(/import \{ useDashboardSection \}/);
    expect(PAGE).toMatch(/useDashboardSection<DashboardSummary>\(/);
    expect(PAGE).toMatch(/url:\s*"\/api\/dashboard\/summary"/);
  });
  it("isEmpty = derived.allEmpty (canonical 빈 신호)", () => {
    expect(PAGE).toMatch(/isEmpty:\s*\(s\)\s*=>\s*s\.derived\.allEmpty/);
  });
  it("capMs override 없음(기본 10s, §11.375 정합)", () => {
    expect(PAGE).not.toMatch(/capMs:\s*\d/);
  });
});

// ── (B) GlobalEmpty 렌더 게이트(상호배타) ───────────────────────────────
describe("§main-dashboard-redesign P3-B1 (B) — GlobalEmpty 게이트", () => {
  it("state==='empty' + OnboardingHero 미표시 시에만(중복 0)", () => {
    expect(PAGE).toMatch(/summarySection\.state === "empty"/);
    expect(PAGE).toMatch(/onboardingDismissed \|\| !isOnboardingMode/);
    expect(PAGE).toMatch(/<GlobalEmpty\s*\/>/);
  });
});

// ── (C) 비차단 / 무회귀 ─────────────────────────────────────────────────
describe("§main-dashboard-redesign P3-B1 (C) — 비차단·무회귀", () => {
  it("기존 stats useQuery 보존(dashboard-stats)", () => {
    expect(PAGE).toMatch(/queryKey:\s*\["dashboard-stats"\]/);
  });
  it("기존 로딩 게이트(isStillLoading) 보존 — §11.199b/§11.375 스카 보호", () => {
    expect(PAGE).toMatch(/isStillLoading/);
    expect(PAGE).toMatch(/loadTimedOut/);
  });
  it("ExecutiveSummarySection 보존(KPI 교체는 P3-B2)", () => {
    expect(PAGE).toMatch(/<ExecutiveSummarySection/);
  });
});

// ── (D) StatLine 미배선 ─────────────────────────────────────────────────
describe("§main-dashboard-redesign P3-B1 (D) — StatLine 미배선(P3-B2 대기)", () => {
  it("StatLine 아직 page 미배선", () => {
    expect(PAGE).not.toMatch(/stat-line|StatLine/);
  });
});
