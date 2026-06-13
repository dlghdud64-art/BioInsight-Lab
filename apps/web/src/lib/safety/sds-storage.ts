/**
 * §11.348-B-1 B1-1 — SDS/MSDS 파일 스토리지 (서버, service-role).
 *
 * 원본 파일은 오브젝트 스토리지(Supabase), DB(SDSDocument)엔 bucket/path 메타만.
 * po-pdf-storage 패턴 정합 — env 미설정 시 StorageNotConfiguredError throw →
 * caller 가 graceful fallback(Product.msdsUrl 등). silent fake success 금지.
 *
 * env: SUPABASE_URL(또는 NEXT_PUBLIC_SUPABASE_URL) / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SDS_BUCKET(기본 "sds-documents")
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export class StorageNotConfiguredError extends Error {
  constructor() {
    super("SDS storage not configured (SUPABASE_URL|NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 미설정).");
    this.name = "StorageNotConfiguredError";
  }
}

export const SDS_BUCKET = process.env.SUPABASE_SDS_BUCKET ?? "sds-documents";

let _client: SupabaseClient | null = null;
/** service-role 서버 클라이언트(lazy). env 미설정/형식오류 시 null. */
function getServiceClient(): SupabaseClient | null {
  if (_client) return _client;
  // §sds-storage-url — prod env는 NEXT_PUBLIC_SUPABASE_URL 명으로 존재(SUPABASE_URL 미설정).
  //   service-role 클라는 프로젝트 URL(공개값) + service key(시크릿)면 충분 → fallback 수용.
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

export interface UploadSdsInput {
  productId: string;
  fileName: string;
  buffer: Buffer;
  contentType?: string;
}
export interface UploadSdsResult {
  bucket: string;
  path: string;
}

/** SDS 파일 업로드 → {bucket, path}. 미설정 시 throw. */
export async function uploadSdsFile(input: UploadSdsInput): Promise<UploadSdsResult> {
  const client = getServiceClient();
  if (!client) throw new StorageNotConfiguredError();
  // deterministic-ish path: 제품별 폴더 + 타임스탬프 prefix(충돌 회피).
  const safeName = input.fileName.replace(/[^\w.\-]+/g, "_");
  const path = `${input.productId}/${Date.now()}-${safeName}`;
  const { error } = await client.storage
    .from(SDS_BUCKET)
    .upload(path, input.buffer, {
      contentType: input.contentType ?? "application/octet-stream",
      upsert: false,
    });
  if (error) throw new Error(`SDS upload 실패: ${error.message}`);
  return { bucket: SDS_BUCKET, path };
}

/** 비공개 SDS 파일의 signed URL(기본 1시간). 미설정/실패 시 null → caller 폴백. */
export async function createSdsSignedUrl(args: {
  bucket: string;
  path: string;
  expiresIn?: number;
}): Promise<string | null> {
  const client = getServiceClient();
  if (!client) return null;
  try {
    const { data, error } = await client.storage
      .from(args.bucket)
      .createSignedUrl(args.path, args.expiresIn ?? 3600);
    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  } catch {
    return null;
  }
}
