"use client";

/**
 * §web-mobile-reskin-fidelity #receiving — 04 입고 모바일 전용 뷰(목업 §04 문서게이트 큐).
 *
 * ⚠️ 정직: 별도 receiving API 없음. 실데이터 = ops-console ModuleLandingItem(blockerSummary/
 *   dueState/bucketKey). 문서게이트 매핑: bucketKey "blocked"=문서 대기(차단) / "ready"=반영 가능.
 *   blockerSummary = 문서 미첨부 사유(성적서/MSDS 등) 그대로. 가짜 데이터 0.
 * 핸드오프(입고 모바일웹): 2 KPI(흰 카드·숫자색·7px 도트, 꽉 찬 배경 미사용) + 칩(전체/문서대기/
 *   반영가능) + 문서게이트 카드(상태=테두리 색만·좌측 세로띠 없음·상태 pill·문서 라벨·CTA).
 *   CTA → onItemClick(실 라우팅). no-op 0.
 * §11.302: 차단/문서대기=rose · 반영가능=emerald · 주의(due_soon)=amber #b45821.
 */
import { useMemo, useState } from "react";
import { ChevronRight, AlertTriangle, CheckCircle2, Clock, FileText } from "lucide-react";
import type { ModuleLandingItem } from "@/lib/ops-console/module-landing-adapter";

type Gate = "blocked" | "ready";

function gateOf(item: ModuleLandingItem): Gate {
  return item.bucketKey === "blocked" || item.blockerSummary ? "blocked" : "ready";
}

const CHIPS = [
  { k: "all", label: "전체" },
  { k: "blocked", label: "문서 대기", danger: true },
  { k: "ready", label: "반영 가능" },
] as const;

function docLabel(item: ModuleLandingItem): string {
  if (gateOf(item) === "blocked") return item.blockerSummary || "문서 확인 필요";
  return item.readySummary || "문서 확인 완료";
}

function GateCard({
  item,
  onClick,
}: {
  item: ModuleLandingItem;
  onClick: (item: ModuleLandingItem) => void;
}) {
  const gate = gateOf(item);
  const blocked = gate === "blocked";
  return (
    <button
      type="button"
      onClick={() => onClick(item)}
      className={`relative w-full text-left rounded-xl border bg-white overflow-hidden active:bg-slate-50 active:scale-[0.99] transition ${
        blocked ? "border-rose-300" : "border-emerald-300"
      }`}
    >
      <div className="min-w-0 p-3.5">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
              blocked ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
            }`}
          >
            {blocked ? <AlertTriangle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
            {blocked ? "차단" : "반영 준비됨"}
          </span>
          {item.dueState.tone !== "normal" && (
            <span
              className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${
                item.dueState.tone === "overdue" ? "text-rose-600" : "text-[#b45821]"
              }`}
            >
              <Clock className="h-3 w-3" />
              {item.dueState.label}
            </span>
          )}
        </div>
        <h4 className="text-[15px] font-bold text-slate-900 leading-snug line-clamp-2">
          {item.title}
        </h4>
        <p
          className={`text-[12.5px] mt-1.5 flex items-center gap-1.5 ${
            blocked ? "text-rose-600" : "text-slate-500"
          }`}
        >
          <FileText className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{docLabel(item)}</span>
        </p>
        {item.summary && (
          <p className="text-[12px] text-slate-500 mt-1 line-clamp-1">{item.summary}</p>
        )}
        <div className="flex items-center justify-end mt-3 pt-2.5 border-t border-slate-100">
          <span
            className={`inline-flex items-center gap-1 text-[12.5px] font-bold ${
              blocked ? "text-blue-600" : "text-emerald-600"
            }`}
          >
            {blocked ? "문서 검토" : "재고 반영"}
            <ChevronRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </button>
  );
}

export function MobileReceivingView({
  items,
  onItemClick,
}: {
  items: ModuleLandingItem[];
  onItemClick: (item: ModuleLandingItem) => void;
}) {
  const [filter, setFilter] = useState<(typeof CHIPS)[number]["k"]>("all");

  const blockedCount = useMemo(() => items.filter((i) => gateOf(i) === "blocked").length, [items]);
  const readyCount = useMemo(() => items.filter((i) => gateOf(i) === "ready").length, [items]);

  const filtered = useMemo(() => {
    const list = filter === "all" ? items : items.filter((i) => gateOf(i) === filter);
    // 차단(문서 대기) 먼저, 그 안에서 overdue 우선.
    return [...list].sort((a, b) => {
      const ga = gateOf(a) === "blocked" ? 0 : 1;
      const gb = gateOf(b) === "blocked" ? 0 : 1;
      if (ga !== gb) return ga - gb;
      return (b.dueState.isOverdue ? 1 : 0) - (a.dueState.isOverdue ? 1 : 0);
    });
  }, [items, filter]);

  return (
    <div className="space-y-3">
      {/* 2 KPI (핸드오프 정합) — 흰 카드 + 숫자만 색 강조 + 7px 상태 도트.
          꽉 찬 배경색 미사용(절제). 0건 = 회색 비활성 톤(§11.311). */}
      <div className="flex gap-2">
        <div className={`flex-1 rounded-[14px] px-3 py-2.5 border bg-white ${blockedCount > 0 ? "border-slate-300 shadow-sm" : "border-slate-200"}`}>
          <p className={`text-xl font-extrabold ${blockedCount > 0 ? "text-rose-600" : "text-slate-400"}`}>{blockedCount}<span className="text-[11px] font-semibold"> 건</span></p>
          <p className={`text-[11px] mt-0.5 flex items-center gap-1.5 ${blockedCount > 0 ? "text-slate-600" : "text-slate-400"}`}>
            <span className={`h-[7px] w-[7px] rounded-full shrink-0 ${blockedCount > 0 ? "bg-rose-500" : "bg-slate-300"}`} />
            문서 대기
          </p>
        </div>
        <div className={`flex-1 rounded-[14px] px-3 py-2.5 border bg-white ${readyCount > 0 ? "border-slate-300 shadow-sm" : "border-slate-200"}`}>
          <p className={`text-xl font-extrabold ${readyCount > 0 ? "text-emerald-600" : "text-slate-400"}`}>{readyCount}<span className="text-[11px] font-semibold"> 건</span></p>
          <p className={`text-[11px] mt-0.5 flex items-center gap-1.5 ${readyCount > 0 ? "text-slate-600" : "text-slate-400"}`}>
            <span className={`h-[7px] w-[7px] rounded-full shrink-0 ${readyCount > 0 ? "bg-emerald-500" : "bg-slate-300"}`} />
            반영 가능
          </p>
        </div>
      </div>

      {/* 칩 */}
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
                on
                  ? "bg-slate-900 border-slate-900 text-white"
                  : "danger" in c && c.danger
                    ? "bg-rose-50 border-rose-200 text-rose-700"
                    : "bg-white border-slate-200 text-slate-600"
              }`}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      {/* 문서게이트 카드 */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center py-10 text-center">
          <FileText className="h-10 w-10 text-slate-300 mb-3" />
          <p className="text-sm text-slate-500">
            {filter === "all" ? "처리 중인 입고가 없습니다" : "조건에 맞는 입고가 없습니다"}
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
          {filtered.map((item) => (
            <GateCard key={item.entityId} item={item} onClick={onItemClick} />
          ))}
        </div>
      )}
    </div>
  );
}
