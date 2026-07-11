/**
 * #inventory-lot-overlay P5 (RED -> GREEN) — Lot 추적 same-canvas overlay + 실 데이터 배선.
 *
 * 핵심: Lot 추적 표면을 Math.random 합성 → 실 InventoryRestock/InventoryUsage 로 배선하고,
 * same-canvas 풀스크린 overlay 로 승격, lot 선택 시 실 LotEvent 타임라인(receive+use) 노출.
 * 다건출고는 배치 API 미배선 → 실행 정직-disabled(부분출고 GMP 위반 방지).
 *
 * 승인(호영님 2026-07-10):
 *  - Lot 소스 = inventories[].restockRecords (품목당 다중 lot, GET /api/inventory 이미 반환).
 *  - receivedAt=restockedAt, lastEventAt=실 최신 이벤트. Math.random 산출 전량 제거.
 *  - use 타임라인 = usageData.records by inventory.id + lotNumber.
 *    usage lotNumber=null(과거 레코드)은 특정 lot 타임라인 제외, item 스코프 "이 품목 사용" 표기.
 *  - 다건 선택 UI 는 그리되 일괄출고 실행 disabled + 사유 툴팁("일괄 출고는 배치 API 배선 후 제공").
 *  - dispose 는 persisted 쿼리 없음 → 타임라인 receive+use 중심, 폐기는 현 lot-disposal-panel 유지.
 *
 * Phase 1 기대: 데이터 배선/overlay/타임라인/disabled = RED. 기존 필터·FEFO·검색·폐기배선 회귀 = GREEN.
 *
 * 구현 앵커(Phase 2/3 가 충족해야 할 정확 토큰):
 *  - content: `receivedAt: new Date(Date.now() - Math.random` / `lastEventAt: new Date(Date.now() - Math.random` 제거
 *  - content: `.restockRecords` 멤버접근으로 lot 빌드
 *  - content ProductInventory 타입: `restockRecords?`
 *  - content usageData record 타입: `lotNumber`
 *  - content: testid `lot-tracking-overlay`
 *  - content: testid `lot-event-timeline`
 *  - content: 사유 문구 `일괄 출고는 배치 API 배선 후 제공` + 마커 `data-lot-bulk-dispatch-disabled`
 *  - must-not: 신규 route dir src/app/dashboard/inventory/lot
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const WEB = join(__dirname, "..", "..", "..");
const read = (rel: string): string => readFileSync(join(WEB, rel), "utf8");
const exists = (rel: string): boolean => existsSync(join(WEB, rel));

const CONTENT = "src/app/dashboard/inventory/inventory-content.tsx";

describe("#inventory-lot-overlay P5 — 가짜 데이터 제거 (RED)", () => {
  it("Lot receivedAt Math.random 합성 제거", () => {
    expect(read(CONTENT)).not.toMatch(/receivedAt:\s*new Date\(Date\.now\(\)\s*-\s*Math\.random/);
  });
  it("Lot lastEventAt Math.random 합성 제거", () => {
    expect(read(CONTENT)).not.toMatch(/lastEventAt:\s*new Date\(Date\.now\(\)\s*-\s*Math\.random/);
  });
});

describe("#inventory-lot-overlay P5 — 실 restockRecords 배선 (RED)", () => {
  it("ProductInventory 타입에 restockRecords 선언", () => {
    expect(read(CONTENT)).toMatch(/restockRecords\?:/);
  });
  it("lot 빌드가 restockRecords 멤버접근 소비", () => {
    expect(read(CONTENT)).toMatch(/\.restockRecords/);
  });
});

describe("#inventory-lot-overlay P5 — 실 use 타임라인 (RED)", () => {
  it("usageData record 타입에 lotNumber 노출", () => {
    // usage API 는 include 로 이미 lotNumber 반환 — 클라 타입 노출만.
    const src = read(CONTENT);
    const usageTypeBlock = src.match(/useQuery<\{\s*records:\s*Array<\{[\s\S]*?usageDate:[\s\S]*?\}>/)?.[0] ?? "";
    expect(usageTypeBlock).toMatch(/lotNumber/);
  });
  it("lot 이벤트 타임라인 surface 존재(testid)", () => {
    expect(read(CONTENT)).toContain("lot-event-timeline");
  });
});

describe("#inventory-lot-overlay P5 — same-canvas overlay (RED)", () => {
  it("Lot 추적 풀스크린 overlay surface 존재(testid)", () => {
    expect(read(CONTENT)).toContain("lot-tracking-overlay");
  });
  it("신규 route(page-per-feature) 미생성 — src/app/dashboard/inventory/lot 없음", () => {
    expect(exists("src/app/dashboard/inventory/lot")).toBe(false);
  });
});

describe("#inventory-lot-overlay P5 — 다건출고 (batch-dispatch 배선 후 enabled)", () => {
  // #inventory-batch-dispatch 로 실배선 완료 — 정직-disabled 해제.
  it("일괄출고 disabled 마커 제거(배선 완료)", () => {
    expect(read(CONTENT)).not.toContain("data-lot-bulk-dispatch-disabled");
  });
  it("일괄출고 배치 sheet 오픈 배선", () => {
    expect(read(CONTENT)).toContain("data-lot-batch-dispatch-open");
  });
});

describe("#inventory-lot-overlay P5 — 회귀 0 (GREEN)", () => {
  it("Lot 엔진 필터/FEFO/검색/요약 소비 보존", () => {
    const src = read(CONTENT);
    expect(src).toContain("filterLotsByStatus");
    expect(src).toContain("sortLots");
    expect(src).toContain("searchLots");
    expect(src).toContain("computeLotSummary");
    expect(src).toContain("getLotStatusColor");
  });
  it("Lot 상태 필터 4분류 보존", () => {
    const src = read(CONTENT);
    expect(src).toContain('"expiring_soon"');
    expect(src).toContain('"expired"');
    expect(src).toContain('"active"');
  });
  it("폐기 dock 배선 보존(disposeLotMutation)", () => {
    expect(read(CONTENT)).toContain("disposeLotMutation");
  });
});
