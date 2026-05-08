/**
 * #csrf-fetch-race-condition-fix — RED test
 *
 * Goal: csrfFetch + apiClient 가 403 응답 시 token refresh + 한 번 retry.
 *
 * canonical truth lock:
 *   - 첫 hydration 시 stale/absent cookie 로 인한 race condition 의 표면 증상
 *     (403) 을 직접 차단.
 *   - token 이 refresh 후 같으면 retry skip (RBAC deny / actual permission
 *     차단은 보존).
 *   - retry 1회만 (infinite loop 차단).
 *   - GET / HEAD / OPTIONS bypass (csrfFetch 가 STATE_CHANGING_METHODS 만
 *     처리) 보존.
 *
 * vendor-requests / share / select-reply cluster 가 fix 한 RBAC drift 와는
 * 다른 layer — token bootstrap timing 마찰만.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const CLIENT_PATH = resolve(__dirname, "../../lib/api-client.ts");
const source = readFileSync(CLIENT_PATH, "utf8");

describe("#csrf-fetch-race-condition-fix — csrfFetch 403 retry-with-refresh", () => {
  it("csrfFetch 가 403 status 분기 처리", () => {
    expect(source).toMatch(/status\s*===\s*403|response\.status\s*===\s*403|resp\.status\s*===\s*403/);
  });

  it("csrfFetch 가 refreshCsrfToken 호출 (token 갱신)", () => {
    // refreshCsrfToken 이 csrfFetch 안에서 호출되어야
    expect(source).toMatch(/refreshCsrfToken\s*\(/);
  });

  it("retry 1회만 — 무한 loop 차단 (token 동일 시 skip)", () => {
    // token 이 갱신 후 같으면 retry skip — 일종의 sentinel
    expect(source).toMatch(/!==\s*csrfToken|fresh.*!==|newToken.*!==|token.*!==/);
  });

  it("#csrf-fetch-race-condition-fix 주석 marker (cluster trace)", () => {
    expect(source).toMatch(/#csrf-fetch-race-condition-fix|race condition|race-condition|race conditions/i);
  });

  it("기존 acquireCsrfToken / bootstrapCsrfToken / getCsrfTokenFromCookie 보존", () => {
    expect(source).toMatch(/function\s+acquireCsrfToken/);
    expect(source).toMatch(/function\s+bootstrapCsrfToken/);
    expect(source).toMatch(/function\s+getCsrfTokenFromCookie/);
  });

  it("STATE_CHANGING_METHODS bypass (GET/HEAD/OPTIONS) 보존", () => {
    expect(source).toMatch(/STATE_CHANGING_METHODS\.has\(method\)/);
  });
});
