/**
 * §11.290 Phase 4e-2 #modal-correct-cta — LabelScannerModal "보정 저장" CTA.
 *
 * ★ §scan-card-declutter (호영님 2026-06-30) supersede (retire → 제거 가드):
 *   LabelScannerModal 의 correct CTA(ocr-correct-button) 제거 — 현 prod jobId null 로
 *   항상 비활성(dead button)이라 작업자에게 무의미. correct route(/api/ocr/correct)는 유지(미호출).
 *   사용자는 폼을 직접 수정 후 "입고 완료"로 진행하면 됨(보정 저장 우회 불필요).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const LABEL_SCANNER_MODAL = readFileSync(
  resolve(__dirname, "../../components/inventory/LabelScannerModal.tsx"),
  "utf8",
);

describe("§scan-card-declutter — LabelScannerModal correct CTA 제거(진화)", () => {
  it("ocr-correct-button 제거 (dead button 0)", () => {
    expect(LABEL_SCANNER_MODAL).not.toMatch(/data-testid=["']ocr-correct-button["']/);
  });
  it("§scan-card-declutter trace marker 존재", () => {
    expect(LABEL_SCANNER_MODAL).toMatch(/§scan-card-declutter/);
  });
  it("ConfidenceBadge(신뢰도) 보존 — 작업자 확인 신호 유지", () => {
    expect(LABEL_SCANNER_MODAL).toMatch(/<ConfidenceBadge level=/);
  });
});
