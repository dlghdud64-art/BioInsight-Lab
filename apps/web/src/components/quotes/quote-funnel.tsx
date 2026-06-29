"use client";

/**
 * §quote-management P2 + §quote-flat Q1 — 파이프라인 퍼널(5단계 선형, 시안 A 플랫 정합)
 *   §quote-funnel-sian-restore (호영님 2026-06-29) — 데스크탑 리치(아이콘+현재집중 배지+서브+chevron),
 *     모바일 압축(1줄 세그먼트 칩) 반응형. logic(counts/focus/allZero/visibleStages/onStageClick) 전부 보존.
 *
 *   - 좌→우 선형(s1~s5). 데스크탑: 카드형 스테이지 + 단계 사이 chevron. 모바일: 1줄 칩.
 *   - 현재 집중 = 케이스 존재하는 가장 앞 단계 → accent-weak bg + inset ring + "현재 집중" 배지.
 *   - 값 0 단계 흐리게(dim). 단계 클릭 = 테이블 필터(케이스 있을 때만; 0건 disabled, dead button 0).
 *   - 색: §11.302 정합(회신추적=yellow, amber/orange 미사용). accent=#244e9e/#eaf1fd(시안).
 *   - 발주 전환(s5)은 ENABLE_PURCHASING off 시 제외(발주 hide 결정 일관).
 *   - ★ 가짜 데이터 0: quotes(실데이터)에서만 집계.
 */

import { Fragment } from "react";
import { deriveStage, type Stage } from "@/lib/quote-management/derive";
import { Send, Clock, GitCompare, CheckCircle2, Package, Inbox, ChevronRight } from "lucide-react";
import { getFlag } from "@/lib/feature-flags";

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
  // §quotes-mobile-redesign — 발주 전환(s5)은 발주 hide 결정과 일관: ENABLE_PURCHASING off 시 제외.
  const purchasingOn = getFlag("ENABLE_PURCHASING");
  const visibleStages = STAGES.filter((s) => purchasingOn || s.key !== "s5");
  // 현재 집중 = 케이스 존재하는 가장 앞(보이는) 단계.
  const focus = visibleStages.find((s) => counts[s.key] > 0)?.key ?? null;
  const allZero = visibleStages.every((s) => counts[s.key] === 0);

  // §quotes-mobile-redesign — 전 단계 0건이면 0 카드 나열 금지, 단일 라인 collapse.
  if (allZero) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-bd bg-white px-4 py-3 shadow-sm">
        <Inbox className="h-4 w-4 text-slate-400 flex-none" />
        <span className="text-[13px] text-slate-500">진행 중 견적 없음</span>
      </div>
    );
  }

  return (
    <>
      {/* 데스크탑(md+) — 시안 리치: 아이콘 box + 카운트 + 현재 집중 배지 + 서브 + chevron. */}
      <div className="hidden md:flex items-stretch gap-1 rounded-2xl border border-bd bg-white p-2 shadow-sm">
        {visibleStages.map((s, i) => {
          const n = counts[s.key];
          const dim = n === 0;
          const isActive = activeStage === s.key;
          const highlight = isActive || (s.key === focus && activeStage == null);
          const Icon = s.icon;
          return (
            <Fragment key={s.key}>
              <button
                type="button"
                onClick={() => n > 0 && onStageClick?.(s.key)}
                disabled={n === 0}
                aria-pressed={isActive}
                aria-label={`${s.label} ${n}건`}
                className={`flex-1 min-w-0 flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                  highlight
                    ? "bg-[#eaf1fd] ring-[1.5px] ring-inset ring-[#cdddf9]"
                    : dim
                      ? "opacity-60 cursor-default"
                      : "hover:bg-slate-50"
                }`}
              >
                <span className={`inline-flex h-9 w-9 flex-none items-center justify-center rounded-lg ${s.tint.bg}`}>
                  <Icon className={`h-4 w-4 ${s.tint.text}`} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span
                      className={`text-xl font-extrabold tabular-nums leading-none ${
                        dim ? "text-[#c2c8d4]" : highlight ? "text-[#244e9e]" : "text-slate-900"
                      }`}
                    >
                      {n}
                    </span>
                    {highlight && (
                      <span className="inline-flex flex-none items-center rounded-full bg-[#dbe7fb] px-1.5 py-0.5 text-[10px] font-semibold text-[#244e9e]">
                        현재 집중
                      </span>
                    )}
                  </span>
                  <span
                    className={`mt-0.5 block text-[13px] font-bold truncate ${
                      highlight ? "text-[#244e9e]" : "text-slate-700"
                    }`}
                  >
                    {s.label}
                  </span>
                  <span className="block text-[11px] text-slate-400 truncate">{s.sub}</span>
                </span>
              </button>
              {i < visibleStages.length - 1 && (
                <ChevronRight className="h-4 w-4 flex-none self-center text-slate-300" aria-hidden="true" />
              )}
            </Fragment>
          );
        })}
      </div>

      {/* 모바일(<md) — 1줄 세그먼트 칩(밀도 압축, §quotes-mobile-density P2 보존). */}
      <div className="flex md:hidden items-stretch gap-2 rounded-xl border border-bd bg-white p-1 shadow-sm overflow-x-auto">
        {visibleStages.map((s) => {
          const n = counts[s.key];
          const dim = n === 0;
          const isActive = activeStage === s.key;
          const highlight = isActive || (s.key === focus && activeStage == null);
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => n > 0 && onStageClick?.(s.key)}
              disabled={n === 0}
              aria-pressed={isActive}
              aria-label={`${s.label} ${n}건`}
              className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 transition-colors ${
                dim ? "opacity-50 cursor-default" : "hover:bg-slate-50"
              } ${highlight ? "bg-[#eaf1fd] ring-[1.5px] ring-inset ring-[#cdddf9]" : ""}`}
            >
              <span
                className={`text-[11px] font-semibold break-keep truncate ${
                  highlight ? "text-[#244e9e]" : "text-slate-500"
                }`}
              >
                {s.label}
              </span>
              <span
                className={`text-sm font-extrabold tabular-nums leading-none ${
                  dim ? "text-[#c2c8d4]" : highlight ? "text-[#244e9e]" : "text-slate-900"
                }`}
              >
                {n}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}
