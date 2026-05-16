/**
 * §11.229b-6 #vendor-replied-push-notification — 호영님 §11.229b-5 자연 후속.
 *
 * 호영님 spec: §11.229b-5 inApp notification 위에 Expo OS-level push 추가.
 *   3 채널 (email + inApp + OS push) — 모바일 background 에서도 견적 요청자
 *   가 vendor 응답 즉시 인지.
 *
 * Strategy:
 *   - vendor response POST route 에 sendPushNotification 호출 추가.
 *   - dispatchNotificationEvent (§11.229b-5) 직후 호출 — 두 best-effort
 *     모두 mutation 정합 보호.
 *   - payload.type = "quote_response" (mobile ROUTE_MAP 안 등록됨,
 *     /quotes/${id} fallback /(tabs)/quotes 자동 매핑).
 *   - payload.id = quoteId → mobile addNotificationResponseReceivedListener
 *     handler 가 router.push(/quotes/{id}) deep-link.
 *
 * canonical truth lock:
 *   - sendPushNotification(userId, payload) 시그니처 보존.
 *   - quote_response NotificationType 이미 mobile 등록됨 (notifications.ts:25).
 *   - ROUTE_MAP.quote_response.detail = /quotes/{id} (mobile 변경 0).
 *   - §11.229b-5 dispatchNotificationEvent 보존 (양립 — inApp + push).
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function safeRead(p: string): string {
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

const ROUTE_PATH = resolve(
  __dirname,
  "../../../app/api/vendor/quotes/[quoteId]/response/route.ts",
);
const MOBILE_NOTIF_PATH = resolve(
  __dirname,
  "../../../../../mobile/lib/notifications.ts",
);
const PUSH_SENDER_PATH = resolve(
  __dirname,
  "../../../lib/notifications/push-sender.ts",
);

const route = safeRead(ROUTE_PATH);
const mobileNotif = safeRead(MOBILE_NOTIF_PATH);
const pushSender = safeRead(PUSH_SENDER_PATH);

describe("§11.229b-6 #1 — vendor response route push notification", () => {
  it("sendPushNotification import 추가", () => {
    expect(route).toMatch(/sendPushNotification/);
    expect(route).toMatch(/from\s+["']@\/lib\/notifications\/push-sender["']/);
  });

  it("sendPushNotification 호출 — quote.userId forward", () => {
    expect(route).toMatch(/sendPushNotification\s*\(\s*quote(\.userId|\?\.userId)/);
  });

  it("payload type 'quote_response' (mobile ROUTE_MAP 매핑)", () => {
    expect(route).toMatch(/sendPushNotification[\s\S]{0,500}type[:\s]+["']quote_response["']/);
  });

  it("payload id = quoteId (deep-link 위함)", () => {
    expect(route).toMatch(/sendPushNotification[\s\S]{0,500}id[:\s]+quoteId/);
  });

  it("title 한국어 (공급사 응답 또는 견적)", () => {
    expect(route).toMatch(/sendPushNotification[\s\S]{0,800}title[\s\S]{0,200}(공급사|견적)/);
  });

  it("body 안 vendor.name 또는 quote.title 포함", () => {
    expect(route).toMatch(/sendPushNotification[\s\S]{0,800}body[\s\S]{0,400}(vendor\.name|quote\.title)/);
  });
});

describe("§11.229b-6 #2 — graceful try/catch (mutation 정합 보호)", () => {
  it("sendPushNotification try/catch 래핑", () => {
    expect(route).toMatch(/try\s*\{[\s\S]{0,1000}sendPushNotification[\s\S]{0,1000}\}\s*catch/);
  });

  it("catch 안 console.error fallback", () => {
    expect(route).toMatch(/sendPushNotification[\s\S]{0,1000}\}\s*catch[\s\S]{0,200}console\.(error|warn|log)/);
  });

  it("guest quote skip — quote?.userId null check", () => {
    expect(route).toMatch(/quote\??\.userId/);
  });
});

describe("§11.229b-6 #3 — 기존 cluster 보존 (invariant)", () => {
  it("§11.229b-5 dispatchNotificationEvent 보존", () => {
    expect(route).toMatch(/dispatchNotificationEvent/);
    expect(route).toMatch(/VENDOR_REPLIED/);
  });

  it("createQuoteResponse 보존", () => {
    expect(route).toMatch(/createQuoteResponse/);
  });

  it("sendEmail (generateQuoteResponseEmail) 보존", () => {
    expect(route).toMatch(/sendEmail/);
    expect(route).toMatch(/generateQuoteResponseEmail/);
  });

  it("createActivityLogServer 보존", () => {
    expect(route).toMatch(/createActivityLogServer/);
  });

  it("SUPPLIER role guard 보존", () => {
    expect(route).toMatch(/SUPPLIER/);
  });
});

describe("§11.229b-6 #4 — cross-stack invariant 보존", () => {
  it("push-sender sendPushNotification 시그니처 보존 (userId, payload)", () => {
    expect(pushSender).toMatch(/export\s+async\s+function\s+sendPushNotification\s*\(\s*userId[:\s]+string/);
  });

  it("push-sender Device.findMany pushToken 보존", () => {
    expect(pushSender).toMatch(/db\.device\.findMany/);
    expect(pushSender).toMatch(/pushToken/);
  });

  it("mobile quote_response NotificationType 보존", () => {
    expect(mobileNotif).toMatch(/["']quote_response["']/);
  });

  it("mobile ROUTE_MAP quote_response detail → /quotes/{id} 보존", () => {
    expect(mobileNotif).toMatch(/quote_response[\s\S]{0,300}\/quotes\/\$\{id\}/);
  });

  it("§11.229b-6 trace marker", () => {
    expect(route).toMatch(/§11\.229b-6|11\.229b-6/);
  });
});
