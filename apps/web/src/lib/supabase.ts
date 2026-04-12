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
/**
 * 환경변수 미설정 시 사용하는 체이닝 가능한 noop 쿼리 빌더.
 *
 * Supabase PostgrestQueryBuilder는 `.select().eq().filter().order()…`를
 * 계속 체이닝하다 마지막에 `await` / `.then()`으로 해결되는 thenable이다.
 * 기존 stub은 `.select()`에서 곧바로 Promise를 돌려주어
 * 이후 `.eq()` 호출 시 `query.eq is not a function` 에러가 발생했다.
 *
 * 이 stub은 모든 빌더 메소드를 자기 자신으로 돌리고,
 * `.then()` 시점에만 `{ data: [], error: null }`로 해결된다.
 */
function createNoopQueryBuilder(): any {
  const empty = { data: [], error: null };
  const thenable: any = {
    then: (resolve: (v: typeof empty) => unknown) => Promise.resolve(empty).then(resolve),
    catch: (reject: (e: unknown) => unknown) => Promise.resolve(empty).catch(reject),
    finally: (cb: () => void) => Promise.resolve(empty).finally(cb),
  };
  return new Proxy(thenable, {
    get(target, prop) {
      if (prop in target) return (target as any)[prop];
      // 모든 빌더 메소드(select/eq/filter/order/in/limit/single/maybeSingle…)는
      // 자기 자신을 돌려 체이닝을 유지한다.
      return () => thenable;
    },
  });
}

export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabase();
    if (!client) {
      // 빌드 시 또는 환경변수 미설정 시 — 체이닝 가능한 noop 반환
      if (typeof prop === "string" && prop === "from") {
        return () => createNoopQueryBuilder();
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
