"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useOpsStore } from "@/lib/ops-console/ops-store";
import {
  buildModuleHeaderStats,
  buildModulePriorityQueue,
  buildModuleLandingItems,
  buildModuleBuckets,
  buildModuleDownstream,
  MODULE_ORIENTATION,
  MODULE_HEADER_STAT_META,
  BUCKET_COLORS,
  type ModuleBucketKey,
  type ModuleLandingItem,
} from "@/lib/ops-console/module-landing-adapter";
import {
  ChevronRight,
  ArrowRight,
  AlertCircle,
  Clock,
  Zap,
  Shield,
} from "lucide-react";
import { buildDetailHref } from "@/lib/ops-console/navigation-context";

// ── Bucket tab config (Receiving-specific labels) ─────────────────
const RCV_BUCKET_TABS: { key: ModuleBucketKey; label: string }[] = [
  { key: "ready", label: "반영 가능" },
  { key: "needs_review", label: "검수/문서" },
  { key: "blocked", label: "차단" },
  { key: "waiting_external", label: "격리/후속" },
];

// ── Priority badge color ──────────────────────────────────────────
const PRIORITY_DOT: Record<string, string> = {
  p0: "bg-red-500",
  p1: "bg-amber-500",
  p2: "bg-blue-500",
  p3: "bg-slate-500",
};

// ── Stat key → filter mapping ─────────────────────────────────────
const STAT_FILTER_MAP: Record<string, string> = {
  openActionable: "all",
  blocked: "blocked",
  overdue: "overdue",
  waitingExternal: "waiting_external",
  readyToExecute: "ready",
};

// ── Component ─────────────────────────────────────────────────────
export default function ReceivingLandingPage() {
  const router = useRouter();
  const { unifiedInboxItems } = useOpsStore();
  const [activeTab, setActiveTab] = useState<ModuleBucketKey>("ready");

  // Header stats
  const headerStats = useMemo(
    () => buildModuleHeaderStats(unifiedInboxItems, "receiving"),
    [unifiedInboxItems],
  );

  // Priority queue (top 6)
  const priorityQueue = useMemo(
    () => buildModulePriorityQueue(unifiedInboxItems, "receiving", 6),
    [unifiedInboxItems],
  );

  // All landing items → buckets
  const allItems = useMemo(
    () => buildModuleLandingItems(unifiedInboxItems, "receiving"),
    [unifiedInboxItems],
  );

  const buckets = useMemo(() => buildModuleBuckets(allItems), [allItems]);

  // Downstream handoff
  const downstream = useMemo(
    () => buildModuleDownstream("receiving", unifiedInboxItems),
    [unifiedInboxItems],
  );

  // Active bucket items
  const activeBucketItems = buckets[activeTab] ?? [];

  // Bucket counts for tab badges
  const bucketCounts = useMemo(() => {
    const counts: Record<ModuleBucketKey, number> = {
      ready: 0,
      blocked: 0,
      needs_review: 0,
      waiting_external: 0,
      handoff: 0,
    };
    for (const item of allItems) {
      counts[item.bucketKey]++;
    }
    return counts;
  }, [allItems]);

  const orientation = MODULE_ORIENTATION.receiving;
  const isEmpty = allItems.length === 0;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 space-y-5">
      {/* ── 1. Header ──────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-900">입고 관리</h1>
            <p className="text-xs text-slate-600 mt-0.5">{orientation.role}</p>
          </div>
          <p className="text-xs text-slate-500 max-w-xs text-right">
            {headerStats.nextActionSummary}
          </p>
        </div>

        {/* Stat pills */}
        <div className="flex flex-wrap gap-2 mt-3">
          {(
            Object.keys(MODULE_HEADER_STAT_META) as Array<
              keyof typeof MODULE_HEADER_STAT_META
            >
          ).map((key) => {
            const value = headerStats[key];
            const meta = MODULE_HEADER_STAT_META[key];
            const filterKey = STAT_FILTER_MAP[key] ?? key;
            return (
              <Link
                key={key}
                href={`/dashboard/inbox?module=receiving&filter=${filterKey}`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-100 border border-slate-200 text-xs hover:border-slate-300 transition-colors"
              >
                <span className="text-slate-600">{meta.label}</span>
                <span className="font-mono font-medium text-slate-700 tabular-nums">
                  {value}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── Fallback: Empty ────────────────────────────────────────── */}
      {isEmpty && (
        <div className="bg-white border border-slate-200 rounded-lg p-8 text-center">
          <p className="text-sm text-slate-600">
            현재 처리 중인 입고가 없습니다 — 발주에서 입고 예정을 확인하세요
          </p>
          <Link
            href="/dashboard/purchase-orders"
            className="inline-flex items-center gap-1 mt-3 text-xs text-blue-600 hover:text-blue-700"
          >
            발주 관리로 이동 <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}

      {!isEmpty && (
        <>
          {/* ── 2. Priority Queue ───────────────────────────────────── */}
          {priorityQueue.length > 0 && (
            <div>
              <h2 className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">
                우선 처리
              </h2>
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                {priorityQueue.map((item) => (
                  <PriorityCard
                    key={item.entityId}
                    item={item}
                    onClick={() => router.push(buildDetailHref(item.targetRoute, { type: 'list', route: '/dashboard/receiving', summary: item.title, returnLabel: '입고 목록으로' }))}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── 3. State-Split Tabs ────────────────────────────────── */}
          <div>
            <h2 className="text-xs font-medium uppercase tracking-wider text-slate-600 mb-2">
              상태별 분류
            </h2>
            <div className="flex gap-1 border-b border-slate-200 mb-3">
              {RCV_BUCKET_TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                    activeTab === tab.key
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-slate-600 hover:text-slate-700"
                  }`}
                >
                  {tab.label}
                  {bucketCounts[tab.key] > 0 && (
                    <span className="ml-1.5 tabular-nums text-slate-500">
                      {bucketCounts[tab.key]}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* ── 4. Actionable Queue (bucket items) ───────────────── */}
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              {activeBucketItems.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-slate-600">
                  이 분류에 해당하는 항목이 없습니다
                </div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {activeBucketItems.map((item) => (
                    <ActionableRow
                      key={item.entityId}
                      item={item}
                      onClick={() =>
                        router.push(
                          `/dashboard/receiving/${item.entityId}`,
                        )
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── 5. Downstream ──────────────────────────────────────── */}
          {downstream.length > 0 && (
            <div>
              <h2 className="text-xs font-medium uppercase tracking-wider text-slate-600 mb-2">
                다운스트림 인계
              </h2>
              <div className="grid gap-2 md:grid-cols-2">
                {downstream.map((ds) => (
                  <Link
                    key={ds.label}
                    href={ds.targetRoute}
                    className="bg-white border border-slate-200 rounded-lg p-3 hover:border-slate-300 transition-colors group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-700">
                        {ds.label}
                      </span>
                      <span className="text-xs font-mono text-emerald-600 tabular-nums">
                        {ds.count}건
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {ds.description}
                    </p>
                    <div className="flex items-center gap-1 mt-2 text-xs text-slate-600 group-hover:text-slate-700 transition-colors">
                      이동 <ArrowRight className="h-3 w-3" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Priority Card ─────────────────────────────────────────────────
function PriorityCard({
  item,
  onClick,
}: {
  item: ModuleLandingItem;
  onClick: () => void;
}) {
  const borderClass = item.dueState.isOverdue
    ? "border-l-red-500"
    : item.blockerSummary
      ? "border-l-amber-500"
      : "border-l-slate-700";

  return (
    <button
      onClick={onClick}
      className={`text-left bg-white border border-slate-200 border-l-2 ${borderClass} rounded-lg p-3 hover:bg-slate-50 transition-colors w-full`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span
          className={`h-1.5 w-1.5 rounded-full ${PRIORITY_DOT[item.priority] ?? PRIORITY_DOT.p3}`}
        />
        <span className="text-xs font-mono text-slate-700 truncate">
          {item.title}
        </span>
      </div>
      <p className="text-xs text-slate-600 line-clamp-1">{item.summary}</p>
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-2">
          {item.currentOwnerName && (
            <span className="text-xs text-slate-600">
              {item.currentOwnerName}
            </span>
          )}
          <DueStateBadge dueState={item.dueState} />
        </div>
        {item.blockerSummary && (
          <span className="text-xs text-red-600 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            차단
          </span>
        )}
        {item.readySummary && !item.blockerSummary && (
          <span className="text-xs text-emerald-600 flex items-center gap-1">
            <Zap className="h-3 w-3" />
            실행 가능
          </span>
        )}
      </div>
    </button>
  );
}

// ── Actionable Row ────────────────────────────────────────────────
function ActionableRow({
  item,
  onClick,
}: {
  item: ModuleLandingItem;
  onClick: () => void;
}) {
  const borderClass = item.dueState.isOverdue
    ? "border-l-2 border-l-red-500"
    : item.blockerSummary
      ? "border-l-2 border-l-amber-500"
      : "";

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-2.5 hover:bg-slate-100 transition-colors flex items-center gap-3 ${borderClass}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${PRIORITY_DOT[item.priority] ?? PRIORITY_DOT.p3}`}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-900 font-mono truncate">
            {item.title}
          </span>
          <span
            className={`text-xs px-1.5 py-0.5 rounded ${BUCKET_COLORS[item.bucketKey]}`}
          >
            {item.nextAction}
          </span>
        </div>
        <p className="text-xs text-slate-600 truncate mt-0.5">
          {item.summary}
        </p>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        {item.currentOwnerName && (
          <span className="text-xs text-slate-600">
            {item.currentOwnerName}
          </span>
        )}
        <DueStateBadge dueState={item.dueState} />
        <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
      </div>
    </button>
  );
}

// ── Due State Badge ───────────────────────────────────────────────
function DueStateBadge({
  dueState,
}: {
  dueState: ModuleLandingItem["dueState"];
}) {
  if (dueState.tone === "normal") return null;

  const cls =
    dueState.tone === "overdue"
      ? "text-red-600"
      : "text-amber-600";

  return (
    <span className={`text-xs flex items-center gap-0.5 ${cls}`}>
      <Clock className="h-3 w-3" />
      {dueState.label}
    </span>
  );
}
