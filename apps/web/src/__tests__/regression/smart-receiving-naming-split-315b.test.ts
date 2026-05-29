/**
 * §11.315-b #smart-receiving-naming-split — Regression sentinel (명칭 분리)
 *
 * 호영님 P1 옵션 B (spec Part C, 2026-05-28):
 *   두 컴포넌트가 같은 "스마트 입고" 라벨을 공유해 운영자 혼동.
 *   조사 결과 진짜 다른 용도이므로 명칭으로 분리 (입구 통합 X).
 *
 *   - LabelScannerModal       = 라벨 OCR → 재고 직접 등록(PO 없음)  → "스마트 재고 등록 (AI 라벨 스캔)"
 *   - SmartReceivingScannerModal = 거래명세서 → PO 매칭 → 입고 처리   → "스마트 입고" (보존)
 *
 *   컴포넌트 동작/라우팅/wiring 변경 0 — UX 라벨/제목만 swap.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.315-b — LabelScannerModal '스마트 재고 등록 (AI 라벨 스캔)' 명칭 적용", () => {
  const PATH = "src/components/inventory/LabelScannerModal.tsx";

  it("Dialog/Sheet 제목 3곳 모두 새 라벨로 swap", () => {
    const src = read(PATH);
    // 새 라벨이 정확히 3개 위치(H3 / SheetTitle / DialogTitle 인접 텍스트) 노출
    const matches = src.match(/스마트 재고 등록 \(AI 라벨 스캔\)/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(3);
  });

  it("옛 '스마트 입고 (AI 스캔)' 라벨 0 (file 내 잔존 0)", () => {
    const src = read(PATH);
    expect(src).not.toMatch(/스마트 입고 \(AI 스캔\)/);
    // 단독 "스마트 입고" 라벨/주석/JSX text도 0 (LabelScannerModal 안에서는 모두 swap)
    expect(src).not.toMatch(/스마트 입고/);
  });

  it("comment + onDirectReceive prop 의미 정합 (라벨 OCR → 재고 직접 등록)", () => {
    const src = read(PATH);
    expect(src).toMatch(/스마트 재고 등록.*직접 등록/);
    expect(src).toMatch(/onDirectReceive/);
  });
});

describe("§11.315-b — inventory-content 본문 trigger '스마트 재고 등록' swap", () => {
  const PATH = "src/app/dashboard/inventory/inventory-content.tsx";

  it("ActionMenu label + Primary CTA Button text 모두 '스마트 재고 등록'", () => {
    const src = read(PATH);
    // ActionMenu label
    expect(src).toMatch(/label:\s*"스마트 재고 등록"/);
    // Primary CTA button text + ScanLine/Sparkles 아이콘 wiring 보존
    expect(src).toMatch(/setIsSmartReceiveOpen\(true\)[\s\S]{0,200}스마트 재고 등록/);
  });

  it("inventory-content 안 사용자 노출 '스마트 입고' 라벨 0 (주석/§ comment 만 제외)", () => {
    const src = read(PATH);
    // Button 안에 "스마트 입고" 텍스트가 그대로 노출되면 안 됨
    expect(src).not.toMatch(/<Button[^>]*>[\s\S]{0,200}스마트 입고[\s\S]{0,50}<\/Button>/);
    // JSX text node 로 단독 노출되는 옛 라벨도 0
    expect(src).not.toMatch(/>\s*스마트 입고\s*</);
  });
});

describe("§11.315-b — global-modal defaultTitle/Subtitle swap", () => {
  const PATH = "src/components/global-modal.tsx";

  it("label_scanner registry 가 '스마트 재고 등록' 으로 등록", () => {
    const src = read(PATH);
    expect(src).toMatch(/defaultTitle:\s*"스마트 재고 등록 \(AI 라벨 스캔\)"/);
    expect(src).toMatch(/재고에 직접 등록/);
    expect(src).not.toMatch(/defaultTitle:\s*"스마트 입고/);
  });
});

describe("§11.315-b — SmartReceivingScannerModal/Header/308e 의 '스마트 입고' 보존(회귀 가드)", () => {
  it("SmartReceivingScannerModal Dialog 제목 '스마트 입고' 유지 (거래명세서/PO)", () => {
    const src = read("src/components/inventory/SmartReceivingScannerModal.tsx");
    expect(src).toMatch(/스마트 입고/);
  });

  it("Header 글로벌 진입 aria-label '스마트 입고' 유지", () => {
    const src = read("src/components/dashboard/Header.tsx");
    expect(src).toMatch(/aria-label="스마트 입고"/);
  });

  it("308e SmartReceivingStatusCard 본문 '스마트 입고' 유지", () => {
    const src = read("src/components/dashboard/SmartReceivingStatusCard.tsx");
    expect(src).toMatch(/스마트 입고/);
  });

  it("inventory-main 의 SmartReceivingScannerModal trigger '스마트 입고' button 유지", () => {
    const src = read("src/app/dashboard/inventory/inventory-main.tsx");
    // 진짜 스마트 입고 (PO 입고) — inventory-main 의 button text 보존
    expect(src).toMatch(/스마트 입고/);
  });
});
