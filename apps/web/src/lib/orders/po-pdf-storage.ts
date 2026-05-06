/**
 * #post-approval-purchase-order-flow Phase 2.3 step 2 — PO PDF storage helper.
 *
 * vendor 별 PO PDF 영속화 — generated Buffer 를 storage 에 upload 하고 URL
 * 반환. caller (api/orders/[id]/generate-pdf) 가 결과 URL 을 Order.poDocumentUrl
 * 에 저장.
 *
 * Provider 분기 (env `STORAGE_PROVIDER`):
 *   - "vercel-blob" — Vercel Blob (host install: `npm install @vercel/blob`,
 *                      env `BLOB_READ_WRITE_TOKEN` 설정)
 *   - "supabase"    — Supabase Storage (host install: `@supabase/supabase-js`,
 *                      env `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` /
 *                      `SUPABASE_PO_BUCKET`)
 *   - "s3"          — AWS S3 (host install: `@aws-sdk/client-s3`, env
 *                      `AWS_S3_BUCKET` / `AWS_ACCESS_KEY_ID` 등)
 *   - default (미설정) — `StorageNotConfiguredError` throw → caller 가 stream
 *                       fallback (graceful degradation)
 *
 * 본 batch 는 abstraction + 미설정 throw 만 — 실제 provider wiring (각 SDK
 * 호출) 은 호영님 host 결정 후 별도 mini-batch.
 *
 * Lock:
 *   - filename 은 `${orderNumber}.pdf` 가정 (caller 책임)
 *   - URL 은 storage provider 가 반환한 public/signed URL 그대로 (caller 가
 *     Order.poDocumentUrl 저장)
 *   - 호출 실패 시 throw (caller 가 graceful fallback)
 */

export class StorageNotConfiguredError extends Error {
  constructor() {
    super(
      "PDF storage provider 가 설정되지 않았습니다. STORAGE_PROVIDER env var 확인 필요.",
    );
    this.name = "StorageNotConfiguredError";
  }
}

export interface UploadPoPdfInput {
  /** PDF binary content. */
  buffer: Buffer;
  /** 저장 filename (확장자 포함). 예: "ORD-20260506-AB12.pdf". */
  filename: string;
  /** organization 별 prefix (멀티테넌시 격리). 미전달 시 default `"po-pdfs"`. */
  prefix?: string;
}

export interface UploadPoPdfResult {
  /** storage 가 반환한 public/signed URL — Order.poDocumentUrl 에 저장. */
  url: string;
  /** storage provider name (audit metadata 용). */
  provider: string;
}

/**
 * PDF Buffer 를 storage 에 upload 하고 URL 반환.
 *
 * 미설정 시 `StorageNotConfiguredError` throw — caller 가 try/catch 로 graceful
 * fallback (PDF stream 응답만, db 업데이트 0).
 */
export async function uploadPoPdf(
  input: UploadPoPdfInput,
): Promise<UploadPoPdfResult> {
  const provider = process.env.STORAGE_PROVIDER ?? "";
  const prefix = input.prefix ?? "po-pdfs";
  const key = `${prefix}/${input.filename}`;

  if (!provider) {
    throw new StorageNotConfiguredError();
  }

  // 호영님 host config 후 각 provider SDK 호출. 본 batch 는 abstraction
  // 만 — 별도 mini-batch 에서 provider 별 wiring.
  switch (provider) {
    case "vercel-blob": {
      // #post-approval-purchase-order-flow Phase 2.3 step 3 — Vercel Blob
      // SDK wiring. dynamic import — host 측 `npm install @vercel/blob`
      // 미설치 시 runtime 에 throw → caller graceful fallback (stream 응답).
      // env: `BLOB_READ_WRITE_TOKEN` (Vercel 환경 자동, 또는 .env).
      const { put } = await import("@vercel/blob");
      const result = await put(key, input.buffer, {
        access: "public",
        contentType: "application/pdf",
        // addRandomSuffix=false — orderNumber 기반 deterministic key,
        // 동일 Order 재생성 시 덮어쓰기 (overwrite=true 명시).
        addRandomSuffix: false,
        allowOverwrite: true,
      });
      return { url: result.url, provider };
    }
    case "supabase": {
      // host install: `@supabase/supabase-js`
      // env: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_PO_BUCKET
      throw new Error("Supabase Storage wiring not implemented (별도 batch).");
    }
    case "s3": {
      // host install: `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`
      // env: AWS_S3_BUCKET / AWS_REGION / AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY
      throw new Error("AWS S3 wiring not implemented (별도 batch).");
    }
    default:
      throw new Error(`Unsupported STORAGE_PROVIDER: ${provider}`);
  }
}
