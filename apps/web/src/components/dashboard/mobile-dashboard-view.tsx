"use client";

/**
 * §dashboard-mobile-v2 — 메인 대시보드 모바일 뷰(시안 01 정합, 호영님 2026-07-03).
 *
 * 전용 모바일 컴포넌트(부모가 md:hidden 마운트) — 데스크탑(hidden md:block) 무접촉.
 * 시안 흐름(위→아래): 우선 추천 → 지금 할 일 → KPI(이번달지출·진행견적·재고경고) →
 *   예산 배너 → 운영 파이프라인 → 지출 분석(기본 접힘 아코디언).
 * canonical 재사용(중복 0): NextStepBanner·ActionInbox·Pipeline·SpendTrendCard 그대로,
 *   KPI/예산은 summary(canonical)·stats(전월대비 실데이터)에서 파생(가짜 0).
 * §11.302 톤. dead button 0(예산 CTA·아코디언 실동작). 우선순위는 룰베이스(라벨 없음).
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import dynamic_import from "next/dynamic";
import { FileText, PackageX, TrendingDown, TrendingUp, ChevronDown, ChevronRight, Wallet } from "lucide-react";
import type { SectionState } from "@/lib/dashboard/section-state";
import { won, type DashboardSummary } from "@/lib/dashboard/summary-derive";
import { NextStepBanner } from "@/components/dashboard/next-step-banner";
import { ActionInbox, type ActionInboxItem } from "@/components/dashboard/action-inbox";
import { Pipeline } from "@/components/dashboard/pipeline";

const SpendTrendCard = dynamic_import(
  () => import("@/components/dashboard/spend-trend-card").then((m) => ({ default: m.SpendTrendCard })),
  { ssr: false, loading: () => null },
);

export interface MobileDashboardViewProps {
  summary: DashboardSummary | undefined;
  state: SectionState;
  onRetry: () => void;
  categorySpending?: Array<{ category: string; amount: number }>;
  monthlySpending: Array<{ month: string; amount: number }>;
  actionInboxItems: ActionInboxItem[];
  thisMonthSpend: number;
  monthOverMonthChange: number;
  activeQuotesCount: number;
  stockAlertCount: number;
}

export function MobileDashboardView({
  summary,
  state,
  onRetry,
  monthlySpending,
  actionInboxItems,
  thisMonthSpend,
  monthOverMonthChange,
  activeQuotesCount,
  stockAlertCount,
}: MobileDashboardViewProps) {
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const budget = summary?.budget;
  const mom = monthOverMonthChange;
  const momDown = mom < 0;
  const hasMom = Number.isFinite(mom) && mom !== 0;

  // §dashboard-mobile-refine P3 (지시문 2a-2) — 미니 스파크라인.
  //   canonical monthlySpending 재사용(신규 fetch 0) + inline SVG(신규 패키지 0).
  //   2점 미만이면 null → 미노출. 추이를 지어내지 않는다(가짜 데이터 0).
  const spark = useMemo(() => {
    const amounts = monthlySpending.map((m) => m.amount).filter((n) => Number.isFinite(n));
    if (amounts.length < 2) return null;
    const max = Math.max(...amounts);
    const min = Math.min(...amounts);
    const span = max - min || 1;
    const stepX = 100 / (amounts.length - 1);
    const pts = amounts.map((v, i) => {
      const x = i * stepX;
      const y = 26 - ((v - min) / span) * 24;
      return { x, y };
    });
    return { points: pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" "), last: pts[pts.length - 1] };
  }, [monthlySpending]);

  return (
    <div className="space-y-3.5">
      {/* ⓪ 우선 추천 (canonical NextStepBanner) */}
      <NextStepBanner summary={summary} />

      {/* ① 지금 할 일 (canonical ActionInbox)
       *  §dashboard-mobile-refine P3 (지시문 2a-1) — 헤더 `전체 보기 ›` 딥링크(모바일 한정 주입).
       *  목적지는 실재 라우트 /dashboard/inbox (신규 라우트 0). 데스크탑은 미주입 = 무접촉. */}
      <ActionInbox items={actionInboxItems} viewAllHref="/dashboard/inbox" />

      {/* ② KPI — 이번달 지출(wide) + 진행 견적 + 재고 경고 */}
      <div className="space-y-2.5">
        <div className="rounded-[13px] border border-slate-200 bg-white shadow-sm p-4">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
            <Wallet className="h-3.5 w-3.5" />이번 달 지출
          </div>
          <div className="text-[26px] font-extrabold tracking-tight text-slate-900 tabular-nums mt-1">{won(thisMonthSpend)}</div>
          {hasMom && (
            <div className={`flex items-center gap-1 text-[12px] font-bold mt-1 ${momDown ? "text-emerald-600" : "text-rose-600"}`}>
              {momDown ? <TrendingDown className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />}
              전월 대비 {Math.abs(mom).toFixed(1)}%
            </div>
          )}
          {spark && (
            <svg viewBox="0 0 100 28" preserveAspectRatio="none" className="mt-2 h-7 w-full" aria-hidden>
              <polyline
                points={spark.points}
                fill="none"
                stroke="#2563eb"
                strokeWidth="1.5"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <circle cx={spark.last.x} cy={spark.last.y} r="2" fill="#2563eb" vectorEffect="non-scaling-stroke" />
            </svg>
          )}
          {/* §dashboard-mobile-refine P3 (지시문 2a-2) — 예산을 지출 카드 하단 인라인 바로 흡수.
           *  별도 예산 힌트 카드 폐지(중복 카드 제거). canonical summary.budget.isSet 정직 표기 유지:
           *  미설정 시 가짜 집행률을 만들지 않고 "지출만 기록 중" 을 명시 + 설정 CTA 로 연결. */}
          <div className="mt-3 border-t border-slate-100 pt-2">
            {budget?.isSet ? (
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-500">예산 집행률</span>
                  <span className={`text-[12px] font-extrabold tabular-nums ${budget.usageRate >= 100 ? "text-red-600" : budget.usageRate >= 80 ? "text-yellow-600" : "text-emerald-600"}`}>
                    {Math.round(budget.usageRate)}%
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <i className={`block h-full rounded-full ${budget.usageRate >= 100 ? "bg-red-500" : budget.usageRate >= 80 ? "bg-yellow-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(100, budget.usageRate)}%` }} />
                </div>
                <div className="mt-1 text-[10.5px] text-slate-500 tabular-nums">잔여 {won(budget.remaining)} · 한도 {won(budget.limit)}</div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-500">예산 미설정 · 지출만 기록 중</span>
                <Link href="/dashboard/budget" className="inline-flex min-h-[44px] items-center gap-0.5 -my-2 px-1 text-[12px] font-bold text-blue-600 active:text-blue-700">
                  예산 설정
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </div>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <Link href="/dashboard/quotes" className="rounded-[13px] border border-slate-200 bg-white shadow-sm p-3.5 active:bg-slate-50">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400"><FileText className="h-3.5 w-3.5" />진행 중 견적</div>
            <div className="text-[22px] font-extrabold text-slate-900 tabular-nums mt-1">{activeQuotesCount}<small className="text-[11px] font-bold text-slate-400 ml-0.5">건</small></div>
            <div className="text-[10.5px] text-slate-400 mt-0.5">발송·회신 대기 포함</div>
          </Link>
          {/* §dashboard-mobile-refine P2 (호영님 2026-07-20) — 재고 경고 카드 톤다운.
           *  배경 채색(bg-rose-50/border-rose-200) 폐지 → 형제 카드(진행 중 견적)와 동일한 흰 카드 + 기본 보더.
           *  레드는 포인트만: 아이콘 칩(22px) / 라벨 / 숫자. 서브텍스트는 중립 그레이로 내려 시선 경쟁 제거.
           *  F4 정합 — CLAUDE.md §9 위험 토큰은 red-*(rose-* 아님). 지시문 #b91c1c/#fef2f2 = red-700/red-50.
           *  0건은 칩까지 회색으로 비활성(§11.311 #4 — 0건 상태 최소화). */}
          <Link href="/dashboard/inventory?filter=low" className="rounded-[13px] border border-slate-200 bg-white shadow-sm p-3.5 active:bg-slate-50">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold">
              <span className={`inline-flex h-[22px] w-[22px] items-center justify-center rounded-[7px] ${stockAlertCount > 0 ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-400"}`}>
                <PackageX className="h-3.5 w-3.5" />
              </span>
              <span className={stockAlertCount > 0 ? "text-red-700" : "text-slate-400"}>재고 경고</span>
            </div>
            <div className={`text-[22px] font-extrabold tabular-nums mt-1 ${stockAlertCount > 0 ? "text-red-700" : "text-slate-900"}`}>{stockAlertCount}<small className="text-[11px] font-bold text-slate-400 ml-0.5">건</small></div>
            {/* §dashboard-mobile-refine P3 (지시문 2a-3) — 역할 분리. 카드는 순수 카운트 + `처리 ›`
             *  어포던스만 든다. 기존 사유 서브텍스트는 실행 큐 재고 행 helper 와 서사가 중복되어 제거.
             *  목적지는 실행 큐 재고 행과 동일(/dashboard/inventory?filter=low) — 신규 라우트 0. */}
            <div className="mt-0.5 flex items-center gap-0.5 text-[10.5px] font-bold text-blue-600">
              처리
              <ChevronRight className="h-3 w-3" aria-hidden />
            </div>
          </Link>
        </div>
      </div>

      {/* ③ (폐지) 예산 배너 — §dashboard-mobile-refine P3 (지시문 2a-2) 로 ② 지출 카드 하단
          인라인 바에 흡수. 별도 카드 1개 제거로 first fold 확보(§11.311 #3). canonical
          summary.budget.isSet 정직 표기와 /dashboard/budget CTA 는 통합 위치에서 그대로 유지. */}

      {/* ④ 운영 파이프라인 (canonical Pipeline) */}
      <section className="space-y-2">
        <h2 className="text-[13px] font-extrabold text-slate-900 px-0.5">운영 파이프라인</h2>
        <Pipeline state={state} summary={summary} onRetry={onRetry} />
      </section>

      {/* ⑤ 지출 분석 — 기본 접힘 아코디언 */}
      <div className="rounded-[13px] border border-slate-200 bg-white shadow-sm overflow-hidden">
        <button type="button" onClick={() => setAnalysisOpen((v) => !v)} aria-expanded={analysisOpen}
          className="w-full flex items-center gap-2 px-3.5 min-h-[48px] text-left active:bg-slate-50">
          <TrendingUp className="h-4 w-4 text-slate-500" />
          <span className="flex-1 text-[13px] font-bold text-slate-900">지출 분석</span>
          {analysisOpen ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
        </button>
        {analysisOpen && (
          <div className="px-2 pb-2 border-t border-slate-100">
            <SpendTrendCard monthlySpending={monthlySpending} />
          </div>
        )}
      </div>
    </div>
  );
}
