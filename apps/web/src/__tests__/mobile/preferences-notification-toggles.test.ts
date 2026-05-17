/**
 * §11.250-pref-mobile #mobile-notification-preference-toggles — Expo settings 7 카테고리 토글.
 *
 * 호영님 spec: §11.250-pref-ui (web settings 토글) 의 mobile platform 동기.
 *   Expo 앱 안 동일 7 카테고리 (stock_alert / quote_arrived / approval_pending /
 *   expiry_warning / safety_alert / delivery_complete / system) Switch UI.
 *   web `/api/user/preferences` endpoint reuse (별도 mobile route 신설 0).
 *
 * Strategy:
 *   - apps/mobile/hooks/useApi.ts 안 `useUserPreferences` (useQuery) +
 *     `useUpdateNotificationToggles` (useMutation + invalidateQueries) export.
 *     apiClient.get/patch("/api/user/preferences") — Bearer token 자동 주입.
 *   - 신규 화면 `apps/mobile/app/notification-preferences.tsx` — React Native
 *     `Switch` (built-in) + NativeWind 7 카테고리 + 한국어 라벨.
 *     default true (value !== false). useUpdateNotificationToggles 호출.
 *   - apps/mobile/app/(tabs)/more.tsx 안 "알림 설정" entry 의 Alert "준비 중" →
 *     router.push("/notification-preferences") swap. dead button 0.
 *
 * canonical truth lock:
 *   - web `/api/user/preferences` GET/PATCH 시그니처 reuse (별도 mobile route 0).
 *   - User.preferences.notificationToggles Json field reuse (schema 0).
 *   - 7 카테고리 매핑 (event-category-map) 정합 — web + mobile 1:1.
 *   - default true 보존 (preference 미설정 사용자 영향 0).
 *   - §11.250-pref-ui web UI 와 cross-platform sync (server preference 1곳).
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function safeRead(p: string): string {
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

const MOBILE_ROOT = resolve(__dirname, "../../../../../apps/mobile");
const USE_API_PATH = resolve(MOBILE_ROOT, "hooks/useApi.ts");
const SCREEN_PATH = resolve(MOBILE_ROOT, "app/notification-preferences.tsx");
const MORE_PATH = resolve(MOBILE_ROOT, "app/(tabs)/more.tsx");

const useApi = safeRead(USE_API_PATH);
const screen = safeRead(SCREEN_PATH);
const more = safeRead(MORE_PATH);

describe("§11.250-pref-mobile #1 — useApi hook (server preference fetch + mutation)", () => {
  it("useUserPreferences hook export", () => {
    expect(useApi).toMatch(/export\s+function\s+useUserPreferences/);
  });

  it("useUserPreferences 안 GET /api/user/preferences", () => {
    expect(useApi).toMatch(/useUserPreferences[\s\S]{0,800}\/api\/user\/preferences/);
  });

  it("useUpdateNotificationToggles hook export (useMutation)", () => {
    expect(useApi).toMatch(/export\s+function\s+useUpdateNotificationToggles/);
  });

  it("useUpdateNotificationToggles 안 PATCH /api/user/preferences + notificationToggles", () => {
    expect(useApi).toMatch(/useUpdateNotificationToggles[\s\S]{0,1500}\/api\/user\/preferences/);
    expect(useApi).toMatch(/useUpdateNotificationToggles[\s\S]{0,1500}notificationToggles/);
  });

  it("useUpdateNotificationToggles invalidateQueries user-preferences", () => {
    expect(useApi).toMatch(/useUpdateNotificationToggles[\s\S]{0,2000}invalidateQueries[\s\S]{0,300}user-preferences/);
  });
});

describe("§11.250-pref-mobile #2 — 신규 screen NotificationPreferences", () => {
  it("screen 파일 존재 (notification-preferences.tsx)", () => {
    expect(screen.length).toBeGreaterThan(0);
  });

  it("React Native Switch import (built-in)", () => {
    expect(screen).toMatch(/Switch/);
    expect(screen).toMatch(/from\s+["']react-native["']/);
  });

  it("useUserPreferences + useUpdateNotificationToggles hook import", () => {
    expect(screen).toMatch(/useUserPreferences/);
    expect(screen).toMatch(/useUpdateNotificationToggles/);
  });

  it("7 카테고리 모두 한국어 라벨로 render", () => {
    expect(screen).toMatch(/stock_alert/);
    expect(screen).toMatch(/quote_arrived/);
    expect(screen).toMatch(/approval_pending/);
    expect(screen).toMatch(/expiry_warning/);
    expect(screen).toMatch(/safety_alert/);
    expect(screen).toMatch(/delivery_complete/);
    expect(screen).toMatch(/system/);
  });

  it("Switch onValueChange 가 mutation 호출", () => {
    // updateNotificationToggles 또는 mutate({ ... })
    expect(screen).toMatch(/(updateNotificationToggles|mutate)/);
  });

  it("default true 보존 (value !== false)", () => {
    // 명시 false 만 OFF 표시
    expect(screen).toMatch(/!==\s*false/);
  });

  it("기본/기본값 한국어 안내", () => {
    expect(screen).toMatch(/(기본|기본값)/);
  });
});

describe("§11.250-pref-mobile #3 — more.tsx 알림 설정 entry wiring (dead button 제거)", () => {
  it("more.tsx 안 알림 설정 entry router.push", () => {
    // Alert "준비 중" → router.push("/notification-preferences") swap
    expect(more).toMatch(/notification-preferences/);
  });

  it("router.push 사용 (Alert deprecated)", () => {
    // 알림 설정 entry onPress 가 router.push 호출
    expect(more).toMatch(/router\.push\([\s\S]{0,200}notification-preferences/);
  });

  it("기존 알림 entry (BellRing) 보존 (§11.209d-notification-inapp-mobile-screen)", () => {
    expect(more).toMatch(/BellRing/);
    expect(more).toMatch(/\/notifications/);
  });
});

describe("§11.250-pref-mobile #4 — invariant 보존 (cross-stack)", () => {
  it("apiClient import 보존 (mobile/lib/api)", () => {
    expect(useApi).toMatch(/from\s+["']\.\.\/lib\/api["']/);
  });

  it("기존 mobile hook 보존 (useDashboardSummary 등)", () => {
    expect(useApi).toMatch(/useDashboardSummary/);
    expect(useApi).toMatch(/useQuotes/);
    expect(useApi).toMatch(/useNotifications/);
  });

  it("§11.209d-notification-inapp-mobile-screen useNotifications 보존", () => {
    expect(useApi).toMatch(/useNotifications/);
    expect(more).toMatch(/useNotifications/);
  });

  it("§11.250-pref-mobile trace marker", () => {
    const combined = useApi + "\n" + screen;
    expect(combined).toMatch(/§11\.250-pref-mobile|11\.250-pref-mobile/);
  });
});
