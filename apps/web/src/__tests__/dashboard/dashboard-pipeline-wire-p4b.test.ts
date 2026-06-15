/**
 * §main-dashboard-redesign P4-B1 — Pipeline page 배선 sentinel
 *
 * 정본: docs/plans/PLAN_main-dashboard-redesign.md (P4-B 탑재)
 *
 * 검증:
 *   (A) Pipeline 배선 — summarySection(P3-B1 훅) 재사용(신규 fetch 0), 4상태 주입.
 *   (B) SmartReceivingStatusCard 대체 — import/usage 제거(dead import 0).
 *   (C) 비차단/무회귀 — 기존 stats useQuery + 로딩 게이트 + ExecutiveSummary 보존.
 *   (D) ActionInbox 미배선(P4-B2 대기).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const PAGE = readFileSync(join(REPO_ROOT, "src/app/dashboard/page.tsx"), "utf8");

// ── (A) Pipeline 배선 ───────────────────────────────────────────────────
describe("§main-dashboard-redesign P4-B1 (A) — Pipeline 배선", () => {
  it("Pipeline import + 렌더", () => {
    expect(PAGE).toMatch(/import \{ Pipeline \} from "@\/components\/dashboard\/pipeline"/);
    expect(PAGE).toMatch(/<Pipeline/);
  });
  it("summarySection(P3-B1 훅) 재사용 — state/data/retry 주입(신규 fetch 0)", () => {
    expect(PAGE).toMatch(/state=\{summarySection\.state\}/);
    expect(PAGE).toMatch(/summary=\{summarySection\.data\}/);
    expect(PAGE).toMatch(/onRetry=\{summarySection\.retry\}/);
    // summary 훅은 1개만(중복 fetch 0)
    expect((PAGE.match(/useDashboardSection<DashboardSummary>/g) || []).length).toBe(1);
  });
});

// ── (B) SmartReceivingStatusCard 대체 ───────────────────────────────────
describe("§main-dashboard-redesign P4-B1 (B) — SmartReceiving 대체(dead import 0)", () => {
  it("SmartReceivingStatusCard import/usage 제거", () => {
    expect(PAGE).not.toMatch(/SmartReceivingStatusCard/);
  });
});

// ── (C) 비차단 / 무회귀 ─────────────────────────────────────────────────
describe("§main-dashboard-redesign P4-B1 (C) — 비차단·무회귀", () => {
  it("기존 stats useQuery 보존", () => {
    expect(PAGE).toMatch(/queryKey:\s*\["dashboard-stats"\]/);
  });
  it("로딩 게이트(isStillLoading/loadTimedOut) 보존 — §11.199b 스카 보호", () => {
    expect(PAGE).toMatch(/isStillLoading/);
    expect(PAGE).toMatch(/loadTimedOut/);
  });
  it("ExecutiveSummarySection + GlobalEmpty(P3-B1) 보존", () => {
    expect(PAGE).toMatch(/<ExecutiveSummarySection/);
    expect(PAGE).toMatch(/<GlobalEmpty\s*\/>/);
  });
});

// ── (D) ActionInbox 미배선 ──────────────────────────────────────────────
describe("§main-dashboard-redesign P4-B1→shifan P1 (D) — ActionInbox 배선됨", () => {
  it("ActionInbox page 배선(§dashboard-shifan-adopt P1 — 시안 우선처리 인박스)", () => {
    expect(PAGE).toMatch(/action-inbox|ActionInbox/);
  });
});
