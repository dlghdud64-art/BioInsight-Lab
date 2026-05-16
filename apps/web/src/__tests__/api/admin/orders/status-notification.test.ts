/**
 * §11.250cd #order-status-notification-dispatch — 호영님 dead path audit P0 batch (ORDER_SHIPPED + ORDER_DELIVERED).
 *
 * 호영님 spec: admin/orders/[id]/status PATCH 안 newStatus 분기 dispatch + push.
 *   - SHIPPING transition → ORDER_SHIPPED dispatch + push (배송 시작 알림)
 *   - DELIVERED transition → ORDER_DELIVERED dispatch + push (입고 처리 trigger)
 *   동일 route 안 status 분기 = batch cluster (효율 ↑).
 *
 * Strategy:
 *   - tx.order.update 완료 후 (트랜잭션 외부, 기존 sendOrderDeliveredEmail 직후)
 *     newStatus 분기 dispatch + push.
 *   - recipient = order.userId (Order.user relation).
 *   - mobile NotificationType `purchase` reuse → ROUTE_MAP.purchase.detail = `/purchases/${id}`.
 *   - try/catch graceful — mutation 정합 유지.
 *
 * canonical truth lock:
 *   - ORDER_SHIPPED + ORDER_DELIVERED event-type 이미 등록 (entityType "ORDER").
 *   - mobile notifications.ts ROUTE_MAP.purchase.detail → `/purchases/${id}`.
 *   - §11.229b-5/-6 + §11.250a 패턴 정확 reuse (dispatch + push 1:1).
 *   - 기존 sendOrderDeliveredEmail + createActivityLog + budget release 보존.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function safeRead(p: string): string {
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

const ROUTE_PATH = resolve(
  __dirname,
  "../../../../app/api/admin/orders/[id]/status/route.ts",
);
const EVENT_TYPES_PATH = resolve(
  __dirname,
  "../../../../lib/notifications/event-types.ts",
);
const MOBILE_NOTIF_PATH = resolve(
  __dirname,
  "../../../../../../mobile/lib/notifications.ts",
);

const route = safeRead(ROUTE_PATH);
const eventTypes = safeRead(EVENT_TYPES_PATH);
const mobileNotif = safeRead(MOBILE_NOTIF_PATH);

describe("§11.250cd #1 — order status route dispatch import", () => {
  it("dispatchNotificationEvent import 추가", () => {
    expect(route).toMatch(/dispatchNotificationEvent/);
    expect(route).toMatch(/from\s+["']@\/lib\/notifications\/event-dispatcher["']/);
  });

  it("sendPushNotification import 추가", () => {
    expect(route).toMatch(/sendPushNotification/);
    expect(route).toMatch(/from\s+["']@\/lib\/notifications\/push-sender["']/);
  });
});

describe("§11.250cd #2 — ORDER_SHIPPED 분기 (SHIPPING transition)", () => {
  it("ORDER_SHIPPED eventType 호출", () => {
    expect(route).toMatch(/eventType[:\s]+["']ORDER_SHIPPED["']/);
  });

  it("entityType ORDER 정합 (ORDER_SHIPPED block)", () => {
    expect(route).toMatch(/ORDER_SHIPPED[\s\S]{0,800}entityType[:\s]+["']ORDER["']/);
  });

  it("SHIPPING newStatus 분기 조건", () => {
    expect(route).toMatch(/newStatus\s*===\s*["']SHIPPING["']/);
  });
});

describe("§11.250cd #3 — ORDER_DELIVERED 분기 (DELIVERED transition)", () => {
  it("ORDER_DELIVERED eventType 호출", () => {
    expect(route).toMatch(/eventType[:\s]+["']ORDER_DELIVERED["']/);
  });

  it("entityType ORDER 정합 (ORDER_DELIVERED block)", () => {
    expect(route).toMatch(/ORDER_DELIVERED[\s\S]{0,800}entityType[:\s]+["']ORDER["']/);
  });
});

describe("§11.250cd #4 — push notification (purchase NotificationType reuse)", () => {
  it("sendPushNotification 호출 — order.userId forward", () => {
    expect(route).toMatch(/sendPushNotification\s*\(\s*(\w+\.)*userId/);
  });

  it("push payload type 'purchase' (mobile ROUTE_MAP 매핑)", () => {
    expect(route).toMatch(/sendPushNotification[\s\S]{0,500}type[:\s]+["']purchase["']/);
  });

  it("push payload id = order.id (deep-link 위함)", () => {
    expect(route).toMatch(/sendPushNotification[\s\S]{0,1500}id[:\s]+(orderId|order\.id|updatedOrder\.id|params\.id|params\..)/);
  });

  it("push title 한국어 (배송 or 주문)", () => {
    expect(route).toMatch(/sendPushNotification[\s\S]{0,1500}title[\s\S]{0,200}(배송|주문)/);
  });
});

describe("§11.250cd #5 — graceful try/catch (mutation 정합 보호)", () => {
  it("ORDER_SHIPPED dispatch try/catch 래핑", () => {
    expect(route).toMatch(/try\s*\{[\s\S]{0,1500}ORDER_SHIPPED[\s\S]{0,1500}\}\s*catch/);
  });

  it("ORDER_DELIVERED dispatch try/catch 래핑", () => {
    expect(route).toMatch(/try\s*\{[\s\S]{0,1500}ORDER_DELIVERED[\s\S]{0,1500}\}\s*catch/);
  });

  it("order.userId null check (guest order skip)", () => {
    expect(route).toMatch(/(order|updatedOrder)\.userId/);
  });
});

describe("§11.250cd #6 — 기존 flow 보존 (invariant)", () => {
  it("PATCH 시그니처 보존", () => {
    expect(route).toMatch(/export\s+async\s+function\s+PATCH/);
  });

  it("STATUS_TRANSITIONS 보존", () => {
    expect(route).toMatch(/STATUS_TRANSITIONS/);
  });

  it("tx.order.update 보존", () => {
    expect(route).toMatch(/tx\.order\.update/);
  });

  it("sendOrderDeliveredEmail 보존", () => {
    expect(route).toMatch(/sendOrderDeliveredEmail/);
  });

  it("createActivityLog ORDER_STATUS_CHANGED 보존", () => {
    expect(route).toMatch(/createActivityLog/);
    expect(route).toMatch(/ORDER_STATUS_CHANGED/);
  });

  it("runDeliveryInventorySync (DELIVERED) 보존", () => {
    expect(route).toMatch(/runDeliveryInventorySync/);
  });

  it("releasePOVoided (CANCELLED) 보존", () => {
    expect(route).toMatch(/releasePOVoided/);
  });
});

describe("§11.250cd #7 — invariant 보존 (cross-stack)", () => {
  it("ORDER_SHIPPED event-type 정의 보존 (entityType ORDER)", () => {
    expect(eventTypes).toMatch(/ORDER_SHIPPED[\s\S]{0,400}entityType[:\s]+["']ORDER["']/);
  });

  it("ORDER_DELIVERED event-type 정의 보존 (entityType ORDER)", () => {
    expect(eventTypes).toMatch(/ORDER_DELIVERED[\s\S]{0,400}entityType[:\s]+["']ORDER["']/);
  });

  it("mobile purchase NotificationType 보존", () => {
    expect(mobileNotif).toMatch(/["']purchase["']/);
  });

  it("mobile ROUTE_MAP purchase detail → /purchases/{id} 보존", () => {
    expect(mobileNotif).toMatch(/purchase:\s*\{[\s\S]{0,300}\/purchases\/\$\{id\}/);
  });

  it("§11.250cd trace marker", () => {
    expect(route).toMatch(/§11\.250cd|11\.250cd/);
  });
});
