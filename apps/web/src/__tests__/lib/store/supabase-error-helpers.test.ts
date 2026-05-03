/**
 * #supabase-store-cleanup Phase 1 — RED.
 *
 * supabase-error-helpers.ts 의 contract 정의.
 *
 * dead-table error (Postgres 42P01 또는 supabase "Could not find the table")
 * 는 silence — Prisma /api/* fallback 이 이미 wired 되어 있으므로 console
 * pollution 만 발생. 다른 error (auth fail / network / RLS) 는 console.warn
 * 으로 surface (debug 가능).
 *
 * §11.199 lesson: store internal state machine 변경 0 — helper 는 logging
 * only, state mutation 0.
 *
 * Plan: docs/plans/PLAN_supabase-store-cleanup.md
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  isSupabaseDeadTableError,
  logSupabaseSilently,
} from "@/lib/store/supabase-error-helpers";

describe("isSupabaseDeadTableError", () => {
  it("Postgres 42P01 (undefined_table) → true", () => {
    expect(isSupabaseDeadTableError({ code: "42P01", message: "anything" })).toBe(true);
  });

  it("supabase 'Could not find the table' message → true", () => {
    expect(
      isSupabaseDeadTableError({
        code: "PGRST205",
        message: "Could not find the table 'public.budgets' in the schema cache",
      }),
    ).toBe(true);
  });

  it("case-insensitive message 매칭 (대소문자 무관)", () => {
    expect(
      isSupabaseDeadTableError({ code: "X", message: "could not find THE table foo" }),
    ).toBe(true);
  });

  it("일반 RLS / auth error → false (debug 가능 보존)", () => {
    expect(isSupabaseDeadTableError({ code: "42501", message: "permission denied" })).toBe(false);
    expect(
      isSupabaseDeadTableError({ code: "PGRST301", message: "JWT expired" }),
    ).toBe(false);
  });

  it("network / timeout / null / undefined → false (silence 안 함)", () => {
    expect(isSupabaseDeadTableError(null)).toBe(false);
    expect(isSupabaseDeadTableError(undefined)).toBe(false);
    expect(isSupabaseDeadTableError(new Error("Network error"))).toBe(false);
  });

  it("string error → false (object 만 매칭, defensive)", () => {
    expect(isSupabaseDeadTableError("Could not find the table")).toBe(false);
  });
});

describe("logSupabaseSilently", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("dead-table error → console.warn 호출 0 (silent)", () => {
    logSupabaseSilently(
      { code: "42P01", message: "Could not find the table 'public.budgets'" },
      "[budget-store]",
    );
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("일반 error → console.warn 호출 (label + message 포함)", () => {
    logSupabaseSilently(
      { code: "42501", message: "permission denied" },
      "[budget-store] update 실패",
    );
    expect(warnSpy).toHaveBeenCalled();
    const args = warnSpy.mock.calls[0];
    expect(args.join(" ")).toContain("[budget-store]");
    expect(args.join(" ")).toContain("permission denied");
  });

  it("error 가 Error 객체 (network) → console.warn 호출 (silence 0)", () => {
    logSupabaseSilently(new Error("fetch failed"), "[order-queue-store]");
    expect(warnSpy).toHaveBeenCalled();
  });

  it("§11.199 회귀 차단 — helper 가 state 변경 시도 안 함 (logging only)", () => {
    // helper 는 sync return 만, state mutation 0
    const result = logSupabaseSilently(
      { code: "42P01", message: "test" },
      "[label]",
    );
    expect(result).toBeUndefined();
  });
});
