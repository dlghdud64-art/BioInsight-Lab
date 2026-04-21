/**
 * #B1 Track 2 — Contract test for supabase noop query builder.
 *
 * Canonical truth 보호용 회귀 방지 테스트.
 *
 * 검증 내용:
 * 1. env missing / malformed env 두 실패 모드 모두에서
 *    `.from().select().order().limit()` 등 체인이 TypeError를 던지지 않는다.
 * 2. 최종 await 결과는 `{ data: null, error: { code: "SUPABASE_NOT_CONFIGURED" } }`.
 *    - `data: []` / `error: null` 의 silent empty success shape은 금지.
 * 3. caller의 `if (error)` 분기가 반드시 발동한다.
 *
 * 각 테스트는 `vi.resetModules()` + dynamic import 로 `_supabase` 싱글턴을 리셋한다.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("supabase noop query builder contract (#B1 Track 2)", () => {
  // 테스트 격리를 위해 env 원본 값을 저장했다가 복구한다.
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  beforeEach(() => {
    // 매 테스트마다 모듈 캐시 초기화 — `_supabase` 싱글턴을 새로 평가하기 위해.
    vi.resetModules();
  });

  afterEach(() => {
    if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey;
  });

  describe("env missing path", () => {
    beforeEach(() => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    });

    it("select().order().limit() 체인이 TypeError를 던지지 않는다", async () => {
      const { supabase } = await import("@/lib/supabase");
      expect(() =>
        supabase
          .from("order_queue")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(10),
      ).not.toThrow();
    });

    it("eq().in().single() 체인이 TypeError를 던지지 않는다", async () => {
      const { supabase } = await import("@/lib/supabase");
      expect(() =>
        supabase
          .from("budgets")
          .select("*")
          .eq("org_id", "x")
          .in("status", ["active", "paused"])
          .single(),
      ).not.toThrow();
    });

    it("maybeSingle() 체인도 TypeError를 던지지 않는다", async () => {
      const { supabase } = await import("@/lib/supabase");
      expect(() =>
        supabase.from("items").select("*").eq("id", 1).maybeSingle(),
      ).not.toThrow();
    });

    it("await 결과가 SUPABASE_NOT_CONFIGURED shape으로 수렴한다 (silent empty 금지)", async () => {
      const { supabase, SUPABASE_NOT_CONFIGURED } = await import("@/lib/supabase");
      const result = await supabase
        .from("order_queue")
        .select("*")
        .order("created_at", { ascending: false });

      // silent empty success(`data: []`) 금지 — 반드시 null + explicit error.
      expect(result.data).toBeNull();
      expect(result.error).toBeTruthy();
      expect((result.error as { code: string }).code).toBe(SUPABASE_NOT_CONFIGURED);
    });

    it("caller의 `if (error)` 분기가 정상 발동한다", async () => {
      const { supabase } = await import("@/lib/supabase");
      const { data, error } = await supabase.from("budgets").select("*");

      let branchTaken = false;
      if (error) {
        branchTaken = true;
      }
      expect(branchTaken).toBe(true);
      expect(data).toBeNull();
    });
  });

  describe("env malformed path (createClient throw)", () => {
    beforeEach(() => {
      // `createClient`가 validateSupabaseUrl에서 throw하도록 의도적으로 invalid URL 주입.
      // 실제 prod 회귀 시 관찰된 shape(값 concat → URL 파서 reject)을 시뮬레이션.
      process.env.NEXT_PUBLIC_SUPABASE_URL = "not-a-valid-url";
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "placeholder-anon-key-not-real";
    });

    it("malformed env도 동일한 SUPABASE_NOT_CONFIGURED shape으로 수렴한다", async () => {
      const { supabase, SUPABASE_NOT_CONFIGURED } = await import("@/lib/supabase");

      // 체인 자체는 throw하지 않아야 한다.
      expect(() =>
        supabase.from("order_queue").select("*").order("id", { ascending: true }),
      ).not.toThrow();

      const result = await supabase
        .from("order_queue")
        .select("*")
        .order("id", { ascending: true });

      expect(result.data).toBeNull();
      expect(result.error).toBeTruthy();
      expect((result.error as { code: string }).code).toBe(SUPABASE_NOT_CONFIGURED);
    });
  });
});
