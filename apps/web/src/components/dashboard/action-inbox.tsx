"use client";

/**
 * §main-dashboard-redesign P4 / §dashboard-shifan-fidelity P-fid2 — ActionInbox
 *
 * 정본: docs/plans/PLAN_dashboard-shifan-adopt.md + 시안 dashboard.jsx(.task 행 구성)
 *
 * 시안 정합: 행 = 아이콘 + (제목 + 상태 배지) + 설명 + meta(건수) + 액션 버튼.
 *   count>0 항목만 렌더(dead button 0). empty "처리할 항목 없음" 정직.
 *   §11.302 신호등(yellow, amber 금지). 행 전체 클릭 라우팅(버튼=동일 href 시각 강조, 중첩 interactive 0).
 *
 * presentational — items 는 page 가 canonical 우선순위 derive 후 주입.
 */

import { Inbox, ChevronRight, CheckCircle2, AlertTriangle, AlertCircle, Clock } from "lucide-react";

export type ActionTone = "danger" | "warn" | "info" | "ok";

export interface ActionInboxItem {
  id: string;
  /** 행 제목. */
  label: string;
  /** 건수(0이면 호출측이 제외 — 여기선 받은 항목만 렌더). meta 로 노출. */
  count: number;
  href: string;
  tone: ActionTone;
  /** 보조 설명(선택). */
  detail?: string;
  /** 액션 버튼 라벨(시안 정합, 예: "재고 처리"·"검토하기"). 기본 "처리하기". */
  cta?: string;
}

export interface ActionInboxProps {
  items: ActionInboxItem[];
}

// §11.302 신호등 — tone → 아이콘/배지(yellow, amber 금지).
const TONE_ICON_BG: Record<ActionTone, string> = {
  danger: "bg-red-50 text-red-600",
  warn: "bg-yellow-50 text-yellow-600",
  info: "bg-blue-50 text-blue-600",
  ok: "bg-emerald-50 text-emerald-600",
};
const TONE_PILL: Record<ActionTone, string> = {
  danger: "bg-red-100 text-red-700",
  warn: "bg-yellow-100 text-yellow-700",
  info: "bg-blue-100 text-blue-700",
  ok: "bg-emerald-100 text-emerald-700",
};
const TONE_PILL_LABEL: Record<ActionTone, string> = {
  danger: "긴급",
  warn: "검토 필요",
  info: "확인 필요",
  ok: "정상",
};
const TONE_ICON: Record<ActionTone, typeof AlertTriangle> = {
  danger: AlertTriangle,
  warn: AlertCircle,
  info: Clock,
  ok: CheckCircle2,
};

export function ActionInbox({ items }: ActionInboxProps) {
  const actionable = items.filter((it) => it.count > 0);

  if (actionable.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-center gap-2.5">
        <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
        <p className="text-[13px] text-slate-600 break-keep">처리할 항목 없음 — 즉시 조치가 필요한 작업이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-slate-100">
        <Inbox className="h-3.5 w-3.5 text-slate-500" />
        <h2 className="text-[13px] font-bold text-slate-900">
          오늘 처리해야 할 일 <span className="text-slate-400 font-semibold">· {actionable.length}건</span>
        </h2>
      </div>
      <ul className="divide-y divide-slate-100">
        {actionable.map((it) => {
          const Icon = TONE_ICON[it.tone];
          return (
            <li key={it.id}>
              <a
                href={it.href}
                className="group flex items-start gap-3 px-4 py-3.5 min-h-[44px] hover:bg-slate-50 transition-colors"
              >
                <span className={`mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${TONE_ICON_BG[it.tone]}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-bold text-slate-900 break-keep">{it.label}</p>
                    <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold flex-shrink-0 ${TONE_PILL[it.tone]}`}>
                      {TONE_PILL_LABEL[it.tone]}
                    </span>
                  </div>
                  {it.detail && <p className="text-[12px] text-slate-500 break-keep mt-0.5 leading-snug">{it.detail}</p>}
                  <p className="text-[11px] text-slate-400 tabular-nums mt-1">{it.count}건</p>
                </div>
                {/* 시안 정합 — 행 우측 액션 버튼(시각). 행 전체가 href 라 중첩 interactive 0, dead button 0. */}
                <span className="self-center inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 h-9 text-[12px] font-semibold text-white flex-shrink-0 group-hover:bg-blue-700 transition-colors">
                  {it.cta ?? "처리하기"}
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
