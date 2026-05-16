/**
 * §11.229b-5 #vendor-replied-notification-dispatch — 호영님 §11.229b cluster 자연 후속.
 *
 * 호영님 spec: vendor 가 quote response 제출 시 견적 요청자 (quote.userId) 에게
 *   VENDOR_REPLIED inApp notification 자동 dispatch. mobile NotificationsScreen
 *   에서 tap 시 buildNotificationHref 가 entityType "QUOTE" → /quotes/{id}
 *   deep-link 자동 진입.
 *
 * Strategy:
 *   - vendor response POST route (/api/vendor/quotes/[quoteId]/response) 에
 *     dispatchNotificationEvent 호출 추가 — eventType VENDOR_REPLIED,
 *     entityType QUOTE, entityId quoteId, recipients [{ userId: quote.userId,
 *     email: quote.user.email }], metadata { quoteTitle, vendorName, totalPrice,
 *     currency }.
 *   - 기존 createQuoteResponse + sendEmail + createActivityLogServer 모두 보존.
 *   - dispatchNotificationEvent 는 try/catch graceful — mutation 정합 유지.
 *
 * canonical truth lock:
 *   - VENDOR_REPLIED event-type 이미 등록됨 (event-types.ts:41) —
 *     defaultActions [IN_APP, QUEUE_ITEM], entityType QUOTE.
 *   - mobile event-category-map.ts buildNotificationHref 안 QUOTE entityType
 *     → `/quotes/{encodeURIComponent(entityId)}` 자동 매핑 — mobile 변경 0.
 *   - §11.209d-notification-inapp-server-wiring PURCHASE_APPROVAL_REQUESTED
 *     패턴 정확 reuse.
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
const MOBILE_HELPER_PATH = resolve(
  __dirname,
  "../../../../../mobile/lib/event-category-map.ts",
);
const EVENT_TYPES_PATH = resolve(
  __dirname,
  "../../../lib/notifications/event-types.ts",
);

const route = safeRead(ROUTE_PATH);
const mobileHelper = safeRead(MOBILE_HELPER_PATH);
const eventTypes = safeRead(EVENT_TYPES_PATH);

describe("§11.229b-5 #1 — vendor response route VENDOR_REPLIED dispatch", () => {
  it("dispatchNotificationEvent import 추가", () => {
    expect(route).toMatch(/dispatchNotificationEvent/);
    expect(route).toMatch(/from\s+["']@\/lib\/notifications\/event-dispatcher["']/);
  });

  it("VENDOR_REPLIED eventType 호출", () => {
    expect(route).toMatch(/eventType[:\s]+["']VENDOR_REPLIED["']/);
  });

  it("entityType QUOTE 정합", () => {
    expect(route).toMatch(/dispatchNotificationEvent[\s\S]{0,500}entityType[:\s]+["']QUOTE["']/);
  });

  it("entityId quoteId forward", () => {
    expect(route).toMatch(/dispatchNotificationEvent[\s\S]{0,500}entityId[:\s]+quoteId/);
  });

  it("recipients quote.userId / quote.user.email forward (견적 요청자)", () => {
    expect(route).toMatch(/recipients[\s\S]{0,300}quote[\s\S]{0,50}user(Id|\.id)/);
  });

  it("metadata 안 quoteTitle / vendorName 포함", () => {
    expect(route).toMatch(/metadata[\s\S]{0,400}quoteTitle/);
    expect(route).toMatch(/metadata[\s\S]{0,400}vendorName/);
  });
});

describe("§11.229b-5 #2 — graceful try/catch (mutation 정합 보호)", () => {
  it("dispatchNotificationEvent try/catch 래핑", () => {
    expect(route).toMatch(/try\s*\{[\s\S]{0,800}dispatchNotificationEvent[\s\S]{0,800}\}\s*catch/);
  });

  it("catch 안 console.error 또는 fallback log", () => {
    expect(route).toMatch(/dispatchNotificationEvent[\s\S]{0,800}\}\s*catch[\s\S]{0,200}console\.(error|warn|log)/);
  });
});

describe("§11.229b-5 #3 — 기존 mutation flow 보존 (invariant)", () => {
  it("createQuoteResponse 호출 보존", () => {
    expect(route).toMatch(/createQuoteResponse/);
  });

  it("sendEmail (generateQuoteResponseEmail) 보존", () => {
    expect(route).toMatch(/sendEmail/);
    expect(route).toMatch(/generateQuoteResponseEmail/);
  });

  it("createActivityLogServer (QUOTE_CREATED) 보존", () => {
    expect(route).toMatch(/createActivityLogServer/);
    expect(route).toMatch(/QUOTE_CREATED/);
  });

  it("SUPPLIER role guard 보존", () => {
    expect(route).toMatch(/SUPPLIER/);
  });

  it("quote.user.email lookup 보존 (이메일용)", () => {
    expect(route).toMatch(/quote[\s\S]{0,100}user[\s\S]{0,200}email/);
  });
});

describe("§11.229b-5 #4 — invariant 보존 (cross-stack)", () => {
  it("VENDOR_REPLIED event-type 정의 보존 (entityType QUOTE)", () => {
    expect(eventTypes).toMatch(/VENDOR_REPLIED[\s\S]{0,200}entityType[:\s]+["']QUOTE["']/);
  });

  it("VENDOR_REPLIED defaultActions IN_APP + QUEUE_ITEM 보존", () => {
    expect(eventTypes).toMatch(/VENDOR_REPLIED[\s\S]{0,400}IN_APP/);
    expect(eventTypes).toMatch(/VENDOR_REPLIED[\s\S]{0,400}QUEUE_ITEM/);
  });

  it("mobile buildNotificationHref QUOTE → /quotes/{id} 보존", () => {
    expect(mobileHelper).toMatch(/case\s+["']QUOTE["'][\s\S]{0,300}\/quotes\//);
  });

  it("mobile eventTypeToCategory VENDOR_REPLIED 보존", () => {
    expect(mobileHelper).toMatch(/VENDOR_REPLIED/);
  });

  it("§11.229b cluster (b/b-2/b-3/b-4) lineage 보존 — POST handler 시그니처", () => {
    expect(route).toMatch(/export\s+async\s+function\s+POST/);
  });

  it("§11.229b-5 trace marker", () => {
    expect(route).toMatch(/§11\.229b-5|11\.229b-5/);
  });
});
