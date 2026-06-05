/**
 * §11.358-1 #quote-list-auth-ready-gate — 견적 목록 간헐 빈 화면 (auth-timing race)
 *
 * 호영님 P-라이브 (2026-06-06):
 *   증상 — 견적 관리 진입 시 목록이 간헐적으로 빈 상태로 뜨고, 새로고침하면 정상.
 *   판정 — useQuery `enabled: status==="authenticated"`. 세션 미해결("loading") 윈도우엔
 *          enabled:false → isLoading=false(pending이나 fetching 아님) → data undefined →
 *          빈 상태(`!isLoading && filteredQuotes.length===0`)가 skeleton 대신 노출.
 *          세션 해소 지연/간헐 시 빈 화면 잔존 → 새로고침이 세션 재해소로 복구.
 *   결정 — isLoading 파생식에 세션 loading 윈도우 포함(auth-ready 게이트).
 *
 * canonical truth lock (회귀 0):
 *   - useQuery enabled: status==="authenticated" 보존 (인증 전 fetch 금지)
 *   - skeleton 게이트 `{isLoading && (` 보존
 *   - 빈 상태 게이트 `!isLoading && filteredQuotes.length === 0` 보존
 *   - GET 401/500 → client throw → isError 경로 변경 0 (route 무관)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../../app/dashboard/quotes/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("§11.358-1 — 견적 목록 auth-ready 게이트", () => {
  it("isLoading 파생식이 세션 loading 윈도우를 포함한다 (빈 화면 오노출 제거)", () => {
    // const isLoading = <queryLoading> || status === "loading";
    expect(page).toMatch(/const isLoading = \w+ \|\| status === "loading"/);
  });

  it("useQuery 결과 isLoading 을 별칭으로 분리(원본 파생식과 충돌 방지)", () => {
    // destructure 에서 isLoading 을 그대로 두면 const isLoading 재선언과 충돌.
    expect(page).toMatch(/data: quotesData,\s*isLoading:\s*\w+/);
  });
});

describe("§11.358-1 회귀 0 — 보존 항목", () => {
  it("useQuery enabled: status===authenticated 가드 보존 (인증 전 fetch 금지)", () => {
    expect(page).toMatch(/enabled: status === "authenticated"/);
  });

  it("skeleton 게이트가 isLoading 의존 보존", () => {
    expect(page).toMatch(/\{isLoading && \(/);
  });

  it("빈 상태 게이트가 !isLoading && filteredQuotes.length === 0 보존", () => {
    expect(page).toMatch(/!isLoading && filteredQuotes\.length === 0/);
  });
});
