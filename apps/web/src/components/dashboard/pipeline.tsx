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

import { FileText, PackageCheck, Boxes, RotateCw, ChevronRight } from "lucide-react";
import type { SectionState } from "@/lib/dashboard/section-state";
import type { DashboardSummary } from "@/lib/dashboard/summary-derive";
// §main-dashboard-p0-honesty T4 — 게이지(.pbar) 폐지 → 상태 칩(핸드오프 §4).
//   게이지 분모(단계 최대 건수)는 도메인 의미가 없었다(견적 8건=100% · 재고 4건=50%).
//   ★ 그 식별자를 주석에도 남기지 않는다 — B4 단언이 파일 전체를 보므로 언급 자체가 위반이다.
import { buildPipelineChips, type PipelineChip, type PipelineStageKey } from "@/lib/dashboard/p0-display";

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
    /* 🛑 삭제 §purchasing-flag-retired (2026-09-25 · 호영님 판정) — po 단계.
     *   발주 UI 가 없고(§po-ui-removed) 견적을 PURCHASED 로 옮기는 UI 경로도 0이다
     *   (§admin-order-create-removed). summary 는 수를 계속 내지만 **사용자가 만들 수 없는 값**이다.
     *   구 판본은 플래그로 렌더만 걸렀는데, 플래그가 켜질 일이 없으므로 소스 보존이 잔재가 됐다.
     *   되살리는 조건: docs/plans/QUEUE_concierge-purchasing.md */
    {
      key: "receive",
      label: "입고",
      icon: <PackageCheck className="h-4 w-4" />,
      total: r?.total ?? 0,
      // §receive-canonical — APPROVED 는 입고 확정이라 할 일이 아니다(호영님 판정 2026-09-20).
      attention: (r?.awaitingReply ?? 0) + (r?.pendingReview ?? 0),
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

// §dashboard-shifan-polish A2 — 단계별 아이콘 틴트(시안 직관성). §11.302 신호등과 분리:
//   틴트는 단계 정체성(견적 blue/발주 indigo/입고 teal/재고 yellow) — amber/orange 금지.
//   0건 비활성 단계는 §11.311 회색 비활성 유지(틴트 미적용). 상태 신호(주의 sub-count)는
//   yellow-700 라인이 별도 소유 — 아이콘 틴트가 신호색을 침범하지 않음.
const STAGE_TINT: Record<string, { icon: string; box: string }> = {
  quote: { icon: "text-blue-600", box: "bg-blue-50" },
  po: { icon: "text-indigo-600", box: "bg-indigo-50" },
  receive: { icon: "text-teal-600", box: "bg-teal-50" },
  stock: { icon: "text-yellow-600", box: "bg-yellow-50" },
};

// §main-dashboard-p0-honesty T4 — 칩 톤 → 클래스. §11.302 신호등(amber/orange 금지).
const CHIP_TONE: Record<string, string> = {
  red: "bg-red-100 text-red-700",
  yellow: "bg-yellow-100 text-yellow-700",
  gray: "bg-slate-100 text-slate-600",
  emerald: "bg-emerald-100 text-emerald-700",
};

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

  // §purchasing-flag-retired (2026-09-25 · 호영님 판정) — 거를 대상이 0 이라 필터를 남기지 않는다(아무것도 안 거르는 필터는 오해만 만든다).
  const stages = buildStages(summary);
  // §main-dashboard-p0-honesty Smoke C (2026-09-20) — 핸드오프 §6 미구현분 보완.
  //   "모바일(<768px): 파이프라인 3카드 → 1열" 인데 grid-cols-3 이 모바일에도 걸려 있었다.
  //   375px 에서 카드 폭 ~110px 인데 T4 가 붙인 상태 칩(`안전재고 미달 1`)이 그 폭을 넘는다.
  //   Smoke C 를 못 돌려 화면으로는 안 드러났고, 핸드오프 원문 대조에서 잡혔다.
  //   4단계(purchasing on)는 핸드오프 범위 밖이라 기존 2열 분기 보존.
  const gridColsClass = stages.length === 3 ? "grid-cols-1 md:grid-cols-3" : "grid-cols-2 md:grid-cols-4";
  // §main-dashboard-p0-honesty T4 — 상태 칩(canonical summary 파생, 0건 칩 미생성 = dead button 0).
  const chipsByStage = buildPipelineChips(summary);

  return (
    <div className={`grid gap-2 ${gridColsClass}`}>
      {stages.map((stage, i) => {
        const active = stage.total > 0;
        // §purchasing-flag-retired (2026-09-25 · 호영님 판정) — po 단계가 없어졌으므로 그 예외 분기도 없다.
        const chips: PipelineChip[] = chipsByStage[stage.key as PipelineStageKey] ?? [];
        return (
          // §main-dashboard-p0-honesty T4 — 카드 래퍼가 <a> 에서 <div> 로 바뀐다.
          //   칩이 각자 딥링크를 가지므로 카드 전체 링크 안에 링크를 넣으면 중첩 interactive 가 된다.
          //   카드 진입 동선은 헤더의 `열기 ›` 가 단독 소유(핸드오프 §4).
          <div
            key={stage.key}
            className={`relative block rounded-xl border p-3 ${
              active ? "bg-white border-slate-300 shadow-sm" : "bg-white border-dashed border-slate-200"
            }`}
          >
            <div className={`flex items-center gap-1.5 mb-1 ${active ? "text-slate-500" : "text-gray-400"}`}>
              {/* §dashboard-shifan-polish A2 — 단계 아이콘 틴트 박스(active만). 0건은 회색 비활성(§11.311). */}
              <span className={`flex items-center justify-center w-6 h-6 rounded-lg flex-shrink-0 ${active ? STAGE_TINT[stage.key]!.box : "bg-slate-50"}`}>
                <span className={active ? STAGE_TINT[stage.key]!.icon : "text-gray-400"}>{stage.icon}</span>
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.06em] truncate min-w-0">{stage.label}</span>
              <a
                href={stage.href}
                className="ml-auto inline-flex items-center gap-0.5 text-[11px] font-bold text-slate-400 hover:text-slate-600 transition-colors"
              >
                열기
                <ChevronRight className="h-3 w-3" aria-hidden />
              </a>
            </div>
            {/* §dashboard-home-redesign P3 — 0건 value 가독성 slate-500(시안 README).
                0건 표현(2026-09-21 사실대로 정정): 카드 = bg-white border-dashed border-slate-200 ·
                아이콘 박스 = bg-slate-50. 이전 주석은 "de-emphasis는 bg-gray-50 유지" 였으나 코드가 그렇지 않았다. */}
            <p className={`text-lg md:text-xl font-black tracking-tighter tabular-nums leading-none ${active ? "text-slate-900" : "text-slate-500"}`}>
              {stage.total}
              <span className="text-[11px] font-semibold ml-0.5">{stage.key === "stock" ? "품목" : "건"}</span>
            </p>
            {/* 상태 칩 — 각 칩이 모듈 필터 딥링크를 소유. 0건 칩은 애초에 생성되지 않는다. */}
            {chips.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {chips.map((chip) => (
                  <a
                    key={chip.key}
                    href={chip.href}
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold transition-opacity hover:opacity-80 ${CHIP_TONE[chip.tone]}`}
                  >
                    {chip.label}
                    {chip.count !== null && <span className="tabular-nums">{chip.count}</span>}
                  </a>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-[11px] text-slate-500 line-clamp-1">{active ? "이상 없음" : "데이터 없음"}</p>
            )}
            {/* 단계 연결 화살표(마지막 제외) — 데스크탑만 */}
            {i < stages.length - 1 && (
              <ChevronRight className="hidden md:block absolute -right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-300" aria-hidden />
            )}
          </div>
        );
      })}
    </div>
  );
}
