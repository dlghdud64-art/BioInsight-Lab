/**
 * §11.250-p2-review #event-types-semantic-drift — dead path audit P2 REVIEW cleanup.
 *
 * 호영님 spec: dead path audit 발견 2 event-type 의 중복/모호 해소.
 *   - APPROVAL_NEEDED: governance-bridge.ts 안 3 active caller (approval_snapshot_invalidated,
 *     dispatch_prep_blocked, po_data_changed_after_approval) — 보존 + semantic 명시.
 *     PURCHASE_APPROVAL_REQUESTED 와 의도 분리 (governance-level vs purchase request lifecycle).
 *   - QUOTE_RECEIVED: caller 0 (orphan) — @deprecated marker + VENDOR_REPLIED 권장.
 *
 * Strategy:
 *   - event-types.ts 안 두 event-type 의 EVENT_TYPE_META 항목 위에 JSDoc 추가.
 *   - APPROVAL_NEEDED: semantic note (governance-bridge 전용 vs PURCHASE_APPROVAL_REQUESTED 차이).
 *   - QUOTE_RECEIVED: @deprecated marker + VENDOR_REPLIED 권장 + future use 의도.
 *   - 호환성 유지: key 보존, isValidEventType 보존, defaultActions 보존.
 *
 * canonical truth lock:
 *   - event-types.ts NOTIFICATION_EVENT_TYPES key 변경 0 (기존 caller 호환).
 *   - EVENT_TYPE_META.APPROVAL_NEEDED / QUOTE_RECEIVED entity + defaultActions 보존.
 *   - mobile event-category-map.ts 매핑 보존 (drift sync test 회귀 0).
 *   - governance-bridge.ts 3 APPROVAL_NEEDED 매핑 보존.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { NOTIFICATION_EVENT_TYPES, EVENT_TYPE_META, isValidEventType } from "../../../lib/notifications/event-types";

function safeRead(p: string): string {
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

const EVENT_TYPES_PATH = resolve(
  __dirname,
  "../../../lib/notifications/event-types.ts",
);
const GOV_BRIDGE_PATH = resolve(
  __dirname,
  "../../../lib/notifications/governance-bridge.ts",
);
const MOBILE_HELPER_PATH = resolve(
  __dirname,
  "../../../../../mobile/lib/event-category-map.ts",
);

const eventTypes = safeRead(EVENT_TYPES_PATH);
const govBridge = safeRead(GOV_BRIDGE_PATH);
const mobileHelper = safeRead(MOBILE_HELPER_PATH);

describe("§11.250-p2-review #1 — APPROVAL_NEEDED semantic note", () => {
  it("APPROVAL_NEEDED EVENT_TYPE_META 위에 JSDoc semantic note", () => {
    // governance-bridge 와 PURCHASE_APPROVAL_REQUESTED 차이 명시
    expect(eventTypes).toMatch(/governance[\s\S]{0,500}APPROVAL_NEEDED|APPROVAL_NEEDED[\s\S]{0,800}governance/);
  });

  it("PURCHASE_APPROVAL_REQUESTED 와 의도 분리 명시", () => {
    expect(eventTypes).toMatch(/APPROVAL_NEEDED[\s\S]{0,1500}PURCHASE_APPROVAL_REQUESTED|PURCHASE_APPROVAL_REQUESTED[\s\S]{0,1500}APPROVAL_NEEDED/);
  });

  it("entityType APPROVAL 보존 (caller 호환)", () => {
    expect(EVENT_TYPE_META.APPROVAL_NEEDED.entityType).toBe("APPROVAL");
  });

  it("defaultActions IN_APP + QUEUE_ITEM + EMAIL_DRAFT 보존", () => {
    expect(EVENT_TYPE_META.APPROVAL_NEEDED.defaultActions).toContain("IN_APP");
    expect(EVENT_TYPE_META.APPROVAL_NEEDED.defaultActions).toContain("QUEUE_ITEM");
    expect(EVENT_TYPE_META.APPROVAL_NEEDED.defaultActions).toContain("EMAIL_DRAFT");
  });
});

describe("§11.250-p2-review #2 — QUOTE_RECEIVED @deprecated marker", () => {
  it("QUOTE_RECEIVED EVENT_TYPE_META 위에 @deprecated 마커", () => {
    expect(eventTypes).toMatch(/@deprecated[\s\S]{0,500}QUOTE_RECEIVED|QUOTE_RECEIVED[\s\S]{0,800}@deprecated/);
  });

  it("VENDOR_REPLIED 권장 명시", () => {
    expect(eventTypes).toMatch(/QUOTE_RECEIVED[\s\S]{0,1500}VENDOR_REPLIED|VENDOR_REPLIED[\s\S]{0,1500}QUOTE_RECEIVED/);
  });

  it("entityType QUOTE 보존 (호환성)", () => {
    expect(EVENT_TYPE_META.QUOTE_RECEIVED.entityType).toBe("QUOTE");
  });

  it("defaultActions IN_APP + QUEUE_ITEM 보존", () => {
    expect(EVENT_TYPE_META.QUOTE_RECEIVED.defaultActions).toContain("IN_APP");
    expect(EVENT_TYPE_META.QUOTE_RECEIVED.defaultActions).toContain("QUEUE_ITEM");
  });
});

describe("§11.250-p2-review #3 — 호환성 유지 (invariant)", () => {
  it("NOTIFICATION_EVENT_TYPES.APPROVAL_NEEDED key 보존", () => {
    expect(NOTIFICATION_EVENT_TYPES.APPROVAL_NEEDED).toBe("APPROVAL_NEEDED");
  });

  it("NOTIFICATION_EVENT_TYPES.QUOTE_RECEIVED key 보존", () => {
    expect(NOTIFICATION_EVENT_TYPES.QUOTE_RECEIVED).toBe("QUOTE_RECEIVED");
  });

  it("isValidEventType 두 type 모두 true", () => {
    expect(isValidEventType("APPROVAL_NEEDED")).toBe(true);
    expect(isValidEventType("QUOTE_RECEIVED")).toBe(true);
  });

  it("governance-bridge 안 APPROVAL_NEEDED 3 caller 보존", () => {
    expect(govBridge).toMatch(/notificationEventType:\s*"APPROVAL_NEEDED"/);
    // 3 active mapping 보존 — count >=3 매칭 (literal)
    const matches = govBridge.match(/notificationEventType:\s*"APPROVAL_NEEDED"/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(3);
  });

  it("mobile event-category-map APPROVAL_NEEDED + QUOTE_RECEIVED 보존", () => {
    expect(mobileHelper).toMatch(/APPROVAL_NEEDED/);
    expect(mobileHelper).toMatch(/QUOTE_RECEIVED/);
  });
});

describe("§11.250-p2-review #4 — semantic clarity (trace marker)", () => {
  it("§11.250-p2-review trace marker", () => {
    expect(eventTypes).toMatch(/§11\.250-p2-review|11\.250-p2-review|p2-review|P2 REVIEW/);
  });

  it("VENDOR_REPLIED entityType QUOTE 보존 (대체 path active)", () => {
    expect(EVENT_TYPE_META.VENDOR_REPLIED.entityType).toBe("QUOTE");
  });

  it("PURCHASE_APPROVAL_REQUESTED entityType PURCHASE_REQUEST 보존 (대체 path active)", () => {
    expect(EVENT_TYPE_META.PURCHASE_APPROVAL_REQUESTED.entityType).toBe("PURCHASE_REQUEST");
  });
});
