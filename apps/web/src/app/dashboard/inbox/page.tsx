"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useOpsStore } from "@/lib/ops-console/ops-store";
import {
  buildFullInbox,
  calculateSummaryStats,
  filterByModule,
  filterByState,
  sortInboxItems,
  TRIAGE_GROUP_META,
  MODULE_FILTER_OPTIONS,
  STATE_FILTER_OPTIONS,
  WORK_TYPE_LABELS,
  SOURCE_MODULE_COLORS,
  type UnifiedInboxItem,
  type InboxTriageGroup,
  type InboxSummaryStats,
} from "@/lib/ops-console/inbox-adapter";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Inbox,
  RotateCcw,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildInboxQuickAction } from "@/lib/ops-console/command-adapters";
import type { InboxQuickAction } from "@/lib/ops-console/action-model";

// ── Priority badge 색상 ──
const PRIORITY_BADGE: Record<string, string> = {
  p0: "bg-red-500/10 text-red-400",
  p1: "bg-amber-500/10 text-amber-400",
  p2: "bg-blue-500/10 text-blue-400",
  p3: "bg-zinc-500/10 text-zinc-400",
};

const PRIORITY_LABEL: Record<string, string> = {
  p0: "P0",
  p1: "P1",
  p2: "P2",
  p3: "P3",
};

// ── Due badge 색상 ──
const DUE_BADGE: Record<string, string> = {
  overdue: "bg-red-500/10 text-red-400",
  due_soon: "bg-amber-500/10 text-amber-400",
  normal: "bg-zinc-500/10 text-zinc-400",
};

// ── 컴포넌트 ──

export default function InboxPage() {
  const router = useRouter();
  const store = useOpsStore();

  // State
  const [moduleFilter, setModuleFilter] = useState<string>("all");
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set(),
  );

  // Build unified inbox from store data
  const allItems = useMemo(
    () =>
      buildFullInbox(
        store.quoteRequests,
        store.quoteResponses,
        store.quoteComparisons,
        store.purchaseOrders,
        store.approvalExecutions,
        store.acknowledgements,
        store.receivingBatches,
        store.stockPositions,
        store.reorderRecommendations,
        store.expiryActions,
      ),
    [
      store.quoteRequests,
      store.quoteResponses,
      store.quoteComparisons,
      store.purchaseOrders,
      store.approvalExecutions,
      store.acknowledgements,
      store.receivingBatches,
      store.stockPositions,
      store.reorderRecommendations,
      store.expiryActions,
    ],
  );

  // Summary stats (from all items, before filtering)
  const stats: InboxSummaryStats = useMemo(
    () => calculateSummaryStats(allItems),
    [allItems],
  );

  // Filtered items
  const filteredItems = useMemo(() => {
    let result = filterByModule(allItems, moduleFilter);
    result = filterByState(result, stateFilter);
    return sortInboxItems(result);
  }, [allItems, moduleFilter, stateFilter]);

  // Group items by triageGroup
  const groupedItems = useMemo(() => {
    const groups = new Map<InboxTriageGroup, UnifiedInboxItem[]>();
    for (const item of filteredItems) {
      const existing = groups.get(item.triageGroup) ?? [];
      existing.push(item);
      groups.set(item.triageGroup, existing);
    }
    // Sort groups by order
    const sorted = [...groups.entries()].sort(
      ([a], [b]) =>
        TRIAGE_GROUP_META[a].order - TRIAGE_GROUP_META[b].order,
    );
    return sorted;
  }, [filteredItems]);

  // Selected item
  const selectedItem = useMemo(
    () =>
      selectedItemId
        ? allItems.find((i) => i.id === selectedItemId) ?? null
        : null,
    [allItems, selectedItemId],
  );

  // Toggle group collapse
  const toggleGroup = useCallback((group: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  }, []);

  // Summary badge click handlers
  const handleStatClick = useCallback(
    (filterKey: string) => {
      if (filterKey === "blocker") {
        setStateFilter("blocked");
        setModuleFilter("all");
      } else if (filterKey === "overdue") {
        setStateFilter("all");
        setModuleFilter("all");
        // For overdue we stay on "all" but items naturally sort overdue first
      } else if (filterKey === "review") {
        setStateFilter("needs_review");
        setModuleFilter("all");
      } else if (filterKey === "execute") {
        setStateFilter("now");
        setModuleFilter("all");
      } else {
        setStateFilter("all");
        setModuleFilter("all");
      }
    },
    [],
  );

  // Reset filters
  const resetFilters = useCallback(() => {
    setModuleFilter("all");
    setStateFilter("all");
  }, []);

  // Execute action on selected item via quick action adapter
  const handleAction = useCallback(
    (item: UnifiedInboxItem) => {
      const quickAction = buildInboxQuickAction(item, store);
      if (quickAction && !quickAction.requiresDetail && quickAction.onExecute) {
        quickAction.onExecute();
        store.refreshInbox();
        setSelectedItemId(null);
      } else if (quickAction?.requiresDetail && quickAction.detailRoute) {
        router.push(quickAction.detailRoute);
      } else {
        router.push(item.entityRoute);
      }
    },
    [store, router],
  );

  const hasActiveFilters = moduleFilter !== "all" || stateFilter !== "all";

  return (
    <div className="p-4 md:p-8 pt-4 md:pt-6 max-w-[1400px] mx-auto w-full">
      {/* ── 헤더 ── */}
      <div className="mb-5">
        <h1 className="text-xl md:text-2xl font-bold text-slate-100">
          운영 작업함
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          견적, 승인, 입고, 재고 위험을 우선순위대로 처리합니다
        </p>
      </div>

      {/* ── 요약 바 ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
        {[
          {
            key: "total",
            label: "처리 대기",
            count: stats.totalOpen,
            color: "text-slate-300",
          },
          {
            key: "blocker",
            label: "차단",
            count: stats.blockerCount,
            color: "text-red-400",
          },
          {
            key: "overdue",
            label: "기한 초과",
            count: stats.overdueCount,
            color: "text-amber-400",
          },
          {
            key: "review",
            label: "검토 필요",
            count: stats.reviewRequiredCount,
            color: "text-blue-400",
          },
          {
            key: "execute",
            label: "실행 가능",
            count: stats.readyToExecuteCount,
            color: "text-emerald-400",
          },
        ].map(({ key, label, count, color }) => (
          <button
            key={key}
            onClick={() => handleStatClick(key)}
            className={cn(
              "bg-pn rounded-lg border border-bd px-3 py-3 text-left transition-colors hover:bg-el cursor-pointer",
              (key === "blocker" && stateFilter === "blocked") ||
                (key === "review" && stateFilter === "needs_review") ||
                (key === "execute" && stateFilter === "now")
                ? "ring-1 ring-blue-500/50"
                : "",
            )}
          >
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-0.5">
              {label}
            </p>
            <p className={cn("text-xl font-bold", color)}>{count}</p>
          </button>
        ))}
      </div>

      {/* ── 필터 바 ── */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {/* Module pills */}
        <div className="flex items-center gap-1">
          {MODULE_FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setModuleFilter(opt.key)}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
                moduleFilter === opt.key
                  ? "bg-blue-500/20 text-blue-400"
                  : "bg-el text-slate-400 hover:text-slate-300",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-bd mx-1 hidden md:block" />

        {/* State pills */}
        <div className="flex items-center gap-1">
          {STATE_FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setStateFilter(opt.key)}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
                stateFilter === opt.key
                  ? "bg-blue-500/20 text-blue-400"
                  : "bg-el text-slate-400 hover:text-slate-300",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            className="ml-auto flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            <RotateCcw className="h-3 w-3" />
            필터 초기화
          </button>
        )}
      </div>

      {/* ── 메인 레이아웃: 큐 + 컨텍스트 패널 ── */}
      <div className="flex gap-0">
        {/* ── 작업 큐 ── */}
        <div
          className={cn(
            "flex-1 min-w-0",
            selectedItem ? "pr-0" : "",
          )}
        >
          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-3 bg-pn rounded-lg border border-bd">
              <Inbox className="h-10 w-10 opacity-25" />
              <p className="text-sm">
                {hasActiveFilters
                  ? "현재 조건에 맞는 작업이 없습니다"
                  : "현재 바로 처리해야 할 운영 항목이 없습니다"}
              </p>
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={resetFilters}
                >
                  필터 초기화
                </Button>
              )}
            </div>
          ) : (
            <div className="border border-bd rounded-lg overflow-hidden">
              {groupedItems.map(([group, items]) => {
                const meta = TRIAGE_GROUP_META[group];
                const isCollapsed = collapsedGroups.has(group);

                return (
                  <div key={group}>
                    {/* Group header */}
                    <button
                      onClick={() => toggleGroup(group)}
                      className="w-full flex items-center gap-2 px-4 py-2 bg-el border-b border-bs cursor-pointer hover:bg-el/80 transition-colors"
                    >
                      {isCollapsed ? (
                        <ChevronRight className="h-3.5 w-3.5 text-zinc-500" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
                      )}
                      <span className="text-zinc-400 uppercase text-xs font-medium tracking-wider">
                        {meta.label}
                      </span>
                      <span className="text-[11px] font-medium text-zinc-500 bg-zinc-800 rounded-full px-1.5 py-0.5">
                        {items.length}
                      </span>
                    </button>

                    {/* Items */}
                    {!isCollapsed &&
                      items.map((item) => (
                        <InboxRow
                          key={item.id}
                          item={item}
                          isSelected={selectedItemId === item.id}
                          onClick={() => setSelectedItemId(item.id)}
                          onNavigate={() => router.push(item.entityRoute)}
                        />
                      ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── 컨텍스트 패널 ── */}
        {selectedItem && (
          <ContextPanel
            item={selectedItem}
            onClose={() => setSelectedItemId(null)}
            onAction={() => handleAction(selectedItem)}
            onNavigate={() => router.push(selectedItem.entityRoute)}
            quickAction={buildInboxQuickAction(selectedItem, store)}
          />
        )}
      </div>
    </div>
  );
}

// ── InboxRow ──

function InboxRow({
  item,
  isSelected,
  onClick,
  onNavigate,
}: {
  item: UnifiedInboxItem;
  isSelected: boolean;
  onClick: () => void;
  onNavigate: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "grid grid-cols-1 md:grid-cols-[auto_1fr_auto_auto_auto_auto] gap-2 px-4 py-3 border-b border-bs last:border-b-0 cursor-pointer transition-colors items-center",
        isSelected ? "bg-el ring-1 ring-blue-500/30" : "bg-pn hover:bg-el",
      )}
    >
      {/* workType badge */}
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "inline-flex px-2 py-0.5 rounded text-[11px] font-medium whitespace-nowrap",
            SOURCE_MODULE_COLORS[item.sourceModule],
          )}
        >
          {WORK_TYPE_LABELS[item.workType]}
        </span>
      </div>

      {/* Title + summary */}
      <div className="min-w-0">
        <p className="text-sm text-st font-medium truncate">{item.title}</p>
        <p className="text-xs text-slate-500 truncate mt-0.5">
          {item.summary}
        </p>
        {/* Mobile-only extras */}
        <div className="flex items-center gap-2 mt-1 md:hidden">
          <span
            className={cn(
              "inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium",
              PRIORITY_BADGE[item.priority],
            )}
          >
            {PRIORITY_LABEL[item.priority]}
          </span>
          <span
            className={cn(
              "inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium",
              DUE_BADGE[item.dueState.tone],
            )}
          >
            {item.dueState.label}
          </span>
          {item.owner && (
            <span className="text-[10px] text-slate-500">{item.owner}</span>
          )}
        </div>
      </div>

      {/* Priority badge */}
      <div className="hidden md:flex items-center">
        <span
          className={cn(
            "inline-flex px-2 py-0.5 rounded text-[11px] font-medium",
            PRIORITY_BADGE[item.priority],
          )}
        >
          {PRIORITY_LABEL[item.priority]}
        </span>
      </div>

      {/* Due badge */}
      <div className="hidden md:flex items-center">
        <span
          className={cn(
            "inline-flex px-2 py-0.5 rounded text-[11px] font-medium whitespace-nowrap",
            DUE_BADGE[item.dueState.tone],
          )}
        >
          {item.dueState.label}
        </span>
      </div>

      {/* Risk badges */}
      <div className="hidden md:flex items-center gap-1">
        {item.riskBadges.slice(0, 2).map((badge) => (
          <span
            key={badge}
            className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-500/10 text-red-400 whitespace-nowrap"
          >
            {badge}
          </span>
        ))}
        {item.riskBadges.length > 2 && (
          <span className="text-[10px] text-slate-500">
            +{item.riskBadges.length - 2}
          </span>
        )}
      </div>

      {/* Next action + navigate */}
      <div className="hidden md:flex items-center gap-2">
        <span className="text-xs text-blue-400 whitespace-nowrap truncate max-w-[120px]">
          {item.nextAction}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNavigate();
          }}
          className="text-slate-500 hover:text-slate-300 transition-colors p-0.5"
          title="상세 페이지 이동"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── Context Panel ──

function ContextPanel({
  item,
  onClose,
  onAction,
  onNavigate,
  quickAction,
}: {
  item: UnifiedInboxItem;
  onClose: () => void;
  onAction: () => void;
  onNavigate: () => void;
  quickAction: InboxQuickAction | null;
}) {
  const actionLabel = quickAction?.label ?? null;
  const canExecuteAction = quickAction ? quickAction.canExecute && !quickAction.requiresDetail : false;

  return (
    <div className="hidden lg:block w-[320px] flex-shrink-0 bg-pn border-l border-bd sticky top-0 self-start max-h-[calc(100vh-120px)] overflow-y-auto">
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <span
              className={cn(
                "inline-flex px-2 py-0.5 rounded text-[11px] font-medium mb-2",
                SOURCE_MODULE_COLORS[item.sourceModule],
              )}
            >
              {WORK_TYPE_LABELS[item.workType]}
            </span>
            <h3 className="text-sm font-semibold text-st mt-1">
              {item.title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 p-0.5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Summary */}
        <p className="text-xs text-slate-400 leading-relaxed">
          {item.summary}
        </p>

        {/* Priority + Due */}
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex px-2 py-0.5 rounded text-[11px] font-medium",
              PRIORITY_BADGE[item.priority],
            )}
          >
            {PRIORITY_LABEL[item.priority]}
          </span>
          <span
            className={cn(
              "inline-flex px-2 py-0.5 rounded text-[11px] font-medium",
              DUE_BADGE[item.dueState.tone],
            )}
          >
            {item.dueState.label}
          </span>
        </div>

        {/* Owner */}
        {item.owner && (
          <div className="text-xs">
            <span className="text-slate-500">담당자: </span>
            <span className="text-slate-300">{item.owner}</span>
          </div>
        )}

        {/* Blocker details */}
        {item.blockedReason && (
          <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
              <span className="text-xs font-medium text-red-400">
                차단 사유
              </span>
            </div>
            <p className="text-xs text-red-400/80 leading-relaxed">
              {item.blockedReason}
            </p>
          </div>
        )}

        {/* Risk badges */}
        {item.riskBadges.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {item.riskBadges.map((badge) => (
              <span
                key={badge}
                className="inline-flex px-2 py-0.5 rounded text-[11px] font-medium bg-red-500/10 text-red-400"
              >
                {badge}
              </span>
            ))}
          </div>
        )}

        {/* Next action */}
        <div className="text-xs">
          <span className="text-slate-500">다음 조치: </span>
          <span className="text-blue-400">{item.nextAction}</span>
        </div>

        {/* Action buttons */}
        <div className="space-y-2 pt-2">
          {actionLabel && canExecuteAction && (
            <Button
              size="sm"
              className="w-full text-xs"
              onClick={onAction}
            >
              {actionLabel}
            </Button>
          )}
          {actionLabel && !canExecuteAction && quickAction?.requiresDetail && (
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs gap-1.5"
              onClick={() => {
                if (quickAction.detailRoute) {
                  window.location.href = quickAction.detailRoute;
                } else {
                  onNavigate();
                }
              }}
            >
              {actionLabel}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs gap-1.5"
            onClick={onNavigate}
          >
            <ExternalLink className="h-3 w-3" />
            상세 페이지 이동
          </Button>
        </div>
      </div>
    </div>
  );
}

// Quick action labels now provided by buildInboxQuickAction adapter
