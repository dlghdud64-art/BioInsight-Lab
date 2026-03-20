"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useOpsStore } from "@/lib/ops-console/ops-store";
import {
  buildTodayHeaderStats,
  buildTopPriorityQueue,
  buildOwnerWorkloads,
  buildBlockerSection,
  buildReadyActions,
  buildRecoveryEntries,
  HEADER_STAT_META,
  DASHBOARD_ITEM_TYPE_LABELS,
  type DashboardItem,
  type TodayHeaderStats,
} from "@/lib/ops-console/dashboard-adapter";

// ---------------------------------------------------------------------------
// Priority badge color
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

// ---------------------------------------------------------------------------
// Left border for risk indicator
// ---------------------------------------------------------------------------

function riskBorder(item: DashboardItem): string {
  if (item.dueState.isOverdue) return "border-l-2 border-l-red-500";
  if (item.blockerSummary) return "border-l-2 border-l-amber-500";
  return "border-l-2 border-l-slate-700";
}

// ---------------------------------------------------------------------------
// Section header
// ---------------------------------------------------------------------------

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <h2 className="text-xs font-medium uppercase tracking-wider text-slate-500">
        {title}
      </h2>
      <span className="text-xs text-slate-600">({count})</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat color
// ---------------------------------------------------------------------------

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
      return "text-slate-300";
    default:
      return "text-slate-300";
  }
}

// ===========================================================================
// Page
// ===========================================================================

export default function DashboardPage() {
  const { unifiedInboxItems, graph } = useOpsStore();

  // A. Header stats
  const headerStats = useMemo(
    () => buildTodayHeaderStats(unifiedInboxItems),
    [unifiedInboxItems],
  );

  // B. Top priority queue
  const topQueue = useMemo(
    () => buildTopPriorityQueue(unifiedInboxItems, 8),
    [unifiedInboxItems],
  );

  // C. Owner workloads
  const ownerWorkloads = useMemo(
    () => buildOwnerWorkloads(unifiedInboxItems),
    [unifiedInboxItems],
  );

  // D. Blocker section
  const blockers = useMemo(
    () => buildBlockerSection(unifiedInboxItems),
    [unifiedInboxItems],
  );

  // E. Ready actions
  const readyActions = useMemo(
    () => buildReadyActions(unifiedInboxItems),
    [unifiedInboxItems],
  );

  // F. Recovery entries
  const recoveryEntries = useMemo(
    () => buildRecoveryEntries(graph),
    [graph],
  );

  // Fallback states
  const hasNoItems = unifiedInboxItems.length === 0;
  const onlyWaiting =
    !hasNoItems &&
    headerStats.waitingExternalCount === unifiedInboxItems.length;
  const noMyWork =
    !hasNoItems && headerStats.myWorkCount === 0 && headerStats.teamWorkCount > 0;

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-6 space-y-6">
      {/* ---- A. Today Operating Header ---- */}
      <div>
        <h1 className="text-sm font-semibold text-slate-200 mb-2">
          Today Operating Hub
        </h1>
        <div className="flex flex-wrap gap-x-4 gap-y-1 bg-slate-900 border border-slate-800 rounded px-4 py-2">
          {(Object.keys(HEADER_STAT_META) as (keyof TodayHeaderStats)[]).map(
            (key) => (
              <Link
                key={key}
                href={HEADER_STAT_META[key].route}
                className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
              >
                <span className="text-[11px] text-slate-500">
                  {HEADER_STAT_META[key].label}
                </span>
                <span className={`text-sm font-semibold tabular-nums ${statColor(key)}`}>
                  {headerStats[key]}
                </span>
              </Link>
            ),
          )}
        </div>
      </div>

      {/* ---- Fallback states ---- */}
      {hasNoItems && (
        <div className="bg-slate-900 border border-slate-800 rounded p-6 text-center">
          <p className="text-slate-400 text-sm">
            현재 처리할 작업이 없습니다
          </p>
          <Link
            href="/dashboard/inbox"
            className="text-blue-400 text-xs hover:underline mt-2 inline-block"
          >
            인박스 보기
          </Link>
        </div>
      )}

      {onlyWaiting && (
        <div className="bg-slate-900 border border-amber-800/40 rounded p-4">
          <p className="text-amber-400 text-sm font-medium">
            외부 대기 항목만 있습니다
          </p>
          <p className="text-slate-500 text-xs mt-1">
            공급사 응답 또는 확인을 기다리는 중입니다. 주기적으로 확인하세요.
          </p>
        </div>
      )}

      {noMyWork && (
        <div className="bg-slate-900 border border-slate-800 rounded p-4">
          <p className="text-slate-400 text-sm">
            내 작업 없음 —{" "}
            <Link
              href="/dashboard/inbox?filter=team"
              className="text-blue-400 hover:underline"
            >
              팀 작업 확인
            </Link>
          </p>
        </div>
      )}

      {/* ---- B. Top Priority Queue ---- */}
      {topQueue.length > 0 && (
        <section>
          <SectionHeader title="최우선 처리" count={topQueue.length} />
          <div className="space-y-1">
            {topQueue.map((item) => (
              <Link
                key={item.entityId}
                href={item.nextRoute}
                className={`block bg-slate-900 border border-slate-800 rounded px-3 py-2 hover:bg-slate-800/70 transition-colors ${riskBorder(item)}`}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded border ${priorityColor(item.priority)}`}
                  >
                    {priorityLabel(item.priority)}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {DASHBOARD_ITEM_TYPE_LABELS[item.itemType]}
                  </span>
                  <span className="text-sm text-slate-100 font-medium truncate">
                    {item.title}
                  </span>
                  {item.currentOwnerName && (
                    <span className="text-[10px] text-slate-500 ml-auto shrink-0">
                      {item.currentOwnerName}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs">
                  <span
                    className={
                      item.dueState.isOverdue
                        ? "text-red-400"
                        : item.dueState.tone === "due_soon"
                          ? "text-amber-400"
                          : "text-slate-500"
                    }
                  >
                    {item.dueState.label}
                  </span>
                  {item.blockerSummary && (
                    <span className="text-red-400/80">{item.blockerSummary}</span>
                  )}
                  {item.readySummary && (
                    <span className="text-emerald-400/80">{item.readySummary}</span>
                  )}
                  <span className="text-slate-500 ml-auto shrink-0">
                    {item.nextAction}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ---- C. Owner Load / Responsibility View ---- */}
      {ownerWorkloads.length > 0 && (
        <section>
          <SectionHeader title="담당 업무 현황" count={ownerWorkloads.length} />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {ownerWorkloads.map((ow) => (
              <Link
                key={ow.ownerName}
                href={`/dashboard/inbox?owner=${encodeURIComponent(ow.ownerName)}`}
                className="bg-slate-900 border border-slate-800 rounded px-3 py-2 hover:bg-slate-800/70 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-100 font-medium">
                    {ow.ownerName}
                  </span>
                  {ow.ownerName === "미배정" && (
                    <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                      경고
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs">
                  <span className="text-slate-400">
                    열린 {ow.openCount}
                  </span>
                  {ow.blockedCount > 0 && (
                    <span className="text-red-400">차단 {ow.blockedCount}</span>
                  )}
                  {ow.overdueCount > 0 && (
                    <span className="text-red-400">초과 {ow.overdueCount}</span>
                  )}
                </div>
                {ow.nextCriticalItem && (
                  <div className="mt-1.5 text-xs text-slate-500 truncate">
                    다음:{" "}
                    <span className="text-slate-400">
                      {ow.nextCriticalItem.title}
                    </span>
                  </div>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ---- D. Blockers / Review / External Wait ---- */}
      {(blockers.resolveFirst.length > 0 ||
        blockers.reviewRequired.length > 0 ||
        blockers.waitingExternal.length > 0 ||
        blockers.escalationNeeded.length > 0) && (
        <section>
          <SectionHeader
            title="차단 · 검토 · 대기"
            count={
              blockers.resolveFirst.length +
              blockers.reviewRequired.length +
              blockers.waitingExternal.length +
              blockers.escalationNeeded.length
            }
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Escalation */}
            {blockers.escalationNeeded.length > 0 && (
              <div className="bg-red-950/30 border border-red-800/40 rounded p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <h3 className="text-xs font-medium text-red-400 uppercase tracking-wider">
                    에스컬레이션 필요
                  </h3>
                  <span className="text-xs text-red-500">
                    {blockers.escalationNeeded.length}
                  </span>
                </div>
                {blockers.escalationNeeded.slice(0, 3).map((item) => (
                  <Link
                    key={item.entityId}
                    href={item.nextRoute}
                    className="block text-xs text-red-300 hover:text-red-200 py-0.5 truncate"
                  >
                    {item.title} — {item.nextAction}
                  </Link>
                ))}
                {blockers.escalationNeeded.length > 3 && (
                  <Link
                    href="/dashboard/inbox?filter=blocked"
                    className="text-[10px] text-red-500 hover:underline mt-1 inline-block"
                  >
                    전체 보기
                  </Link>
                )}
              </div>
            )}

            {/* Resolve first */}
            {blockers.resolveFirst.length > 0 && (
              <div className="bg-red-950/20 border border-red-900/30 rounded p-3">
                <h3 className="text-xs font-medium text-red-400 uppercase tracking-wider mb-2">
                  차단 해소 필요
                  <span className="ml-2 text-red-500">
                    {blockers.resolveFirst.length}
                  </span>
                </h3>
                {blockers.resolveFirst.slice(0, 3).map((item) => (
                  <Link
                    key={item.entityId}
                    href={item.nextRoute}
                    className="block text-xs text-red-300/80 hover:text-red-200 py-0.5 truncate"
                  >
                    {item.title} — {item.blockerSummary}
                  </Link>
                ))}
                {blockers.resolveFirst.length > 3 && (
                  <Link
                    href="/dashboard/inbox?filter=blocked"
                    className="text-[10px] text-red-500 hover:underline mt-1 inline-block"
                  >
                    전체 보기
                  </Link>
                )}
              </div>
            )}

            {/* Review required */}
            {blockers.reviewRequired.length > 0 && (
              <div className="bg-amber-950/20 border border-amber-900/30 rounded p-3">
                <h3 className="text-xs font-medium text-amber-400 uppercase tracking-wider mb-2">
                  검토 필요
                  <span className="ml-2 text-amber-500">
                    {blockers.reviewRequired.length}
                  </span>
                </h3>
                {blockers.reviewRequired.slice(0, 3).map((item) => (
                  <Link
                    key={item.entityId}
                    href={item.nextRoute}
                    className="block text-xs text-amber-300/80 hover:text-amber-200 py-0.5 truncate"
                  >
                    {item.title} — {item.nextAction}
                  </Link>
                ))}
                {blockers.reviewRequired.length > 3 && (
                  <Link
                    href="/dashboard/inbox?filter=needs_review"
                    className="text-[10px] text-amber-500 hover:underline mt-1 inline-block"
                  >
                    전체 보기
                  </Link>
                )}
              </div>
            )}

            {/* Waiting external */}
            {blockers.waitingExternal.length > 0 && (
              <div className="bg-blue-950/20 border border-blue-900/30 rounded p-3">
                <h3 className="text-xs font-medium text-blue-400 uppercase tracking-wider mb-2">
                  외부 대기
                  <span className="ml-2 text-blue-500">
                    {blockers.waitingExternal.length}
                  </span>
                </h3>
                {blockers.waitingExternal.slice(0, 3).map((item) => (
                  <Link
                    key={item.entityId}
                    href={item.nextRoute}
                    className="block text-xs text-blue-300/80 hover:text-blue-200 py-0.5 truncate"
                  >
                    {item.title} — {item.waitingExternalLabel}
                  </Link>
                ))}
                {blockers.waitingExternal.length > 3 && (
                  <Link
                    href="/dashboard/inbox?filter=waiting_external"
                    className="text-[10px] text-blue-500 hover:underline mt-1 inline-block"
                  >
                    전체 보기
                  </Link>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ---- E. Ready-to-Execute Surface ---- */}
      {readyActions.length > 0 && (
        <section>
          <SectionHeader title="즉시 실행 가능" count={readyActions.length} />
          <div className="space-y-1">
            {readyActions.map((ra) => (
              <Link
                key={ra.entityId}
                href={ra.nextRoute}
                className="block bg-slate-900 border border-emerald-900/30 rounded px-3 py-2 hover:bg-slate-800/70 transition-colors border-l-2 border-l-emerald-500"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-100 font-medium truncate">
                    {ra.title}
                  </span>
                  {ra.ownerName && (
                    <span className="text-[10px] text-slate-500 ml-auto shrink-0">
                      {ra.ownerName}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs">
                  <span className="text-emerald-400/80">{ra.whyReady}</span>
                  <span className="text-slate-500">{ra.nextAction}</span>
                  <span className="text-slate-600 ml-auto shrink-0">
                    → {ra.handoffTarget}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ---- F. Recovery / Re-entry Surface ---- */}
      {recoveryEntries.length > 0 && (
        <section>
          <SectionHeader title="재진입 필요" count={recoveryEntries.length} />
          <div className="space-y-1">
            {recoveryEntries.map((re) => (
              <Link
                key={re.entityId}
                href={re.entryHref}
                className="block bg-slate-900/60 border border-slate-700 rounded px-3 py-2 hover:bg-slate-800/50 transition-colors border-l-2 border-l-violet-500"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-200 font-medium truncate">
                    {re.sourceContext}
                  </span>
                  {re.nextOwner && (
                    <span className="text-[10px] text-slate-500 ml-auto shrink-0">
                      → {re.nextOwner}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs">
                  <span className="text-violet-400/80">{re.whyReentry}</span>
                  <span className="text-slate-500">
                    {re.recommendedEntryPath}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
