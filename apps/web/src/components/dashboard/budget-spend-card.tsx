"use client";

/**
 * §dashboard-shifan-adopt P3b — 예산 & 지출 집행률 카드 (시안 중단 좌측)
 *
 * 정본: docs/plans/PLAN_dashboard-shifan-adopt.md (Phase 3 / P3b 정직성 코어)
 *
 * 시안 중단 area차트 슬롯을 대체 — "이번 달 누적 지출" + 예산 집행률(usageRate) 표시.
 * canonical 단일 진실: summary.budget(isSet/limit/spent/usageRate) + summary.spend.thisMonth.
 *
 * ★ 정직성(가드② empty 정직):
 *   - 가짜 집행률 금지 — 예산 미설정(isSet=false) 시 "미설정" 정직 + 집행률 미표시
 *     (회색 바, "예산 설정 시 집행률이 표시됩니다") + [예산 설정] 단일 CTA(→/dashboard/budget).
 *   - 이번 달 누적 = summary.spend.thisMonth 실데이터(예산 무관). mock 0.
 *   - §11.302 신호등: ok=emerald / warn(≥80%)=yellow / danger(≥100%)=red (yellow 톤, 구 경고색 미사용).
 *
 * 4상태(P2 capMs): loading 스켈레톤 / error 재시도 / else(ready·empty) 정직 렌더.
 */

import Link from "next/link";
import { RotateCw, Wallet, ArrowRight } from "lucide-react";
import type { SectionState } from "@/lib/dashboard/section-state";
import { won, type DashboardSummary } from "@/lib/dashboard/summary-derive";

export interface BudgetSpendCardProps {
  state: SectionState;
  summary: DashboardSummary | undefined;
  onRetry: () => void;
}

/** §11.302 신호등 — budTone → 진행바/텍스트 색(yellow 톤). */
const TONE_BAR: Record<string, string> = {
  none: "bg-slate-300",
  ok: "bg-emerald-500",
  warn: "bg-yellow-500",
  danger: "bg-red-600",
};
const TONE_TEXT: Record<string, string> = {
  none: "text-slate-400",
  ok: "text-emerald-700",
  warn: "text-yellow-700",
  danger: "text-red-700",
};

export function BudgetSpendCard({ state, summary, onRetry }: BudgetSpendCardProps) {
  if (state === "loading") {
    return (
      <div
        className="h-[180px] rounded-xl border border-slate-200 bg-slate-50 animate-pulse"
        aria-busy="true"
        aria-label="예산 현황 로딩 중"
      />
    );
  }

  if (state === "error") {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-3 md:p-4 flex items-center justify-between gap-3">
        <p className="text-[13px] text-red-700 break-keep">예산 현황을 불러오지 못했습니다.</p>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 h-10 min-h-[44px] text-[13px] font-semibold text-white hover:bg-red-700 transition-colors flex-shrink-0"
        >
          <RotateCw className="h-3.5 w-3.5" />
          재시도
        </button>
      </div>
    );
  }

  const budget = summary?.budget;
  const isSet = budget?.isSet ?? false;
  const usageRate = budget?.usageRate ?? 0;
  const tone = summary?.derived.budTone ?? "none";
  const thisMonth = summary?.spend.thisMonth ?? 0;
  const barWidth = isSet ? Math.min(100, Math.max(0, usageRate)) : 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4 md:p-5 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100">
            <Wallet className="h-4 w-4 text-slate-600" />
          </span>
          <h3 className="text-[13px] font-extrabold text-slate-900">예산 &amp; 지출</h3>
        </div>
        <p className="text-[11px] text-slate-500">이번 달 누적</p>
      </div>

      {/* 이번 달 누적 지출 — canonical 실데이터(예산 무관). */}
      <p className="text-2xl md:text-[26px] font-black tracking-tighter tabular-nums leading-none text-slate-900">
        {won(thisMonth)}
        {isSet && (
          <span className="text-[13px] font-semibold text-slate-400 ml-1.5">/ {won(budget!.limit)}</span>
        )}
      </p>

      {/* 집행률 — 미설정 시 정직 "미설정"(가짜 0% 금지). */}
      <div className="mt-3 flex items-center justify-between text-[11px]">
        <span className={`font-semibold ${TONE_TEXT[tone]}`}>
          {isSet ? `집행 ${usageRate}%` : "예산 미설정"}
        </span>
        {isSet && (
          <span className="text-slate-500 tabular-nums">잔여 {won(budget!.remaining)}</span>
        )}
      </div>
      <div className="mt-1.5 h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${TONE_BAR[tone]}`}
          style={{ width: `${barWidth}%` }}
        />
      </div>

      {/* 미설정 정직 안내 + 단일 설정 CTA(시안 정합). */}
      {!isSet && (
        <div className="mt-auto pt-3">
          <p className="text-[11px] text-slate-500 mb-2 break-keep">
            예산을 설정하면 집행률·초과 경고를 자동으로 받아볼 수 있어요.
          </p>
          <Link
            href="/dashboard/budget"
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 h-10 min-h-[44px] text-[13px] font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            예산 설정
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
    </div>
  );
}
