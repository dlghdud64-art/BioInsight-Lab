/**
 * 알림 고도화 #notif-inventory-low-order — INVENTORY_LOW(출고 경로) + ORDER_*
 *   trigger 배선 (PLAN_notification-enhancement Phase 2 잔여 + Phase 3)
 *
 * Truth reconciliation (2026-06-08 코드 실측):
 *   - INVENTORY_LOW 는 inventory/[id] PATCH(§11.250a)에 이미 완비 → 갭 = use(출고) 경로.
 *   - ORDER_SHIPPED/DELIVERED 는 admin/orders/[id]/status 에 이미 완비 → 갭 = owner PATCH 경로.
 *   - ORDER_PLACED 는 caller 0(ORDER_CREATED_FROM_POCANDIDATE 는 audit eventType) → orders POST.
 *
 * 원칙: best-effort(메인 mutation 비차단), edge 감지로 query-free dedupe
 *   (임계/상태 전이 시 1회, 폭주·멱등중복 0), 공통 헬퍼 resolveOrgRecipients.
 *   기존 병렬 caller(admin status / inventory PATCH / smart-receiving) 회귀 0.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", ".."); // apps/web
function read(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}

const USE_ROUTE = "src/app/api/inventory/[id]/use/route.ts";
const ORDERS_POST = "src/app/api/orders/route.ts";
const ORDER_PATCH = "src/app/api/orders/[id]/route.ts";
const INV_PATCH = "src/app/api/inventory/[id]/route.ts";
const ADMIN_STATUS = "src/app/api/admin/orders/[id]/status/route.ts";
const SMART_RECEIVING = "src/app/api/inventory/smart-receiving/route.ts";

describe("알림 — INVENTORY_LOW 출고(use) 경로 trigger", () => {
  it("dispatch import + INVENTORY_LOW + entityType INVENTORY", () => {
    const src = read(USE_ROUTE);
    expect(src).toMatch(
      /import \{ dispatchNotificationEvent, resolveOrgRecipients \}/,
    );
    expect(src).toMatch(/eventType:\s*"INVENTORY_LOW"/);
    expect(src).toMatch(/entityType:\s*"INVENTORY"/);
  });

  it("edge 감지 — 임계 최초 진입(prevQty > safetyStock && newQty <= safetyStock)", () => {
    const src = read(USE_ROUTE);
    expect(src).toMatch(/safetyStock\s*!=\s*null/);
    expect(src).toMatch(/quantityBefore\s*>\s*safetyStock/);
    expect(src).toMatch(/newQty\s*<=\s*safetyStock/);
  });

  it("best-effort — dispatch 실패가 mutation 차단 안 함(try-catch)", () => {
    const src = read(USE_ROUTE);
    expect(src).toMatch(/INVENTORY_LOW dispatch 실패/);
    expect(src).toMatch(/resolveOrgRecipients\(/);
  });
});

describe("알림 — ORDER_PLACED (orders POST) trigger", () => {
  it("dispatch import + ORDER_PLACED + entityType ORDER", () => {
    const src = read(ORDERS_POST);
    expect(src).toMatch(
      /import \{ dispatchNotificationEvent, resolveOrgRecipients \}/,
    );
    expect(src).toMatch(/eventType:\s*"ORDER_PLACED"/);
    expect(src).toMatch(/entityType:\s*"ORDER"/);
  });

  it("best-effort try-catch + resolveOrgRecipients", () => {
    const src = read(ORDERS_POST);
    expect(src).toMatch(/ORDER_PLACED dispatch 실패/);
    expect(src).toMatch(/resolveOrgRecipients\(\s*\n?\s*result\.order\.userId/);
  });
});

describe("알림 — ORDER_SHIPPED/DELIVERED (owner PATCH) trigger", () => {
  it("dispatch import + 전이 ternary(SHIPPED/DELIVERED)", () => {
    const src = read(ORDER_PATCH);
    expect(src).toMatch(
      /import \{ dispatchNotificationEvent, resolveOrgRecipients \}/,
    );
    expect(src).toMatch(
      /shippedTransition\s*\?\s*"ORDER_SHIPPED"\s*:\s*"ORDER_DELIVERED"/,
    );
  });

  it("edge 감지 — before.status !== newStatus (멱등 재호출 중복 0)", () => {
    const src = read(ORDER_PATCH);
    expect(src).toMatch(
      /data\.status === OrderStatus\.SHIPPING\s*&&\s*\n?\s*before\.status !== OrderStatus\.SHIPPING/,
    );
    expect(src).toMatch(
      /data\.status === OrderStatus\.DELIVERED\s*&&\s*\n?\s*before\.status !== OrderStatus\.DELIVERED/,
    );
  });

  it("best-effort try-catch", () => {
    const src = read(ORDER_PATCH);
    expect(src).toMatch(/ORDER status notification dispatch 실패/);
  });
});

describe("알림 — 회귀 0 (기존 병렬 caller 보존)", () => {
  it("inventory/[id] PATCH INVENTORY_LOW(§11.250a) 보존", () => {
    const src = read(INV_PATCH);
    expect(src).toMatch(/eventType:\s*"INVENTORY_LOW"/);
    expect(src).toMatch(/prevQty\s*>\s*safetyStock/);
  });

  it("admin/orders/status ORDER_SHIPPED + ORDER_DELIVERED 보존", () => {
    const src = read(ADMIN_STATUS);
    expect(src).toMatch(/eventType:\s*"ORDER_SHIPPED"/);
    expect(src).toMatch(/eventType:\s*"ORDER_DELIVERED"/);
  });

  it("smart-receiving INVENTORY_RECEIVED 2분기 보존", () => {
    const src = read(SMART_RECEIVING);
    const received = src.match(/eventType:\s*"INVENTORY_RECEIVED"/g) ?? [];
    expect(received.length).toBe(2);
  });

  it("use route 기존 transaction/audit/응답 보존", () => {
    const src = read(USE_ROUTE);
    expect(src).toMatch(/db\.\$transaction/);
    expect(src).toMatch(/createAuditLog/);
    expect(src).toMatch(/usageRecordId:\s*usageRecord\.id/);
  });

  it("orders POST 기존 예산차감/state transition 보존", () => {
    const src = read(ORDERS_POST);
    expect(src).toMatch(/logStateTransition/);
    expect(src).toMatch(/dispatchReadiness:\s*buildOrderDispatchReadiness/);
  });
});
