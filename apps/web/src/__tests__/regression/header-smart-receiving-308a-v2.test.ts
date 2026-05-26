/**
 * §11.308a-v2 #header-smart-receiving — Regression sentinel
 *
 * 호영님 P0 spec (2026-05-26):
 *   스마트 입고 진입점을 글로벌 헤더로 승격 — 어느 페이지에서든 1탭.
 *   대시보드 본문에서는 제거. 재고 탭 진입점 (inventory-main.tsx) 은 보존.
 *
 * Fix:
 *   1. Header.tsx — ScanLine import + state + button + Modal 렌더
 *   2. dashboard/page.tsx — ScanLine import / state / button / Modal 제거
 *   3. inventory-main.tsx — 변경 0 (재고 탭 별도 진입점 spec 보존)
 *
 * §11.308a 회귀 보호 — SmartReceivingPlaceholderModal 컴포넌트 보존 +
 * 재고 탭 진입점 (inventory-smart-receiving-entry-mobile/desktop) 보존.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const HEADER_PATH = "src/components/dashboard/Header.tsx";
const DASHBOARD_PAGE_PATH = "src/app/dashboard/page.tsx";
const INVENTORY_MAIN_PATH = "src/app/dashboard/inventory/inventory-main.tsx";
const MODAL_PATH = "src/components/inventory/SmartReceivingPlaceholderModal.tsx";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.308a-v2 — Header.tsx 글로벌 진입점", () => {
  it("ScanLine import (lucide-react)", () => {
    const src = read(HEADER_PATH);
    expect(src).toMatch(/import\s*\{[^}]*ScanLine[^}]*\}\s*from\s*["']lucide-react["']/);
  });

  it("SmartReceivingPlaceholderModal import", () => {
    const src = read(HEADER_PATH);
    expect(src).toMatch(/import\s*\{[^}]*SmartReceivingPlaceholderModal[^}]*\}\s*from\s*["']@\/components\/inventory\/SmartReceivingPlaceholderModal["']/);
  });

  it("isSmartReceivingOpen state + setter", () => {
    const src = read(HEADER_PATH);
    expect(src).toMatch(/isSmartReceivingOpen.*useState\(false\)/);
    expect(src).toMatch(/setIsSmartReceivingOpen/);
  });

  it("스마트 입고 button — testid + ScanLine icon + onClick wiring (dead button 0)", () => {
    const src = read(HEADER_PATH);
    expect(src).toMatch(/data-testid="header-smart-receiving-entry"/);
    expect(src).toMatch(/aria-label="스마트 입고"/);
    expect(src).toMatch(/<ScanLine className="h-5 w-5 pointer-events-none"/);
    expect(src).toMatch(/setIsSmartReceivingOpen\(true\)/);
  });

  it("Modal 렌더 (open + onClose 정합)", () => {
    const src = read(HEADER_PATH);
    expect(src).toMatch(/<SmartReceivingPlaceholderModal[^>]*open=\{isSmartReceivingOpen\}/);
    expect(src).toMatch(/onClose=\{\(\)\s*=>\s*setIsSmartReceivingOpen\(false\)\}/);
  });

  it("터치 영역 ≥ 44px (모바일 a11y — h-10 w-10)", () => {
    const src = read(HEADER_PATH);
    expect(src).toMatch(/h-10 w-10 md:h-9 md:w-9/);
  });
});

describe("§11.308a-v2 — dashboard/page.tsx 본문 button 제거", () => {
  it("ScanLine import 0 (제거 확인)", () => {
    const src = read(DASHBOARD_PAGE_PATH);
    expect(src).not.toMatch(/\bScanLine\b/);
  });

  it("SmartReceivingPlaceholderModal import 0", () => {
    const src = read(DASHBOARD_PAGE_PATH);
    expect(src).not.toMatch(/SmartReceivingPlaceholderModal/);
  });

  it("isSmartReceivingOpen state 0 (Header 로 이동)", () => {
    const src = read(DASHBOARD_PAGE_PATH);
    expect(src).not.toMatch(/isSmartReceivingOpen\s*[,=]/);
    expect(src).not.toMatch(/setIsSmartReceivingOpen/);
  });

  it("dashboard-smart-receiving-entry testid 0 (본문 button 제거)", () => {
    const src = read(DASHBOARD_PAGE_PATH);
    expect(src).not.toMatch(/data-testid="dashboard-smart-receiving-entry"/);
  });

  it("AIInsightDialog 보존 (§11.243 회귀 0)", () => {
    const src = read(DASHBOARD_PAGE_PATH);
    expect(src).toMatch(/<AIInsightDialog disabled=\{isOnboardingMode\}/);
  });
});

describe("§11.308a-v2 — 재고 탭 진입점 보존 (호영님 spec — 별도 유지)", () => {
  it("inventory-main.tsx mobile entry (inventory-smart-receiving-entry-mobile) 보존", () => {
    const src = read(INVENTORY_MAIN_PATH);
    expect(src).toMatch(/data-testid="inventory-smart-receiving-entry-mobile"/);
  });

  it("inventory-main.tsx desktop entry (inventory-smart-receiving-entry-desktop) 보존", () => {
    const src = read(INVENTORY_MAIN_PATH);
    expect(src).toMatch(/data-testid="inventory-smart-receiving-entry-desktop"/);
  });

  it("inventory-main.tsx SmartReceivingPlaceholderModal 렌더 보존", () => {
    const src = read(INVENTORY_MAIN_PATH);
    expect(src).toMatch(/<SmartReceivingPlaceholderModal[^>]*open=\{isSmartReceivingOpen\}/);
  });

  it("inventory-main.tsx isSmartReceivingOpen state 보존", () => {
    const src = read(INVENTORY_MAIN_PATH);
    expect(src).toMatch(/isSmartReceivingOpen.*useState/);
  });
});

describe("§11.308a-v2 — SmartReceivingPlaceholderModal 컴포넌트 보존", () => {
  it("Modal file 변경 0 (§11.308a 패턴 그대로 재사용)", () => {
    const src = read(MODAL_PATH);
    expect(src).toMatch(/export\s+function\s+SmartReceivingPlaceholderModal/);
    expect(src).toMatch(/곧 제공 예정/);
    expect(src).toMatch(/data-testid="smart-receiving-manual-cta"/);
  });
});

describe("§11.308a-v2 — Header 기존 기능 회귀 0", () => {
  it("Bell 알림 dropdown 보존", () => {
    const src = read(HEADER_PATH);
    expect(src).toMatch(/aria-label="알림"/);
    expect(src).toMatch(/<Bell className="h-5 w-5/);
  });

  it("Search (모바일) 보존", () => {
    const src = read(HEADER_PATH);
    expect(src).toMatch(/aria-label="검색"/);
  });

  it("BarcodeScanFab 보존 (production env-gated)", () => {
    const src = read(HEADER_PATH);
    expect(src).toMatch(/<BarcodeScanFab\s*\/>/);
  });

  it("CommandPalette 보존", () => {
    const src = read(HEADER_PATH);
    expect(src).toMatch(/<CommandPalette\s*\/>/);
  });
});
