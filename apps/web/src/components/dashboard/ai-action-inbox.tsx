"use client";

import { useState } from "react";
import { useAiActions, useApproveAiAction, useDismissAiAction, type AiActionItem } from "@/hooks/use-ai-actions";
import { AiDraftPreviewDialog } from "@/components/ai/ai-draft-preview-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Mail,
  Package,
  ChevronRight,
  CheckCircle2,
  X,
  Loader2,
  AlertTriangle,
  Clock,
} from "lucide-react";

// ── 카드 타입별 설정 ──

interface CardConfig {
  icon: typeof FileText;
  iconBg: string;
  iconColor: string;
  borderColor: string;
  title: string;
  description: string;
  cta: string;
  badgeLabel: string;
  badgeClass: string;
}

const CARD_CONFIG: Record<string, CardConfig> = {
  QUOTE_DRAFT: {
    icon: FileText,
    iconBg: "bg-blue-50 dark:bg-blue-950/40",
    iconColor: "text-blue-600 dark:text-blue-400",
    borderColor: "border-l-blue-500",
    title: "견적 요청 초안이 준비되었습니다",
    description: "선택한 품목 기준으로 벤더 문의 초안을 만들었습니다. 수량과 납기만 확인하면 바로 요청할 수 있습니다.",
    cta: "견적 요청 검토하기",
    badgeLabel: "즉시 확인 필요",
    badgeClass: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400 border-red-200 dark:border-red-800",
  },
  VENDOR_EMAIL_DRAFT: {
    icon: Mail,
    iconBg: "bg-blue-50 dark:bg-blue-950/40",
    iconColor: "text-blue-600 dark:text-blue-400",
    borderColor: "border-l-blue-500",
    title: "벤더 이메일 초안이 준비되었습니다",
    description: "벤더에 보낼 견적 요청 이메일을 작성했습니다. 확인 후 발송할 수 있습니다.",
    cta: "이메일 초안 확인하기",
    badgeLabel: "즉시 확인 필요",
    badgeClass: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400 border-red-200 dark:border-red-800",
  },
  FOLLOWUP_DRAFT: {
    icon: Clock,
    iconBg: "bg-amber-50 dark:bg-amber-950/40",
    iconColor: "text-amber-600 dark:text-amber-400",
    borderColor: "border-l-amber-500",
    title: "회신 지연 주문이 있습니다",
    description: "회신 대기 중인 주문에 대해 follow-up 메일 초안을 준비했습니다.",
    cta: "follow-up 초안 확인하기",
    badgeLabel: "회신 대기",
    badgeClass: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200 dark:border-amber-800",
  },
  REORDER_SUGGESTION: {
    icon: Package,
    iconBg: "bg-orange-50 dark:bg-orange-950/40",
    iconColor: "text-orange-600 dark:text-orange-400",
    borderColor: "border-l-orange-500",
    title: "재발주 검토가 필요한 품목이 있습니다",
    description: "부족 재고와 사용 추이를 기준으로 우선 확인할 품목을 정리했습니다.",
    cta: "재발주 우선순위 보기",
    badgeLabel: "재고 위험",
    badgeClass: "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400 border-orange-200 dark:border-orange-800",
  },
  EXPIRY_ALERT: {
    icon: AlertTriangle,
    iconBg: "bg-red-50 dark:bg-red-950/40",
    iconColor: "text-red-600 dark:text-red-400",
    borderColor: "border-l-red-500",
    title: "유효기한 임박 품목이 있습니다",
    description: "만료 예정인 품목을 확인하고 필요한 조치를 검토하세요.",
    cta: "임박 품목 확인하기",
    badgeLabel: "오늘 처리 권장",
    badgeClass: "bg-yellow-50 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800",
  },
};

const DEFAULT_CONFIG: CardConfig = {
  icon: FileText,
  iconBg: "bg-slate-50 dark:bg-slate-800",
  iconColor: "text-slate-600 dark:text-slate-400",
  borderColor: "border-l-slate-400",
  title: "작업이 준비되었습니다",
  description: "",
  cta: "확인하기",
  badgeLabel: "오늘 처리 권장",
  badgeClass: "bg-slate-50 text-slate-600 border-slate-200",
};

// ── 시간 포맷 ──

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "방금";
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}

// ── 메인 컴포넌트 ──

export function AiActionInbox() {
  const { data, isLoading } = useAiActions({ status: "PENDING", limit: 5 });
  const approveMutation = useApproveAiAction();
  const dismissMutation = useDismissAiAction();

  const [previewItem, setPreviewItem] = useState<AiActionItem | null>(null);

  const items = data?.items || [];
  const pendingCount = data?.pendingCount || 0;

  // 로딩 스켈레톤
  if (isLoading) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800/50 bg-white dark:bg-[#161d2f] shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800/50">
          <div className="h-4 w-32 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
        </div>
        <div className="p-4 space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-20 rounded-lg bg-slate-50 dark:bg-slate-800/50 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // 빈 상태
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800/50 bg-white dark:bg-[#161d2f] shadow-sm overflow-hidden">
        <div className="px-4 py-6 text-center">
          <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            지금 바로 확인할 AI 작업이 없습니다
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            견적 요청, 주문 회신, 재고 위험 항목이 생기면 여기에서 바로 확인할 수 있습니다.
          </p>
        </div>
      </div>
    );
  }

  const handleReview = (item: AiActionItem) => {
    setPreviewItem(item);
  };

  const handleApprove = async (modified: { emailBody: string; emailSubject?: string }) => {
    if (!previewItem) return;

    const payload = (previewItem.payload || {}) as Record<string, unknown>;
    await approveMutation.mutateAsync({
      id: previewItem.id,
      payload: {
        ...payload,
        emailBody: modified.emailBody,
        emailSubject: modified.emailSubject || payload.emailSubject,
      },
    });

    setPreviewItem(null);
  };

  const handleDismiss = async (id: string) => {
    await dismissMutation.mutateAsync(id);
  };

  return (
    <>
      <div className="rounded-xl border border-slate-200 dark:border-slate-800/50 bg-white dark:bg-[#161d2f] shadow-sm overflow-hidden">
        {/* 헤더 */}
        <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2 flex-shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
            </span>
            <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              AI 작업함
            </h3>
            <Badge
              variant="secondary"
              className="h-5 min-w-[20px] px-1.5 text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
            >
              {pendingCount}
            </Badge>
          </div>
        </div>

        {/* 카드 목록 */}
        <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
          {items.map((item) => {
            const config = CARD_CONFIG[item.type] || DEFAULT_CONFIG;
            const IconComp = config.icon;
            const payload = (item.payload || {}) as Record<string, unknown>;
            const isDismissing = dismissMutation.isPending;

            return (
              <div
                key={item.id}
                className={`px-4 py-3 border-l-[3px] ${config.borderColor} hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors`}
              >
                <div className="flex items-start gap-3">
                  {/* 아이콘 */}
                  <div className={`flex-shrink-0 rounded-lg p-2 ${config.iconBg}`}>
                    <IconComp className={`h-4 w-4 ${config.iconColor}`} />
                  </div>

                  {/* 내용 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h4 className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                        {item.title || config.title}
                      </h4>
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 flex-shrink-0 ${config.badgeClass}`}>
                        {config.badgeLabel}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                      {item.description || config.description}
                    </p>

                    {/* 액션 영역 */}
                    <div className="flex items-center gap-2 mt-2">
                      <Button
                        variant="default"
                        size="sm"
                        className="h-7 text-[11px] px-3 bg-blue-600 hover:bg-blue-700 text-white"
                        onClick={() => handleReview(item)}
                      >
                        {config.cta}
                        <ChevronRight className="h-3 w-3 ml-1" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-[11px] px-2 text-slate-400 hover:text-slate-600"
                        onClick={() => handleDismiss(item.id)}
                        disabled={isDismissing}
                      >
                        {isDismissing ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3 mr-0.5" />}
                        무시
                      </Button>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-auto">
                        {timeAgo(item.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 미리보기 다이얼로그 */}
      {previewItem && (
        <AiDraftPreviewDialog
          open={!!previewItem}
          onOpenChange={(open) => !open && setPreviewItem(null)}
          title={previewItem.title || CARD_CONFIG[previewItem.type]?.title || "작업 검토"}
          emailSubject={((previewItem.payload || {}) as Record<string, unknown>).emailSubject as string}
          emailBody={((previewItem.payload || {}) as Record<string, unknown>).emailBody as string || ""}
          metadata={{
            vendorName: ((previewItem.payload || {}) as Record<string, unknown>).vendorName as string,
            itemCount: (((previewItem.payload || {}) as Record<string, unknown>).items as unknown[])?.length,
            deliveryDate: ((previewItem.payload || {}) as Record<string, unknown>).suggestedDeliveryDate as string,
          }}
          onApprove={handleApprove}
          isApproving={approveMutation.isPending}
        />
      )}
    </>
  );
}
