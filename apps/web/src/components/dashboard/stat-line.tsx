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
import { getFlag } from "@/lib/feature-flags";

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

// §dashboard-shifan-polish A1 — KPI별 아이콘 틴트(시안 직관성·구분 강화). 단계 정체성 색이며
//   §11.302 신호색 아님(amber/orange 금지). 0건 비활성은 §11.311 회색 유지(틴트 미적용).
const KPI_TINT: Record<string, { icon: string; box: string }> = {
  spend: { icon: "text-blue-600", box: "bg-blue-50" },
  remaining: { icon: "text-emerald-600", box: "bg-emerald-50" },
  confirmed: { icon: "text-indigo-600", box: "bg-indigo-50" },
};

// §kpi-status-chip(호영님, 스캔허브 지시문 00·5) — KPI 우측 상태칩 톤.
//   §11.302 신호등 준수: warn=yellow(amber 금지), up=red, ok=emerald, act=blue, idle=gray.
const CHIP_TONE: Record<string, string> = {
  act: "bg-blue-50 text-blue-700",
  ok: "bg-emerald-100 text-emerald-700",
  idle: "bg-gray-100 text-gray-500",
  warn: "bg-yellow-100 text-yellow-700",
  up: "bg-red-50 text-red-700",
};

export function StatLine({ state, summary, onRetry }: StatLineProps) {
  // §purchasing-hide — 발주/구매 off 시 "확정 발주액" KPI 제외(2 KPI). 0건 표기가 "미완 기능"으로
  //   읽히는 문제 차단. items 의 confirmed 객체는 보존(소스 = sentinel GREEN), 렌더만 필터.
  const purchasingOn = getFlag("ENABLE_PURCHASING");
  // §purchasing-hide — purchasing on=3 KPI(md:grid-cols-3, §dashboard-mobile-format 보존),
  //   off=2 KPI(확정 발주액 제외, md:grid-cols-2). 연속 className 리터럴 유지(sentinel GREEN).
  const kpiGridClass = purchasingOn
    ? "grid grid-cols-1 md:grid-cols-3 gap-2"
    : "grid grid-cols-1 md:grid-cols-2 gap-2";

  if (state === "loading") {
    return (
      <div className={kpiGridClass} aria-busy="true" aria-label="KPI 로딩 중">
        {(purchasingOn ? [0, 1, 2] : [0, 1]).map((i) => (
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

  // §kpi-status-chip — KPI 우측 상태칩(canonical summary.budget 단일 진실, 가짜 0).
  //   지출: 예산 미설정→idle / 집행률 act(<80)·warn(80~99)·up(≥100). 잔여: 설정 시 추적중(ok)·미설정 설정필요(idle).
  //   확정발주: >0 추적중(ok)·0 발주 0건(idle).
  const isSet = s?.budget.isSet ?? false;
  const usageRate = s?.budget.usageRate ?? 0;
  const chipFor = (key: string): { label: string; tone: string } => {
    if (key === "spend") {
      if (!isSet) return { label: "예산 미설정", tone: "idle" };
      const tone = usageRate >= 100 ? "up" : usageRate >= 80 ? "warn" : "act";
      return { label: `예산의 ${usageRate}%`, tone };
    }
    if (key === "remaining") {
      return isSet ? { label: "추적 중", tone: "ok" } : { label: "설정 필요", tone: "idle" };
    }
    return (s?.modules.po.confirmedAmount ?? 0) > 0
      ? { label: "추적 중", tone: "ok" }
      : { label: "발주 0건", tone: "idle" };
  };

  return (
    // §dashboard-mobile-kpi — ₩ 금액이 모바일 grid-cols-3 폭을 넘쳐 잘림(정확값 위반).
    //   모바일=가로 스크롤(카드가 금액 길이만큼 확장 → 잘림 0, §11.311 compact 1줄·first-fold 보존),
    //   md+=기존 grid-cols-3.
    <div className={kpiGridClass}>
      {items.filter((it) => purchasingOn || it.key !== "confirmed").map((it) => {
        const active = it.value > 0;
        const chip = chipFor(it.key);
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
              className={`flex items-center justify-between gap-1.5 mb-1 ${
                active ? "text-slate-500" : "text-gray-400"
              }`}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                {/* §dashboard-shifan-polish A1 — KPI 아이콘 틴트 박스(active만). 0건은 회색 비활성(§11.311). */}
                <span
                  className={`flex items-center justify-center w-6 h-6 rounded-lg flex-shrink-0 ${
                    active ? KPI_TINT[it.key]!.box : "bg-gray-100"
                  }`}
                >
                  <span className={active ? KPI_TINT[it.key]!.icon : "text-gray-400"}>{it.icon}</span>
                </span>
                {/* §dashboard-mobile-kpi — 라벨 풀표기(truncate 제거). 가로 스크롤로 폭 확보. */}
                <span className="text-[11px] font-semibold uppercase tracking-[0.06em] break-keep whitespace-nowrap">
                  {it.label}
                </span>
              </div>
              {/* §kpi-status-chip(호영님, 스캔허브 지시문 00·5) — 우측 상태칩. canonical summary.budget 단일 진실. */}
              <span className={`flex-shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold tabular-nums ${CHIP_TONE[chip.tone]}`}>
                {chip.label}
              </span>
            </div>
            <p
              className={`text-lg md:text-xl font-black tracking-tighter tabular-nums leading-none whitespace-nowrap ${
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
