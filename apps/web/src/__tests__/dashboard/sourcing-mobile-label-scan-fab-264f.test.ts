/**
 * §11.264f #sourcing-mobile-label-scan-fab — AI 라벨 스캔 모바일 FAB (호영님 spec)
 *
 * 호영님 spec:
 *   "FAB 통합 (운영 브리핑 + 스캔 단일화)" — 소싱 surface 한정.
 *   소싱은 OperationalBriefFloatingEntry 가 없음 (§11.142 lock — sourcing 결과는
 *   work object 아님). 호영님 결정: AI 라벨 스캔 inline button (헤더, line 2873) →
 *   모바일 한정 우하단 FAB. 데스크탑 inline 보존.
 *
 * Fix (minimum diff):
 *   (1) 기존 inline button className 에 `hidden md:flex` 추가 → 모바일 hide,
 *       데스크탑 inline 유지.
 *   (2) NEW <button> 우하단 fixed FAB — `fixed bottom-6 right-6 z-40 md:hidden`,
 *       동일 setLabelScanOpen(true) 트리거 + Camera icon + aria-label + min 44x44.
 *
 * canonical truth lock:
 *   - setLabelScanOpen(true) 트리거 보존 (동일 핸들러)
 *   - LabelScannerModal open 시그니처 보존
 *   - §11.254b 햄버거 메뉴 보존
 *   - §11.265a/b-1/b-2/c 모바일 cluster 결과 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../app/_workbench/search/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("§11.264f #1 — AI 라벨 스캔 모바일 FAB", () => {
  it("§11.264f trace marker comment 존재", () => {
    expect(page).toMatch(/§11\.264f/);
  });

  it("헤더 inline AI 라벨 스캔 버튼 className 에 hidden md:flex 추가", () => {
    // 기존: className="flex items-center gap-1.5 ... bg-emerald-500/15 text-emerald-400 ..."
    // 신규: className="hidden md:flex items-center gap-1.5 ... bg-emerald-500/15 text-emerald-400 ..."
    expect(page).toMatch(
      /setLabelScanOpen\(true\)[\s\S]{0,400}className="hidden md:flex items-center gap-1\.5 text-xs font-medium px-3 py-2 rounded-lg bg-emerald-500\/15/,
    );
  });

  it("NEW 모바일 FAB — md:hidden + fixed bottom-6 right-6", () => {
    expect(page).toMatch(
      /data-testid="sourcing-label-scan-fab"[\s\S]{0,500}fixed bottom-6 right-6 z-40 md:hidden/,
    );
  });

  it("모바일 FAB onClick setLabelScanOpen(true) 동일 트리거", () => {
    // FAB 도 동일 setLabelScanOpen(true) 호출
    expect(page).toMatch(
      /data-testid="sourcing-label-scan-fab"[\s\S]{0,500}setLabelScanOpen\(true\)/,
    );
  });

  it("모바일 FAB aria-label + Camera icon + 44x44 터치 영역", () => {
    expect(page).toMatch(/aria-label="AI 라벨 스캔 열기"/);
    // min-h-[56px] min-w-[56px] 또는 min-h-[48px] etc — 44 이상이면 정합
    expect(page).toMatch(
      /sourcing-label-scan-fab[\s\S]{0,500}h-14\s+w-14|sourcing-label-scan-fab[\s\S]{0,500}h-12\s+w-12|sourcing-label-scan-fab[\s\S]{0,500}min-h-\[44px\]|sourcing-label-scan-fab[\s\S]{0,500}min-h-\[48px\]|sourcing-label-scan-fab[\s\S]{0,500}min-h-\[56px\]/,
    );
  });
});

describe("§11.264f #2 — invariant 보존 (canonical truth)", () => {
  it("LabelScannerModal import + open 시그니처 보존", () => {
    expect(page).toMatch(
      /import\s+\{\s*LabelScannerModal\s*\}\s+from\s+"@\/components\/inventory\/LabelScannerModal"/,
    );
    expect(page).toMatch(/<LabelScannerModal\s+open=\{labelScanOpen\}/);
  });

  it("labelScanOpen useState 보존", () => {
    expect(page).toMatch(
      /const\s+\[labelScanOpen,\s+setLabelScanOpen\]\s*=\s*useState\(false\)/,
    );
  });

  it("§11.254b 햄버거 메뉴 보존", () => {
    expect(page).toMatch(/§11\.254b/);
    expect(page).toMatch(/aria-label="메뉴 열기"/);
  });

  it("§11.265a unified mobile filter row hidden 보존", () => {
    expect(page).toMatch(
      /<div className="hidden\s+items-center\s+gap-1\.5\s+overflow-x-auto\s+px-4\s+py-2/,
    );
  });

  it("§11.265b-2 AI 분석 Sheet 보존", () => {
    expect(page).toMatch(/data-testid="sourcing-ai-analysis-sheet"/);
  });

  it("§11.265c AI 분석 트리거 보존", () => {
    expect(page).toMatch(/data-testid="sourcing-ai-analysis-trigger"/);
  });

  it("Camera icon import 보존 (lucide)", () => {
    expect(page).toMatch(/Camera/);
  });
});
