/**
 * #settings-notification-persist (호영님 2026-07-05) — 설정 알림 선호 서버 지속.
 *
 * canonical: User.preferences.notificationToggles(7 카테고리) — dispatch(preference-filter)가 소비.
 * 설정 매트릭스 인앱 토글을 useUserPreferences.updateNotificationToggles 로 실지속·실효 배선.
 * 가짜저장(handleNotificationSave setTimeout+toast) 제거. 메일 채널·전역빈도는 canonical 미지원 → 정직 비활성.
 *
 * TDD: 이 파일은 Phase 1(RED)에서 실패해야 정상 — Phase 2 wiring 후 GREEN.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const PAGE = readFileSync(join(__dirname, "..", "..", "app/dashboard/settings/page.tsx"), "utf8");

describe("#settings-notification-persist — canonical 배선", () => {
  it("useUserPreferences.updateNotificationToggles 로 실지속 배선", () => {
    expect(PAGE).toMatch(/useUserPreferences/);
    expect(PAGE).toMatch(/updateNotificationToggles/);
  });

  it("preferences.notificationToggles 로 초기값 hydrate", () => {
    expect(PAGE).toMatch(/notificationToggles/);
  });

  it("7 canonical 카테고리 토글 키 배선(6 명시 카테고리)", () => {
    expect(PAGE).toMatch(/stock_alert/);
    expect(PAGE).toMatch(/quote_arrived/);
    expect(PAGE).toMatch(/approval_pending/);
    expect(PAGE).toMatch(/expiry_warning/);
    expect(PAGE).toMatch(/safety_alert/);
    expect(PAGE).toMatch(/delivery_complete/);
  });
});

describe("#settings-notification-persist — no-op 제거(placeholder success 금지)", () => {
  it("가짜저장 setTimeout(1000)+가짜 toast 부재", () => {
    expect(PAGE).not.toMatch(/new Promise\(\(r\) => setTimeout\(r, 1000\)\)/);
    expect(PAGE).not.toMatch(/알림 설정이 반영되었습니다/);
  });

  it("메일 채널 정직 처리 — 비활성/안내(활성 fake-persist 금지)", () => {
    expect(PAGE).toMatch(/준비 중/);
  });
});

describe("#settings-notification-persist — §3 무회귀", () => {
  it("즉시 배지 보존(안전 중요 카테고리)", () => {
    expect(PAGE).toMatch(/즉시<\/Badge>/);
  });
});
