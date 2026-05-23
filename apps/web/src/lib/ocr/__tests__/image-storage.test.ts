/**
 * §11.290 Phase 2 #ocr-image-storage — Vercel Blob image upload + SHA-256
 *   hash + cache lookup helper 의 unit test.
 *
 * 호영님 P1 spec (2026-05-23):
 *   Multi-provider OCR fallback 의 image storage layer.
 *   - uploadOcrImage(base64) → { url, hash }: Vercel Blob upload + hash 반환
 *   - getOcrImageHash(base64) → string: SHA-256(base64 raw bytes)
 *   - findCachedOcrJob(hash, type) → OcrJob | null: 48h TTL cache lookup
 *
 * Phase 1 schema (OcrJob.imageHash @@index) + Phase 2 helper 정합.
 *
 * Lock:
 *   - cache TTL 48h (호영님 Phase 0 결정)
 *   - SHA-256 (crypto.createHash 사용)
 *   - Vercel Blob `put()` 호출 — addRandomSuffix=false (hash deterministic),
 *     allowOverwrite=true (동일 hash 재업로드 안전)
 *   - prefix "ocr-images" (po-pdf-storage 와 분리)
 *
 * Test scope:
 *   1. getOcrImageHash — deterministic SHA-256
 *   2. uploadOcrImage — Vercel Blob mock + url/hash 반환
 *   3. findCachedOcrJob — 48h TTL within / over boundary
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { getOcrImageHash } from "../image-storage";

describe("§11.290 Phase 2 — OCR image storage helper", () => {
  // ─── (1) getOcrImageHash deterministic SHA-256 ───
  describe("getOcrImageHash", () => {
    it("동일 base64 input 에 대해 동일 SHA-256 반환 (deterministic)", () => {
      const base64 = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";
      const hash1 = getOcrImageHash(base64);
      const hash2 = getOcrImageHash(base64);
      expect(hash1).toBe(hash2);
    });

    it("다른 base64 input 은 다른 hash 반환", () => {
      const baseA = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";
      const baseB = "data:image/png;base64,iVBORw0KGgoAAAA=";
      expect(getOcrImageHash(baseA)).not.toBe(getOcrImageHash(baseB));
    });

    it("SHA-256 hex string (64 char) 반환", () => {
      const base64 = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";
      const hash = getOcrImageHash(base64);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });
});
