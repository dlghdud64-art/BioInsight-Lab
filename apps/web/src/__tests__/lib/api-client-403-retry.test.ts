/**
 * #api-client-csrf-retry-parity — Phase 1 RED (G-1+2)
 *
 * 호영님 production 마찰 후속 — `csrfFetch` 의 403 retry-with-refresh 패턴
 * (#csrf-fetch-race-condition-fix) 가 `apiClient<T>` wrapper 에 미적용.
 * apiClient 사용 caller (api.post / api.patch / api.delete) 는 csrf race
 * condition 시 첫 시도 fail → 사용자 toast 노출. 같은 retry-with-refresh
 * 패턴을 apiClient 에도 적용하여 race condition silent recover.
 *
 * canonical truth lock:
 *   - apiClient 의 fetch 호출 후 response.status === 403 + csrfToken 부착
 *     했으면 → refreshCsrfToken → fresh token !== csrfToken 시 한 번 retry.
 *   - retry 1회만 (무한 loop 차단).
 *   - 200 path 영향 0 (backward compat).
 *   - csrfFetch 의 same sentinel pattern mirror (token sentinel + 1 retry).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PATH = resolve(__dirname, "../../lib/api-client.ts");
const src = readFileSync(PATH, "utf8");

describe("#api-client-csrf-retry-parity — apiClient 403 retry-with-refresh", () => {
  it("apiClient 본문 안 refreshCsrfToken 호출 (csrfFetch 패턴 mirror)", () => {
    // apiClient 함수 본문 (line 107-233 범위) 안에 refreshCsrfToken 호출.
    const apiClientBlock = src.match(/export async function apiClient[\s\S]*?^}/m)?.[0];
    expect(apiClientBlock).toBeDefined();
    expect(apiClientBlock).toMatch(/refreshCsrfToken/);
  });

  it("403 status + csrfToken 보유 분기 (apiClient)", () => {
    const apiClientBlock = src.match(/export async function apiClient[\s\S]*?^}/m)?.[0];
    expect(apiClientBlock).toMatch(/response\.status\s*===\s*403/);
  });

  it("token sentinel — fresh !== 이전 token 시만 retry (무한 loop 차단)", () => {
    // csrfFetch 와 동일 sentinel: fresh && fresh !== csrfToken.
    const apiClientBlock = src.match(/export async function apiClient[\s\S]*?^}/m)?.[0];
    expect(apiClientBlock).toMatch(/fresh\s*!==\s*csrfToken|fresh\s*&&\s*fresh\s*!==/);
  });

  it("cluster trace marker", () => {
    expect(src).toMatch(/#api-client-csrf-retry-parity|#csrf-fetch-race-condition-fix|race condition|retry-with-refresh/);
  });
});

describe("#api-client-csrf-retry-parity — csrfFetch 기존 패턴 보존", () => {
  it("csrfFetch 의 403 retry 패턴 보존 (#csrf-fetch-race-condition-fix)", () => {
    const csrfFetchBlock = src.match(/export async function csrfFetch[\s\S]*?^}/m)?.[0];
    expect(csrfFetchBlock).toMatch(/refreshCsrfToken/);
    expect(csrfFetchBlock).toMatch(/response\.status\s*===\s*403/);
  });

  it("csrfFetch 와 apiClient 둘 다 refreshCsrfToken 사용 (parity)", () => {
    const refreshMatches = src.match(/refreshCsrfToken\s*\(/g) || [];
    // 1: refreshCsrfToken 정의 자체 + csrfFetch 호출 + apiClient 호출 = 3+
    expect(refreshMatches.length).toBeGreaterThanOrEqual(3);
  });
});

describe("#api-client-csrf-retry-parity — backward compat invariant", () => {
  it("STATE_CHANGING_METHODS set 보존", () => {
    expect(src).toMatch(/STATE_CHANGING_METHODS/);
  });

  it("apiClient 의 200 path (response.ok) 처리 보존", () => {
    expect(src).toMatch(/response\.ok/);
  });

  it("api convenience methods (get/post/patch/put/delete) 보존", () => {
    expect(src).toMatch(/export const api\s*=/);
    expect(src).toMatch(/get:\s*<T/);
    expect(src).toMatch(/post:\s*<T/);
    expect(src).toMatch(/patch:\s*<T/);
    expect(src).toMatch(/put:\s*<T/);
    expect(src).toMatch(/delete:\s*<T/);
  });
});
