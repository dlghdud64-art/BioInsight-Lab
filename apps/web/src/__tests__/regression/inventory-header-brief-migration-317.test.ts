/**
 * §11.317 #inventory-header-brief-migration — Regression sentinel
 *
 * 호영님 P1 (구 §11.313, 번호 충돌로 §11.317 매핑, 2026-05-29):
 *   재고 관리 메인 헤더가 폐기/처분 메타로 과적재 → 운영 브리핑(stock_risk
 *   카테고리)으로 이관 + 헤더 simplification (4 KPI + 1줄 배너).
 *
 *   spec §11.313 의 5 phase 계획:
 *   - Phase 2: 헤더 폐기 strip 제거 + KPI 4 + 배너
 *   - Phase 3: 운영 브리핑 stock_risk 카드 강화 (5 카드)
 *   - Phase 4: banner onClick → openBrief({ category: "stock_risk" }) wiring
 *   - Phase 5: 모바일 patterns + 회귀 통합
 *
 *   본 sentinel = Phase 1 RED — 새 구조 단언, 현재 source 와 충돌하여 진짜 fail.
 *   Phase 2~5 작업으로 GREEN 전환.
 *
 * canonical truth 보존 (회귀 가드):
 *   - lotIssue* count 변수 (line 1040-1045) 보존 (source 동일, projection 만 이동)
 *   - 폐기 검토 탭 자체 보존 (작업 surface, 운영 브리핑은 알림 view)
 *   - popup-context API 확장 (selectedCategory) 정합
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

const INVENTORY_CONTENT = "src/app/dashboard/inventory/inventory-content.tsx";
const POPUP = "src/components/operational-brief/popup.tsx";
const POPUP_CONTEXT = "src/components/operational-brief/popup-context.tsx";

describe("§11.317 — 재고 헤더: 폐기 strip 제거 + KPI 4 + 1줄 배너", () => {
  it("폐기 strip 컨테이너 testid (lot-issue-priority-strip) 제거", () => {
    const src = read(INVENTORY_CONTENT);
    expect(src).not.toMatch(/data-testid="labaxis-inventory-lot-issue-priority-strip"/);
  });

  it("폐기 chip testid 제거 (disposal-review/approval-waiting/executable/handoff/queue/action-stack)", () => {
    const src = read(INVENTORY_CONTENT);
    expect(src).not.toMatch(/labaxis-inventory-disposal-review-state/);
    expect(src).not.toMatch(/labaxis-inventory-approval-waiting-state/);
    expect(src).not.toMatch(/labaxis-inventory-executable-state/);
    expect(src).not.toMatch(/labaxis-inventory-lot-issue-handoff-strip/);
    expect(src).not.toMatch(/labaxis-inventory-lot-issue-queue-strip/);
    expect(src).not.toMatch(/labaxis-inventory-lot-issue-action-stack/);
    expect(src).not.toMatch(/labaxis-inventory-lot-issue-visible-audit-summary/);
  });

  it("재고 본 목적 KPI 4개 (전체 품목/안전재고 미달/만료 임박/격리 Lot)", () => {
    const src = read(INVENTORY_CONTENT);
    expect(src).toMatch(/data-testid="dashboard-inventory-header-kpi-total-items"/);
    expect(src).toMatch(/data-testid="dashboard-inventory-header-kpi-low-stock"/);
    expect(src).toMatch(/data-testid="dashboard-inventory-header-kpi-expiring-soon"/);
    expect(src).toMatch(/data-testid="dashboard-inventory-header-kpi-quarantine-lot"/);
  });

  it("1줄 배너: 운영 조치 N건 + 운영 브리핑 열기 (real wiring, dead button 0)", () => {
    const src = read(INVENTORY_CONTENT);
    expect(src).toMatch(/data-testid="dashboard-inventory-header-action-banner"/);
    expect(src).toMatch(/운영 조치/);
    expect(src).toMatch(/운영 브리핑 열기/);
    // 운영 조치 0건 시 배너 hide (조건부 렌더)
    expect(src).toMatch(/data-testid="dashboard-inventory-header-action-banner-open-brief"/);
  });

  it("canonical truth 보존 — lotIssue* count 변수 유지 (mutation 0)", () => {
    const src = read(INVENTORY_CONTENT);
    // Phase 2 후에도 변수는 보존 (운영 브리핑 카드 source 로 forward)
    expect(src).toMatch(/const lotIssueDisposalReviewCount =/);
    expect(src).toMatch(/const lotIssueApprovalPendingCount =/);
    expect(src).toMatch(/const lotIssueExecutableCount =/);
    expect(src).toMatch(/const lotIssueHoldCount =/);
    expect(src).toMatch(/const lotIssueImmediateCount =/);
  });

  it("폐기 검토 탭 라벨 자체 보존 (작업 surface, 운영 브리핑과 별개)", () => {
    const src = read(INVENTORY_CONTENT);
    expect(src).toMatch(/label:\s*showLotIssueDecisionStrip\s*\?\s*"폐기 검토"\s*:\s*"운영 현황"/);
  });
});

describe("§11.317 — 운영 브리핑 stock_risk 카드 강화 (5 카드)", () => {
  it("폐기 처분 / 만료 Lot / 폐기 영향 분석 / 처리 우선순위 / Lot 점검 5 카드 노출", () => {
    const src = read(POPUP);
    expect(src).toMatch(/data-testid="operational-brief-stock-risk-disposal-card"/);
    expect(src).toMatch(/data-testid="operational-brief-stock-risk-expired-lot-card"/);
    expect(src).toMatch(/data-testid="operational-brief-stock-risk-disposal-impact-card"/);
    expect(src).toMatch(/data-testid="operational-brief-stock-risk-priority-card"/);
    expect(src).toMatch(/data-testid="operational-brief-stock-risk-lot-check-card"/);
  });

  it("각 카드 액션 = 폐기 검토 탭 deep link (dead button 0, real route)", () => {
    const src = read(POPUP);
    // 308e SmartReceivingStatusCard 와 동일 deep link
    expect(src).toMatch(/\/dashboard\/inventory\?filter=lot_issue&tab=overview/);
  });
});

describe("§11.317 — popup-context selectedCategory API 확장 + open({ category })", () => {
  it("OperationalBriefPopupContextValue 에 selectedCategory + setSelectedCategory 노출", () => {
    const src = read(POPUP_CONTEXT);
    expect(src).toMatch(/selectedCategory:\s*[A-Za-z|"' ?\\|null]+/);
    expect(src).toMatch(/setSelectedCategory:/);
  });

  it("open({ category }) 옵션 시그니처 확장", () => {
    const src = read(POPUP_CONTEXT);
    expect(src).toMatch(/open:\s*\(opts\??:\s*\{[\s\S]{0,80}category\?:/);
  });

  it("noop fallback 도 selectedCategory + setSelectedCategory 포함", () => {
    const src = read(POPUP_CONTEXT);
    expect(src).toMatch(/NOOP_VALUE[\s\S]{0,400}selectedCategory:/);
    expect(src).toMatch(/NOOP_VALUE[\s\S]{0,400}setSelectedCategory:/);
  });
});
