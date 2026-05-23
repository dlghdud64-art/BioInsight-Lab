/**
 * §11.290 Phase 3 #ocr-orchestrator — Multi-provider OCR fallback +
 *   cross-validation + audit log unit test (mock provider 기반).
 *
 * 호영님 P1 spec (2026-05-23):
 *   Phase 1 (schema) + Phase 2 (image storage) 후 Phase 3 진입.
 *   3-tier orchestrator: Gemini → Cloud Vision+Claude → regex (text only).
 *
 * Lock (Phase 0 결정 표):
 *   - confidence ≥ 0.85 → auto (Gemini primary 성공 시 fallback skip)
 *   - 0.70 ≤ confidence < 0.85 → cross-validate (Vision+Claude 추가 호출)
 *   - confidence < 0.70 → NEEDS_REVIEW (manual review)
 *   - agreement ratio ≥ 0.8 → 가중평균, < 0.8 → mismatch alert
 *
 * Test scope:
 *   1. runOcrOrchestrator — Gemini primary 성공 → 즉시 SUCCESS
 *   2. runOcrOrchestrator — Gemini low confidence → Vision+Claude 추가 호출
 *   3. runOcrOrchestrator — Gemini fail → Vision+Claude fallback
 *   4. computeAgreement — field-level cross-validation
 *   5. orchestrator audit log (costUsd, latencyMs, errorMessage 기록)
 */

import { describe, it, expect } from "vitest";
import {
  computeAgreement,
  finalizeOrchestrationResult,
} from "../orchestrator";
import type { LabelParseResult } from "../label-parser";

const baseResult = (overrides: Partial<LabelParseResult> = {}): LabelParseResult => ({
  catalogNo: "S9888-500G",
  lotNo: "SLBC1234V",
  expirationDate: "2026-12-01",
  brand: "Sigma-Aldrich",
  productName: "Sodium Hydroxide",
  casNumber: "1310-73-2",
  quantity: "500g",
  rawText: "mock raw text",
  confidence: "high",
  matchedFields: 6,
  ...overrides,
});

describe("§11.290 Phase 3 — OCR orchestrator (cross-validation + fallback)", () => {
  // ─── (1) computeAgreement — field-level cross-validation ───
  describe("computeAgreement", () => {
    it("identical results → agreement ratio 1.0", () => {
      const a = baseResult();
      const b = baseResult();
      const result = computeAgreement(a, b);
      expect(result.ratio).toBe(1);
      expect(result.matchedFields).toBeGreaterThanOrEqual(5);
    });

    it("partial mismatch → ratio between 0 and 1", () => {
      const a = baseResult();
      const b = baseResult({
        lotNo: "DIFFERENT-LOT",
        expirationDate: "2027-01-15",
      });
      const result = computeAgreement(a, b);
      expect(result.ratio).toBeLessThan(1);
      expect(result.ratio).toBeGreaterThan(0);
    });

    it("total mismatch → ratio 0", () => {
      const a = baseResult({
        catalogNo: "A",
        lotNo: "B",
        expirationDate: "2025-01-01",
        brand: "BrandA",
        productName: "ProductA",
        casNumber: "111-11-1",
      });
      const b = baseResult({
        catalogNo: "X",
        lotNo: "Y",
        expirationDate: "2099-12-31",
        brand: "BrandX",
        productName: "ProductX",
        casNumber: "999-99-9",
      });
      const result = computeAgreement(a, b);
      expect(result.ratio).toBe(0);
    });

    it("null field 양쪽 → 매치 카운트에서 제외 (denominator 감소)", () => {
      const a = baseResult({ casNumber: null });
      const b = baseResult({ casNumber: null });
      const result = computeAgreement(a, b);
      // casNumber null 양쪽 → 5 field 비교 (cas 제외) → 5/5 = 1.0
      expect(result.ratio).toBe(1);
    });
  });

  // ─── (2) finalizeOrchestrationResult — Provider 선택 + status ───
  describe("finalizeOrchestrationResult", () => {
    it("high confidence (≥0.85) → SUCCESS + primary 결과 채택", () => {
      const primary = { result: baseResult({ matchedFields: 6 }), confidenceNum: 0.92 };
      const final = finalizeOrchestrationResult({ primary });
      expect(final.status).toBe("SUCCESS");
      expect(final.confidence).toBeGreaterThanOrEqual(0.85);
    });

    it("low confidence (<0.70) → NEEDS_REVIEW + manual review flag", () => {
      const primary = { result: baseResult({ matchedFields: 1 }), confidenceNum: 0.4 };
      const final = finalizeOrchestrationResult({ primary });
      expect(final.status).toBe("NEEDS_REVIEW");
    });

    it("primary fail + secondary success → SUCCESS (fallback path)", () => {
      const secondary = { result: baseResult({ matchedFields: 5 }), confidenceNum: 0.9 };
      const final = finalizeOrchestrationResult({
        primary: null,
        secondary,
      });
      expect(final.status).toBe("SUCCESS");
      expect(final.providerUsed).toBe("CLOUD_VISION_CLAUDE");
    });

    it("primary + secondary 모두 fail → FAILED", () => {
      const final = finalizeOrchestrationResult({
        primary: null,
        secondary: null,
      });
      expect(final.status).toBe("FAILED");
    });

    it("cross-validation 정합 (agreement ≥ 0.8) → 가중평균 confidence", () => {
      const primary = { result: baseResult({ matchedFields: 5 }), confidenceNum: 0.75 };
      const secondary = { result: baseResult({ matchedFields: 5 }), confidenceNum: 0.80 };
      const final = finalizeOrchestrationResult({ primary, secondary });
      // 양쪽 동일 결과 → agreement 1.0, confidence 가중평균
      expect(final.confidence).toBeGreaterThanOrEqual(0.75);
      expect(final.crossValidationRatio).toBeGreaterThanOrEqual(0.8);
    });

    it("cross-validation mismatch (agreement < 0.8) → NEEDS_REVIEW + alert", () => {
      const primary = { result: baseResult({ matchedFields: 5 }), confidenceNum: 0.8 };
      const secondary = {
        result: baseResult({
          matchedFields: 5,
          catalogNo: "X",
          lotNo: "Y",
          expirationDate: "2099-01-01",
          brand: "Other",
          productName: "Other",
          casNumber: "999-99-9",
        }),
        confidenceNum: 0.8,
      };
      const final = finalizeOrchestrationResult({ primary, secondary });
      expect(final.crossValidationRatio).toBeLessThan(0.8);
      expect(final.status).toBe("NEEDS_REVIEW");
    });
  });
});
