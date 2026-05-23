/**
 * §11.290 Phase 4b #label-scanner-metadata — LabelScannerModal 강화:
 *   confidence badge (이미 존재) + ProviderBadge (NEW) + CacheHitIndicator (NEW)
 *   + ocrMetadata 응답 노출.
 *
 * 호영님 P1 spec (2026-05-23):
 *   Phase 4a (route swap) 후 Phase 4b 진입. LabelScannerModal review step 에
 *   - confidence badge (high/medium/low) — 이미 land
 *   - providerUsed badge (Gemini / Vision+Claude / 정규식) — NEW
 *   - cached indicator (캐시 적중) — NEW
 *   - ocrMetadata 응답 필드 (jobId / providerUsed / cached) — NEW
 *
 * Lock:
 *   - Phase 1 OcrJob model + Phase 4a wrapper 의 RunOcrPipelineResult 활용
 *   - STORAGE_PROVIDER 미설정 시 providerUsed="GEMINI", cached=false 기본값
 *
 * Test scope:
 *   1. scan-label/route.ts: ocrMetadata 응답 필드 노출 (providerUsed + cached)
 *   2. LabelScannerModal.tsx: ProviderBadge 컴포넌트 정의
 *   3. LabelScannerModal.tsx: CacheHitIndicator 컴포넌트 정의
 *   4. LabelScannerModal.tsx: data-testid="ocr-provider-badge" 존재
 *   5. LabelScannerModal.tsx: data-testid="ocr-cache-hit" 존재
 *   6. LabelScannerModal.tsx: ScanApiResponse type 에 ocrMetadata optional 필드
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SCAN_LABEL_ROUTE = readFileSync(
  resolve(__dirname, "../../app/api/inventory/scan-label/route.ts"),
  "utf8",
);

const LABEL_SCANNER_MODAL = readFileSync(
  resolve(__dirname, "../../components/inventory/LabelScannerModal.tsx"),
  "utf8",
);

describe("§11.290 Phase 4b — LabelScannerModal metadata 강화", () => {
  // ─── (1) scan-label/route.ts response 에 ocrMetadata 노출 ───
  describe("/api/inventory/scan-label/route.ts ocrMetadata 응답", () => {
    it("§11.290 Phase 4b trace marker 존재", () => {
      expect(SCAN_LABEL_ROUTE).toMatch(/§11\.290 Phase 4b/);
    });

    it("ocrMetadata 변수 outer scope retain (runOcrPipeline 결과 보존)", () => {
      expect(SCAN_LABEL_ROUTE).toMatch(/let ocrMetadata.*\{/);
    });

    it("response JSON 에 ocrMetadata 필드 포함", () => {
      expect(SCAN_LABEL_ROUTE).toMatch(/ocrMetadata,?\s*\n/);
    });

    it("ocrMetadata 가 jobId + providerUsed + cached 3 field 보존", () => {
      expect(SCAN_LABEL_ROUTE).toMatch(/jobId:\s*pipelineResult\.jobId/);
      expect(SCAN_LABEL_ROUTE).toMatch(/providerUsed:\s*pipelineResult\.providerUsed/);
      expect(SCAN_LABEL_ROUTE).toMatch(/cached:\s*pipelineResult\.cached/);
    });
  });

  // ─── (2) LabelScannerModal — Provider badge + Cache hit indicator ───
  describe("LabelScannerModal.tsx 강화", () => {
    it("§11.290 Phase 4b trace marker 존재", () => {
      expect(LABEL_SCANNER_MODAL).toMatch(/§11\.290 Phase 4b/);
    });

    it("ProviderBadge 컴포넌트 정의 (provider 분기)", () => {
      expect(LABEL_SCANNER_MODAL).toMatch(/function ProviderBadge\(/);
    });

    it("CacheHitIndicator 컴포넌트 정의", () => {
      expect(LABEL_SCANNER_MODAL).toMatch(/function CacheHitIndicator\(/);
    });

    it("data-testid='ocr-provider-badge' 존재 (review step)", () => {
      expect(LABEL_SCANNER_MODAL).toMatch(/data-testid=["']ocr-provider-badge["']/);
    });

    it("data-testid='ocr-cache-hit' 존재 (review step)", () => {
      expect(LABEL_SCANNER_MODAL).toMatch(/data-testid=["']ocr-cache-hit["']/);
    });

    it("ScanApiResponse type 에 ocrMetadata optional field 추가", () => {
      expect(LABEL_SCANNER_MODAL).toMatch(/ocrMetadata\?:/);
    });

    it("ProviderBadge — 3 provider label 매핑 (Gemini / Vision\\+Claude / 정규식)", () => {
      expect(LABEL_SCANNER_MODAL).toMatch(/Gemini/);
      expect(LABEL_SCANNER_MODAL).toMatch(/Vision/);
      expect(LABEL_SCANNER_MODAL).toMatch(/정규식/);
    });

    it("기존 ConfidenceBadge 보존 (이미 land, 회귀 0)", () => {
      expect(LABEL_SCANNER_MODAL).toMatch(/function ConfidenceBadge\(/);
      expect(LABEL_SCANNER_MODAL).toMatch(/<ConfidenceBadge level=/);
    });
  });
});
