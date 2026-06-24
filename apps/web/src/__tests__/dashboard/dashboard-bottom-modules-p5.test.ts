/**
 * §main-dashboard-redesign P5 — 하단 모듈(최근 알림 제거 + QuickActions/RecentActivity) sentinel
 *
 * 정본: docs/plans/PLAN_main-dashboard-redesign.md (P5 하단 모듈)
 *
 * 검증:
 *   (A) "최근 알림" 카드 제거(호영님 — 상단바 NotificationCenter 단일 진입, 중복 0).
 *   (B) awareness 무손실 — notifications 데이터는 "최근 운영 활동" 타임라인에서 계속 소비.
 *   (C) QuickActions(OperatorQuickActions) + RecentActivity(empty 정직) 보존.
 *   (D) 비차단/무회귀 — StatLine·Pipeline·GlobalEmpty·ExecutiveSummary·stats 게이트 보존.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const PAGE = readFileSync(join(REPO_ROOT, "src/app/dashboard/page.tsx"), "utf8");

// ── (A) 최근 알림 카드 제거 ─────────────────────────────────────────────
describe("§main-dashboard-redesign P5 (A) — 최근 알림 카드 제거", () => {
  it("'최근 알림' CardTitle 제거(상단바 NotificationCenter 중복 0)", () => {
    expect(PAGE).not.toMatch(/최근 알림<\/CardTitle>/);
  });
  it("최근 알림 notifications.map 렌더 블록 제거(/dashboard/notifications '모두 보기' 중복 카드 0)", () => {
    // 최근 운영 활동(timeline)은 notifications.slice 사용 — 카드형 notifications.map 만 제거.
    expect(PAGE).not.toMatch(/notifications\.map\(/);
  });
});

// ── (B) awareness 무손실 — RecentActivityCard 로 이전 (§dashboard-shifan-fidelity P-fid1) ──
describe("§main-dashboard-redesign P5→shifan P-fid1 (B) — 최근활동 awareness 이전", () => {
  it("최근활동 awareness 가 side-col <RecentActivityCard /> 로 이전(레거시 in-page notifications 타임라인 폐지)", () => {
    // §dashboard-shifan-fidelity P-fid1 — 레거시 3상태 패널/운영인텔 360행 폐지로 in-page
    //   notifications.slice 타임라인 + renderNotificationIcon 제거. 최근활동 awareness 는
    //   side-col 컴포넌트 <RecentActivityCard /> 가 자체 데이터로 흡수. 보호 의도(awareness 무손실) 보존.
    expect(PAGE).toMatch(/<RecentActivityCard\s*\/>/); // 흡수 surface present
    expect(PAGE).not.toMatch(/notifications\.(slice|filter)\(/); // 레거시 in-page 타임라인 absent
    expect(PAGE).not.toMatch(/renderNotificationIcon/); // 레거시 아이콘 헬퍼 absent
  });
});

// ── (C) QuickActions + RecentActivity 보존 ──────────────────────────────
describe("§main-dashboard-redesign P5 (C) — QuickActions/RecentActivity 보존", () => {
  it("OperatorQuickActions(운영 바로가기) page 렌더 제거 — §dashboard-home-redesign P1 (동선 Pipeline 흡수, 컴포넌트 파일 dormant 보존)", () => {
    // §dashboard-home-redesign P1 — 제거 설명 주석(// …, {/* … */})의 'OperatorQuickActions' 언급은 live 아님
    //   → 주석 제거 후 검사(보호 의도=실 import/렌더 부재 불변).
    const code = PAGE.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, "").replace(/\/\/[^\n]*/g, "");
    expect(code).not.toMatch(/OperatorQuickActions/);
  });
  it("RecentActivity(최근 처리 이력) + empty 정직 보존", () => {
    expect(PAGE).toMatch(/최근 처리 이력/);
    expect(PAGE).toMatch(/첫 업무가 완료되면 처리 이력/);
  });
});

// ── (D) 비차단 / 무회귀 ─────────────────────────────────────────────────
describe("§main-dashboard-redesign P5 (D) — 무회귀", () => {
  it("StatLine·Pipeline·GlobalEmpty 보존 + ExecutiveSummary 제거(P3a 중복 흡수)", () => {
    expect(PAGE).toMatch(/<StatLine/);
    expect(PAGE).toMatch(/<Pipeline/);
    expect(PAGE).toMatch(/<GlobalEmpty\s*\/>/);
    // §dashboard-shifan-adopt P3a — ExecutiveSummary 운영 KPI3 제거(중복).
    expect(PAGE).not.toMatch(/<ExecutiveSummarySection/);
  });
  it("stats useQuery + 로딩 게이트 보존(§11.199b)", () => {
    expect(PAGE).toMatch(/queryKey:\s*\["dashboard-stats"\]/);
    expect(PAGE).toMatch(/isStillLoading/);
  });
});
