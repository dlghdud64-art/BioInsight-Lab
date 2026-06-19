"use client";

/**
 * §quote-management P2 — 파이프라인 퍼널(5단계 선형)
 *
 * 지시문 §01·§06. stage(QuoteStatus 파생) 별 케이스 수 KPI + 현재 집중 + 0=흐리게.
 *   - 좌→우 선형(s1~s5), 단계 사이 화살표. 값 0 단계 opacity .5.
 *   - 현재 집중 = 케이스 존재하는 가장 앞 단계(낮은 인덱스) → 배지.
 *   - 단계 클릭 = 테이블 필터(케이스 있을 때만; 0건은 disabled, dead button 0).
 *   - 색: §11.302 정합(회신추적=yellow, amber/orange 미사용).
 *   - ★ 가짜 데이터 0: quotes(실데이터)에서만 집계. 빈 계정은 전부 0(흐리게).
 */

import { Fragment } from "react";
import { deriveStage, type Stage } from "@/lib/quote-management/derive";
import { Send, Clock, GitCompare, CheckCircle2, Package, ChevronRight } from "lucide-react";

const STAGES: {
  key: Stage;
  label: string;
  sub: string;
  icon: typeof Send;
  tint: { text: string; bg: string; ring: string };
}[] = [
  { key: "s1", label: "발송 대기", sub: "RFQ 작성 완료", icon: Send, tint: { text: "text-blue-600", bg: "bg-blue-50", ring: "ring-blue-400" } },
  { key: "s2", label: "회신 추적", sub: "공급사 응답 대기", icon: Clock, tint: { text: "text-yellow-600", bg: "bg-yellow-50", ring: "ring-yellow-400" } },
  { key: "s3", label: "비교 검토", sub: "견적 도착·검토", icon: GitCompare, tint: { text: "text-violet-600", bg: "bg-violet-50", ring: "ring-violet-400" } },
  { key: "s4", label: "승인/예외", sub: "선정·승인 대기", icon: CheckCircle2, tint: { text: "text-emerald-600", bg: "bg-emerald-50", ring: "ring-emerald-400" } },
  { key: "s5", label: "발주 전환", sub: "발주서 준비", icon: Package, tint: { text: "text-slate-500", bg: "bg-slate-50", ring: "ring-slate-400" } },
];

export function QuoteFunnel({
  quotes,
  activeStage,
  onStageClick,
}: {
  quotes: { status: string }[];
  activeStage?: Stage | null;
  onStageClick?: (s: Stage) => void;
}) {
  const counts: Record<Stage, number> = { s1: 0, s2: 0, s3: 0, s4: 0, s5: 0 };
  for (const q of quotes) {
    const s = deriveStage(q.status);
    if (s) counts[s] += 1;
  }
  // 현재 집중 = 케이스 존재하는 가장 앞 단계.
  const focus = STAGES.find((s) => counts[s.key] > 0)?.key ?? null;

  return (
    <div className="flex items-stretch rounded-xl border border-bd bg-white overflow-hidden">
      {STAGES.map((s, i) => {
        const n = counts[s.key];
        const dim = n === 0;
        const isFocus = s.key === focus;
        const isActive = activeStage === s.key;
        const Icon = s.icon;
        return (
          <Fragment key={s.key}>
            <button
              type="button"
              onClick={() => n > 0 && onStageClick?.(s.key)}
              disabled={n === 0}
              aria-pressed={isActive}
              className={`relative flex-1 text-left px-3 py-3 transition-colors ${
                dim ? "opacity-50 cursor-default" : "hover:bg-slate-50"
              } ${isActive ? `ring-2 ring-inset ${s.tint.ring}` : ""}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={`flex items-center justify-center w-7 h-7 rounded-lg ${s.tint.bg}`}>
                  <Icon className={`h-3.5 w-3.5 ${s.tint.text}`} />
                </span>
                <span className="text-lg font-black tabular-nums leading-none text-slate-900">{n}</span>
                {isFocus && (
                  <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-600 text-white whitespace-nowrap">
                    현재 집중
                  </span>
                )}
              </div>
              <div className="text-[12px] font-semibold text-slate-700 leading-tight break-keep">{s.label}</div>
              <div className="text-[10px] text-slate-400 leading-tight break-keep">{s.sub}</div>
            </button>
            {i < STAGES.length - 1 && (
              <div className="flex items-center px-0.5 text-slate-300 flex-shrink-0">
                <ChevronRight className="h-4 w-4" />
              </div>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
