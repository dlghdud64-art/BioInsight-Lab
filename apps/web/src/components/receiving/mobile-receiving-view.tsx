"use client";

/**
 * §mobile-receiving-rcv-card Phase 2 (호영님 2026-07-26 핸드오프 — 모바일 입고 관리 개선)
 *
 * RCV 1건 = 카드 1장. 이전(이슈-단위 ModuleLandingItem projection)은 RCV 1건을 문서누락/
 *   반영차단/보류 3장으로 분열 → canonical(receivingBatches) 파생 뷰모델(MobileReceivingCard)로
 *   통합. "반영 차단"(결과 요약) 대등 카드 소멸, ready RCV 미노출 결함 해소.
 *
 * 핸드오프 §1:
 *   - 흰 카드 + 보더 #e6eaf0 (배경 채색 금지) — 레드/yellow/그린은 배지·번호 칩·텍스트에만.
 *   - 차단 사유 체크리스트(해결 순서: 문서 → 보류 → 검수) "반영까지 남은 일 · N".
 *   - 검수 줄(3)은 선행(1·2) 미해결 시 회색 비활성 + "1·2 해결 후 진행돼요".
 *   - 최종 CTA: 재고 반영 · N건 해결 후 가능 (비활성·사유 인라인). ready 시 재고 반영 › 활성.
 *   - 번호 칩: 문서=red #fef2f2/#b91c1c, 보류=yellow #fef9c3/#a16207, 대기=gray #f1f5f9/#94a3b8.
 *
 * 배선(정직): 첨부 = onAttach(Phase 3 시트), 보류/검수 = onInspect(상세 라우팅),
 *   재고 반영 = onPost(store.postToInventory 실 mutation). dead button 0.
 * KPI·필터 칩 카운트 = summary 파생(체크리스트와 동일 소스).
 */

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, FileText, ArrowRight, ChevronRight } from "lucide-react";
import type {
  MobileReceivingCard,
  MobileReceivingSummary,
  MobileReceivingBlocker,
} from "@/lib/ops-console/mobile-receiving-view-model";

type FilterKey = "all" | "blocked" | "ready";

const CHIPS: { k: FilterKey; label: string; danger?: boolean }[] = [
  { k: "all", label: "전체" },
  { k: "blocked", label: "문서 대기", danger: true },
  { k: "ready", label: "반영 가능" },
];

// 번호 칩 톤 — 핸드오프 §1: 문서=red / 보류=yellow / 대기(검수)=gray.
function chipTone(b: MobileReceivingBlocker): string {
  if (b.kind === "doc") return "bg-[#fef2f2] text-[#b91c1c]";
  if (b.kind === "quarantine") return "bg-[#fef9c3] text-[#a16207]";
  return "bg-[#f1f5f9] text-[#94a3b8]";
}

function formatArrival(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function BlockerRow({
  n,
  blocker,
  card,
  onAttach,
  onInspect,
}: {
  n: number;
  blocker: MobileReceivingBlocker;
  card: MobileReceivingCard;
  onAttach: (card: MobileReceivingCard) => void;
  onInspect: (card: MobileReceivingCard) => void;
}) {
  const disabled = blocker.dependsOnUnresolved;
  return (
    <div className="flex items-center gap-2.5 py-2.5 border-t border-slate-100 first:border-t-0">
      <span
        className={`h-5 w-5 rounded-md grid place-items-center text-[11px] font-black flex-none ${chipTone(
          blocker,
        )}`}
      >
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-[13px] font-bold ${disabled ? "text-slate-400" : "text-slate-900"}`}>
          {blocker.label}
        </p>
        <p className="text-[11px] text-slate-500 mt-0.5 truncate">
          {disabled ? "1·2 해결 후 진행돼요" : blocker.detail}
        </p>
      </div>
      {blocker.kind === "doc" ? (
        <button
          type="button"
          onClick={() => onAttach(card)}
          className="flex-none inline-flex items-center gap-0.5 min-h-[44px] px-3 text-[12px] font-extrabold text-white bg-[#2563eb] rounded-[9px] active:scale-95"
        >
          첨부 <ArrowRight className="h-3.5 w-3.5" />
        </button>
      ) : disabled ? (
        <span className="flex-none inline-flex items-center min-h-[44px] px-3 text-[12px] font-bold text-slate-400 bg-[#f1f5f9] rounded-[9px]">
          대기
        </span>
      ) : (
        <button
          type="button"
          onClick={() => onInspect(card)}
          className="flex-none inline-flex items-center gap-0.5 min-h-[44px] px-3 text-[12px] font-extrabold text-[#2563eb] bg-white border border-blue-300 rounded-[9px] active:scale-95"
        >
          검사 <ChevronRight className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function RcvCard({
  card,
  onAttach,
  onInspect,
  onPost,
}: {
  card: MobileReceivingCard;
  onAttach: (card: MobileReceivingCard) => void;
  onInspect: (card: MobileReceivingCard) => void;
  onPost: (card: MobileReceivingCard) => void;
}) {
  const blocked = card.status === "blocked";
  return (
    <div className="rounded-2xl border border-[#e6eaf0] bg-white p-3.5">
      {/* 헤더 — 상태 배지(칩만 채색) + 경과 */}
      <div className="flex items-center justify-between gap-2 mb-2">
        {blocked ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#fef2f2] text-[#b91c1c]">
            <AlertTriangle className="h-3 w-3" />
            반영 차단
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#f0fdf4] text-[#15803d]">
            <CheckCircle2 className="h-3 w-3" />
            반영 준비됨
          </span>
        )}
        {blocked && card.isOverdue && (
          <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-[#b91c1c]">
            <Clock className="h-3 w-3" />
            {card.overdueLabel}
          </span>
        )}
      </div>

      {/* 타이틀 + 메타 */}
      <h4 className="text-[15px] font-extrabold text-slate-900 leading-snug font-mono">
        {card.receivingNumber}
      </h4>
      <p className="text-[12px] text-slate-500 mt-0.5">
        {[card.vendorName, `${card.lineCount}개 라인`, `도착 ${formatArrival(card.receivedAt)}`]
          .filter(Boolean)
          .join(" · ")}
      </p>

      {blocked ? (
        <>
          {/* 차단 사유 체크리스트 */}
          <div className="mt-3 rounded-xl border border-[#e6eaf0] px-3 py-1.5">
            <div className="flex items-center justify-between py-2">
              <span className="text-[12px] font-extrabold text-slate-700">
                반영까지 남은 일 · {card.blockerCount}
              </span>
              <span className="text-[11px] text-slate-400">해결되면 자동으로 지워져요</span>
            </div>
            {card.blockers.map((b, i) => (
              <BlockerRow
                key={b.kind}
                n={i + 1}
                blocker={b}
                card={card}
                onAttach={onAttach}
                onInspect={onInspect}
              />
            ))}
          </div>

          {/* 최종 CTA — 비활성 + 사유 인라인 */}
          <button
            type="button"
            disabled
            className="mt-3 w-full min-h-[44px] rounded-[10px] text-[13px] font-bold bg-[#eef1f6] text-[#94a3b8] cursor-not-allowed"
          >
            재고 반영 · {card.blockerCount}건 해결 후 가능
          </button>
        </>
      ) : (
        /* ready — 활성 재고 반영 */
        <button
          type="button"
          onClick={() => onPost(card)}
          className="mt-3 w-full min-h-[44px] inline-flex items-center justify-center gap-1 rounded-[10px] text-[14px] font-bold text-white bg-[#2563eb] active:scale-[0.99]"
        >
          재고 반영 <ArrowRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export function MobileReceivingView({
  summary,
  onAttach,
  onInspect,
  onPost,
}: {
  summary: MobileReceivingSummary;
  onAttach: (card: MobileReceivingCard) => void;
  onInspect: (card: MobileReceivingCard) => void;
  onPost: (card: MobileReceivingCard) => void;
}) {
  const [filter, setFilter] = useState<FilterKey>("all");

  const filtered = useMemo(() => {
    if (filter === "all") return summary.cards;
    return summary.cards.filter((c) => c.status === filter);
  }, [summary.cards, filter]);

  return (
    <div className="space-y-3">
      {/* 2 KPI — 흰 카드 + 숫자만 색 강조(§11.311). 0건 = 회색 비활성 톤. */}
      <div className="flex gap-2">
        <div
          className={`flex-1 rounded-[14px] px-3 py-2.5 border bg-white ${
            summary.blockedCount > 0 ? "border-slate-300 shadow-sm" : "border-slate-200"
          }`}
        >
          <p
            className={`text-xl font-extrabold ${
              summary.blockedCount > 0 ? "text-[#b91c1c]" : "text-slate-400"
            }`}
          >
            {summary.blockedCount}
            <span className="text-[11px] font-semibold"> 건</span>
          </p>
          <p
            className={`text-[11px] mt-0.5 flex items-center gap-1.5 ${
              summary.blockedCount > 0 ? "text-slate-600" : "text-slate-400"
            }`}
          >
            <span
              className={`h-[7px] w-[7px] rounded-full shrink-0 ${
                summary.blockedCount > 0 ? "bg-[#b91c1c]" : "bg-slate-300"
              }`}
            />
            문서 대기
          </p>
        </div>
        <div
          className={`flex-1 rounded-[14px] px-3 py-2.5 border bg-white ${
            summary.readyCount > 0 ? "border-slate-300 shadow-sm" : "border-slate-200"
          }`}
        >
          <p
            className={`text-xl font-extrabold ${
              summary.readyCount > 0 ? "text-emerald-600" : "text-slate-400"
            }`}
          >
            {summary.readyCount}
            <span className="text-[11px] font-semibold"> 건</span>
          </p>
          <p
            className={`text-[11px] mt-0.5 flex items-center gap-1.5 ${
              summary.readyCount > 0 ? "text-slate-600" : "text-slate-400"
            }`}
          >
            <span
              className={`h-[7px] w-[7px] rounded-full shrink-0 ${
                summary.readyCount > 0 ? "bg-emerald-500" : "bg-slate-300"
              }`}
            />
            반영 가능
          </p>
        </div>
      </div>

      {/* 필터 칩 — 카운트 인라인(summary 파생) */}
      <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-0.5">
        {CHIPS.map((c) => {
          const on = filter === c.k;
          const count =
            c.k === "all"
              ? summary.cards.length
              : c.k === "blocked"
                ? summary.blockedCount
                : summary.readyCount;
          return (
            <button
              key={c.k}
              type="button"
              onClick={() => setFilter(c.k)}
              aria-pressed={on}
              className={`shrink-0 min-h-[40px] px-3.5 rounded-full border text-[13px] font-bold transition-colors inline-flex items-center gap-1.5 ${
                on
                  ? c.danger
                    ? "bg-[#b91c1c] border-[#b91c1c] text-white"
                    : "bg-slate-900 border-slate-900 text-white"
                  : "bg-white border-slate-200 text-slate-600"
              }`}
            >
              {c.label}
              <span
                className={`text-[11px] font-bold tabular-nums ${on ? "text-white/80" : "text-slate-400"}`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* RCV 카드 리스트 */}
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
          {filtered.map((card) => (
            <RcvCard
              key={card.id}
              card={card}
              onAttach={onAttach}
              onInspect={onInspect}
              onPost={onPost}
            />
          ))}
        </div>
      )}
    </div>
  );
}
