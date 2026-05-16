/**
 * §11.250a #inventory-low-notification-dispatch — 호영님 dead path audit 후속 (P0).
 *
 * 호영님 spec: inventory PATCH 안 quantity 변경 시 transition detection
 *   (was OK → now low) → INVENTORY_LOW dispatch + push.
 *
 * Strategy:
 *   - inventory/[id] PATCH 안 트랜잭션 성공 직후 신규 transition block.
 *   - 조건: existingInventory.safetyStock != null && existing > safetyStock &&
 *     updated.currentQuantity <= safetyStock (transition 만 알림 — 매 update 알림 회피).
 *   - dispatchNotificationEvent INVENTORY_LOW + entityType "INVENTORY" + entityId inventory.id.
 *   - sendPushNotification(inventory.userId, { type "low_stock", id inventory.id, ... }).
 *   - inventory.userId null 시 (organizationId 만 있는 경우) skip — multi-recipient 별도 cluster.
 *
 * canonical truth lock:
 *   - INVENTORY_LOW event-type 이미 등록 (entityType "INVENTORY", defaultActions
 *     [IN_APP, QUEUE_ITEM, ESCALATION]).
 *   - mobile notifications.ts ROUTE_MAP.low_stock.detail → `/inventory/${id}`
 *     (push tap 시 정확한 inventory detail 진입).
 *   - §11.229b-5/-6 dispatch + push 1:1 정합 패턴 reuse.
 *   - 기존 inventory PATCH 트랜잭션 + audit log 보존.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function safeRead(p: string): string {
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

const ROUTE_PATH = resolve(
  __dirname,
  "../../../app/api/inventory/[id]/route.ts",
);
const EVENT_TYPES_PATH = resolve(
  __dirname,
  "../../../lib/notifications/event-types.ts",
);
const MOBILE_NOTIF_PATH = resolve(
  __dirname,
  "../../../../../mobile/lib/notifications.ts",
);

const route = safeRead(ROUTE_PATH);
const eventTypes = safeRead(EVENT_TYPES_PATH);
const mobileNotif = safeRead(MOBILE_NOTIF_PATH);

describe("§11.250a #1 — inventory PATCH route INVENTORY_LOW dispatch", () => {
  it("dispatchNotificationEvent import 추가", () => {
    expect(route).toMatch(/dispatchNotificationEvent/);
    expect(route).toMatch(/from\s+["']@\/lib\/notifications\/event-dispatcher["']/);
  });

  it("INVENTORY_LOW eventType 호출", () => {
    expect(route).toMatch(/eventType[:\s]+["']INVENTORY_LOW["']/);
  });

  it("entityType INVENTORY 정합", () => {
    expect(route).toMatch(/dispatchNotificationEvent[\s\S]{0,500}entityType[:\s]+["']INVENTORY["']/);
  });

  it("entityId inventory.id forward", () => {
    expect(route).toMatch(/dispatchNotificationEvent[\s\S]{0,500}entityId[:\s]+(params\.id|updatedInventory\.id|existingInventory\.id)/);
  });

  it("recipients inventory.userId (single recipient minimum scope)", () => {
    expect(route).toMatch(/dispatchNotificationEvent[\s\S]{0,800}recipients[\s\S]{0,300}userId/);
  });

  it("metadata productName + currentQuantity + safetyStock 포함", () => {
    expect(route).toMatch(/dispatchNotificationEvent[\s\S]{0,1500}metadata[\s\S]{0,500}(product|productName)/);
    expect(route).toMatch(/dispatchNotificationEvent[\s\S]{0,1500}metadata[\s\S]{0,500}currentQuantity/);
    expect(route).toMatch(/dispatchNotificationEvent[\s\S]{0,1500}metadata[\s\S]{0,500}safetyStock/);
  });
});

describe("§11.250a #2 — push notification (sendPushNotification)", () => {
  it("sendPushNotification import 추가", () => {
    expect(route).toMatch(/sendPushNotification/);
    expect(route).toMatch(/from\s+["']@\/lib\/notifications\/push-sender["']/);
  });

  it("sendPushNotification 호출 — inventory.userId forward", () => {
    expect(route).toMatch(/sendPushNotification\s*\(\s*(\w+\.)?userId/);
  });

  it("push payload type 'low_stock' (mobile ROUTE_MAP 매핑)", () => {
    expect(route).toMatch(/sendPushNotification[\s\S]{0,500}type[:\s]+["']low_stock["']/);
  });

  it("push payload id = inventory.id (deep-link 위함)", () => {
    expect(route).toMatch(/sendPushNotification[\s\S]{0,500}id[:\s]+(params\.id|updatedInventory\.id|existingInventory\.id)/);
  });

  it("push title 한국어 (재고 또는 부족)", () => {
    expect(route).toMatch(/sendPushNotification[\s\S]{0,800}title[\s\S]{0,200}(재고|부족)/);
  });
});

describe("§11.250a #3 — transition detection (was OK → now low)", () => {
  it("safetyStock null 가드 (safetyStock != null 또는 typeof check)", () => {
    expect(route).toMatch(/(safetyStock[\s\S]{0,30}(!=\s*null|!==\s*null|typeof|>\s*0))|(safetyStock\s*&&)/);
  });

  it("transition 조건 — was above, now at or below", () => {
    // existing > safetyStock && updated <= safetyStock 패턴
    expect(route).toMatch(/(existingInventory|prev|previous|before)[\s\S]{0,100}safetyStock[\s\S]{0,500}(updatedInventory|updated)[\s\S]{0,100}safetyStock/);
  });

  it("inventory.userId null check (guest/org-only skip)", () => {
    expect(route).toMatch(/(updatedInventory|existingInventory)\.userId/);
  });
});

describe("§11.250a #4 — graceful try/catch (mutation 정합 보호)", () => {
  it("dispatchNotificationEvent try/catch 래핑", () => {
    expect(route).toMatch(/try\s*\{[\s\S]{0,1200}dispatchNotificationEvent[\s\S]{0,1200}\}\s*catch/);
  });

  it("sendPushNotification try/catch 래핑", () => {
    expect(route).toMatch(/try\s*\{[\s\S]{0,1200}sendPushNotification[\s\S]{0,1200}\}\s*catch/);
  });
});

describe("§11.250a #5 — invariant 보존 (cross-stack)", () => {
  it("기존 inventory PATCH 시그니처 보존", () => {
    expect(route).toMatch(/export\s+async\s+function\s+PATCH/);
  });

  it("기존 트랜잭션 (db.$transaction productInventory.update) 보존", () => {
    expect(route).toMatch(/db\.\$transaction/);
    expect(route).toMatch(/productInventory\.update/);
  });

  it("기존 createAuditLog 보존", () => {
    expect(route).toMatch(/createAuditLog/);
  });

  it("INVENTORY_LOW event-type 정의 보존 (entityType INVENTORY, IN_APP)", () => {
    expect(eventTypes).toMatch(/INVENTORY_LOW[\s\S]{0,400}entityType[:\s]+["']INVENTORY["']/);
    expect(eventTypes).toMatch(/INVENTORY_LOW[\s\S]{0,500}IN_APP/);
  });

  it("mobile low_stock NotificationType 보존", () => {
    expect(mobileNotif).toMatch(/["']low_stock["']/);
  });

  it("mobile ROUTE_MAP low_stock detail → /inventory/{id} 보존", () => {
    expect(mobileNotif).toMatch(/low_stock[\s\S]{0,300}\/inventory\/\$\{id\}/);
  });

  it("§11.250a trace marker", () => {
    expect(route).toMatch(/§11\.250a|11\.250a/);
  });
});
