"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  ShieldAlert,
  Zap,
  Hourglass,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { useOpsStore } from "@/lib/ops-console/ops-store";
import {
  buildModuleHeaderStats,
  buildModulePriorityQueue,
  buildModuleLandingItems,
  buildModuleBuckets,
  buildModuleDownstream,
  MODULE_ORIENTATION,
  BUCKET_COLORS,
  MODULE_HEADER_STAT_META,
  type ModuleLandingItem,
  type ModuleBucketKey,
} from "@/lib/ops-console/module-landing-adapter";
import { cn } from "@/lib/utils";

// ── bucket tab 설정 ──
const BUCKET_TABS: { key: ModuleBucketKey; label: string }[] = [
  { key: "ready", label: "선택 가능" },
  { key: "needs_review", label: "검토 필요" },
  { key: "waiting_external", label: "공급사 대기" },
  { key: "handoff", label: "PO 전환" },
];

// ── priority badge ──
const PRIORITY_CLASSES: Record<string, string> = {
  p0: "bg-red-500/20 text-red-300 ring-1 ring-red-500/30",
  p1: "bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/30",
  p2: "bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/30",
  p3: "bg-slate-500/20 text-slate-400 ring-1 ring-slate-500/30",
};

// ── due state border ──
function riskBorder(item: ModuleLandingItem): string {
  if (item.dueState.isOverdue) return "border-l-2 border-l-red-500";
  if (item.blockerSummary) return "border-l-2 border-l-amber-500";
  return "border-l-2 border-l-transparent";
}

// ── stat filter keys ──
const STAT_FILTER_KEYS: (keyof Omit<
  ReturnType<typeof buildModuleHeaderStats>,
  "nextActionSummary"
>)[] = ["openActionable", "blocked", "overdue", "waitingExternal", "readyToExecute"];

const STAT_ICONS: Record<string, React.ReactNode> = {
  openActionable: <Zap className="h-3.5 w-3.5" />,
  blocked: <ShieldAlert className="h-3.5 w-3.5" />,
  overdue: <AlertTriangle className="h-3.5 w-3.5" />,
  waitingExternal: <Hourglass className="h-3.5 w-3.5" />,
  readyToExecute: <CheckCircle2 className="h-3.5 w-3.5" />,
};

const STAT_TONE: Record<string, string> = {
  openActionable: "text-slate-300",
  blocked: "text-red-400",
  overdue: "text-red-400",
  waitingExternal: "text-blue-400",
  readyToExecute: "text-emerald-400",
};

const STAT_FILTER_MAP: Record<string, string> = {
  openActionable: "all",
  blocked: "blocked",
  overdue: "overdue",
  waitingExternal: "waiting",
  readyToExecute: "ready",
};

export default function QuotesPage() {
  const router = useRouter();
  const { unifiedInboxItems, quoteRequests, quoteResponses } = useOpsStore();
  const [activeTab, setActiveTab] = useState<ModuleBucketKey>("ready");

  // ── A. Header Stats ──
  const headerStats = useMemo(
    () => buildModuleHeaderStats(unifiedInboxItems, "quote"),
    [unifiedInboxItems],
  );

  // ── B. Priority Queue ──
  const priorityQueue = useMemo(
    () => buildModulePriorityQueue(unifiedInboxItems, "quote", 6),
    [unifiedInboxItems],
  );

  // ── C/D. Landing Items + Buckets ──
  const landingItems = useMemo(
    () => buildModuleLandingItems(unifiedInboxItems, "quote"),
    [unifiedInboxItems],
  );
  const buckets = useMemo(() => buildModuleBuckets(landingItems), [landingItems]);

  // ── E. Downstream ──
  const downstream = useMemo(
    () => buildModuleDownstream("quote", unifiedInboxItems),
    [unifiedInboxItems],
  );

  const orientation = MODULE_ORIENTATION.quote;
  const totalItems = landingItems.length;
  const allWaiting =
    totalItems > 0 &&
    landingItems.every((i) => i.bucketKey === "waiting_external");

  // ── Fallback: empty ──
  if (totalItems === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4">
        <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center">
          <Clock className="h-6 w-6 text-slate-500" />
        </div>
        <p className="text-sm text-slate-400 text-center">
          현재 진행 중인 견적이 없습니다 — 검색에서 새 견적 요청을 시작하세요
        </p>
        <Link
          href="/test/search"
          className="text-xs text-blue-400 hover:text-blue-300 underline underline-offset-2"
        >
          검색으로 이동
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto w-full">
      {/* ═══════════════════════════════════════════════════════════
          A. Module Operating Header
          ═══════════════════════════════════════════════════════════ */}
      <div className="space-y-3">
        {/* Title + Orientation */}
        <div>
          <h1 className="text-lg font-semibold text-slate-100">견적 운영 허브</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {orientation.role} &middot; {orientation.stages}
          </p>
        </div>

        {/* Next Action Summary */}
        {headerStats.nextActionSummary && (
          <div className="px-3 py-2 rounded border border-slate-700 bg-slate-900/60">
            <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">
              다음 조치
            </span>
            <p className="text-sm text-slate-200 mt-0.5 font-medium">
              {headerStats.nextActionSummary}
            </p>
          </div>
        )}

        {/* Stat Strip */}
        <div className="grid grid-cols-5 gap-2">
          {STAT_FILTER_KEYS.map((key) => {
            const value = headerStats[key];
            const meta = MODULE_HEADER_STAT_META[key];
            return (
              <Link
                key={key}
                href={`/dashboard/inbox?module=quote&filter=${STAT_FILTER_MAP[key]}`}
                className="flex flex-col gap-1 px-3 py-2 rounded border border-slate-800 bg-slate-900/50 hover:border-slate-600 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span className={STAT_TONE[key]}>{STAT_ICONS[key]}</span>
                  <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                    {meta.label}
                  </span>
                </div>
                <span className={cn("text-xl font-bold", STAT_TONE[key])}>
                  {value}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          B. Priority Queue
          ═══════════════════════════════════════════════════════════ */}
      {priorityQueue.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-medium uppercase tracking-wider text-slate-500">
            우선 처리 큐
          </h2>
          <div className="border border-slate-800 rounded-lg overflow-hidden divide-y divide-slate-800">
            {priorityQueue.map((item) => (
              <div
                key={item.entityId}
                onClick={() => router.push(item.targetRoute)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 hover:bg-slate-800/60 cursor-pointer transition-colors",
                  riskBorder(item),
                )}
              >
                {/* Priority badge */}
                <span
                  className={cn(
                    "text-[10px] font-bold uppercase px-1.5 py-0.5 rounded",
                    PRIORITY_CLASSES[item.priority],
                  )}
                >
                  {item.priority}
                </span>

                {/* Title + summary */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200 font-medium truncate">
                    {item.title}
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {item.blockerSummary || item.readySummary || item.nextAction}
                  </p>
                </div>

                {/* Owner */}
                {item.currentOwnerName && (
                  <span className="text-[10px] text-slate-500 hidden md:block whitespace-nowrap">
                    {item.currentOwnerName}
                  </span>
                )}

                {/* Due state */}
                <span
                  className={cn(
                    "text-[10px] whitespace-nowrap",
                    item.dueState.tone === "overdue"
                      ? "text-red-400"
                      : item.dueState.tone === "due_soon"
                        ? "text-amber-400"
                        : "text-slate-500",
                  )}
                >
                  {item.dueState.label}
                </span>

                <ArrowRight className="h-3.5 w-3.5 text-slate-600 flex-shrink-0" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          C. State-Split Work Surface (tabs)
          ═══════════════════════════════════════════════════════════ */}
      <div className="space-y-2">
        <h2 className="text-xs font-medium uppercase tracking-wider text-slate-500">
          작업 구분
        </h2>

        {/* Tab bar */}
        <div className="flex gap-1 border-b border-slate-800">
          {BUCKET_TABS.map(({ key, label }) => {
            const count = buckets[key].length;
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-t transition-colors",
                  isActive
                    ? "bg-slate-800 text-slate-200 border border-slate-700 border-b-0"
                    : "text-slate-500 hover:text-slate-300",
                )}
              >
                {label}
                <span
                  className={cn(
                    "ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] text-[10px] font-bold rounded-full",
                    isActive ? BUCKET_COLORS[key] : "bg-slate-800 text-slate-500",
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* ═══════════════════════════════════════════════════════════
            D. Actionable Queue (selected bucket items)
            ═══════════════════════════════════════════════════════════ */}
        {allWaiting && activeTab !== "waiting_external" ? (
          <div className="flex flex-col items-center py-10 gap-2 text-slate-500">
            <Hourglass className="h-6 w-6 opacity-40" />
            <p className="text-xs">공급사 응답 대기 중 — 응답 도착 시 알림</p>
          </div>
        ) : buckets[activeTab].length === 0 ? (
          <div className="flex flex-col items-center py-10 gap-2 text-slate-500">
            <CheckCircle2 className="h-5 w-5 opacity-40" />
            <p className="text-xs">이 구간에 항목이 없습니다</p>
          </div>
        ) : (
          <div className="border border-slate-800 rounded-lg overflow-hidden">
            {/* Table header */}
            <div className="hidden md:grid grid-cols-[1fr_120px_90px_100px_160px] gap-2 px-3 py-1.5 bg-slate-900/80 text-[10px] font-medium uppercase tracking-wider text-slate-600 border-b border-slate-800">
              <span>제목</span>
              <span>담당자</span>
              <span>마감</span>
              <span>다음 조치</span>
              <span>상세</span>
            </div>
            {/* Rows */}
            <div className="divide-y divide-slate-800/60">
              {buckets[activeTab].map((item) => (
                <div
                  key={item.entityId}
                  onClick={() => router.push(item.targetRoute)}
                  className={cn(
                    "grid grid-cols-1 md:grid-cols-[1fr_120px_90px_100px_160px] gap-2 px-3 py-2 hover:bg-slate-800/40 cursor-pointer transition-colors items-center",
                    riskBorder(item),
                  )}
                >
                  {/* Title + summary */}
                  <div className="min-w-0">
                    <p className="text-sm text-slate-200 font-medium truncate">
                      {item.title}
                    </p>
                    <p className="text-xs text-slate-500 truncate">{item.summary}</p>
                  </div>

                  {/* Owner */}
                  <span className="text-xs text-slate-400 truncate">
                    {item.currentOwnerName || "미배정"}
                  </span>

                  {/* Due */}
                  <span
                    className={cn(
                      "text-xs",
                      item.dueState.tone === "overdue"
                        ? "text-red-400"
                        : item.dueState.tone === "due_soon"
                          ? "text-amber-400"
                          : "text-slate-500",
                    )}
                  >
                    {item.dueState.label}
                  </span>

                  {/* Next action */}
                  <span className="text-xs text-slate-400 truncate">
                    {item.nextAction}
                  </span>

                  {/* Bucket-specific info */}
                  <span className="text-xs text-slate-500 truncate">
                    {activeTab === "ready" && item.readySummary}
                    {activeTab === "needs_review" && item.reviewSummary}
                    {activeTab === "waiting_external" &&
                      item.waitingExternalLabel}
                    {activeTab === "handoff" && item.nextHandoffLabel}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════
          E. Downstream / Recovery
          ═══════════════════════════════════════════════════════════ */}
      {downstream.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-medium uppercase tracking-wider text-slate-500">
            다운스트림 전환
          </h2>
          <div className="flex gap-3">
            {downstream.map((ds) => (
              <Link
                key={ds.label}
                href={ds.targetRoute}
                className="flex items-center gap-3 px-4 py-3 rounded border border-slate-800 bg-slate-900/50 hover:border-slate-600 transition-colors flex-1"
              >
                <ExternalLink className="h-4 w-4 text-teal-400 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-slate-200 font-medium">
                    {ds.label}{" "}
                    <span className="text-teal-400 font-bold">{ds.count}건</span>
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {ds.description}
                  </p>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-slate-600 flex-shrink-0 ml-auto" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
