/**
 * #supabase-store-cleanup Phase 1
 *
 * supabase store (budget-store / order-queue-store) 의 error logging
 * 정합 helper. dead-table error (Postgres 42P01 또는 supabase
 * "Could not find the table") 는 silence — Prisma /api/* fallback 이
 * 이미 wired 되어 있어 store 동작 보존됨. console pollution 만 정리.
 *
 * 다른 error (auth fail / RLS / network) 는 console.warn 으로 surface
 * 유지 (debug 가능).
 *
 * §11.199 lesson: helper 는 logging only — store internal state mutation
 * 0. caller (store fetcher) 의 isFetching=false reset 강제 책임.
 *
 * canonical truth (long-term): Prisma `Budget` / `Order` model.
 *   supabase 호출은 legacy fallback path — §11.199c 별도 트랙에서
 *   완전 회수 (Prisma /api/* 단일화) 예정.
 */

/**
 * dead-table error 매칭 — Postgres 42P01 (undefined_table) 또는
 * supabase REST 의 "Could not find the table" message 패턴.
 *
 * defensive: object 가 아니면 false (string / null / undefined 안전).
 */
export function isSupabaseDeadTableError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: unknown; message?: unknown };
  const code = typeof e.code === "string" ? e.code : "";
  const message = typeof e.message === "string" ? e.message : "";
  if (code === "42P01") return true;
  if (/could not find the table/i.test(message)) return true;
  return false;
}

/**
 * supabase error logging — dead-table 은 silent, 다른 error 는 console.warn.
 *
 * 사용 예:
 *   const { error } = await supabase.from("budgets").select("*");
 *   if (error) {
 *     logSupabaseSilently(error, "[budget-store] fetchBudgets", "Prisma fallback");
 *     // ... fallback 로직
 *   }
 *
 * @param error supabase response 의 error 객체 (또는 catch 의 unknown)
 * @param label store label (예: "[budget-store] fetchBudgets")
 * @param fallbackHint 옵션 — fallback 이 발화한다는 사실 (debug 가독성)
 */
export function logSupabaseSilently(
  error: unknown,
  label: string,
  fallbackHint?: string,
): void {
  if (isSupabaseDeadTableError(error)) {
    // dead table — silent (Prisma fallback wired, console pollution 만 정리)
    return;
  }
  // 다른 error — surface (debug 가능)
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message)
      : String(error);
  if (fallbackHint) {
    console.warn(label, message, `(fallback: ${fallbackHint})`);
  } else {
    console.warn(label, message);
  }
}
