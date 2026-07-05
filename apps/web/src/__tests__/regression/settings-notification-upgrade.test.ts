/**
 * §설정-고도화 §3 (호영님 2026-07-04) → #settings-notification-persist(2026-07-05) 진화.
 * §3.1 상단 마스터 토글 제거 + §3.2 항목|인앱|메일 헤더 = 구조 가드로 존속.
 * §3.3(즉시=SAFETY_CRITICAL_IDS)·§3.4(email 기본 OFF 매트릭스)는 알림 모델이 canonical 7카테고리 서버지속
 * (User.preferences.notificationToggles)으로 재구조화되며 폐기 — email 컬럼·toggleNotification·SAFETY_CRITICAL_IDS
 * 매트릭스 제거. 즉시 배지·no-op 제거·canonical 배선은 settings-notification-persist.test.ts 가 소유.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const PAGE = readFileSync(join(__dirname, "..", "..", "app/dashboard/settings/page.tsx"), "utf8");

describe("§설정-고도화 §3(→persist 진화) — 구조 가드", () => {
  it("§3.1 마스터 토글(NotificationPreferenceToggles) 제거 + orphaned import 0", () => {
    expect(PAGE).not.toMatch(/import[^\n]*NotificationPreferenceToggles/);
    expect(PAGE).not.toMatch(/<NotificationPreferenceToggles\s*\/>/);
  });
  it("§3.2 항목|인앱|메일 컬럼 헤더 존속(매트릭스 시각 구조)", () => {
    expect(PAGE).toMatch(/w-9 text-center[^>]*>인앱</);
    expect(PAGE).toMatch(/w-9 text-center[^>]*>메일</);
  });
});
