"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useOpsStoreSafe } from "@/lib/ops-console/ops-store";
import {
  buildTodayHeaderStats,
  buildTopPriorityQueue,
  buildBlockerSection,
  HEADER_STAT_META,
  DASHBOARD_ITEM_TYPE_LABELS,
  type DashboardItem,
  type TodayHeaderStats,
} from "@/lib/ops-console/dashboard-adapter";
import { buildDetailHref } from "@/lib/ops-console/navigation-context";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function priorityColor(p: string): string {
  if (p === "p0") return "bg-red-500/20 text-red-400 border-red-500/30";
  if (p === "p1") return "bg-amber-500/20 text-amber-400 border-amber-500/30";
  return "bg-blue-500/20 text-blue-400 border-blue-500/30";
}

function priorityLabel(p: string): string {
  if (p === "p0") return "P0";
  if (p === "p1") return "P1";
  return "P2";
}

function riskBorder(item: DashboardItem): string {
  if (item.dueState.isOverdue) return "border-l-2 border-l-red-500";
  if (item.blockerSummary) return "border-l-2 border-l-amber-500";
  return "border-l-2 border-l-slate-700";
}

function statColor(key: keyof TodayHeaderStats): string {
  switch (key) {
    case "blockedCount":
    case "overdueCount":
      return "text-red-400";
    case "waitingExternalCount":
      return "text-amber-400";
    case "readyToExecuteCount":
      return "text-emerald-400";
    case "totalActionable":
      return "text-blue-400";
    case "myWorkCount":
      return "text-blue-300";
    case "teamWorkCount":
      return "text-slate-600";
    default:
      return "text-slate-600";
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * TodayHubStrip — compact operational hub block.
 * dashboard 상단에 진입 허브로만 표시. 기존 dashboard를 대체하지 않음.
 */
export function TodayHubStrip() {
  const store = useOpsStoreSafe();
  const unifiedInboxItems = store?.unifiedInboxItems ?? [];

  const headerStats = useMemo(
    () => buildTodayHeaderStats(unifiedInboxItems),
    [unifiedInboxItems],
  );

  const topQueue = useMemo(
    () => buildTopPriorityQueue(unifiedInboxItems, 4),
    [unifiedInboxItems],
  );

  const blockers = useMemo(
    () => buildBlockerSection(unifiedInboxItems),
    [unifiedInboxItems],
  );

  const hasNoItems = unifiedInboxItems.length === 0;
  const blockerTotal =
    blockers.resolveFirst.length +
    blockers.escalationNeeded.length;

  if (hasNoItems) return null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 space-y-2">
      {/* Header stats strip */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold text-slate-600 shrink-0">
          운영 현황
        </span>
        <span className="text-slate-700">|</span>
        {(Object.keys(HEADER_STAT_META) as (keyof TodayHeaderStats)[]).map(
          (key) => (
            <Link
              key={key}
              href={HEADER_STAT_META[key].route}
              className="flex items-center gap-1 hover:opacity-80 transition-opacity"
            >
              <span className="text-[10px] text-slate-500">
                {HEADER_STAT_META[key].label}
              </span>
              <span className={`text-xs font-semibold tabular-nums ${statColor(key)}`}>
                {headerStats[key]}
              </span>
            </Link>
          ),
        )}
        {blockerTotal > 0 && (
          <Link
            href="/dashboard/inbox?filter_state=blocked"
            className="ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 shrink-0"
          >
            차단 {blockerTotal}
          </Link>
        )}
      </div>

      {/* Top priority items (compact, max 4) */}
      {topQueue.length > 0 && (
        <div className="flex flex-col gap-0.5">
          {topQueue.map((item) => (
            <Link
              key={item.entityId}
              href={buildDetailHref(item.nextRoute, {
                type: "dashboard",
                route: "/dashboard",
                summary: item.title,
                returnLabel: "오늘로",
              })}
              className={`flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-800/70 transition-colors text-xs ${riskBorder(item)}`}
            >
              <span
                className={`inline-flex text-[9px] font-semibold px-1 py-0.5 rounded border ${priorityColor(item.priority)}`}
              >
                {priorityLabel(item.priority)}
              </span>
              <span className="text-[10px] text-slate-500">
                {DASHBOARD_ITEM_TYPE_LABELS[item.itemType]}
              </span>
              <span className="text-slate-700 font-medium truncate">
                {item.title}
              </span>
              <span className="text-slate-500 ml-auto shrink-0 text-[10px]">
                {item.nextAction}
              </span>
            </Link>
          ))}
          {unifiedInboxItems.length > 4 && (
            <Link
              href="/dashboard/inbox"
              className="text-[10px] text-blue-400 hover:underline px-2 pt-0.5"
            >
              전체 {unifiedInboxItems.length}건 보기 →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
