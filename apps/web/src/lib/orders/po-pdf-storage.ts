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

import { randomUUID } from "node:crypto";

export interface UploadPoPdfInput {
  /** PDF binary content. */
  buffer: Buffer;
  /** 저장 filename (확장자 포함). 예: "ORD-20260506-AB12.pdf". */
  filename: string;
  /** organization 별 prefix (멀티테넌시 격리). 미전달 시 default `"po-pdfs"`. */
  prefix?: string;
}

export interface UploadPoPdfResult {
  /** storage 원본 URL. 🛑 private 이라 이 URL 을 그대로 열 수 없다 — 프록시 라우트를 쓴다. */
  url: string;
  /** storage object key. **이 값이 Order.poDocumentUrl 에 저장된다**(프록시가 get() 에 쓴다). */
  pathname: string;
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
  /* 🛑 §quote-scan-public-storage P0-b1 (호영님 2026-09-12) — 키를 **비결정적**으로.
   *   옛 키는 `${prefix}/${orderNumber}.pdf` 였다. 발주번호는 비밀이 아니다 —
   *   화면·이메일·PDF 본문에 찍히고 공급사에게도 보낸다. 그 값으로 URL 을 조립할 수 있었다.
   *   private 전환과 **두 겹**이어야 한다: 나중에 누가 access 를 되돌려도 키로는 못 찾는다. */
  const key = `${prefix}/${randomUUID()}-${input.filename}`;

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
        // 🛑 private — 발주서는 조직 내부 문서다. 열람은 /api/orders/[id]/po-document 프록시가
        //   인증·조직 대조·enforceAction 을 거친 뒤 스트림으로 전달한다(서명 URL 을 쓰지 않는다:
        //   외부 공유 요구가 없고, 서명 URL 은 발급만 남고 **열람이 감사에 안 남는다**).
        access: "private",
        contentType: "application/pdf",
        // 키가 이미 UUID 라 접미사 불필요. 같은 키 재사용이 없으므로 덮어쓰기도 필요 없다.
        addRandomSuffix: false,
        allowOverwrite: true,
      });
      return { url: result.url, pathname: key, provider };
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
