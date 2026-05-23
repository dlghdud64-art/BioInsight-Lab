/**
 * §11.290 Phase 4e-2 #modal-correct-cta — LabelScannerModal review step
 *   에 "보정 저장" CTA + Phase 4d correct route 호출 handler 추가.
 *
 * 호영님 P1 spec (2026-05-23):
 *   Phase 4e (retry CTA wiring) 완료 후 Phase 4e-2 진입. LabelScannerModal
 *   의 formData (SmartReceiveFormData) 활용 — 사용자가 form input 편집한
 *   결과를 correctedFields body 로 POST /api/ocr/correct/[jobId] 호출.
 *
 * Lock:
 *   - jobId (ocrMetadata.jobId) null 시 disabled
 *   - 503 graceful alert ("Phase 5 후 활성")
 *   - dead button 0 (disabled + title 안내)
 *   - QuoteScannerModal correct CTA 는 풀스펙 form 필요 → 별도 batch
 *
 * Test scope:
 *   1. LabelScannerModal: data-testid="ocr-correct-button" 존재
 *   2. POST /api/ocr/correct/[jobId] 호출
 *   3. correctedFields body 전송 (formData 활용)
 *   4. jobId 없으면 disabled
 *   5. §11.290 Phase 4e-2 trace marker
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const LABEL_SCANNER_MODAL = readFileSync(
  resolve(__dirname, "../../components/inventory/LabelScannerModal.tsx"),
  "utf8",
);

describe("§11.290 Phase 4e-2 — LabelScannerModal correct CTA wiring", () => {
  it("§11.290 Phase 4e-2 trace marker 존재", () => {
    expect(LABEL_SCANNER_MODAL).toMatch(/§11\.290 Phase 4e-2/);
  });

  it("data-testid='ocr-correct-button' 존재", () => {
    expect(LABEL_SCANNER_MODAL).toMatch(/data-testid=["']ocr-correct-button["']/);
  });

  it("correct handler — POST /api/ocr/correct path 호출", () => {
    expect(LABEL_SCANNER_MODAL).toMatch(/\/api\/ocr\/correct\//);
  });

  it("correctedFields body 전송 (formData 활용)", () => {
    expect(LABEL_SCANNER_MODAL).toMatch(/correctedFields/);
    expect(LABEL_SCANNER_MODAL).toMatch(/JSON\.stringify.*correctedFields|correctedFields.*formData/);
  });

  it("jobId 없으면 disabled — guard 존재", () => {
    // correct button 도 jobId null 시 disabled (Phase 4e retry 동일 패턴)
    expect(LABEL_SCANNER_MODAL).toMatch(
      /disabled=\{[^}]*scanResult\?\.ocrMetadata\?\.jobId|ocrMetadata\?\.jobId[^}]*disabled/,
    );
  });

  it("기존 Phase 4e retry button 보존 (회귀 0)", () => {
    expect(LABEL_SCANNER_MODAL).toMatch(/data-testid=["']ocr-retry-button["']/);
  });
});
