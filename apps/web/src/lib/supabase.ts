/**
 * Supabase Client — 브라우저/서버 공용 싱글턴 (lazy 초기화)
 *
 * 환경변수:
 *   NEXT_PUBLIC_SUPABASE_URL     — Supabase 프로젝트 URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY — Supabase anon(public) key
 *
 * 빌드 시(prerender) 환경변수가 없을 수 있으므로
 * createClient 호출을 lazy로 지연합니다.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _supabase: SupabaseClient | null = null;

/**
 * 브라우저/SSR 공용 Supabase 클라이언트 (lazy singleton)
 * 환경변수가 없으면 null을 반환합니다.
 */
export function getSupabase(): SupabaseClient | null {
  if (_supabase) return _supabase;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  if (!url || !anonKey) {
    if (typeof window !== "undefined") {
      console.warn(
        "[supabase] NEXT_PUBLIC_SUPABASE_URL 또는 NEXT_PUBLIC_SUPABASE_ANON_KEY가 설정되지 않았습니다.",
      );
    }
    return null;
  }

  _supabase = createClient(url, anonKey);
  return _supabase;
}

/**
 * 하위 호환용 — 기존 `import { supabase }` 사용처 지원
 * Proxy를 통해 실제 접근 시점에 lazy 초기화합니다.
 */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabase();
    if (!client) {
      // 빌드 시 또는 환경변수 미설정 시 — noop 반환
      if (typeof prop === "string" && prop === "from") {
        return () => ({
          select: () => Promise.resolve({ data: [], error: null }),
          insert: () => Promise.resolve({ data: null, error: { message: "Supabase not configured" } }),
          update: () => Promise.resolve({ data: null, error: { message: "Supabase not configured" } }),
          delete: () => Promise.resolve({ data: null, error: { message: "Supabase not configured" } }),
          upsert: () => Promise.resolve({ data: null, error: { message: "Supabase not configured" } }),
        });
      }
      return undefined;
    }
    return (client as any)[prop];
  },
});

/**
 * 서비스 롤 키 Supabase 클라이언트 (서버 전용)
 * RLS를 우회해야 하는 API route에서 사용
 */
export function getServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY 또는 SUPABASE_URL 환경변수가 설정되지 않았습니다.");
  }
  return createClient(url, serviceKey);
}
