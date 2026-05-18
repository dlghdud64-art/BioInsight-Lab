/**
 * §11.254b — 소싱 헤더 햄버거 메뉴 (대시보드 동선 보완).
 *
 * 호영님 spec: §11.254 LabAxis → / 변경 후 소싱 → 대시보드 직행 동선 2탭으로
 *   증가 → 헤더 우측 햄버거 (≡) 추가로 보완. 하단 탭 바 추가 0 (액션 바 공간 충돌).
 *
 * 메뉴 entries 5:
 *   - 대시보드 (/dashboard)
 *   - 견적 관리 (/dashboard/quotes)
 *   - 구매 운영 (/dashboard/purchases)
 *   - 재고 관리 (/dashboard/inventory)
 *   - 설정 (/dashboard/settings)
 *
 * canonical truth lock:
 *   - §11.254 LabAxis Link href="/" + "소싱" Link href="/app/search" 보존.
 *   - AI 라벨 스캔 button (Camera icon) 보존 (스마트 스캔 우측 햄버거 추가).
 *   - 모바일/데스크탑 동일 동작.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function safeRead(p: string): string {
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

const PAGE_PATH = resolve(__dirname, "../../app/_workbench/search/page.tsx");
const code = safeRead(PAGE_PATH);

describe("§11.254b #1 — 햄버거 메뉴 추가", () => {
  it("§11.254b trace marker", () => {
    expect(code).toMatch(/§11\.254b|11\.254b/);
  });

  it("DropdownMenu 또는 Menu icon import 추가", () => {
    expect(code).toMatch(/DropdownMenu/);
    expect(code).toMatch(/(Menu)(?=\s*,|\s*}|\s*from)/);
  });

  it("메뉴 button aria-label '메뉴 열기' 또는 '주요 화면'", () => {
    expect(code).toMatch(/aria-label=["'](메뉴\s*열기|주요\s*화면|네비게이션)["']/);
  });

  it("메뉴 button 터치 타깃 min-h-[44px] 또는 h-9+ (Apple HIG 정합)", () => {
    expect(code).toMatch(/§11\.254b[\s\S]{0,2000}(min-h-\[44px\]|h-9|h-10|h-11)/);
  });
});

describe("§11.254b #2 — 5 entry navigation (대시보드 / 견적 / 구매 / 재고 / 설정)", () => {
  it("대시보드 entry — href '/dashboard'", () => {
    // §11.254b trace 인근 또는 page 안.
    expect(code).toMatch(/href=["']\/dashboard["'][\s\S]{0,300}대시보드|대시보드[\s\S]{0,300}href=["']\/dashboard["']/);
  });

  it("견적 관리 entry — href '/dashboard/quotes'", () => {
    expect(code).toMatch(/href=["']\/dashboard\/quotes["'][\s\S]{0,300}견적|견적\s*관리[\s\S]{0,300}href=["']\/dashboard\/quotes["']/);
  });

  it("구매 운영 entry — href '/dashboard/purchases'", () => {
    expect(code).toMatch(/href=["']\/dashboard\/purchases["'][\s\S]{0,300}구매|구매\s*운영[\s\S]{0,300}href=["']\/dashboard\/purchases["']/);
  });

  it("재고 관리 entry — href '/dashboard/inventory'", () => {
    expect(code).toMatch(/href=["']\/dashboard\/inventory["'][\s\S]{0,300}재고|재고\s*관리[\s\S]{0,300}href=["']\/dashboard\/inventory["']/);
  });

  it("설정 entry — href '/dashboard/settings'", () => {
    expect(code).toMatch(/href=["']\/dashboard\/settings["'][\s\S]{0,300}설정|설정[\s\S]{0,300}href=["']\/dashboard\/settings["']/);
  });
});

describe("§11.254b — invariant 보존", () => {
  it("§11.254 LabAxis Link href='/' 보존", () => {
    expect(code).toMatch(/href=["']\/["'][\s\S]{0,300}LabAxis/);
  });

  it("§11.254 '소싱' Link href='/app/search' 보존", () => {
    expect(code).toMatch(/href=["']\/app\/search["']/);
  });

  it("AI 라벨 스캔 button (Camera icon + emerald) 보존", () => {
    expect(code).toMatch(/Camera/);
    expect(code).toMatch(/AI\s*라벨\s*스캔/);
  });

  it("LabelScannerModal mount 보존", () => {
    expect(code).toMatch(/LabelScannerModal/);
  });
});
