/**
 * §11.250e #quote-expired-notification-dispatch — P1 두번째 cluster (QUOTE_EXPIRED).
 *
 * 호영님 spec: Quote.validUntil < now 인 quote 매일 cron check → dispatch + push.
 *   recipient = quote.userId. mobile `quote` NotificationType reuse → /quotes/{id}.
 *   QuoteStatus EXPIRED 신규 0 — notification only scope. 중복 방지 = NotificationEvent.findFirst.
 *
 * Strategy:
 *   - NEW cron `/api/cron/quote-expiry-check` (§11.250b inventory-check 패턴 reuse).
 *   - NEW helper `quote-expiry-detector.ts` — Quote.validUntil < now + NotificationEvent 중복 차단.
 *   - vercel.json crons 항목 추가 — 매일 오전 10시 (`0 10 * * *`).
 *   - §11.229b-5/-6 + §11.250a/cd/b/g 패턴 정확 reuse.
 *
 * canonical truth lock:
 *   - QUOTE_EXPIRED event-type 이미 등록 (entityType "QUOTE", defaultActions [IN_APP, EMAIL_DRAFT]).
 *   - mobile ROUTE_MAP.quote.detail → /quotes/{id} (변경 0).
 *   - Quote.validUntil DateTime? scalar 보존.
 *   - QuoteStatus enum 변경 0 (EXPIRED 신규 0 — 별도 cluster).
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function safeRead(p: string): string {
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

const CRON_PATH = resolve(
  __dirname,
  "../../../app/api/cron/quote-expiry-check/route.ts",
);
const DETECTOR_PATH = resolve(
  __dirname,
  "../../../lib/ai/quote-expiry-detector.ts",
);
const VERCEL_JSON_PATH = resolve(
  __dirname,
  "../../../../vercel.json",
);
const EVENT_TYPES_PATH = resolve(
  __dirname,
  "../../../lib/notifications/event-types.ts",
);
const MOBILE_NOTIF_PATH = resolve(
  __dirname,
  "../../../../../mobile/lib/notifications.ts",
);

const cron = safeRead(CRON_PATH);
const detector = safeRead(DETECTOR_PATH);
const vercelJson = safeRead(VERCEL_JSON_PATH);
const eventTypes = safeRead(EVENT_TYPES_PATH);
const mobileNotif = safeRead(MOBILE_NOTIF_PATH);

describe("§11.250e #1 — cron route (§11.250b 패턴 reuse)", () => {
  it("cron route 파일 존재", () => {
    expect(cron.length).toBeGreaterThan(0);
  });

  it("GET handler export", () => {
    expect(cron).toMatch(/export\s+async\s+function\s+GET/);
  });

  it("CRON_SECRET / x-vercel-cron-signature 인증", () => {
    expect(cron).toMatch(/CRON_SECRET/);
    expect(cron).toMatch(/x-vercel-cron-signature/);
  });

  it("detectExpiredQuotes 호출", () => {
    expect(cron).toMatch(/detectExpiredQuotes/);
  });

  it("§11.250e trace marker", () => {
    expect(cron).toMatch(/§11\.250e|11\.250e/);
  });
});

describe("§11.250e #2 — detector helper", () => {
  it("detector 파일 존재", () => {
    expect(detector.length).toBeGreaterThan(0);
  });

  it("detectExpiredQuotes export", () => {
    expect(detector).toMatch(/export\s+async\s+function\s+detectExpiredQuotes/);
  });

  it("Quote.findMany validUntil < now 검색", () => {
    expect(detector).toMatch(/quote\.findMany/);
    expect(detector).toMatch(/validUntil/);
  });
});

describe("§11.250e #3 — INVENTORY_LOW/EXPIRING 패턴 reuse (dispatch + push)", () => {
  it("dispatchNotificationEvent import", () => {
    expect(detector).toMatch(/dispatchNotificationEvent/);
    expect(detector).toMatch(/from\s+["']@\/lib\/notifications\/event-dispatcher["']/);
  });

  it("QUOTE_EXPIRED eventType 호출 (literal)", () => {
    expect(detector).toMatch(/eventType[:\s]+["']QUOTE_EXPIRED["']/);
  });

  it("entityType QUOTE 정합", () => {
    expect(detector).toMatch(/dispatchNotificationEvent[\s\S]{0,800}entityType[:\s]+["']QUOTE["']/);
  });

  it("entityId quote.id forward", () => {
    expect(detector).toMatch(/dispatchNotificationEvent[\s\S]{0,800}entityId[:\s]+(quote|candidate|q)\.id/);
  });

  it("sendPushNotification import + 호출", () => {
    expect(detector).toMatch(/sendPushNotification/);
    expect(detector).toMatch(/from\s+["']@\/lib\/notifications\/push-sender["']/);
  });

  it("push payload type 'quote' (mobile ROUTE_MAP 매핑)", () => {
    expect(detector).toMatch(/sendPushNotification[\s\S]{0,500}type[:\s]+["']quote["']/);
  });

  it("push title 한국어 (만료 또는 견적)", () => {
    expect(detector).toMatch(/sendPushNotification[\s\S]{0,1500}title[\s\S]{0,200}(만료|견적)/);
  });
});

describe("§11.250e #4 — 중복 방지 + guest skip + graceful", () => {
  it("NotificationEvent.findFirst 중복 검사", () => {
    expect(detector).toMatch(/notificationEvent\.findFirst/);
  });

  it("quote.userId null check (guest skip)", () => {
    expect(detector).toMatch(/(quote|candidate|q)\.userId/);
  });

  it("dispatch try/catch graceful", () => {
    expect(detector).toMatch(/try\s*\{[\s\S]{0,2000}dispatchNotificationEvent[\s\S]{0,2000}\}\s*catch/);
  });

  it("push try/catch graceful", () => {
    expect(detector).toMatch(/try\s*\{[\s\S]{0,2000}sendPushNotification[\s\S]{0,2000}\}\s*catch/);
  });
});

describe("§11.250e #5 — vercel.json cron entry", () => {
  it("vercel.json crons 안 quote-expiry-check 경로 등록", () => {
    expect(vercelJson).toMatch(/\/api\/cron\/quote-expiry-check/);
  });

  it("vercel.json valid JSON", () => {
    expect(() => JSON.parse(vercelJson)).not.toThrow();
  });

  it("crons 스케줄 daily (0 N * * *)", () => {
    expect(vercelJson).toMatch(/quote-expiry-check[\s\S]{0,200}"schedule":\s*"0\s+\d+\s+\*\s+\*\s+\*"/);
  });
});

describe("§11.250e #6 — invariant 보존 (cross-stack)", () => {
  it("QUOTE_EXPIRED event-type 정의 보존 (entityType QUOTE)", () => {
    expect(eventTypes).toMatch(/QUOTE_EXPIRED[\s\S]{0,400}entityType[:\s]+["']QUOTE["']/);
  });

  it("mobile quote NotificationType 보존", () => {
    expect(mobileNotif).toMatch(/["']quote["']/);
  });

  it("mobile ROUTE_MAP.quote detail → /quotes/{id} 보존", () => {
    expect(mobileNotif).toMatch(/quote:\s*\{[\s\S]{0,300}\/quotes\/\$\{id\}/);
  });

  it("vercel.json 기존 crons (dashboard-snapshot + user-soft-delete-purge) 보존", () => {
    expect(vercelJson).toMatch(/dashboard-snapshot/);
    expect(vercelJson).toMatch(/user-soft-delete-purge/);
  });
});
