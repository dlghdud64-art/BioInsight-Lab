/**
 * §receiving-doc-attach-canonical (T1) — 입고 증빙 문서 스토리지(서버, service-role).
 *
 * lib/safety/sds-storage 패턴 정합: 원본은 오브젝트 스토리지(Supabase), DB(ReceivingDocument)엔
 * bucket/path 메타만. env 미설정 시 throw → caller 가 명시 실패 응답.
 * ⚠️ silent fake success 금지(핸드오프 §0 front-only 재발 방지).
 *
 * env: SUPABASE_URL(또는 NEXT_PUBLIC_SUPABASE_URL) / SUPABASE_SERVICE_ROLE_KEY /
 *      SUPABASE_RECEIVING_BUCKET(기본 "receiving-documents")
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export class ReceivingStorageNotConfiguredError extends Error {
  constructor() {
    super(
      "입고 문서 스토리지 미설정 (SUPABASE_URL|NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).",
    );
    this.name = "ReceivingStorageNotConfiguredError";
  }
}

export const RECEIVING_BUCKET =
  process.env.SUPABASE_RECEIVING_BUCKET ?? "receiving-documents";

let _client: SupabaseClient | null = null;
function getServiceClient(): SupabaseClient | null {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) return null;
  try {
    _client = createClient(url, key, { auth: { persistSession: false } });
    return _client;
  } catch {
    return null;
  }
}

export interface UploadReceivingDocInput {
  orderId: string;
  fileName: string;
  buffer: Buffer;
  contentType?: string;
}
export interface UploadReceivingDocResult {
  bucket: string;
  path: string;
}

/** 입고 증빙 업로드 → {bucket, path}. 미설정/실패 시 throw(레코드 생성 금지). */
export async function uploadReceivingDocument(
  input: UploadReceivingDocInput,
): Promise<UploadReceivingDocResult> {
  const client = getServiceClient();
  if (!client) throw new ReceivingStorageNotConfiguredError();
  const safeName = input.fileName.replace(/[^\w.\-]+/g, "_");
  const path = `${input.orderId}/${Date.now()}-${safeName}`;
  const { error } = await client.storage.from(RECEIVING_BUCKET).upload(path, input.buffer, {
    contentType: input.contentType ?? "application/octet-stream",
    upsert: false,
  });
  if (error) throw new Error(`입고 문서 업로드 실패: ${error.message}`);
  return { bucket: RECEIVING_BUCKET, path };
}

/** 비공개 증빙의 signed URL(기본 1시간). 미설정/실패 시 null → caller 폴백. */
export async function createReceivingDocSignedUrl(args: {
  bucket: string;
  path: string;
  expiresInSec?: number;
}): Promise<string | null> {
  const client = getServiceClient();
  if (!client) return null;
  const { data, error } = await client.storage
    .from(args.bucket)
    .createSignedUrl(args.path, args.expiresInSec ?? 3600);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/** 스토리지 원본 삭제(레코드 삭제 전 호출). 실패해도 caller 가 판단. */
export async function removeReceivingDocument(bucket: string, path: string): Promise<boolean> {
  const client = getServiceClient();
  if (!client) return false;
  const { error } = await client.storage.from(bucket).remove([path]);
  return !error;
}
