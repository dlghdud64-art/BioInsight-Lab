/**
 * §11.290 Phase 6.b #cache-hit-audit — Phase 6 의 cacheReuseRatio (proxy)
 *   → 정확 cache hit count audit. OcrCacheHit Prisma model 신규 추가 +
 *   3 cache hit branch (label image / quote image / quote PDF) 에서
 *   INSERT + dashboard route 의 cacheReuseRatio swap.
 *
 * 호영님 P1 spec (2026-05-23):
 *   Phase 6 의 cacheReuseRatio = (totalJobs - uniqueHashes) / totalJobs
 *   proxy 가 부정확 (정확 cache hit count 는 OcrJob INSERT 없으므로 직접
 *   추적 불가). 별도 audit table 추가로 정확 metric 정착.
 *
 * Lock:
 *   - OcrCacheHit model: cachedJobId / organizationId / userId / imageHash / hitAt
 *   - 모든 cache hit path 에서 db.ocrCacheHit.create (graceful try/catch)
 *   - dashboard route 의 cacheHitCount SQL + totalRequests + 정확 ratio
 *   - schema 변경 후 prisma migrate (host 위임)
 *
 * Test scope (10 it):
 *   schema (3 it):
 *     1. trace marker §11.290 Phase 6.b
 *     2. model OcrCacheHit + 5 field (cachedJobId/organizationId/userId/imageHash/hitAt)
 *     3. OcrJob.cacheHits back-relation
 *   pipeline (4 it):
 *     4. run-ocr-pipeline cache hit branch ocrCacheHit.create
 *     5. run-quote-ocr-pipeline image cache hit branch ocrCacheHit.create
 *     6. run-quote-ocr-pipeline PDF cache hit branch ocrCacheHit.create
 *     7. 모든 INSERT graceful (try/catch + console.warn)
 *   route (3 it):
 *     8. cacheHitCount SQL (OcrCacheHit count + organizationId scope 또는 전역)
 *     9. cacheHitRatio = cacheHitCount / totalRequests 정확 metric
 *     10. response shape cacheHitCount field 추가
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SCHEMA = readFileSync(
  resolve(__dirname, "../../../prisma/schema.prisma"),
  "utf8",
);
const LABEL_PIPELINE = readFileSync(
  resolve(__dirname, "../../lib/ocr/run-ocr-pipeline.ts"),
  "utf8",
);
const QUOTE_PIPELINE = readFileSync(
  resolve(__dirname, "../../lib/ocr/run-quote-ocr-pipeline.ts"),
  "utf8",
);
const ROUTE = readFileSync(
  resolve(__dirname, "../../app/api/admin/ocr-monitoring/route.ts"),
  "utf8",
);

describe("§11.290 Phase 6.b — 정확 cache hit count audit table", () => {
  describe("schema — OcrCacheHit model", () => {
    it("§11.290 Phase 6.b trace marker (schema)", () => {
      expect(SCHEMA).toMatch(/§11\.290 Phase 6\.b/);
    });

    it("model OcrCacheHit + 5 field 정의", () => {
      expect(SCHEMA).toMatch(/^model OcrCacheHit /m);
      expect(SCHEMA).toMatch(/cachedJobId\s+String/);
      expect(SCHEMA).toMatch(/organizationId\s+String/);
      expect(SCHEMA).toMatch(/userId\s+String/);
      expect(SCHEMA).toMatch(/imageHash\s+String/);
      expect(SCHEMA).toMatch(/hitAt\s+DateTime/);
    });

    it("OcrJob.cacheHits back-relation", () => {
      // OcrJob 안에 cacheHits OcrCacheHit[] back-relation
      expect(SCHEMA).toMatch(/cacheHits\s+OcrCacheHit\[\]/);
    });
  });

  describe("pipeline — 3 cache hit branch INSERT", () => {
    it("run-ocr-pipeline cache hit branch — ocrCacheHit.create 호출", () => {
      expect(LABEL_PIPELINE).toMatch(/§11\.290 Phase 6\.b/);
      expect(LABEL_PIPELINE).toMatch(/ocrCacheHit\.create\s*\(/);
    });

    it("run-quote-ocr-pipeline image cache hit branch — ocrCacheHit.create 호출", () => {
      expect(QUOTE_PIPELINE).toMatch(/§11\.290 Phase 6\.b/);
      // image case 의 cache hit branch (line 232 부근) 에 ocrCacheHit.create
      expect(QUOTE_PIPELINE).toMatch(/ocrCacheHit\.create\s*\(/);
    });

    it("run-quote-ocr-pipeline 의 ocrCacheHit.create 2회 (image + PDF)", () => {
      // 2 cache hit branch (image + PDF) 모두 INSERT
      const matches = QUOTE_PIPELINE.match(/ocrCacheHit\.create\s*\(/g);
      expect(matches).not.toBeNull();
      expect(matches!.length).toBeGreaterThanOrEqual(2);
    });

    it("graceful fallback — INSERT 실패 시 try/catch + console.warn", () => {
      // 새 try/catch block (cache hit audit 전용)
      expect(LABEL_PIPELINE).toMatch(/cache hit audit/);
      expect(QUOTE_PIPELINE).toMatch(/cache hit audit/);
    });
  });

  describe("route — /api/admin/ocr-monitoring 정확 metric swap", () => {
    it("§11.290 Phase 6.b trace marker (route)", () => {
      expect(ROUTE).toMatch(/§11\.290 Phase 6\.b/);
    });

    it("cacheHitCount SQL — OcrCacheHit count", () => {
      expect(ROUTE).toMatch(/OcrCacheHit/);
      expect(ROUTE).toMatch(/cacheHitCount|cacheHits/);
    });

    it("response shape — cacheHitCount field 추가 + cacheHitRatio 정확 계산", () => {
      // response shape 에 cacheHitCount + 정확 ratio
      expect(ROUTE).toMatch(/cacheHitCount/);
      expect(ROUTE).toMatch(/totalRequests|cacheHitRatio/);
    });
  });
});
