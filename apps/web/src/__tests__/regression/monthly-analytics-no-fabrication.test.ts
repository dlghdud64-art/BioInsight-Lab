/**
 * §monthly-analytics-no-fabrication (2026-09-22) · **월별 상세는 지어낸·매번 바뀌는 수를 그리지 않는다.**
 *
 * ── 왜 ──
 * /dashboard/analytics/monthly 가 `monthlyData2026`(주석 「가상 12개월 데이터」)을 그래프·표로 그렸고,
 * 2025년 값은 `2026 × (0.85 + Math.random() × 0.2)` 로 **로드할 때마다 새로** 만들었다.
 * 실제 월별 출처(/api/analytics/dashboard monthlySpending)는 **최근 6개월**뿐이라 「연도별 12개월」 을
 * 참으로 채울 수 없다 → 비워 두고 실제 추이가 있는 곳(지출 분석 홈)을 안내한다.
 *
 * ── 이 파일이 지키는 명제 ──
 *   ① 지어낸 월별 데이터 0 — monthlyData2026/2025 · 리터럴 금액 · 난수(Math.random) (역계약 · 주석 제거본)
 *   ② 고를 데이터가 없는 「연도 선택」 0
 *   ③ 「데이터 없음 + 왜 + 어디서」 — 12개월 집계 미제공 · 최근 6개월은 지출 분석 홈(실제 링크)
 *
 * ── 자기 한계 ──
 *   1. 연도별 12개월 API 가 생기면 ③ 을 실데이터 계약으로 바꾼다(①②는 유지).
 *   2. 「최근 6개월」 은 API 의 현재 범위(route.ts subMonths(now, 5))에 기대는 문구다 — 범위가 바뀌면 함께 고친다.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";

const SRC = join(__dirname, "..", "..");
const PAGE = stripComments(readFileSync(join(SRC, "app/dashboard/analytics/monthly/page.tsx"), "utf8"));
const API = stripComments(readFileSync(join(SRC, "app/api/analytics/dashboard/route.ts"), "utf8"));

describe("§monthly-analytics-no-fabrication · 월별 상세는 지어낸 수를 그리지 않는다", () => {
  it("① 지어낸 월별 데이터 0 (역계약)", () => {
    expect(PAGE).not.toMatch(/\bmonthlyData2026\b|\bmonthlyData2025\b/);
    expect(PAGE).not.toMatch(/Math\.random\(/);
    expect(PAGE).not.toMatch(/\b1850000\b|\b1620000\b|\b2350000\b/);
    expect(PAGE).not.toMatch(/amount:\s*\d{6,}/);
  });

  it("② 고를 데이터가 없는 「연도 선택」 0", () => {
    expect(PAGE).not.toMatch(/<SelectItem\b/);
    expect(PAGE).not.toMatch(/연도 선택/);
  });

  it("③ 데이터 없음 + 왜 + 어디서(실제 링크)", () => {
    expect(PAGE).toMatch(/연도별 월간 지출 데이터 없음/);
    expect(PAGE).toMatch(/연도별 12개월 집계는 아직 제공하지 않습니다/);
    expect(PAGE).toMatch(/<Link href="\/dashboard\/analytics"[^>]*>\s*지출 분석 홈\s*<\/Link>/);
    // 「최근 6개월」 이 참인 동안만 유효 — API 범위가 6개월(subMonths(now, 5))인지 함께 문다
    expect(PAGE).toMatch(/최근 6개월/);
    expect(API).toMatch(/subMonths\(now,\s*5\)/);
  });
});
