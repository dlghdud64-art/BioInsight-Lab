/**
 * §11.272c-2 #quote-kpi-mobile-summary-timeout — KPI 모바일 1줄 요약 바 5초 timeout
 *   fallback (호영님 P2 spec, §11.272c 후속, ADR-002 명시 Out-of-scope).
 *
 * 호영님 spec (§11.272c entry, "Out-of-scope (Phase 2 backlog)"):
 *   "5초 timeout '불러오기 실패 — 새로고침' 처리 — 현재는 isLoading 중 `·` 점 표시로
 *   minimum-diff. 호영님 spec 시 §11.272c-2 로 진행."
 *
 * Fix (minimum diff, 1 file 3 swap + useEffect 추가):
 *   (1) useState `isLoadingTimeout` (페이지 상단 state)
 *   (2) useEffect — isLoading true 진입 시 5s setTimeout → setIsLoadingTimeout(true).
 *       isLoading false 시 clearTimeout + reset
 *   (3) mobile-summary-bar 내부 분기 — isLoadingTimeout 시 5 KPI map 대신 fallback UI
 *       (텍스트 "불러오기 실패" + [새로고침] button onClick={refetch})
 *
 * canonical truth 보존:
 *   - summaryStats useMemo + setStatusFilter onClick 분기 보존 (timeout 아닐 시 normal)
 *   - isLoading 동안 `·` 점 표시 보존 (5초 이내)
 *   - quote-kpi-mobile-summary-bar wrapper data-testid 보존
 *   - sm:hidden flex border-y 보존
 *   - refetch (useQuery) 사용 (canonical re-fetch 함수)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE = readFileSync(
  resolve(__dirname, "../../../app/dashboard/quotes/page.tsx"),
  "utf8",
);

describe("§11.272c-2 — KPI 모바일 요약 바 5초 timeout fallback", () => {
  it("§11.272c-2 trace marker comment 존재", () => {
    expect(PAGE).toMatch(/§11\.272c-2/);
  });

  it("isLoadingTimeout state 정의", () => {
    expect(PAGE).toMatch(
      /const\s+\[isLoadingTimeout,\s*setIsLoadingTimeout\]\s*=\s*useState/,
    );
  });

  it("isLoading 진입 시 5s setTimeout (5000ms) → setIsLoadingTimeout(true)", () => {
    // useEffect 안 setTimeout(..., 5000) 호출
    expect(PAGE).toMatch(/setTimeout\(\s*\(\)\s*=>\s*setIsLoadingTimeout\(true\)\s*,\s*5000\s*\)/);
  });

  it("useEffect — isLoading false 시 clearTimeout + reset (timeout reset)", () => {
    // useEffect 안 clearTimeout 또는 setIsLoadingTimeout(false) 보장
    expect(PAGE).toMatch(/setIsLoadingTimeout\(false\)/);
    expect(PAGE).toMatch(/clearTimeout/);
  });

  it("useEffect dependency 에 isLoading 포함", () => {
    expect(PAGE).toMatch(/useEffect\([\s\S]{0,400}\[isLoading\]\)/);
  });

  it("mobile-summary-bar 안 fallback UI data-testid (timeout 시 노출)", () => {
    expect(PAGE).toMatch(/data-testid="quote-kpi-mobile-summary-fallback"/);
  });

  it("fallback UI 안 \"불러오기 실패\" 한글 텍스트", () => {
    expect(PAGE).toMatch(
      /data-testid="quote-kpi-mobile-summary-fallback"[\s\S]{0,500}불러오기 실패/,
    );
  });

  it("fallback UI 안 \"새로고침\" 한글 button 라벨", () => {
    expect(PAGE).toMatch(
      /data-testid="quote-kpi-mobile-summary-fallback"[\s\S]{0,800}새로고침/,
    );
  });

  it("fallback 새로고침 button onClick → refetch() 호출", () => {
    expect(PAGE).toMatch(
      /data-testid="quote-kpi-mobile-summary-fallback"[\s\S]{0,1000}refetch\(\)/,
    );
  });

  it("mobile-summary-bar wrapper 안 isLoadingTimeout 조건부 분기 (3항 또는 if)", () => {
    expect(PAGE).toMatch(
      /data-testid="quote-kpi-mobile-summary-bar"[\s\S]{0,600}isLoadingTimeout/,
    );
  });
});

describe("§11.272c-2 — invariant 보존 (canonical truth)", () => {
  it("quote-kpi-mobile-summary-bar wrapper data-testid 보존", () => {
    expect(PAGE).toMatch(/data-testid="quote-kpi-mobile-summary-bar"/);
  });

  it("sm:hidden + flex items-stretch + border-y 시각 정합 보존", () => {
    expect(PAGE).toMatch(
      /data-testid="quote-kpi-mobile-summary-bar"[\s\S]{0,400}sm:hidden/,
    );
  });

  it("summaryStats useMemo 보존 (5 KPI source canonical)", () => {
    expect(PAGE).toMatch(/const summaryStats = useMemo/);
  });

  it("5 KPI 짧은 라벨 (발송/회신/비교/승인/전환) 보존", () => {
    expect(PAGE).toMatch(/short: "발송"/);
    expect(PAGE).toMatch(/short: "회신"/);
    expect(PAGE).toMatch(/short: "비교"/);
    expect(PAGE).toMatch(/short: "승인"/);
    expect(PAGE).toMatch(/short: "전환"/);
  });

  it("setStatusFilter onClick 분기 보존 (normal state 시)", () => {
    expect(PAGE).toMatch(/setStatusFilter\(prev =>/);
  });

  it("isLoading `·` 점 표시 (5초 이내) 보존", () => {
    expect(PAGE).toMatch(/isLoading \? "·" : count/);
  });

  it("refetch (useQuery 반환) 함수 import 보존", () => {
    expect(PAGE).toMatch(/isLoading,\s*isFetching,\s*isError,\s*refetch/);
  });

  it("isCompareReviewZero disabled 분기 보존", () => {
    expect(PAGE).toMatch(/isCompareReviewZero/);
  });
});
