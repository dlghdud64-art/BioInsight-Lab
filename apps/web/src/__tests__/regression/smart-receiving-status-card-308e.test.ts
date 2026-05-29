/**
 * §11.308e / §11.315 dashboard priority sentinel.
 *
 * The dashboard must make the next operational action readable in one glance:
 * one primary CTA, a separated secondary rail, and a smart receiving status card that
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

describe("dashboard priority banner wiring", () => {
  it("keeps one first-click CTA at the top with state boundaries", () => {
    const src = read(PAGE_PATH);

    expect(src).toMatch(/data-testid="dashboard-priority-banner"/);
    expect(src).toMatch(/data-testid="dashboard-priority-primary-cta"/);
    expect(src.match(/data-testid="dashboard-priority-primary-cta"/g)).toHaveLength(1);
    expect(src).toMatch(/data-testid="dashboard-priority-first-badge"/);
    expect(src).toMatch(/data-testid="dashboard-priority-approval-badge"/);
    expect(src).toMatch(/data-testid="dashboard-priority-urgent-count"/);
    expect(src).toMatch(/data-testid="dashboard-priority-owner"/);
    expect(src).toMatch(/data-testid="dashboard-priority-route"/);
    expect(src).toMatch(/data-testid="dashboard-priority-inactive-reason"/);
    expect(src).toMatch(/data-testid="dashboard-priority-flow-state"/);
    expect(src).toMatch(/data-testid="dashboard-priority-stage-badges"/);
    expect(src).toMatch(/data-testid="dashboard-priority-secondary-rail"/);
    expect(src).toMatch(/dashboard-priority-secondary-state-\$\{action\.id\}/);
    expect(src).not.toMatch(/dashboard-priority-secondary-\$\{action\.id\}/);
    expect(src).toMatch(/가장 먼저 처리/);
    expect(src).toMatch(/긴급 \{urgentPriorityCount\}건 · 다음 작업 1개/);
    expect(src).toMatch(/담당: 운영/);
    expect(src).toMatch(/첫 클릭: \{primaryPriorityAction\.label\}/);
    expect(src).toMatch(/검색", "비교", "요청", "승인", "PO", "입고", "재고", "재주문"/);
    expect(src).toMatch(/보조열/);
    expect(src).toMatch(/비활성 사유/);
    expect(src).toMatch(/현재 단계/);
    expect(src).toMatch(/다음 단계/);
    expect(src).toMatch(/승인 필요/);
    expect(src).toMatch(/실행/);
    expect(src).toMatch(/검토/);
    expect(src).toMatch(/보류/);
    expect(src).toMatch(/입고 처리/);
    expect(src).toMatch(/재고 부족/);
    expect(src).toMatch(/승인 대기/);
  });

  it("passes CFO counts into SmartReceivingStatusCard from dashboard truth", () => {
    const src = read(PAGE_PATH);

    expect(src).toMatch(/import \{ SmartReceivingStatusCard \} from "@\/components\/dashboard\/SmartReceivingStatusCard"/);
    expect(src).toMatch(/pendingHandoffCount=\{stats\.compareStats\.purchaseToReceivingCount\}/);
    expect(src).toMatch(/exceptionCount=\{stats\.compareStats\.slaBreachedCount\}/);
    expect(src).toMatch(/reorderReviewCount=\{stats\.lowStockAlerts\}/);
  });
});
