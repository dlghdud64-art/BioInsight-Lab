/**
 * §11.308a #smart-receiving-entry — Regression sentinel
 *
 * 호영님 P1 (2026-05-26):
 *   - SmartReceivingPlaceholderModal 컴포넌트 신규 (placeholder + 수동 fallback)
 *   - dashboard/page.tsx 헤더 우측 ScanLine 진입점
 *   - inventory-main.tsx mobile + desktop view 양쪽 ScanLine 진입점
 *
 * dead button 차단:
 *   - placeholder 모달 안 [수동으로 입고 처리하기] CTA = router.push /dashboard/receiving
 *   - [닫기] CTA = onClose handler
 *   - 진입점 button = setIsSmartReceivingOpen(true) wiring
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const MODAL_PATH = "src/components/inventory/SmartReceivingPlaceholderModal.tsx";
const DASHBOARD_PAGE_PATH = "src/app/dashboard/page.tsx";
const INVENTORY_MAIN_PATH = "src/app/dashboard/inventory/inventory-main.tsx";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.308a — SmartReceivingPlaceholderModal 컴포넌트", () => {
  it("파일 존재", () => {
    expect(existsSync(join(REPO_ROOT, MODAL_PATH))).toBe(true);
  });

  it("export SmartReceivingPlaceholderModal", () => {
    const src = read(MODAL_PATH);
    expect(src).toMatch(/export\s+function\s+SmartReceivingPlaceholderModal/);
  });

  it("'곧 제공 예정' placeholder 안내 존재", () => {
    const src = read(MODAL_PATH);
    expect(src).toMatch(/곧 제공 예정/);
  });

  it("거래명세서 OCR 단계 안내 존재 (Phase 1)", () => {
    const src = read(MODAL_PATH);
    expect(src).toMatch(/거래명세서/);
    expect(src).toMatch(/OCR/);
  });

  it("수동 입고 fallback CTA (router.push /dashboard/receiving) — dead button 0", () => {
    const src = read(MODAL_PATH);
    expect(src).toMatch(/router\.push\(["']\/dashboard\/receiving["']\)/);
    expect(src).toMatch(/data-testid="smart-receiving-manual-cta"/);
    expect(src).toMatch(/수동으로 입고 처리하기/);
  });

  it("닫기 CTA (onClose handler)", () => {
    const src = read(MODAL_PATH);
    expect(src).toMatch(/data-testid="smart-receiving-close-cta"/);
    expect(src).toMatch(/onClick=\{onClose\}/);
  });

  it("터치 영역 ≥ 44px (모바일 a11y)", () => {
    const src = read(MODAL_PATH);
    expect(src).toMatch(/min-h-\[44px\]/);
  });

  it("ScanLine icon (lucide-react) 사용", () => {
    const src = read(MODAL_PATH);
    expect(src).toMatch(/import\s*\{[^}]*ScanLine[^}]*\}\s*from\s*["']lucide-react["']/);
    expect(src).toMatch(/<ScanLine/);
  });
});

describe("§11.308a — dashboard/page.tsx 헤더 진입점", () => {
  it("ScanLine import (lucide-react)", () => {
    const src = read(DASHBOARD_PAGE_PATH);
    expect(src).toMatch(/import\s*\{[^}]*ScanLine[^}]*\}\s*from\s*["']lucide-react["']/);
  });

  it("SmartReceivingPlaceholderModal import", () => {
    const src = read(DASHBOARD_PAGE_PATH);
    expect(src).toMatch(/import\s*\{[^}]*SmartReceivingPlaceholderModal[^}]*\}\s*from\s*["']@\/components\/inventory\/SmartReceivingPlaceholderModal["']/);
  });

  it("isSmartReceivingOpen state + setter", () => {
    const src = read(DASHBOARD_PAGE_PATH);
    expect(src).toMatch(/isSmartReceivingOpen/);
    expect(src).toMatch(/setIsSmartReceivingOpen/);
  });

  it("스마트 입고 button (testid + onClick wiring) — dead button 0", () => {
    const src = read(DASHBOARD_PAGE_PATH);
    expect(src).toMatch(/data-testid="dashboard-smart-receiving-entry"/);
    expect(src).toMatch(/setIsSmartReceivingOpen\(true\)/);
  });

  it("Modal 렌더 (open + onClose 정합)", () => {
    const src = read(DASHBOARD_PAGE_PATH);
    expect(src).toMatch(/<SmartReceivingPlaceholderModal[^>]*open=\{isSmartReceivingOpen\}/);
    expect(src).toMatch(/onClose=\{\(\)\s*=>\s*setIsSmartReceivingOpen\(false\)\}/);
  });
});

describe("§11.308a — inventory-main.tsx 헤더 진입점 (mobile + desktop)", () => {
  it("ScanLine import", () => {
    const src = read(INVENTORY_MAIN_PATH);
    expect(src).toMatch(/\bScanLine\b/);
  });

  it("SmartReceivingPlaceholderModal import", () => {
    const src = read(INVENTORY_MAIN_PATH);
    expect(src).toMatch(/import\s*\{[^}]*SmartReceivingPlaceholderModal[^}]*\}/);
  });

  it("isSmartReceivingOpen state (1회)", () => {
    const src = read(INVENTORY_MAIN_PATH);
    expect(src).toMatch(/isSmartReceivingOpen/);
    expect(src).toMatch(/setIsSmartReceivingOpen/);
  });

  it("스마트 입고 button mobile + desktop — testid 2건", () => {
    const src = read(INVENTORY_MAIN_PATH);
    const mobileMatches = src.match(/data-testid="inventory-smart-receiving-entry-mobile"/g);
    const desktopMatches = src.match(/data-testid="inventory-smart-receiving-entry-desktop"/g);
    expect(mobileMatches?.length ?? 0).toBeGreaterThanOrEqual(1);
    expect(desktopMatches?.length ?? 0).toBeGreaterThanOrEqual(1);
  });

  it("button onClick wiring (mobile + desktop 모두 setIsSmartReceivingOpen(true))", () => {
    const src = read(INVENTORY_MAIN_PATH);
    const openCalls = src.match(/setIsSmartReceivingOpen\(true\)/g);
    expect(openCalls?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it("Modal 렌더 (open + onClose) — 1회 (mobile/desktop 공유)", () => {
    const src = read(INVENTORY_MAIN_PATH);
    expect(src).toMatch(/<SmartReceivingPlaceholderModal[^>]*open=\{isSmartReceivingOpen\}/);
  });
});

describe("§11.308a — 회귀 0 (기존 컴포넌트 보존)", () => {
  it("dashboard/page.tsx — OnboardingHero (isOnboardingMode + !onboardingDismissed) 보존", () => {
    const src = read(DASHBOARD_PAGE_PATH);
    expect(src).toMatch(/isOnboardingMode\s*&&\s*!onboardingDismissed/);
  });

  it("inventory-main.tsx — §11.297c ActionMenu 보존 (재고 utility menu)", () => {
    const src = read(INVENTORY_MAIN_PATH);
    expect(src).toMatch(/menuId="inv-utility-mobile"/);
  });

  it("inventory-main.tsx — '재고 등록' + '입고 반영' button 보존", () => {
    const src = read(INVENTORY_MAIN_PATH);
    expect(src).toMatch(/재고 등록/);
    expect(src).toMatch(/입고 반영/);
  });
});
