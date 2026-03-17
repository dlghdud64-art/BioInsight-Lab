"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  useWorkQueueConsole,
  useSyncOpsQueue,
  useExecuteOpsAction,
  useAssignmentAction,
  useDailyReview,
  useDailyReviewAction,
} from "@/hooks/use-work-queue";
import type { ConsoleGroup, GroupedItem, ConsoleSummary } from "@/lib/work-queue/console-grouping";
import { CONSOLE_VIEW_LABELS, type ConsoleView } from "@/lib/work-queue/console-assignment";
import {
  DAILY_REVIEW_CATEGORY_DEFS,
} from "@/lib/work-queue/console-daily-review";
import type { DailyReviewItem, DailyReviewCategoryId, DailyReviewSurface } from "@/lib/work-queue/console-daily-review";
import {
  CONSOLE_MODE_DEFS,
  CONSOLE_MODE_ORDER,
  type ConsoleMode,
} from "@/lib/work-queue/console-v1-productization";
import { TYPOGRAPHY, SPACING, SURFACE } from "@/lib/work-queue/console-visual-grammar";

// Extracted components
import { ConsoleEmptyState } from "./console/console-empty-state";
import { QueueRow, QueueColumnHeader } from "./console/queue-row";
import { QueueDetailPanel } from "./console/queue-detail-panel";
import { DailyReviewRow, DailyReviewColumnHeader } from "./console/daily-review-row";
import { GovernanceView } from "./console/governance-table";
import { RemediationView } from "./console/remediation-table";

// ── View Tabs ──

const VIEW_ORDER: ConsoleView[] = ["all", "my_work", "unassigned", "team_urgent", "recently_handed_off"];

function ConsoleViewTabs({ view, onViewChange, summary }: {
  view: ConsoleView;
  onViewChange: (v: ConsoleView) => void;
  summary: ConsoleSummary;
}) {
  const viewCounts: Partial<Record<ConsoleView, number>> = {
    my_work: summary.myWorkCount,
    unassigned: summary.unassignedCount,
    team_urgent: summary.urgentCount,
    recently_handed_off: summary.handedOffCount,
  };

  return (
    <div className="flex flex-wrap gap-1 bg-muted/50 rounded-md p-1">
      {VIEW_ORDER.map((v) => (
        <button
          key={v}
          onClick={() => onViewChange(v)}
          className={cn(
            "text-xs px-3 py-1.5 rounded-sm font-medium transition-colors",
            view === v
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {CONSOLE_VIEW_LABELS[v]}
          {viewCounts[v] != null && viewCounts[v]! > 0 && (
            <span className="ml-1 text-[10px] opacity-70">({viewCounts[v]})</span>
          )}
        </button>
      ))}
    </div>
  );
}

// ── Summary Strip ──

function ConsoleSummaryStrip({ summary }: { summary: ConsoleSummary }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-4 border rounded-md", SPACING.stripPadding)}>
      <StripStat label="긴급" count={summary.urgentCount} warn={summary.urgentCount > 0} />
      <StripStat label="승인 대기" count={summary.approvalCount} warn={summary.approvalCount > 0} />
      <StripStat label="내 작업" count={summary.myWorkCount} warn={false} />
      <StripStat label="미배정" count={summary.unassignedCount} warn={summary.unassignedCount > 0} />
      {summary.assignedUntouchedCount != null && summary.assignedUntouchedCount > 0 && (
        <StripStat label="미착수" count={summary.assignedUntouchedCount} warn />
      )}
      {summary.blockedAgingCount != null && summary.blockedAgingCount > 0 && (
        <StripStat label="장기차단" count={summary.blockedAgingCount} warn />
      )}
      <div className="ml-auto flex items-center gap-3">
        <StripStat label="활성" count={summary.totalActive} warn={false} />
        <StripStat label="완료" count={summary.totalResolved} warn={false} />
      </div>
    </div>
  );
}

function StripStat({ label, count, warn }: { label: string; count: number; warn: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={TYPOGRAPHY.metadata}>{label}</span>
      <span className={cn("text-sm font-semibold tabular-nums", warn && count > 0 ? "text-red-600" : "text-foreground")}>
        {count}
      </span>
    </div>
  );
}

// ── Main Console ──

export function WorkQueueConsole() {
  const [mode, setMode] = useState<ConsoleMode>("queue");
  const [view, setView] = useState<ConsoleView>("all");
  const [selectedItem, setSelectedItem] = useState<GroupedItem | null>(null);

  const router = useRouter();
  useSyncOpsQueue();
  const { data, isLoading, error } = useWorkQueueConsole(undefined, view);
  const executeOps = useExecuteOpsAction();
  const assignmentAction = useAssignmentAction();

  const handleCtaClick = (item: GroupedItem) => {
    if (item.primaryCtaActionId) {
      executeOps.mutate({ actionId: item.primaryCtaActionId, itemId: item.id });
    } else {
      navigateToEntity(router, item);
    }
  };

  const handleAssignmentAction = (itemId: string, action: string) => {
    assignmentAction.mutate({ itemId, action });
  };

  const isPending = executeOps.isPending || assignmentAction.isPending;

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <h1 className={TYPOGRAPHY.pageTitle}>운영 콘솔</h1>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>운영 큐 로딩 중...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 space-y-4">
        <h1 className={TYPOGRAPHY.pageTitle}>운영 콘솔</h1>
        <div className="flex items-center gap-2 text-sm text-red-600">
          <XCircle className="h-4 w-4" />
          <span>운영 큐 로딩 실패. 페이지를 새로고침해 주세요.</span>
        </div>
      </div>
    );
  }

  const groups = data?.groups ?? [];
  const summary = data?.summary ?? {
    urgentCount: 0, approvalCount: 0, totalActive: 0, totalResolved: 0,
    myWorkCount: 0, unassignedCount: 0, handedOffCount: 0,
  };

  return (
    <div className="p-6 space-y-4 max-w-5xl">
      {/* Header + Mode Toggle */}
      <div className="flex items-center gap-4">
        <h1 className={TYPOGRAPHY.pageTitle}>운영 콘솔</h1>
        <div className="flex gap-0.5 bg-muted/50 rounded-md p-0.5">
          {CONSOLE_MODE_ORDER.map((m: ConsoleMode) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                "text-xs px-3 py-1 rounded-sm font-medium transition-colors",
                mode === m ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {CONSOLE_MODE_DEFS[m].label}
            </button>
          ))}
        </div>
      </div>

      {/* Mode Content */}
      {mode === "remediation" ? (
        <RemediationView />
      ) : mode === "governance" ? (
        <GovernanceView />
      ) : mode === "daily_review" ? (
        <DailyReviewSection />
      ) : (
        <>
          <ConsoleViewTabs view={view} onViewChange={setView} summary={summary} />
          <ConsoleSummaryStrip summary={summary} />

          {groups.length === 0 ? (
            <ConsoleEmptyState stateId="empty_queue" />
          ) : (
            <div className={SPACING.sectionGap}>
              {groups.map((group: ConsoleGroup) => (
                <ConsoleGroupSection
                  key={group.id}
                  group={group}
                  selectedItem={selectedItem}
                  onSelect={setSelectedItem}
                  onCtaClick={handleCtaClick}
                  isPending={isPending}
                />
              ))}
            </div>
          )}

          {/* Detail Panel */}
          <QueueDetailPanel
            item={selectedItem}
            open={!!selectedItem}
            onOpenChange={(open) => !open && setSelectedItem(null)}
            onCtaClick={handleCtaClick}
            onAssignmentAction={handleAssignmentAction}
            isPending={isPending}
          />
        </>
      )}
    </div>
  );
}

// ── Group Section (row-based) ──

function ConsoleGroupSection({ group, selectedItem, onSelect, onCtaClick, isPending }: {
  group: ConsoleGroup;
  selectedItem: GroupedItem | null;
  onSelect: (item: GroupedItem) => void;
  onCtaClick: (item: GroupedItem) => void;
  isPending: boolean;
}) {
  const [collapsed, setCollapsed] = useState(group.collapsible);

  return (
    <div>
      {/* Section header */}
      <button
        onClick={() => group.collapsible && setCollapsed((c) => !c)}
        className={cn(
          "flex items-center gap-2 w-full text-left",
          SURFACE.sectionHeader,
          "mb-1",
          group.collapsible && "cursor-pointer hover:opacity-80"
        )}
      >
        <h2 className={TYPOGRAPHY.sectionTitle}>{group.label}</h2>
        <Badge variant="secondary" className={TYPOGRAPHY.badge}>{group.items.length}</Badge>
        <span className={cn(TYPOGRAPHY.metadata, "ml-1")}>{group.description}</span>
      </button>

      {!collapsed && (
        <div className={cn(SURFACE.primary, "overflow-hidden")}>
          <QueueColumnHeader />
          <div className={SPACING.groupGap}>
            {group.items.map((item: GroupedItem) => (
              <QueueRow
                key={item.id}
                item={item}
                onSelect={onSelect}
                onCtaClick={onCtaClick}
                isSelected={selectedItem?.id === item.id}
                isPending={isPending}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Daily Review Section ──

const REVIEW_CATEGORY_ORDER: DailyReviewCategoryId[] = [
  "urgent_now", "overdue_owned", "blocked_too_long",
  "handoff_not_accepted", "urgent_unassigned",
  "recently_resolved", "needs_lead_intervention",
];

function DailyReviewSection() {
  const [roleView, setRoleView] = useState<"operator" | "lead">("operator");
  const { data, isLoading, error } = useDailyReview();
  const reviewAction = useDailyReviewAction();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>일일 검토 로딩 중...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-sm text-red-600">
        <XCircle className="h-4 w-4" />
        <span>일일 검토 로딩 실패</span>
      </div>
    );
  }

  const surface = data as DailyReviewSurface | undefined;
  if (!surface) return null;

  const visibleItems = roleView === "lead" ? surface.leadItems : surface.operatorItems;

  const handleEscalation = (actionId: string, itemId: string) => {
    reviewAction.mutate({ itemId, actionType: "escalation", actionId });
  };

  const handleReviewOutcome = (outcomeId: string, itemId: string) => {
    reviewAction.mutate({ itemId, actionType: "review_outcome", actionId: outcomeId });
  };

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className={cn("flex items-center gap-4 border rounded-md", SPACING.stripPadding)}>
        <StripStat label="검토 항목" count={surface.totalCount} warn={false} />
        <StripStat label="이월 항목" count={surface.carryOverCount} warn={surface.carryOverCount > 0} />
        <span className={TYPOGRAPHY.timestamp}>{surface.date}</span>
      </div>

      {/* Role toggle */}
      <div className="flex gap-0.5 bg-muted/50 rounded-md p-0.5 w-fit">
        <button
          onClick={() => setRoleView("operator")}
          className={cn(
            "text-xs px-3 py-1 rounded-sm font-medium transition-colors",
            roleView === "operator" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          운영자 뷰 ({surface.operatorItems.length})
        </button>
        <button
          onClick={() => setRoleView("lead")}
          className={cn(
            "text-xs px-3 py-1 rounded-sm font-medium transition-colors",
            roleView === "lead" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          리드 뷰 ({surface.leadItems.length})
        </button>
      </div>

      {/* Category sections */}
      {visibleItems.length === 0 ? (
        <ConsoleEmptyState stateId="no_daily_review_items" />
      ) : (
        <div className={SPACING.sectionGap}>
          {REVIEW_CATEGORY_ORDER.map((catId) => {
            const categoryItems = visibleItems.filter((ri: DailyReviewItem) => ri.category === catId);
            if (categoryItems.length === 0) return null;
            const catDef = DAILY_REVIEW_CATEGORY_DEFS[catId];
            return (
              <div key={catId}>
                <div className={cn("flex items-center gap-2 mb-1", SURFACE.sectionHeader)}>
                  <h2 className={TYPOGRAPHY.sectionTitle}>{catDef.label}</h2>
                  <Badge variant="secondary" className={TYPOGRAPHY.badge}>{categoryItems.length}</Badge>
                  <span className={cn(TYPOGRAPHY.metadata, "ml-1")}>{catDef.description}</span>
                </div>
                <div className={cn(SURFACE.primary, "overflow-hidden")}>
                  <DailyReviewColumnHeader />
                  <div className={SPACING.groupGap}>
                    {categoryItems.map((ri: DailyReviewItem) => (
                      <DailyReviewRow
                        key={ri.item.id}
                        reviewItem={ri}
                        onEscalation={(actionId) => handleEscalation(actionId, ri.item.id)}
                        onReviewOutcome={(outcomeId) => handleReviewOutcome(outcomeId, ri.item.id)}
                        isPending={reviewAction.isPending}
                      />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Navigation Helper ──

function navigateToEntity(router: ReturnType<typeof useRouter>, item: GroupedItem) {
  const { relatedEntityType, relatedEntityId } = item;
  if (!relatedEntityType || !relatedEntityId) return;

  const pathMap: Record<string, string> = {
    QUOTE: "/dashboard/quotes",
    ORDER: "/dashboard/orders",
    INVENTORY_RESTOCK: "/dashboard/inventory",
    PURCHASE_REQUEST: "/dashboard/purchases",
    COMPARE_SESSION: "/dashboard/compare",
  };

  const basePath = pathMap[relatedEntityType];
  if (basePath) {
    router.push(`${basePath}?entity_id=${relatedEntityId}&scroll_to=ops_context`);
  }
}
