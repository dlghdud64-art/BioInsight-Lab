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

  it("recipients = 소유자 + 조직 OWNER/ADMIN 집합(중복 제거)이 그대로 dispatch 로 간다", () => {
    /* 🛑 2026-09-16 §sentinel-inversion 승계 — 옛 단언은 `dispatchNotificationEvent` 뒤
     *   1200자 창에서 `recipients … userId` 를 찾았다. §11.250acd-2 에서 수신자가 Set 으로
     *   먼저 만들어지고 `recipients` 변수를 **경유**해 전달되도록 바뀌며 창 밖으로 나갔다.
     *   명제는 "소유자 + 조직 관리자 전원이 받는다" 이므로 그 관계를 핀한다. */
    expect(detector).toMatch(/const recipientUserIds = new Set<string>\(\)/);
    expect(detector).toMatch(/if \(candidate\.userId\) recipientUserIds\.add\(candidate\.userId\)/);
    expect(detector).toMatch(/role: \{ in: \["OWNER", "ADMIN"\] \}[\s\S]{0,400}?recipientUserIds\.add\(m\.userId\)/);
    expect(detector).toMatch(/const recipients = Array\.from\(recipientUserIds\)\.map\(\((\w+)\) => \(\{ userId: \1 \}\)\)/);
    expect(detector).toMatch(/dispatchNotificationEvent\(\{[\s\S]{0,800}?recipients\b/);
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

  it("sendPushNotification 호출 — 수신자 전원에게 전달(for-of)", () => {
    /* 🛑 2026-09-16 §sentinel-inversion 승계 — 옛 단언은 단일 수신자 시절의
     *   `x.userId` 형태를 박았다. §11.250acd-2 에서 multi-recipient for-of 로 바뀌며
     *   인자가 recipientUserId 가 되어 RED 로 남았고, 그동안 이 축은 무방비였다.
     *   명제는 "수신자 전원에게 간다" 이므로, 루프 변수가 그대로 전달되는 **관계**를 핀한다
     *   (역참조 \1 — 변수명이 바뀌어도 관계가 유지되면 GREEN). */
    expect(detector).toMatch(
      /for \(const (\w+) of recipientUserIds\)[\s\S]{0,400}?sendPushNotification\s*\(\s*\1\b/,
    );
    /* ⚠️ 범위: 위 단언은 **한 쌍**만 확인한다. 한 파일에 푸시 호출이 여러 곳이면
     *   한 곳이 회귀해도 통과한다(orders/status 는 2곳). 그래서 옛 단일 수신자 형태로의
     *   회귀를 아래에서 따로 막는다. 이 둘로도 "루프 변수가 아닌 다른 이름"으로의
     *   회귀까지는 못 잡는다 — 그건 파서가 필요하고, 여기서는 범위를 밝히고 멈춘다. */
    expect(detector).not.toMatch(/sendPushNotification\s*\(\s*\w+\.userId/);
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
