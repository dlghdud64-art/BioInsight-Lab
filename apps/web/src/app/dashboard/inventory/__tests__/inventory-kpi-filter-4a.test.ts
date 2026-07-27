import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * §inventory-delta-label-kpi Phase 4 (핸드오프 §3) — 헤더 KPI 카드 클릭 배선.
 *   카운트 카드 클릭=필터 토글(재클릭 해제)·선택 시 파란 보더+필터 중 ✕·0건 비클릭 ·
 *   격리 Lot 카드 제거(범위 제외) · 배너 조치 2건+ 복합만(단건=KPI 역할, 중복 신호 금지).
 */

const REPO_ROOT = join(__dirname, "..", "..", "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}
const CONTENT = "src/app/dashboard/inventory/inventory-content.tsx";

describe("§inventory-delta-label-kpi P4 — 격리 Lot 카드 제거", () => {
  it("격리 KPI 카드·source 제거(3-col 그리드)", () => {
    const src = read(CONTENT);
    expect(src).not.toMatch(/data-testid="dashboard-inventory-header-kpi-quarantine-lot"/);
    expect(src).not.toMatch(/const headerKpiQuarantineLot/);
    expect(src).toMatch(/grid grid-cols-3 gap-2/);
  });
});

describe("§inventory-delta-label-kpi P4 — KPI 클릭 필터 토글 + active", () => {
  it("만료 임박 클릭 = expiring 토글(재클릭 해제)·0건 disabled", () => {
    const src = read(CONTENT);
    expect(src).toMatch(/onClick=\{\(\) => setStatusFilter\(\(prev\) => \(prev === "expiring" \? "all" : "expiring"\)\)\}/);
    expect(src).toMatch(/data-testid="dashboard-inventory-header-kpi-expiring-soon"[\s\S]{0,200}disabled=\{headerKpiExpiringSoon === 0\}/);
  });

  it("안전재고 미달 클릭 = low 토글(재클릭 해제)·0건 disabled", () => {
    const src = read(CONTENT);
    expect(src).toMatch(/onClick=\{\(\) => setStatusFilter\(\(prev\) => \(prev === "low" \? "all" : "low"\)\)\}/);
    expect(src).toMatch(/data-testid="dashboard-inventory-header-kpi-low-stock"[\s\S]{0,200}disabled=\{headerKpiLowStock === 0\}/);
  });

  it("선택 시 파란 보더 + 필터 중 ✕ + aria-pressed", () => {
    const src = read(CONTENT);
    expect(src).toMatch(/statusFilter === "expiring"\s*\n?\s*\? "border-blue-400 bg-blue-50\/50 ring-1 ring-blue-200"/);
    expect(src).toMatch(/statusFilter === "low"\s*\n?\s*\? "border-blue-400 bg-blue-50\/50 ring-1 ring-blue-200"/);
    expect(src).toMatch(/필터 중 ✕/);
    expect(src).toMatch(/aria-pressed=\{statusFilter === "expiring"\}/);
    expect(src).toMatch(/aria-pressed=\{statusFilter === "low"\}/);
  });
});

describe("§inventory-delta-label-kpi P4 — 배너 2건+ 복합만(중복 신호 금지)", () => {
  it("운영 배너는 조치 합산 ≥2 일 때만(단건=KPI 카드)", () => {
    const src = read(CONTENT);
    expect(src).toMatch(/\(lotIssueDisposalReviewCount \+ lotIssueApprovalPendingCount \+ lotIssueExecutableCount\) >= 2 &&/);
    // 구 조건(>0 = 단건도 노출) 제거.
    expect(src).not.toMatch(/lotIssueExecutableCount\) > 0 && \(\s*\n\s*<button\s*\n\s*type="button"\s*\n\s*data-testid="dashboard-inventory-header-action-banner"/);
  });
});
