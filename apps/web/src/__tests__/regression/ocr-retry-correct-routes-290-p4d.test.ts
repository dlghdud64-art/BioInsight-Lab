/**
 * §11.290 Phase 4d #ocr-retry-correct-routes — 2 신규 route NEW:
 *   /api/ocr/retry/[jobId] (provider swap 재처리) + /api/ocr/correct/[jobId]
 *   (수동 보정 결과 저장).
 *
 * 호영님 P1 spec (2026-05-23):
 *   Phase 4c-2 (receiving page trigger) 완료 후 Phase 4d 진입.
 *   재처리 / 수동 보정 surface 확보 — LabelScannerModal / QuoteScannerModal
 *   의 caller 가 향후 호출 (Phase 4c-3 / 4e 별도).
 *
 * Lock:
 *   - STORAGE_PROVIDER 미설정 시 503 graceful response (Phase 5 SDK 후 활성)
 *   - OcrJob.id 검증 + organizationId 격리 (multi-tenant)
 *   - POST method only — params.jobId path 추출
 *   - Phase 5 실제 wiring 은 별도 mini-batch (Vision/Claude SDK 호출)
 *
 * Test scope:
 *   1. /api/ocr/retry/[jobId]/route.ts: 파일 존재 + POST export + auth check
 *      + organizationId 격리 + STORAGE_PROVIDER 미설정 503
 *   2. /api/ocr/correct/[jobId]/route.ts: 파일 존재 + POST export + auth check
 *      + organizationId 격리 + OcrResult update placeholder
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const RETRY_ROUTE_PATH = resolve(
  __dirname,
  "../../app/api/ocr/retry/[jobId]/route.ts",
);

const CORRECT_ROUTE_PATH = resolve(
  __dirname,
  "../../app/api/ocr/correct/[jobId]/route.ts",
);

describe("§11.290 Phase 4d — 2 신규 OCR route (retry + correct)", () => {
  // ─── (1) /api/ocr/retry/[jobId]/route.ts ───
  describe("/api/ocr/retry/[jobId]/route.ts (NEW)", () => {
    it("파일 존재 확인", () => {
      expect(existsSync(RETRY_ROUTE_PATH)).toBe(true);
    });

    it("§11.290 Phase 4d trace marker 존재", () => {
      const src = readFileSync(RETRY_ROUTE_PATH, "utf8");
      expect(src).toMatch(/§11\.290 Phase 4d/);
    });

    it("POST handler export", () => {
      const src = readFileSync(RETRY_ROUTE_PATH, "utf8");
      expect(src).toMatch(/export async function POST/);
    });

    it("auth check + 401 unauthorized response", () => {
      const src = readFileSync(RETRY_ROUTE_PATH, "utf8");
      expect(src).toMatch(/auth\(\)/);
      expect(src).toMatch(/401/);
    });

    it("STORAGE_PROVIDER 미설정 시 503 graceful response", () => {
      const src = readFileSync(RETRY_ROUTE_PATH, "utf8");
      expect(src).toMatch(/STORAGE_PROVIDER/);
      expect(src).toMatch(/503/);
    });

    it("jobId path param 추출 (params.jobId)", () => {
      const src = readFileSync(RETRY_ROUTE_PATH, "utf8");
      expect(src).toMatch(/params.*jobId/);
    });

    it("OcrJob lookup + organizationId 격리", () => {
      const src = readFileSync(RETRY_ROUTE_PATH, "utf8");
      expect(src).toMatch(/db\.ocrJob\.findFirst|db\.ocrJob\.findUnique/);
      expect(src).toMatch(/organizationId/);
    });
  });

  // ─── (2) /api/ocr/correct/[jobId]/route.ts ───
  describe("/api/ocr/correct/[jobId]/route.ts (NEW)", () => {
    it("파일 존재 확인", () => {
      expect(existsSync(CORRECT_ROUTE_PATH)).toBe(true);
    });

    it("§11.290 Phase 4d trace marker 존재", () => {
      const src = readFileSync(CORRECT_ROUTE_PATH, "utf8");
      expect(src).toMatch(/§11\.290 Phase 4d/);
    });

    it("POST handler export", () => {
      const src = readFileSync(CORRECT_ROUTE_PATH, "utf8");
      expect(src).toMatch(/export async function POST/);
    });

    it("auth check + 401 unauthorized response", () => {
      const src = readFileSync(CORRECT_ROUTE_PATH, "utf8");
      expect(src).toMatch(/auth\(\)/);
      expect(src).toMatch(/401/);
    });

    it("STORAGE_PROVIDER 미설정 시 503 graceful response", () => {
      const src = readFileSync(CORRECT_ROUTE_PATH, "utf8");
      expect(src).toMatch(/STORAGE_PROVIDER/);
      expect(src).toMatch(/503/);
    });

    it("jobId path param + correctedFields body 추출", () => {
      const src = readFileSync(CORRECT_ROUTE_PATH, "utf8");
      expect(src).toMatch(/params.*jobId/);
      expect(src).toMatch(/correctedFields/);
    });

    it("OcrJob lookup + organizationId 격리", () => {
      const src = readFileSync(CORRECT_ROUTE_PATH, "utf8");
      expect(src).toMatch(/db\.ocrJob\.findFirst|db\.ocrJob\.findUnique/);
      expect(src).toMatch(/organizationId/);
    });
  });
});
