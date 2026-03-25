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
  FileText,
  Package,
  Users,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ChevronRight,
  RefreshCw,
  Mail,
  Building2,
  Truck,
  ShieldAlert,
  Loader2,
  TriangleAlert,
  Send,
} from "lucide-react";
import { AiDraftPreviewDialog } from "./ai-draft-preview-dialog";
import type {
  PanelState,
  QuoteAiPanelData,
  RecommendedVendor,
  ValidationIssue,
} from "@/hooks/use-quote-ai-panel";

// ── Props ──

interface QuoteAiAssistantPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: PanelState;
  data: QuoteAiPanelData;
  actionId?: string;
  onRegenerate: () => void;
  onApprove?: (actionId: string, payload: Record<string, unknown>) => void;
  onFixIssue?: (field: string) => void;
  isGenerating: boolean;
  error?: string;
}

export function QuoteAiAssistantPanel({
  open,
  onOpenChange,
  state,
  data,
  actionId,
  onRegenerate,
  onApprove,
  onFixIssue,
  isGenerating,
  error,
}: QuoteAiAssistantPanelProps) {
  const [emailPreviewOpen, setEmailPreviewOpen] = useState(false);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-[440px] p-0 flex flex-col overflow-hidden"
        >
          {/* ═══ 1. 헤더 ═══ */}
          <SheetHeader className="px-5 pt-5 pb-3 border-b border-[#2a2a2e]/50 flex-shrink-0">
            <SheetTitle className="text-base font-bold text-slate-100">
              {state === "empty" && "AI 요청 준비"}
              {state === "loading" && "견적 요청 도우미"}
              {state === "success" && "견적 요청 도우미"}
              {state === "warning" && "견적 요청 도우미"}
              {state === "error" && "초안을 준비하지 못했습니다"}
            </SheetTitle>
            <SheetDescription className="text-xs text-slate-400 mt-0.5">
              {state === "empty" && "품목을 선택하면 견적 요청 초안을 준비합니다."}
              {state === "loading" && "선택한 품목 기준으로 견적 요청 초안을 정리하고 있습니다..."}
              {state === "success" && "선택한 품목 기준으로 견적 요청 초안을 정리했습니다."}
              {state === "warning" && "초안이 준비되었지만 확인이 필요한 항목이 있습니다."}
              {state === "error" && "품목 정보와 벤더 정보를 확인한 뒤 다시 시도해 주세요."}
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
              <ErrorState error={error} onRetry={onRegenerate} />
            )}

            {/* ── Success / Warning State ── */}
            {(state === "success" || state === "warning") && (
              <div className="divide-y divide-slate-800/50">
                {/* 2. 요약 섹션 */}
                <SummarySection data={data} />

                {/* 3. 추천 벤더 섹션 */}
                {data.vendors.length > 0 && (
                  <VendorSection vendors={data.vendors} />
                )}

                {/* 4. 요청 초안 섹션 */}
                {data.draft && (
                  <DraftSection
                    draft={data.draft}
                    onRegenerate={onRegenerate}
                    onShowEmail={() => setEmailPreviewOpen(true)}
                    isGenerating={isGenerating}
                  />
                )}

                {/* 5. 확인 필요한 항목 */}
                {data.validationIssues.length > 0 && (
                  <ValidationSection
                    issues={data.validationIssues}
                    onFix={onFixIssue}
                    isWarningState={state === "warning"}
                  />
                )}
              </div>
            )}
          </div>

          {/* ═══ 6. 최종 액션 (Sticky Bottom) ═══ */}
          {(state === "success" || state === "warning") && (
            <StickyActions
              actionId={actionId}
              draft={data.draft}
              onApprove={onApprove}
              onShowEmail={() => setEmailPreviewOpen(true)}
              hasErrors={data.validationIssues.some(
                (i) => i.severity === "error"
              )}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* 이메일 미리보기 다이얼로그 */}
      {data.draft && (
        <AiDraftPreviewDialog
          open={emailPreviewOpen}
          onOpenChange={setEmailPreviewOpen}
          title="견적 요청 이메일 초안"
          emailSubject={data.draft.emailSubject}
          emailBody={data.draft.emailBody}
          metadata={{
            itemCount: data.items.length,
            deliveryDate: data.draft.suggestedDeliveryDate,
          }}
          onApprove={(modified) => {
            if (actionId && onApprove) {
              onApprove(actionId, {
                ...data.draft,
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
      <div className="rounded-full bg-[#222226]/50 p-4 mb-4">
        <FileText className="h-8 w-8 text-slate-600" />
      </div>
      <p className="text-sm font-medium text-slate-400">
        품목을 선택하면 여기에서 확인할 수 있습니다
      </p>
      <p className="text-xs text-slate-500 mt-1.5 max-w-[240px]">
        비교 화면에서 품목을 선택하고 수량을 입력하면 견적 초안이 자동으로 준비됩니다.
      </p>
    </div>
  );
}

// ── Loading State ──
function LoadingState() {
  return (
    <div className="p-5 space-y-5">
      {/* 요약 스켈레톤 */}
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="p-3 rounded-lg bg-[#222226]/30">
            <Skeleton className="h-3 w-16 mb-2" />
            <Skeleton className="h-6 w-10" />
          </div>
        ))}
      </div>

      <Separator />

      {/* 벤더 스켈레톤 */}
      <div>
        <Skeleton className="h-3 w-24 mb-3" />
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="p-3 rounded-lg border border-[#2a2a2e]">
              <Skeleton className="h-4 w-32 mb-2" />
              <Skeleton className="h-3 w-full mb-1" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* 초안 스켈레톤 */}
      <div>
        <Skeleton className="h-3 w-20 mb-3" />
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
        초안 생성에 실패했습니다
      </p>
      <p className="text-xs text-slate-500 mt-1.5 max-w-[260px]">
        {error || "품목 정보와 벤더 정보를 확인한 뒤 다시 시도해 주세요."}
      </p>
      <Button
        variant="outline"
        size="sm"
        className="mt-4 h-8 text-xs"
        onClick={onRetry}
      >
        <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
        다시 준비하기
      </Button>
    </div>
  );
}

// ── 2. 요약 섹션 ──
function SummarySection({ data }: { data: QuoteAiPanelData }) {
  const errorCount = data.validationIssues.filter(
    (v) => v.severity === "error"
  ).length;
  const warningCount = data.validationIssues.filter(
    (v) => v.severity === "warning"
  ).length;
  const issueCount = errorCount + warningCount;

  const stats = [
    {
      icon: Package,
      label: "선택 품목",
      value: `${data.items.length}건`,
      color: "text-blue-400",
      bg: "bg-blue-950/30",
    },
    {
      icon: Users,
      label: "추천 벤더",
      value: `${data.vendors.length}곳`,
      color: "text-emerald-400",
      bg: "bg-emerald-950/30",
    },
    {
      icon: issueCount > 0 ? AlertTriangle : CheckCircle2,
      label: "누락 항목",
      value: issueCount > 0 ? `${issueCount}건` : "없음",
      color: issueCount > 0
        ? "text-amber-400"
        : "text-emerald-400",
      bg: issueCount > 0
        ? "bg-amber-950/30"
        : "bg-emerald-950/30",
    },
    {
      icon: Clock,
      label: "예상 리드타임",
      value: data.estimatedLeadTime
        ? `${data.estimatedLeadTime.min}~${data.estimatedLeadTime.max}일`
        : "미정",
      color: "text-slate-400",
      bg: "bg-[#222226]/30",
    },
  ];

  return (
    <div className="p-5">
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
              <p className={`text-lg font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── 3. 추천 벤더 섹션 ──
function VendorSection({ vendors }: { vendors: RecommendedVendor[] }) {
  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
          추천 벤더
        </h4>
      </div>
      <p className="text-[11px] text-slate-500 mb-3">
        최근 주문 이력과 응답 가능성을 기준으로 정리했습니다
      </p>

      <div className="space-y-2">
        {vendors.map((vendor, idx) => (
          <div
            key={idx}
            className="p-3 rounded-lg border border-[#2a2a2e] bg-[#1a1a1e]/50 hover:border-blue-800 transition-colors"
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <Building2 className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-sm font-medium text-slate-200">
                  {vendor.vendorName}
                </span>
              </div>
              {vendor.contactAvailable ? (
                <Badge
                  variant="outline"
                  className="text-[10px] h-4 px-1.5 bg-emerald-950/30 text-emerald-400 border-emerald-800"
                >
                  연락 가능
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="text-[10px] h-4 px-1.5 text-slate-400 border-bd"
                >
                  미확인
                </Badge>
              )}
            </div>

            <p className="text-[11px] text-slate-400 mb-2">
              {vendor.reason}
            </p>

            <div className="flex items-center gap-3 text-[11px] text-slate-500">
              {vendor.recentPrice != null && (
                <span>
                  최근 단가{" "}
                  <span className="font-medium text-slate-300">
                    {vendor.recentPrice.toLocaleString()}원
                  </span>
                </span>
              )}
              {vendor.leadTimeDays != null && (
                <span>
                  납기{" "}
                  <span className="font-medium text-slate-300">
                    {vendor.leadTimeDays}일
                  </span>
                </span>
              )}
              {vendor.moq != null && (
                <span>
                  MOQ{" "}
                  <span className="font-medium text-slate-300">
                    {vendor.moq}
                  </span>
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 4. 요청 초안 섹션 ──
function DraftSection({
  draft,
  onRegenerate,
  onShowEmail,
  isGenerating,
}: {
  draft: QuoteAiPanelData["draft"];
  onRegenerate: () => void;
  onShowEmail: () => void;
  isGenerating: boolean;
}) {
  if (!draft) return null;

  // 이메일 본문에서 핵심 정보 추출 (첫 5줄만 미리보기)
  const bodyPreview = draft.emailBody
    .split("\n")
    .filter((line) => line.trim())
    .slice(0, 5)
    .join("\n");

  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
          요청 초안
        </h4>
      </div>

      {/* 초안 미리보기 */}
      <div className="rounded-lg border border-[#2a2a2e] bg-[#1a1a1e]/30 p-3.5 mb-3">
        {/* 제목 */}
        <div className="flex items-center gap-2 mb-2">
          <Mail className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-xs font-medium text-slate-300 truncate">
            {draft.emailSubject}
          </span>
        </div>

        {/* 품목 요약 */}
        <div className="flex items-center gap-2 mb-2">
          <Package className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-[11px] text-slate-400">
            {draft.items.length}개 품목 · 수량{" "}
            {draft.items.reduce((sum, item) => sum + item.quantity, 0)}
            {draft.items[0]?.unit || "ea"}
          </span>
        </div>

        {/* 납기 */}
        {draft.suggestedDeliveryDate && (
          <div className="flex items-center gap-2 mb-2">
            <Truck className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-[11px] text-slate-400">
              희망 납기 {draft.suggestedDeliveryDate}
            </span>
          </div>
        )}

        {/* 본문 미리보기 */}
        <div className="mt-2 pt-2 border-t border-[#333338]/50">
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
          초안 다시 정리하기
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-[11px] flex-1"
          onClick={onShowEmail}
        >
          <Mail className="h-3 w-3 mr-1" />
          메일 초안 보기
        </Button>
      </div>
    </div>
  );
}

// ── 5. 확인 필요한 항목 ──
function ValidationSection({
  issues,
  onFix,
  isWarningState,
}: {
  issues: ValidationIssue[];
  onFix?: (field: string) => void;
  isWarningState: boolean;
}) {
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");

  return (
    <div
      className={`p-5 ${
        isWarningState
          ? "bg-amber-950/10"
          : ""
      }`}
    >
      <div className="flex items-center gap-2 mb-3">
        <ShieldAlert
          className={`h-4 w-4 ${
            errors.length > 0
              ? "text-red-500"
              : "text-amber-500"
          }`}
        />
        <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
          확인 필요한 항목
        </h4>
        <Badge
          variant="outline"
          className={`text-[10px] h-4 px-1.5 ${
            errors.length > 0
              ? "bg-red-950/30 text-red-400 border-red-200"
              : "bg-amber-950/30 text-amber-400 border-amber-200"
          }`}
        >
          {issues.length}건
        </Badge>
      </div>

      <div className="space-y-2">
        {/* 에러 먼저 */}
        {errors.map((issue, idx) => (
          <IssueCard key={`err-${idx}`} issue={issue} onFix={onFix} />
        ))}
        {warnings.map((issue, idx) => (
          <IssueCard key={`warn-${idx}`} issue={issue} onFix={onFix} />
        ))}
      </div>
    </div>
  );
}

function IssueCard({
  issue,
  onFix,
}: {
  issue: ValidationIssue;
  onFix?: (field: string) => void;
}) {
  const isError = issue.severity === "error";

  return (
    <div
      className={`flex items-center justify-between p-2.5 rounded-lg border ${
        isError
          ? "border-red-800/50 bg-red-950/20"
          : "border-amber-800/50 bg-amber-950/20"
      }`}
    >
      <div className="flex items-center gap-2">
        <AlertTriangle
          className={`h-3.5 w-3.5 flex-shrink-0 ${
            isError ? "text-red-500" : "text-amber-500"
          }`}
        />
        <span className="text-xs text-slate-300">
          {issue.message}
        </span>
      </div>
      {onFix && (
        <button
          className={`text-[11px] font-medium flex-shrink-0 ml-2 ${
            isError
              ? "text-red-600 hover:text-red-700"
              : "text-amber-600 hover:text-amber-700"
          }`}
          onClick={() => onFix(issue.field)}
        >
          수정하기
        </button>
      )}
    </div>
  );
}

// ── 6. 최종 액션 (Sticky Bottom) ──
function StickyActions({
  actionId,
  draft,
  onApprove,
  onShowEmail,
  hasErrors,
}: {
  actionId?: string;
  draft: QuoteAiPanelData["draft"];
  onApprove?: (actionId: string, payload: Record<string, unknown>) => void;
  onShowEmail: () => void;
  hasErrors: boolean;
}) {
  const [isApproving, setIsApproving] = useState(false);

  const handleApprove = async () => {
    if (!actionId || !draft || !onApprove) return;
    setIsApproving(true);
    try {
      await onApprove(actionId, draft as unknown as Record<string, unknown>);
    } finally {
      setIsApproving(false);
    }
  };

  return (
    <div className="flex-shrink-0 border-t border-slate-200 dark:border-[#2a2a2e] bg-white dark:bg-[#1a1a1e] px-5 py-3">
      <div className="flex gap-2">
        <Button
          className="flex-1 h-9 text-xs bg-blue-600 hover:bg-blue-700 text-white"
          onClick={handleApprove}
          disabled={hasErrors || !actionId || isApproving}
        >
          {isApproving ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5 mr-1.5" />
          )}
          견적 요청 검토하기
        </Button>
        <Button
          variant="outline"
          className="flex-1 h-9 text-xs"
          onClick={onShowEmail}
          disabled={!draft}
        >
          <Mail className="h-3.5 w-3.5 mr-1.5" />
          메일 초안 생성
        </Button>
      </div>

      {hasErrors && (
        <p className="text-[10px] text-red-500 mt-2 text-center">
          누락 항목을 수정한 뒤 견적 요청을 진행할 수 있습니다
        </p>
      )}
    </div>
  );
}
