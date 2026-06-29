import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const LABEL_SCANNER_MODAL = readFileSync(
  resolve(__dirname, "../../components/inventory/LabelScannerModal.tsx"),
  "utf8",
);

/**
 * §scan-card-declutter (호영님 2026-06-30) supersede §11.291
 *   — provider/fallback 사용 경로(T1/T2/T3) 표시는 내부 관측용이며 작업자에게 불필요 →
 *     LabelScannerModal 결과 카드에서 제거. 신뢰도(ConfidenceBadge)만 유지(자동 인식값 확인 신호).
 *   provider-route 정보는 OCR 라우트/admin 모니터링(ocr-cache-hit-ratio)에서 계속 관측(여기 미검증).
 *   본 sentinel: 모달에서 provider-route UI가 다시 살아나지 않도록 removal guard.
 */
describe("§scan-card-declutter — OCR provider-route 표시 제거(removal guard)", () => {
  it("결과 카드에 사용 경로/폴백 배지 미노출(내부 관측용 제거)", () => {
    expect(LABEL_SCANNER_MODAL).not.toContain("사용 경로:");
    expect(LABEL_SCANNER_MODAL).not.toContain("폴백:");
    expect(LABEL_SCANNER_MODAL).not.toMatch(/data-testid="ocr-fallback-badge"/);
  });

  it("T1/T2/T3 경로 라벨 미노출 (provider 분기 표시 제거)", () => {
    expect(LABEL_SCANNER_MODAL).not.toContain("Gemini T1");
    expect(LABEL_SCANNER_MODAL).not.toContain("Cloud Vision T2 (Claude 구조화)");
    expect(LABEL_SCANNER_MODAL).not.toContain("정규식 T3");
  });

  it("신뢰도(ConfidenceBadge)는 유지 — 자동 인식값 확인 신호 보존", () => {
    expect(LABEL_SCANNER_MODAL).toMatch(/ConfidenceBadge/);
  });
});
