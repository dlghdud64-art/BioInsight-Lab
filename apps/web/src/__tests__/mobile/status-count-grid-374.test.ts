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

describe("§11.374 [SUPERSEDED — §quote-flat KPI-dedup 2026-06-21] 견적 모바일 바 제거", () => {
  // KPI Control Cards(데스크탑 5-cell + 모바일 StatusCountGrid 바)는 퍼널(§quote-management P2)과
  // 단계 카운트가 중복이라 제거(호영님 2026-06-21). 퍼널이 모바일에서도 wrap → 단계 카운트 커버.
  // StatusCountGrid 컴포넌트 계약(위 describe) + P3 구매/재고/대시보드 rollout(아래)은 유지 —
  // 여기선 '견적 페이지의 모바일 바 채택'만 폐기→부재-lock 전환(272c/272c-2/259a 와 동일 family).
  it("견적 모바일 바(StatusCountGrid 채택) 제거 — 부재 유지", () => {
    expect(quotes).not.toMatch(/import \{ StatusCountGrid \} from "@\/components\/layout\/status-count-grid"/);
    expect(quotes).not.toMatch(/<StatusCountGrid/);
    expect(quotes).not.toMatch(/data-testid="quote-kpi-mobile-summary-bar"/);
  });

  it("KPI 의존 dead-code(summaryStats / isLoadingTimeout) 제거 유지", () => {
    expect(quotes).not.toMatch(/const summaryStats = useMemo/);
    expect(quotes).not.toMatch(/const \[isLoadingTimeout, setIsLoadingTimeout\]/);
  });

  it("데스크탑 5-cell grid 제거 유지(lg:grid-cols-5 부재)", () => {
    expect(quotes).not.toMatch(/lg:grid-cols-5/);
  });

  it("단계 카운트/필터는 퍼널 + 마감 진입점으로 보존(회귀 0)", () => {
    // §quotes-filter-popover(이번 세션) — 상태 Select '오늘 마감'(value="DEADLINE_TODAY" 옵션)이 다축 필터
    //   popover로 폐지·마감 진입점은 MODE_CHIPS 'deadline_soon'(dd≤2)으로 이전(quote-kpi-dedup 동형).
    //   DEADLINE_TODAY 술어는 URL ?status / 저장 필터 경유 reachable 잔존 → 단계 카운트/필터 보존 의도 불변.
    expect(quotes).toMatch(/<QuoteFunnel/);
    expect(quotes).toMatch(/key:\s*"deadline_soon"/);              // 마감 진입점(Select 옵션 대체)
    expect(quotes).toMatch(/statusFilter === "DEADLINE_TODAY"/);   // 술어 잔존(reachable)
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

describe("§11.374 P3.4 견적 스캔버튼 우측 이동 — §quote-perm-gate handleScanOpen 정합", () => {
  it("스캔 액션이 AppPageHeader actions 안(우측 고정) — perm-gate handleScanOpen", () => {
    // §quote-perm-gate 진화: 스캔 onClick 이 setAiParseModalOpen 직접 호출 → handleScanOpen(권한
    //   사전체크 후 모달) 으로 감쌈. 스캔은 AppPageHeader actions 안에 위치(P3.4 우측 이동 충족).
    //   handleScanOpen 이 setAiParseModalOpen(true) 호출 → wiring 보존(dead button 0). 보호의도 불변.
    expect(quotes).toMatch(/actions=\{[\s\S]{0,5000}onClick=\{handleScanOpen\}/);
    expect(quotes).toMatch(/const handleScanOpen = useCallback\(\(\) => \{[\s\S]{0,160}setAiParseModalOpen\(true\)/);
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
