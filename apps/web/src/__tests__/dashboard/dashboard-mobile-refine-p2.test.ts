/**
 * §dashboard-mobile-refine P2 #tone-and-banner — 메인 대시보드 모바일 1a 기본 수정 2종
 *
 * 정본: docs/plans/PLAN_dashboard-mobile-refine.md + 호영님 지시문(2026-07-20)
 *   "모바일 대시보드 핸드오프.md" §1 기본 수정(1a).
 *
 * 호영님 결정(2026-07-20):
 *   - #1 배너 말줄임 제거 → **모바일(<768px)만 2줄, sm↑ 는 thin 1행 유지**
 *     (§nextstep-banner-density / 견적 PriorityRecommendationCard 데스크탑 정합 보존).
 *   - #2 지시문 amber 헥스 → **C 확정: yellow 계열 근사.** 앰버/오렌지 Tailwind class 도입 0
 *     (16 amber-removed sentinel + CLAUDE.md §9 규율 무손).
 *   - #3 재고 카드 배경 제거 → traffic-light sentinel 무저촉 확인(302c 범위 = inventory-main.tsx 단일).
 *   - F5 모바일 배너 parity → **(i) 수용**: 대시보드(단일 배너/전체 맥락) vs 견적(리스트 즉시 노출)
 *     역할이 달라 모바일 밀도 차를 정당화. 데스크탑 parity 는 보존.
 *
 * F4 부수 정합: mobile-dashboard-view 는 rose-* 8회 / red-* 0회로 CLAUDE.md §9 위험 토큰(red)과
 *   어긋나 있었음. 지시문 레드 포인트 #b91c1c / 칩 배경 #fef2f2 = red-700 / red-50 이므로,
 *   톤다운과 동시에 **재고 경고 카드 한정** rose → red 정합을 함께 달성한다.
 *   전월 대비 증가(text-rose-600)는 의미가 달라(지출 증가 ≠ 재고 위험) 범위 밖 — 미변경.
 *
 * ⚠️ 이 파일은 §dashboard-mobile-refine Phase 2 의 RED sentinel 이다.
 *    Phase 2 구현 전에는 실패하는 것이 정상.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

const MOBILE_VIEW = "src/components/dashboard/mobile-dashboard-view.tsx";
const BANNER = "src/components/dashboard/next-step-banner.tsx";

/* ────────────────────────────────────────────────────────────
 * 1a-① 재고 경고 카드 — 배경 채색 제거 + 레드 포인트
 * ──────────────────────────────────────────────────────────── */
describe("§dashboard-mobile-refine P2 — 재고 경고 카드 톤다운", () => {
  it("경고 1+건에도 배경 채색 0 (bg-rose-50 / border-rose-200 분기 폐지)", () => {
    const src = read(MOBILE_VIEW);
    expect(src).not.toMatch(/bg-rose-50 border-rose-200/);
  });

  it("재고 카드 rose-* 토큰 0 → CLAUDE.md §9 위험 토큰(red-*) 정합", () => {
    const src = read(MOBILE_VIEW);
    // 재고 경고 Link 블록만 절취해 검사 (전월 대비 text-rose-600 은 범위 밖 — 아래 회귀 0 참조)
    const m = src.match(/filter=low[\s\S]*?<\/Link>/);
    expect(m).not.toBeNull();
    const stockCard = m![0];
    expect(stockCard).not.toMatch(/rose-\d/);
    expect(stockCard).toMatch(/red-\d/);
  });

  it("아이콘 칩 — 22px 라운드 사각 + bg-red-50/text-red-700", () => {
    const src = read(MOBILE_VIEW);
    expect(src).toMatch(/h-\[22px\] w-\[22px\]/);
    expect(src).toMatch(/bg-red-50 text-red-700/);
  });

  it("숫자 text-red-700 (경고 1+건)", () => {
    const src = read(MOBILE_VIEW);
    expect(src).toMatch(/stockAlertCount > 0 \? "text-red-700"/);
  });

  it("서브텍스트 rose 분기 폐지 — 카드 하단은 중립 그레이 계열만 (P3 진화)", () => {
    // 🔄 §dashboard-mobile-refine P3 진화 — **보호의도 불변**: 재고 카드 하단이 rose 톤 중복 서사를
    //    들고 있지 않을 것. P2 에서는 '안전재고 미달' 중립 그레이였고, P3(2a-3 역할 분리)에서
    //    해당 문구를 실행 큐 helper 와의 중복으로 제거하고 '처리 ›' 어포던스로 대체한다.
    //    → 문구 자체가 아니라 "rose 분기 부재 + 중립 톤" 을 계속 강제한다.
    const src = read(MOBILE_VIEW);
    const m = src.match(/filter=low[\s\S]*?<\/Link>/);
    expect(m).not.toBeNull();
    expect(m![0]).not.toMatch(/rose-\d/);
    expect(m![0]).toMatch(/text-slate-400/);
  });

  it("amber/orange Tailwind class 0 (§11.302 · C 확정 유지)", () => {
    const src = read(MOBILE_VIEW);
    expect(src).not.toMatch(/(bg|text|border|border-l|from|to|ring)-(amber|orange)-\d/);
  });
});

/* ────────────────────────────────────────────────────────────
 * 1a-② 다음 단계 추천 배너 — 모바일 2줄 / sm↑ thin 1행
 * ──────────────────────────────────────────────────────────── */
describe("§dashboard-mobile-refine P2 — 배너 모바일 2줄 분기", () => {
  it("모바일 line-clamp-2 (말줄임 1행 → 2줄 전문)", () => {
    const src = read(BANNER);
    expect(src).toMatch(/line-clamp-2/);
  });

  it("sm↑ 는 기존 thin 1행 유지 (견적 정합 보존)", () => {
    const src = read(BANNER);
    expect(src).toMatch(/sm:line-clamp-none/);
    expect(src).toMatch(/sm:truncate/);
  });

  it("모바일 무조건 truncate 폐지 (분기 없는 단독 truncate 금지)", () => {
    const src = read(BANNER);
    expect(src).not.toMatch(/leading-snug truncate"/);
  });

  it("text-wrap:pretty 적용 (2줄 줄바꿈 품질)", () => {
    const src = read(BANNER);
    expect(src).toMatch(/\[text-wrap:pretty\]/);
  });
});

/* ────────────────────────────────────────────────────────────
 * 회귀 0 — 기존 계약 전수 보존
 * ──────────────────────────────────────────────────────────── */
describe("§dashboard-mobile-refine P2 — 회귀 0 (배너 §dashboard-shifan-adopt / §nextstep-banner-density)", () => {
  it("navy 토큰 보존 (gradient + boxShadow)", () => {
    const src = read(BANNER);
    expect(src).toMatch(/linear-gradient\(100deg, #1b2b50 0%, #243a72 55%, #2f6be0 130%\)/);
    expect(src).toMatch(/boxShadow: "0 6px 18px -8px rgba\(20,38,80,\.55\)"/);
  });

  it("단일 행 컨테이너(flex items-center) 보존 — 3행 스택 회귀 0", () => {
    const src = read(BANNER);
    expect(src).toMatch(/flex items-center gap-2\.5/);
    expect(src).not.toMatch(/flex flex-col gap-0\.5/);
  });

  it("인라인 소형 아이콘 보존 (h-10 w-10 box 회귀 0)", () => {
    const src = read(BANNER);
    expect(src).not.toMatch(/h-10 w-10 flex-shrink-0 items-center justify-center/);
    expect(src).toMatch(/<Icon className="relative z-10 h-4 w-4 flex-none/);
  });

  it("deriveInsight + '다음 단계 추천' + CTA href + min-h-[44px] 보존", () => {
    const src = read(BANNER);
    expect(src).toMatch(/다음 단계 추천/);
    expect(src).toMatch(/budget\.isSet/);
    expect(src).toMatch(/예산 설정/);
    expect(src).toMatch(/href=\{ins\.cta\.href\}/);
    expect(src).toMatch(/min-h-\[44px\]/);
  });

  it("dismiss(localStorage) + return null self-gate 보존", () => {
    const src = read(BANNER);
    expect(src).toMatch(/lab_insight_dismissed/);
    expect(src).toMatch(/localStorage/);
    expect(src).toMatch(/return null/);
  });
});

describe("§dashboard-mobile-refine P2 — 회귀 0 (모바일 뷰 §dashboard-mobile-v2)", () => {
  it("canonical 재사용 3종 보존 (NextStepBanner · ActionInbox · Pipeline)", () => {
    // 🔄 §dashboard-mobile-refine P3 진화 — **보호의도 불변**: 보호 대상은 "모바일 뷰가 canonical
    //    컴포넌트를 canonical 데이터로 재사용한다"(중복 구현 0)이지, 태그의 self-closing 형태가 아니다.
    //    P3(2a-1)에서 ActionInbox 에 옵셔널 viewAllHref 를 주입하므로 prop 추가를 허용하도록 완화하되,
    //    `items={actionInboxItems}` canonical 결선은 계속 강제한다.
    //    (2026-07-20 operator 실측에서 이 pin 이 자기 변경과 충돌해 red — 전사 드리프트로 sandbox 미포착.)
    const src = read(MOBILE_VIEW);
    expect(src).toMatch(/<NextStepBanner summary=\{summary\} \/>/);
    expect(src).toMatch(/<ActionInbox items=\{actionInboxItems\}/);
    expect(src).toMatch(/<Pipeline state=\{state\} summary=\{summary\} onRetry=\{onRetry\} \/>/);
  });

  it("재고 카드 딥링크 목적지 보존 (/dashboard/inventory?filter=low)", () => {
    const src = read(MOBILE_VIEW);
    expect(src).toMatch(/href="\/dashboard\/inventory\?filter=low"/);
  });

  it("진행 중 견적 카드 무접촉 (딥링크 + 카운트)", () => {
    const src = read(MOBILE_VIEW);
    expect(src).toMatch(/href="\/dashboard\/quotes"/);
    expect(src).toMatch(/\{activeQuotesCount\}/);
  });

  it("예산 canonical 정직 표기 보존 (budget?.isSet 분기 + 설정 CTA)", () => {
    const src = read(MOBILE_VIEW);
    expect(src).toMatch(/budget\?\.isSet/);
    expect(src).toMatch(/href="\/dashboard\/budget"/);
  });

  it("전월 대비 증가 text-rose-600 은 범위 밖 — 미변경 보존", () => {
    const src = read(MOBILE_VIEW);
    expect(src).toMatch(/momDown \? "text-emerald-600" : "text-rose-600"/);
  });

  it("지출 분석 아코디언 실동작 보존 (dead button 0)", () => {
    const src = read(MOBILE_VIEW);
    expect(src).toMatch(/onClick=\{\(\) => setAnalysisOpen/);
    expect(src).toMatch(/aria-expanded=\{analysisOpen\}/);
  });

  it("터치 타겟 ≥44px 보존 (아코디언 min-h-[48px])", () => {
    const src = read(MOBILE_VIEW);
    expect(src).toMatch(/min-h-\[48px\]/);
  });
});
