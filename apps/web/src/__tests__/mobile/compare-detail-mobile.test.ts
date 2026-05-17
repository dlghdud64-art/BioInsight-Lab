/**
 * §11.250g-2 #mobile-compare-detail-surface — mobile compare detail screen.
 *
 * 호영님 spec: §11.250g push notification ("AI 비교 분석 완료") tap 시 mobile
 *   ROUTE_MAP.compare 가 dashboard /(tabs) 으로 fallback → 사용자가 어디 봐야
 *   할지 명확하지 않음. detail screen `/compare/[id]` 신규 + ROUTE_MAP.compare
 *   .detail swap → push tap 즉시 compare insight 화면 진입.
 *
 * Strategy:
 *   - apps/mobile/hooks/useApi.ts 안 `useCompareSession(id)` useQuery hook export.
 *     기존 web GET /api/compare-sessions/[id] reuse (response: session + linked
 *     Quotes + inquiryDrafts + latestActionAt).
 *   - NEW screen `apps/mobile/app/compare/[id].tsx` — useLocalSearchParams id
 *     + useCompareSession fetch + aiInsight.keyChanges[] +
 *     aiInsight.recommendedActions[] + productIds + createdAt 표시.
 *     graceful UI (loading / error / empty aiInsight).
 *   - `apps/mobile/lib/notifications.ts` ROUTE_MAP.compare.detail swap
 *     `(id) => "/compare/${id}"` (fallback 보존 — id 없을 시 dashboard).
 *
 * canonical truth lock:
 *   - CompareSession schema reuse (aiInsight Json? + productIds Json +
 *     userId/organizationId/createdAt/updatedAt).
 *   - GET /api/compare-sessions/[id] route 변경 0 (read-only, server schema 0).
 *   - ROUTE_MAP.compare 시그니처 보존 (detail + fallback 두 함수).
 *   - mobile NotificationType "compare" 보존 (§11.250g 등록).
 *   - dead-button 0 (Tab "AI 비교 결과" 같은 anchor 0 — push tap deep-link only).
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function safeRead(p: string): string {
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

const MOBILE_ROOT = resolve(__dirname, "../../../../../apps/mobile");
const USE_API_PATH = resolve(MOBILE_ROOT, "hooks/useApi.ts");
const SCREEN_PATH = resolve(MOBILE_ROOT, "app/compare/[id].tsx");
const NOTIFICATIONS_PATH = resolve(MOBILE_ROOT, "lib/notifications.ts");
const COMPARE_ROUTE_PATH = resolve(
  __dirname,
  "../../app/api/compare-sessions/[id]/route.ts",
);
const INSIGHT_ROUTE_PATH = resolve(
  __dirname,
  "../../app/api/compare-sessions/[id]/insight/route.ts",
);

const useApi = safeRead(USE_API_PATH);
const screen = safeRead(SCREEN_PATH);
const notifications = safeRead(NOTIFICATIONS_PATH);
const compareRoute = safeRead(COMPARE_ROUTE_PATH);
const insightRoute = safeRead(INSIGHT_ROUTE_PATH);

describe("§11.250g-2 #1 — useCompareSession hook (server fetch)", () => {
  it("useCompareSession hook export", () => {
    expect(useApi).toMatch(/export\s+function\s+useCompareSession/);
  });

  it("useCompareSession 안 GET /api/compare-sessions/{id}", () => {
    expect(useApi).toMatch(/useCompareSession[\s\S]{0,800}\/api\/compare-sessions\//);
  });

  it("useCompareSession enabled !!id (id 없을 시 skip)", () => {
    expect(useApi).toMatch(/useCompareSession[\s\S]{0,1200}enabled[\s\S]{0,100}!!id/);
  });
});

describe("§11.250g-2 #2 — 신규 screen Compare Detail", () => {
  it("screen 파일 존재 (compare/[id].tsx)", () => {
    expect(screen.length).toBeGreaterThan(0);
  });

  it("useLocalSearchParams import (id 추출)", () => {
    expect(screen).toMatch(/useLocalSearchParams/);
  });

  it("useCompareSession hook import", () => {
    expect(screen).toMatch(/useCompareSession/);
  });

  it("aiInsight.keyChanges render (핵심 변화)", () => {
    expect(screen).toMatch(/keyChanges/);
  });

  it("aiInsight.recommendedActions render (권장 조치)", () => {
    expect(screen).toMatch(/recommendedActions/);
  });

  it("한국어 라벨 (핵심 변화 / 권장 조치)", () => {
    expect(screen).toMatch(/(핵심\s*변화|권장\s*조치)/);
  });

  it("graceful loading + error state", () => {
    expect(screen).toMatch(/(ActivityIndicator|isLoading)/);
    expect(screen).toMatch(/(isError|불러오지)/);
  });
});

describe("§11.250g-2 #3 — ROUTE_MAP.compare.detail swap (dead-button 제거)", () => {
  it("ROUTE_MAP.compare.detail (id) => /compare/{id}", () => {
    // 기존: detail: () => "/(tabs)" → 신규: detail: (id) => `/compare/${id}`
    expect(notifications).toMatch(/compare:\s*\{[\s\S]{0,500}detail:\s*\(id[\s\S]{0,200}\/compare\//);
  });

  it("fallback 보존 (/(tabs) — id 없을 시 dashboard)", () => {
    expect(notifications).toMatch(/compare:\s*\{[\s\S]{0,500}fallback:\s*["']\/\(tabs\)["']/);
  });

  it("§11.250g-2 trace marker (ROUTE_MAP comment)", () => {
    expect(notifications).toMatch(/§11\.250g-2|11\.250g-2/);
  });
});

describe("§11.250g-2 #4 — invariant 보존 (cross-stack)", () => {
  it("GET /api/compare-sessions/[id] route 보존", () => {
    expect(compareRoute).toMatch(/export\s+async\s+function\s+GET/);
    expect(compareRoute).toMatch(/db\.compareSession\.findUnique/);
  });

  it("POST /api/compare-sessions/[id]/insight 보존 (§11.250g)", () => {
    expect(insightRoute).toMatch(/dispatchNotificationEvent/);
    expect(insightRoute).toMatch(/COMPARE_COMPLETED/);
  });

  it("§11.250g sendPushNotification compare type 보존", () => {
    expect(insightRoute).toMatch(/sendPushNotification[\s\S]{0,500}["']compare["']/);
  });

  it("§11.250g-2 mobile NotificationType 'compare' 보존", () => {
    expect(notifications).toMatch(/["']compare["']/);
  });

  it("기존 ROUTE_MAP entry 보존 (quote / inventory / approval_pending)", () => {
    expect(notifications).toMatch(/quote:\s*\{/);
    expect(notifications).toMatch(/inventory:\s*\{/);
    expect(notifications).toMatch(/approval_pending:\s*\{/);
  });
});
