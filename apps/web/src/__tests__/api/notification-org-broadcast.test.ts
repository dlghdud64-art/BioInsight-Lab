/**
 * §11.250acd-2 #notification-org-broadcast — dead path audit P0 backlog batch.
 *
 * 호영님 spec: §11.250a INVENTORY_LOW + §11.250cd ORDER_SHIPPED/DELIVERED 의
 *   organizationMember 다중 recipient 확장 (OWNER + ADMIN). 운영 팀 단위 broadcast.
 *
 * Strategy:
 *   - 각 dispatch + push block 안 organizationId 있으면 organizationMember findMany
 *     (role: OWNER + ADMIN) 추가 query → recipients array 확장 + push loop.
 *   - userId (기존 single) + orgMember userIds 합집합 (dedup by userId Set).
 *   - dispatchNotificationEvent recipients array 1 호출 (전체 broadcast).
 *   - sendPushNotification 은 single userId 라 for-loop 으로 multi-call.
 *
 * canonical truth lock:
 *   - §11.250a INVENTORY_LOW + §11.250cd ORDER_SHIPPED/DELIVERED 패턴 보존.
 *   - dispatchNotificationEvent / sendPushNotification 시그니처 변경 0.
 *   - OrganizationMember.role enum (VIEWER/REQUESTER/APPROVER/ADMIN/OWNER) 보존.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function safeRead(p: string): string {
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

const INV_ROUTE_PATH = resolve(
  __dirname,
  "../../app/api/inventory/[id]/route.ts",
);
const ORD_ROUTE_PATH = resolve(
  __dirname,
  "../../app/api/admin/orders/[id]/status/route.ts",
);

const invRoute = safeRead(INV_ROUTE_PATH);
const ordRoute = safeRead(ORD_ROUTE_PATH);

describe("§11.250acd-2 #1 — inventory INVENTORY_LOW org broadcast", () => {
  it("organizationMember findMany 호출 (org broadcast)", () => {
    expect(invRoute).toMatch(/organizationMember\.findMany/);
  });

  it("role OWNER + ADMIN filter (의사결정 권한자)", () => {
    expect(invRoute).toMatch(/role[\s\S]{0,200}OWNER/);
    expect(invRoute).toMatch(/role[\s\S]{0,200}ADMIN/);
  });

  it("INVENTORY_LOW recipients array (single + broadcast 합산)", () => {
    expect(invRoute).toMatch(/INVENTORY_LOW[\s\S]{0,1500}recipients[\s\S]{0,500}\[/);
  });

  it("push for-loop (multi-recipient)", () => {
    // for-of 또는 forEach 로 sendPushNotification 다중 호출
    expect(invRoute).toMatch(/(for\s*\([\s\S]{0,150}of\s+|\.forEach)[\s\S]{0,500}sendPushNotification/);
  });

  it("§11.250acd-2 trace marker (inventory)", () => {
    expect(invRoute).toMatch(/§11\.250acd-2|11\.250acd-2|§11\.250a-2|11\.250a-2/);
  });
});

describe("§11.250acd-2 #2 — orders ORDER_SHIPPED/DELIVERED org broadcast", () => {
  it("organizationMember findMany 호출 (org broadcast)", () => {
    expect(ordRoute).toMatch(/organizationMember\.findMany/);
  });

  it("role OWNER + ADMIN filter", () => {
    expect(ordRoute).toMatch(/role[\s\S]{0,200}OWNER/);
    expect(ordRoute).toMatch(/role[\s\S]{0,200}ADMIN/);
  });

  it("ORDER_SHIPPED recipients array (broadcast)", () => {
    expect(ordRoute).toMatch(/ORDER_SHIPPED[\s\S]{0,1500}recipients[\s\S]{0,500}\[/);
  });

  it("ORDER_DELIVERED recipients array (broadcast)", () => {
    expect(ordRoute).toMatch(/ORDER_DELIVERED[\s\S]{0,1500}recipients[\s\S]{0,500}\[/);
  });

  it("push for-loop (multi-recipient)", () => {
    expect(ordRoute).toMatch(/(for\s*\([\s\S]{0,150}of\s+|\.forEach)[\s\S]{0,500}sendPushNotification/);
  });

  it("§11.250acd-2 trace marker (orders)", () => {
    expect(ordRoute).toMatch(/§11\.250acd-2|11\.250acd-2|§11\.250cd-2|11\.250cd-2/);
  });
});

describe("§11.250acd-2 #3 — recipients dedup (단일 + 다중)", () => {
  it("inventory userId Set dedup pattern", () => {
    expect(invRoute).toMatch(/(Set|userIds|recipientUserIds|dedup)/);
  });

  it("orders userId Set dedup pattern", () => {
    expect(ordRoute).toMatch(/(Set|userIds|recipientUserIds|dedup)/);
  });
});

describe("§11.250acd-2 #4 — graceful try/catch 보존", () => {
  it("inventory org broadcast try/catch 보존", () => {
    expect(invRoute).toMatch(/try\s*\{[\s\S]{0,2500}organizationMember\.findMany[\s\S]{0,2500}\}\s*catch/);
  });

  it("orders org broadcast try/catch 보존", () => {
    expect(ordRoute).toMatch(/try\s*\{[\s\S]{0,2500}organizationMember\.findMany[\s\S]{0,2500}\}\s*catch/);
  });
});

describe("§11.250acd-2 #5 — 기존 §11.250a + §11.250cd flow 보존 (invariant)", () => {
  it("inventory INVENTORY_LOW eventType literal 보존", () => {
    expect(invRoute).toMatch(/eventType[:\s]+["']INVENTORY_LOW["']/);
  });

  it("inventory transition detection 보존", () => {
    expect(invRoute).toMatch(/safetyStock/);
    expect(invRoute).toMatch(/prevQty|prevQuantity|existingInventory\.currentQuantity/);
  });

  it("orders ORDER_SHIPPED + ORDER_DELIVERED eventType literal 보존", () => {
    expect(ordRoute).toMatch(/eventType[:\s]+["']ORDER_SHIPPED["']/);
    expect(ordRoute).toMatch(/eventType[:\s]+["']ORDER_DELIVERED["']/);
  });

  it("orders STATUS_TRANSITIONS 보존", () => {
    expect(ordRoute).toMatch(/STATUS_TRANSITIONS/);
  });

  it("inventory entityType INVENTORY + entityId params.id 보존", () => {
    expect(invRoute).toMatch(/INVENTORY_LOW[\s\S]{0,500}entityType[:\s]+["']INVENTORY["']/);
  });

  it("orders entityType ORDER 보존 (양쪽)", () => {
    expect(ordRoute).toMatch(/ORDER_SHIPPED[\s\S]{0,500}entityType[:\s]+["']ORDER["']/);
    expect(ordRoute).toMatch(/ORDER_DELIVERED[\s\S]{0,500}entityType[:\s]+["']ORDER["']/);
  });
});
