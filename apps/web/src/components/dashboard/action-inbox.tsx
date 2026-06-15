"use client";

/**
 * §main-dashboard-redesign P4 — ActionInbox (가장 먼저 처리 + 다음 작업 통합)
 *
 * 정본: docs/plans/PLAN_main-dashboard-redesign.md (P4 중단 모듈)
 *
 * 현행 "가장 먼저 처리"(우선 1건) + "다음 작업"(보조 N건)을 단일 통합 인박스로.
 *   max-h-[412px] 내부 스크롤, 행 클릭 라우팅, empty "처리할 항목 없음"(정직).
 *   §11.302 신호등 톤(위험 red / 주의 yellow / 정보 blue / 정상 emerald).
 *
 * presentational — items 는 page 가 canonical 우선순위 derive 후 주입(별도 탑재).
 *   page 미배선(고립 빌드). dead button 0(빈 항목은 행 미렌더, empty 상태만).
 */

import { Inbox, ChevronRight, CheckCircle2 } from "lucide-react";

export type ActionTone = "danger" | "warn" | "info" | "ok";

export interface ActionInboxItem {
  id: string;
  label: string;
  /** 건수(0이면 호출측이 제외 — 여기선 받은 항목만 렌더). */
  count: number;
  href: string;
  tone: ActionTone;
  /** 보조 설명(선택). */
  detail?: string;
}

export interface ActionInboxProps {
  items: ActionInboxItem[];
}

const toneDot: Record<ActionTone, string> = {
  danger: "bg-red-600",
  warn: "bg-yellow-500",
  info: "bg-blue-600",
  ok: "bg-emerald-500",
};
const toneCount: Record<ActionTone, string> = {
  danger: "text-red-700",
  warn: "text-yellow-700",
  info: "text-blue-700",
  ok: "text-emerald-700",
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
      <ul className="max-h-[412px] overflow-y-auto divide-y divide-slate-50">
        {actionable.map((it) => (
          <li key={it.id}>
            <a
              href={it.href}
              className="flex items-center gap-3 px-4 py-3 min-h-[44px] hover:bg-slate-50 transition-colors"
            >
              <span className={`relative flex h-2 w-2 flex-shrink-0`}>
                <span className={`inline-flex h-2 w-2 rounded-full ${toneDot[it.tone]}`} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-slate-900 break-keep">{it.label}</p>
                {it.detail && <p className="text-[11px] text-slate-500 break-keep">{it.detail}</p>}
              </div>
              <span className={`text-sm font-bold tabular-nums flex-shrink-0 ${toneCount[it.tone]}`}>
                {it.count}건
              </span>
              <ChevronRight className="h-4 w-4 text-slate-300 flex-shrink-0" aria-hidden />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
