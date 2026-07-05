/**
 * §설정-고도화 §3.1~3.4 (호영님 2026-07-04) — 알림 설정 이중제어 해소·컬럼 헤더·기본값·즉시배지.
 * §3.1 상단 마스터 토글 제거 + orphaned import · §3.2 항목|인앱|메일 헤더 · §3.3 즉시=SAFETY_CRITICAL_IDS ·
 * §3.4 email 기본 OFF 5건 flip(총 email:false 9). deliveryOverride·inApp·개별 opt-in·toggleNotification 배선 불변.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const PAGE = readFileSync(join(__dirname, "..", "..", "app/dashboard/settings/page.tsx"), "utf8");

describe("§설정-고도화 §3.1~3.4", () => {
  it("§3.1 마스터 토글(NotificationPreferenceToggles) 제거 + orphaned import 0", () => {
    expect(PAGE).not.toMatch(/import[^\n]*NotificationPreferenceToggles/);
    expect(PAGE).not.toMatch(/<NotificationPreferenceToggles\s*\/>/);
  });
  it("§3.2 컬럼 헤더(인앱|메일, w-9 정렬) + toggleNotification 배선 2건 보존", () => {
    expect(PAGE).toMatch(/w-9 text-center[^>]*>인앱</);
    expect(PAGE).toMatch(/w-9 text-center[^>]*>메일</);
    expect((PAGE.match(/toggleNotification\(/g) || []).length).toBeGreaterThanOrEqual(2);
  });
  it("§3.3 즉시 배지 = SAFETY_CRITICAL_IDS(immediate 집합)", () => {
    expect(PAGE).toMatch(/SAFETY_CRITICAL_IDS = new Set\(\["stock_low", "stock_expiry", "safety_compliance", "system_security"\]\)/);
  });
  it("§3.4 email 기본 OFF 정합(신규 5 + 기존 4 = email:false 9건)", () => {
    expect((PAGE.match(/email:\s*false/g) || []).length).toBe(9);
  });
});
