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
import { useState } from "react";
import Link from "next/link";
import dynamic_import from "next/dynamic";
import { FileText, PackageX, TrendingDown, TrendingUp, Calendar, ChevronDown, ChevronRight, Wallet } from "lucide-react";
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

  return (
    <div className="space-y-3.5">
      {/* ⓪ 우선 추천 (canonical NextStepBanner) */}
      <NextStepBanner summary={summary} />

      {/* ① 지금 할 일 (canonical ActionInbox) */}
      <ActionInbox items={actionInboxItems} />

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
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <Link href="/dashboard/quotes" className="rounded-[13px] border border-slate-200 bg-white shadow-sm p-3.5 active:bg-slate-50">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400"><FileText className="h-3.5 w-3.5" />진행 중 견적</div>
            <div className="text-[22px] font-extrabold text-slate-900 tabular-nums mt-1">{activeQuotesCount}<small className="text-[11px] font-bold text-slate-400 ml-0.5">건</small></div>
            <div className="text-[10.5px] text-slate-400 mt-0.5">발송·회신 대기 포함</div>
          </Link>
          <Link href="/dashboard/stock-risk" className={`rounded-[13px] border shadow-sm p-3.5 active:opacity-90 ${stockAlertCount > 0 ? "bg-rose-50 border-rose-200" : "bg-white border-slate-200"}`}>
            <div className={`flex items-center gap-1.5 text-[11px] font-semibold ${stockAlertCount > 0 ? "text-rose-500" : "text-slate-400"}`}><PackageX className="h-3.5 w-3.5" />재고 경고</div>
            <div className={`text-[22px] font-extrabold tabular-nums mt-1 ${stockAlertCount > 0 ? "text-rose-700" : "text-slate-900"}`}>{stockAlertCount}<small className="text-[11px] font-bold text-slate-400 ml-0.5">건</small></div>
            <div className={`text-[10.5px] mt-0.5 ${stockAlertCount > 0 ? "text-rose-500" : "text-slate-400"}`}>안전재고 미달</div>
          </Link>
        </div>
      </div>

      {/* ③ 예산 배너 — canonical summary.budget(미설정 정직, 가짜 집행률 0) */}
      {budget?.isSet ? (
        <div className="rounded-[13px] border border-slate-200 bg-white shadow-sm p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-bold text-slate-900">예산 집행률</span>
            <span className={`text-[13px] font-extrabold tabular-nums ${budget.usageRate >= 100 ? "text-rose-600" : budget.usageRate >= 80 ? "text-yellow-600" : "text-emerald-600"}`}>{Math.round(budget.usageRate)}%</span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <i className={`block h-full rounded-full ${budget.usageRate >= 100 ? "bg-rose-500" : budget.usageRate >= 80 ? "bg-yellow-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(100, budget.usageRate)}%` }} />
          </div>
          <div className="mt-1.5 text-[11px] text-slate-500 tabular-nums">잔여 {won(budget.remaining)} · 한도 {won(budget.limit)}</div>
        </div>
      ) : (
        <div className="rounded-[13px] border border-slate-200 bg-white shadow-sm p-3.5 flex items-center gap-3">
          <span className="h-9 w-9 rounded-[10px] grid place-items-center bg-blue-50 text-blue-600 shrink-0"><Calendar className="h-[18px] w-[18px]" /></span>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-bold text-slate-900">예산을 설정하면 집행률·초과 경고 자동 집계</div>
            <div className="text-[11px] text-slate-500 mt-0.5">아직 예산이 없어 지출만 기록 중</div>
          </div>
          <Link href="/dashboard/budget" className="shrink-0 inline-flex items-center gap-1 h-9 px-3 rounded-[10px] bg-blue-600 text-white text-[12.5px] font-bold active:scale-95">＋ 설정</Link>
        </div>
      )}

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
