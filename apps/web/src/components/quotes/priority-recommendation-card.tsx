"use client";

/**
 * §quote-management P4-core-B — 우선 추천 카드(룰베이스 computePriority)
 *
 * 지시문 §07. 기존 "AI 추천" 배너(룰베이스를 AI로 라벨 = 가드② 위반) 대체.
 *   - computePriority(가중합) score 1위 케이스 1줄 추천 + 사유 배지 + 다음 액션 CTA.
 *   - ★ "AI" 라벨/Sparkles 금지(룰베이스). 진짜 LLM(종합추천·협상)은 P6에서만 "AI".
 *   - ★ 정직: 高/中(level !== low)만 추천. 추천 대상 0이면 노출 0(가짜 풍부 금지, no-op 아님).
 *   - CTA = 실제 액션(케이스 열기 → rail). dead button 0.
 *   - §11.302 색: high=red, mid=yellow (amber/orange 금지).
 */

import { computePriority, dDayLabel } from "@/lib/quote-management/derive";
import { toQuoteCase, type QuoteLike } from "@/lib/quote-management/from-quote";
import { ListChecks } from "lucide-react";

export function PriorityRecommendationCard({
  quotes,
  onOpen,
}: {
  quotes: QuoteLike[];
  onOpen: (id: string) => void;
}) {
  let best: { id: string; name: string; reason: string; dd: number | null; level: "high" | "mid" } | null = null;
  let bestScore = -1;
  for (const q of quotes) {
    const c = toQuoteCase(q);
    if (!c) continue; // 퍼널 외(CANCELLED 등)
    const r = computePriority(c);
    if (r.level === "low") continue; // 低 = 추천 안 함(정직)
    if (r.score > bestScore) {
      bestScore = r.score;
      best = { id: c.id, name: c.name, reason: r.reason ?? "우선 처리", dd: r.dd, level: r.level };
    }
  }
  if (!best) return null; // 추천 대상 0 → 노출 0

  const tone =
    best.level === "high"
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-yellow-200 bg-yellow-50 text-yellow-700";

  return (
    <div className={`rounded-lg border ${tone} px-3 py-2 flex items-center gap-2`}>
      <ListChecks className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <p className="text-[12px] sm:text-xs min-w-0 flex-1 truncate">
        <span className="font-semibold">우선 추천</span>
        {" · "}
        {best.name}
        {" · "}
        {best.reason}
        {best.dd != null ? ` · ${dDayLabel(best.dd)}` : ""}
      </p>
      <button
        type="button"
        onClick={() => onOpen(best.id)}
        className="shrink-0 text-[11px] font-semibold underline underline-offset-2 px-2 py-1.5 min-h-[44px] sm:min-h-0 inline-flex items-center"
        aria-label={`우선 추천 케이스 ${best.name} 열기`}
      >
        케이스 열기
      </button>
    </div>
  );
}
