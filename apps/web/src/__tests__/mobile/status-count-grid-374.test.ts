/**
 * §11.374 #mobile-surface-unify — 상태요약 단일 컴포넌트(StatusCountGrid) +
 * 견적 모바일 바 2x2 채택 sentinel (P1 계약 / P2 견적 적용).
 *
 * readFileSync + regex (CLAUDE.md sentinel 패턴).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const grid = readFileSync(
  resolve(__dirname, "../../components/layout/status-count-grid.tsx"),
  "utf8",
);
const quotes = readFileSync(
  resolve(__dirname, "../../app/dashboard/quotes/page.tsx"),
  "utf8",
);
// P3 확장 surface — 구매/재고/대시보드 rollout + AppPageHeader 4탭
const purchaseOrders = readFileSync(
  resolve(__dirname, "../../app/dashboard/purchase-orders/page.tsx"),
  "utf8",
);
const inventoryMobile = readFileSync(
  resolve(__dirname, "../../components/inventory/mobile-inventory-view.tsx"),
  "utf8",
);
const inventoryContent = readFileSync(
  resolve(__dirname, "../../app/dashboard/inventory/inventory-content.tsx"),
  "utf8",
);
const dashboard = readFileSync(
  resolve(__dirname, "../../app/dashboard/page.tsx"),
  "utf8",
);

describe("§11.374 StatusCountGrid 단일 컴포넌트 계약", () => {
  it("export + 2x2 그리드(grid-cols-2)", () => {
    expect(grid).toMatch(/export function StatusCountGrid/);
    expect(grid).toMatch(/grid grid-cols-2/);
  });

  it("표현 전용 — 자체 fetch/query 금지(canonical truth 보호)", () => {
    expect(grid).not.toMatch(/useQuery|fetch\(|csrfFetch/);
  });

  it("interactive 게이팅 — disabled 면 onClick 미연결(dead button 방지)", () => {
    expect(grid).toMatch(/const interactive = !!item\.onClick && !item\.disabled/);
    expect(grid).toMatch(/onClick=\{interactive \? item\.onClick : undefined\}/);
  });

  it("a11y — aria-pressed(active) + aria-disabled + 44px 터치", () => {
    expect(grid).toMatch(/aria-pressed=/);
    expect(grid).toMatch(/min-h-\[44px\]/);
  });
});

describe("§11.374 견적 모바일 바 — StatusCountGrid 채택", () => {
  it("StatusCountGrid import + 사용", () => {
    expect(quotes).toMatch(/import \{ StatusCountGrid \} from "@\/components\/layout\/status-count-grid"/);
    expect(quotes).toMatch(/<StatusCountGrid/);
  });

  it("회귀: 옛 가로 5-탭 바(flex items-stretch border-y) 제거", () => {
    expect(quotes).not.toMatch(/sm:hidden flex items-stretch border-y/);
    // 옛 per-item activeText 배열 구조 제거
    expect(quotes).not.toMatch(/activeText: "text-yellow-600"/);
  });

  it("canonical count 소스 보존(summaryStats.*.count 주입)", () => {
    expect(quotes).toMatch(/summaryStats\.dispatchPending\.count/);
    expect(quotes).toMatch(/summaryStats\.responseTracking\.count/);
    expect(quotes).toMatch(/summaryStats\.compareReview\.count/);
    expect(quotes).toMatch(/summaryStats\.approvalException\.count/);
    expect(quotes).toMatch(/summaryStats\.readyToConvert\.count/);
  });

  it("필터 wiring 보존(setStatusFilter 토글) + 비교 0건 가드", () => {
    expect(quotes).toMatch(/setStatusFilter\(\(prev\) => \(prev === it\.key \? "all" : it\.key\)\)/);
    expect(quotes).toMatch(/it\.key === "RESPONDED" && isZero/);
  });

  it("isLoadingTimeout fallback 보존", () => {
    expect(quotes).toMatch(/quote-kpi-mobile-summary-fallback/);
    expect(quotes).toMatch(/불러오기 실패/);
  });

  it("데스크탑 5-cell grid 유지(lg:grid-cols-5) — P2 모바일만 교체", () => {
    expect(quotes).toMatch(/lg:grid-cols-5/);
  });
});

// ═══════════════════════════════════════════════════════════════════
// P3.1 계약 확장 — 구매/재고 StatusCountGrid 채택 + AppPageHeader 4탭 +
// 견적 스캔 우측 이동. 채택 assert 는 구현 전까지 RED(의도된 실패),
// 회귀/canonical 보존 assert 는 현재 GREEN(구현 후에도 유지).
// ═══════════════════════════════════════════════════════════════════

describe("§11.374 P3.2 구매 — StatusCountGrid 채택 [RED until P3.2]", () => {
  it("StatusCountGrid import + 사용", () => {
    expect(purchaseOrders).toMatch(
      /import \{ StatusCountGrid \} from "@\/components\/layout\/status-count-grid"/,
    );
    expect(purchaseOrders).toMatch(/<StatusCountGrid/);
  });
});

describe("§11.374 P3.2 구매 — canonical/wiring 보존 [회귀 0, GREEN]", () => {
  it("canonical count 소스 보존(headerStats)", () => {
    expect(purchaseOrders).toMatch(/headerStats\[/);
    expect(purchaseOrders).toMatch(/MODULE_HEADER_STAT_META/);
  });
  it("필터 wiring 보존(setActiveTab + PO_BUCKET_TABS)", () => {
    expect(purchaseOrders).toMatch(/setActiveTab\(/);
    expect(purchaseOrders).toMatch(/PO_BUCKET_TABS/);
  });
  it("상태별 분류 aria 의미 보존", () => {
    expect(purchaseOrders).toMatch(/상태별 분류/);
  });
});

describe("§11.374 P3.3 재고 — StatusCountGrid 채택 [RED until P3.3]", () => {
  it("StatusCountGrid import + 사용(mobile-inventory-view)", () => {
    expect(inventoryMobile).toMatch(
      /import \{ StatusCountGrid \} from "@\/components\/layout\/status-count-grid"/,
    );
    expect(inventoryMobile).toMatch(/<StatusCountGrid/);
  });
});

describe("§11.374 P3.3 재고 — canonical/§11.311 보존 [회귀 0, GREEN]", () => {
  it("canonical count 소스 보존(reorder/expiring/dispose/issue)", () => {
    expect(inventoryMobile).toMatch(/reorderCount/);
    expect(inventoryMobile).toMatch(/expiringCount/);
    expect(inventoryMobile).toMatch(/disposeCount/);
    expect(inventoryMobile).toMatch(/issueCount/);
  });
  it("§11.311 expired-lot 우선 정렬 보존(danger 0 우선)", () => {
    expect(inventoryMobile).toMatch(/danger: 0, expiring: 1, low: 2, normal: 3/);
  });
  it("폐기 검토 danger(red) 톤 보존 — generic reorder 가 dispose 가리지 않음", () => {
    expect(inventoryMobile).toMatch(/폐기 검토/);
    expect(inventoryMobile).toMatch(/dispose/);
  });
});

describe("§11.374 P3.4 AppPageHeader 4탭 채택 [RED until P3.4]", () => {
  it("견적 — AppPageHeader import + 사용", () => {
    expect(quotes).toMatch(/import \{[^}]*AppPageHeader[^}]*\} from "@\/components\/layout\/page-header"/);
    expect(quotes).toMatch(/<AppPageHeader/);
  });
  it("구매 — AppPageHeader import + 사용", () => {
    expect(purchaseOrders).toMatch(/import \{[^}]*AppPageHeader[^}]*\} from "@\/components\/layout\/page-header"/);
    expect(purchaseOrders).toMatch(/<AppPageHeader/);
  });
  it("대시보드 — AppPageHeader import + 사용", () => {
    expect(dashboard).toMatch(/import \{[^}]*AppPageHeader[^}]*\} from "@\/components\/layout\/page-header"/);
    expect(dashboard).toMatch(/<AppPageHeader/);
  });
  it("재고(inventory-content) — AppPageHeader import + 사용", () => {
    expect(inventoryContent).toMatch(/import \{[^}]*AppPageHeader[^}]*\} from "@\/components\/layout\/page-header"/);
    expect(inventoryContent).toMatch(/<AppPageHeader/);
  });
});

describe("§11.374 P3.4 견적 스캔버튼 우측 이동 [RED until P3.4]", () => {
  it("스캔 액션이 AppPageHeader actions 로 이동(우측 고정)", () => {
    // actions 배열 안에서 스캔 핸들러(setAiParseModalOpen)가 연결되어야 함
    expect(quotes).toMatch(/actions=\{[\s\S]{0,1500}setAiParseModalOpen/);
  });
});

describe("§11.374 P3.4 견적 스캔 wiring 보존 [회귀 0, GREEN]", () => {
  it("스캔 onClick(setAiParseModalOpen) 보존 — dead button 금지", () => {
    expect(quotes).toMatch(/setAiParseModalOpen\(true\)/);
  });
});

describe("§11.374 P3 대시보드 種 보호 — StatusCountGrid 미적용 [canonical guard, GREEN]", () => {
  it("대시보드 KPI 판단카드는 StatusCountGrid 로 대체 금지(trend/risk 정보 손실 방지)", () => {
    expect(dashboard).not.toMatch(/StatusCountGrid/);
  });
});
