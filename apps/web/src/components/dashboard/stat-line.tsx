"use client";

/**
 * §main-dashboard-redesign P3 — StatLine (상단 KPI3, summary 단일 진실)
 *
 * 정본: docs/plans/PLAN_main-dashboard-redesign.md (P3 상단 모듈)
 *
 * KPI3: 이번달 지출(spend.thisMonth) · 잔여 예산(budget.remaining) · 확정 발주액
 *   (po.confirmedAmount). 전부 summary API 단일 진실 — 목업/store derive 0(가드②).
 *
 * 4상태(P2 capMs 머신): loading(스켈레톤) / error(재시도) / empty·ready(값 표시).
 *   - §11.311 컴팩트: grid-cols-3, p-3 md:p-4, text-lg md:text-xl, 0건 회색 비활성.
 *   - 빈 계정은 ₩0 회색(가짜 분포 0) — 차트 아님(가드①).
 *
 * presentational — fetch 는 P2 useDashboardSection 이 담당(별도 탑재 시 주입).
 *   page 미배선(고립 빌드, 호영님 2026-06-15) → 탑재는 별도 커밋.
 */

import { TrendingDown, Wallet, ClipboardCheck, RotateCw } from "lucide-react";
import type { SectionState } from "@/lib/dashboard/section-state";
import { won, type DashboardSummary } from "@/lib/dashboard/summary-derive";

interface StatItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  value: number;
  href: string;
}

export interface StatLineProps {
  state: SectionState;
  summary: DashboardSummary | undefined;
  /** 카드별 재시도(error 상태 CTA). */
  onRetry: () => void;
}

export function StatLine({ state, summary, onRetry }: StatLineProps) {
  if (state === "loading") {
    return (
      <div className="grid grid-cols-3 gap-2" aria-busy="true" aria-label="KPI 로딩 중">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-[76px] rounded-xl border border-slate-200 bg-slate-50 p-3 md:p-4 animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-3 md:p-4 flex items-center justify-between gap-3">
        <p className="text-[13px] text-red-700 break-keep">
          지표를 불러오지 못했습니다. 잠시 후 다시 시도하세요.
        </p>
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

  // ready / empty — 값 표시(0건은 §11.311 회색 비활성, 가짜 분포 0).
  const s = summary;
  const items: StatItem[] = [
    {
      key: "spend",
      label: "이번달 지출",
      icon: <TrendingDown className="h-3.5 w-3.5" />,
      value: s?.spend.thisMonth ?? 0,
      href: "/dashboard/reports",
    },
    {
      key: "remaining",
      label: "잔여 예산",
      icon: <Wallet className="h-3.5 w-3.5" />,
      value: s?.budget.remaining ?? 0,
      href: "/dashboard/budget",
    },
    {
      key: "confirmed",
      label: "확정 발주액",
      icon: <ClipboardCheck className="h-3.5 w-3.5" />,
      value: s?.modules.po.confirmedAmount ?? 0,
      href: "/dashboard/purchase-orders",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map((it) => {
        const active = it.value > 0;
        return (
          <a
            key={it.key}
            href={it.href}
            className={`block rounded-xl border p-3 md:p-4 transition-colors ${
              active
                ? "bg-white border-slate-300 shadow-sm hover:border-slate-400"
                : "bg-gray-50 border-gray-200"
            }`}
          >
            <div
              className={`flex items-center gap-1.5 mb-1 ${
                active ? "text-slate-500" : "text-gray-400"
              }`}
            >
              {it.icon}
              <span className="text-[11px] font-semibold uppercase tracking-[0.06em] break-keep">
                {it.label}
              </span>
            </div>
            <p
              className={`text-lg md:text-xl font-black tracking-tighter tabular-nums leading-none ${
                active ? "text-slate-900" : "text-gray-400"
              }`}
            >
              {won(it.value)}
            </p>
          </a>
        );
      })}
    </div>
  );
}
