/**
 * §11.250-pref-ui #notification-preference-toggles — role-aware preference UI.
 *
 * 호영님 spec: §11.250-pref backend filter 위에 사용자가 직접 토글하는 UI 추가.
 *   7 카테고리 (stock_alert / quote_arrived / approval_pending / expiry_warning /
 *   safety_alert / delivery_complete / system) 별 on/off Switch.
 *
 * Strategy:
 *   - preferences route 안 NotificationTogglesSchema (z.object 7 카테고리 boolean optional) +
 *     UserPreferencesPatchSchema 안 notificationToggles + PATCH deep merge.
 *   - user-preferences helper 안 NotificationTogglesPatch type + updateNotificationToggles
 *     함수 (debounceRef 400ms reuse).
 *   - 신규 컴포넌트 `notification-preference-toggles.tsx` — 7 카테고리 Switch +
 *     useUserPreferences hook 으로 server-persist.
 *   - settings/page.tsx 안 mount.
 *
 * canonical truth lock:
 *   - User.preferences Json field reuse (schema 0, 10 nested key 정합).
 *   - 7 카테고리 매핑 (event-category-map.ts) 정합.
 *   - default true 보존 (preference 미설정 사용자 영향 0).
 *   - filter backend (§11.250-pref) 와 1:1 정합.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function safeRead(p: string): string {
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

const ROUTE_PATH = resolve(__dirname, "../../app/api/user/preferences/route.ts");
const HELPER_PATH = resolve(__dirname, "../../lib/preferences/user-preferences.ts");
const COMPONENT_PATH = resolve(
  __dirname,
  "../../components/settings/notification-preference-toggles.tsx",
);
const FILTER_PATH = resolve(__dirname, "../../lib/notifications/preference-filter.ts");

const route = safeRead(ROUTE_PATH);
const helper = safeRead(HELPER_PATH);
const component = safeRead(COMPONENT_PATH);
const filter = safeRead(FILTER_PATH);

describe("§11.250-pref-ui #1 — preferences route NotificationTogglesSchema", () => {
  it("NotificationTogglesSchema 추가", () => {
    expect(route).toMatch(/NotificationTogglesSchema/);
  });

  it("7 카테고리 모두 z.boolean optional", () => {
    // 7 카테고리: stock_alert / quote_arrived / approval_pending / expiry_warning /
    // safety_alert / delivery_complete / system
    expect(route).toMatch(/NotificationTogglesSchema[\s\S]{0,1500}stock_alert[\s\S]{0,300}z\.boolean/);
    expect(route).toMatch(/NotificationTogglesSchema[\s\S]{0,1500}quote_arrived[\s\S]{0,300}z\.boolean/);
    expect(route).toMatch(/NotificationTogglesSchema[\s\S]{0,1500}approval_pending[\s\S]{0,300}z\.boolean/);
    expect(route).toMatch(/NotificationTogglesSchema[\s\S]{0,1500}expiry_warning[\s\S]{0,300}z\.boolean/);
    expect(route).toMatch(/NotificationTogglesSchema[\s\S]{0,1500}safety_alert[\s\S]{0,300}z\.boolean/);
    expect(route).toMatch(/NotificationTogglesSchema[\s\S]{0,1500}delivery_complete[\s\S]{0,300}z\.boolean/);
    expect(route).toMatch(/NotificationTogglesSchema[\s\S]{0,1500}system[\s\S]{0,300}z\.boolean/);
  });

  it("UserPreferencesPatchSchema 안 notificationToggles 추가", () => {
    expect(route).toMatch(/notificationToggles[\s\S]{0,200}NotificationTogglesSchema/);
  });

  it("UserPreferencesJson 안 notificationToggles nested type", () => {
    expect(route).toMatch(/notificationToggles\?:[\s\S]{0,500}stock_alert/);
  });

  it("PATCH deep merge 안 notificationToggles 분기", () => {
    expect(route).toMatch(/notificationToggles[\s\S]{0,1500}stock_alert/);
  });
});

describe("§11.250-pref-ui #2 — helper updateNotificationToggles", () => {
  it("NotificationTogglesPatch type 추가", () => {
    expect(helper).toMatch(/NotificationTogglesPatch/);
  });

  it("UserPreferencesJson 안 notificationToggles nested type", () => {
    expect(helper).toMatch(/notificationToggles\?:[\s\S]{0,500}(stock_alert|approval_pending)/);
  });

  it("updateNotificationToggles 함수 export", () => {
    expect(helper).toMatch(/updateNotificationToggles/);
  });

  it("debounceRef setTimeout 400ms reuse", () => {
    expect(helper).toMatch(/updateNotificationToggles[\s\S]{0,500}debounceRef/);
  });
});

describe("§11.250-pref-ui #3 — 신규 컴포넌트 NotificationPreferenceToggles", () => {
  it("component 파일 존재", () => {
    expect(component.length).toBeGreaterThan(0);
  });

  it("'use client' directive", () => {
    expect(component).toMatch(/["']use client["']/);
  });

  it("useUserPreferences hook import", () => {
    expect(component).toMatch(/useUserPreferences/);
  });

  it("Switch component import (shadcn/ui)", () => {
    expect(component).toMatch(/Switch/);
    expect(component).toMatch(/from\s+["']@\/components\/ui\/switch["']/);
  });

  it("7 카테고리 Switch render", () => {
    expect(component).toMatch(/stock_alert/);
    expect(component).toMatch(/quote_arrived/);
    expect(component).toMatch(/approval_pending/);
    expect(component).toMatch(/expiry_warning/);
    expect(component).toMatch(/safety_alert/);
    expect(component).toMatch(/delivery_complete/);
    expect(component).toMatch(/system/);
  });

  it("updateNotificationToggles 호출 (Switch onCheckedChange)", () => {
    expect(component).toMatch(/updateNotificationToggles/);
  });

  it("default true 한국어 안내", () => {
    expect(component).toMatch(/(기본|기본값)/);
  });
});

describe("§11.250-pref-ui #4 — invariant 보존 (cross-stack)", () => {
  it("preferences route GET/PATCH 시그니처 보존", () => {
    expect(route).toMatch(/export\s+async\s+function\s+GET/);
    expect(route).toMatch(/export\s+async\s+function\s+PATCH/);
  });

  it("§11.230c (a) ColumnPrefs 보존", () => {
    expect(route).toMatch(/ColumnPrefsSchema/);
  });

  it("§11.230c (a)-7 SafetyFilter + (a)-8 inventory location/category 보존", () => {
    expect(route).toMatch(/safetyFilter/);
    expect(route).toMatch(/InventoryFilterSchema[\s\S]{0,500}location/);
  });

  it("기존 update 함수 9개 보존 (helper)", () => {
    expect(helper).toMatch(/updateColumnPrefs/);
    expect(helper).toMatch(/updateBriefingCollapsed/);
    expect(helper).toMatch(/updateQuotesView/);
    expect(helper).toMatch(/updateQuotesFilter/);
    expect(helper).toMatch(/updateInventoryFilter/);
    expect(helper).toMatch(/updateReceivingFilter/);
    expect(helper).toMatch(/updatePurchasesFilter/);
    expect(helper).toMatch(/updatePurchaseOrdersFilter/);
    expect(helper).toMatch(/updateSafetyFilter/);
  });

  it("§11.250-pref filter backend 보존 (preference-filter import 유지)", () => {
    expect(filter).toMatch(/filterRecipientsByPreference/);
    expect(filter).toMatch(/notificationToggles/);
  });

  it("§11.250-pref-ui trace marker", () => {
    const combined = route + "\n" + helper + "\n" + component;
    expect(combined).toMatch(/§11\.250-pref-ui|11\.250-pref-ui/);
  });
});
