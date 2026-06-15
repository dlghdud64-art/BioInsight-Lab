"use client";

/**
 * §dashboard-shifan-adopt P2 — NextStepBanner("다음 단계 추천", summary 단일 진실)
 *
 * 정본: docs/plans/PLAN_dashboard-shifan-adopt.md (P2)
 *
 * 시안 다크 "다음 단계 추천" 배너 — summary(budget/quote) 기반 가이드. 레거시
 *   store-derived SystemInsightCard 대체(store-coupling 회피, 단일 진실 정합).
 *   "시작하기 3단계" hero 의 가이드 역할 흡수.
 *
 * 표시 규율:
 *   - allEmpty(종합 빈)는 GlobalEmpty가 담당 → 본 배너 미렌더(중복 0).
 *   - 예산 미설정: "예산 등록 시 지출 추적 시작" + [예산 설정] (시안 메시지).
 *   - 예산 ≥100%: 초과(danger) / ≥80%: 임계(warn) / 그 외: 정상(emerald).
 *   - dismiss(sessionStorage) — 같은 세션 hide, 새 세션 재노출.
 *
 * presentational — summary는 P3-B1 summarySection 훅 주입(신규 fetch 0). dead button 0(CTA wired).
 */

import { useEffect, useState } from "react";
import { Sparkles, ArrowRight, X } from "lucide-react";
import type { DashboardSummary } from "@/lib/dashboard/summary-derive";

export interface NextStepBannerProps {
  summary: DashboardSummary | undefined;
}

type Accent = "indigo" | "emerald" | "amber" | "rose";

const gradientMap: Record<Accent, string> = {
  indigo: "from-indigo-700 to-purple-800",
  emerald: "from-emerald-700 to-emerald-900",
  amber: "from-yellow-700 to-yellow-900",
  rose: "from-rose-700 to-rose-900",
};

export function NextStepBanner({ summary }: NextStepBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (window.sessionStorage.getItem("nextStepBannerDismissed") === "true") setDismissed(true);
    } catch {
      /* sessionStorage 차단 환경 — 기본 노출 */
    }
  }, []);

  // summary 미도착 또는 종합 빈(GlobalEmpty 담당) 시 미렌더 — 중복 0.
  if (!summary || summary.derived.allEmpty || dismissed) return null;

  const { budget, modules } = summary;
  let accent: Accent = "indigo";
  let title = "운영 흐름이 안정적입니다";
  let detail = "진행 중인 작업과 각 워크큐에서 상태를 확인하세요.";
  let cta: { label: string; href: string } | null = null;

  if (!budget.isSet) {
    accent = "indigo";
    title = "예산을 등록하면 지출 추적이 시작됩니다";
    const q = modules.quote.total;
    detail = `${q > 0 ? `견적 ${q}건이 진행 중입니다. ` : ""}예산을 설정하면 발주·지출 소진율이 자동으로 집계됩니다.`;
    cta = { label: "예산 설정", href: "/dashboard/budget" };
  } else if (budget.usageRate >= 100) {
    accent = "rose";
    title = "예산 한도를 초과했습니다";
    detail = `소진율 ${budget.usageRate.toFixed(0)}% — 추가 발주를 보류하고 예산을 점검하세요.`;
    cta = { label: "예산 관리", href: "/dashboard/budget" };
  } else if (budget.usageRate >= 80) {
    accent = "amber";
    title = "예산 소진이 임계에 가깝습니다";
    detail = `소진율 ${budget.usageRate.toFixed(0)}% — 남은 기간 발주 우선순위를 점검하세요.`;
    cta = { label: "예산 관리", href: "/dashboard/budget" };
  } else {
    accent = "emerald";
    title = "예산 운영이 정상 범위입니다";
    detail = `소진율 ${budget.usageRate.toFixed(0)}% · 잔여 예산 내에서 운영 중입니다.`;
  }

  const handleDismiss = () => {
    setDismissed(true);
    try {
      window.sessionStorage.setItem("nextStepBannerDismissed", "true");
    } catch {
      /* 차단 환경 — state만 */
    }
  };

  return (
    <div className={`relative rounded-xl border border-slate-700/50 bg-gradient-to-br ${gradientMap[accent]} text-white shadow-md p-4 md:p-5`}>
      <div className="flex items-start gap-3 pr-8">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white/10">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/70 mb-1">다음 단계 추천</p>
          <p className="text-sm md:text-base font-bold break-keep">{title}</p>
          <p className="text-[12px] md:text-[13px] text-white/80 mt-1 break-keep leading-relaxed">{detail}</p>
        </div>
        {cta && (
          <a
            href={cta.href}
            className="hidden md:inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-white px-4 text-sm font-bold text-slate-900 hover:bg-white/90 transition-colors flex-shrink-0"
          >
            {cta.label}
            <ArrowRight className="h-4 w-4" />
          </a>
        )}
      </div>
      {/* 모바일 CTA — 풀폭 */}
      {cta && (
        <a
          href={cta.href}
          className="md:hidden mt-3 flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg bg-white px-4 text-sm font-bold text-slate-900"
        >
          {cta.label}
          <ArrowRight className="h-4 w-4" />
        </a>
      )}
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="다음 단계 추천 닫기"
        className="absolute top-3 right-3 inline-flex h-8 w-8 items-center justify-center rounded-md text-white/60 hover:text-white hover:bg-white/10 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
