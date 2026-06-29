/**
 * §scan-card-polish (호영님 2026-06-30) — 라벨 스캔 결과 카드 폴리시
 *   ① 2열 폼 필드 정렬: 라벨 줄 높이를 고정(h-5)해 좌/우 컬럼 입력칸 정렬(배지 유무로 어긋남 해소).
 *   ② 스캔 이미지 썸네일 클릭 → 확대 오버레이(zoom). backdrop 클릭으로 닫힘.
 *
 * 대상: LabelScannerModal.tsx (review step). QuoteScannerModal·SmartReceiving 별 트랙.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const MODAL = readFileSync(
  resolve(__dirname, "../../components/inventory/LabelScannerModal.tsx"),
  "utf8",
);

describe("§scan-card-polish ① — 2열 필드 정렬(라벨 고정 높이)", () => {
  it("필드 라벨 줄 고정 높이(flex h-5 items-center) 7곳 — 입력칸 정렬", () => {
    const m = MODAL.match(/flex h-5 items-center/g) ?? [];
    expect(m.length).toBe(7);
  });
  it("배지 라벨 줄(Lot/유효기간) 고정 높이(gap-1.5 h-5) 2곳", () => {
    const m = MODAL.match(/flex items-center gap-1\.5 h-5/g) ?? [];
    expect(m.length).toBe(2);
  });
  it("3행 grid-cols-1 sm:grid-cols-2 보존(371-4 회귀 0)", () => {
    const m = MODAL.match(/grid grid-cols-1 sm:grid-cols-2 gap-3/g) ?? [];
    expect(m.length).toBe(3);
  });
});

describe("§scan-card-polish ② — 스캔 이미지 클릭 확대", () => {
  it("imageZoomed 상태", () => {
    expect(MODAL).toMatch(/const \[imageZoomed, setImageZoomed\] = useState\(false\)/);
  });
  it("썸네일 = 클릭 버튼(cursor-zoom-in + setImageZoomed(true))", () => {
    expect(MODAL).toMatch(/onClick=\{\(\) => setImageZoomed\(true\)\}/);
    expect(MODAL).toMatch(/cursor-zoom-in/);
    expect(MODAL).toMatch(/aria-label="스캔 이미지 크게 보기"/);
  });
  it("확대 오버레이(backdrop 클릭 닫힘 + max-h-[90vh])", () => {
    expect(MODAL).toMatch(/imageZoomed && previewImage && \(/);
    expect(MODAL).toMatch(/onClick=\{\(\) => setImageZoomed\(false\)\}/);
    expect(MODAL).toMatch(/cursor-zoom-out/);
    expect(MODAL).toMatch(/max-h-\[90vh\] max-w-\[90vw\]/);
    expect(MODAL).toMatch(/alt="스캔된 라벨 확대"/);
  });
});

describe("§scan-card-polish — 보존(회귀 0)", () => {
  it("§scan-card-declutter ConfidenceBadge 유지", () => {
    expect(MODAL).toMatch(/<ConfidenceBadge level=/);
  });
  it("declutter 토큰 미부활(provider/cache testid 0)", () => {
    expect(MODAL).not.toMatch(/data-testid=["']ocr-provider-badge["']/);
    expect(MODAL).not.toMatch(/data-testid=["']ocr-retry-button["']/);
  });
});
