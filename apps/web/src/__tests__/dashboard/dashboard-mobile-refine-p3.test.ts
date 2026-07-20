/**
 * §dashboard-mobile-refine P3 #queue-header-role-spend — 2a 저위험 3종
 *
 * 정본: docs/plans/PLAN_dashboard-mobile-refine.md Phase 3 + 호영님 지시문(2026-07-20) §2 고도화(2a).
 *
 * 범위 (3종 — 2a-6 내비 뱃지는 F8 로 분리, 판정 대기):
 *   2a-1 실행 큐 헤더 `전체 보기 ›`
 *        ⚠️ ActionInbox 는 데스크탑 공유 컴포넌트 → **옵셔널 prop(viewAllHref)** 로 구현하고
 *           모바일 뷰만 주입. 데스크탑 page.tsx 는 미주입 = 무접촉(회귀 0).
 *   2a-3 역할 분리 — 재고 경고 카드 = 순수 카운트 + `처리 ›` 딥링크.
 *        실행 큐 `재고 부족` 행 href 와 **동일 목적지**(/dashboard/inventory?filter=low) — page.tsx
 *        dashboardPriorityActions[id=inventory].href 와 일치 확인됨(신규 라우트 0).
 *   2a-2 지출+예산 통합 — 지출 카드에 미니 스파크라인(canonical monthlySpending 파생) +
 *        하단 인라인 예산 바. **별도 예산 힌트 카드 삭제.**
 *
 * canonical 규율:
 *   - 스파크라인은 monthlySpending 재사용 — 신규 fetch 0, 신규 패키지 0(inline SVG).
 *     데이터 2점 미만이면 미노출(가짜 추이 금지).
 *   - 예산은 summary.budget.isSet 정직 표기 유지(미설정 시 가짜 집행률 0).
 *
 * ⚠️ 이 파일은 Phase 3 의 RED sentinel 이다. 구현 전 실패가 정상.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

const MOBILE_VIEW = "src/components/dashboard/mobile-dashboard-view.tsx";
const INBOX = "src/components/dashboard/action-inbox.tsx";
const PAGE = "src/app/dashboard/page.tsx";

/* ── 2a-1 실행 큐 헤더 ─────────────────────────────────────── */
describe("§dashboard-mobile-refine P3 — 실행 큐 헤더 '전체 보기 ›'", () => {
  it("ActionInbox 에 옵셔널 viewAllHref prop 존재", () => {
    const src = read(INBOX);
    expect(src).toMatch(/viewAllHref\?:\s*string/);
  });

  it("viewAllHref 주입 시에만 '전체 보기' 렌더 (미주입 시 dead button 0)", () => {
    const src = read(INBOX);
    expect(src).toMatch(/viewAllHref\s*&&/);
    expect(src).toMatch(/전체 보기/);
  });

  it("모바일 뷰가 viewAllHref 주입", () => {
    const src = read(MOBILE_VIEW);
    expect(src).toMatch(/viewAllHref=/);
  });

  it("데스크탑 page.tsx 는 미주입 — 무접촉 보존", () => {
    const src = read(PAGE);
    expect(src).toMatch(/<ActionInbox items=\{actionInboxItems\} \/>/);
  });
});

/* ── 2a-3 역할 분리 ────────────────────────────────────────── */
describe("§dashboard-mobile-refine P3 — 재고 카드 역할 분리", () => {
  it("'처리' 어포던스 노출 (순수 카운트 + 딥링크)", () => {
    const src = read(MOBILE_VIEW);
    const m = src.match(/filter=low[\s\S]*?<\/Link>/);
    expect(m).not.toBeNull();
    expect(m![0]).toMatch(/처리/);
  });

  it("중복 서사 '안전재고 미달' 제거 (실행 큐 helper 와 중복)", () => {
    const src = read(MOBILE_VIEW);
    expect(src).not.toMatch(/안전재고 미달/);
  });

  it("실행 큐 재고 행과 동일 목적지 (신규 라우트 0)", () => {
    const view = read(MOBILE_VIEW);
    const page = read(PAGE);
    expect(view).toMatch(/href="\/dashboard\/inventory\?filter=low"/);
    expect(page).toMatch(/id: "inventory"[\s\S]{0,300}href: "\/dashboard\/inventory\?filter=low"/);
  });
});

/* ── 2a-2 지출 + 예산 통합 ─────────────────────────────────── */
describe("§dashboard-mobile-refine P3 — 지출+예산 통합 카드", () => {
  it("미니 스파크라인 — inline SVG(신규 패키지 0)", () => {
    const src = read(MOBILE_VIEW);
    expect(src).toMatch(/<svg/);
    expect(src).toMatch(/<polyline/);
  });

  it("스파크라인은 canonical monthlySpending 파생 (신규 fetch 0)", () => {
    const src = read(MOBILE_VIEW);
    expect(src).toMatch(/monthlySpending/);
    expect(src).toMatch(/useMemo/);
  });

  it("데이터 2점 미만 시 미노출 — 가짜 추이 0", () => {
    const src = read(MOBILE_VIEW);
    // 가드: 표본 2점 미만이면 null 반환 → 스파크라인 자체를 렌더하지 않는다.
    expect(src).toMatch(/length < 2\)\s*return null/);
    expect(src).toMatch(/\{spark && \(/);
  });

  it("예산 인라인 바 — 미설정 정직 문구 + 설정 CTA", () => {
    const src = read(MOBILE_VIEW);
    expect(src).toMatch(/예산 미설정 · 지출만 기록 중/);
    expect(src).toMatch(/href="\/dashboard\/budget"/);
  });

  it("별도 예산 힌트 카드 삭제 (레거시 문구 0)", () => {
    const src = read(MOBILE_VIEW);
    expect(src).not.toMatch(/예산을 설정하면 집행률·초과 경고 자동 집계/);
    expect(src).not.toMatch(/아직 예산이 없어 지출만 기록 중/);
  });

  it("예산 설정 시 집행률 canonical 유지 (가짜 집행률 0)", () => {
    const src = read(MOBILE_VIEW);
    expect(src).toMatch(/budget\?\.isSet/);
    expect(src).toMatch(/budget\.usageRate/);
  });
});

/* ── 회귀 0 ────────────────────────────────────────────────── */
describe("§dashboard-mobile-refine P3 — 회귀 0", () => {
  it("Phase 2 재고 톤 보존 (배경 채색 0 · red 포인트 · 22px 칩)", () => {
    const src = read(MOBILE_VIEW);
    expect(src).not.toMatch(/bg-rose-50 border-rose-200/);
    expect(src).toMatch(/h-\[22px\] w-\[22px\]/);
    expect(src).toMatch(/bg-red-50 text-red-700/);
  });

  it("amber/orange Tailwind 0 (§11.302 · C 확정)", () => {
    expect(read(MOBILE_VIEW)).not.toMatch(/(bg|text|border|border-l|from|to|ring)-(amber|orange)-\d/);
    expect(read(INBOX)).not.toMatch(/(bg|text|border|border-l|from|to|ring)-(amber|orange)-\d/);
  });

  it("ActionInbox 기존 계약 보존 (count>0 필터 · empty 정직 · 신호등 · 행 라우팅)", () => {
    const src = read(INBOX);
    expect(src).toMatch(/items\.filter\(\(it\) => it\.count > 0\)/);
    expect(src).toMatch(/처리할 항목 없음/);
    expect(src).toMatch(/bg-yellow-50 text-yellow-600/);
    expect(src).toMatch(/오늘 처리해야 할 일/);
  });

  it("canonical 재사용 3종 보존", () => {
    const src = read(MOBILE_VIEW);
    expect(src).toMatch(/<NextStepBanner summary=\{summary\} \/>/);
    expect(src).toMatch(/<ActionInbox/);
    expect(src).toMatch(/<Pipeline state=\{state\} summary=\{summary\} onRetry=\{onRetry\} \/>/);
  });

  it("전월 대비 rose-600 범위 밖 보존 + 아코디언 실동작", () => {
    const src = read(MOBILE_VIEW);
    expect(src).toMatch(/momDown \? "text-emerald-600" : "text-rose-600"/);
    expect(src).toMatch(/onClick=\{\(\) => setAnalysisOpen/);
  });

  it("배너 뷰포트 분기 보존 (Phase 2)", () => {
    const src = read("src/components/dashboard/next-step-banner.tsx");
    expect(src).toMatch(/line-clamp-2/);
    expect(src).toMatch(/sm:truncate/);
  });
});
