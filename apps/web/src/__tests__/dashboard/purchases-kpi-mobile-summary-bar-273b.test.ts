/**
 * §11.273b #purchases-kpi-mobile-summary-bar — 구매 운영 KPI 4 카드 → 1줄 요약 바
 *   (§11.272c 패턴 reuse, 호영님 P0 spec)
 *
 * 호영님 spec:
 *   2×2 그리드 → 1줄 요약 바
 *     검토 2 | 발주 0 | 확정 0 | 만료 0
 *   - 0건 카드 회색 톤다운, 숫자만 표시
 *   - 활성 카드 (1건 이상) 컬러
 *   - 카드 내 설명 텍스트 ("응답 수집 중", "비교 완료 · 발주 대기" 등) 제거
 *
 * Fix (minimum diff, 1 file UI swap):
 *   1. KPI 4 KpiCard grid wrapper className `grid grid-cols-2 lg:grid-cols-4 ...`
 *      → `hidden md:grid md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4` (모바일 hidden,
 *      데스크탑 4 cell grid 보존)
 *   2. 신규 모바일 1줄 요약 바 (md:hidden flex) — 4 KPI 짧은 라벨 + count
 *      - 검토 / 발주 / 확정 / 만료
 *      - count > 0 = tone color (blue / emerald / purple / rose)
 *      - count = 0 = text-slate-400 (회색)
 *      - 활성 queueTab = bg-slate-100
 *      - tap → setQueueTab (기존 KpiCard onClick 와 동일 분기)
 *
 * canonical truth lock:
 *   - stats.review_required / ready_for_po / confirmed / expired 데이터 흐름 보존
 *   - setQueueTab onClick (review_required / ready_for_po / confirmed) 보존
 *   - 데스크탑 KpiCard (icon / valueColor / sub / active) 변경 0
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PURCHASES = readFileSync(
  resolve(__dirname, "../../app/dashboard/purchases/page.tsx"),
  "utf8",
);

describe("§11.273b #1 — 모바일 1줄 요약 바 + 4 cell grid 데스크탑 분기", () => {
  it("§11.273b trace marker comment 존재", () => {
    expect(PURCHASES).toMatch(/§11\.273b/);
  });

  it("KPI grid wrapper 모바일 hidden (hidden md:grid)", () => {
    expect(PURCHASES).toMatch(/hidden md:grid[\s\S]{0,200}lg:grid-cols-4/);
  });

  it("모바일 1줄 요약 바 (quote-purchases-kpi-mobile-summary-bar) 신규 mount", () => {
    expect(PURCHASES).toMatch(/data-testid="purchases-kpi-mobile-summary-bar"/);
  });

  it("모바일 요약 바 md:hidden + flex (1줄 균등)", () => {
    expect(PURCHASES).toMatch(
      /data-testid="purchases-kpi-mobile-summary-bar"[\s\S]{0,300}md:hidden[\s\S]{0,200}flex/,
    );
  });
});

describe("§11.273b #2 — 4 KPI label + count 정합", () => {
  it("모바일 요약 바에 4 KPI 짧은 라벨 (검토 / 발주 / 확정 / 만료)", () => {
    expect(PURCHASES).toMatch(
      /purchases-kpi-mobile-summary-bar[\s\S]{0,4000}short: "검토"[\s\S]{0,500}short: "발주"[\s\S]{0,500}short: "확정"[\s\S]{0,500}short: "만료"/,
    );
  });

  it("모바일 요약 바 4 KPI 모두 setQueueTab onClick", () => {
    expect(PURCHASES).toMatch(
      /purchases-kpi-mobile-summary-bar[\s\S]{0,4000}setQueueTab/,
    );
  });

  it("0건 KPI 회색 (text-slate-400)", () => {
    expect(PURCHASES).toMatch(
      /purchases-kpi-mobile-summary-bar[\s\S]{0,4000}text-slate-400/,
    );
  });
});

describe("§11.273b #3 — invariant 보존 (canonical truth)", () => {
  it("stats 4 source (review_required / ready_for_po / confirmed / expired) 보존", () => {
    expect(PURCHASES).toMatch(/stats\.review_required/);
    expect(PURCHASES).toMatch(/stats\.ready_for_po/);
    expect(PURCHASES).toMatch(/stats\.confirmed/);
    expect(PURCHASES).toMatch(/stats\.expired/);
  });

  it("setQueueTab 3 filter (review_required / ready_for_po / confirmed) 보존", () => {
    expect(PURCHASES).toMatch(/setQueueTab\(queueTab === "review_required"/);
    expect(PURCHASES).toMatch(/setQueueTab\(queueTab === "ready_for_po"/);
    expect(PURCHASES).toMatch(/setQueueTab\(queueTab === "confirmed"/);
  });

  it("데스크탑 KpiCard 4 (icon / label / value / valueColor / sub / active / onClick) 보존", () => {
    expect(PURCHASES).toMatch(/<KpiCard[\s\S]{0,500}label="검토 필요"/);
    expect(PURCHASES).toMatch(/<KpiCard[\s\S]{0,500}label="발주 가능"/);
    expect(PURCHASES).toMatch(/<KpiCard[\s\S]{0,500}label="확정됨"/);
    expect(PURCHASES).toMatch(/<KpiCard[\s\S]{0,500}label="만료"/);
  });

  it("데스크탑 KpiCard 4 icon (ListChecks / CircleCheck / AlertCircle / Clock) 보존", () => {
    expect(PURCHASES).toMatch(/<ListChecks className="h-5 w-5 text-blue-500"/);
    expect(PURCHASES).toMatch(/<CircleCheck className="h-5 w-5 text-emerald-500"/);
    expect(PURCHASES).toMatch(/<AlertCircle className="h-5 w-5 text-purple-500"/);
    expect(PURCHASES).toMatch(/<Clock className="h-5 w-5 text-rose-500"/);
  });
});
