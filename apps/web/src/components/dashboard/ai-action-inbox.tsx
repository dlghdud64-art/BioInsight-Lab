"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAiActions, useApproveAiAction, useDismissAiAction, type AiActionItem } from "@/hooks/use-ai-actions";
import { AiDraftPreviewDialog } from "@/components/ai/ai-draft-preview-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ActivityStatusLine } from "@/components/ai/activity-timeline";
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
  /** 승인 후 토스트 메시지 */
  approveToast: string;
  /** 승인 후 이동 경로 */
  approveHref?: string;
}

const CARD_CONFIG: Record<string, CardConfig> = {
  QUOTE_DRAFT: {
    icon: FileText,
    iconBg: "bg-blue-50  bg-blue-950/40",
    iconColor: "text-blue-600 text-blue-400",
    borderColor: "border-l-blue-500",
    title: "견적 요청 초안이 준비되었습니다",
    description: "선택한 품목 기준으로 벤더 문의 초안을 만들었습니다. 수량과 납기만 확인하면 바로 요청할 수 있습니다.",
    cta: "견적 요청 검토하기",
    badgeLabel: "즉시 확인 필요",
    badgeClass: "bg-red-50 text-red-700  bg-red-950/40 text-red-400 border-red-200  border-red-800",
    approveToast: "견적 요청이 생성되었습니다",
    approveHref: "/dashboard/quotes",
  },
  VENDOR_EMAIL_DRAFT: {
    icon: Mail,
    iconBg: "bg-blue-50  bg-blue-950/40",
    iconColor: "text-blue-600 text-blue-400",
    borderColor: "border-l-blue-500",
    title: "벤더 이메일 초안이 준비되었습니다",
    description: "벤더에 보낼 견적 요청 이메일을 작성했습니다. 확인 후 발송할 수 있습니다.",
    cta: "이메일 초안 확인하기",
    badgeLabel: "즉시 확인 필요",
    badgeClass: "bg-red-50 text-red-700  bg-red-950/40 text-red-400 border-red-200  border-red-800",
    approveToast: "이메일 초안이 승인되었습니다",
  },
  FOLLOWUP_DRAFT: {
    icon: Clock,
    iconBg: "bg-amber-50  bg-amber-950/40",
    iconColor: "text-amber-600 text-amber-400",
    borderColor: "border-l-amber-500",
    title: "회신 지연 주문이 있습니다",
    description: "회신 대기 중인 주문에 대해 follow-up 메일 초안을 준비했습니다.",
    cta: "follow-up 초안 확인하기",
    badgeLabel: "회신 대기",
    badgeClass: "bg-amber-50 text-amber-700  bg-amber-950/40 text-amber-400 border-amber-200  border-amber-800",
    approveToast: "Follow-up 메일이 승인되었습니다",
    approveHref: "/dashboard/orders",
  },
  STATUS_CHANGE_SUGGEST: {
    icon: Clock,
    iconBg: "bg-purple-50  bg-purple-950/40",
    iconColor: "text-purple-600 text-purple-400",
    borderColor: "border-l-purple-500",
    title: "주문 상태 변경 제안",
    description: "벤더 회신을 분석하여 주문 상태 변경을 제안합니다.",
    cta: "상태 변경안 검토하기",
    badgeLabel: "상태 변경 제안",
    badgeClass: "bg-purple-50 text-purple-700  bg-purple-950/40 text-purple-400 border-purple-200  border-purple-800",
    approveToast: "주문 상태가 변경되었습니다",
    approveHref: "/dashboard/orders",
  },
  REORDER_SUGGESTION: {
    icon: Package,
    iconBg: "bg-orange-50  bg-orange-950/40",
    iconColor: "text-orange-600 text-orange-400",
    borderColor: "border-l-orange-500",
    title: "재발주 검토가 필요한 품목이 있습니다",
    description: "부족 재고와 사용 추이를 기준으로 우선 확인할 품목을 정리했습니다.",
    cta: "재발주 우선순위 보기",
    badgeLabel: "재고 위험",
    badgeClass: "bg-orange-50 text-orange-700  bg-orange-950/40 text-orange-400 border-orange-200  border-orange-800",
    approveToast: "재발주 요청이 승인되었습니다",
    approveHref: "/dashboard/inventory",
  },
  EXPIRY_ALERT: {
    icon: AlertTriangle,
    iconBg: "bg-red-50  bg-red-950/40",
    iconColor: "text-red-600 text-red-400",
    borderColor: "border-l-red-500",
    title: "유효기한 임박 품목이 있습니다",
    description: "만료 예정인 품목을 확인하고 필요한 조치를 검토하세요.",
    cta: "임박 품목 확인하기",
    badgeLabel: "오늘 처리 권장",
    badgeClass: "bg-yellow-50 text-yellow-700  bg-yellow-950/40  text-yellow-400 border-yellow-200  border-yellow-800",
    approveToast: "조치가 확인되었습니다",
    approveHref: "/dashboard/inventory",
  },
};

const DEFAULT_CONFIG: CardConfig = {
  icon: FileText,
  iconBg: "bg-[#222226]",
  iconColor: "text-slate-400",
  borderColor: "border-l-slate-400",
  title: "작업이 준비되었습니다",
  description: "",
  cta: "확인하기",
  badgeLabel: "오늘 처리 권장",
  badgeClass: "bg-[#111114] text-slate-600 border-[#2a2a2e]",
  approveToast: "작업이 완료되었습니다",
};

// ── 승인 단계 배지 ──

const STAGE_CONFIG: Record<string, { label: string; className: string }> = {
  QUOTE_DRAFT: {
    label: "검토 필요",
    className: "bg-orange-50 text-orange-700  bg-orange-950/40 text-orange-400 border-orange-200  border-orange-800",
  },
  VENDOR_EMAIL_DRAFT: {
    label: "검토 필요",
    className: "bg-orange-50 text-orange-700  bg-orange-950/40 text-orange-400 border-orange-200  border-orange-800",
  },
  FOLLOWUP_DRAFT: {
    label: "응답 대기",
    className: "bg-amber-50 text-amber-700  bg-amber-950/40 text-amber-400 border-amber-200  border-amber-800",
  },
  STATUS_CHANGE_SUGGEST: {
    label: "승인 필요",
    className: "bg-purple-50 text-purple-700  bg-purple-950/40 text-purple-400 border-purple-200  border-purple-800",
  },
  REORDER_SUGGESTION: {
    label: "조치 필요",
    className: "bg-red-50 text-red-700  bg-red-950/40 text-red-400 border-red-200  border-red-800",
  },
  EXPIRY_ALERT: {
    label: "확인 필요",
    className: "bg-yellow-50 text-yellow-700  bg-yellow-950/40  text-yellow-400 border-yellow-200  border-yellow-800",
  },
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
  const router = useRouter();
  const { toast } = useToast();
  const { data, isLoading } = useAiActions({ status: "PENDING", limit: 5 });
  const approveMutation = useApproveAiAction();
  const dismissMutation = useDismissAiAction();

  const [previewItem, setPreviewItem] = useState<AiActionItem | null>(null);
  // 모바일: 확장된 카드 ID
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const items = data?.items || [];
  const pendingCount = data?.pendingCount || 0;

  // 로딩 스켈레톤
  if (isLoading) {
    return (
      <div className="rounded-xl border border-[#2a2a2e] bg-[#1a1a1e] shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 border-[#2a2a2e]">
          <div className="h-4 w-32 rounded bg-[#222226] animate-pulse" />
        </div>
        <div className="p-4 space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-20 rounded-lg bg-[#222226]/50 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // 빈 상태
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-[#2a2a2e] bg-[#1a1a1e] shadow-sm overflow-hidden">
        <div className="px-4 py-6 text-center">
          <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-300">
            지금 바로 확인할 AI 작업이 없습니다
          </p>
          <p className="text-xs text-slate-400 text-slate-500 mt-1">
            견적 요청, 주문 회신, 재고 위험 항목이 생기면 여기에서 바로 확인할 수 있습니다.
          </p>
        </div>
      </div>
    );
  }

  const handleReview = (item: AiActionItem) => {
    // 이메일 초안 타입: PreviewDialog 모달 오픈
    if (["QUOTE_DRAFT", "VENDOR_EMAIL_DRAFT", "FOLLOWUP_DRAFT", "STATUS_CHANGE_SUGGEST"].includes(item.type)) {
      setPreviewItem(item);
      return;
    }

    // 재고/만료 타입: 해당 도메인 페이지로 이동
    const config = CARD_CONFIG[item.type] || DEFAULT_CONFIG;
    if (config.approveHref) {
      const href = item.relatedEntityId
        ? `${config.approveHref}?aiAction=${item.id}`
        : config.approveHref;
      router.push(href);
    } else {
      setPreviewItem(item);
    }
  };

  const handleApprove = async (modified: { emailBody: string; emailSubject?: string }) => {
    if (!previewItem) return;

    const payload = (previewItem.payload || {}) as Record<string, unknown>;
    const config = CARD_CONFIG[previewItem.type] || DEFAULT_CONFIG;

    try {
      const result = await approveMutation.mutateAsync({
        id: previewItem.id,
        payload: {
          ...payload,
          emailBody: modified.emailBody,
          emailSubject: modified.emailSubject || payload.emailSubject,
        },
      });

      setPreviewItem(null);

      // 결과 기반 피드백 토스트
      const resultData = result?.result as Record<string, unknown> | undefined;
      if (resultData?.quoteId) {
        toast({
          title: config.approveToast,
          description: "견적 목록에서 확인할 수 있습니다.",
        });
      } else {
        toast({ title: config.approveToast });
      }
    } catch {
      toast({
        title: "승인 실패",
        description: "잠시 후 다시 시도해 주세요.",
        variant: "destructive",
      });
    }
  };

  const handleDismiss = async (id: string) => {
    try {
      await dismissMutation.mutateAsync(id);
    } catch {
      toast({
        title: "처리 실패",
        description: "잠시 후 다시 시도해 주세요.",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <div className="rounded-xl border border-[#2a2a2e] bg-[#1a1a1e] shadow-sm overflow-hidden">
        {/* 헤더 */}
        <div className="px-4 py-2.5 border-b border-slate-100 border-[#2a2a2e] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2 flex-shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
            </span>
            <h3 className="text-xs font-semibold text-slate-300">
              AI 작업함
            </h3>
            <Badge
              variant="secondary"
              className="h-5 min-w-[20px] px-1.5 text-[10px] font-bold bg-blue-100 text-blue-700  bg-blue-900/40  text-blue-300"
            >
              {pendingCount}
            </Badge>
          </div>
        </div>

        {/* 카드 목록 */}
        <div className="divide-y divide-[#2a2a2e]/50">
          {items.map((item) => {
            const config = CARD_CONFIG[item.type] || DEFAULT_CONFIG;
            const IconComp = config.icon;
            const isItemDismissing = dismissMutation.isPending && dismissMutation.variables === item.id;

            return (
              <div
                key={item.id}
                className={`px-4 py-3 border-l-[3px] ${config.borderColor} hover:bg-[#111114]/50 hover:bg-[#222226]/20 transition-all duration-200`}
              >
                <div
                  className="flex items-start gap-3 cursor-pointer md:cursor-default"
                  onClick={() => {
                    // 모바일에서만 토글
                    if (typeof window !== "undefined" && window.innerWidth < 768) {
                      setExpandedId(expandedId === item.id ? null : item.id);
                    }
                  }}
                >
                  {/* 아이콘 */}
                  <div className={`flex-shrink-0 rounded-lg p-2 ${config.iconBg}`}>
                    <IconComp className={`h-4 w-4 ${config.iconColor}`} />
                  </div>

                  {/* 내용 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h4 className="text-sm font-medium text-slate-200 truncate">
                        {item.title || config.title}
                      </h4>
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 flex-shrink-0 ${config.badgeClass}`}>
                        {config.badgeLabel}
                      </Badge>
                      {STAGE_CONFIG[item.type] && (
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 flex-shrink-0 hidden sm:inline-flex ${STAGE_CONFIG[item.type].className}`}>
                          {STAGE_CONFIG[item.type].label}
                        </Badge>
                      )}
                    </div>

                    {/* 설명: 모바일에서는 확장 시에만 표시 */}
                    <p className={`text-xs text-slate-400 line-clamp-2 ${
                      expandedId !== item.id ? "hidden md:block" : ""
                    }`}>
                      {item.description || config.description}
                    </p>

                    {/* 활동 상태 1줄 요약 */}
                    <ActivityStatusLine
                      entityType="AI_ACTION"
                      entityId={item.id}
                      className={`mt-1 ${expandedId !== item.id ? "hidden md:flex" : "flex"}`}
                    />

                    {/* 액션 영역: 모바일에서는 확장 시에만 표시 */}
                    <div className={`flex items-center gap-2 mt-2 ${
                      expandedId !== item.id ? "hidden md:flex" : "flex"
                    }`}>
                      <Button
                        variant="default"
                        size="sm"
                        className="h-7 text-[11px] px-3 bg-blue-600 hover:bg-blue-700 text-white"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReview(item);
                        }}
                      >
                        {config.cta}
                        <ChevronRight className="h-3 w-3 ml-1" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-[11px] px-2 text-slate-400 hover:text-slate-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDismiss(item.id);
                        }}
                        disabled={isItemDismissing}
                      >
                        {isItemDismissing ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3 mr-0.5" />}
                        무시
                      </Button>
                      <span className="text-[10px] text-slate-400 text-slate-500 ml-auto">
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
