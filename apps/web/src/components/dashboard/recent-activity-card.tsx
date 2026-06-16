"use client";

/**
 * §dashboard-shifan-fidelity P-fid1 — RecentActivity (시안 side-col 하단 카드)
 *
 * 정본: 시안 dashboard.jsx RecentActivity(.act-card) — 헤더 "최근 활동" + 활동 로그 링크 +
 *   정직 empty("아직 활동이 없습니다"). 별도 거대 3상태 패널 폐지 → 우측 side-col 컴팩트 카드.
 *
 * 정직성: 실 활동 피드 미연동 → empty 상태만(가짜 피드 0). items 주입 시 노출 가능(확장 지점).
 */

import Link from "next/link";
import { Activity, ChevronRight } from "lucide-react";

export interface RecentActivityItem {
  id: string;
  title: string;
  time: string;
  href: string;
}

export interface RecentActivityCardProps {
  /** 실 활동 항목(없으면 정직 empty). */
  items?: RecentActivityItem[];
}

export function RecentActivityCard({ items = [] }: RecentActivityCardProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
        <div className="flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-slate-500" />
          <h2 className="text-[13px] font-bold text-slate-900">최근 활동</h2>
        </div>
        <Link
          href="/dashboard/activity-logs"
          className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-slate-500 hover:text-blue-600 transition-colors"
        >
          활동 로그
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 px-6 py-8 text-center">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-50">
            <Activity className="h-4 w-4 text-slate-300" />
          </span>
          <p className="text-[12px] text-slate-400 break-keep leading-relaxed">
            아직 활동이 없습니다.
            <br />첫 견적 요청이나 예산 등록부터 시작해 보세요.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.slice(0, 5).map((it) => (
            <li key={it.id}>
              <Link
                href={it.href}
                className="flex items-center gap-3 px-4 py-2.5 min-h-[44px] hover:bg-slate-50 transition-colors group"
              >
                <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-slate-300" />
                <p className="min-w-0 flex-1 text-[12px] font-medium text-slate-700 truncate group-hover:text-blue-600">{it.title}</p>
                <span className="text-[10px] text-slate-400 flex-shrink-0 tabular-nums">{it.time}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
