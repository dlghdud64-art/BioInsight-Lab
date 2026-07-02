/**
 * §11.302d-6a-1 #badge-header-amber-removed — Regression sentinel
 *
 * 호영님 P1 sweep batch 1/3 (~10 file 중 foundation 2 file):
 *   - components/ui/badge.tsx — dotColorMap.amber value swap (key 보존)
 *   - components/dashboard/Header.tsx — NOTIFICATION_TYPE_MAP 2 entry swap
 *
 * 신호등 swap 규칙:
 *   - amber → yellow (긴급/주의 의미 유지)
 *   - orange (안전 경고) → red (위험 강도 격상)
 *
 * canonical truth 보존:
 *   - badge.tsx dotColorMap key "amber" 보존 → caller (~20+ 위치
 *     dot="amber") 영향 0
 *   - Header.tsx NOTIFICATION_TYPE_MAP 5 entry 중 expiry_warning /
 *     safety_alert 2 entry 색상만 swap, type / icon / label 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

const BADGE_PATH = "src/components/ui/badge.tsx";
const HEADER_PATH = "src/components/dashboard/Header.tsx";

describe("§11.302d-6a-1 — badge.tsx amber variant value swap", () => {
  it("dotColorMap.amber value: bg-amber-* 0 (yellow swap)", () => {
    const src = read(BADGE_PATH);
    expect(src).not.toMatch(/bg-amber-\d/);
  });

  it("dotColorMap.amber.dot = 'bg-yellow-500'", () => {
    const src = read(BADGE_PATH);
    expect(src).toMatch(/amber:\s*\{[\s\S]*?dot:\s*"bg-yellow-500"/);
  });

  it("dotColorMap.amber.ping = 'bg-yellow-400'", () => {
    const src = read(BADGE_PATH);
    expect(src).toMatch(/amber:\s*\{[\s\S]*?ping:\s*"bg-yellow-400"/);
  });

  it("amber variant key 보존 (caller wiring 영향 0)", () => {
    const src = read(BADGE_PATH);
    expect(src).toMatch(/amber:\s*\{/);
    // StatusDotColor type 에 amber literal 포함
    expect(src).toMatch(/keyof typeof dotColorMap/);
  });

  it("dotColorMap 6 entry 보존 (red/blue/amber/emerald/slate/purple)", () => {
    const src = read(BADGE_PATH);
    expect(src).toMatch(/red:\s*\{/);
    expect(src).toMatch(/blue:\s*\{/);
    expect(src).toMatch(/amber:\s*\{/);
    expect(src).toMatch(/emerald:\s*\{/);
    expect(src).toMatch(/slate:\s*\{/);
    expect(src).toMatch(/purple:\s*\{/);
  });

  it("Badge component props (dot/dotPulse) 보존", () => {
    const src = read(BADGE_PATH);
    expect(src).toMatch(/dot\?:\s*StatusDotColor/);
    expect(src).toMatch(/dotPulse\?:\s*boolean/);
  });
});

describe("§11.302d-6a-1 — Header.tsx NOTIFICATION_TYPE_MAP swap", () => {
  it("expiry_warning amber → yellow swap (unreadTint + unreadBg)", () => {
    const src = read(HEADER_PATH);
    expect(src).toMatch(/expiry_warning:[\s\S]{0,200}unreadTint:\s*"text-yellow-500"/);
    expect(src).toMatch(/expiry_warning:[\s\S]{0,300}unreadBg:\s*"bg-yellow-50"/);
  });

  it("safety_alert orange → red 격상 swap (unreadTint + unreadBg)", () => {
    const src = read(HEADER_PATH);
    expect(src).toMatch(/safety_alert:[\s\S]{0,200}unreadTint:\s*"text-red-500"/);
    expect(src).toMatch(/safety_alert:[\s\S]{0,300}unreadBg:\s*"bg-red-50"/);
  });

  it("amber/orange Tailwind class 0 occurrence (전체 file)", () => {
    const src = read(HEADER_PATH);
    expect(src).not.toMatch(/bg-amber-\d/);
    expect(src).not.toMatch(/text-amber-\d/);
    expect(src).not.toMatch(/border-amber-\d/);
    expect(src).not.toMatch(/bg-orange-\d/);
    expect(src).not.toMatch(/text-orange-\d/);
    expect(src).not.toMatch(/border-orange-\d/);
  });

  it("expiry_warning entry — type / icon / label 보존", () => {
    const src = read(HEADER_PATH);
    expect(src).toMatch(/expiry_warning:\s*\{[\s\S]{0,300}icon:\s*Clock/);
    expect(src).toMatch(/expiry_warning:[\s\S]{0,300}label:\s*"만료"/);
  });

  it("safety_alert entry — type / icon / label 보존", () => {
    const src = read(HEADER_PATH);
    expect(src).toMatch(/safety_alert:\s*\{[\s\S]{0,300}icon:\s*ShieldAlert/);
    expect(src).toMatch(/safety_alert:[\s\S]{0,300}label:\s*"안전"/);
  });

  it("NOTIFICATION_TYPE_MAP 5 entry 보존 (stock_alert/quote_arrived/delivery_complete/approval_pending/expiry_warning/safety_alert/system)", () => {
    const src = read(HEADER_PATH);
    expect(src).toMatch(/stock_alert:\s*\{/);
    expect(src).toMatch(/quote_arrived:\s*\{/);
    expect(src).toMatch(/delivery_complete:\s*\{/);
    expect(src).toMatch(/approval_pending:\s*\{/);
    expect(src).toMatch(/expiry_warning:\s*\{/);
    expect(src).toMatch(/safety_alert:\s*\{/);
    expect(src).toMatch(/system:\s*\{/);
  });
});

describe("§11.302d-6a-1 — 회귀 0 (기존 신호등 + 헤더 진입점 보존)", () => {
  it("§11.371-3 Header 글로벌 스캔 진입점 보존 (openModal scan_hub)", () => {
    // §11.371-3 진화: 인라인 smart-receiving 모달 → global-modal registry.
    //   Header ScanLine button → openModal("scan_hub") + aria-label="스캔"(접근성 보존).
    const src = read(HEADER_PATH);
    expect(src).toMatch(/openModal\("scan_hub"\)/);
    expect(src).toMatch(/aria-label="스캔"/);
  });

  it("§11.295/§11.296 plain button 패턴 보존 (Radix 0)", () => {
    const src = read(HEADER_PATH);
    expect(src).not.toMatch(/@radix-ui\/react-dropdown-menu/);
  });

  it("stock_alert red tone 보존 (이전 §11.302 swap 보존)", () => {
    const src = read(HEADER_PATH);
    expect(src).toMatch(/stock_alert:[\s\S]{0,300}unreadTint:\s*"text-red-500"/);
  });
});
