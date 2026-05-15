/**
 * §11.244 Phase C #analytics-timeout-retry — 호영님 P0 분석 페이지 로딩 UX
 *
 * 호영님 P0 spec #8:
 *   10초 timeout — 로딩이 길면 사용자가 페이지 떠남. 무한 스켈레톤 차단.
 *   타임아웃 시 — 스켈레톤 → 에러 상태 전환 + "데이터 로딩이 지연되고
 *   있습니다." + [재시도] 버튼.
 *
 *   #1 프로그레시브 로딩 (KPI/차트 독립 fetch) 는 endpoint 분리 의존 →
 *   §11.246b 로 park (Promise.all + KPI 경량 API 분리 와 통합).
 *
 * canonical truth lock:
 *   - useQuery<AnalyticsDashboardData> 시그니처 보존
 *   - fetchAnalyticsDashboard 함수 signature 보존 (AbortController param 추가)
 *   - §11.244 Phase A + Phase B trace 보존 (dataInsufficient + mockup data)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../app/dashboard/analytics/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("§11.244 Phase C #1 — 10초 timeout (AbortController)", () => {
  it("fetchAnalyticsDashboard 안 AbortController 도입", () => {
    expect(page).toMatch(/AbortController/);
  });

  it("setTimeout 10000ms (또는 TIMEOUT_MS sentinel) — abort trigger", () => {
    // 10s timeout 또는 ANALYTICS_TIMEOUT_MS 같은 const
    expect(page).toMatch(/(10000|10_000|TIMEOUT_MS|ANALYTICS_TIMEOUT)/);
  });

  it("timeout 시 specific error message — '지연' 또는 '시간 초과'", () => {
    expect(page).toMatch(/(로딩이 지연|시간 초과|Timeout)/);
  });
});

describe("§11.244 Phase C #2 — 재시도 button + queryClient refetch", () => {
  it("useQuery 에서 refetch destructure", () => {
    expect(page).toMatch(/useQuery<AnalyticsDashboardData>\(\s*\{[\s\S]{0,400}\}\s*\)/);
    expect(page).toMatch(/refetch/);
  });

  it("isError 분기 안 재시도 button — onClick refetch 호출", () => {
    // isError 분기 안 '재시도' label + onClick refetch
    expect(page).toMatch(/(재시도|다시 시도)[\s\S]{0,400}onClick/);
  });
});

describe("§11.244 Phase C #3 — invariant 보존 (cluster lineage)", () => {
  it("§11.244 Phase A trace 보존 (dataInsufficient + AI disabled)", () => {
    expect(page).toMatch(/dataInsufficient/);
  });

  it("§11.244 Phase B trace 보존 (MOCKUP_MONTHLY_DATA + MOCKUP_VENDOR_DATA)", () => {
    expect(page).toMatch(/MOCKUP_MONTHLY_DATA/);
    expect(page).toMatch(/MOCKUP_VENDOR_DATA/);
  });

  it("useQuery<AnalyticsDashboardData> + fetchAnalyticsDashboard 보존", () => {
    expect(page).toMatch(/useQuery<AnalyticsDashboardData>/);
    expect(page).toMatch(/fetchAnalyticsDashboard/);
  });

  it("§11.244 Phase C trace marker comment", () => {
    expect(page).toMatch(/§11\.244[\s\S]{0,400}(Phase C|timeout|재시도|AbortController)/i);
  });
});
