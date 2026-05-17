/**
 * §11.250-pref #notification-preference-filter — role-aware notification preference (backend infra).
 *
 * 호영님 spec: 사용자가 카테고리별 (stock_alert / quote_arrived / approval_pending /
 *   expiry_warning / safety_alert / delivery_complete / system) 알림 수신 토글.
 *   server-side preference filter — dispatcher 안 recipients 가 false 인 사용자 제외.
 *   UI (settings/notifications) 는 별도 cluster (§11.250-pref-ui).
 *
 * Strategy:
 *   - NEW helper `preference-filter.ts` — filterRecipientsByPreference(recipients, eventType).
 *   - User.preferences.notificationToggles[category] 조회. false 면 제외.
 *   - undefined/null/missing → default true (보존 동작 — 기존 사용자 영향 0).
 *   - email-only recipient (userId null) → 그대로 통과 (vendor email 등).
 *   - dispatchNotificationEvent 안 recipients 전처리 (filter 적용).
 *
 * canonical truth lock:
 *   - User.preferences.notificationToggles nested key — schema 0 (Json field reuse).
 *   - eventTypeToCategory 7 category 매핑 reuse.
 *   - dispatchNotificationEvent 시그니처 변경 0 (내부 전처리만).
 *   - default true 보존 (기존 dispatch 회귀 0).
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
const DISPATCHER_PATH = resolve(
  __dirname,
  "../../../lib/notifications/event-dispatcher.ts",
);
const CATEGORY_MAP_PATH = resolve(
  __dirname,
  "../../../lib/notifications/event-category-map.ts",
);

const helper = safeRead(HELPER_PATH);
const dispatcher = safeRead(DISPATCHER_PATH);
const categoryMap = safeRead(CATEGORY_MAP_PATH);

describe("§11.250-pref #1 — preference-filter helper", () => {
  it("helper 파일 존재", () => {
    expect(helper.length).toBeGreaterThan(0);
  });

  it("filterRecipientsByPreference export", () => {
    expect(helper).toMatch(/export\s+async\s+function\s+filterRecipientsByPreference/);
  });

  it("eventTypeToCategory import (category 매핑 reuse)", () => {
    expect(helper).toMatch(/eventTypeToCategory/);
    expect(helper).toMatch(/from\s+["']\.\/event-category-map["']/);
  });

  it("User.preferences.notificationToggles 조회 (Prisma)", () => {
    expect(helper).toMatch(/db\.user\.findMany|db\.user\.findUnique/);
    expect(helper).toMatch(/preferences/);
  });

  it("notificationToggles[category] 확인", () => {
    expect(helper).toMatch(/notificationToggles/);
  });
});

describe("§11.250-pref #2 — default true (기존 사용자 호환)", () => {
  it("default true 보존 (preference undefined/null/missing → 통과)", () => {
    // preference 가 명시적으로 false 일 때만 제외. 그 외는 모두 통과.
    expect(helper).toMatch(/(=== false|=== !1)/);
  });

  it("preference 명시 false 만 제외 (truthy 보존)", () => {
    // toggleValue === false 만 skip. 다른 falsy (null/undefined/0/'') 는 통과.
    expect(helper).toMatch(/toggle[a-zA-Z]*\s*===\s*false/);
  });
});

describe("§11.250-pref #3 — email-only recipient 통과 (vendor email)", () => {
  it("userId null recipient → preference 확인 skip (그대로 통과)", () => {
    // recipient.userId 또는 r.userId null/undefined check → email-only 통과.
    expect(helper).toMatch(/(!\w+\.userId|\w+\.userId\s*==\s*null|\w+\.userId\s*===\s*null)/);
  });
});

describe("§11.250-pref #4 — dispatcher integration", () => {
  it("dispatchNotificationEvent 안 filterRecipientsByPreference 호출", () => {
    expect(dispatcher).toMatch(/filterRecipientsByPreference/);
  });

  it("dispatcher import preference-filter", () => {
    expect(dispatcher).toMatch(/from\s+["']\.\/preference-filter["']/);
  });

  it("recipients 전처리 위치 (NotificationAction 생성 전)", () => {
    // filterRecipientsByPreference 호출이 createMany 호출 전에 위치
    expect(dispatcher).toMatch(/filterRecipientsByPreference[\s\S]{0,2000}notificationAction\.createMany/);
  });
});

describe("§11.250-pref #5 — graceful fallback (filter fail 시 전체 통과)", () => {
  it("filter helper try/catch 또는 fallback", () => {
    // DB fail 시 전체 recipients 그대로 통과 (보존 동작)
    expect(helper).toMatch(/try\s*\{[\s\S]{0,2000}\}\s*catch/);
  });
});

describe("§11.250-pref #6 — invariant 보존 (cross-stack)", () => {
  it("eventTypeToCategory 7 카테고리 보존", () => {
    expect(categoryMap).toMatch(/stock_alert/);
    expect(categoryMap).toMatch(/quote_arrived/);
    expect(categoryMap).toMatch(/approval_pending/);
    expect(categoryMap).toMatch(/expiry_warning/);
    expect(categoryMap).toMatch(/safety_alert/);
    expect(categoryMap).toMatch(/delivery_complete/);
  });

  it("dispatchNotificationEvent 시그니처 보존 (params + Promise<string>)", () => {
    expect(dispatcher).toMatch(/export\s+async\s+function\s+dispatchNotificationEvent/);
    expect(dispatcher).toMatch(/Promise<string>/);
  });

  it("§11.250-pref trace marker", () => {
    expect(helper).toMatch(/§11\.250-pref|11\.250-pref/);
  });
});
