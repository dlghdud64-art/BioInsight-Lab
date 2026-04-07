/**
 * Supabase Client — 브라우저/서버 공용 싱글턴
 *
 * 환경변수:
 *   NEXT_PUBLIC_SUPABASE_URL     — Supabase 프로젝트 URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY — Supabase anon(public) key
 *
 * 서버 사이드(API routes)에서 서비스 롤 키가 필요하면
 * SUPABASE_SERVICE_ROLE_KEY 를 별도로 참조하세요.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

if (!supabaseUrl || !supabaseAnonKey) {
  if (typeof window !== "undefined") {
    console.warn(
      "[supabase] NEXT_PUBLIC_SUPABASE_URL 또는 NEXT_PUBLIC_SUPABASE_ANON_KEY가 설정되지 않았습니다.",
    );
  }
}

/** 브라우저/SSR 공용 Supabase 클라이언트 */
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

/**
 * 서비스 롤 키 Supabase 클라이언트 (서버 전용)
 * RLS를 우회해야 하는 API route에서 사용
 */
export function getServiceClient(): SupabaseClient {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY 환경변수가 설정되지 않았습니다.");
  }
  return createClient(supabaseUrl, serviceKey);
}
