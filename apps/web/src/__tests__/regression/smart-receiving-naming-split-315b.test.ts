/**
 * §11.315-b #smart-receiving-naming-split — Regression sentinel (§suite-red-cleanup 재앵커)
 *
 * 재앵커 ((B), 호영님 2026-07): §11.315-b 의 명칭 분리
 *   (LabelScanner="스마트 재고 등록 (AI 라벨 스캔)" / Receiving="스마트 입고")는
 *   §11.371-3(global-modal registry) + §11.37x(LabelScannerModal 맥락 분기)로 대체됨.
 *   현행 canon:
 *   - global-modal registry: label_scanner defaultTitle "라벨 직접등록"(scan_hub 진입 "스캔")
 *   - LabelScannerModal scanTitle 맥락 분기: 검색="라벨 스캔 검색" / 등록(non-search)="스마트 입고"
 *   - 인라인 등록 surface(inventory-content CTA · SmartReceivingScannerModal ·
 *     SmartReceivingStatusCard · inventory-main): "스마트 입고"
 *   - Header 글로벌 진입: aria-label "스캔"(scan_hub)
 *   본 sentinel 은 §37x/§371-3 현행 명칭 정합으로 재정의(테스트 전용, 소스 무접촉).
 *
 *   ⚠ 잔여 관찰(별건): LabelScanner(라벨 OCR 등록)·SmartReceivingScanner(PO 입고) 인라인
 *     제목이 모두 "스마트 입고" — §37x 는 검색 맥락 conflation 만 해소. registry
 *     ("라벨 직접등록" vs "거래명세서 입고")로 진입 시 구분. 인라인 동명 여부는 UX 별건.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.315-b 재앵커 — LabelScannerModal §37x 맥락 명칭", () => {
  const PATH = "src/components/inventory/LabelScannerModal.tsx";

  it("scanTitle 맥락 분기 — 검색='라벨 스캔 검색' / 등록='스마트 입고'", () => {
    const src = read(PATH);
    expect(src).toMatch(/scanTitle = isSearchContext \? "라벨 스캔 검색" : "스마트 입고"/);
  });

  it("§37x 맥락 분기(onDirectReceive = 등록 맥락) 보존", () => {
    const src = read(PATH);
    expect(src).toMatch(/onDirectReceive/);
    expect(src).toMatch(/isSearchContext/);
  });
});

describe("§11.315-b 재앵커 — global-modal registry '라벨 직접등록'(§371-3)", () => {
  const PATH = "src/components/global-modal.tsx";

  it("label_scanner defaultTitle '라벨 직접등록' + 재고 직접 등록 subtitle", () => {
    const src = read(PATH);
    expect(src).toMatch(/defaultTitle:\s*"라벨 직접등록"/);
    expect(src).toMatch(/재고에 직접 등록/);
  });
});

describe("§11.315-b 재앵커 — 인라인 등록 surface '스마트 입고' 보존", () => {
  it("inventory-content 라벨 등록 CTA '스마트 입고'", () => {
    expect(read("src/app/dashboard/inventory/inventory-content.tsx")).toMatch(/스마트 입고/);
  });

  it("SmartReceivingScannerModal(거래명세서/PO 입고) '스마트 입고'", () => {
    expect(read("src/components/inventory/SmartReceivingScannerModal.tsx")).toMatch(/스마트 입고/);
  });

  it("308e SmartReceivingStatusCard '스마트 입고'", () => {
    expect(read("src/components/dashboard/SmartReceivingStatusCard.tsx")).toMatch(/스마트 입고/);
  });

  it("inventory-main '스마트 입고' trigger", () => {
    expect(read("src/app/dashboard/inventory/inventory-main.tsx")).toMatch(/스마트 입고/);
  });
});

describe("§11.315-b 재앵커 — Header 글로벌 진입 §371-3 scan_hub", () => {
  it("Header aria-label '스캔'(scan_hub registry 진입, §371-3)", () => {
    const src = read("src/components/dashboard/Header.tsx");
    expect(src).toMatch(/aria-label="스캔"/);
  });
});
