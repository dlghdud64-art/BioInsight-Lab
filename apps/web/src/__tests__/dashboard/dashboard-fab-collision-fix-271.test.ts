/**
 * §11.271 #dashboard-fab-collision-fix — 대시보드 surface 의 운영 브리핑 FAB +
 *   스캔 FAB 좌표 충돌 해소 (§11.268a 패턴 reuse)
 *
 * 호영님 P0 spec: 메인 대시보드 모바일 viewport 에서 두 FAB 가 동일 좌표
 *   (`bottom-[72px] right-4 z-40`) 에 stack → 시각적 겹침.
 *
 * Root cause:
 *   - OperationalBriefFloatingEntry (운영 브리핑) — fixed bottom-[72px] right-4 z-40
 *   - BarcodeScanFab (스캔) — fixed bottom-[72px] right-4 z-40 lg:hidden
 *   - §11.252c (운영 브리핑) + §11.251d (스캔) 가 따로 land 되면서 동일 좌표 사용
 *   - §11.264f 가 sourcing 페이지 FAB 만 단일화, 대시보드 surface 는 미처리
 *
 * Fix (minimum diff, 3 file):
 *   1. DashboardShell — line 84 `<BarcodeScanFab />` mount 제거
 *   2. DashboardHeader — 모바일 검색 button (md:hidden) 옆에 `<BarcodeScanFab />`
 *      inline mount
 *   3. BarcodeScanFab — button className `fixed bottom-[72px] right-4 z-40` →
 *      `relative` (헤더 inline). lg:hidden + overlay z-[60] 보존.
 *
 * canonical truth lock:
 *   - 운영 브리핑 FAB 위치 변경 0 (bottom-[72px] right-4)
 *   - BarcodeScanFab 의 store wiring (useSmartSourcingStore), router push, overlay
 *     (fixed inset-0 z-[60]), mock reagents, phase/scanned state 전부 보존
 *   - lg:hidden (mobile only) 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SHELL = readFileSync(
  resolve(__dirname, "../../app/dashboard/_components/dashboard-shell.tsx"),
  "utf8",
);
const HEADER = readFileSync(
  resolve(__dirname, "../../components/dashboard/Header.tsx"),
  "utf8",
);
const SCAN_FAB = readFileSync(
  resolve(__dirname, "../../components/layout/barcode-scan-fab.tsx"),
  "utf8",
);
const BRIEF_ENTRY = readFileSync(
  resolve(__dirname, "../../components/operational-brief/floating-entry.tsx"),
  "utf8",
);

describe("§11.271 #1 — DashboardShell BarcodeScanFab unmount", () => {
  it("§11.271 trace marker comment 존재 (3 file 중 1 이상)", () => {
    const allFiles = SHELL + HEADER + SCAN_FAB;
    expect(allFiles).toMatch(/§11\.271/);
  });

  it("DashboardShell 에서 <BarcodeScanFab /> JSX mount 제거", () => {
    // §11.271 fix: shell 에서 FAB mount 제거 (헤더 inline 으로 이동)
    expect(SHELL).not.toMatch(/<BarcodeScanFab\s*\/>/);
  });

  it("DashboardShell BarcodeScanFab import 제거 (dead import)", () => {
    expect(SHELL).not.toMatch(/import\s+\{\s*BarcodeScanFab\s*\}/);
  });
});

describe("§11.271 #2 — DashboardHeader inline scan trigger mount", () => {
  it("DashboardHeader 에서 BarcodeScanFab import", () => {
    expect(HEADER).toMatch(/import\s+\{\s*BarcodeScanFab\s*\}/);
  });

  it("DashboardHeader 의 모바일 검색 button 옆에 <BarcodeScanFab /> mount", () => {
    // 검색 button (Search icon + /app/search) 직후 BarcodeScanFab mount
    expect(HEADER).toMatch(/<Search className="h-5 w-5"[\s\S]{0,400}<BarcodeScanFab/);
  });
});

describe("§11.271 #3 — BarcodeScanFab button className inline swap", () => {
  it("BarcodeScanFab button className 에 fixed bottom-[72px] right-4 z-40 제거", () => {
    // §11.271 fix: fixed bottom-[72px] right-4 z-40 → relative (헤더 inline)
    expect(SCAN_FAB).not.toMatch(/className="fixed bottom-\[72px\] right-4 z-40/);
  });

  it("BarcodeScanFab button className 에 relative (헤더 inline) 적용", () => {
    expect(SCAN_FAB).toMatch(/className="relative/);
  });

  it("BarcodeScanFab lg:hidden 보존 (mobile only)", () => {
    expect(SCAN_FAB).toMatch(/lg:hidden/);
  });
});

describe("§11.271 #4 — invariant 보존 (canonical truth)", () => {
  it("운영 브리핑 FAB 위치 (bottom-[72px] right-4) 변경 0", () => {
    expect(BRIEF_ENTRY).toMatch(
      /fixed bottom-\[72px\] right-4 lg:bottom-6 lg:right-6 z-40/,
    );
  });

  it("BarcodeScanFab overlay (fixed inset-0 z-[60]) 보존", () => {
    expect(SCAN_FAB).toMatch(/fixed inset-0 z-\[60\]/);
  });

  it("BarcodeScanFab store wiring (useSmartSourcingStore) 보존", () => {
    expect(SCAN_FAB).toMatch(/useSmartSourcingStore/);
    expect(SCAN_FAB).toMatch(/setBomText/);
    expect(SCAN_FAB).toMatch(/setActiveTab/);
  });

  it("BarcodeScanFab navigation (router.push /dashboard/quotes) 보존", () => {
    expect(SCAN_FAB).toMatch(
      /router\.push\("\/dashboard\/quotes\?dock=intake&source=bom_import"\)/,
    );
  });

  it("BarcodeScanFab phase/scanned state + MOCK_REAGENTS 보존", () => {
    expect(SCAN_FAB).toMatch(/useState<"idle" \| "scanning" \| "ready">/);
    expect(SCAN_FAB).toMatch(/MOCK_REAGENTS/);
  });

  it("BarcodeScanFab ScanLine icon + 바코드 스캔 aria-label 보존", () => {
    expect(SCAN_FAB).toMatch(/<ScanLine className="h-5 w-5"/);
    expect(SCAN_FAB).toMatch(/aria-label="바코드 스캔"/);
  });
});
