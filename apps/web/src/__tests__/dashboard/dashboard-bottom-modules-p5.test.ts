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

// ── (B) awareness 무손실 — notifications 계속 소비 ──────────────────────
describe("§main-dashboard-redesign P5 (B) — notifications awareness 보존", () => {
  it("'최근 운영 활동' 타임라인이 notifications 계속 소비(데이터 retire 아님)", () => {
    expect(PAGE).toMatch(/최근 운영 활동/);
    expect(PAGE).toMatch(/notifications\.(slice|filter)\(/);
    expect(PAGE).toMatch(/renderNotificationIcon\(/);
  });
});

// ── (C) QuickActions + RecentActivity 보존 ──────────────────────────────
describe("§main-dashboard-redesign P5 (C) — QuickActions/RecentActivity 보존", () => {
  it("OperatorQuickActions(운영 바로가기) 보존", () => {
    expect(PAGE).toMatch(/OperatorQuickActions/);
  });
  it("RecentActivity(최근 처리 이력) + empty 정직 보존", () => {
    expect(PAGE).toMatch(/최근 처리 이력/);
    expect(PAGE).toMatch(/첫 업무가 완료되면 처리 이력/);
  });
});

// ── (D) 비차단 / 무회귀 ─────────────────────────────────────────────────
describe("§main-dashboard-redesign P5 (D) — 무회귀", () => {
  it("StatLine·Pipeline·GlobalEmpty·ExecutiveSummary 보존", () => {
    expect(PAGE).toMatch(/<StatLine/);
    expect(PAGE).toMatch(/<Pipeline/);
    expect(PAGE).toMatch(/<GlobalEmpty\s*\/>/);
    expect(PAGE).toMatch(/<ExecutiveSummarySection/);
  });
  it("stats useQuery + 로딩 게이트 보존(§11.199b)", () => {
    expect(PAGE).toMatch(/queryKey:\s*\["dashboard-stats"\]/);
    expect(PAGE).toMatch(/isStillLoading/);
  });
});
