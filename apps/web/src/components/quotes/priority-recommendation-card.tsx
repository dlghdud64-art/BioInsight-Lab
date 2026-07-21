"use client";

/**
 * §quote-management P4-core-B + §quote-flat Q2 — 우선 추천 카드(navy, 시안 A ② 정합)
 *
 * 지시문 §07 + 시안 ②(.ai-action). computePriority(룰베이스) score 1위 케이스 상시 노출.
 *   - ★ "AI" 라벨/Sparkles 금지(룰베이스). orb(spark) 제거(제품상세 P6 선례).
 *   - ★ 정직(CEO 2026-06-21): 최우선 1건 상시 노출 + 真 level(높음/보통/낮음) 표시(가짜 격상 0).
 *     케이스 0건이면 노출 0(!best). 사유는 高·中만(低는 derive reason=null → 생략).
 *   - CTA = 케이스 열기(real → rail). dead button 0. 다음 단계는 본문 텍스트로 안내(가짜 액션 금지).
 *   - navy: §quote-management-redesign P4 — 대시보드 NextStepBanner 토큰 재사용
 *     (linear-gradient #1b2b50→#243a72→#2f6be0 + 광택 boxShadow, 시안 정합).
 *     §11.302 색: high=red·mid=yellow·low=중립(amber/orange 금지).
 */

import { useState } from "react";
import { computePriority, dDayLabel, type Stage } from "@/lib/quote-management/derive";
import { toQuoteCase, type QuoteLike } from "@/lib/quote-management/from-quote";
import { ListChecks, ArrowRight, X } from "lucide-react";

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
  // §quotes-mobile-refine P1 (호영님 2026-07-21) — 압박 어휘 폐지(honesty 톤, PO surface 와 정합).
  s2: "회신 확인",
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
    <div
      // §quotes-mobile-density P3 — 우선추천 카드 → 얇은 inline 1행(퍼스트뷰 ~88px→~48px).
      //   2행(제목 line-clamp + 본문) → 단일 truncate 행. navy 토큰·"우선 추천"·CTA·나중에 보존.
      className="relative overflow-hidden rounded-xl text-white px-3.5 py-2 flex items-center gap-2.5"
      style={{
        // §quote-management-redesign P4 — 대시보드 NextStepBanner navy 토큰 재사용(시안 정합). §11.302 amber/orange 0.
        background: "linear-gradient(100deg, #1b2b50 0%, #243a72 55%, #2f6be0 130%)",
        boxShadow: "0 6px 18px -8px rgba(20,38,80,.55)",
      }}
    >
      <ListChecks className="relative z-10 h-4 w-4 flex-none text-[#a9c2f5]" aria-hidden="true" />
      {/* 단일 행 요약 — 우선 추천 eyebrow + 케이스명 + 다음 단계 + 메타·眞 level. truncate 로 모바일 1줄. */}
      <p className="relative z-10 min-w-0 flex-1 text-[12.5px] leading-snug truncate">
        <span className="text-[#a9c2f5] mr-1.5 font-extrabold uppercase tracking-wide text-[10px]">
          <span className="font-semibold">우선 추천</span>
        </span>
        <span className="font-bold">{best.name}</span>
        {" — "}
        {nextStep} 단계 · {STAGE_LABEL[best.stage]} · 마감 {dDayLabel(best.dd)} · 공급사 {best.vendors}곳 · 우선순위{" "}
        <span className={LEVEL_TEXT[best.level]}>{LEVEL_LABEL[best.level]}</span>
        {best.reason ? ` (${best.reason})` : ""}
      </p>
      {/* §quote-screen-sian P6.3 §07 — 실행 버튼(다음 액션 = next.label) + "나중에"(일시 보류). dead button 0. */}
      <button
        type="button"
        onClick={() => onOpen(best!.id)}
        className="relative z-10 inline-flex flex-none items-center justify-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-[12px] font-extrabold text-[#0f1b34] shadow-sm transition-colors hover:bg-[#eef2fe] min-h-[36px]"
        aria-label={`우선 추천 케이스 ${best.name} — ${nextStep}`}
      >
        <span className="hidden sm:inline">{nextStep}</span>
        <ArrowRight className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => setDismissed((prev) => { const n = new Set(prev); n.add(best!.id); return n; })}
        className="relative z-10 inline-flex flex-none items-center justify-center rounded-lg bg-white/10 px-2 py-1.5 text-[12px] font-semibold text-white/80 transition-colors hover:bg-white/20 min-h-[36px]"
        aria-label={`우선 추천 ${best.name} 나중에`}
      >
        <span className="hidden sm:inline">나중에</span>
        <X className="h-4 w-4 sm:hidden" aria-hidden="true" />
      </button>
    </div>
  );
}
