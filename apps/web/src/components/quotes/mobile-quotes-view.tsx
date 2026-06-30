"use client";

/**
 * §labaxis-web-mobile-reskin Phase 2 — 02 견적 모바일 전용 뷰(목업 §02 재현).
 *
 * ⚠️ 견적 페이지는 공유 반응형 QuoteCard 구조라 재고처럼 모바일 분리가 없었음 →
 *   데스크탑 무접촉 원칙상 모바일 전용 뷰를 신설(md:hidden 마운트, 기존 카드는 hidden md:block).
 * 목업 §02: 단계 칩 + 케이스 카드(단계 레일색·상태 pill·금액·요청건수·상대시각·next-step).
 * ⚠️ 정직: Quote 실필드만(title/status/totalAmount/items/responses/createdAt). 우선순위·마감
 *   D-day·공급사 수 등 API 미제공 항목은 미표기. AI 카드 금지(§AI-UI) — next-step contextual.
 * 액션 wiring(no-op 0): 카드/next-step → onSelect(id)(부모 handleQuoteCardSelect 연결).
 * §11.302: 발송대기=blue · 회신추적=amber #b45821 · 비교검토=violet · 승인입고=emerald.
 */
import { useMemo, useState } from "react";
import { ChevronRight, Clock, Users, FileText } from "lucide-react";

type QuoteStatus = "PENDING" | "SENT" | "RESPONDED" | "COMPLETED" | "CANCELLED";

export interface QuoteLite {
  id: string;
  title: string;
  status: QuoteStatus;
  createdAt: string;
  totalAmount?: number | null;
  items: Array<{ product: { name: string } }>;
  responses?: Array<{ totalPrice?: number }>;
}

type Stage = "s1" | "s2" | "s3" | "s4" | "x";

function stageOf(q: QuoteLite): Stage {
  switch (q.status) {
    case "PENDING":
      return "s1";
    case "SENT":
      return "s2";
    case "RESPONDED":
      return "s3";
    case "COMPLETED":
      return "s4";
    default:
      return "x";
  }
}

const STAGE_META: Record<
  Stage,
  { label: string; rail: string; pillBg: string; pillText: string }
> = {
  s1: { label: "발송 대기", rail: "bg-blue-500", pillBg: "bg-blue-100", pillText: "text-blue-700" },
  s2: { label: "회신 추적", rail: "bg-[#b45821]", pillBg: "bg-[#fdf3ec]", pillText: "text-[#b45821]" },
  s3: { label: "비교 검토", rail: "bg-violet-500", pillBg: "bg-violet-100", pillText: "text-violet-700" },
  s4: { label: "승인·입고", rail: "bg-emerald-500", pillBg: "bg-emerald-100", pillText: "text-emerald-700" },
  x: { label: "취소", rail: "bg-slate-300", pillBg: "bg-slate-100", pillText: "text-slate-500" },
};

const CHIPS = [
  { k: "all", label: "전체" },
  { k: "s1", label: "발송 대기" },
  { k: "s2", label: "회신 추적" },
  { k: "s3", label: "비교 검토" },
  { k: "s4", label: "승인·입고" },
] as const;

function relTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const d = Math.floor((Date.now() - t) / 86400000);
  if (d <= 0) return "오늘";
  if (d === 1) return "어제";
  if (d < 7) return `${d}일 전`;
  if (d < 30) return `${Math.floor(d / 7)}주 전`;
  return `${Math.floor(d / 30)}개월 전`;
}

function won(n?: number | null): string {
  if (!n || n <= 0) return "-";
  return `₩${n.toLocaleString("ko-KR")}`;
}

function amountText(q: QuoteLite): string {
  const prices = (q.responses ?? [])
    .map((r) => r.totalPrice)
    .filter((p): p is number => typeof p === "number" && p > 0);
  if (prices.length) {
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    return min === max ? won(min) : `${won(min)}~${won(max)}`;
  }
  return won(q.totalAmount);
}

function displayTitle(q: QuoteLite): string {
  const first = q.items?.[0]?.product?.name;
  const more = Math.max(0, (q.items?.length ?? 0) - 1);
  if (!first) return q.title || "(제목 없음)";
  return more > 0 ? `${first} 외 ${more}건` : first;
}

function QuoteCaseCard({ q, onSelect }: { q: QuoteLite; onSelect: (id: string) => void }) {
  const stage = stageOf(q);
  const meta = STAGE_META[stage];
  const responses = q.responses?.length ?? 0;
  return (
    <button
      type="button"
      onClick={() => onSelect(q.id)}
      className="w-full text-left rounded-xl border border-slate-200 bg-white overflow-hidden flex active:bg-slate-50 transition-colors"
    >
      <div className={`w-1 shrink-0 ${meta.rail}`} />
      <div className="flex-1 min-w-0 p-3.5">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${meta.pillBg} ${meta.pillText}`}>
            {meta.label}
          </span>
          <span className="text-[11px] text-slate-400 shrink-0">{q.items?.length ?? 0}개 품목</span>
        </div>
        <h4 className="text-[15px] font-bold text-slate-900 leading-snug line-clamp-2">
          {displayTitle(q)}
        </h4>
        <div className="flex items-center gap-3 mt-2 text-[12px] text-slate-500">
          {responses > 0 && (
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3 text-slate-400" />
              회신 {responses}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3 text-slate-400" />
            {relTime(q.createdAt)}
          </span>
        </div>
        <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-100">
          <span className="text-[15px] font-extrabold text-blue-700">{amountText(q)}</span>
          <ChevronRight className="h-4 w-4 text-slate-400" />
        </div>
      </div>
    </button>
  );
}

export function MobileQuotesView({
  quotes,
  onSelect,
}: {
  quotes: QuoteLite[];
  onSelect: (id: string) => void;
}) {
  const [filter, setFilter] = useState<(typeof CHIPS)[number]["k"]>("all");

  const filtered = useMemo(() => {
    const list = filter === "all" ? quotes : quotes.filter((q) => stageOf(q) === filter);
    // 단계 우선순위 정렬(발송대기→회신추적→비교검토→승인입고).
    const order: Record<Stage, number> = { s1: 0, s2: 1, s3: 2, s4: 3, x: 4 };
    return [...list].sort((a, b) => order[stageOf(a)] - order[stageOf(b)]);
  }, [quotes, filter]);

  const kpi = useMemo(() => {
    let active = 0, waiting = 0, review = 0;
    for (const q of quotes) {
      const s = stageOf(q);
      if (s === "s1" || s === "s2" || s === "s3") active++;
      if (s === "s2") waiting++;
      if (s === "s3") review++;
    }
    return { active, waiting, review };
  }, [quotes]);

  const topTask = useMemo(() => {
    const byOld = (x: QuoteLite, y: QuoteLite) => new Date(x.createdAt).getTime() - new Date(y.createdAt).getTime();
    const s2 = quotes.filter((q) => stageOf(q) === "s2").sort(byOld);
    if (s2[0]) return s2[0];
    const s1 = quotes.filter((q) => stageOf(q) === "s1").sort(byOld);
    return s1[0] ?? null;
  }, [quotes]);

  return (
    <div className="space-y-3">
      {/* navy 헤더 + KPI 요약 (목업 §02) */}
      <div className="bg-slate-900 rounded-2xl px-4 pt-4 pb-4">
        <h1 className="text-[22px] font-extrabold tracking-tight text-white">견적 관리</h1>
        <p className="text-[12.5px] text-white/60 mt-0.5">발송 → 회신 → 비교 → 승인</p>
        <div className="flex gap-2 mt-3.5">
          {[
            { l: "진행 중", v: kpi.active, alert: false },
            { l: "회신 대기", v: kpi.waiting, alert: true },
            { l: "비교 검토", v: kpi.review, alert: false },
          ].map((k) => (
            <div key={k.l} className={`flex-1 rounded-[14px] px-3 py-2.5 ${k.alert && k.v > 0 ? "bg-rose-500/15" : "bg-white/[0.06]"}`}>
              <p className="text-white text-xl font-extrabold">{k.v}</p>
              <p className={`text-[11px] mt-0.5 ${k.alert && k.v > 0 ? "text-rose-200" : "text-white/60"}`}>{k.l}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 지금 할 일 (contextual next-step, AI 아님) */}
      {topTask ? (
        <button
          type="button"
          onClick={() => onSelect(topTask.id)}
          className="w-full text-left bg-slate-900 rounded-2xl px-4 py-3.5 active:opacity-90 transition-opacity"
        >
          <div className="flex items-center gap-1.5">
            <Clock className="h-3 w-3 text-blue-200" />
            <span className="text-[11px] font-bold text-blue-200">지금 할 일</span>
          </div>
          <p className="text-white text-[15px] font-extrabold mt-1.5 line-clamp-1">{displayTitle(topTask)}</p>
          <p className="text-white/60 text-[12.5px] mt-0.5">{STAGE_META[stageOf(topTask)].label} · {relTime(topTask.createdAt)}</p>
          <span className="inline-flex items-center gap-1 bg-white text-slate-900 text-[13px] font-bold px-3.5 py-2 rounded-full mt-3">
            바로 열기 <ChevronRight className="h-3.5 w-3.5" />
          </span>
        </button>
      ) : null}
      {/* 단계 칩 */}
      <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-0.5">
        {CHIPS.map((c) => {
          const on = filter === c.k;
          return (
            <button
              key={c.k}
              type="button"
              onClick={() => setFilter(c.k)}
              aria-pressed={on}
              className={`shrink-0 min-h-[40px] px-3.5 rounded-full border text-[13px] font-semibold transition-colors ${
                on ? "bg-slate-900 border-slate-900 text-white" : "bg-white border-slate-200 text-slate-600"
              }`}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      {/* 케이스 카드 큐 */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center py-10 text-center">
          <FileText className="h-10 w-10 text-slate-300 mb-3" />
          <p className="text-sm text-slate-500">
            {filter === "all" ? "견적이 없습니다" : "조건에 맞는 견적이 없습니다"}
          </p>
          {filter !== "all" && (
            <button
              type="button"
              onClick={() => setFilter("all")}
              className="mt-3 min-h-[40px] px-4 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600"
            >
              필터 초기화
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((q) => (
            <QuoteCaseCard key={q.id} q={q} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
}
