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
 *
 * 환경변수가 누락되었거나(`""`), `createClient`가 malformed 값으로 인해 throw한 경우
 * 동일하게 `null`을 반환하여 `supabase` Proxy의 noop builder 경로로 수렴시킨다.
 * → 두 실패 모드가 최종 await 결과 shape(`SUPABASE_NOT_CONFIGURED` error)에서
 *   구분 없이 동일하게 처리되도록 하기 위함.
 *
 * 민감한 env 원본 값은 로그에 노출하지 않는다.
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

  try {
    _supabase = createClient(url, anonKey);
    return _supabase;
  } catch {
    // malformed env (예: Invalid supabaseUrl) — silent fake success 금지.
    // 동일한 noop/config-error 경로로 수렴시키기 위해 null을 반환한다.
    // 민감 값 노출을 막기 위해 원본 에러 메시지는 로그에 출력하지 않는다.
    if (typeof window !== "undefined") {
      console.warn(
        "[supabase] createClient 초기화 실패 — 환경 변수 형식을 확인하세요. (값은 로그에 노출하지 않음)",
      );
    }
    _supabase = null;
    return null;
  }
}

/**
 * 하위 호환용 — 기존 `import { supabase }` 사용처 지원
 * Proxy를 통해 실제 접근 시점에 lazy 초기화합니다.
 */
/**
 * Supabase 설정이 누락/잘못되었을 때 반환되는 explicit config error 코드.
 *
 * caller는 반드시 `if (error)` 분기에서 이 코드를 확인하여
 * silent empty success(`data: []`)로 오인하지 않도록 한다.
 */
export const SUPABASE_NOT_CONFIGURED = "SUPABASE_NOT_CONFIGURED" as const;
export type SupabaseNotConfiguredError = Error & { code: typeof SUPABASE_NOT_CONFIGURED };

/**
 * 환경변수 미설정 또는 malformed env(예: Invalid supabaseUrl) 시 사용하는
 * self-chaining noop 쿼리 빌더.
 *
 * 설계 원칙:
 * 1. Supabase PostgrestQueryBuilder는 `.from().select().eq().order().limit()…`을
 *    계속 체이닝하다 마지막에 `await`로 해결되는 thenable이다.
 * 2. 모든 빌더 메소드 호출은 반드시 "자기 자신(proxy)"을 돌려 체이닝을 유지한다.
 *    (이전 구현은 `.then`을 가진 plain thenable을 반환해서
 *     `.select(...).order(...)` 시 `.order is not a function` TypeError가 발생했다.)
 * 3. `await` 결과는 반드시 `{ data: null, error: SUPABASE_NOT_CONFIGURED }`를 반환한다.
 *    - `data: []`(silent empty)는 금지. caller의 `if (error)` 분기를 반드시 트리거.
 * 4. `apply` trap을 통해 `proxy(...)` 식의 호출도 동일 proxy를 반환(체인 복원).
 */
function createNoopQueryBuilder(): any {
  const configError: SupabaseNotConfiguredError = Object.assign(
    new Error(
      "Supabase client is not configured: NEXT_PUBLIC_SUPABASE_URL 또는 NEXT_PUBLIC_SUPABASE_ANON_KEY 미설정 또는 잘못된 값.",
    ),
    { code: SUPABASE_NOT_CONFIGURED },
  );
  const resolved = { data: null, error: configError } as const;

  // callable target — apply trap으로 함수 호출도 프록시 자체를 반환.
  const target = function noopChain() {};
  const proxy: any = new Proxy(target, {
    get(_t, prop) {
      if (prop === "then") {
        return (
          resolve: (v: typeof resolved) => unknown,
          reject?: (e: unknown) => unknown,
        ) => Promise.resolve(resolved).then(resolve, reject);
      }
      if (prop === "catch") {
        return (reject: (e: unknown) => unknown) =>
          Promise.resolve(resolved).catch(reject);
      }
      if (prop === "finally") {
        return (cb: () => void) => Promise.resolve(resolved).finally(cb);
      }
      // 내부 심볼(Symbol.toPrimitive, Symbol.iterator 등) — undefined로 안전 이탈.
      if (typeof prop === "symbol") return undefined;
      // 그 외 모든 프로퍼티 접근은 "호출하면 proxy를 돌려주는 함수"로 응답 →
      // `.select().eq().in().order().single()` 같은 체인이 항상 proxy를 유지한다.
      return () => proxy;
    },
    apply() {
      return proxy;
    },
  });
  return proxy;
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
