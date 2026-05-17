/**
 * §11.250-pref-push #push-preference-filter — sendPushNotification preference filter.
 *
 * 호영님 spec: §11.250-pref (in-app filter) + §11.250-pref-ui (settings 토글) 위에
 *   mobile push 도 동일 preference 적용. 사용자 settings 안 카테고리 OFF 시
 *   in-app + mobile push 양쪽 모두 차단 (1:1 정합).
 *
 * Strategy:
 *   - preference-filter.ts 안 isUserPreferenceAllowed(userId, eventType) helper 추가
 *     (single-userId 변형 — filterRecipientsByPreference 와 같은 default true 로직).
 *   - push-sender.ts 안 sendPushNotification 시그니처에 optional `eventType` 3rd param
 *     추가. eventType 제공 시 isUserPreferenceAllowed false → 즉시 skip
 *     (devices 조회 전 → DB load 절감).
 *   - 10 caller (INVENTORY_LOW / INVENTORY_EXPIRING / ORDER_SHIPPED/DELIVERED /
 *     PURCHASE_APPROVED / BUDGET_WARNING / PURCHASE_REJECTED / COMPARE_COMPLETED /
 *     QUOTE_EXPIRED / VENDOR_REPLIED → 본 트랙은 sendPushNotification 으로
 *     모두 swap. PURCHASE_APPROVAL_REQUESTED 도 동일.) 모두 eventType 인자 추가.
 *
 * canonical truth lock:
 *   - preference-filter helper reuse (eventTypeToCategory + default true).
 *   - sendPushNotification 시그니처는 optional 추가 (기존 caller backward compat).
 *   - 10 caller 가 eventType 인자 추가 후 즉시 발효 (preference UI 토글 ↔ push 1:1).
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function safeRead(p: string): string {
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

const HELPER_PATH = resolve(
  __dirname,
  "../../../lib/notifications/preference-filter.ts",
);
const PUSH_SENDER_PATH = resolve(
  __dirname,
  "../../../lib/notifications/push-sender.ts",
);
const INVENTORY_PATCH_PATH = resolve(
  __dirname,
  "../../../app/api/inventory/[id]/route.ts",
);
const ORDER_STATUS_PATH = resolve(
  __dirname,
  "../../../app/api/admin/orders/[id]/status/route.ts",
);
const APPROVE_PATH = resolve(
  __dirname,
  "../../../app/api/request/[id]/approve/route.ts",
);
const REJECT_PATH = resolve(
  __dirname,
  "../../../app/api/request/[id]/reject/route.ts",
);
const COMPARE_INSIGHT_PATH = resolve(
  __dirname,
  "../../../app/api/compare-sessions/[id]/insight/route.ts",
);
const INVENTORY_DETECTOR_PATH = resolve(
  __dirname,
  "../../../lib/ai/inventory-restock-detector.ts",
);
const QUOTE_EXPIRY_PATH = resolve(
  __dirname,
  "../../../lib/ai/quote-expiry-detector.ts",
);
const VENDOR_RESPONSE_PATH = resolve(
  __dirname,
  "../../../app/api/vendor/quotes/[quoteId]/response/route.ts",
);
const REQUEST_APPROVAL_PATH = resolve(
  __dirname,
  "../../../app/api/work-queue/purchase-conversion/[quoteId]/request-approval/route.ts",
);

const helper = safeRead(HELPER_PATH);
const pushSender = safeRead(PUSH_SENDER_PATH);
const inventoryPatch = safeRead(INVENTORY_PATCH_PATH);
const orderStatus = safeRead(ORDER_STATUS_PATH);
const approve = safeRead(APPROVE_PATH);
const reject = safeRead(REJECT_PATH);
const compareInsight = safeRead(COMPARE_INSIGHT_PATH);
const inventoryDetector = safeRead(INVENTORY_DETECTOR_PATH);
const quoteExpiry = safeRead(QUOTE_EXPIRY_PATH);
const vendorResponse = safeRead(VENDOR_RESPONSE_PATH);
const requestApproval = safeRead(REQUEST_APPROVAL_PATH);

describe("§11.250-pref-push #1 — isUserPreferenceAllowed helper", () => {
  it("isUserPreferenceAllowed export", () => {
    expect(helper).toMatch(/export\s+async\s+function\s+isUserPreferenceAllowed/);
  });

  it("eventTypeToCategory reuse (category 매핑)", () => {
    expect(helper).toMatch(/isUserPreferenceAllowed[\s\S]{0,800}eventTypeToCategory/);
  });

  it("User.preferences 조회 (Prisma findUnique)", () => {
    expect(helper).toMatch(/isUserPreferenceAllowed[\s\S]{0,1200}db\.user\.findUnique/);
  });

  it("notificationToggles[category] 확인", () => {
    expect(helper).toMatch(/isUserPreferenceAllowed[\s\S]{0,1500}notificationToggles/);
  });

  it("default true 보존 (명시 false 만 차단)", () => {
    // 명시 false → return false. 그 외 → return true.
    expect(helper).toMatch(/isUserPreferenceAllowed[\s\S]{0,1500}===\s*false/);
  });

  it("graceful try/catch (DB fail 시 통과)", () => {
    expect(helper).toMatch(/isUserPreferenceAllowed[\s\S]{0,2000}try\s*\{[\s\S]{0,1500}\}\s*catch/);
  });
});

describe("§11.250-pref-push #2 — sendPushNotification optional eventType", () => {
  it("sendPushNotification 시그니처에 optional eventType param", () => {
    // 3rd param `eventType?: string` 추가
    expect(pushSender).toMatch(/sendPushNotification[\s\S]{0,300}eventType\?:\s*string/);
  });

  it("isUserPreferenceAllowed import (preference-filter)", () => {
    expect(pushSender).toMatch(/isUserPreferenceAllowed/);
    expect(pushSender).toMatch(/from\s+["']\.\/preference-filter["']/);
  });

  it("eventType 제공 시 isUserPreferenceAllowed 호출 + skip 분기", () => {
    // eventType truthy + allowed === false → skip
    expect(pushSender).toMatch(/eventType[\s\S]{0,500}isUserPreferenceAllowed/);
    expect(pushSender).toMatch(/skipped:\s*true/);
  });

  it("eventType 미제공 시 기존 동작 보존 (backward compat)", () => {
    // optional param + if-guard 으로 backward compat 명시.
    expect(pushSender).toMatch(/if\s*\(\s*eventType/);
  });
});

describe("§11.250-pref-push #3 — 10 caller eventType 인자 추가", () => {
  it("inventory PATCH INVENTORY_LOW", () => {
    expect(inventoryPatch).toMatch(/sendPushNotification\([\s\S]{0,800}["']INVENTORY_LOW["']/);
  });

  it("admin/orders status ORDER_SHIPPED", () => {
    expect(orderStatus).toMatch(/sendPushNotification\([\s\S]{0,800}["']ORDER_SHIPPED["']/);
  });

  it("admin/orders status ORDER_DELIVERED", () => {
    expect(orderStatus).toMatch(/sendPushNotification\([\s\S]{0,800}["']ORDER_DELIVERED["']/);
  });

  it("request approve PURCHASE_APPROVED", () => {
    expect(approve).toMatch(/sendPushNotification\([\s\S]{0,800}["']PURCHASE_APPROVED["']/);
  });

  it("request approve BUDGET_WARNING", () => {
    expect(approve).toMatch(/sendPushNotification\([\s\S]{0,800}["']BUDGET_WARNING["']/);
  });

  it("request reject PURCHASE_REJECTED", () => {
    expect(reject).toMatch(/sendPushNotification\([\s\S]{0,800}["']PURCHASE_REJECTED["']/);
  });

  it("compare-sessions insight COMPARE_COMPLETED", () => {
    expect(compareInsight).toMatch(/sendPushNotification\([\s\S]{0,800}["']COMPARE_COMPLETED["']/);
  });

  it("inventory-restock-detector INVENTORY_EXPIRING", () => {
    expect(inventoryDetector).toMatch(/sendPushNotification\([\s\S]{0,800}["']INVENTORY_EXPIRING["']/);
  });

  it("quote-expiry-detector QUOTE_EXPIRED", () => {
    expect(quoteExpiry).toMatch(/sendPushNotification\([\s\S]{0,800}["']QUOTE_EXPIRED["']/);
  });

  it("vendor response VENDOR_REPLIED", () => {
    expect(vendorResponse).toMatch(/sendPushNotification\([\s\S]{0,800}["']VENDOR_REPLIED["']/);
  });

  it("work-queue request-approval PURCHASE_APPROVAL_REQUESTED", () => {
    expect(requestApproval).toMatch(/sendPushNotification\([\s\S]{0,800}["']PURCHASE_APPROVAL_REQUESTED["']/);
  });
});

describe("§11.250-pref-push #4 — invariant 보존 (cross-stack)", () => {
  it("sendPushNotification 시그니처 보존 (userId + payload + Promise<SendPushResult>)", () => {
    expect(pushSender).toMatch(/sendPushNotification\([\s\S]{0,500}userId:\s*string/);
    expect(pushSender).toMatch(/payload:\s*PushPayload/);
    expect(pushSender).toMatch(/Promise<SendPushResult>/);
  });

  it("Expo Push API URL 보존 (EXPO_PUSH_API)", () => {
    expect(pushSender).toMatch(/EXPO_PUSH_API/);
    expect(pushSender).toMatch(/exp\.host\/--\/api\/v2\/push\/send/);
  });

  it("Device.findMany 보존 (multi-device broadcast)", () => {
    expect(pushSender).toMatch(/db\.device\.findMany/);
  });

  it("§11.250-pref filterRecipientsByPreference 보존 (in-app filter)", () => {
    expect(helper).toMatch(/filterRecipientsByPreference/);
    expect(helper).toMatch(/notificationToggles/);
  });

  it("§11.250-pref-push trace marker", () => {
    const combined = helper + "\n" + pushSender;
    expect(combined).toMatch(/§11\.250-pref-push|11\.250-pref-push/);
  });
});

describe("§11.250-pref-push #5 — graceful fallback (single-userId helper)", () => {
  it("isUserPreferenceAllowed DB fail 시 true 반환 (보존 동작)", () => {
    // catch block 안 return true (graceful) — push 정상 전송 보장.
    expect(helper).toMatch(/isUserPreferenceAllowed[\s\S]{0,2500}return\s+true/);
  });
});
