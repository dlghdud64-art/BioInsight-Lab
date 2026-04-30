/**
 * §11.162 #dashboard-orders-inbound-rewire
 *
 * Source-level regression guard — `/dashboard/orders` redirect-only legacy page
 * 의 inbound caller 를 canonical destination 으로 rewire 검증.
 *
 * Caller intent 매핑 (Phase 0 audit 결과):
 *   - ORDER entity (Prisma Order model) → `/dashboard/purchase-orders` (canonical PO list)
 *   - 발주 전환 큐 navigation → `/dashboard/purchases?view=conversion-ready`
 *   - example/regex match → 변경 0 (legacy URL pattern 보존)
 *
 * deferred 까지 갔던 §11.160 cleanup 의 마지막 회수.
 */

import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const APPS_WEB = resolve(__dirname, "../../..");
const REPO_ROOT = resolve(APPS_WEB, "../..");

function gitTrackedFiles(pattern: string): string[] {
  try {
    const out = execSync(`git ls-tree -r --name-only HEAD -- "${pattern}"`, {
      cwd: REPO_ROOT,
      encoding: "utf8",
    });
    return out.split("\n").map((l) => l.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

const REWIRED_FILES: { path: string; label: string }[] = [
  { path: "src/app/dashboard/budget/[id]/page.tsx",                              label: "budget detail 발주 보기 Link" },
  { path: "src/app/dashboard/page.tsx",                                          label: "dashboard 발주 전환 recommendedAction" },
  { path: "src/components/dashboard/action-ledger.tsx",                          label: "Fast-Track navigation" },
  { path: "src/components/dashboard/ai-action-inbox.tsx",                        label: "AI action approve href" },
  { path: "src/components/dashboard/console/queue-detail-panel.tsx",             label: "ORDER pathMap" },
  { path: "src/components/dashboard/work-queue-console.tsx",                     label: "ORDER pathMap" },
  { path: "src/components/dashboard/overlay/workbench-progress-overlay.tsx",     label: "workbenchHref fallback" },
];

describe("§11.162 dashboard/orders inbound rewire", () => {
  it("ORDER entity 매핑 caller 가 /dashboard/purchase-orders 사용", () => {
    // queue-detail-panel + work-queue-console 의 ORDER pathMap 검증
    const queueDetailSrc = readFileSync(
      resolve(APPS_WEB, "src/components/dashboard/console/queue-detail-panel.tsx"),
      "utf8",
    );
    expect(queueDetailSrc).toMatch(/ORDER:\s*["']\/dashboard\/purchase-orders["']/);
    const consoleSrc = readFileSync(
      resolve(APPS_WEB, "src/components/dashboard/work-queue-console.tsx"),
      "utf8",
    );
    expect(consoleSrc).toMatch(/ORDER:\s*["']\/dashboard\/purchase-orders["']/);
  });

  it("발주 전환 recommendedAction 이 /dashboard/purchases?view=conversion-ready 로 직접 navigate", () => {
    const dashboardSrc = readFileSync(
      resolve(APPS_WEB, "src/app/dashboard/page.tsx"),
      "utf8",
    );
    expect(dashboardSrc).toMatch(/\/dashboard\/purchases\?view=conversion-ready/);
    // 발주 전환 recommendedAction 의 href 가 더 이상 /dashboard/orders 가 아님
    expect(dashboardSrc).not.toMatch(/r-po-conversion[\s\S]{0,200}href:\s*["']\/dashboard\/orders["']/);
  });

  it("AI action approveHref + ledger Fast-Track + budget 발주 보기 가 /dashboard/purchase-orders 사용", () => {
    const aiInboxSrc = readFileSync(
      resolve(APPS_WEB, "src/components/dashboard/ai-action-inbox.tsx"),
      "utf8",
    );
    expect(aiInboxSrc).not.toMatch(/approveHref:\s*["']\/dashboard\/orders["']/);
    expect(aiInboxSrc).toMatch(/\/dashboard\/purchase-orders/);

    const ledgerSrc = readFileSync(
      resolve(APPS_WEB, "src/components/dashboard/action-ledger.tsx"),
      "utf8",
    );
    expect(ledgerSrc).not.toMatch(/href:\s*`?\/dashboard\/orders`?/);
    expect(ledgerSrc).toMatch(/\/dashboard\/purchase-orders/);

    const budgetSrc = readFileSync(
      resolve(APPS_WEB, "src/app/dashboard/budget/[id]/page.tsx"),
      "utf8",
    );
    expect(budgetSrc).not.toMatch(/href="\/dashboard\/orders"/);
    expect(budgetSrc).toMatch(/\/dashboard\/purchase-orders/);
  });

  it("workbench-progress-overlay fallback 이 /dashboard/purchase-orders 사용", () => {
    const overlaySrc = readFileSync(
      resolve(APPS_WEB, "src/components/dashboard/overlay/workbench-progress-overlay.tsx"),
      "utf8",
    );
    // workbenchHref fallback 이 변경됨
    expect(overlaySrc).toMatch(/workbenchHref\s*=\s*overlayRoutePath\s*\?\?\s*["']\/dashboard\/purchase-orders["']/);
  });

  it("dashboard/orders/page.tsx redirect-only legacy git tree 에서 제거", () => {
    // git ls-tree path 인자는 prefix match — 폴더명 그대로 사용
    const tracked = gitTrackedFiles("apps/web/src/app/dashboard/orders");
    expect(tracked).toEqual([]);
  });

  it("회귀 0: /dashboard/purchase-orders 페이지 보존 (PO landing canonical)", () => {
    const tracked = gitTrackedFiles("apps/web/src/app/dashboard/purchase-orders/page.tsx");
    expect(tracked).toContain("apps/web/src/app/dashboard/purchase-orders/page.tsx");
  });
});
