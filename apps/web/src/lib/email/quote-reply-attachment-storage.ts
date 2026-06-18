/**
 * §inbound-rfq-autocapture P2 — 공급사 회신 첨부 실저장(누락 0)
 *
 * inbound parse(/api/inbound/sendgrid/[secret])가 받은 첨부(견적 PDF 등)를 실제
 * object storage 에 업로드한다. 이전 inbound route 의 메타-only placeholder
 * (uploadAttachment "skip actual upload") 를 대체 — placeholder success 금지.
 *
 * STORAGE_PROVIDER 추상화(po-pdf-storage / ocr image-storage 정합):
 *   - "vercel-blob" — @vercel/blob(설치됨, OCR/PO 에서 실작동 검증). env BLOB_READ_WRITE_TOKEN.
 *   - "supabase"    — getServiceClient().storage(@supabase/supabase-js 설치됨).
 *                      env SUPABASE_SERVICE_ROLE_KEY + (선택)SUPABASE_REPLY_BUCKET(기본 quote-replies).
 *   - 미설정       — AttachmentStorageNotConfiguredError throw → inbound route 가 graceful
 *                      (QuoteReply 는 저장, 첨부는 명시 skip + 로그 — silent placeholder 금지).
 */

import { getServiceClient } from "@/lib/supabase";

export class AttachmentStorageNotConfiguredError extends Error {
  constructor() {
    super(
      "첨부 storage provider 가 설정되지 않았습니다. STORAGE_PROVIDER env var 확인 필요.",
    );
    this.name = "AttachmentStorageNotConfiguredError";
  }
}

export interface UploadReplyAttachmentInput {
  /** 첨부 binary. */
  buffer: Buffer;
  /** 원본 파일명(확장자 포함). */
  filename: string;
  /** 소속 quote (멀티테넌시 key prefix). */
  quoteId: string;
  /** 소속 QuoteReply. */
  replyId: string;
  /** MIME content type. */
  contentType: string;
}

export interface UploadReplyAttachmentResult {
  /** storage bucket/provider 식별. */
  bucket: string;
  /** storage 내 object key/path — QuoteReplyAttachment.path 저장. */
  path: string;
  /** public/signed URL(조회용). */
  url: string;
  /** 실제 업로드된 바이트 수. */
  sizeBytes: number;
  /** provider name(audit). */
  provider: string;
}

/**
 * 회신 첨부를 storage 에 실제 업로드하고 위치 반환.
 * 미설정 시 throw — caller(inbound route)가 try/catch 로 graceful skip(placeholder 금지).
 */
export async function uploadQuoteReplyAttachment(
  input: UploadReplyAttachmentInput,
): Promise<UploadReplyAttachmentResult> {
  const provider = process.env.STORAGE_PROVIDER ?? "";
  if (!provider) {
    throw new AttachmentStorageNotConfiguredError();
  }

  const safeName = input.filename.replace(/[^a-zA-Z0-9.-]/g, "_");
  const key = `quote-replies/${input.quoteId}/${input.replyId}/${Date.now()}_${safeName}`;

  switch (provider) {
    case "vercel-blob": {
      // host install: @vercel/blob (설치됨). env BLOB_READ_WRITE_TOKEN.
      const { put } = await import("@vercel/blob");
      const result = await put(key, input.buffer, {
        access: "public",
        contentType: input.contentType,
        addRandomSuffix: false,
        allowOverwrite: true,
      });
      return {
        bucket: "vercel-blob",
        path: key,
        url: result.url,
        sizeBytes: input.buffer.length,
        provider,
      };
    }
    case "supabase": {
      // @supabase/supabase-js 설치됨. service-role 클라이언트로 RLS 우회 업로드.
      const bucket = process.env.SUPABASE_REPLY_BUCKET ?? "quote-replies";
      const supabase = getServiceClient();
      const { error } = await supabase.storage
        .from(bucket)
        .upload(key, input.buffer, {
          contentType: input.contentType,
          upsert: true,
        });
      if (error) {
        // silent fake success 금지 — caller 가 명시 skip + 로그.
        throw new Error(`Supabase storage upload 실패: ${error.message}`);
      }
      const { data: pub } = supabase.storage.from(bucket).getPublicUrl(key);
      return {
        bucket,
        path: key,
        url: pub.publicUrl,
        sizeBytes: input.buffer.length,
        provider,
      };
    }
    default:
      throw new Error(`Unsupported STORAGE_PROVIDER: ${provider}`);
  }
}
