/**
 * §inventory-brief-canonical — 품목 브리핑 mock → canonical 교체 sentinel.
 *
 * 문제(P1, 프로덕션 노출): inventory-context-panel 이 가짜 데이터를 렌더 중.
 *   - generateMockConnectedFlows: 최근 구매 2026-02-15 / 입고 예정 2026-03-25 하드코딩, 수량 *2 조작
 *   - generateMockTransactions: 3/25·3/27·3/28·3/29 전건 가짜, 수량 *0.4 · "실험실 B" 조작
 *   - 최근 수정 이력 JSX: 2026-03-28 14:22 · 김연구원 · 수량 조정 5→3 하드코딩
 *
 * 결정(PLAN_inventory-brief-canonical.md §0, 호영님 승인 2026-07-31):
 *   - GET /api/inventory/[id]/movements 신설 — InventoryRestock + InventoryUsage 병합,
 *     재고 ownership(owner/orgMember) 게이트 통일(기존 usage GET 의 본인-only 스코프 갭 해소).
 *   - GET /api/inventory/[id]/history 신설 — 해당 재고 DataAuditLog(entityType INVENTORY) entity-scoped,
 *     동일 ownership 게이트(기존 /api/audit-logs 는 ADMIN/org-admin/self 전용 → 일반 사용자 403).
 *     ※ truth 정정: 재고 PATCH 는 lib/audit.ts → dataAuditLog(previousData/newData) 에 기록.
 *       AuditLog(changes) 는 별 계열(감사 이벤트) — 재고 수정 이력 아님.
 *   - 폐기 이벤트 표시 제외(canonical 소스 부재 — InventoryUsage.type = DISPATCH|USAGE).
 *   - 데이터 0건 → 섹션 미렌더(빈 껍데기 금지).
 *
 * canonical truth lock (회귀 0):
 *   - 패널은 read-only projection — mutation·값 소유 무접촉.
 *   - 리드타임(leadTimeDays)·SDS(hazard) 흐름 항목은 item 파생(canonical) → 보존.
 *   - §inventory-brief-sian 시안 정합 및 §9 신호등(amber/orange 금지) 유지.
 */

import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const PANEL = "src/components/inventory/inventory-context-panel.tsx";
const MOVEMENTS_ROUTE = "src/app/api/inventory/[id]/movements/route.ts";
const HISTORY_ROUTE = "src/app/api/inventory/[id]/history/route.ts";
const MOVEMENTS_HOOK = "src/hooks/use-inventory-movements.ts";
const HISTORY_HOOK = "src/hooks/use-inventory-history.ts";

const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), "utf8");
const exists = (rel: string) => existsSync(resolve(process.cwd(), rel));

describe("§inventory-brief-canonical P2 — movements 라우트", () => {
  it("라우트 파일 존재", () => {
    expect(exists(MOVEMENTS_ROUTE)).toBe(true);
  });

  it("GET + 재고 ownership 게이트(owner/orgMember) — usage 본인-only 갭 해소", () => {
    const src = read(MOVEMENTS_ROUTE);
    expect(src).toMatch(/export\s+async\s+function\s+GET/);
    expect(src).toContain("auth()");
    expect(src).toContain("productInventory.findUnique");
    expect(src).toContain("organizationMember");
    expect(src).toContain("403");
  });

  it("InventoryRestock + InventoryUsage 병합 + 최신순 + take 제한(overfetch 0)", () => {
    const src = read(MOVEMENTS_ROUTE);
    expect(src).toContain("inventoryRestock.findMany");
    expect(src).toContain("inventoryUsage.findMany");
    expect(src).toContain("restockedAt");
    expect(src).toContain("usageDate");
    expect(src).toContain("take:");
  });

  it("읽기 전용 — mutation 0", () => {
    const src = read(MOVEMENTS_ROUTE);
    expect(src).not.toMatch(/\.create\(|\.update\(|\.delete\(|\.upsert\(/);
  });
});

describe("§inventory-brief-canonical P2 — history 라우트", () => {
  it("라우트 파일 존재", () => {
    expect(exists(HISTORY_ROUTE)).toBe(true);
  });

  it("해당 재고 DataAuditLog entity-scoped + 재고 ownership 게이트", () => {
    const src = read(HISTORY_ROUTE);
    expect(src).toMatch(/export\s+async\s+function\s+GET/);
    expect(src).toContain("dataAuditLog.findMany");
    expect(src).toContain("entityType");
    expect(src).toContain("INVENTORY");
    expect(src).toContain("entityId");
    expect(src).toMatch(/previousData|newData/);
    expect(src).toContain("productInventory.findUnique");
    expect(src).toContain("organizationMember");
    expect(src).toContain("403");
  });

  it("읽기 전용 — mutation 0", () => {
    const src = read(HISTORY_ROUTE);
    expect(src).not.toMatch(/\.create\(|\.update\(|\.delete\(|\.upsert\(/);
  });
});

describe("§inventory-brief-canonical P3 — 훅", () => {
  it("movements·history 훅 존재 + enabled 게이트(패널 open 시에만 fetch)", () => {
    expect(exists(MOVEMENTS_HOOK)).toBe(true);
    expect(exists(HISTORY_HOOK)).toBe(true);
    expect(read(MOVEMENTS_HOOK)).toContain("enabled");
    expect(read(HISTORY_HOOK)).toContain("enabled");
  });

  it("훅은 신설 canonical 라우트 경유(클라이언트 임의 조합 아님)", () => {
    expect(read(MOVEMENTS_HOOK)).toContain("/movements");
    expect(read(HISTORY_HOOK)).toContain("/history");
  });
});

describe("§inventory-brief-canonical P3 — 패널 가짜 데이터 0", () => {
  it("mock 생성기 2종 제거", () => {
    const src = read(PANEL);
    expect(src).not.toContain("generateMockConnectedFlows");
    expect(src).not.toContain("generateMockTransactions");
  });

  it("하드코딩 날짜·인명·변경문구 0건", () => {
    const src = read(PANEL);
    expect(src).not.toContain("2026-02-15");
    expect(src).not.toContain("2026-03-25");
    expect(src).not.toContain("2026-03-28");
    expect(src).not.toContain("김연구원");
    expect(src).not.toContain("수량 조정 5→3");
    // ※ LOCATION_PRESETS 의 "실험실 B" 는 위치 선택 프리셋(정상 UI 상수) — mock 이동 문구만 금지.
    expect(src).not.toMatch(/→ 실험실 B/);
    expect(src).not.toMatch(/date:\s*"3\/2[5-9]"/);
  });

  it("패널이 canonical 훅 경유", () => {
    const src = read(PANEL);
    expect(src).toContain("useInventoryMovements");
    expect(src).toContain("useInventoryHistory");
  });

  it("데이터 0건 시 섹션 미렌더(빈 껍데기 금지)", () => {
    const src = read(PANEL);
    expect(src).toMatch(/movements\.length\s*>\s*0|hasMovements/);
    expect(src).toMatch(/history\.length\s*>\s*0|hasHistory/);
  });

  it("리드타임·SDS 파생 흐름 항목 보존(canonical item 파생)", () => {
    const src = read(PANEL);
    expect(src).toContain("leadTimeDays");
    expect(src).toContain("hazard");
  });
});

describe("§inventory-brief-canonical — 회귀 0", () => {
  it("패널 read-only — 신규 mutation 도입 0", () => {
    const src = read(PANEL);
    expect(src).not.toMatch(/method:\s*["'](POST|PATCH|DELETE)["']/);
  });

  it("§9 신호등 — amber/orange 0", () => {
    const src = read(PANEL);
    expect(src).not.toMatch(/\bamber-\d|\borange-\d/);
  });

  it("시안 정합 유지 — KPI testid·재발주 근거 섹션 보존", () => {
    const src = read(PANEL);
    expect(src).toContain("inventory-context-kpi-shortest-expiry");
    expect(src).toContain("inventory-context-reorder-basis");
  });
});
