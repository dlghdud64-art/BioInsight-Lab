"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  FileText, Package, ShoppingCart, AlertTriangle, Clock,
  CheckCircle2, XCircle, Ban, ChevronRight, ChevronDown,
  Zap, Eye, RotateCcw, Bell, GitCompare,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useWorkQueue,
  useApproveWorkItem,
  useDismissWorkItem,
  useExecuteOpsAction,
  useSyncOpsQueue,
  TASK_STATUS_BADGE,
  APPROVAL_STATUS_BADGE,
  type WorkQueueItem,
  type TaskStatus,
  type ApprovalStatus,
} from "@/hooks/use-work-queue";
import { COMPARE_CTA_MAP, COMPARE_SUBSTATUS_DEFS, COMPARE_ACTIVITY_LABELS, RESOLUTION_PATH_LABELS, computeInquiryAgingDays, type CompareResolutionPath } from "@/lib/work-queue/compare-queue-semantics";
import { OPS_ACTIVITY_LABELS, OPS_QUEUE_CTA_MAP, OPS_SUBSTATUS_DEFS, OPS_QUEUE_ITEM_TYPES, findCompletionDef } from "@/lib/work-queue/ops-queue-semantics";

// ── Priority → severity border mapping ──
const PRIORITY_BORDER: Record<string, string> = {
  HIGH: "border-l-red-500",
  MEDIUM: "border-l-orange-400",
  LOW: "border-l-slate-200",
};

// ── CTA mapping ──
const CTA_MAP: Record<string, { label: string; variant: "default" | "destructive" | "outline" }> = {
  REVIEW_NEEDED: { label: "검토하기", variant: "default" },
  ACTION_NEEDED: { label: "조치하기", variant: "destructive" },
  WAITING_RESPONSE: { label: "상태 확인", variant: "outline" },
  IN_PROGRESS: { label: "진행 확인", variant: "outline" },
  FAILED: { label: "재시도", variant: "destructive" },
  BLOCKED: { label: "해결하기", variant: "destructive" },
};

// ── Humanized Activity ──
const ACTIVITY_LABEL: Record<string, string> = {
  ...OPS_ACTIVITY_LABELS,
  ...COMPARE_ACTIVITY_LABELS,
};

// ── Deep-Link 경로 매핑 ──
function getDeepLinkPath(item: WorkQueueItem): string {
  if (item.type === "COMPARE_DECISION" && item.relatedEntityId) {
    return `/compare?sessionId=${item.relatedEntityId}`;
  }
  const base = (() => {
    switch (item.relatedEntityType) {
      case "QUOTE": return `/dashboard/quotes`;
      case "ORDER": return `/dashboard/orders`;
      case "INVENTORY": return `/dashboard/inventory`;
      default: return `/dashboard`;
    }
  })();
  return `${base}?ai_panel=open&work_item=${item.id}&entity_id=${item.relatedEntityId || ""}&scroll_to=ops_context`;
}

// ── 시간 표시 ──
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "방금 전";
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}

// ── 컴포넌트 ──

export function WorkQueueInbox() {
  const router = useRouter();
  const [showCompleted, setShowCompleted] = useState(false);
  useSyncOpsQueue();
  const { data, isLoading, error } = useWorkQueue({
    includeCompleted: showCompleted,
    limit: 20,
  });
  const approveMutation = useApproveWorkItem();
  const dismissMutation = useDismissWorkItem();
  const executeOpsMutation = useExecuteOpsAction();

  const activeItems = useMemo(
    () => (data?.items || []).filter((i) => i.taskStatus !== "COMPLETED"),
    [data?.items]
  );

  const completedItems = useMemo(
    () => (data?.items || []).filter((i) => i.taskStatus === "COMPLETED"),
    [data?.items]
  );

  if (isLoading) {
    return (
      <div className="border rounded-md bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-4 w-4 rounded bg-muted animate-pulse" />
          <div className="h-4 w-28 rounded bg-muted animate-pulse" />
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 rounded-md bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-red-200 rounded-md px-3 py-2">
        <p className="text-sm text-red-700">작업함을 불러오는 데 실패했습니다.</p>
      </div>
    );
  }

  return (
    <div className="border rounded-md bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-500" />
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            AI 작업함
          </h2>
          {(data?.activeCount ?? 0) > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {data?.activeCount}
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground h-6 px-2"
          onClick={() => router.push("/dashboard/work-queue")}
        >
          전체 보기 <ChevronRight className="h-3 w-3 ml-0.5" />
        </Button>
      </div>

      {/* Active Items */}
      <div>
        {activeItems.length === 0 ? (
          <div className="py-6 text-center">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 mx-auto mb-1.5" />
            <p className="text-sm text-muted-foreground">모든 AI 작업이 처리되었습니다</p>
          </div>
        ) : (
          activeItems.slice(0, 3).map((item) => (
            <InboxRow
              key={item.id}
              item={item}
              onNavigate={() => router.push(getDeepLinkPath(item))}
              onApprove={() => approveMutation.mutate({ id: item.id })}
              onDismiss={() => dismissMutation.mutate(item.id)}
              onExecuteOps={(actionId: string) =>
                executeOpsMutation.mutate({ actionId, itemId: item.id })
              }
              isApproving={approveMutation.isPending}
              isExecutingOps={executeOpsMutation.isPending}
            />
          ))
        )}

        {activeItems.length > 3 && (
          <button
            onClick={() => router.push("/dashboard/work-queue")}
            className="w-full text-center py-2 text-xs text-blue-600 hover:text-blue-700 font-medium border-t"
          >
            +{activeItems.length - 3}건 더 보기
          </button>
        )}
      </div>

      {/* Recent Completed */}
      {(data?.completedCount ?? 0) > 0 && (
        <div className="border-t">
          <button
            onClick={() => setShowCompleted((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/30 transition-colors"
          >
            <span>최근 완료 ({data?.completedCount}건)</span>
            <ChevronDown
              className={cn("h-3 w-3 transition-transform", showCompleted && "rotate-180")}
            />
          </button>
          {showCompleted && (
            <div className="px-3 pb-2 space-y-0.5">
              {completedItems.slice(0, 3).map((item) => (
                <CompletedRow key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Inbox Row (replaces WorkQueueCard) ──

function InboxRow({
  item,
  onNavigate,
  onApprove,
  onDismiss,
  onExecuteOps,
  isApproving,
  isExecutingOps,
}: {
  item: WorkQueueItem;
  onNavigate: () => void;
  onApprove: () => void;
  onDismiss: () => void;
  onExecuteOps: (actionId: string) => void;
  isApproving: boolean;
  isExecutingOps: boolean;
}) {
  const statusBadge = TASK_STATUS_BADGE[item.taskStatus];
  const cta = item.type === "COMPARE_DECISION" && item.substatus && COMPARE_CTA_MAP[item.substatus]
    ? COMPARE_CTA_MAP[item.substatus]
    : (item.substatus && OPS_QUEUE_CTA_MAP[item.substatus])
      ? OPS_QUEUE_CTA_MAP[item.substatus]
      : CTA_MAP[item.taskStatus] || { label: "확인", variant: "outline" as const };
  const activityLabel = ACTIVITY_LABEL[item.substatus || ""] || item.summary || "";
  const borderClass = PRIORITY_BORDER[item.priority] || "border-l-slate-200";

  // Resolve actionId for ops CTA execution
  const opsCtaActionId = (() => {
    if (item.type === "COMPARE_DECISION") return null;
    for (const queueType of Object.values(OPS_QUEUE_ITEM_TYPES)) {
      if (queueType.sourceSubstatuses?.includes(item.substatus || "")) {
        const actionId = queueType.primaryCta?.actionId;
        if (actionId && !actionId.startsWith("navigate_") && findCompletionDef(actionId)) {
          return actionId;
        }
      }
    }
    return null;
  })();

  // SLA age
  const ageDays = Math.floor((Date.now() - new Date(item.createdAt).getTime()) / 86400000);
  const slaWarning = (() => {
    if (item.type === "COMPARE_DECISION" && item.substatus && COMPARE_SUBSTATUS_DEFS[item.substatus]) {
      const def = COMPARE_SUBSTATUS_DEFS[item.substatus];
      return !def.isTerminal && def.slaWarningDays > 0 && ageDays >= def.slaWarningDays;
    }
    if (item.type !== "COMPARE_DECISION" && item.substatus && OPS_SUBSTATUS_DEFS[item.substatus!]) {
      const def = OPS_SUBSTATUS_DEFS[item.substatus!];
      return !def.isTerminal && def.slaWarningDays > 0 && ageDays >= def.slaWarningDays;
    }
    return false;
  })();

  return (
    <div className={cn(
      "flex items-center gap-3 px-3 py-2 border-b border-l-[3px] hover:bg-muted/30 transition-colors",
      borderClass
    )}>
      {/* Title + owner + status + urgency */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-foreground truncate">{item.title}</span>
          {item.metadata?.ownerName && (
            <span className="text-[10px] text-blue-600 font-medium flex-shrink-0">@{String(item.metadata.ownerName)}</span>
          )}
          <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0 leading-4 flex-shrink-0", statusBadge.color)}>
            {statusBadge.label}
          </Badge>
          {slaWarning && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0 leading-4 flex-shrink-0">SLA</Badge>
          )}
        </div>
        {/* Row 2: latest action + urgency reason */}
        <div className="flex items-center gap-2 mt-0.5">
          {activityLabel && (
            <span className="text-xs text-muted-foreground truncate">{activityLabel}</span>
          )}
          {item.urgencyReason && (
            <span className="text-xs text-orange-600 font-medium truncate">{item.urgencyReason}</span>
          )}
        </div>
      </div>

      {/* Age */}
      <span className={cn(
        "text-xs tabular-nums flex-shrink-0 whitespace-nowrap",
        slaWarning ? "text-orange-600 font-medium" : "text-muted-foreground"
      )}>
        {timeAgo(item.updatedAt)}
      </span>

      {/* Primary CTA */}
      <Button
        size="sm"
        variant={cta.variant}
        className="h-6 text-[11px] px-2.5 flex-shrink-0"
        disabled={isExecutingOps}
        onClick={(e) => {
          e.stopPropagation();
          if (opsCtaActionId) {
            onExecuteOps(opsCtaActionId);
          } else {
            onNavigate();
          }
        }}
      >
        {isExecutingOps ? "처리 중..." : cta.label}
      </Button>
    </div>
  );
}

// ── Completed Row ──

function CompletedRow({ item }: { item: WorkQueueItem }) {
  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-dashed last:border-b-0">
      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
      <span className="text-xs text-muted-foreground truncate flex-1">{item.title}</span>
      {item.type === "COMPARE_DECISION" && !!item.metadata?.resolutionPath && (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-emerald-600 border-emerald-200 flex-shrink-0">
          {RESOLUTION_PATH_LABELS[item.metadata.resolutionPath as CompareResolutionPath] || ""}
        </Badge>
      )}
      <span className="text-[10px] text-muted-foreground tabular-nums flex-shrink-0">{timeAgo(item.updatedAt)}</span>
    </div>
  );
}

export default WorkQueueInbox;
