"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Package,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ChevronRight,
  RefreshCw,
  Mail,
  Building2,
  Truck,
  Loader2,
  TriangleAlert,
  Send,
  ArrowRightLeft,
  CalendarClock,
  DollarSign,
  ShieldAlert,
  FileWarning,
  Hash,
} from "lucide-react";
import { AiDraftPreviewDialog } from "./ai-draft-preview-dialog";
import type {
  OrderPanelState,
  OrderAiPanelData,
  OrderIssue,
  FollowUpDraft,
  VendorResponseSummary,
  StatusTransitionProposal,
} from "@/hooks/use-order-ai-panel";

// ── Props ──

interface OrderAiAssistantPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: OrderPanelState;
  data: OrderAiPanelData;
  actionId?: string;
  onRegenerateFollowUp: () => void;
  onApproveFollowUp?: (actionId: string, payload: Record<string, unknown>) => void;
  onApproveStatusChange?: (proposedStatus: string) => void;
  isGenerating: boolean;
  error?: string;
}

export function OrderAiAssistantPanel({
  open,
  onOpenChange,
  state,
  data,
  actionId,
  onRegenerateFollowUp,
  onApproveFollowUp,
  onApproveStatusChange,
  isGenerating,
  error,
}: OrderAiAssistantPanelProps) {
  const [emailPreviewOpen, setEmailPreviewOpen] = useState(false);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-[440px] p-0 flex flex-col overflow-hidden"
        >
          {/* ═══ 1. 헤더 ═══ */}
          <SheetHeader className="px-5 pt-5 pb-3 border-b border-slate-800/50 flex-shrink-0">
            <SheetTitle className="text-base font-bold text-slate-100">
              {state === "empty" && "주문 추적 도우미"}
              {state === "loading" && "주문 추적 도우미"}
              {state === "success" && "주문 추적 도우미"}
              {state === "warning" && "주문 추적 도우미"}
              {state === "error" && "정보를 불러오지 못했습니다"}
            </SheetTitle>
            <SheetDescription className="text-xs text-slate-400 mt-0.5">
              {state === "empty" && "주문을 선택하면 상태와 이슈를 정리합니다."}
              {state === "loading" && "주문 상태와 벤더 회신을 확인하고 있습니다..."}
              {state === "success" && "현재 주문 상태와 필요한 조치를 정리했습니다."}
              {state === "warning" && "확인이 필요한 항목이 있습니다."}
              {state === "error" && "주문 정보를 확인한 뒤 다시 시도해 주세요."}
            </SheetDescription>
          </SheetHeader>

          {/* ═══ 스크롤 영역 ═══ */}
          <div className="flex-1 overflow-y-auto">
            {/* ── Empty State ── */}
            {state === "empty" && <EmptyState />}

            {/* ── Loading State ── */}
            {state === "loading" && <LoadingState />}

            {/* ── Error State ── */}
            {state === "error" && (
              <ErrorState error={error} onRetry={onRegenerateFollowUp} />
            )}

            {/* ── Success / Warning State ── */}
            {(state === "success" || state === "warning") && (
              <div className="divide-y divide-slate-800/50">
                {/* 2. 주문 요약 */}
                {data.order && <OrderSummarySection order={data.order} />}

                {/* 3. 이슈 경고 */}
                {data.issues.length > 0 && (
                  <IssueWarningsSection issues={data.issues} />
                )}

                {/* 4. Follow-up 초안 */}
                {data.followUpDraft && (
                  <FollowUpDraftSection
                    draft={data.followUpDraft}
                    onRegenerate={onRegenerateFollowUp}
                    onShowEmail={() => setEmailPreviewOpen(true)}
                    isGenerating={isGenerating}
                  />
                )}

                {/* 5. 벤더 회신 요약 */}
                {data.vendorResponses.length > 0 && (
                  <VendorResponseSection responses={data.vendorResponses} />
                )}

                {/* 6. 상태 전환 제안 */}
                {data.statusProposal && (
                  <StatusTransitionSection
                    proposal={data.statusProposal}
                    onApprove={onApproveStatusChange}
                  />
                )}
              </div>
            )}
          </div>

          {/* ═══ 7. 최종 액션 (Sticky Bottom) ═══ */}
          {(state === "success" || state === "warning") && (
            <StickyActions
              data={data}
              actionId={actionId}
              onApproveFollowUp={onApproveFollowUp}
              onApproveStatusChange={onApproveStatusChange}
              onShowEmail={() => setEmailPreviewOpen(true)}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Follow-up 이메일 미리보기 다이얼로그 */}
      {data.followUpDraft && (
        <AiDraftPreviewDialog
          open={emailPreviewOpen}
          onOpenChange={setEmailPreviewOpen}
          title="Follow-up 이메일 초안"
          emailSubject={data.followUpDraft.emailSubject}
          emailBody={data.followUpDraft.emailBody}
          metadata={{
            vendorName: data.followUpDraft.vendorName,
            itemCount: data.order?.itemCount,
          }}
          onApprove={(modified) => {
            if (actionId && onApproveFollowUp) {
              onApproveFollowUp(actionId, {
                ...data.followUpDraft,
                emailBody: modified.emailBody,
                emailSubject: modified.emailSubject,
              });
            }
            setEmailPreviewOpen(false);
          }}
        />
      )}
    </>
  );
}

// ══════════════════════════════════════════════════════════
// Sub-components
// ══════════════════════════════════════════════════════════

// ── Empty State ──
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full py-20 px-6 text-center">
      <div className="rounded-full bg-slate-800/50 p-4 mb-4">
        <Truck className="h-8 w-8 text-slate-400" />
      </div>
      <p className="text-sm font-medium text-slate-400">
        주문을 선택하면 여기에서 확인할 수 있습니다
      </p>
      <p className="text-xs text-slate-500 mt-1.5 max-w-[240px]">
        주문 상태, 벤더 회신, 배송 이슈 등을 한눈에 확인하고 필요한 조치를 바로 취할 수 있습니다.
      </p>
    </div>
  );
}

// ── Loading State ──
function LoadingState() {
  return (
    <div className="p-5 space-y-5">
      {/* 주문 요약 스켈레톤 */}
      <div className="space-y-3">
        <Skeleton className="h-3 w-20 mb-2" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-3 rounded-lg bg-slate-800/30">
              <Skeleton className="h-3 w-16 mb-2" />
              <Skeleton className="h-6 w-10" />
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* 이슈 스켈레톤 */}
      <div>
        <Skeleton className="h-3 w-28 mb-3" />
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="p-3 rounded-lg border border-slate-800">
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* Follow-up 스켈레톤 */}
      <div>
        <Skeleton className="h-3 w-24 mb-3" />
        <Skeleton className="h-20 w-full rounded-lg" />
      </div>
    </div>
  );
}

// ── Error State ──
function ErrorState({
  error,
  onRetry,
}: {
  error?: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full py-20 px-6 text-center">
      <div className="rounded-full bg-red-950/30 p-4 mb-4">
        <TriangleAlert className="h-8 w-8 text-red-500" />
      </div>
      <p className="text-sm font-medium text-slate-300">
        주문 분석에 실패했습니다
      </p>
      <p className="text-xs text-slate-500 mt-1.5 max-w-[260px]">
        {error || "주문 정보와 벤더 정보를 확인한 뒤 다시 시도해 주세요."}
      </p>
      <Button
        variant="outline"
        size="sm"
        className="mt-4 h-8 text-xs"
        onClick={onRetry}
      >
        <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
        다시 확인하기
      </Button>
    </div>
  );
}

// ── 2. 주문 요약 섹션 ──
function OrderSummarySection({ order }: { order: OrderAiPanelData["order"] }) {
  if (!order) return null;

  const statusLabels: Record<string, string> = {
    ORDERED: "접수대기",
    CONFIRMED: "확인됨",
    SHIPPING: "배송중",
    DELIVERED: "배송완료",
    CANCELLED: "취소됨",
  };

  const statusColors: Record<string, { text: string; bg: string }> = {
    ORDERED: { text: "text-amber-400", bg: "bg-amber-950/30" },
    CONFIRMED: { text: "text-blue-400", bg: "bg-blue-950/30" },
    SHIPPING: { text: "text-purple-400", bg: "bg-purple-950/30" },
    DELIVERED: { text: "text-emerald-400", bg: "bg-emerald-950/30" },
    CANCELLED: { text: "text-red-400", bg: "bg-red-950/30" },
  };

  const statusColor = statusColors[order.status] || statusColors.ORDERED;

  const stats = [
    {
      icon: Hash,
      label: "주문번호",
      value: order.orderNumber,
      color: "text-slate-400",
      bg: "bg-slate-800/30",
      small: true,
    },
    {
      icon: Package,
      label: "주문 상태",
      value: statusLabels[order.status] || order.status,
      color: statusColor.text,
      bg: statusColor.bg,
    },
    {
      icon: DollarSign,
      label: "주문 금액",
      value: `₩${order.totalAmount.toLocaleString()}`,
      color: "text-slate-400",
      bg: "bg-slate-800/30",
    },
    {
      icon: Clock,
      label: "경과일",
      value: `${order.daysSinceOrdered}일`,
      color: order.daysSinceOrdered >= 7
        ? "text-amber-400"
        : "text-slate-400",
      bg: order.daysSinceOrdered >= 7
        ? "bg-amber-950/30"
        : "bg-slate-800/30",
    },
  ];

  return (
    <div className="p-5">
      <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">
        주문 요약
      </h4>

      {/* 제목 */}
      <p className="text-sm font-medium text-slate-200 mb-3">
        {order.quoteTitle}
      </p>

      {/* 스탯 그리드 */}
      <div className="grid grid-cols-2 gap-2.5">
        {stats.map((stat) => {
          const IconComp = stat.icon;
          return (
            <div
              key={stat.label}
              className={`px-3 py-2.5 rounded-lg ${stat.bg}`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <IconComp className={`h-3.5 w-3.5 ${stat.color}`} />
                <span className="text-[11px] text-slate-400">
                  {stat.label}
                </span>
              </div>
              <p className={`${stat.small ? "text-sm" : "text-lg"} font-bold ${stat.color} truncate`}>
                {stat.value}
              </p>
            </div>
          );
        })}
      </div>

      {/* 벤더·배송 정보 */}
      <div className="mt-3 space-y-1.5">
        {order.vendorName && (
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <Building2 className="h-3.5 w-3.5 text-slate-400" />
            <span>벤더: <span className="font-medium text-slate-300">{order.vendorName}</span></span>
          </div>
        )}
        {order.expectedDelivery && (
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <CalendarClock className="h-3.5 w-3.5 text-slate-400" />
            <span>배송 예정: <span className="font-medium text-slate-300">{formatDate(order.expectedDelivery)}</span></span>
          </div>
        )}
        {order.itemCount > 0 && (
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <Package className="h-3.5 w-3.5 text-slate-400" />
            <span>품목: <span className="font-medium text-slate-300">{order.itemCount}건</span></span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 3. 이슈 경고 섹션 ──
function IssueWarningsSection({ issues }: { issues: OrderIssue[] }) {
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");
  const infos = issues.filter((i) => i.severity === "info");

  const issueIcon = (type: OrderIssue["type"]) => {
    switch (type) {
      case "delay": return Truck;
      case "no_response": return Mail;
      case "partial_delivery": return Package;
      case "price_change": return DollarSign;
      case "expiry_risk": return FileWarning;
      default: return AlertTriangle;
    }
  };

  return (
    <div className={`p-5 ${errors.length > 0 ? "bg-red-950/10" : "bg-amber-950/10"}`}>
      <div className="flex items-center gap-2 mb-3">
        <ShieldAlert className={`h-4 w-4 ${errors.length > 0 ? "text-red-500" : "text-amber-500"}`} />
        <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
          확인 필요한 이슈
        </h4>
        <Badge
          variant="outline"
          className={`text-[10px] h-4 px-1.5 ${
            errors.length > 0
              ? "bg-red-950/30 text-red-400 border-red-800"
              : "bg-amber-950/30 text-amber-400 border-amber-800"
          }`}
        >
          {issues.length}건
        </Badge>
      </div>

      <div className="space-y-2">
        {[...errors, ...warnings, ...infos].map((issue, idx) => {
          const IconComp = issueIcon(issue.type);
          const isError = issue.severity === "error";
          const isWarning = issue.severity === "warning";

          return (
            <div
              key={idx}
              className={`p-3 rounded-lg border ${
                isError
                  ? "border-red-800/50 bg-red-950/20"
                  : isWarning
                  ? "border-amber-800/50 bg-amber-950/20"
                  : "border-slate-800 bg-slate-50/50 border-slate-700 bg-slate-800/30"
              }`}
            >
              <div className="flex items-start gap-2">
                <IconComp
                  className={`h-3.5 w-3.5 mt-0.5 flex-shrink-0 ${
                    isError ? "text-red-500" : isWarning ? "text-amber-500" : "text-blue-500"
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-300">
                    {issue.message}
                  </p>
                  {issue.detail && (
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {issue.detail}
                    </p>
                  )}
                  {issue.suggestedAction && (
                    <p className="text-[11px] text-blue-400 mt-1 font-medium">
                      권장: {issue.suggestedAction}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── 4. Follow-up 초안 섹션 ──
function FollowUpDraftSection({
  draft,
  onRegenerate,
  onShowEmail,
  isGenerating,
}: {
  draft: FollowUpDraft;
  onRegenerate: () => void;
  onShowEmail: () => void;
  isGenerating: boolean;
}) {
  const bodyPreview = draft.emailBody
    .split("\n")
    .filter((line) => line.trim())
    .slice(0, 4)
    .join("\n");

  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
          Follow-up 이메일 초안
        </h4>
      </div>

      <p className="text-[11px] text-slate-500 mb-3">
        {draft.reason} — {draft.vendorName} 대상 회신 요청 초안입니다
      </p>

      {/* 확인 필요 항목 */}
      {draft.pendingChecks && draft.pendingChecks.length > 0 && (
        <div className="rounded-lg border border-amber-800/50 bg-amber-950/20 p-3 mb-3">
          <p className="text-[11px] font-semibold text-amber-400 mb-1.5">
            확인 필요 항목
          </p>
          <div className="space-y-1">
            {draft.pendingChecks.map((check: string, idx: number) => (
              <div key={idx} className="flex items-center gap-1.5 text-[11px] text-amber-400">
                <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                <span>{check}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 초안 카드 */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-3.5 mb-3">
        <div className="flex items-center gap-2 mb-2">
          <Mail className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-xs font-medium text-slate-300 truncate">
            {draft.emailSubject}
          </span>
        </div>

        {draft.vendorEmail && (
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-[11px] text-slate-400">
              수신: {draft.vendorEmail}
            </span>
          </div>
        )}

        <div className="mt-2 pt-2 border-t border-slate-700/50">
          <p className="text-[11px] text-slate-500 whitespace-pre-wrap line-clamp-4 font-mono leading-relaxed">
            {bodyPreview}
          </p>
          <button
            className="text-[11px] text-blue-500 hover:text-blue-600 mt-1 font-medium"
            onClick={onShowEmail}
          >
            전문 보기
          </button>
        </div>
      </div>

      {/* 액션 버튼 */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-[11px] flex-1"
          onClick={onRegenerate}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3 mr-1" />
          )}
          초안 다시 작성
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-[11px] flex-1"
          onClick={onShowEmail}
        >
          <Mail className="h-3 w-3 mr-1" />
          메일 초안 확인
        </Button>
      </div>
    </div>
  );
}

// ── 5. 벤더 회신 요약 섹션 ──
function VendorResponseSection({ responses }: { responses: VendorResponseSummary[] }) {
  return (
    <div className="p-5">
      <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">
        벤더 회신 요약
      </h4>

      <div className="space-y-3">
        {responses.map((resp, idx) => (
          <div
            key={idx}
            className="p-3 rounded-lg border border-slate-800 bg-slate-900/50"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Building2 className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-sm font-medium text-slate-200">
                  {resp.vendorName}
                </span>
              </div>
              {resp.respondedAt && (
                <Badge
                  variant="outline"
                  className="text-[10px] h-4 px-1.5 bg-emerald-900/20 text-emerald-300 bg-emerald-950/30 text-emerald-400 border-emerald-800"
                >
                  회신 완료
                </Badge>
              )}
            </div>

            {/* 회신 품목 요약 */}
            <div className="space-y-1.5 mb-2">
              {resp.items.slice(0, 3).map((item, itemIdx) => (
                <div key={itemIdx} className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 truncate max-w-[180px]">
                    {item.itemName}
                  </span>
                  <div className="flex items-center gap-2 text-slate-400">
                    {item.unitPrice != null && (
                      <span className="font-medium text-slate-300">
                        ₩{item.unitPrice.toLocaleString()}
                      </span>
                    )}
                    {item.leadTimeDays != null && (
                      <span>{item.leadTimeDays}일</span>
                    )}
                    {item.inStock === false && (
                      <Badge variant="outline" className="text-[9px] h-3.5 px-1 text-red-500 border-red-800">
                        재고 없음
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
              {resp.items.length > 3 && (
                <p className="text-[10px] text-slate-400">
                  외 {resp.items.length - 3}건
                </p>
              )}
            </div>

            {/* 전체 요약 */}
            <div className="flex items-center gap-3 text-[11px] text-slate-500 pt-2 border-t border-slate-800">
              {resp.overallLeadTime != null && (
                <span>
                  납기{" "}
                  <span className="font-medium text-slate-300">
                    {resp.overallLeadTime}일
                  </span>
                </span>
              )}
              {resp.totalQuoted != null && (
                <span>
                  총액{" "}
                  <span className="font-medium text-slate-300">
                    ₩{resp.totalQuoted.toLocaleString()}
                  </span>
                </span>
              )}
              {resp.respondedAt && (
                <span className="ml-auto">{formatDate(resp.respondedAt)}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 6. 상태 전환 제안 섹션 ──
function StatusTransitionSection({
  proposal,
  onApprove,
}: {
  proposal: StatusTransitionProposal;
  onApprove?: (proposedStatus: string) => void;
}) {
  const statusLabels: Record<string, string> = {
    ORDERED: "접수대기",
    CONFIRMED: "확인됨",
    SHIPPING: "배송중",
    DELIVERED: "배송완료",
    CANCELLED: "취소됨",
  };

  const confidenceConfig: Record<string, { label: string; color: string }> = {
    high: { label: "높음", color: "bg-emerald-900/20 text-emerald-300 border-emerald-800 bg-emerald-950/30 text-emerald-400" },
    medium: { label: "보통", color: "bg-amber-950/30 text-amber-400 border-amber-800" },
    low: { label: "낮음", color: "bg-slate-900 border-slate-800 bg-slate-800 text-slate-400" },
  };

  const conf = confidenceConfig[proposal.confidence] || confidenceConfig.medium;

  return (
    <div className="p-5">
      <div className="flex items-center gap-2 mb-3">
        <ArrowRightLeft className="h-4 w-4 text-blue-500" />
        <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
          상태 변경 제안
        </h4>
      </div>

      <div className="rounded-lg border border-blue-800 bg-blue-950/20 p-3.5">
        {/* 상태 전환 표시 */}
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="outline" className="text-[11px] h-5 px-2 bg-slate-800 text-slate-400">
            {statusLabels[proposal.currentStatus] || proposal.currentStatus}
          </Badge>
          <ChevronRight className="h-3.5 w-3.5 text-blue-400" />
          <Badge variant="outline" className="text-[11px] h-5 px-2 bg-blue-900/30 border-blue-300 bg-blue-900/50 text-blue-300">
            {statusLabels[proposal.proposedStatus] || proposal.proposedStatus}
          </Badge>
          <Badge variant="outline" className={`text-[10px] h-4 px-1.5 ml-auto ${conf.color}`}>
            신뢰도: {conf.label}
          </Badge>
        </div>

        {/* 사유 */}
        <p className="text-xs text-slate-300 mb-2">
          {proposal.reason}
        </p>

        {/* 근거 */}
        {proposal.evidence.length > 0 && (
          <div className="space-y-1 mb-3">
            {proposal.evidence.map((ev, idx) => (
              <div key={idx} className="flex items-start gap-1.5 text-[11px] text-slate-400">
                <CheckCircle2 className="h-3 w-3 mt-0.5 text-blue-400 flex-shrink-0" />
                <span>{ev}</span>
              </div>
            ))}
          </div>
        )}

        {/* 승인 버튼 */}
        {onApprove && (
          <Button
            size="sm"
            className="w-full h-7 text-[11px] bg-blue-600 hover:bg-blue-700 text-white"
            onClick={() => onApprove(proposal.proposedStatus)}
          >
            <ArrowRightLeft className="h-3 w-3 mr-1" />
            상태를 &quot;{statusLabels[proposal.proposedStatus] || proposal.proposedStatus}&quot;(으)로 변경
          </Button>
        )}
      </div>
    </div>
  );
}

// ── 7. 최종 액션 (Sticky Bottom) ──
function StickyActions({
  data,
  actionId,
  onApproveFollowUp,
  onApproveStatusChange,
  onShowEmail,
}: {
  data: OrderAiPanelData;
  actionId?: string;
  onApproveFollowUp?: (actionId: string, payload: Record<string, unknown>) => void;
  onApproveStatusChange?: (proposedStatus: string) => void;
  onShowEmail: () => void;
}) {
  const [isSending, setIsSending] = useState(false);
  const hasFollowUp = !!data.followUpDraft;
  const hasStatusProposal = !!data.statusProposal;

  const handleSendFollowUp = async () => {
    if (!actionId || !onApproveFollowUp || !data.followUpDraft) return;
    setIsSending(true);
    try {
      await onApproveFollowUp(actionId, data.followUpDraft as unknown as Record<string, unknown>);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex-shrink-0 border-t border-slate-800 bg-[#161d2f] px-5 py-3">
      <div className="flex gap-2">
        {hasFollowUp && (
          <Button
            className="flex-1 h-9 text-xs bg-blue-600 hover:bg-blue-700 text-white"
            onClick={onShowEmail}
            disabled={isSending}
          >
            {isSending ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5 mr-1.5" />
            )}
            Follow-up 메일 검토
          </Button>
        )}

        {hasStatusProposal && onApproveStatusChange && (
          <Button
            variant="outline"
            className="flex-1 h-9 text-xs"
            onClick={() => onApproveStatusChange(data.statusProposal!.proposedStatus)}
          >
            <ArrowRightLeft className="h-3.5 w-3.5 mr-1.5" />
            상태 변경 승인
          </Button>
        )}

        {!hasFollowUp && !hasStatusProposal && (
          <div className="flex-1 flex items-center justify-center text-xs text-slate-400">
            <CheckCircle2 className="h-3.5 w-3.5 mr-1.5 text-emerald-400" />
            현재 추가 조치가 필요하지 않습니다
          </div>
        )}
      </div>
    </div>
  );
}

// ── Helpers ──

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}
