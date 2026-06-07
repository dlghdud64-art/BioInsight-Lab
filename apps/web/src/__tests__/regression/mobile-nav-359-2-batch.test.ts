/**
 * §11.359 모바일 nav batch — 더보기 출구(§11.359-2) + 알림 폭 + FAB 회귀
 *
 * Truth reconciliation (2026-06-08, bug-hunter TR):
 *   - 대상 = apps/web 반응형(`bottom-nav-more-sheet.tsx` = shadcn Sheet). RN(apps/mobile) 아님.
 *   - "출구 완전 부재"는 부분 오진: shadcn SheetContent 는 닫기 X 항상 렌더(우상단) +
 *     Radix backdrop/Esc 로도 닫힘. 확정 결함 = z-index(시트 80>nav 50) + 높이 무제한
 *     (시트가 화면 덮어 backdrop/X 밀림) + 홈 항목 부재.
 *   - FAB↔nav 충돌은 이미 해소(barcode inline + 운영브리핑 FAB z-40/auto-hide).
 *
 * 수정: more-sheet max-h+overflow + 명시 닫기 + 대시보드(홈) 항목 / 알림 패널 모바일 반응형 폭.
 * 회귀 0: FAB auto-hide(§11.272d) · barcode inline · sheet 기본 X · bottom-nav z-50.
 *
 * ⚠️ A안은 modal Sheet 유지(FAB-hide 보존). nav-coexistence(non-modal) 는 별도 트랙.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", ".."); // apps/web
function read(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}

const MORE_SHEET = "src/components/layout/bottom-nav-more-sheet.tsx";
const HEADER = "src/components/dashboard/Header.tsx";
const BOTTOM_NAV = "src/components/layout/bottom-nav.tsx";
const FAB = "src/components/operational-brief/floating-entry.tsx";
const BARCODE_FAB = "src/components/layout/barcode-scan-fab.tsx";
const SHEET_UI = "src/components/ui/sheet.tsx";

describe("§11.359-2 — 더보기 시트 출구", () => {
  it("max-h + overflow (시트 전체높이 덮음 방지 → backdrop/X 노출)", () => {
    const src = read(MORE_SHEET);
    expect(src).toMatch(/max-h-\[80vh\]/);
    expect(src).toMatch(/overflow-y-auto/);
  });

  it("명시 닫기 버튼 — onOpenChange(false) + aria-label", () => {
    const src = read(MORE_SHEET);
    expect(src).toMatch(/aria-label="메뉴 닫기"/);
    expect(src).toMatch(/onClick=\{\(\)\s*=>\s*onOpenChange\(false\)\}/);
  });

  it("대시보드(홈) 직행 항목 — exact 매칭", () => {
    const src = read(MORE_SHEET);
    expect(src).toMatch(/label:\s*"대시보드"/);
    expect(src).toMatch(/href:\s*"\/dashboard",\s*icon:\s*LayoutDashboard,\s*exact:\s*true/);
    // exact 매칭 분기(홈이 startsWith 로 과활성되지 않도록)
    expect(src).toMatch(/item\.exact\s*\n?\s*\?\s*pathname === item\.href/);
  });
});

describe("§11.359 — 알림 패널 모바일 폭", () => {
  it("고정 380px → 반응형(calc viewport - margin, max 380)", () => {
    const src = read(HEADER);
    expect(src).toMatch(/w-\[calc\(100vw-1\.5rem\)\]\s*max-w-\[380px\]/);
    expect(src).not.toMatch(/className="absolute right-0 top-full mt-2 w-\[380px\]/);
  });

  it("위치 유지 — right-0 top-full(헤더 아래, 헤더 가림 0)", () => {
    const src = read(HEADER);
    expect(src).toMatch(/absolute right-0 top-full mt-2 w-\[calc/);
  });
});

describe("§11.359 — FAB / nav 회귀 0", () => {
  it("운영브리핑 FAB auto-hide(§11.272d) 보존 — A안 modal 유지의 핵심 가드", () => {
    const src = read(FAB);
    expect(src).toMatch(/data-scroll-locked/);
    expect(src).toMatch(/document\.body\.style\.overflow === "hidden"/);
    expect(src).toMatch(/z-40/);
  });

  it("barcode FAB = 헤더 inline(relative), fixed 부유 FAB 아님(§11.271)", () => {
    const src = read(BARCODE_FAB);
    expect(src).toMatch(/relative inline-flex h-10 w-10/);
    expect(src).toMatch(/lg:hidden/);
  });

  it("sheet 기본 닫기 X(SheetPrimitive.Close) 보존", () => {
    const src = read(SHEET_UI);
    expect(src).toMatch(/<SheetPrimitive\.Close/);
  });

  it("bottom-nav z-50 + 더보기 트리거 보존", () => {
    const src = read(BOTTOM_NAV);
    expect(src).toMatch(/fixed bottom-0 inset-x-0 z-50/);
    expect(src).toMatch(/onClick=\{\(\)\s*=>\s*setMoreOpen\(true\)\}/);
  });
});
