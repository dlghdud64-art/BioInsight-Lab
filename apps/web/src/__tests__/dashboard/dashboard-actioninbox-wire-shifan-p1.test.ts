/**
 * §dashboard-shifan-adopt P1 — ActionInbox 배선("오늘 처리해야 할 일") sentinel
 *
 * 정본: docs/plans/PLAN_dashboard-shifan-adopt.md (P1)
 *
 * 검증:
 *   (A) ActionInbox 배선 + dashboardPriorityActions→items 매핑(tone severityRank).
 *   (B) 레거시 "가장 먼저 처리" 우선순위 배너 제거(testid·flow-state·cluster 0).
 *   (C) awareness 보존 — dashboardPriorityActions 5 action 소스 잔존(공백 0).
 *   (D) 비차단/무회귀 — StatLine·Pipeline·GlobalEmpty·ES·stats 로딩게이트 보존.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const PAGE = readFileSync(join(REPO_ROOT, "src/app/dashboard/page.tsx"), "utf8");
const INBOX = readFileSync(join(REPO_ROOT, "src/components/dashboard/action-inbox.tsx"), "utf8");

// ── (A) ActionInbox 배선 + 매핑 ─────────────────────────────────────────
describe("§dashboard-shifan-adopt P1 (A) — ActionInbox 배선", () => {
  it("import + 렌더", () => {
    expect(PAGE).toMatch(/import \{ ActionInbox(?:,[^}]*)? \} from "@\/components\/dashboard\/action-inbox"/);
    expect(PAGE).toMatch(/<ActionInbox items=\{actionInboxItems\}/);
  });
  it("dashboardPriorityActions → ActionInboxItem 매핑(tone severityRank)", () => {
    expect(PAGE).toMatch(/actionInboxItems:\s*ActionInboxItem\[\]\s*=\s*dashboardPriorityActions\.map/);
    expect(PAGE).toMatch(/severityRank <= 2 \? "danger" : a\.severityRank <= 4 \? "warn" : "info"/);
  });
  it("ActionInbox 헤더 시안 정합 '오늘 처리해야 할 일'", () => {
    expect(INBOX).toMatch(/오늘 처리해야 할 일/);
  });
});

// ── (B) 레거시 배너 제거 ────────────────────────────────────────────────
describe("§dashboard-shifan-adopt P1 (B) — 레거시 우선순위 배너 제거", () => {
  it("배너 testid/cluster 0", () => {
    expect(PAGE).not.toMatch(/data-testid="dashboard-priority-banner"/);
    expect(PAGE).not.toMatch(/data-testid="dashboard-priority-primary-cta"/);
    expect(PAGE).not.toMatch(/primaryPriorityAction/);
    expect(PAGE).not.toMatch(/priorityStageBadges/);
  });
});

// ── (C) awareness 보존 ──────────────────────────────────────────────────
describe("§dashboard-shifan-adopt P1 (C) — awareness 보존(공백 0)", () => {
  it("dashboardPriorityActions 5 action 소스 잔존(만료/SLA/재고/입고/승인)", () => {
    expect(PAGE).toMatch(/dashboardPriorityActions/);
    expect(PAGE).toMatch(/입고 처리/);
    expect(PAGE).toMatch(/재고 부족/);
    expect(PAGE).toMatch(/승인 대기/);
    expect(PAGE).toMatch(/SLA 지연/);
    expect(PAGE).toMatch(/만료 폐기/);
  });
  it("ActionInbox dead button 0 — count>0 필터 보존", () => {
    expect(INBOX).toMatch(/filter\(\(it\)\s*=>\s*it\.count\s*>\s*0\)/);
  });
});

// ── (D) 비차단 / 무회귀 ─────────────────────────────────────────────────
describe("§dashboard-shifan-adopt P1 (D) — 무회귀", () => {
  it("StatLine·Pipeline·GlobalEmpty 보존 + ExecutiveSummary 제거(P3a 중복 흡수)", () => {
    expect(PAGE).toMatch(/<StatLine/);
    expect(PAGE).toMatch(/<Pipeline/);
    expect(PAGE).toMatch(/<GlobalEmpty\s*\/>/);
    // §dashboard-shifan-adopt P3a — 운영 KPI3 = ActionInbox/Pipeline/StatLine 중복 → 제거.
    expect(PAGE).not.toMatch(/<ExecutiveSummarySection/);
  });
  it("§11.199b stats useQuery + 로딩 게이트 보존", () => {
    expect(PAGE).toMatch(/queryKey:\s*\["dashboard-stats"\]/);
    expect(PAGE).toMatch(/isStillLoading/);
    expect(PAGE).toMatch(/loadTimedOut/);
  });
});
