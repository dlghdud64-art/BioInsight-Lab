/**
 * §11.290 Phase 4b #label-scanner-metadata — (route) ocrMetadata 응답 노출 유지.
 *
 * ★ §scan-card-declutter (호영님 2026-06-30) supersede:
 *   LabelScannerModal user 카드에서 ProviderBadge(사용 경로/폴백) + CacheHitIndicator(캐시 적중)
 *   제거 — 내부 관측용 메타라 작업자에게 불필요. route 의 ocrMetadata 응답은 유지(수신은 하되 표시 안 함).
 *   ConfidenceBadge(신뢰도)만 유지 — 자동 인식값 확인 신호.
 *
 * 잔존 lock(유지):
 *   - scan-label/route.ts: ocrMetadata 응답 필드(jobId/providerUsed/cached) — 변경 0
 *   - LabelScannerModal: ScanApiResponse.ocrMetadata optional 타입(응답 수신)
 *   - ConfidenceBadge 보존
 * 진화 lock(제거 강제):
 *   - ProviderBadge / CacheHitIndicator 컴포넌트 정의 + ocr-provider-badge / ocr-cache-hit testid 제거
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

describe("§11.290 Phase 4b — scan-label route ocrMetadata 응답(유지)", () => {
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

describe("§scan-card-declutter — LabelScannerModal 관측 배지 제거(진화)", () => {
  it("ProviderBadge 정의 제거 (사용 경로/폴백 = 내부 관측용)", () => {
    expect(LABEL_SCANNER_MODAL).not.toMatch(/function ProviderBadge\(/);
    expect(LABEL_SCANNER_MODAL).not.toMatch(/data-testid=["']ocr-provider-badge["']/);
    expect(LABEL_SCANNER_MODAL).not.toMatch(/data-testid=["']ocr-fallback-badge["']/);
  });
  it("CacheHitIndicator 정의 + ocr-cache-hit testid 제거", () => {
    expect(LABEL_SCANNER_MODAL).not.toMatch(/function CacheHitIndicator\(/);
    expect(LABEL_SCANNER_MODAL).not.toMatch(/data-testid=["']ocr-cache-hit["']/);
  });
  it("§scan-card-declutter trace marker 존재", () => {
    expect(LABEL_SCANNER_MODAL).toMatch(/§scan-card-declutter/);
  });
  it("ConfidenceBadge 보존 (신뢰도만 유지, 회귀 0)", () => {
    expect(LABEL_SCANNER_MODAL).toMatch(/function ConfidenceBadge\(/);
    expect(LABEL_SCANNER_MODAL).toMatch(/<ConfidenceBadge level=/);
  });
  it("ScanApiResponse ocrMetadata optional 타입 보존(응답 수신은 유지)", () => {
    expect(LABEL_SCANNER_MODAL).toMatch(/ocrMetadata\?:/);
  });
});
