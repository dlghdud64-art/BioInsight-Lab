"use client";

/**
 * §quote-management P4-core-B + §quote-flat Q2 — 우선 추천 카드(navy, 시안 A ② 정합)
 *
 * 지시문 §07 + 시안 ②(.ai-action). computePriority(룰베이스) score 1위 케이스 상시 노출.
 *   - ★ "AI" 라벨/Sparkles 금지(룰베이스). orb(spark) 제거(제품상세 P6 선례).
 *   - ★ 정직(CEO 2026-06-21): 최우선 1건 상시 노출 + 真 level(높음/보통/낮음) 표시(가짜 격상 0).
 *     케이스 0건이면 노출 0(!best). 사유는 高·中만(低는 derive reason=null → 생략).
 *   - CTA = 케이스 열기(real → rail). dead button 0. 다음 단계는 본문 텍스트로 안내(가짜 액션 금지).
 *   - navy: #0f1b34→#16284c. §11.302 색: high=red·mid=yellow·low=중립(amber/orange 금지).
 */

import { useState } from "react";
import { computePriority, dDayLabel, type Stage } from "@/lib/quote-management/derive";
import { toQuoteCase, type QuoteLike } from "@/lib/quote-management/from-quote";
import { ListChecks, ArrowRight } from "lucide-react";

const STAGE_LABEL: Record<Stage, string> = {
  s1: "발송 대기",
  s2: "회신 추적",
  s3: "비교 검토",
  s4: "승인/예외",
  s5: "발주 전환",
};
// 단계별 다음 단계(시안 §07 next). 본문 안내용 — CTA는 케이스 열기(real).
const NEXT_STEP: Record<Stage, string> = {
  s1: "견적 요청 발송",
  s2: "회신 독려",
  s3: "견적 비교",
  s4: "승인 요청",
  s5: "발주 전환",
};
// 真 우선순위 라벨(가짜 격상 0).
const LEVEL_LABEL: Record<"high" | "mid" | "low", string> = {
  high: "높음",
  mid: "보통",
  low: "낮음",
};
const LEVEL_TEXT: Record<"high" | "mid" | "low", string> = {
  high: "text-red-300 font-bold",
  mid: "text-yellow-300 font-bold",
  low: "text-white/70",
};

export function PriorityRecommendationCard({
  quotes,
  onOpen,
}: {
  quotes: QuoteLike[];
  onOpen: (id: string) => void;
}) {
  // §quote-screen-sian P6.3 §07 — "나중에" 일시 보류(추천 제외). 세션 메모리(새로고침 복귀 = 일시 보류 의미).
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  let best: {
    id: string;
    name: string;
    stage: Stage;
    vendors: number;
    reason: string | null;
    dd: number | null;
    level: "high" | "mid" | "low";
  } | null = null;
  let bestScore = -1;
  for (const q of quotes) {
    const c = toQuoteCase(q);
    if (!c) continue; // 퍼널 외(CANCELLED 등)
    if (dismissed.has(c.id)) continue; // §07 일시 보류된 케이스 제외
    const r = computePriority(c);
    // ★ 상시 노출 — level별 skip 없음(최우선 1건). 真 level 표시(가짜 격상 0).
    if (r.score > bestScore) {
      bestScore = r.score;
      best = {
        id: c.id,
        name: c.name,
        stage: c.stage,
        vendors: c.suppliers.length,
        reason: r.reason,
        dd: r.dd,
        level: r.level,
      };
    }
  }
  if (!best) return null; // 케이스 0 → 노출 0(빈 상태는 §01 별도)

  const nextStep = NEXT_STEP[best.stage];

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0f1b34] to-[#16284c] text-white px-5 py-4 shadow-sm flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
      {/* 장식 도트(데이터 무관, aria-hidden) */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage: "radial-gradient(rgba(127,163,243,.18) 1px, transparent 1.5px)",
          backgroundSize: "22px 22px",
          WebkitMaskImage: "radial-gradient(90% 130% at 92% 50%, #000, transparent 62%)",
          maskImage: "radial-gradient(90% 130% at 92% 50%, #000, transparent 62%)",
        }}
      />
      {/* §dashboard-mobile #9 — 모바일: 아이콘+본문 한 행, CTA 아래 스택(가로 경쟁 제거).
          제목 truncate 해제(모바일 2줄 허용), 본문 1줄 요약. */}
      <div className="relative z-10 flex min-w-0 items-center gap-3 sm:flex-1">
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-[#2f6be0] text-white">
          <ListChecks className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#9cc0ff] mb-1">
            <span className="font-semibold">우선 추천</span>
          </p>
          <h3 className="text-[15px] sm:text-base font-bold leading-snug line-clamp-2 sm:truncate">
            {/* §quote-screen-sian P6.5 — 품목명 배경 highlight 제거(시안 평문 정합). */}
            <span className="font-extrabold">{best.name}</span>
            {" — "}
            {nextStep} 단계입니다.
          </h3>
          <p className="text-[12px] text-white/60 mt-0.5 line-clamp-2 sm:line-clamp-1">
            {STAGE_LABEL[best.stage]} · 마감 {dDayLabel(best.dd)} · 공급사 {best.vendors}곳 · 우선순위{" "}
            <span className={LEVEL_TEXT[best.level]}>{LEVEL_LABEL[best.level]}</span>
            {best.reason ? ` (${best.reason})` : ""}
          </p>
        </div>
      </div>
      {/* §quote-screen-sian P6.3 §07 — 실행 버튼(다음 액션 = next.label) + "나중에"(일시 보류). */}
      <div className="relative z-10 flex w-full items-center gap-2 sm:w-auto sm:flex-none">
        <button
          type="button"
          onClick={() => onOpen(best!.id)}
          className="inline-flex flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-lg bg-white px-3.5 py-2 text-[13px] font-extrabold text-[#0f1b34] shadow-sm transition-colors hover:bg-[#eef2fe] min-h-[44px] sm:min-h-0"
          aria-label={`우선 추천 케이스 ${best.name} — ${nextStep}`}
        >
          {nextStep}
          <ArrowRight className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setDismissed((prev) => { const n = new Set(prev); n.add(best!.id); return n; })}
          className="inline-flex items-center rounded-lg bg-white/10 px-3 py-2 text-[13px] font-semibold text-white/80 transition-colors hover:bg-white/20 min-h-[44px] sm:min-h-0"
          aria-label={`우선 추천 ${best.name} 나중에`}
        >
          나중에
        </button>
      </div>
    </div>
  );
}
