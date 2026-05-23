/**
 * §11.290 Phase 5.5 #audit-log-wiring — Phase 5 wiring (b2bfd3d) 의 audit log
 *   gap 보강 검증. run-ocr-pipeline.ts + run-quote-ocr-pipeline.ts 의 모든
 *   path 에서 image upload + cache lookup + OcrJob/OcrResult.create +
 *   costUsd populate 호출 sentinel.
 *
 * 호영님 P1 spec (2026-05-23):
 *   Phase 5 wiring 후 Phase 6 cost monitoring 의 데이터 소스 부재 발견 →
 *   Phase 5.5 가 source 정착. label + quote 두 pipeline 모두 동등 처리.
 *
 * Lock (graceful fallback 보존):
 *   - happy path: uploadOcrImage → findCachedOcrJob → OcrJob.create →
 *     Tier 1/2 → OcrResult.create → OcrJob.update
 *   - upload 실패 path: try/catch → jobId: null fallback (b2bfd3d 패턴)
 *   - cache hit path: 즉시 반환 + cached: true + jobId 보존
 *
 * Test scope (8 it):
 *   1. trace marker §11.290 Phase 5.5
 *   2. uploadOcrImage 호출 (label)
 *   3. findCachedOcrJob 호출 (label)
 *   4. OcrJob.create 호출 (label)
 *   5. OcrResult.create 호출 (label)
 *   6. Tier 2 costUsd destructure (visionResult + claudeResult)
 *   7. quote pipeline uploadOcrImage + OcrJob.create (quote 동등)
 *   8. graceful fallback (try/catch + jobId: null 보존)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const LABEL_PIPELINE = readFileSync(
  resolve(__dirname, "../../lib/ocr/run-ocr-pipeline.ts"),
  "utf8",
);

const QUOTE_PIPELINE = readFileSync(
  resolve(__dirname, "../../lib/ocr/run-quote-ocr-pipeline.ts"),
  "utf8",
);

describe("§11.290 Phase 5.5 — audit log + cache wiring (label + quote pipeline)", () => {
  it("§11.290 Phase 5.5 trace marker 존재 (label pipeline)", () => {
    expect(LABEL_PIPELINE).toMatch(/§11\.290 Phase 5\.5/);
  });

  describe("label pipeline — run-ocr-pipeline.ts", () => {
    it("uploadOcrImage 호출 (image storage upload)", () => {
      expect(LABEL_PIPELINE).toMatch(/uploadOcrImage\s*\(/);
    });

    it("findCachedOcrJob 호출 (48h TTL cache lookup)", () => {
      expect(LABEL_PIPELINE).toMatch(/findCachedOcrJob\s*\(/);
    });

    it("OcrJob.create 호출 (audit log row INSERT)", () => {
      // db.ocrJob.create 또는 ocrJob.create 또는 prisma.ocrJob.create
      expect(LABEL_PIPELINE).toMatch(/ocrJob\.create\s*\(/);
    });

    it("OcrResult.create 호출 (per-provider result INSERT)", () => {
      expect(LABEL_PIPELINE).toMatch(/ocrResult\.create\s*\(/);
    });

    it("Tier 2 costUsd destructure (visionResult.costUsd + claudeResult.costUsd)", () => {
      // costUsd 계산 또는 destructure pattern
      // visionResult.costUsd 또는 claudeResult.costUsd 또는 costUsd: visionResult
      const hasCostUsage =
        /visionResult\.costUsd/.test(LABEL_PIPELINE) ||
        /claudeResult\.costUsd/.test(LABEL_PIPELINE) ||
        /costUsd:\s*(visionResult|claudeResult)/.test(LABEL_PIPELINE);
      expect(hasCostUsage).toBe(true);
    });

    it("graceful fallback — uploadOcrImage 실패 시 jobId: null 보존", () => {
      // try/catch + jobId: null fallback pattern (b2bfd3d 보존)
      expect(LABEL_PIPELINE).toMatch(/try\s*{/);
      expect(LABEL_PIPELINE).toMatch(/jobId:\s*null/);
    });
  });

  describe("quote pipeline — run-quote-ocr-pipeline.ts", () => {
    it("§11.290 Phase 5.5 trace marker 존재 + uploadOcrImage + OcrJob.create (image + PDF 동등)", () => {
      expect(QUOTE_PIPELINE).toMatch(/§11\.290 Phase 5\.5/);
      expect(QUOTE_PIPELINE).toMatch(/uploadOcrImage\s*\(/);
      expect(QUOTE_PIPELINE).toMatch(/ocrJob\.create\s*\(/);
    });
  });
});
