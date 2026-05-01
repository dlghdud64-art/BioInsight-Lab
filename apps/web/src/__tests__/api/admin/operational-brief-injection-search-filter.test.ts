/**
 * §11.172 #operational-brief-injection-audit-search-filter
 *
 * Source-level guard — `/dashboard/audit/page.tsx` 가 ADMIN-only "Injection
 * 시도" quick filter chip 을 노출. 클릭 시 search="prompt_injection_detected"
 * + eventTypeFilter="SETTINGS_CHANGED" 자동 설정. 재클릭 시 reset.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PATH = resolve(
  __dirname,
  "../../../app/dashboard/audit/page.tsx",
);

describe("§11.172 injection quick filter chip", () => {
  const source = readFileSync(PATH, "utf8");

  it("\"Injection 시도\" 한국어 라벨 chip 존재", () => {
    expect(source).toMatch(/Injection 시도/);
  });

  it("ADMIN-only gating — userRole === \"ADMIN\" 분기 (chip 위)", () => {
    // chip block 직전 ADMIN 분기 — multi-line regex (s flag)
    expect(source).toMatch(/userRole\s*===\s*["']ADMIN["'][\s\S]*?Injection 시도/);
  });

  it("클릭 시 search=\"prompt_injection_detected\" 자동 set", () => {
    expect(source).toMatch(/setSearch\(["']prompt_injection_detected["']\)/);
  });

  it("클릭 시 eventTypeFilter=\"SETTINGS_CHANGED\" 자동 set (§11.171 enum 정합)", () => {
    expect(source).toMatch(/setEventTypeFilter\(["']SETTINGS_CHANGED["']\)/);
  });

  it("active 상태 시 reset 동작 (toggle 패턴)", () => {
    expect(source).toMatch(/setSearch\(""\)/);
    expect(source).toMatch(/setEventTypeFilter\(["']all["']\)/);
  });

  it("active accent (rose / 빨강) 분기 — 보안 시각 시그널", () => {
    expect(source).toMatch(/bg-rose|text-rose|border-rose/);
  });

  it("회귀 0: 기존 search Input + eventTypeFilter Select 보존", () => {
    expect(source).toMatch(/setSearch.*e\.target\.value/);
    expect(source).toMatch(/setEventTypeFilter/);
    expect(source).toMatch(/Select.*value={eventTypeFilter}/);
  });

  it("회귀 0: §11.163 cache stats Card + §11.168 fitness counter 보존", () => {
    expect(source).toMatch(/운영 브리핑 캐시 통계/);
    expect(source).toMatch(/fitnessPassRate/);
  });
});
