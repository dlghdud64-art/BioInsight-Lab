"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
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
import { MobileOperationalBriefSheet } from "@/components/operational-brief/mobile-bottom-sheet";
import { OperationalBriefFloatingEntry } from "@/components/operational-brief/floating-entry";
import { MetricCell } from "@/components/operational-brief/metric-cell";
import { formatRelativeKr } from "@/components/operational-brief/relative-time";
import { invalidateBriefNarrative, useOperationalBriefNarrative } from "@/lib/hooks/use-operational-brief";
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
import {
  buildInboxItemOwnership,
  OWNER_FILTER_OPTIONS,
  ASSIGNMENT_STATE_LABELS,
  ASSIGNMENT_STATE_TONES,
  type OwnerFilterKey,
} from "@/lib/ops-console/ownership-adapter";
import { OwnershipBadge } from "../_components/ownership-display";
import { buildInboxItemBlockers } from "@/lib/ops-console/blocker-adapter";
import { InboxBlockerBadge } from "../_components/blocker-display";
import {
  SEVERITY_LABELS,
  SEVERITY_DOT_COLORS,
  RESOLUTION_ACTION_LABELS,
} from "@/lib/ops-console/blocker-adapter";
import {
  buildManualSearchReentryContext,
  buildReentryCommand,
  SOURCE_TYPE_LABELS,
  type ReentrySourceType,
} from "@/lib/ops-console/reentry-context";
import {
  buildDetailHref,
} from "@/lib/ops-console/navigation-context";

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
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const store = useOpsStore();

  // Initialize state from URL searchParams
  const [moduleFilter, setModuleFilter] = useState<string>(
    searchParams.get("filter_module") || "all",
  );
  const [stateFilter, setStateFilter] = useState<string>(
    searchParams.get("filter_state") || "all",
  );
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilterKey>(
    (searchParams.get("filter_owner") as OwnerFilterKey) || "all",
  );
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set(),
  );

  // Sync filter state → URL searchParams
  useEffect(() => {
    const params = new URLSearchParams();
    if (moduleFilter !== "all") params.set("filter_module", moduleFilter);
    if (stateFilter !== "all") params.set("filter_state", stateFilter);
    if (ownerFilter !== "all") params.set("filter_owner", ownerFilter);
    const qs = params.toString();
    const newUrl = qs ? `${pathname}?${qs}` : pathname;
    router.replace(newUrl, { scroll: false });
  }, [moduleFilter, stateFilter, ownerFilter, pathname, router]);

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

  // Compute ownership for all items
  const itemsWithOwnership = useMemo(
    () =>
      allItems.map((item) => ({
        ...item,
        ownershipSummary: buildInboxItemOwnership(item),
      })) as Array<UnifiedInboxItem & { ownershipSummary: any }>,
    [allItems],
  );

  // Filtered items
  const filteredItems = useMemo(() => {
    let result = filterByModule(itemsWithOwnership as UnifiedInboxItem[], moduleFilter);
    result = filterByState(result, stateFilter);
    // Owner filter
    if (ownerFilter !== "all") {
      const stateMap: Record<string, string[]> = {
        my_work: ["owned_by_me"],
        team_work: ["owned_by_team"],
        unassigned: ["unassigned"],
        waiting_external: ["waiting_external"],
        escalated: ["escalated", "blocked_by_role"],
        approval_owned: ["awaiting_approval", "awaiting_internal_review"],
      };
      const states = stateMap[ownerFilter];
      if (states) {
        result = result.filter((i: any) =>
          states.includes(i.ownershipSummary?.assignmentState),
        );
      }
    }
    return sortInboxItems(result);
  }, [itemsWithOwnership, moduleFilter, stateFilter, ownerFilter]);

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

  // §11.175 — deep-link focus handler (dashboard/floating entry → priority hydrate).
  // ?auto_open=p0 또는 ?auto_open=1 → filteredItems 첫 행을 operator review focus로 엽니다 (sortInboxItems
  // 가 이미 priority desc 로 정렬하므로 [0] 이 가장 시급 항목).
  // 1회성 (URL param consume 후 router.replace 로 제거).
  const autoOpenParam = searchParams.get("auto_open");
  useEffect(() => {
    if (!autoOpenParam) return;
    if (selectedItemId) return; // 이미 열려 있으면 skip
    if (filteredItems.length === 0) return;
    const target = filteredItems[0];
    setSelectedItemId(target.id ?? null);
    // consume URL param (back/refresh 시 중복 hydrate 방지)
    const params = new URLSearchParams(searchParams.toString());
    params.delete("auto_open");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [autoOpenParam, filteredItems, selectedItemId, pathname, router, searchParams]);

  // §11.181 — handleFloatingEntryClick 제거: FAB default 가 popup 호출.
  // §11.175 의 deep-link focus handler 만 유지 (외부 링크 호환성).

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
    setOwnerFilter("all");
  }, []);

  // Execute action on selected item via quick action adapter
  const handleAction = useCallback(
    (item: UnifiedInboxItem) => {
      const quickAction = buildInboxQuickAction(item, store);
      if (quickAction && !quickAction.requiresDetail && quickAction.onExecute) {
        quickAction.onExecute();
        // §11.158 cache-bust — quickAction 실행 후 inbox + work_queue brief stale
        invalidateBriefNarrative({ workQueueTaskId: item.id, module: "inbox", sourceUpdatedAt: new Date() });
        invalidateBriefNarrative({ workQueueTaskId: item.id, module: "work_queue", sourceUpdatedAt: new Date() });
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

  const hasActiveFilters = moduleFilter !== "all" || stateFilter !== "all" || ownerFilter !== "all";

  return (
    <div className="p-4 md:p-8 pt-4 md:pt-6 max-w-[1400px] mx-auto w-full">
      {/* ── 헤더 ── */}
      <div className="mb-5">
        <h1 className="text-xl md:text-2xl font-bold text-slate-900">
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
            color: "text-slate-600",
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
                  : "bg-el text-slate-400 hover:text-slate-600",
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
                  : "bg-el text-slate-400 hover:text-slate-600",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-bd mx-1 hidden md:block" />

        {/* Owner pills */}
        <div className="flex items-center gap-1">
          {OWNER_FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setOwnerFilter(opt.key)}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
                ownerFilter === opt.key
                  ? "bg-teal-500/20 text-teal-400"
                  : "bg-el text-slate-400 hover:text-slate-600",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            className="ml-auto flex items-center gap-1 text-xs text-slate-500 hover:text-slate-600 transition-colors"
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
                      items.map((item) => {
                        const detailHref = buildDetailHref(item.entityRoute, {
                          type: 'inbox',
                          route: `${pathname}${searchParams.toString() ? '?' + searchParams.toString() : ''}`,
                          summary: item.title,
                          returnLabel: '작업함으로',
                        });
                        return (
                          <InboxRow
                            key={item.id}
                            item={item}
                            isSelected={selectedItemId === item.id}
                            onClick={() => setSelectedItemId(item.id)}
                            onNavigate={() => router.push(detailHref)}
                          />
                        );
                      })}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── 컨텍스트 패널 (desktop only, hidden lg:block 내부) ── */}
        {selectedItem && (
          <ContextPanel
            item={selectedItem}
            onClose={() => setSelectedItemId(null)}
            onAction={() => handleAction(selectedItem)}
            onNavigate={() => router.push(selectedItem.entityRoute)}
            quickAction={buildInboxQuickAction(selectedItem, store)}
          />
        )}

        {/* §11.155 모바일 변종 — desktop ContextPanel (hidden lg:block) 와 mutually exclusive */}
        {selectedItem && (() => {
          const qa = buildInboxQuickAction(selectedItem, store);
          return (
            <MobileOperationalBriefSheet
              open={!!selectedItem}
              onClose={() => setSelectedItemId(null)}
              objectLabel="선택한 작업"
              chips={[
                { id: "summary", label: "상태 요약" },
                { id: "facts",   label: "차단 사유" },
                { id: "risks",   label: "위험도" },
                { id: "next",    label: "다음 단계" },
              ]}
              summary={<p className="text-xs text-slate-700 leading-relaxed">{selectedItem.summary}</p>}
              facts={
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-slate-400">우선순위</span><span className="font-medium">{PRIORITY_LABEL[selectedItem.priority]}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">기한</span><span>{selectedItem.dueState.label}</span></div>
                  {selectedItem.owner && <div className="flex justify-between"><span className="text-slate-400">담당자</span><span>{selectedItem.owner}</span></div>}
                </div>
              }
              risks={
                selectedItem.riskBadges.length > 0
                  ? <div className="flex flex-wrap gap-1">{selectedItem.riskBadges.map((b) => <span key={b} className="text-[11px] px-2 py-0.5 rounded bg-red-50 text-red-700">{b}</span>)}</div>
                  : <p className="text-xs text-slate-500">차단 없음</p>
              }
              next={<p className="text-xs text-slate-700">{selectedItem.nextAction}</p>}
              primaryCta={qa && qa.canExecute ? {
                label: qa.label,
                onClick: () => handleAction(selectedItem),
              } : qa ? {
                label: qa.label,
                onClick: () => router.push(qa.detailRoute ?? selectedItem.entityRoute),
              } : undefined}
            />
          );
        })()}
      </div>

      {/* §11.181 — 운영 브리핑 floating entry (default = popup open) */}
      <OperationalBriefFloatingEntry controls="operational-brief-popup" />
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
  item: UnifiedInboxItem & { ownershipSummary?: ReturnType<typeof buildInboxItemOwnership> };
  isSelected: boolean;
  onClick: () => void;
  onNavigate: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "grid grid-cols-1 md:grid-cols-[auto_1fr_auto_auto_auto_auto_auto_auto] gap-2 px-4 py-3 border-b border-bs last:border-b-0 cursor-pointer transition-colors items-center",
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

      {/* Owner badge */}
      <div className="hidden md:flex items-center">
        {item.ownershipSummary && (
          <OwnershipBadge ownership={item.ownershipSummary} />
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
          className="text-slate-500 hover:text-slate-600 transition-colors p-0.5"
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

  // §11.161 — 운영 브리핑 narrative hook
  const { narrative: briefNarrative, cached: briefCached } = useOperationalBriefNarrative({
    sourceTrace: {
      workQueueTaskId: item.id,
      module: "inbox",
      sourceUpdatedAt: item.updatedAt ?? new Date(0),
    },
    facts: {
      status: WORK_TYPE_LABELS[item.workType] ?? item.workType,
      blocker: item.riskBadges.length > 0 ? item.riskBadges.join(", ") : "차단 없음",
      nextAction: item.nextAction ?? null,
    },
    enabled: !!item.id,
  });

  // §11.175 — LAST UPDATED relative time (deterministic, no external dep)
  const lastUpdatedLabel = formatRelativeKr(item.updatedAt ?? null);
  const blockerCount = buildInboxItemBlockers(item).length;

  return (
    <div className="hidden lg:block w-[560px] flex-shrink-0 bg-pn border-l border-bd sticky top-0 self-start max-h-[calc(100vh-120px)] overflow-y-auto">
      {/* §11.175 — eyebrow + module label + work object id + LAST UPDATED + close X */}
      <div className="px-6 py-5 border-b border-bd bg-el/20">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-blue-700">
              운영 브리핑
            </span>
            <span
              className={cn(
                "inline-flex px-2 py-0.5 rounded text-[11px] font-medium",
                SOURCE_MODULE_COLORS[item.sourceModule],
              )}
            >
              {WORK_TYPE_LABELS[item.workType]}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded transition-colors"
            aria-label="브리핑 닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <h3 className="text-2xl font-bold text-slate-900 leading-tight">
          {item.title}
        </h3>
        {lastUpdatedLabel && (
          <div className="mt-2 text-[11px] text-slate-500 uppercase tracking-wide">
            <span className="font-semibold">LAST UPDATED</span> · {lastUpdatedLabel}
          </div>
        )}
      </div>

      {/* §11.145 4 preset chips — anchor jump */}
      <div className="px-6 py-3 border-b border-bd/50 flex flex-wrap gap-1.5">
        {[
          { id: "summary", label: "상태 요약" },
          { id: "facts",   label: "핵심 근거" },
          { id: "risks",   label: "리스크" },
          { id: "next",    label: "다음 단계" },
        ].map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              const el = document.getElementById(`brief-${c.id}`);
              if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors"
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="p-6 space-y-6">

        {/* § 1. 상황 요약 — text-base + leading-relaxed (§11.175 density-up) */}
        <section id="brief-summary" className="scroll-mt-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 mb-2">
            상황 요약
          </div>
          <div className="rounded-lg border-l-4 border-blue-500 bg-slate-50 p-4">
            <p className="text-base text-slate-800 leading-relaxed">
              {briefNarrative ?? item.summary}
            </p>
            {briefCached && (
              <span className="mt-1 inline-block text-[10px] text-slate-400">· 캐시</span>
            )}
          </div>
        </section>

        {/* § 2. 핵심 근거 — 2x2 metric grid + text-3xl 수치 (§11.175) */}
        <section id="brief-facts" className="scroll-mt-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 mb-2">
            RESOLVER 판별 근거
          </div>
          <div className="grid grid-cols-2 gap-3">
            <MetricCell label="우선순위" value={PRIORITY_LABEL[item.priority]} tone={item.priority === "p0" ? "danger" : item.priority === "p1" ? "warn" : "neutral"} />
            <MetricCell label="기한" value={item.dueState.label} tone={item.dueState.tone === "overdue" ? "danger" : item.dueState.tone === "due_soon" ? "warn" : "neutral"} />
            <MetricCell label="담당자" value={item.owner ?? "미할당"} tone="neutral" />
            <MetricCell label="차단 상태" value={blockerCount === 0 ? "없음" : `${blockerCount}건`} tone={blockerCount === 0 ? "ok" : "danger"} />
          </div>
        </section>

        {/* Owner + Assignment State (보조 metadata) */}
        <div className="text-xs space-y-1.5">
          {(() => {
            const ownerSummary = buildInboxItemOwnership(item);
            return (
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded px-2 py-0.5 text-[11px] font-medium bg-slate-800 ${ASSIGNMENT_STATE_TONES[ownerSummary.assignmentState]}`}>
                  {ASSIGNMENT_STATE_LABELS[ownerSummary.assignmentState]}
                </span>
                {ownerSummary.waitingExternalLabel && (
                  <span className="text-[11px] text-purple-600">⏳ {ownerSummary.waitingExternalLabel}</span>
                )}
                {ownerSummary.slaState === 'escalation_required' && ownerSummary.escalationOwnerName && (
                  <span className="text-[11px] text-red-600">에스컬레이션 → {ownerSummary.escalationOwnerName}</span>
                )}
              </div>
            );
          })()}
        </div>

        {/* § 3. 리스크 — amber alert tone (§11.175) */}
        <section id="brief-risks" className="scroll-mt-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 mb-2">
            리스크 식별
          </div>
        {(() => {
          const blockers = buildInboxItemBlockers(item);
          if (blockers.length === 0) {
            return (
              <p className="text-sm text-slate-500">차단 없음</p>
            );
          }
          return (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-semibold text-amber-900">
                  차단 사유 ({blockers.length}건)
                </span>
              </div>
              {blockers.map((b) => (
                <div key={b.summaryKey} className="space-y-1">
                  <div className="flex items-center gap-2 text-sm">
                    <span className={`w-1.5 h-1.5 rounded-full ${SEVERITY_DOT_COLORS[b.severity]} shrink-0`} />
                    <span className="text-slate-800">{b.whyBlocked}</span>
                  </div>
                  <div className="pl-3.5 text-xs space-y-0.5">
                    <p className="text-blue-700">→ {b.whatCanResolveIt}</p>
                    <p className="text-slate-500">
                      {SEVERITY_LABELS[b.severity]} · {b.recommendedResolutionLabel}
                    </p>
                    {b.canPartiallyContinue && b.partialContinuationLabel && (
                      <p className="text-emerald-700">▸ {b.partialContinuationLabel}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          );
        })()}

        {/* Risk badges */}
        {item.riskBadges.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {item.riskBadges.map((badge) => (
              <span
                key={badge}
                className="inline-flex px-2 py-0.5 rounded text-[11px] font-medium bg-red-500/10 text-red-600"
              >
                {badge}
              </span>
            ))}
          </div>
        )}
        </section>

        {/* § 4. 다음 조치 — next action + CTA */}
        <section id="brief-next" className="scroll-mt-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 mb-2">
            다음 조치
          </div>
          <p className="text-sm text-blue-700 font-medium">{item.nextAction}</p>
        </section>

        {/* Action buttons */}
        <div className="space-y-2 pt-2">
          {actionLabel && canExecuteAction && (
            <Button
              className="w-full h-11 text-sm"
              onClick={onAction}
            >
              {actionLabel}
            </Button>
          )}
          {actionLabel && !canExecuteAction && quickAction?.requiresDetail && (
            <Button
              variant="outline"
              className="w-full h-11 text-sm gap-1.5"
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
            className="w-full h-11 text-sm gap-1.5"
            onClick={onNavigate}
          >
            <ExternalLink className="h-4 w-4" />
            상세 페이지 이동
          </Button>
        </div>
      </div>
    </div>
  );
}

/* §11.176 — MetricCell + formatRelativeKr 는 shared 모듈로 이동 (inbox 가 먼저 정의했지만 multi-surface 재사용) */

// Quick action labels now provided by buildInboxQuickAction adapter
