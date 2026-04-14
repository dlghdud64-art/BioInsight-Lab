"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  RefreshCw,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { ActivityTimeline } from "@/components/ai/activity-timeline";
import { useEntityQueueItems, useExecuteOpsAction, type WorkQueueItem } from "@/hooks/use-work-queue";
import {
  OPS_SUBSTATUS_DEFS,
  OPS_QUEUE_ITEM_TYPES,
  OPS_OWNERSHIP_TRANSFERS,
  findCompletionDef,
} from "@/lib/work-queue/ops-queue-semantics";
import { resolveRetryPolicyFromResponse } from "@/lib/work-queue/ops-retry-semantics";
import { useState } from "react";

// ── Types ──

interface OpsExecutionContextProps {
  entityType: string;
  entityId: string;
  className?: string;
  compact?: boolean;
}

// ── Badge Variants ──

const TASK_STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  ACTION_NEEDED: "default",
  REVIEW_NEEDED: "default",
  WAITING_RESPONSE: "secondary",
  IN_PROGRESS: "secondary",
  COMPLETED: "outline",
  FAILED: "destructive",
  BLOCKED: "destructive",
};

// ── Component ──

export function OpsExecutionContext({
  entityType,
  entityId,
  className = "",
  compact = false,
}: OpsExecutionContextProps) {
  const { data, isLoading } = useEntityQueueItems(entityType, entityId);
  const executeOps = useExecuteOpsAction();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div id="ops-execution-context" className={`space-y-3 ${className}`}>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>운영 상태 로딩 중...</span>
        </div>
      </div>
    );
  }

  const items = data?.items ?? [];
  if (items.length === 0 && compact) {
    return null; // compact mode에서 큐 아이템이 없으면 숨김
  }

  const activeItems = items.filter(
    (i) => !["COMPLETED", "FAILED"].includes(i.taskStatus)
  );
  const completedItems = items.filter(
    (i) => ["COMPLETED", "FAILED"].includes(i.taskStatus)
  );

  return (
    <div id="ops-execution-context" className={`space-y-4 ${className}`}>
      <h4 className="text-sm font-medium text-foreground">운영 실행 현황</h4>

      {/* Active Queue Items */}
      {activeItems.length > 0 && (
        <div className="space-y-2">
          {activeItems.map((item) => (
            <ActiveQueueCard
              key={item.id}
              item={item}
              onExecute={(actionId) => {
                setErrorMessage(null);
                executeOps.mutate(
                  { actionId, itemId: item.id },
                  {
                    onError: (err: any) => {
                      const policy = resolveRetryPolicyFromResponse(
                        err.status ?? 500,
                        { error: err.errorCode }
                      );
                      setErrorMessage(policy?.userMessage ?? err.message);
                    },
                  }
                );
              }}
              isExecuting={executeOps.isPending}
            />
          ))}
        </div>
      )}

      {/* Error Feedback */}
      {errorMessage && (
        <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 rounded-md px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Completed/Failed Items — Execution Results */}
      {completedItems.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium">실행 결과</p>
          {completedItems.slice(0, compact ? 2 : 5).map((item) => (
            <ExecutionResultCard key={item.id} item={item} />
          ))}
        </div>
      )}

      {/* No items at all */}
      {items.length === 0 && (
        <p className="text-xs text-muted-foreground">
          이 항목에 대한 운영 큐 기록이 없습니다.
        </p>
      )}

      {/* Activity Timeline */}
      {!compact && (
        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground font-medium mb-2">최근 활동</p>
          <ActivityTimeline entityType="AI_ACTION" entityId={entityId} limit={5} />
        </div>
      )}
    </div>
  );
}

// ── Active Queue Card ──

function ActiveQueueCard({
  item,
  onExecute,
  isExecuting,
}: {
  item: WorkQueueItem;
  onExecute: (actionId: string) => void;
  isExecuting: boolean;
}) {
  const substatusDef = item.substatus ? OPS_SUBSTATUS_DEFS[item.substatus] : null;
  const label = substatusDef?.label ?? item.substatus ?? "진행 중";
  const variant = TASK_STATUS_VARIANT[item.taskStatus] ?? "secondary";

  // Find actionable CTA
  const ctaActionId = findActionableCta(item);
  const completionDef = ctaActionId ? findCompletionDef(ctaActionId) : null;

  // Ownership info from metadata
  const metadata = item.metadata as Record<string, unknown> | null;
  const transferId = metadata?.transferId as string | undefined;
  const transfer = transferId
    ? OPS_OWNERSHIP_TRANSFERS.find((t) => t.id === transferId)
    : null;

  return (
    <div className="rounded-md border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Clock className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
          <span className="text-sm font-medium truncate">{label}</span>
        </div>
        <Badge variant={variant} className="text-[10px] flex-shrink-0">
          {item.taskStatus.replace(/_/g, " ")}
        </Badge>
      </div>

      {/* SLA indicator */}
      {substatusDef && substatusDef.slaWarningDays > 0 && (
        <SlaIndicator item={item} slaWarningDays={substatusDef.slaWarningDays} />
      )}

      {/* Ownership transfer info */}
      {transfer && (
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span>{transfer.previousOwner}</span>
          <ArrowRight className="h-3 w-3" />
          <span>{transfer.nextOwner}</span>
        </div>
      )}

      {/* CTA Button */}
      {completionDef && (
        <Button
          size="sm"
          variant="default"
          className="w-full text-xs h-7"
          disabled={isExecuting}
          onClick={() => onExecute(ctaActionId!)}
        >
          {isExecuting ? (
            <>
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              처리 중...
            </>
          ) : (
            (completionDef.label as any)
          )}
        </Button>
      )}
    </div>
  );
}

// ── Execution Result Card ──

function ExecutionResultCard({ item }: { item: WorkQueueItem }) {
  const isSuccess = item.taskStatus === "COMPLETED";
  const metadata = item.metadata as Record<string, unknown> | null;
  const substatusDef = item.substatus ? OPS_SUBSTATUS_DEFS[item.substatus] : null;
  const label = substatusDef?.label ?? item.substatus ?? item.taskStatus;

  // Ownership transfer info
  const transferId = metadata?.transferId as string | undefined;
  const transfer = transferId
    ? OPS_OWNERSHIP_TRANSFERS.find((t) => t.id === transferId)
    : null;
  const outcome = metadata?.outcome as string | undefined;
  const errorDetail = metadata?.error as string | undefined;

  return (
    <div className="rounded-md border bg-muted/30 p-2.5 space-y-1.5">
      <div className="flex items-center gap-2">
        {isSuccess ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
        ) : (
          <XCircle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
        )}
        <span className="text-xs font-medium truncate">{label}</span>
        <Badge
          variant={isSuccess ? "outline" : "destructive"}
          className="text-[10px] ml-auto flex-shrink-0"
        >
          {isSuccess ? "완료" : "실패"}
        </Badge>
      </div>

      {/* State transition */}
      {Boolean(metadata?.substatus_before && metadata?.substatus_after) && (
        <div className="text-[11px] text-muted-foreground flex items-center gap-1">
          <span>{getSubstatusLabel(metadata?.substatus_before as string)}</span>
          <ArrowRight className="h-2.5 w-2.5" />
          <span>{getSubstatusLabel(metadata?.substatus_after as string)}</span>
        </div>
      )}

      {/* Ownership change */}
      {transfer && (
        <div className="text-[11px] text-muted-foreground">
          소유권 이전: {transfer.previousOwner} → {transfer.nextOwner}
        </div>
      )}

      {/* Error detail */}
      {!isSuccess && errorDetail && (
        <div className="text-[11px] text-red-600 truncate">
          {errorDetail}
        </div>
      )}

      {/* Timestamp */}
      <div className="text-[10px] text-muted-foreground">
        {new Date(item.updatedAt).toLocaleString("ko-KR")}
      </div>
    </div>
  );
}

// ── SLA Indicator ──

function SlaIndicator({ item, slaWarningDays }: { item: WorkQueueItem; slaWarningDays: number }) {
  const ageDays = Math.floor(
    (Date.now() - new Date(item.createdAt).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (ageDays < slaWarningDays) return null;

  const isStale = ageDays >= slaWarningDays * 2;
  return (
    <div
      className={`text-[11px] flex items-center gap-1 ${
        isStale ? "text-red-600" : "text-amber-600"
      }`}
    >
      <AlertTriangle className="h-3 w-3" />
      <span>
        {isStale ? `정체 ${ageDays}일 — SLA 초과` : `${ageDays}일 경과 — SLA 주의`}
      </span>
    </div>
  );
}

// ── Helpers ──

function getSubstatusLabel(substatus: string): string {
  return OPS_SUBSTATUS_DEFS[substatus]?.label ?? substatus;
}

function findActionableCta(item: WorkQueueItem): string | null {
  for (const queueType of Object.values(OPS_QUEUE_ITEM_TYPES)) {
    const sourceSubstatuses = (queueType as any).sourceSubstatuses as string[] | undefined;
    if (sourceSubstatuses?.includes(item.substatus || "")) {
      const actionId = (queueType as any).primaryCta?.actionId as string | undefined;
      if (actionId && !actionId.startsWith("navigate_") && findCompletionDef(actionId)) {
        return actionId;
      }
    }
  }
  return null;
}
