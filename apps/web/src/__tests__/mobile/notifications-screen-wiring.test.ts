/**
 * §11.209d-notification-inapp-mobile-screen Phase 1 — RED test
 *
 * Mobile in-app 알림 — Stack screen + helper + hooks + types + entry point.
 *
 * canonical truth:
 *   - /api/notifications GET (NotificationEvent + NotificationAction = source)
 *   - Batch B 의 helper logic (event-category-map) — mobile 에 동일 source 복제
 *   - more (설정) tab 안 entry + 별도 Stack screen (5 tabs 보존)
 *
 * Out of scope:
 *   - 별도 알림 tab (UX 부담)
 *   - SSE/WebSocket realtime
 *   - Stage 3 push 통합
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..", "..");

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.209d-notification-inapp-mobile-screen — helper 복제", () => {
  const HELPER = "apps/mobile/lib/event-category-map.ts";

  it("mobile event-category-map.ts file 존재 + 4 helper export", () => {
    const src = read(HELPER);
    expect(src).toMatch(/export\s+function\s+eventTypeToCategory/);
    expect(src).toMatch(/export\s+function\s+buildNotificationText/);
    expect(src).toMatch(/export\s+function\s+buildNotificationHref/);
    expect(src).toMatch(/export\s+function\s+formatNotificationTime/);
  });

  it("NotificationCategory 7 카테고리 type export", () => {
    const src = read(HELPER);
    expect(src).toMatch(/stock_alert/);
    expect(src).toMatch(/quote_arrived/);
    expect(src).toMatch(/delivery_complete/);
    expect(src).toMatch(/approval_pending/);
    expect(src).toMatch(/expiry_warning/);
    expect(src).toMatch(/safety_alert/);
    expect(src).toMatch(/system/);
  });

  it("결재 lifecycle 3 type 매핑 명시 (PURCHASE_APPROVAL_REQUESTED / APPROVED / REJECTED)", () => {
    const src = read(HELPER);
    expect(src).toMatch(/PURCHASE_APPROVAL_REQUESTED/);
    expect(src).toMatch(/PURCHASE_APPROVED/);
    expect(src).toMatch(/PURCHASE_REJECTED/);
  });

  it("§11.209d-notification-inapp-mobile-screen 코멘트 명시 (drift 차단)", () => {
    const src = read(HELPER);
    // mobile 복제임을 명시 + web single source 참조 lock
    expect(src).toMatch(/§11\.209d-notification-inapp-mobile-screen|11\.209d-notification-inapp-mobile-screen|§11\.209d-notification-inapp-web-bell-ui/);
  });
});

describe("§11.209d-notification-inapp-mobile-screen — types/index.ts NotificationItem", () => {
  const TYPES = "apps/mobile/types/index.ts";

  it("NotificationItem interface (또는 type) export", () => {
    const src = read(TYPES);
    expect(src).toMatch(/(?:export\s+)?interface\s+NotificationItem|export\s+type\s+NotificationItem/);
  });

  it("NotificationItem 의 eventType / readAt / metadata 필드 정합", () => {
    const src = read(TYPES);
    // event 안에 eventType, top-level 에 readAt
    expect(src).toMatch(/eventType:\s*string/);
    expect(src).toMatch(/readAt:/);
  });
});

describe("§11.209d-notification-inapp-mobile-screen — useApi.ts hooks", () => {
  const HOOKS = "apps/mobile/hooks/useApi.ts";

  it("useNotifications hook export 정의", () => {
    const src = read(HOOKS);
    expect(src).toMatch(/export\s+function\s+useNotifications/);
  });

  it("useNotifications 가 /api/notifications?actionType=IN_APP 호출", () => {
    const src = read(HOOKS);
    const fnMatch = src.match(/export\s+function\s+useNotifications[\s\S]*?(?=export\s+function|\Z)/);
    expect(fnMatch).not.toBeNull();
    if (fnMatch) {
      expect(fnMatch[0]).toMatch(/\/api\/notifications/);
      expect(fnMatch[0]).toMatch(/actionType[=:][^,)]*IN_APP/);
    }
  });

  it("useMarkNotificationRead mutation export + invalidation", () => {
    const src = read(HOOKS);
    expect(src).toMatch(/export\s+function\s+useMarkNotificationRead/);
    const fnMatch = src.match(/export\s+function\s+useMarkNotificationRead[\s\S]*?(?=export\s+function|\Z)/);
    expect(fnMatch).not.toBeNull();
    if (fnMatch) {
      expect(fnMatch[0]).toMatch(/\/api\/notifications\/\$\{[^}]+\}\/read/);
      expect(fnMatch[0]).toMatch(/queryKey:\s*\[\s*["']notifications["']/);
    }
  });
});

describe("§11.209d-notification-inapp-mobile-screen — notifications.tsx Stack screen", () => {
  const SCREEN = "apps/mobile/app/notifications.tsx";

  it("notifications.tsx 신규 file 존재", () => {
    const src = read(SCREEN);
    expect(src.length).toBeGreaterThan(0);
  });

  it("useNotifications + useMarkNotificationRead hook import", () => {
    const src = read(SCREEN);
    expect(src).toMatch(/useNotifications/);
    expect(src).toMatch(/useMarkNotificationRead/);
  });

  it("event-category-map helper 4개 import", () => {
    const src = read(SCREEN);
    expect(src).toMatch(/eventTypeToCategory/);
    expect(src).toMatch(/buildNotificationText/);
    expect(src).toMatch(/buildNotificationHref/);
    expect(src).toMatch(/formatNotificationTime/);
  });

  it("FlatList 또는 ScrollView 기반 list 렌더링", () => {
    const src = read(SCREEN);
    expect(src).toMatch(/FlatList|ScrollView/);
  });

  it("read state 시각화 (readAt null 분기)", () => {
    const src = read(SCREEN);
    expect(src).toMatch(/readAt/);
  });

  it("§11.209d-notification-inapp-mobile-screen 코멘트 명시", () => {
    const src = read(SCREEN);
    expect(src).toMatch(/§11\.209d-notification-inapp-mobile-screen|11\.209d-notification-inapp-mobile-screen/);
  });
});

describe("§11.209d-notification-inapp-mobile-screen — _layout.tsx Stack registration", () => {
  const LAYOUT = "apps/mobile/app/_layout.tsx";

  it("Stack.Screen name='notifications' 등록", () => {
    const src = read(LAYOUT);
    expect(src).toMatch(/Stack\.Screen[\s\S]*?name=["']notifications["']/);
  });
});

describe("§11.209d-notification-inapp-mobile-screen — more tab entry point", () => {
  const MORE = "apps/mobile/app/(tabs)/more.tsx";

  it("'알림' menu entry 추가 (router.push('/notifications'))", () => {
    const src = read(MORE);
    expect(src).toMatch(/router\.push\(["']\/notifications["']\)/);
    // label 한국어 "알림" 명시
    expect(src).toMatch(/label:\s*["']알림["']/);
  });
});
