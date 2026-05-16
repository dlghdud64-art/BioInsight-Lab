/**
 * §11.250g #compare-completed-notification-dispatch — P1 첫 cluster (COMPARE_COMPLETED).
 *
 * 호영님 spec: compare insight 생성 완료 (POST /api/compare-sessions/[id]/insight)
 *   시점에 dispatch + push. recipient = compareSession.userId.
 *   pipeline 비동기 작업 결과 알림.
 *
 * Strategy:
 *   - insight route 안 compareSession.update aiInsight 직후 dispatch + push.
 *   - dispatchNotificationEvent COMPARE_COMPLETED + entityType "COMPARE".
 *   - sendPushNotification(compareSession.userId, { type "compare", id, ... }).
 *   - mobile notifications.ts 안 compare NotificationType 신규 entry + ROUTE_MAP.compare.detail.
 *
 * canonical truth lock:
 *   - COMPARE_COMPLETED event-type 이미 등록 (entityType "COMPARE",
 *     defaultActions [IN_APP, QUEUE_ITEM]).
 *   - 기존 generateCompareInsight + compareSession.update + createActivityLog 보존.
 *   - §11.229b-5/-6 + §11.250a/cd/b 패턴 정확 reuse.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function safeRead(p: string): string {
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

const ROUTE_PATH = resolve(
  __dirname,
  "../../../app/api/compare-sessions/[id]/insight/route.ts",
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

describe("§11.250g #1 — insight route COMPARE_COMPLETED dispatch", () => {
  it("dispatchNotificationEvent import 추가", () => {
    expect(route).toMatch(/dispatchNotificationEvent/);
    expect(route).toMatch(/from\s+["']@\/lib\/notifications\/event-dispatcher["']/);
  });

  it("COMPARE_COMPLETED eventType 호출 (literal)", () => {
    expect(route).toMatch(/eventType[:\s]+["']COMPARE_COMPLETED["']/);
  });

  it("entityType COMPARE 정합", () => {
    expect(route).toMatch(/dispatchNotificationEvent[\s\S]{0,800}entityType[:\s]+["']COMPARE["']/);
  });

  it("entityId compareSession.id forward", () => {
    expect(route).toMatch(/dispatchNotificationEvent[\s\S]{0,800}entityId[:\s]+(id|compareSession\.id)/);
  });

  it("recipients compareSession.userId forward", () => {
    expect(route).toMatch(/dispatchNotificationEvent[\s\S]{0,1200}recipients[\s\S]{0,500}userId/);
  });
});

describe("§11.250g #2 — push notification (compare type)", () => {
  it("sendPushNotification import 추가", () => {
    expect(route).toMatch(/sendPushNotification/);
    expect(route).toMatch(/from\s+["']@\/lib\/notifications\/push-sender["']/);
  });

  it("sendPushNotification 호출 — compareSession.userId forward", () => {
    expect(route).toMatch(/sendPushNotification\s*\(\s*(\w+\.)*userId/);
  });

  it("push payload type 'compare' (mobile ROUTE_MAP 매핑)", () => {
    expect(route).toMatch(/sendPushNotification[\s\S]{0,500}type[:\s]+["']compare["']/);
  });

  it("push title 한국어 (비교 또는 분석)", () => {
    expect(route).toMatch(/sendPushNotification[\s\S]{0,1500}title[\s\S]{0,200}(비교|분석)/);
  });
});

describe("§11.250g #3 — graceful try/catch (mutation 정합 보호)", () => {
  it("dispatchNotificationEvent try/catch 래핑", () => {
    expect(route).toMatch(/try\s*\{[\s\S]{0,1500}dispatchNotificationEvent[\s\S]{0,1500}\}\s*catch/);
  });

  it("sendPushNotification try/catch 래핑", () => {
    expect(route).toMatch(/try\s*\{[\s\S]{0,1500}sendPushNotification[\s\S]{0,1500}\}\s*catch/);
  });

  it("compareSession.userId null check (guest skip)", () => {
    expect(route).toMatch(/compareSession\.userId/);
  });
});

describe("§11.250g #4 — 기존 insight flow 보존 (invariant)", () => {
  it("POST 시그니처 보존", () => {
    expect(route).toMatch(/export\s+async\s+function\s+POST/);
  });

  it("generateCompareInsight 보존", () => {
    expect(route).toMatch(/generateCompareInsight/);
  });

  it("compareSession.update aiInsight 보존", () => {
    expect(route).toMatch(/compareSession\.update/);
    expect(route).toMatch(/aiInsight/);
  });

  it("createActivityLog AI_TASK_CREATED 보존", () => {
    expect(route).toMatch(/createActivityLog/);
    expect(route).toMatch(/AI_TASK_CREATED/);
  });
});

describe("§11.250g #5 — mobile compare NotificationType 신규", () => {
  it("mobile NotificationType union 안 'compare' 추가", () => {
    expect(mobileNotif).toMatch(/["']compare["']/);
  });

  it("mobile ROUTE_MAP.compare entry 추가", () => {
    expect(mobileNotif).toMatch(/compare:\s*\{[\s\S]{0,300}(detail|fallback)/);
  });
});

describe("§11.250g #6 — invariant 보존 (cross-stack)", () => {
  it("COMPARE_COMPLETED event-type 정의 보존 (entityType COMPARE)", () => {
    expect(eventTypes).toMatch(/COMPARE_COMPLETED[\s\S]{0,400}entityType[:\s]+["']COMPARE["']/);
  });

  it("COMPARE_COMPLETED defaultActions IN_APP + QUEUE_ITEM 보존", () => {
    expect(eventTypes).toMatch(/COMPARE_COMPLETED[\s\S]{0,500}IN_APP/);
    expect(eventTypes).toMatch(/COMPARE_COMPLETED[\s\S]{0,500}QUEUE_ITEM/);
  });

  it("§11.250g trace marker", () => {
    expect(route).toMatch(/§11\.250g|11\.250g/);
  });
});
