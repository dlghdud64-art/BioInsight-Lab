/**
 * §main-dashboard-redesign P6 — 종합 capstone(반응형·접근성·가드 불변식 lock)
 *
 * 정본: docs/plans/PLAN_main-dashboard-redesign.md (P6)
 *
 * 트랙 전체 불변식을 한 곳에 고정(향후 회귀 차단):
 *   (A) 반응형 — StatLine/Pipeline 그리드 브레이크포인트, 터치 ≥44px.
 *   (B) 접근성 — 로딩 aria-busy, break-keep(한국어 줄바꿈), CTA 키보드 접근(a/button).
 *   (C) 가드①②③ 최종 — 빈 데이터 차트 0·가짜 분포 0·Pipeline 전이 로컬재정의 0.
 *   (D) capMs 10s(무한 스켈레톤 0) + summary 단일 진실 훅 page 단일.
 *   (E) page 통합 — 8모듈 중 7(StatLine·Pipeline·GlobalEmpty + 운영 KPI·QuickActions·
 *       RecentActivity) 배선 + §11.199b 로딩 게이트 보존 + 최근알림 제거.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const ROOT = join(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const STAT = read("src/components/dashboard/stat-line.tsx");
const PIPE = read("src/components/dashboard/pipeline.tsx");
const EMPTY = read("src/components/dashboard/global-empty.tsx");
const PURE = read("src/lib/dashboard/section-state.ts");
const PAGE = read("src/app/dashboard/page.tsx");
const NEW_MODULES = [STAT, PIPE, EMPTY];

// ── (A) 반응형 + 터치 ───────────────────────────────────────────────────
describe("§main-dashboard-redesign P6 (A) — 반응형·터치", () => {
  it("StatLine grid-cols-3(3 KPI 한 줄)", () => {
    expect(STAT).toMatch(/grid-cols-3/);
  });
  it("Pipeline 반응형 grid-cols-2 → md:grid-cols-4", () => {
    expect(PIPE).toMatch(/grid-cols-2/);
    expect(PIPE).toMatch(/md:grid-cols-4/);
  });
  it("터치 영역 ≥44px (StatLine·Pipeline·GlobalEmpty)", () => {
    for (const m of NEW_MODULES) expect(m).toMatch(/min-h-\[44px\]/);
  });
});

// ── (B) 접근성 ──────────────────────────────────────────────────────────
describe("§main-dashboard-redesign P6 (B) — 접근성", () => {
  it("로딩 상태 aria-busy (StatLine·Pipeline)", () => {
    expect(STAT).toMatch(/aria-busy/);
    expect(PIPE).toMatch(/aria-busy/);
  });
  it("한국어 줄바꿈 break-keep", () => {
    for (const m of NEW_MODULES) expect(m).toMatch(/break-keep/);
  });
});

// ── (C) 가드 ①②③ 최종 ─────────────────────────────────────────────────
describe("§main-dashboard-redesign P6 (C) — 가드①②③ 최종 lock", () => {
  it("가드② 가짜 차트/분포 0 — 신규 모듈에 MOCKUP/recharts/AreaChart/예시 데이터 부재", () => {
    for (const m of NEW_MODULES) {
      expect(m).not.toMatch(/MOCKUP|mockup/);
      expect(m).not.toMatch(/recharts|AreaChart/);
      expect(m).not.toMatch(/예시 데이터/);
    }
  });
  it("가드③ Pipeline 전이 로컬재정의 0(state-machine canonical)", () => {
    expect(PIPE).not.toMatch(/ALLOWED_\w+_TRANSITIONS\s*[:=]/);
    expect(PIPE).toMatch(/state-machine/);
  });
});

// ── (D) capMs 10s + summary 단일 진실 ───────────────────────────────────
describe("§main-dashboard-redesign P6 (D) — capMs·단일 진실", () => {
  it("capMs 10s(무한 스켈레톤 0, §11.375 정합)", () => {
    expect(PURE).toMatch(/CAPMS_DEFAULT = 10000/);
  });
  it("summary 단일 진실 훅 page 단일(중복 fetch 0)", () => {
    expect((PAGE.match(/useDashboardSection<DashboardSummary>/g) || []).length).toBe(1);
  });
});

// ── (E) page 통합 ───────────────────────────────────────────────────────
describe("§main-dashboard-redesign P6 (E) — 8모듈 통합·무회귀", () => {
  it("상단 GlobalEmpty/StatLine + 중단 Pipeline 배선 + ExecutiveSummary 제거(P3a)", () => {
    expect(PAGE).toMatch(/<GlobalEmpty\s*\/>/);
    expect(PAGE).toMatch(/<StatLine/);
    expect(PAGE).toMatch(/<Pipeline/);
    // §dashboard-shifan-adopt P3a — 운영 KPI3=ActionInbox/Pipeline/StatLine 중복 → 제거.
    expect(PAGE).not.toMatch(/<ExecutiveSummarySection/);
  });
  it("§11.199b 로딩 게이트 보존 + 최근알림 카드 제거", () => {
    expect(PAGE).toMatch(/isStillLoading/);
    expect(PAGE).toMatch(/loadTimedOut/);
    expect(PAGE).not.toMatch(/최근 알림<\/CardTitle>/);
  });
});
