/**
 * §5-reminder-slice — 리마인더 톤 프리셋 + 재응답 기한 (호영님 견적 고도화 P5, 2026-07-13)
 *
 * 재정의: §5 핵심(미회신 자동필터·회신완료 제외)은 이미 충족(§11.228 responseCount===0).
 *   저위험 슬라이스만 도입 — 톤 프리셋 3종 + 재응답 기한 operator 선택.
 *   D+ 배지·개별발송·활동로그는 데이터 forward/canonical·서버 얽힘 → backlog(미포함).
 *
 * client-only(page/서버 무접촉). isReminder·필터·allSettled 무변경.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SHEET = readFileSync(
  resolve(
    __dirname,
    "../../../components/quotes/dispatch/batch-reminder-sheet.tsx",
  ),
  "utf8",
);

describe("§5-reminder-slice — 톤 프리셋", () => {
  it("REMINDER_TONE_PRESETS 3종(정중/표준/독촉)", () => {
    expect(SHEET).toMatch(/REMINDER_TONE_PRESETS/);
    expect(SHEET).toMatch(/label:\s*"정중"/);
    expect(SHEET).toMatch(/label:\s*"표준"/);
    expect(SHEET).toMatch(/label:\s*"독촉"/);
  });

  it("selectedTone state + 기본 '표준'(기존 기본문 회귀 0)", () => {
    expect(SHEET).toMatch(/const\s*\[selectedTone,\s*setSelectedTone\]\s*=\s*useState/);
    expect(SHEET).toMatch(/useState<string>\("standard"\)/);
    // 기본 message = standard preset(하드코딩 기본문 대체, 동일 문구 유지).
    expect(SHEET).toMatch(/REMINDER_TONE_PRESETS\.find\(\(t\)\s*=>\s*t\.key === "standard"\)!\.message/);
  });

  it("프리셋 버튼 클릭 시 selectedTone + message 세팅", () => {
    expect(SHEET).toMatch(/data-testid="reminder-tone-preset"/);
    expect(SHEET).toMatch(/setSelectedTone\(tone\.key\)/);
    expect(SHEET).toMatch(/setMessage\(tone\.message\)/);
  });
});

describe("§5-reminder-slice — 재응답 기한 선택", () => {
  it("expiresInDays setter 노출(기존 고정 → 선택)", () => {
    expect(SHEET).toMatch(/const\s*\[expiresInDays,\s*setExpiresInDays\]\s*=\s*useState\(7\)/);
  });

  it("기한 select + 옵션(3/5/7/14/30)", () => {
    expect(SHEET).toMatch(/data-testid="reminder-expires-select"/);
    expect(SHEET).toMatch(/onChange=\{\(e\)\s*=>\s*setExpiresInDays\(Number\(e\.target\.value\)\)\}/);
    for (const d of [3, 5, 7, 14, 30]) {
      expect(SHEET).toMatch(new RegExp(`<option value=\\{${d}\\}>`));
    }
  });
});

describe("§5-reminder-slice — 무회귀(canonical truth 보존)", () => {
  it("미회신 자동필터(responseCount===0) 보존", () => {
    expect(SHEET).toMatch(/responses\?\.length\s*\?\?\s*0\)\s*===\s*0/);
    expect(SHEET).toMatch(/eligibleQuotes/);
    expect(SHEET).toMatch(/alreadyRespondedQuotes/);
  });

  it("회신완료 제외 배지 보존", () => {
    expect(SHEET).toMatch(/회신 수신 \(제외\)/);
  });

  it("리마인더 라벨 + isReminder 힌트 보존", () => {
    expect(SHEET).toMatch(/리마인더/);
    expect(SHEET).toMatch(/isReminder:\s*true/);
  });

  it("Promise.allSettled + vendor-requests POST 보존", () => {
    expect(SHEET).toMatch(/Promise\.allSettled/);
    expect(SHEET).toMatch(/\/api\/quotes\/.+\/vendor-requests/);
    expect(SHEET).toMatch(/method:\s*["']POST["']/);
  });

  it("expiresInDays 가 발송 파이프라인에 반영(setter→handleSendReminders→sendReminderForQuote)", () => {
    expect(SHEET).toMatch(/sendReminderForQuote\(quote,\s*message,\s*expiresInDays/);
  });

  it("amber/orange Tailwind 0(신호등 유지)", () => {
    expect(SHEET).not.toMatch(/\b(bg|text|border)-(amber|orange)-\d{2,3}\b/);
  });
});
