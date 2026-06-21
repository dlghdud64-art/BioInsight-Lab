"use client";

/**
 * §quote-management P2 + §quote-flat Q1 — 파이프라인 퍼널(5단계 선형, 시안 A 플랫 정합)
 *
 * 지시문 §01·§06 + 시안 A(.q-embed .funnel/.fstage). stage(QuoteStatus 파생) 별 케이스 수 KPI.
 *   - 좌→우 선형(s1~s5). 카드형 스테이지(내부 패딩 6px 컨테이너 안 rounded zone), 단계 사이 chevron.
 *   - 값 0 단계 opacity-50 (흐리게), hover 시 .75.
 *   - 현재 집중 = 케이스 존재하는 가장 앞 단계(낮은 인덱스) → accent-weak bg + inset ring + "현재 집중" 배지.
 *   - 단계 클릭 = 테이블 필터(케이스 있을 때만; 0건은 disabled, dead button 0).
 *   - 하단 progress mini-bar = 해당 단계 케이스/전체 비율(실데이터, 가짜 0). 0건은 숨김.
 *   - 색: §11.302 정합(회신추적=yellow text-yellow-600, amber/orange 미사용). accent=#2f6be0(시안).
 *   - 모바일: wrap(단계 3열) + chevron 숨김. 데스크탑: 단일 행 + chevron.
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
  // 단계별 아이콘 톤 (시안 §12: 발송=accent·회신=warn(yellow)·비교=purple·승인=ok·발주=mut)
  tint: { text: string; bg: string };
}[] = [
  { key: "s1", label: "발송 대기", sub: "RFQ 작성 완료", icon: Send, tint: { text: "text-blue-600", bg: "bg-blue-50" } },
  { key: "s2", label: "회신 추적", sub: "공급사 응답 대기", icon: Clock, tint: { text: "text-yellow-600", bg: "bg-yellow-50" } },
  { key: "s3", label: "비교 검토", sub: "견적 도착·검토", icon: GitCompare, tint: { text: "text-violet-600", bg: "bg-violet-50" } },
  { key: "s4", label: "승인/예외", sub: "선정·승인 대기", icon: CheckCircle2, tint: { text: "text-emerald-600", bg: "bg-emerald-50" } },
  { key: "s5", label: "발주 전환", sub: "발주서 준비", icon: Package, tint: { text: "text-slate-500", bg: "bg-slate-100" } },
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
  const total = quotes.length || 1;
  // 현재 집중 = 케이스 존재하는 가장 앞 단계.
  const focus = STAGES.find((s) => counts[s.key] > 0)?.key ?? null;

  return (
    <div className="flex flex-wrap md:flex-nowrap items-stretch rounded-2xl border border-bd bg-white p-1.5 shadow-sm">
      {STAGES.map((s, i) => {
        const n = counts[s.key];
        const dim = n === 0;
        const isFocus = s.key === focus;
        const isActive = activeStage === s.key;
        // 강조(시안 .fstage.active) = 클릭 필터 단계 또는 (필터 없을 때) 현재집중 단계.
        const highlight = isActive || (isFocus && activeStage == null);
        const Icon = s.icon;
        const pct = Math.min((n / total) * 100, 100);
        return (
          <Fragment key={s.key}>
            <button
              type="button"
              onClick={() => n > 0 && onStageClick?.(s.key)}
              disabled={n === 0}
              aria-pressed={isActive}
              className={`relative basis-[30%] grow md:basis-0 md:flex-1 min-w-0 text-left rounded-xl px-4 pt-4 pb-5 transition-colors ${
                dim ? "opacity-50 cursor-default hover:opacity-75" : "hover:bg-slate-50"
              } ${highlight ? "bg-[#eaf1fd] ring-[1.5px] ring-inset ring-[#cdddf9]" : ""}`}
            >
              {isFocus && (
                <span className="absolute top-2.5 right-3 text-[9.5px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[#2f6be0] text-white whitespace-nowrap">
                  현재 집중
                </span>
              )}
              <div className="flex items-center gap-2.5 mb-2">
                <span
                  className={`flex items-center justify-center w-9 h-9 rounded-[9px] flex-none ${
                    highlight ? "bg-[#2f6be0] text-white" : `${s.tint.bg} ${s.tint.text}`
                  }`}
                >
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span
                  className={`text-3xl font-extrabold tabular-nums leading-none tracking-tight ${
                    dim ? "text-[#c2c8d4]" : highlight ? "text-[#244e9e]" : "text-slate-900"
                  }`}
                >
                  {n}
                </span>
              </div>
              <div
                className={`text-[12.5px] font-bold leading-tight break-keep ${
                  highlight ? "text-[#244e9e]" : "text-slate-600"
                }`}
              >
                {s.label}
              </div>
              <div className="text-[11px] text-slate-400 leading-tight break-keep mt-0.5">{s.sub}</div>
              {/* 하단 progress mini-bar — 단계 케이스/전체 비율(실데이터). 0건 숨김. */}
              {!dim && (
                <span className="absolute left-4 right-4 bottom-2 h-[3px] rounded-full bg-slate-100 overflow-hidden">
                  <span className="block h-full rounded-full bg-[#2f6be0]" style={{ width: `${pct}%` }} />
                </span>
              )}
            </button>
            {i < STAGES.length - 1 && (
              <div className="hidden md:flex items-center justify-center w-6 flex-none text-[#c2c8d4]">
                <ChevronRight className="h-4 w-4" />
              </div>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
