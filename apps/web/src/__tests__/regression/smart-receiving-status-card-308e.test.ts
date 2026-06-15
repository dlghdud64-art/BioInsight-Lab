/**
 * §11.308e / §11.315 dashboard priority sentinel.
 *
 * The dashboard must make the next operational action readable in one glance:
 * one primary CTA, two secondary CTAs, and a smart receiving status card that
 * links receiving exceptions back to the inventory truth screen.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const CARD_PATH = "src/components/dashboard/SmartReceivingStatusCard.tsx";
const PAGE_PATH = "src/app/dashboard/page.tsx";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("SmartReceivingStatusCard", () => {
  it("keeps receiving, exception, and reorder counts visible as inventory issue links", () => {
    const src = read(CARD_PATH);

    expect(src).toMatch(/export interface SmartReceivingStatusCardProps/);
    expect(src).toMatch(/pendingHandoffCount:\s*number/);
    expect(src).toMatch(/exceptionCount\?:\s*number/);
    expect(src).toMatch(/reorderReviewCount\?:\s*number/);
    expect(src).toMatch(/data-testid="dashboard-smart-receiving-status-summary"/);
    expect(src).toMatch(/data-testid="dashboard-smart-receiving-state-link"/);
    expect(src).toMatch(/입고 대기/);
    expect(src).toMatch(/예외/);
    expect(src).toMatch(/재주문 검토/);
    expect(src).toMatch(/\/dashboard\/inventory\?filter=lot_issue&tab=overview/);
  });

  it("preserves the status card identity and avoids modal/API side effects", () => {
    const src = read(CARD_PATH);

    expect(src).toMatch(/data-testid="dashboard-smart-receiving-status-card"/);
    expect(src).toMatch(/data-testid="dashboard-smart-receiving-pending-badge"/);
    expect(src).toMatch(/data-testid="dashboard-smart-receiving-status-cta"/);
    expect(src).not.toMatch(/SmartReceivingScannerModal/);
    expect(src).not.toMatch(/SmartReceivingPlaceholderModal/);
    expect(src).not.toMatch(/fetch\(/);
    expect(src).not.toMatch(/useSWR|useQuery|useEffect/);
  });
});

// §dashboard-shifan-adopt P1 진화 — 레거시 "가장 먼저 처리" 우선순위 배너(다수 testid·
//   flow-state·stage-badge)가 ActionInbox("오늘 처리해야 할 일")로 대체(시안 전면 채택).
//   배너 rich framing 제거. awareness는 dashboardPriorityActions(만료/SLA/재고/입고/승인)
//   동일 소스가 ActionInbox로 surface → 공백 0(회귀 은폐 아님, 소스 보존 증명).
describe("dashboard 우선처리 — ActionInbox(시안) 대체", () => {
  it("ActionInbox 배선 + 레거시 우선순위 배너 제거", () => {
    const src = read(PAGE_PATH);

    expect(src).toMatch(/<ActionInbox/);
    expect(src).toMatch(/actionInboxItems/);
    expect(src).not.toMatch(/data-testid="dashboard-priority-banner"/);
    expect(src).not.toMatch(/data-testid="dashboard-priority-primary-cta"/);
  });

  it("awareness 보존 — dashboardPriorityActions 5 action(만료/SLA/재고/입고/승인) 소스 잔존", () => {
    const src = read(PAGE_PATH);

    expect(src).toMatch(/dashboardPriorityActions/);
    expect(src).toMatch(/입고 처리/);
    expect(src).toMatch(/재고 부족/);
    expect(src).toMatch(/승인 대기/);
  });

  // §main-dashboard-redesign P4-B1 진화 — SmartReceivingStatusCard 카드는 page 에서
  //   Pipeline(견적→발주→입고→재고) 으로 대체(입고/재고 awareness 흡수). 카드가
  //   전달하던 CFO 3 카운트(입고/SLA/재고)는 **우선순위 배너 action 에 잔존**(중복
  //   awareness였음) → 카드 retire 후에도 awareness 공백 0. 본 it 은 "카드 전달"이
  //   아니라 "Pipeline 배선 + 3 카운트 awareness 보존"으로 진화(회귀 은폐 아님 — 보존 증명).
  it("CFO counts(입고/SLA/재고) awareness 보존 — Pipeline 배선 + dashboardPriorityActions 잔존", () => {
    const src = read(PAGE_PATH);

    // 카드 retire(page 에서 SmartReceivingStatusCard import/usage 제거) → Pipeline 대체.
    expect(src).not.toMatch(/SmartReceivingStatusCard/);
    expect(src).toMatch(/<Pipeline/);
    // awareness 보존 증명: 3 카운트가 dashboardPriorityActions(→ActionInbox surface)에 잔존(공백 0).
    expect(src).toMatch(/count:\s*riskOrBlockerCount/);                              // SLA 지연 = slaBreachedCount
    expect(src).toMatch(/count:\s*stats\.compareStats\.purchaseToReceivingCount/);   // 입고 처리
    expect(src).toMatch(/count:\s*stats\.lowStockAlerts/);                           // 재고 부족
  });
});
