/**
 * §11.366-후속 (perf) — /api/dashboard/stats 경량화 Phase 1 테스트
 *
 * 갈래 = 지연(b) 확정 (Live 실측 2026-06-05: stats 200인데 cold 지연).
 * 목표: 직렬체인 병렬화 + 0건 early count-check + brand overfetch 제거.
 * 제약: 집계 canonical truth 불변, payload contract(top-level 키) 불변, minimal-diff.
 *
 * 테스트 종류:
 *  - RED(TDD): Phase 2 미착수 = 실패. Phase 2 구현 후 green. → (a)(d)(e)
 *  - GREEN(회귀 보호): 지금 통과. Phase 2 가 truth/contract 깨면 실패. → (b)(c)
 *
 * ⚠️ 실행 = Claude Code(vitest). sandbox = 작성/정합 사전검증.
 * 런타임 집계 동일성은 db-mock 하니스(이 repo 미보유) 대신
 *  (b) 산식 byte-보존 sentinel + Phase 4 Chrome 실측 before/after 수치 비교로 보강.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
const ROUTE = readFileSync(
  join(APP_WEB_ROOT, "src/app/api/dashboard/stats/route.ts"),
  "utf8",
);
const PAGE = readFileSync(
  join(APP_WEB_ROOT, "src/app/dashboard/page.tsx"),
  "utf8",
);

// NextResponse.json({...}) 응답 블록만 슬라이스 (키 매칭을 응답 객체로 한정)
const respStart = ROUTE.indexOf("const resp = NextResponse.json({");
const respEnd = ROUTE.indexOf("// Non-blocking", respStart);
const RESP_BLOCK = ROUTE.slice(respStart, respEnd);

// ──────────────────────────────────────────────────────────────────────────
// (a) RED — 0건 early count-check
//   Phase 2: Stage A 직후 quote/order/inventory/purchase count 4종 → 전부 0이면
//   조기 반환(client 전 키 ?? 기본값으로 채워짐 = 계약 안전).
// ──────────────────────────────────────────────────────────────────────────
describe("§11.366 (a) RED — 0건 early count-check", () => {
  it("Stage A 직후 0건 분기 마커 존재 (Phase 2 도입)", () => {
    expect(ROUTE).toContain("§11.366 — 0건 early count-check");
  });
  it("4종 count 전부 0 일 때 조기 반환 분기", () => {
    expect(ROUTE).toMatch(
      /quoteCount === 0\s*&&\s*orderCount === 0\s*&&\s*inventoryCount === 0\s*&&\s*purchaseCount === 0/,
    );
  });
  it("(회귀) client 는 0건 응답을 기본값으로 흡수 — totalInventory/lowStockAlerts ?? 0", () => {
    expect(PAGE).toContain("rawStats.totalInventory ?? 0");
    expect(PAGE).toContain("rawStats.lowStockAlerts ?? 0");
  });
});

// ──────────────────────────────────────────────────────────────────────────
// (d) RED — brand overfetch 제거
//   L117 product select 의 brand 는 route 전체 미소비. payload top-level 키 영향 0
//   (nested join 필드). Phase 2 제거.
// ──────────────────────────────────────────────────────────────────────────
describe("§11.366 (d) RED — brand overfetch 제거", () => {
  it("dashboard stats select 에서 brand: true 부재", () => {
    expect(ROUTE).not.toContain("brand: true");
  });
});

// ──────────────────────────────────────────────────────────────────────────
// (e) RED — 직렬체인 병렬 호이스트
//   followThrough(quoteId→order→restock) + trend(snapshot) 는 각각 선행 stage 의
//   결과에만 의존 → Stage C(또는 그 이전) 병렬 배치로 호이스트해 임계 경로 단축.
//   marker 로 Phase 2 착수 강제 (구조는 Phase 2 재량).
// ──────────────────────────────────────────────────────────────────────────
describe("§11.366 (e) RED — followThrough·trend 병렬 호이스트", () => {
  it("병렬 호이스트 마커 존재 (Phase 2 도입)", () => {
    expect(ROUTE).toContain("§11.366 — 병렬 호이스트");
  });
});

// ──────────────────────────────────────────────────────────────────────────
// (b) GREEN(회귀) — 집계 canonical 산식 보존
//   성능만 변경, 산식 불변. Phase 2 가 아래 truth 산식을 바꾸면 실패.
// ──────────────────────────────────────────────────────────────────────────
describe("§11.366 (b) GREEN — 집계 truth 산식 byte-보존", () => {
  it("totalPurchaseAmount = orders 합산", () => {
    expect(ROUTE).toContain("const totalPurchaseAmount = orders.reduce(");
    expect(ROUTE).toMatch(/sum\s*\+\s*order\.totalAmount/);
  });
  it("thisMonthOrders = monthStart 이후 필터", () => {
    expect(ROUTE).toContain("new Date(order.createdAt) >= monthStart");
  });
  it("monthOverMonthChange 산식", () => {
    expect(ROUTE).toMatch(
      /\(\(thisMonthPurchaseAmount - lastMonthPurchaseAmount\) \/ lastMonthPurchaseAmount\) \* 100/,
    );
  });
  it("weekOverWeekChange 산식 (§11.94)", () => {
    expect(ROUTE).toMatch(
      /\(\(last7DaysSpending - prev7DaysSpending\) \/ prev7DaysSpending\) \* 100/,
    );
  });
  it("totalAssetValue = unitPrice × quantity 누적", () => {
    expect(ROUTE).toContain(
      "totalAssetValue += unitPrice * Number(inventory.quantity || 0);",
    );
  });
  it("categorySpending = PurchaseRecord.category 합산 (§category-source-drift — Order파생→PurchaseRecord파생)", () => {
    // §category-source-drift: categorySpending 을 canonical 지출원장(PurchaseRecord.category)으로 파생.
    //   이전 Order/OrderItem(unitPrice×quantity) → guest-demo 등 PurchaseRecord-only 계정에서 카테고리
    //   영구 empty 시정. spend 와 동일 소스 정합. perf 의도(쿼리 절감)는 product 조회 1개 제거로 강화.
    expect(ROUTE).toContain("categorySpending[category] = (categorySpending[category] || 0) + (pr.amount || 0);");
    expect(ROUTE).toContain('pr.category || "기타"');
  });
  it("monthlySpending = 최근 6개월 루프", () => {
    expect(ROUTE).toContain("for (let i = 5; i >= 0; i--) {");
  });
  it("reorderNeededCount = dailyUsage×leadTime / safetyStock 기준", () => {
    expect(ROUTE).toContain("inv.currentQuantity <= dailyUsage * leadTime");
    expect(ROUTE).toContain("inv.currentQuantity <= inv.safetyStock");
  });
});

// ──────────────────────────────────────────────────────────────────────────
// (c) GREEN(회귀) — payload contract(top-level 키) 보존
//   client(page.tsx)는 전 키를 ?? 기본값으로 소비 → 키 삭제/개명 시 KPI 오판.
// ──────────────────────────────────────────────────────────────────────────
describe("§11.366 (c) GREEN — payload top-level 키 보존", () => {
  const PAYLOAD_KEYS = [
    "trend",
    "budget",
    "budgetUsageRate",
    "totalPurchaseAmount",
    "thisMonthPurchaseAmount",
    "monthOverMonthChange",
    "weekOverWeekChange",
    "last7DaysSpending",
    "totalAssetValue",
    "reorderNeededCount",
    "lowStockAlerts",
    "totalInventory",
    "expiringItems",
    "expiringCount",
    "lowStockItems",
    "categorySpending",
    "orderStats",
    "quoteStats",
    "monthlySpending",
    "recentOrders",
    "recentPurchases",
    "undecidedCompareCount",
    "compareStats",
    "opsFunnel",
  ];

  it("응답 블록 슬라이스 정상 추출", () => {
    expect(respStart).toBeGreaterThan(-1);
    expect(respEnd).toBeGreaterThan(respStart);
  });

  it.each(PAYLOAD_KEYS)("payload 키 보존: %s", (key) => {
    // 응답 객체 내 `key:` 또는 `key,` 형태로 존재
    const re = new RegExp(`\\b${key}\\b\\s*[:,]`);
    expect(re.test(RESP_BLOCK)).toBe(true);
  });
});
