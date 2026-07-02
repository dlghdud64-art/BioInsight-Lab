"use client";

/**
 * §quote-mobile-v2 — 견적 관리 모바일 뷰(시안 02 v2 정합, 호영님 2026-07-03).
 *
 * 기존 §labaxis-web-mobile-reskin v1 재구성. 데스크탑 무접촉(md:hidden 마운트, 부모가 게이팅).
 * 시안 v2: 페이지 헤더 + "우선 추천" 배너(룰베이스 우선순위) + 요약 3카드 +
 *   단계 칩(실필터) + 케이스 큐(qsec 단계별) 카드(레일색·stagepill·우선순위필·
 *   공급사 아바타·D-day/회신진행·금액·단계 액션).
 * canonical 재사용(중복 0): toQuoteCase→computePriority(우선순위·D-day),
 *   case.suppliers(공급사 아바타·회신수), quoteDisplayRef(RFQ ref), responses(최저가).
 * 액션 wiring(dead button 0): 카드탭→onSelect(id), 단계 액션·배너 CTA→onAction(id)
 *   (부모 handleQuoteCardSelect→getOpSignals.ctaLabel 라우팅; 발송=데스크탑 VendorRequestModal 재사용).
 * §11.302 색: s1 blue·s2 violet·s3 emerald·s4/s5 amber. 우선순위 high rose·mid amber·low slate.
 */
import { useMemo, useState } from "react";
import { Send, Bell, Scale, ShieldCheck, PackageCheck, Clock, Calendar, ChevronRight, FileText } from "lucide-react";
import { computePriority } from "@/lib/quote-management/derive";
import { toQuoteCase } from "@/lib/quote-management/from-quote";
import { quoteDisplayRef } from "@/lib/quote-management/quote-display-ref";

export interface QuoteLite {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  quoteNumber?: string | null;
  totalAmount?: number | null;
  items: Array<{ product: { name: string } }>;
  responses?: Array<{ totalPrice?: number }>;
  vendorRequests?: Array<{
    vendorName?: string | null;
    vendorEmail?: string | null;
    status?: string | null;
    respondedAt?: string | null;
    createdAt?: string | null;
    expiresAt?: string | null;
  }>;
}

type UiStage = "s1" | "s2" | "s3" | "s4" | "s5";

const STAGE_META: Record<UiStage, {
  section: string; pill: string; rail: string; pillCls: string; dot: string;
  act: string; actCls: string; amountLabel: string; mid: "due" | "reply" | "selected";
}> = {
  s1: { section: "발송 대기", pill: "발송 대기", rail: "bg-blue-500", pillCls: "bg-blue-50 text-blue-700", dot: "bg-blue-500", act: "발송", actCls: "bg-blue-600 text-white", amountLabel: "예상 금액", mid: "due" },
  s2: { section: "회신 추적", pill: "회신 추적", rail: "bg-violet-500", pillCls: "bg-violet-50 text-violet-700", dot: "bg-violet-500", act: "리마인더", actCls: "bg-white text-slate-700 border border-slate-200", amountLabel: "예상 금액", mid: "reply" },
  s3: { section: "비교 검토", pill: "비교 검토", rail: "bg-emerald-500", pillCls: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500", act: "비교", actCls: "bg-blue-600 text-white", amountLabel: "최저 견적", mid: "reply" },
  s4: { section: "승인 · 입고 준비", pill: "승인 대기", rail: "bg-[#b45821]", pillCls: "bg-[#fdf3ec] text-[#b45821]", dot: "bg-[#b45821]", act: "승인", actCls: "bg-emerald-600 text-white", amountLabel: "선정 금액", mid: "due" },
  s5: { section: "승인 · 입고 준비", pill: "입고 준비", rail: "bg-slate-700", pillCls: "bg-slate-100 text-slate-700", dot: "bg-slate-600", act: "입고", actCls: "bg-slate-800 text-white", amountLabel: "발주 금액", mid: "selected" },
};

const PRIO = {
  high: { label: "높음", cls: "bg-rose-50 text-rose-700", dot: "bg-rose-500" },
  mid: { label: "보통", cls: "bg-[#fdf3ec] text-[#b45821]", dot: "bg-[#b45821]" },
  low: { label: "낮음", cls: "bg-slate-100 text-slate-500", dot: "bg-slate-400" },
} as const;

const CHIPS: { k: "all" | "s1" | "s2" | "s3" | "s45"; label: string }[] = [
  { k: "all", label: "전체" }, { k: "s1", label: "발송 대기" }, { k: "s2", label: "회신 추적" },
  { k: "s3", label: "비교 검토" }, { k: "s45", label: "승인·입고" },
];
function inChip(stage: UiStage, k: string): boolean {
  if (k === "all") return true;
  if (k === "s45") return stage === "s4" || stage === "s5";
  return stage === k;
}

function displayTitle(q: QuoteLite): string {
  const first = q.items?.[0]?.product?.name;
  const more = Math.max(0, (q.items?.length ?? 0) - 1);
  if (!first) return q.title || "(제목 없음)";
  return more > 0 ? `${first} 외 ${more}종` : first;
}
function ddText(dd: number | null): string {
  if (dd == null) return "—";
  if (dd < 0) return `${-dd}일 지남`;
  if (dd === 0) return "D-day";
  return `D-${dd}`;
}

interface VM {
  id: string; ref: string; title: string; stage: UiStage;
  level: "high" | "mid" | "low"; dd: number | null;
  suppliers: { name: string; replied: boolean }[];
  repliedCount: number; totalCount: number; amount: number | null;
}
function buildVM(q: QuoteLite): VM | null {
  const c = toQuoteCase(q);
  if (!c) return null;
  const { level, dd } = computePriority(c);
  const suppliers = c.suppliers.map((s) => ({ name: s.name, replied: s.replied }));
  const prices = (q.responses ?? []).map((r) => r.totalPrice).filter((p): p is number => typeof p === "number" && p > 0);
  const amount = prices.length ? Math.min(...prices) : (q.totalAmount ?? null);
  return {
    id: q.id, ref: quoteDisplayRef(q), title: displayTitle(q), stage: c.stage as UiStage,
    level, dd, suppliers, repliedCount: suppliers.filter((s) => s.replied).length,
    totalCount: suppliers.length, amount,
  };
}

function actIcon(stage: UiStage) {
  const cn = "h-3.5 w-3.5";
  if (stage === "s1") return <Send className={cn} />;
  if (stage === "s2") return <Bell className={cn} />;
  if (stage === "s3") return <Scale className={cn} />;
  if (stage === "s4") return <ShieldCheck className={cn} />;
  return <PackageCheck className={cn} />;
}

function CaseCard({ vm, onSelect, onAction }: { vm: VM; onSelect: (id: string) => void; onAction: (id: string) => void }) {
  const m = STAGE_META[vm.stage];
  const p = PRIO[vm.level];
  const shown = vm.suppliers.slice(0, 3);
  const extra = vm.totalCount - shown.length;
  const soon = vm.dd != null && vm.dd <= 1;
  const pct = vm.totalCount > 0 ? Math.round((vm.repliedCount / vm.totalCount) * 100) : 0;
  return (
    <div className="rounded-[13px] border border-slate-200 bg-white overflow-hidden flex shadow-sm">
      <div className={`w-1 shrink-0 ${m.rail}`} />
      <div className="flex-1 min-w-0 p-3.5">
        <div className="flex items-center gap-2 mb-1.5">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${m.pillCls}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />{m.pill}
          </span>
          <span className="flex-1" />
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${p.cls}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${p.dot}`} />{p.label}
          </span>
        </div>
        <button type="button" onClick={() => onSelect(vm.id)} className="block w-full text-left active:opacity-70">
          <div className="text-[11px] font-bold text-slate-400 font-mono">{vm.ref}</div>
          <div className="text-[15px] font-extrabold text-slate-900 leading-snug line-clamp-1 mt-0.5">{vm.title}</div>
        </button>
        <div className="flex items-center gap-2 mt-2.5">
          <span className="flex -space-x-1.5">
            {shown.map((s, i) => (
              <span key={i} className="h-6 w-6 rounded-full bg-slate-100 border-2 border-white grid place-items-center text-[10px] font-bold text-slate-600">{s.name[0] ?? "?"}</span>
            ))}
            {extra > 0 && <span className="h-6 w-6 rounded-full bg-slate-200 border-2 border-white grid place-items-center text-[10px] font-bold text-slate-500">+{extra}</span>}
            {vm.totalCount === 0 && <span className="text-[11px] text-slate-400">공급사 미정</span>}
          </span>
          <span className="flex-1" />
          {m.mid === "due" && (
            <span className={`inline-flex items-center gap-1 text-[11.5px] font-bold ${soon ? "text-rose-600" : "text-slate-500"}`}>
              <Clock className="h-3.5 w-3.5" />{ddText(vm.dd)}
            </span>
          )}
          {m.mid === "reply" && vm.totalCount > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-14 rounded-full bg-slate-100 overflow-hidden"><i className="block h-full bg-violet-500" style={{ width: `${pct}%` }} /></span>
              <span className="text-[11.5px] font-bold text-slate-500 tabular-nums">{vm.repliedCount}/{vm.totalCount}</span>
            </span>
          )}
          {m.mid === "selected" && <span className="text-[11.5px] font-bold text-emerald-700">선정 완료</span>}
        </div>
        <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-100">
          <div>
            <div className="text-[10.5px] text-slate-400 font-semibold">{m.amountLabel}</div>
            {vm.amount != null ? (
              <div className="text-[15px] font-extrabold text-slate-900 tabular-nums">{vm.amount.toLocaleString("ko-KR")}<span className="text-[11px] font-bold text-slate-400 ml-0.5">원</span></div>
            ) : (<div className="text-[13px] font-bold text-slate-400">견적 대기</div>)}
          </div>
          <button type="button" onClick={() => onAction(vm.id)} className={`inline-flex items-center gap-1 h-9 px-3.5 rounded-[10px] text-[13px] font-extrabold active:scale-95 ${m.actCls}`}>
            {actIcon(vm.stage)}{m.act}
          </button>
        </div>
      </div>
    </div>
  );
}

function SumCard({ label, value, tone, bar, ddLabel }: { label: string; value: number; tone: "primary" | "wait" | "alert"; bar?: boolean; ddLabel?: boolean }) {
  const active = value > 0;
  const alertOn = tone === "alert" && active;
  return (
    <div className={`flex-1 rounded-[13px] p-3 border ${alertOn ? "bg-rose-50 border-rose-200" : active ? "bg-white border-slate-300 shadow-sm" : "bg-slate-50 border-slate-200"}`}>
      <div className={`text-lg font-extrabold tabular-nums ${alertOn ? "text-rose-700" : active ? "text-slate-900" : "text-slate-400"}`}>{value}<small className="text-[11px] font-bold text-slate-400 ml-0.5">건</small></div>
      <div className={`text-[11px] font-semibold mt-0.5 ${alertOn ? "text-rose-600" : "text-slate-500"}`}>{ddLabel && active ? <><b className="text-rose-700">D-1</b> {label}</> : label}</div>
      {bar && <div className="mt-1.5 h-1 rounded-full bg-slate-100 overflow-hidden"><i className="block h-full bg-blue-500 rounded-full" style={{ width: active ? "60%" : "0%" }} /></div>}
    </div>
  );
}

function topReason(top: VM): string {
  const next: Record<UiStage, string> = { s1: "견적 요청 발송", s2: "회신 독려", s3: "견적 비교", s4: "승인 요청", s5: "발주 전환" };
  const soon = top.dd != null && top.dd <= 1;
  return soon ? `의 회신 마감이 임박했어요 — ${next[top.stage]}이 다음 단계입니다.` : ` — ${next[top.stage]}이 다음 단계입니다.`;
}

export function MobileQuotesView({ quotes, onSelect, onAction }: {
  quotes: QuoteLite[];
  onSelect: (id: string) => void;
  onAction: (id: string) => void;
}) {
  const [filter, setFilter] = useState<(typeof CHIPS)[number]["k"]>("all");
  const vms = useMemo(() => quotes.map(buildVM).filter((v): v is VM => v != null), [quotes]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: vms.length, s1: 0, s2: 0, s3: 0, s45: 0 };
    for (const v of vms) { if (v.stage === "s1") c.s1++; else if (v.stage === "s2") c.s2++; else if (v.stage === "s3") c.s3++; else c.s45++; }
    return c;
  }, [vms]);

  const kpi = useMemo(() => ({
    active: vms.length,
    waiting: vms.filter((v) => v.stage === "s2").length,
    dueSoon: vms.filter((v) => v.dd != null && v.dd <= 1).length,
  }), [vms]);

  const top = useMemo(() => {
    let bestQ: QuoteLite | null = null; let bestScore = -1;
    for (const q of quotes) {
      const c = toQuoteCase(q); if (!c) continue;
      const { score } = computePriority(c);
      if (score > bestScore) { bestScore = score; bestQ = q; }
    }
    return bestQ ? buildVM(bestQ) : null;
  }, [quotes]);

  const filtered = useMemo(() => {
    const order: Record<UiStage, number> = { s1: 0, s2: 1, s3: 2, s4: 3, s5: 4 };
    return vms.filter((v) => inChip(v.stage, filter)).sort((a, b) => order[a.stage] - order[b.stage]);
  }, [vms, filter]);

  const sections = useMemo(() => {
    const groups: { key: string; label: string; items: VM[] }[] = [];
    const push = (label: string, pred: (v: VM) => boolean) => {
      const items = filtered.filter(pred);
      if (items.length) groups.push({ key: label, label, items });
    };
    push("발송 대기", (v) => v.stage === "s1");
    push("회신 추적", (v) => v.stage === "s2");
    push("비교 검토", (v) => v.stage === "s3");
    push("승인 · 입고 준비", (v) => v.stage === "s4" || v.stage === "s5");
    return groups;
  }, [filtered]);

  const now = new Date();
  const periodLabel = `${now.getMonth() + 1}월 ${Math.ceil(now.getDate() / 7)}주`;

  return (
    <div className="space-y-3.5">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <h1 className="text-[22px] font-extrabold tracking-tight text-slate-900">견적 관리</h1>
          <p className="text-[12.5px] text-slate-500 mt-0.5">처리가 필요한 견적을 우선순위 순으로</p>
        </div>
        <span className="inline-flex items-center gap-1 h-8 px-2.5 rounded-full bg-white border border-slate-200 text-[12px] font-bold text-slate-600 shrink-0">
          <Calendar className="h-3.5 w-3.5" />{periodLabel}
        </span>
      </div>

      {top && (
        <div className="rounded-[15px] px-4 py-3.5 text-white" style={{ background: "linear-gradient(100deg,#182c58,#234780 52%,#2b57a3)", boxShadow: "0 12px 28px -14px rgba(24,44,88,.55)" }}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Clock className="h-3.5 w-3.5" />
            <span className="text-[12px] font-extrabold">우선 추천</span>
            <span className="text-[10.5px] font-bold px-1.5 py-0.5 rounded bg-white/[0.16]">다음 단계</span>
          </div>
          <h3 className="text-[15px] font-bold leading-snug"><b className="font-extrabold">{top.title}</b>{topReason(top)}</h3>
          <p className="text-[11.5px] text-white/70 mt-1.5 flex items-center gap-1.5 flex-wrap">
            <span className="font-mono">{top.ref}</span><span className="opacity-50">·</span><span>{STAGE_META[top.stage].section}</span>
            {top.dd != null && (<><span className="opacity-50">·</span><span>마감 {ddText(top.dd)}</span></>)}
            {top.totalCount > 0 && (<><span className="opacity-50">·</span><span>공급사 {top.totalCount}곳</span></>)}
          </p>
          <div className="flex gap-2 mt-3">
            <button type="button" onClick={() => onAction(top.id)} className="inline-flex items-center gap-1.5 h-11 px-4 rounded-[11px] bg-white text-[#182c58] text-[13.5px] font-extrabold active:scale-95">
              {actIcon(top.stage)}{top.stage === "s1" ? "견적 요청 발송" : STAGE_META[top.stage].act}
            </button>
            <button type="button" onClick={() => onSelect(top.id)} className="h-11 px-4 rounded-[11px] border border-white/40 text-white text-[13.5px] font-bold active:scale-95">나중에</button>
          </div>
        </div>
      )}

      <div className="flex gap-2.5">
        <SumCard label="진행 중" value={kpi.active} tone="primary" bar />
        <SumCard label="회신 대기" value={kpi.waiting} tone="wait" />
        <SumCard label="마감 임박" value={kpi.dueSoon} tone="alert" ddLabel />
      </div>

      <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-0.5">
        {CHIPS.map((c) => {
          const on = filter === c.k;
          return (
            <button key={c.k} type="button" onClick={() => setFilter(c.k)} aria-pressed={on}
              className={`shrink-0 inline-flex items-center gap-1.5 min-h-[40px] px-3.5 rounded-full border text-[13px] font-semibold ${on ? "bg-slate-900 border-slate-900 text-white" : "bg-white border-slate-200 text-slate-600"}`}>
              {c.label}
              <span className={`text-[11px] font-bold px-1.5 rounded-full ${on ? "bg-white/20" : "bg-slate-100 text-slate-500"}`}>{counts[c.k]}</span>
            </button>
          );
        })}
      </div>

      {sections.length === 0 ? (
        <div className="flex flex-col items-center py-10 text-center">
          <FileText className="h-10 w-10 text-slate-300 mb-3" />
          <p className="text-sm text-slate-500">{filter === "all" ? "견적이 없습니다" : "조건에 맞는 견적이 없습니다"}</p>
          {filter !== "all" && <button type="button" onClick={() => setFilter("all")} className="mt-3 min-h-[40px] px-4 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600">필터 초기화</button>}
        </div>
      ) : (
        <div className="space-y-4">
          {sections.map((sec) => (
            <div key={sec.key} className="space-y-2.5">
              <div className="flex items-center gap-2 px-0.5">
                <span className="text-[12px] font-extrabold text-slate-500">{sec.label}</span>
                <span className="text-[11px] font-bold text-slate-400">{sec.items.length}</span>
                <span className="flex-1 h-px bg-slate-200" />
              </div>
              {sec.items.map((vm) => <CaseCard key={vm.id} vm={vm} onSelect={onSelect} onAction={onAction} />)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
