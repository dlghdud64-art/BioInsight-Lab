"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Loader2,
  Shield,
  ShieldAlert,
  User,
  XCircle,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useWorkQueueConsole,
  useSyncOpsQueue,
  useExecuteOpsAction,
  useAssignmentAction,
  useDailyReview,
  useDailyReviewAction,
  TASK_STATUS_BADGE,
  type TaskStatus,
} from "@/hooks/use-work-queue";
import { OWNER_ROLE_LABELS } from "@/lib/work-queue/console-grouping";
import type {
  ConsoleGroup,
  GroupedItem,
  ConsoleSummary,
} from "@/lib/work-queue/console-grouping";
import {
  CONSOLE_VIEW_LABELS,
  ASSIGNMENT_STATE_LABELS,
  type ConsoleView,
} from "@/lib/work-queue/console-assignment";
import {
  DAILY_REVIEW_CATEGORY_DEFS,
  DAILY_REVIEW_CATEGORY_LABELS,
  ESCALATION_ACTION_LABELS,
  REVIEW_OUTCOME_LABELS,
} from "@/lib/work-queue/console-daily-review";
import type {
  DailyReviewItem,
  DailyReviewCategoryId,
  DailyReviewSurface,
} from "@/lib/work-queue/console-daily-review";

// ── Tier Visual Config ──

const TIER_STYLES: Record<string, { bg: string; border: string; icon: typeof AlertTriangle; iconColor: string }> = {
  urgent_blocker: { bg: "bg-red-50", border: "border-red-200", icon: ShieldAlert, iconColor: "text-red-600" },
  approval_needed: { bg: "bg-orange-50", border: "border-orange-200", icon: Shield, iconColor: "text-orange-600" },
  action_needed: { bg: "bg-yellow-50", border: "border-yellow-200", icon: Zap, iconColor: "text-yellow-600" },
  monitoring: { bg: "bg-blue-50", border: "border-blue-200", icon: Clock, iconColor: "text-blue-600" },
  informational: { bg: "bg-gray-50", border: "border-gray-200", icon: CheckCircle2, iconColor: "text-gray-500" },
};

const OWNER_BADGE_STYLES: Record<string, string> = {
  REQUESTER: "bg-blue-100 text-blue-700",
  APPROVER: "bg-orange-100 text-orange-700",
  OPERATOR: "bg-green-100 text-green-700",
};

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
    <div className="flex flex-wrap gap-1 bg-muted/50 rounded-lg p-1">
      {VIEW_ORDER.map((v) => (
        <button
          key={v}
          onClick={() => onViewChange(v)}
          className={cn(
            "text-xs px-3 py-1.5 rounded-md font-medium transition-colors",
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

// ── Main Console Component ──

type ConsoleMode = "queue" | "daily_review";

export function WorkQueueConsole() {
  const [mode, setMode] = useState<ConsoleMode>("queue");
  const [view, setView] = useState<ConsoleView>("all");

  useSyncOpsQueue();
  const { data, isLoading, error } = useWorkQueueConsole(undefined, view);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-xl font-semibold">운영 콘솔</h1>
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
        <h1 className="text-xl font-semibold">운영 콘솔</h1>
        <div className="flex items-center gap-2 text-sm text-red-600">
          <XCircle className="h-4 w-4" />
          <span>운영 큐 로딩 실패</span>
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
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-semibold">운영 콘솔</h1>
        {/* Mode Toggle */}
        <div className="flex gap-1 bg-muted/50 rounded-lg p-0.5">
          <button
            onClick={() => setMode("queue")}
            className={cn(
              "text-xs px-3 py-1 rounded-md font-medium transition-colors",
              mode === "queue" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            운영 큐
          </button>
          <button
            onClick={() => setMode("daily_review")}
            className={cn(
              "text-xs px-3 py-1 rounded-md font-medium transition-colors",
              mode === "daily_review" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            일일 검토
          </button>
        </div>
      </div>

      {mode === "daily_review" ? (
        <DailyReviewView />
      ) : (
        <>
          {/* View Tabs */}
          <ConsoleViewTabs view={view} onViewChange={setView} summary={summary} />

          {/* Summary Bar */}
          <ConsoleSummaryBar summary={summary} />

          {/* Group Sections */}
          {groups.length === 0 && (
            <div className="text-sm text-muted-foreground py-8 text-center">
              {view === "all" ? "처리할 운영 항목이 없습니다." : `${CONSOLE_VIEW_LABELS[view]}에 해당하는 항목이 없습니다.`}
            </div>
          )}

          {groups.map((group) => (
            <ConsoleGroupSection key={group.id} group={group} />
          ))}
        </>
      )}
    </div>
  );
}

// ── Summary Bar ──

function ConsoleSummaryBar({ summary }: { summary: ConsoleSummary }) {
  return (
    <div className="flex flex-wrap gap-3">
      <SummaryChip
        label="긴급"
        count={summary.urgentCount}
        color={summary.urgentCount > 0 ? "bg-red-100 text-red-800" : "bg-gray-100 text-gray-500"}
      />
      <SummaryChip
        label="승인 대기"
        count={summary.approvalCount}
        color={summary.approvalCount > 0 ? "bg-orange-100 text-orange-800" : "bg-gray-100 text-gray-500"}
      />
      <SummaryChip
        label="내 작업"
        count={summary.myWorkCount}
        color={summary.myWorkCount > 0 ? "bg-indigo-100 text-indigo-800" : "bg-gray-100 text-gray-500"}
      />
      <SummaryChip
        label="미배정"
        count={summary.unassignedCount}
        color={summary.unassignedCount > 0 ? "bg-yellow-100 text-yellow-800" : "bg-gray-100 text-gray-500"}
      />
      {/* Accountability counters */}
      {summary.assignedUntouchedCount != null && summary.assignedUntouchedCount > 0 && (
        <SummaryChip
          label="미착수"
          count={summary.assignedUntouchedCount}
          color="bg-amber-100 text-amber-800"
        />
      )}
      {summary.blockedAgingCount != null && summary.blockedAgingCount > 0 && (
        <SummaryChip
          label="장기차단"
          count={summary.blockedAgingCount}
          color="bg-red-100 text-red-800"
        />
      )}
      {summary.handoffNotAcceptedCount != null && summary.handoffNotAcceptedCount > 0 && (
        <SummaryChip
          label="미인수"
          count={summary.handoffNotAcceptedCount}
          color="bg-purple-100 text-purple-800"
        />
      )}
      {summary.overdueOwnedCount != null && summary.overdueOwnedCount > 0 && (
        <SummaryChip
          label="초과보유"
          count={summary.overdueOwnedCount}
          color="bg-rose-100 text-rose-800"
        />
      )}
      <SummaryChip
        label="활성"
        count={summary.totalActive}
        color="bg-blue-100 text-blue-800"
      />
      <SummaryChip
        label="완료"
        count={summary.totalResolved}
        color="bg-green-100 text-green-800"
      />
    </div>
  );
}

function SummaryChip({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className={cn("rounded-md px-3 py-1.5 text-xs font-medium", color)}>
      {label}: {count}
    </div>
  );
}

// ── Group Section ──

function ConsoleGroupSection({ group }: { group: ConsoleGroup }) {
  const [collapsed, setCollapsed] = useState(group.collapsible);

  return (
    <div className="space-y-2">
      <button
        onClick={() => group.collapsible && setCollapsed((c) => !c)}
        className={cn(
          "flex items-center gap-2 w-full text-left",
          group.collapsible && "cursor-pointer hover:opacity-80"
        )}
      >
        {group.collapsible && (
          collapsed
            ? <ChevronRight className="h-4 w-4 text-muted-foreground" />
            : <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
        <h2 className="text-sm font-semibold text-foreground">{group.label}</h2>
        <Badge variant="secondary" className="text-[10px]">
          {group.items.length}
        </Badge>
        <span className="text-xs text-muted-foreground ml-1">{group.description}</span>
      </button>

      {!collapsed && (
        <div className="space-y-2 pl-1">
          {group.items.map((item) => (
            <ConsoleQueueCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Queue Card ──

const ASSIGNMENT_STATE_STYLES: Record<string, string> = {
  unassigned: "bg-gray-100 text-gray-600",
  assigned: "bg-blue-100 text-blue-700",
  in_progress: "bg-green-100 text-green-700",
  blocked: "bg-red-100 text-red-700",
  handed_off: "bg-purple-100 text-purple-700",
  resolved: "bg-gray-100 text-gray-400",
};

function ConsoleQueueCard({ item }: { item: GroupedItem }) {
  const router = useRouter();
  const executeOps = useExecuteOpsAction();
  const assignmentAction = useAssignmentAction();
  const tierStyle = TIER_STYLES[item.priorityTier] ?? TIER_STYLES.monitoring;
  const TierIcon = tierStyle.icon;
  const statusBadge = TASK_STATUS_BADGE[item.taskStatus as TaskStatus];

  const handleCtaClick = () => {
    if (item.primaryCtaActionId) {
      executeOps.mutate({ actionId: item.primaryCtaActionId, itemId: item.id });
    } else {
      navigateToEntity(router, item);
    }
  };

  const handleClaim = () => {
    assignmentAction.mutate({ itemId: item.id, action: "claim" });
  };

  const handleMarkInProgress = () => {
    assignmentAction.mutate({ itemId: item.id, action: "mark_in_progress" });
  };

  const isPending = executeOps.isPending || assignmentAction.isPending;

  return (
    <div className={cn("rounded-md border p-3 space-y-2", tierStyle.bg, tierStyle.border)}>
      {/* Header: icon + title + status badge */}
      <div className="flex items-center gap-2">
        <TierIcon className={cn("h-3.5 w-3.5 flex-shrink-0", tierStyle.iconColor)} />
        <span className="text-sm font-medium truncate flex-1">{item.title}</span>
        {statusBadge && (
          <span className={cn("text-[10px] px-1.5 py-0.5 rounded-sm font-medium flex-shrink-0", statusBadge.color)}>
            {statusBadge.label}
          </span>
        )}
      </div>

      {/* Meta row: owner + assignment state + urgency reason */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Owner badge */}
        <span className={cn("text-[10px] px-1.5 py-0.5 rounded-sm font-medium", OWNER_BADGE_STYLES[item.ownerRole] ?? "bg-gray-100 text-gray-600")}>
          <User className="h-2.5 w-2.5 inline mr-0.5" />
          {OWNER_ROLE_LABELS[item.ownerRole] ?? item.ownerRole}
        </span>

        {/* Assignment state badge */}
        <span className={cn("text-[10px] px-1.5 py-0.5 rounded-sm font-medium", ASSIGNMENT_STATE_STYLES[item.assignmentState] ?? "bg-gray-100 text-gray-600")}>
          {item.assignmentStateLabel}
        </span>

        {/* Should-act indicator */}
        {item.shouldActorAct && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-sm font-medium bg-indigo-100 text-indigo-700">
            즉시 조치
          </span>
        )}

        {/* Urgency reason */}
        {item.urgencyReason && (
          <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-sm">
            {item.urgencyReason}
          </span>
        )}

        {/* Score */}
        <span className="text-[10px] text-muted-foreground ml-auto">
          점수 {item.totalScore}
        </span>
      </div>

      {/* Handoff info */}
      {item.handoffInfo && (
        <div className="text-[10px] bg-purple-50 border border-purple-100 rounded px-2 py-1 space-y-0.5">
          <div className="text-purple-700 font-medium">인수인계 사유: {item.handoffInfo.note}</div>
          {item.handoffInfo.nextAction && (
            <div className="text-purple-600">다음 조치: {item.handoffInfo.nextAction}</div>
          )}
        </div>
      )}

      {/* CTA row */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Primary CTA */}
        <Button
          size="sm"
          variant="default"
          className="text-xs h-7"
          disabled={isPending}
          onClick={handleCtaClick}
        >
          {isPending ? (
            <>
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              처리 중...
            </>
          ) : (
            item.primaryCtaLabel
          )}
        </Button>

        {/* Assignment quick actions */}
        {item.assignmentState === "unassigned" && (
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7"
            disabled={isPending}
            onClick={handleClaim}
          >
            담당
          </Button>
        )}
        {item.assignmentState === "assigned" && (
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7"
            disabled={isPending}
            onClick={handleMarkInProgress}
          >
            진행 시작
          </Button>
        )}
        {item.assignmentState === "handed_off" && (
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7"
            disabled={isPending}
            onClick={handleClaim}
          >
            담당 인수
          </Button>
        )}

        {/* Next queue label */}
        {item.nextQueueLabel && (
          <span className="text-[10px] text-muted-foreground">
            다음: {item.nextQueueLabel}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Daily Review View ──

const REVIEW_CATEGORY_ORDER: DailyReviewCategoryId[] = [
  "urgent_now", "overdue_owned", "blocked_too_long",
  "handoff_not_accepted", "urgent_unassigned",
  "recently_resolved", "needs_lead_intervention",
];

const CATEGORY_STYLES: Record<DailyReviewCategoryId, { bg: string; border: string }> = {
  urgent_now: { bg: "bg-red-50", border: "border-red-200" },
  overdue_owned: { bg: "bg-orange-50", border: "border-orange-200" },
  blocked_too_long: { bg: "bg-amber-50", border: "border-amber-200" },
  handoff_not_accepted: { bg: "bg-purple-50", border: "border-purple-200" },
  urgent_unassigned: { bg: "bg-yellow-50", border: "border-yellow-200" },
  recently_resolved: { bg: "bg-green-50", border: "border-green-200" },
  needs_lead_intervention: { bg: "bg-rose-50", border: "border-rose-200" },
};

function DailyReviewView() {
  const [roleView, setRoleView] = useState<"operator" | "lead">("operator");
  const { data, isLoading, error } = useDailyReview();

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

  return (
    <div className="space-y-4">
      {/* Summary chips */}
      <div className="flex flex-wrap gap-3">
        <SummaryChip label="검토 항목" count={surface.totalCount} color="bg-blue-100 text-blue-800" />
        <SummaryChip label="이월 항목" count={surface.carryOverCount} color={surface.carryOverCount > 0 ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-500"} />
        <SummaryChip label="날짜" count={0} color="bg-gray-100 text-gray-600" />
        <span className="text-xs text-muted-foreground self-center">{surface.date}</span>
      </div>

      {/* Role toggle */}
      <div className="flex gap-1 bg-muted/50 rounded-lg p-0.5 w-fit">
        <button
          onClick={() => setRoleView("operator")}
          className={cn(
            "text-xs px-3 py-1 rounded-md font-medium transition-colors",
            roleView === "operator" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          운영자 뷰 ({surface.operatorItems.length})
        </button>
        <button
          onClick={() => setRoleView("lead")}
          className={cn(
            "text-xs px-3 py-1 rounded-md font-medium transition-colors",
            roleView === "lead" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          리드 뷰 ({surface.leadItems.length})
        </button>
      </div>

      {/* Categories */}
      {visibleItems.length === 0 && (
        <div className="text-sm text-muted-foreground py-8 text-center">
          {roleView === "operator" ? "검토할 운영 항목이 없습니다." : "리드 개입이 필요한 항목이 없습니다."}
        </div>
      )}

      {REVIEW_CATEGORY_ORDER.map((catId) => {
        const categoryItems = visibleItems.filter((ri) => ri.category === catId);
        if (categoryItems.length === 0) return null;
        const catDef = DAILY_REVIEW_CATEGORY_DEFS[catId];
        const style = CATEGORY_STYLES[catId];
        return (
          <DailyReviewCategorySection
            key={catId}
            catId={catId}
            label={catDef.label}
            description={catDef.description}
            items={categoryItems}
            style={style}
          />
        );
      })}
    </div>
  );
}

function DailyReviewCategorySection({ catId, label, description, items, style }: {
  catId: DailyReviewCategoryId;
  label: string;
  description: string;
  items: DailyReviewItem[];
  style: { bg: string; border: string };
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="space-y-2">
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center gap-2 w-full text-left cursor-pointer hover:opacity-80"
      >
        {collapsed
          ? <ChevronRight className="h-4 w-4 text-muted-foreground" />
          : <ChevronDown className="h-4 w-4 text-muted-foreground" />
        }
        <h2 className="text-sm font-semibold text-foreground">{label}</h2>
        <Badge variant="secondary" className="text-[10px]">{items.length}</Badge>
        <span className="text-xs text-muted-foreground ml-1">{description}</span>
      </button>

      {!collapsed && (
        <div className="space-y-2 pl-1">
          {items.map((ri) => (
            <DailyReviewCard key={ri.item.id} reviewItem={ri} style={style} />
          ))}
        </div>
      )}
    </div>
  );
}

function DailyReviewCard({ reviewItem, style }: { reviewItem: DailyReviewItem; style: { bg: string; border: string } }) {
  const reviewAction = useDailyReviewAction();
  const isPending = reviewAction.isPending;

  const handleEscalation = (actionId: string) => {
    reviewAction.mutate({
      itemId: reviewItem.item.id,
      actionType: "escalation",
      actionId,
    });
  };

  const handleReviewOutcome = (outcomeId: string) => {
    reviewAction.mutate({
      itemId: reviewItem.item.id,
      actionType: "review_outcome",
      actionId: outcomeId,
    });
  };

  return (
    <div className={cn("rounded-md border p-3 space-y-2", style.bg, style.border)}>
      {/* Title */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium truncate flex-1">{reviewItem.item.title}</span>
        <span className="text-[10px] text-muted-foreground">
          점수 {reviewItem.item.totalScore}
        </span>
      </div>

      {/* Carry-over badge */}
      {reviewItem.carryOver && (
        <div className={cn(
          "text-[10px] px-2 py-0.5 rounded-sm font-medium inline-block",
          reviewItem.carryOver.severityPromoted
            ? "bg-red-100 text-red-700"
            : "bg-amber-100 text-amber-700"
        )}>
          이월 {reviewItem.carryOver.dayCount}일
          {reviewItem.carryOver.severityPromoted && " (심화)"}
        </div>
      )}

      {/* Escalation badges */}
      {reviewItem.escalations.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {reviewItem.escalations.map((esc, i) => (
            <span
              key={i}
              className={cn(
                "text-[10px] px-1.5 py-0.5 rounded-sm font-medium",
                esc.severity === "critical" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
              )}
            >
              {esc.message || esc.ruleId}
            </span>
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Escalation actions */}
        {reviewItem.availableEscalationActions.map((actionId) => (
          <Button
            key={actionId}
            size="sm"
            variant="destructive"
            className="text-xs h-7"
            disabled={isPending}
            onClick={() => handleEscalation(actionId)}
          >
            {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : ESCALATION_ACTION_LABELS[actionId]}
          </Button>
        ))}

        {/* Review outcome actions */}
        {reviewItem.availableReviewOutcomes.slice(0, 3).map((outcomeId) => (
          <Button
            key={outcomeId}
            size="sm"
            variant="outline"
            className="text-xs h-7"
            disabled={isPending}
            onClick={() => handleReviewOutcome(outcomeId)}
          >
            {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : REVIEW_OUTCOME_LABELS[outcomeId]}
          </Button>
        ))}
        {reviewItem.availableReviewOutcomes.length > 3 && (
          <span className="text-[10px] text-muted-foreground">
            +{reviewItem.availableReviewOutcomes.length - 3}
          </span>
        )}
      </div>
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
