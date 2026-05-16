/**
 * §11.250b #inventory-expiring-notification-dispatch — dead path audit P0 마지막 cluster.
 *
 * 호영님 spec: detectInventoryIssues 안 expiry loop (line 125-133) 안 dispatch + push.
 *   기존 cron infra reuse (/api/cron/inventory-check 매일 0 8 * * *).
 *   schema 0 / migration 0 / cron 신규 0 = minimum diff.
 *
 * Strategy:
 *   - findExpiryCandidates 이미 expiry threshold (30일 within) 처리.
 *   - createExpiryAction 가 AiActionItem 중복 방지 — `created` flag.
 *   - `created === true` 인 신규 expiry 만 dispatch + push (중복 방지).
 *   - dispatchNotificationEvent INVENTORY_EXPIRING + entityType "INVENTORY".
 *   - sendPushNotification(candidate.userId, { type "expiry_warning", ... }).
 *   - guest expiry (userId null) skip — multi-recipient org broadcast 별도 cluster.
 *
 * canonical truth lock:
 *   - INVENTORY_EXPIRING event-type 이미 등록 (entityType "INVENTORY",
 *     defaultActions [IN_APP, QUEUE_ITEM]).
 *   - mobile notifications.ts ROUTE_MAP.expiry_warning.detail → `/inventory/${id}`.
 *   - §11.229b-5/-6 + §11.250a/cd dispatch + push 1:1 패턴 정확 reuse.
 *   - 기존 findExpiryCandidates + createExpiryAction + AiActionItem 보존.
 *   - 기존 cron /api/cron/inventory-check 보존 (0 8 * * *).
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function safeRead(p: string): string {
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

const DETECTOR_PATH = resolve(
  __dirname,
  "../../../lib/ai/inventory-restock-detector.ts",
);
const EVENT_TYPES_PATH = resolve(
  __dirname,
  "../../../lib/notifications/event-types.ts",
);
const MOBILE_NOTIF_PATH = resolve(
  __dirname,
  "../../../../../mobile/lib/notifications.ts",
);
const CRON_PATH = resolve(
  __dirname,
  "../../../app/api/cron/inventory-check/route.ts",
);

const detector = safeRead(DETECTOR_PATH);
const eventTypes = safeRead(EVENT_TYPES_PATH);
const mobileNotif = safeRead(MOBILE_NOTIF_PATH);
const cron = safeRead(CRON_PATH);

describe("§11.250b #1 — detector INVENTORY_EXPIRING dispatch", () => {
  it("dispatchNotificationEvent import 추가", () => {
    expect(detector).toMatch(/dispatchNotificationEvent/);
    expect(detector).toMatch(/from\s+["']@\/lib\/notifications\/event-dispatcher["']/);
  });

  it("INVENTORY_EXPIRING eventType 호출 (literal)", () => {
    expect(detector).toMatch(/eventType[:\s]+["']INVENTORY_EXPIRING["']/);
  });

  it("entityType INVENTORY 정합 (INVENTORY_EXPIRING block)", () => {
    expect(detector).toMatch(/INVENTORY_EXPIRING[\s\S]{0,800}entityType[:\s]+["']INVENTORY["']/);
  });

  it("entityId candidate.inventoryId forward", () => {
    expect(detector).toMatch(/dispatchNotificationEvent[\s\S]{0,800}entityId[:\s]+(candidate\.inventoryId|inventoryId)/);
  });

  it("recipients candidate.userId (single recipient minimum scope)", () => {
    expect(detector).toMatch(/dispatchNotificationEvent[\s\S]{0,1200}recipients[\s\S]{0,500}userId/);
  });

  it("metadata productName + expiryDate + daysUntilExpiry 포함", () => {
    expect(detector).toMatch(/dispatchNotificationEvent[\s\S]{0,1800}metadata[\s\S]{0,500}productName/);
    expect(detector).toMatch(/dispatchNotificationEvent[\s\S]{0,1800}metadata[\s\S]{0,500}(expiryDate|daysUntilExpiry)/);
  });
});

describe("§11.250b #2 — push notification (expiry_warning type)", () => {
  it("sendPushNotification import 추가", () => {
    expect(detector).toMatch(/sendPushNotification/);
    expect(detector).toMatch(/from\s+["']@\/lib\/notifications\/push-sender["']/);
  });

  it("sendPushNotification 호출 — candidate.userId forward", () => {
    expect(detector).toMatch(/sendPushNotification\s*\(\s*(\w+\.)*userId/);
  });

  it("push payload type 'expiry_warning' (mobile ROUTE_MAP 매핑)", () => {
    expect(detector).toMatch(/sendPushNotification[\s\S]{0,500}type[:\s]+["']expiry_warning["']/);
  });

  it("push payload id = candidate.inventoryId (deep-link 위함)", () => {
    expect(detector).toMatch(/sendPushNotification[\s\S]{0,800}id[:\s]+(candidate\.inventoryId|inventoryId)/);
  });

  it("push title 한국어 (유효기한 또는 만료)", () => {
    expect(detector).toMatch(/sendPushNotification[\s\S]{0,1500}title[\s\S]{0,200}(유효기한|만료|폐기)/);
  });
});

describe("§11.250b #3 — 중복 방지 (created flag check)", () => {
  it("created === true (또는 if (created)) 분기로 dispatch + push 호출", () => {
    expect(detector).toMatch(/if\s*\(\s*created\s*\)/);
  });

  it("candidate.userId null check (guest skip)", () => {
    expect(detector).toMatch(/candidate\.userId/);
  });
});

describe("§11.250b #4 — graceful try/catch (cron 정합 보호)", () => {
  it("dispatchNotificationEvent try/catch 래핑", () => {
    expect(detector).toMatch(/try\s*\{[\s\S]{0,2000}dispatchNotificationEvent[\s\S]{0,2000}\}\s*catch/);
  });

  it("sendPushNotification try/catch 래핑", () => {
    expect(detector).toMatch(/try\s*\{[\s\S]{0,2000}sendPushNotification[\s\S]{0,2000}\}\s*catch/);
  });
});

describe("§11.250b #5 — 기존 detector flow 보존 (invariant)", () => {
  it("detectInventoryIssues 시그니처 보존", () => {
    expect(detector).toMatch(/export\s+async\s+function\s+detectInventoryIssues/);
  });

  it("findExpiryCandidates 보존", () => {
    expect(detector).toMatch(/findExpiryCandidates/);
  });

  it("createExpiryAction 보존", () => {
    expect(detector).toMatch(/createExpiryAction/);
  });

  it("findRestockCandidates + createRestockAction 보존", () => {
    expect(detector).toMatch(/findRestockCandidates/);
    expect(detector).toMatch(/createRestockAction/);
  });

  it("EXPIRY_WARNING_DAYS 보존 (30일)", () => {
    expect(detector).toMatch(/EXPIRY_WARNING_DAYS/);
  });
});

describe("§11.250b #6 — invariant 보존 (cross-stack)", () => {
  it("INVENTORY_EXPIRING event-type 정의 보존 (entityType INVENTORY)", () => {
    expect(eventTypes).toMatch(/INVENTORY_EXPIRING[\s\S]{0,400}entityType[:\s]+["']INVENTORY["']/);
  });

  it("INVENTORY_EXPIRING defaultActions IN_APP + QUEUE_ITEM 보존", () => {
    expect(eventTypes).toMatch(/INVENTORY_EXPIRING[\s\S]{0,500}IN_APP/);
    expect(eventTypes).toMatch(/INVENTORY_EXPIRING[\s\S]{0,500}QUEUE_ITEM/);
  });

  it("mobile expiry_warning NotificationType 보존", () => {
    expect(mobileNotif).toMatch(/["']expiry_warning["']/);
  });

  it("mobile ROUTE_MAP expiry_warning detail → /inventory/{id} 보존", () => {
    expect(mobileNotif).toMatch(/expiry_warning[\s\S]{0,300}\/inventory\/\$\{id\}/);
  });

  it("cron /api/cron/inventory-check 보존 (기존 infra)", () => {
    expect(cron).toMatch(/detectInventoryIssues/);
    expect(cron).toMatch(/export\s+async\s+function\s+GET/);
  });

  it("§11.250b trace marker", () => {
    expect(detector).toMatch(/§11\.250b|11\.250b/);
  });
});
