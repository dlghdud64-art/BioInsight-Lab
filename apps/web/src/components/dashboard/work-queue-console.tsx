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
  TASK_STATUS_BADGE,
  type TaskStatus,
} from "@/hooks/use-work-queue";
import { OWNER_ROLE_LABELS } from "@/lib/work-queue/console-grouping";
import type {
  ConsoleGroup,
  GroupedItem,
  ConsoleSummary,
} from "@/lib/work-queue/console-grouping";

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

// ── Main Console Component ──

export function WorkQueueConsole() {
  useSyncOpsQueue();
  const { data, isLoading, error } = useWorkQueueConsole();

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
  const summary = data?.summary ?? { urgentCount: 0, approvalCount: 0, totalActive: 0, totalResolved: 0 };

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <h1 className="text-xl font-semibold">운영 콘솔</h1>

      {/* Summary Bar */}
      <ConsoleSummaryBar summary={summary} />

      {/* Group Sections */}
      {groups.length === 0 && (
        <div className="text-sm text-muted-foreground py-8 text-center">
          처리할 운영 항목이 없습니다.
        </div>
      )}

      {groups.map((group) => (
        <ConsoleGroupSection key={group.id} group={group} />
      ))}
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

function ConsoleQueueCard({ item }: { item: GroupedItem }) {
  const router = useRouter();
  const executeOps = useExecuteOpsAction();
  const tierStyle = TIER_STYLES[item.priorityTier] ?? TIER_STYLES.monitoring;
  const TierIcon = tierStyle.icon;
  const statusBadge = TASK_STATUS_BADGE[item.taskStatus as TaskStatus];

  const handleCtaClick = () => {
    if (item.primaryCtaActionId) {
      executeOps.mutate({ actionId: item.primaryCtaActionId, itemId: item.id });
    } else {
      // Navigate to deep link
      navigateToEntity(router, item);
    }
  };

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

      {/* Meta row: owner + urgency reason + tier indicator */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Owner badge */}
        <span className={cn("text-[10px] px-1.5 py-0.5 rounded-sm font-medium", OWNER_BADGE_STYLES[item.ownerRole] ?? "bg-gray-100 text-gray-600")}>
          <User className="h-2.5 w-2.5 inline mr-0.5" />
          {OWNER_ROLE_LABELS[item.ownerRole] ?? item.ownerRole}
        </span>

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

      {/* CTA row */}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="default"
          className="text-xs h-7"
          disabled={executeOps.isPending}
          onClick={handleCtaClick}
        >
          {executeOps.isPending ? (
            <>
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              처리 중...
            </>
          ) : (
            item.primaryCtaLabel
          )}
        </Button>

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
