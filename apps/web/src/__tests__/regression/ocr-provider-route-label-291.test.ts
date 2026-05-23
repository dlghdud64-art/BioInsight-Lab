import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const LABEL_SCANNER_MODAL = readFileSync(
  resolve(__dirname, "../../components/inventory/LabelScannerModal.tsx"),
  "utf8",
);

describe("OCR 결과 경로 표시", () => {
  it("결과 상단에 사용 경로와 폴백 상태를 한글로 노출한다", () => {
    expect(LABEL_SCANNER_MODAL).toContain("사용 경로:");
    expect(LABEL_SCANNER_MODAL).toContain("폴백:");
    expect(LABEL_SCANNER_MODAL).toMatch(/data-testid="ocr-fallback-badge"/);
  });

  it("T1/T2/T3 경로를 운영자가 구분할 수 있다", () => {
    expect(LABEL_SCANNER_MODAL).toContain("Gemini T1");
    expect(LABEL_SCANNER_MODAL).toContain("Cloud Vision T2 (Claude 구조화)");
    expect(LABEL_SCANNER_MODAL).toContain("정규식 T3");
    expect(LABEL_SCANNER_MODAL).toContain('provider !== "GEMINI"');
  });
});
