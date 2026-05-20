/**
 * §11.272c #quote-kpi-mobile-summary-bar — 견적 KPI 5 카드 모바일 가로 스크롤
 *   → 1줄 숫자 요약 바 (호영님 P0 spec 방안 A)
 *
 * 호영님 spec 핵심:
 *   "모바일에서 KPI 5개를 가로 스크롤해야 전체를 볼 수 있으면 대부분 사용자는
 *    뒤쪽 카드를 못 봄. 한 화면에 모두 보여야 함."
 *
 *   방안 A (권장): 1줄 숫자 요약 바
 *     발송 8 | 회신 4 | 비교 0 | 승인 0 | 전환 0
 *     - 5개 KPI text + 숫자 1줄
 *     - 활성 (count > 0) = 컬러 / 0건 = 회색
 *     - 탭 → 해당 상태로 하단 목록 필터
 *     - 높이 ~40px
 *
 *   삭제 대상:
 *     - 가로 스크롤 카드 레이아웃 (모바일만)
 *     - 페이지네이션 도트 (data-testid="quote-kpi-scroll-dots")
 *     - 카드 내 설명 텍스트 ("집계 확인 중" / insight) — 모바일만
 *
 *   로딩 5초 timeout: "불러오기 실패 — 새로고침"
 *
 * Fix (minimum diff, 1 file UI swap):
 *   1. KPI wrapper className `flex sm:grid overflow-x-auto ...` → `hidden sm:grid ...`
 *      (모바일 hidden, 데스크탑 5 cell grid 보존)
 *   2. 신규 모바일 1줄 요약 바 (sm:hidden flex) — 5 KPI text + count
 *   3. 페이지네이션 도트 (`quote-kpi-scroll-dots`) 제거 (모바일에서 1줄 요약 바 → 도트 불필요)
 *
 * canonical truth lock:
 *   - summaryStats 데이터 흐름 보존 (dispatchPending / responseTracking / compareReview /
 *     approvalException / readyToConvert)
 *   - setStatusFilter onClick 보존 (PENDING / SENT / RESPONDED / DEADLINE_TODAY / COMPLETED)
 *   - isCompareReviewZero disabled 분기 보존
 *   - 데스크탑 (sm+) 카드 레이아웃 변경 0
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const QUOTES = readFileSync(
  resolve(__dirname, "../../app/dashboard/quotes/page.tsx"),
  "utf8",
);

describe("§11.272c #1 — 모바일 1줄 요약 바 + 가로 스크롤 제거", () => {
  it("§11.272c trace marker comment 존재", () => {
    expect(QUOTES).toMatch(/§11\.272c/);
  });

  it("KPI wrapper 모바일에서 hidden (sm:grid 만 표시)", () => {
    // 기존: flex sm:grid overflow-x-auto ... snap-x snap-mandatory
    // 신규: hidden sm:grid sm:overflow-visible (모바일 hidden)
    expect(QUOTES).toMatch(/hidden sm:grid[\s\S]{0,200}grid-cols-2 md:grid-cols-3 lg:grid-cols-5/);
  });

  it("KPI 카드 wrapper 에 모바일 overflow-x-auto snap-x snap-mandatory 제거", () => {
    // 카드 wrapper 에 flex overflow-x-auto snap-x snap-mandatory 가 있으면 안 됨
    expect(QUOTES).not.toMatch(
      /KPI Control Cards[\s\S]{0,300}flex sm:grid overflow-x-auto/,
    );
  });

  it("모바일 1줄 요약 바 (sm:hidden) 컴포넌트 존재", () => {
    expect(QUOTES).toMatch(/data-testid="quote-kpi-mobile-summary-bar"/);
  });

  it("모바일 요약 바 sm:hidden + flex 1줄 (5 KPI 가로 균등)", () => {
    expect(QUOTES).toMatch(
      /data-testid="quote-kpi-mobile-summary-bar"[\s\S]{0,300}sm:hidden[\s\S]{0,200}flex/,
    );
  });

  it("페이지네이션 도트 (quote-kpi-scroll-dots) 제거", () => {
    expect(QUOTES).not.toMatch(/data-testid="quote-kpi-scroll-dots"/);
  });
});

describe("§11.272c #2 — 5 KPI label + count 정합", () => {
  it("모바일 요약 바에 5 KPI 짧은 라벨 (발송 / 회신 / 비교 / 승인 / 전환)", () => {
    // mobile-summary-bar 직후 5 short label 이 가까이 존재 (8000 char window 안)
    expect(QUOTES).toMatch(
      /quote-kpi-mobile-summary-bar[\s\S]{0,8000}short: "발송"[\s\S]{0,500}short: "회신"[\s\S]{0,500}short: "비교"[\s\S]{0,500}short: "승인"[\s\S]{0,500}short: "전환"/,
    );
  });

  it("모바일 요약 바 5 KPI 모두 setStatusFilter onClick", () => {
    // setStatusFilter 호출이 mobile-summary-bar 안에 5번 (또는 map 패턴)
    expect(QUOTES).toMatch(
      /quote-kpi-mobile-summary-bar[\s\S]{0,4000}setStatusFilter/,
    );
  });

  it("0건 KPI 회색 (text-slate-400 또는 opacity 톤다운)", () => {
    expect(QUOTES).toMatch(
      /quote-kpi-mobile-summary-bar[\s\S]{0,4000}text-slate-400/,
    );
  });
});

describe("§11.272c #3 — invariant 보존 (canonical truth)", () => {
  it("summaryStats 5 source (dispatchPending / responseTracking / compareReview / approvalException / readyToConvert) 보존", () => {
    expect(QUOTES).toMatch(/summaryStats\.dispatchPending/);
    expect(QUOTES).toMatch(/summaryStats\.responseTracking/);
    expect(QUOTES).toMatch(/summaryStats\.compareReview/);
    expect(QUOTES).toMatch(/summaryStats\.approvalException/);
    expect(QUOTES).toMatch(/summaryStats\.readyToConvert/);
  });

  it("setStatusFilter 5 filter (PENDING / SENT / RESPONDED / DEADLINE_TODAY / COMPLETED) 보존", () => {
    expect(QUOTES).toMatch(/filter: "PENDING"/);
    expect(QUOTES).toMatch(/filter: "SENT"/);
    expect(QUOTES).toMatch(/filter: "RESPONDED"/);
    expect(QUOTES).toMatch(/filter: "DEADLINE_TODAY"/);
    expect(QUOTES).toMatch(/filter: "COMPLETED"/);
  });

  it("isCompareReviewZero disabled 분기 보존 (canonical truth)", () => {
    expect(QUOTES).toMatch(/isCompareReviewZero/);
  });

  it("데스크탑 (sm:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5) 5 cell grid 보존", () => {
    expect(QUOTES).toMatch(/sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5/);
  });

  it("데스크탑 카드 의 기존 icon (Send / Clock / RefreshCw / AlertCircle / FileCheck2) 보존", () => {
    expect(QUOTES).toMatch(/icon: Send,\s*filter: "PENDING"/);
    expect(QUOTES).toMatch(/icon: Clock,\s*filter: "SENT"/);
    expect(QUOTES).toMatch(/icon: RefreshCw,\s*filter: "RESPONDED"/);
    expect(QUOTES).toMatch(/icon: AlertCircle,\s*filter: "DEADLINE_TODAY"/);
    expect(QUOTES).toMatch(/icon: FileCheck2,\s*filter: "COMPLETED"/);
  });
});
