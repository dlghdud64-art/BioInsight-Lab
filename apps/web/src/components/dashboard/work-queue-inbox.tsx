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

// ── 도메인별 아이콘·색상·CTA 매핑 ──

const DOMAIN_CONFIG: Record<string, {
  icon: typeof FileText;
  color: string;
  bgColor: string;
}> = {
  QUOTE_DRAFT: { icon: FileText, color: "text-blue-600", bgColor: "bg-blue-50" },
  VENDOR_EMAIL_DRAFT: { icon: FileText, color: "text-blue-600", bgColor: "bg-blue-50" },
  FOLLOWUP_DRAFT: { icon: Clock, color: "text-amber-600", bgColor: "bg-amber-50" },
  STATUS_CHANGE_SUGGEST: { icon: RotateCcw, color: "text-blue-600", bgColor: "bg-blue-50" },
  REORDER_SUGGESTION: { icon: Package, color: "text-emerald-600", bgColor: "bg-emerald-50" },
  EXPIRY_ALERT: { icon: AlertTriangle, color: "text-red-600", bgColor: "bg-red-50" },
  VENDOR_RESPONSE_PARSED: { icon: ShoppingCart, color: "text-blue-600", bgColor: "bg-blue-50" },
  COMPARE_DECISION: { icon: GitCompare, color: "text-blue-600", bgColor: "bg-blue-50" },
};

const CTA_MAP: Record<string, { label: string; variant: "default" | "destructive" | "outline" }> = {
  REVIEW_NEEDED: { label: "검토하기", variant: "default" },
  ACTION_NEEDED: { label: "조치하기", variant: "destructive" },
  WAITING_RESPONSE: { label: "상태 확인", variant: "outline" },
  IN_PROGRESS: { label: "진행 확인", variant: "outline" },
  FAILED: { label: "재시도", variant: "destructive" },
  BLOCKED: { label: "해결하기", variant: "destructive" },
};

// ── Humanized Activity 변환 ──

const ACTIVITY_LABEL: Record<string, string> = {
  ...OPS_ACTIVITY_LABELS,
  ...COMPARE_ACTIVITY_LABELS,
};

// ── Deep-Link 경로 매핑 ──

function getDeepLinkPath(item: WorkQueueItem): string {
  // 비교 세션 → 비교 페이지로 직접 라우팅
  if (item.type === "COMPARE_DECISION" && item.relatedEntityId) {
    return `/compare?sessionId=${item.relatedEntityId}`;
  }

  // 도메인별 목록 페이지로 라우팅 (상세 페이지가 존재하지 않으므로 목록 + query param)
  const base = (() => {
    switch (item.relatedEntityType) {
      case "QUOTE": return `/dashboard/quotes`;
      case "ORDER": return `/dashboard/orders`;
      case "INVENTORY": return `/dashboard/inventory`;
      default: return `/dashboard`;
    }
  })();

  // AI 보조 패널 자동 오픈 + ops context 스크롤을 위한 query param
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
  useSyncOpsQueue(); // Sync ops + compare queue on mount
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
      <div className="rounded-xl border border-bd/60 bg-pn border-bd p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-5 w-5 rounded bg-st animate-pulse" />
          <div className="h-5 w-32 rounded bg-st animate-pulse" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-lg bg-el animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <p className="text-sm text-red-700">작업함을 불러오는 데 실패했습니다.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-bd/60 bg-pn border-bd shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between p-4 pb-2">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-amber-500" />
          <h2 className="text-sm font-semibold text-slate-100">
            AI 작업함
          </h2>
          {(data?.activeCount ?? 0) > 0 && (
            <Badge
              variant="secondary"
              className="bg-amber-100 text-amber-800 text-xs px-1.5 py-0"
            >
              {data?.activeCount}
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-slate-500"
          onClick={() => router.push("/dashboard/work-queue")}
        >
          전체 보기 <ChevronRight className="h-3 w-3 ml-1" />
        </Button>
      </div>

      {/* Active Items */}
      <div className="px-4 pb-2 space-y-2">
        {activeItems.length === 0 ? (
          <div className="py-8 text-center">
            <CheckCircle2 className="h-8 w-8 text-green-400 mx-auto mb-2" />
            <p className="text-sm text-slate-500">모든 AI 작업이 처리되었습니다</p>
            <p className="text-xs text-slate-400 mt-1">운영 상태 정상</p>
          </div>
        ) : (
          activeItems.slice(0, 3).map((item) => (
            <WorkQueueCard
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
            className="w-full text-center py-2 text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            +{activeItems.length - 3}건 더 보기
          </button>
        )}
      </div>

      {/* Recent Completed (접힘 영역) */}
      {(data?.completedCount ?? 0) > 0 && (
        <div className="border-t border-slate-100 border-bd">
          <button
            onClick={() => setShowCompleted((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-2 text-xs text-slate-500 hover:bg-el/50 transition-colors"
          >
            <span>최근 완료 ({data?.completedCount}건)</span>
            <ChevronDown
              className={cn("h-3 w-3 transition-transform", showCompleted && "rotate-180")}
            />
          </button>
          {showCompleted && (
            <div className="px-4 pb-3 space-y-1.5">
              {completedItems.slice(0, 3).map((item) => (
                <CompletedCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Work Queue Card ──

function WorkQueueCard({
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
  const config = DOMAIN_CONFIG[item.type] || DOMAIN_CONFIG.QUOTE_DRAFT;
  const Icon = config.icon;
  const statusBadge = TASK_STATUS_BADGE[item.taskStatus];
  const approvalBadge = APPROVAL_STATUS_BADGE[item.approvalStatus];
  const cta = item.type === "COMPARE_DECISION" && item.substatus && COMPARE_CTA_MAP[item.substatus]
    ? COMPARE_CTA_MAP[item.substatus]
    : (item.substatus && OPS_QUEUE_CTA_MAP[item.substatus])
      ? OPS_QUEUE_CTA_MAP[item.substatus]
      : CTA_MAP[item.taskStatus] || { label: "확인", variant: "outline" as const };
  const activityLabel = ACTIVITY_LABEL[item.substatus || ""] || item.summary || "";

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

  return (
    <div className={cn(
      "group rounded-lg border border-bd/80 border-bs hover:border-bs bg-el/30 transition-all duration-150",
      (item.impactScore ?? 0) >= 80 && "border-l-2 border-l-red-500"
    )}>
      <div className="p-3">
        {/* Row 1: Icon + Title + Badges */}
        <div className="flex items-start gap-2.5">
          <div className={cn("p-1.5 rounded-md flex-shrink-0 mt-0.5", config.bgColor)}>
            <Icon className={cn("h-3.5 w-3.5", config.color)} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-medium text-slate-100 truncate">
                {item.title}
              </span>
              <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0 leading-4", statusBadge.color)}>
                {statusBadge.label}
              </Badge>
              {approvalBadge.label && (
                <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0 leading-4", approvalBadge.color)}>
                  {approvalBadge.label}
                </Badge>
              )}
            </div>

            {/* Row 2: Activity summary + urgency reason */}
            {activityLabel && (
              <p className="text-xs text-slate-400 mt-0.5 truncate">
                {activityLabel}
              </p>
            )}
            {item.urgencyReason && (
              <p className="text-[11px] font-medium text-orange-600 text-orange-400 mt-0.5 flex items-center gap-1">
                <Zap className="h-3 w-3" />
                {item.urgencyReason}
              </p>
            )}
            {/* SLA aging indicator for compare items */}
            {item.type === "COMPARE_DECISION" && item.substatus && COMPARE_SUBSTATUS_DEFS[item.substatus] && (() => {
              const def = COMPARE_SUBSTATUS_DEFS[item.substatus];
              const ageDays = Math.floor((Date.now() - new Date(item.createdAt).getTime()) / 86400000);
              if (!def.isTerminal && def.slaWarningDays > 0 && ageDays >= def.slaWarningDays) {
                return (
                  <span className="text-[10px] text-orange-600 font-medium mt-0.5 flex items-center gap-1">
                    <Clock className="h-3 w-3" />{ageDays}일 경과
                  </span>
                );
              }
              return null;
            })()}
            {/* SLA aging indicator for ops items */}
            {item.type !== "COMPARE_DECISION" && item.substatus && OPS_SUBSTATUS_DEFS[item.substatus] && (() => {
              const def = OPS_SUBSTATUS_DEFS[item.substatus!];
              const ageDays = Math.floor((Date.now() - new Date(item.createdAt).getTime()) / 86400000);
              if (!def.isTerminal && def.slaWarningDays > 0 && ageDays >= def.slaWarningDays) {
                return (
                  <span className="text-[10px] text-orange-600 font-medium mt-0.5 flex items-center gap-1">
                    <Clock className="h-3 w-3" />{ageDays}일 경과 — {def.escalationMeaning}
                  </span>
                );
              }
              return null;
            })()}
            {/* Inquiry count for compare_inquiry_followup */}
            {item.substatus === "compare_inquiry_followup" && item.metadata?.inquiryCount && (
              <span className="text-[10px] text-slate-500 mt-0.5">
                문의 {String(item.metadata.inquiryCount)}건
              </span>
            )}
            {/* Inquiry aging indicator */}
            {item.substatus === "compare_inquiry_followup" && (() => {
              const drafts = item.metadata?.inquiryDrafts as { status: string; createdAt: string }[] | undefined;
              if (!drafts) return null;
              const agingDays = computeInquiryAgingDays({ inquiryDrafts: drafts });
              if (agingDays === null) return null;
              return (
                <span className="text-[10px] text-red-500 font-medium mt-0.5">
                  문의 미발송 {agingDays}일
                </span>
              );
            })()}
            {/* No-movement hint for stale decision_pending items */}
            {item.substatus === "compare_decision_pending" && (() => {
              const ageDays = Math.floor((Date.now() - new Date(item.createdAt).getTime()) / 86400000);
              const hasInquiry = Number(item.metadata?.inquiryCount || 0) > 0;
              const hasQuote = Number(item.metadata?.linkedQuoteCount || 0) > 0;
              if (ageDays >= 3 && !hasInquiry && !hasQuote) {
                return (
                  <span className="text-[10px] text-orange-500 font-medium mt-0.5">
                    다음 단계 없음 — 판정 또는 문의/견적 전환 필요
                  </span>
                );
              }
              return null;
            })()}

            {/* Row 3: CTA + Dismiss + Time */}
            <div className="flex items-center gap-2 mt-2">
              <Button
                size="sm"
                variant={cta.variant}
                className="h-6 text-[11px] px-2.5"
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
                {isExecutingOps ? "처리 중..." : cta.label} <ChevronRight className="h-3 w-3 ml-0.5" />
              </Button>

              {item.approvalStatus === "PENDING" && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-[11px] px-2 text-slate-400 hover:text-slate-600"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDismiss();
                  }}
                >
                  무시
                </Button>
              )}

              <span className="ml-auto text-[10px] text-slate-400">
                {timeAgo(item.updatedAt)}
              </span>
            </div>
          </div>

          {/* Priority indicator */}
          {item.priority === "HIGH" && (
            <div className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0 mt-2" />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Completed Card (접힘 영역) ──

function CompletedCard({ item }: { item: WorkQueueItem }) {
  const config = DOMAIN_CONFIG[item.type] || DOMAIN_CONFIG.QUOTE_DRAFT;
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-2 py-1.5 px-1">
      <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
      <span className="text-xs text-slate-500 truncate flex-1">{item.title}</span>
      {item.type === "COMPARE_DECISION" && item.metadata?.resolutionPath && (
        <span className="text-[10px] text-slate-400 flex-shrink-0">
          {RESOLUTION_PATH_LABELS[item.metadata.resolutionPath as CompareResolutionPath] || ""}
        </span>
      )}
      <span className="text-[10px] text-slate-400 flex-shrink-0">{timeAgo(item.updatedAt)}</span>
    </div>
  );
}

export default WorkQueueInbox;
