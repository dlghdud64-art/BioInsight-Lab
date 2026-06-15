"use client";

/**
 * §main-dashboard-redesign P4 — Pipeline (견적→발주→입고→재고, summary 단일 진실)
 *
 * 정본: docs/plans/PLAN_main-dashboard-redesign.md (P4 중단 모듈, 가드③)
 *
 * 4단계 운영 파이프라인 표시(표시 전용). 각 단계 = summary.modules 자기 집계 +
 *   주의 sub-count + 클릭 라우팅. SmartReceivingStatusCard 의 입고 awareness 흡수
 *   (입고 단계가 receive 모듈 = 입고 대기/예외 포함).
 *
 * 가드③(Pipeline canonical): **전이맵 로컬 재정의 0.** 단계 전이(quote PENDING→SENT
 *   등)의 canonical 권위는 lib/operations/state-machine.ts(ALLOWED_*_TRANSITIONS).
 *   본 컴포넌트는 단계별 집계 카운트만 표시 — 전이 로직 미정의(O1 drift 재발 차단).
 *
 * 4상태(P2 capMs): loading 스켈레톤 / error 재시도 / empty(0·0·0·0 회색) / ready.
 *   §11.311 컴팩트, 빈 데이터 차트 0(가드①②, 카운트/0만).
 *
 * presentational — fetch=P2 useDashboardSection 주입(별도 탑재). page 미배선(고립 빌드).
 */

import { FileText, ClipboardList, PackageCheck, Boxes, RotateCw, ChevronRight } from "lucide-react";
import type { SectionState } from "@/lib/dashboard/section-state";
import type { DashboardSummary } from "@/lib/dashboard/summary-derive";

interface PipelineStage {
  key: string;
  label: string;
  icon: React.ReactNode;
  /** 단계 총 건수(summary 모듈 단일 진실). */
  total: number;
  /** 주의 sub-count(열린/미완료/재주문 등). 0이면 미표시. */
  attention: number;
  attentionLabel: string;
  href: string;
}

export interface PipelineProps {
  state: SectionState;
  summary: DashboardSummary | undefined;
  onRetry: () => void;
}

function buildStages(s: DashboardSummary | undefined): PipelineStage[] {
  const q = s?.modules.quote;
  const po = s?.modules.po;
  const r = s?.modules.receive;
  const st = s?.modules.stock;
  return [
    {
      key: "quote",
      label: "견적",
      icon: <FileText className="h-4 w-4" />,
      total: q?.total ?? 0,
      attention: (q?.pending ?? 0) + (q?.responded ?? 0),
      attentionLabel: "열린 견적",
      href: "/dashboard/quotes",
    },
    {
      key: "po",
      label: "발주",
      icon: <ClipboardList className="h-4 w-4" />,
      total: po?.total ?? 0,
      attention: po?.ordered ?? 0,
      attentionLabel: "미확정",
      href: "/dashboard/purchase-orders",
    },
    {
      key: "receive",
      label: "입고",
      icon: <PackageCheck className="h-4 w-4" />,
      total: r?.total ?? 0,
      attention: (r?.pending ?? 0) + (r?.partial ?? 0) + (r?.issue ?? 0),
      attentionLabel: "미완료",
      href: "/dashboard/receiving",
    },
    {
      key: "stock",
      label: "재고",
      icon: <Boxes className="h-4 w-4" />,
      total: st?.total ?? 0,
      attention: st?.reorderNeeded ?? 0,
      attentionLabel: "재주문",
      href: "/dashboard/inventory",
    },
  ];
}

export function Pipeline({ state, summary, onRetry }: PipelineProps) {
  if (state === "loading") {
    return (
      <div className="grid grid-cols-4 gap-2" aria-busy="true" aria-label="파이프라인 로딩 중">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[88px] rounded-xl border border-slate-200 bg-slate-50 p-3 animate-pulse" />
        ))}
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-3 md:p-4 flex items-center justify-between gap-3">
        <p className="text-[13px] text-red-700 break-keep">파이프라인을 불러오지 못했습니다.</p>
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

  const stages = buildStages(summary);

  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
      {stages.map((stage, i) => {
        const active = stage.total > 0;
        return (
          <a
            key={stage.key}
            href={stage.href}
            className={`relative block rounded-xl border p-3 transition-colors ${
              active
                ? "bg-white border-slate-300 shadow-sm hover:border-slate-400"
                : "bg-gray-50 border-gray-200"
            }`}
          >
            <div className={`flex items-center gap-1.5 mb-1 ${active ? "text-slate-500" : "text-gray-400"}`}>
              {stage.icon}
              <span className="text-[11px] font-semibold uppercase tracking-[0.06em]">{stage.label}</span>
              {/* 단계 연결 화살표(마지막 제외) — 데스크탑만 */}
              {i < stages.length - 1 && (
                <ChevronRight className="hidden md:block h-3 w-3 text-slate-300 ml-auto" aria-hidden />
              )}
            </div>
            <p className={`text-lg md:text-xl font-black tracking-tighter tabular-nums leading-none ${active ? "text-slate-900" : "text-gray-400"}`}>
              {stage.total}
              <span className="text-[11px] font-semibold ml-0.5">건</span>
            </p>
            {stage.attention > 0 ? (
              <p className="mt-1 text-[11px] font-semibold text-yellow-700">
                {stage.attentionLabel} {stage.attention}건
              </p>
            ) : (
              <p className="mt-1 text-[11px] text-gray-400">{active ? "이상 없음" : "데이터 없음"}</p>
            )}
          </a>
        );
      })}
    </div>
  );
}
