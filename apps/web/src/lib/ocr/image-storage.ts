/**
 * §11.290 Phase 2 #ocr-image-storage — Vercel Blob image upload + SHA-256
 *   hash + cache lookup helper.
 *
 * §11.290 Phase 5.5.b — PDF buffer upload + SHA-256 hash 추가
 *   (uploadOcrPdf + getOcrPdfHash). image-storage 의 image/* mime 제약 해소.
 *   PDF 거래명세서도 audit log + cache 활성 가능. prefix "ocr-pdfs/" 로
 *   image ("ocr-images/") 와 분리 — audit/cost monitoring 카테고리 명확.
 *
 * 호영님 P1 spec (2026-05-23):
 *   Multi-provider OCR fallback (Phase 3+) 의 image storage layer.
 *   imageHash 로 cache lookup → 같은 라벨 재스캔 시 API 호출 0.
 *
 * Phase 1 schema 정합:
 *   - OcrJob.imageHash @@index (cache lookup O(log n))
 *   - OcrJob.imageUrl (Vercel Blob URL 영구 저장)
 *   - 48h TTL within → cached job 재사용
 *   - PDF case 도 OcrJob.imageHash / imageUrl 컬럼 재활용 (schema 변경 0)
 *
 * 호영님 Phase 0 결정:
 *   - @vercel/blob ^2.3.3 이미 설치
 *   - po-pdf-storage.ts 와 동일 abstraction 패턴 — 단, OCR 은 `vercel-blob`
 *     provider 만 우선 지원 (별도 batch 에서 supabase/s3 확장)
 *
 * Lock:
 *   - prefix "ocr-images" (image) / "ocr-pdfs" (PDF) 분리
 *   - SHA-256(raw bytes) — image: base64 strip, PDF: buffer 직접
 *   - put({ addRandomSuffix: false, allowOverwrite: true }) — hash deterministic
 *   - graceful degradation — STORAGE_PROVIDER 미설정 시 throw → caller fallback
 */

import { createHash } from "node:crypto";
import type { OcrJob, OcrJobType } from "@prisma/client";

// db 는 함수 내부 lazy import (sandbox vitest path alias 해석 회피).
// Production runtime 에서는 정상 import. Phase 1 sentinel + Phase 2 unit
// test (getOcrImageHash) 가 db 의존성 없이 검증 가능하도록 분리.

const CACHE_TTL_HOURS = 48;

export class OcrStorageNotConfiguredError extends Error {
  constructor() {
    super(
      "OCR image storage provider 가 설정되지 않았습니다. STORAGE_PROVIDER env var 확인 필요.",
    );
    this.name = "OcrStorageNotConfiguredError";
  }
}

export interface UploadOcrImageInput {
  /** Image data URI 또는 raw base64 string. */
  base64: string;
  /** OcrJob.organizationId — multi-tenant key prefix 격리용. */
  organizationId: string;
  /** OcrJob.type — LABEL / QUOTE. */
  type: OcrJobType;
}

export interface UploadOcrImageResult {
  /** Vercel Blob public URL — OcrJob.imageUrl 저장. */
  url: string;
  /** SHA-256(base64 raw bytes) — OcrJob.imageHash 저장 + cache lookup key. */
  hash: string;
  /** storage provider name (audit metadata). */
  provider: string;
}

/**
 * base64 data URI 또는 raw base64 → SHA-256 hex hash (64 char).
 *
 * data URI prefix (`data:image/...;base64,`) 제거 후 raw bytes hash.
 * 동일 image 의 mime type 변경에 영향 받지 않도록 normalize.
 */
export function getOcrImageHash(base64: string): string {
  const raw = base64.replace(/^data:[^;]+;base64,/, "");
  return createHash("sha256").update(raw).digest("hex");
}

/**
 * Vercel Blob 에 image upload + SHA-256 hash 반환.
 *
 * STORAGE_PROVIDER 미설정 시 OcrStorageNotConfiguredError throw —
 * caller (orchestrator) 가 try/catch 로 graceful fallback (in-memory 처리만).
 */
export async function uploadOcrImage(
  input: UploadOcrImageInput,
): Promise<UploadOcrImageResult> {
  const provider = process.env.STORAGE_PROVIDER ?? "";
  if (!provider) {
    throw new OcrStorageNotConfiguredError();
  }

  const hash = getOcrImageHash(input.base64);
  // mime type 추출 (default jpeg)
  const mimeMatch = input.base64.match(/^data:(image\/\w+);base64,/);
  const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
  const ext = mimeType.split("/")[1] || "jpg";
  // multi-tenant key prefix + type + hash + ext (deterministic)
  const key = `ocr-images/${input.organizationId}/${input.type.toLowerCase()}/${hash}.${ext}`;

  const rawBase64 = input.base64.replace(/^data:[^;]+;base64,/, "");
  const buffer = Buffer.from(rawBase64, "base64");

  switch (provider) {
    case "vercel-blob": {
      // host install: @vercel/blob ^2.3.3 (이미 설치)
      // env: BLOB_READ_WRITE_TOKEN (Vercel 환경 자동, 또는 .env)
      const { put } = await import("@vercel/blob");
      const result = await put(key, buffer, {
        access: "public",
        contentType: mimeType,
        // addRandomSuffix=false — hash 기반 deterministic key
        // allowOverwrite=true — 동일 hash 재업로드 safe (idempotent)
        addRandomSuffix: false,
        allowOverwrite: true,
      });
      return { url: result.url, hash, provider };
    }
    case "supabase":
    case "s3": {
      throw new Error(
        `OCR image storage provider "${provider}" not implemented (별도 batch).`,
      );
    }
    default:
      throw new Error(`Unsupported STORAGE_PROVIDER: ${provider}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// §11.290 Phase 5.5.b — PDF buffer upload + SHA-256 hash (quote pipeline)
// ─────────────────────────────────────────────────────────────────────────

export interface UploadOcrPdfInput {
  /** PDF binary Buffer (quote pipeline parseQuotePDFWithGemini 와 동일 입력). */
  buffer: Buffer;
  /** OcrJob.organizationId — multi-tenant key prefix 격리용. */
  organizationId: string;
}

/**
 * PDF Buffer → SHA-256 hex hash (64 char).
 *
 * base64 변환 불필요 — buffer 직접 hash. image 와 cache key space 분리
 * (collision 확률 사실상 0 이지만 의미적 분리).
 */
export function getOcrPdfHash(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

/**
 * §11.290 Phase 5.5.b — Vercel Blob 에 PDF upload + SHA-256 hash 반환.
 *
 * prefix "ocr-pdfs/" (image 의 "ocr-images/" 와 분리).
 * mime type: application/pdf.
 * STORAGE_PROVIDER 미설정 시 OcrStorageNotConfiguredError throw —
 * caller (orchestrator) 가 try/catch 로 graceful fallback.
 *
 * OcrJob.type 은 caller 가 "QUOTE" 로 set (PDF 는 quote 전용).
 * Key: ocr-pdfs/{organizationId}/{hash}.pdf
 */
export async function uploadOcrPdf(
  input: UploadOcrPdfInput,
): Promise<UploadOcrImageResult> {
  const provider = process.env.STORAGE_PROVIDER ?? "";
  if (!provider) {
    throw new OcrStorageNotConfiguredError();
  }

  const hash = getOcrPdfHash(input.buffer);
  // multi-tenant key prefix + hash + .pdf ext (deterministic)
  const key = `ocr-pdfs/${input.organizationId}/${hash}.pdf`;

  switch (provider) {
    case "vercel-blob": {
      const { put } = await import("@vercel/blob");
      const result = await put(key, input.buffer, {
        access: "public",
        contentType: "application/pdf",
        // addRandomSuffix=false + allowOverwrite=true — image 패턴 정합
        addRandomSuffix: false,
        allowOverwrite: true,
      });
      return { url: result.url, hash, provider };
    }
    case "supabase":
    case "s3": {
      throw new Error(
        `OCR PDF storage provider "${provider}" not implemented (별도 batch).`,
      );
    }
    default:
      throw new Error(`Unsupported STORAGE_PROVIDER: ${provider}`);
  }
}

/**
 * imageHash + type 으로 48h TTL 이내 cached OcrJob 조회.
 *
 * Cache hit:
 *   - 같은 image (동일 SHA-256) + 같은 type (LABEL/QUOTE) + 48h 이내 createdAt
 *   - status SUCCESS or NEEDS_REVIEW (FAILED/PENDING/RUNNING 은 cache 미사용)
 *
 * Cache miss → null. Caller (orchestrator) 가 새 OcrJob 생성 + provider 호출.
 */
export async function findCachedOcrJob(
  imageHash: string,
  type: OcrJobType,
): Promise<OcrJob | null> {
  // Lazy import — sandbox vitest path alias 해석 회피 (top-level import 시
  // unit test 가 module resolution 단계에서 실패). Production runtime 정상.
  const { db } = await import("@/lib/db");
  const cutoff = new Date(Date.now() - CACHE_TTL_HOURS * 60 * 60 * 1000);
  return db.ocrJob.findFirst({
    where: {
      imageHash,
      type,
      status: { in: ["SUCCESS", "NEEDS_REVIEW"] },
      createdAt: { gte: cutoff },
    },
    orderBy: { createdAt: "desc" },
  });
}
