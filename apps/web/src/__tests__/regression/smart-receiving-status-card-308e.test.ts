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

describe("dashboard priority banner wiring", () => {
  it("adds one primary dashboard CTA and two secondary operational CTAs", () => {
    const src = read(PAGE_PATH);

    expect(src).toMatch(/data-testid="dashboard-priority-banner"/);
    expect(src).toMatch(/data-testid="dashboard-priority-primary-cta"/);
    expect(src).toMatch(/dashboard-priority-secondary-\$\{action\.id\}/);
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
