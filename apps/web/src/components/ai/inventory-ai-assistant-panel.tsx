"use client";

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
  RefreshCw,
  Building2,
  Loader2,
  TriangleAlert,
  ShieldAlert,
  Beaker,
  CalendarClock,
  TrendingDown,
  ShoppingCart,
  Trash2,
  Eye,
  ArrowRight,
  FlaskConical,
  Replace,
  Timer,
  MapPin,
} from "lucide-react";
import type {
  InventoryPanelState,
  InventoryAiPanelData,
  InventoryIssue,
  ReorderRecommendation,
  LotInfo,
  BusinessImpact,
} from "@/hooks/use-inventory-ai-panel";

// ── Props ──

interface InventoryAiAssistantPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: InventoryPanelState;
  data: InventoryAiPanelData;
  onRetry: () => void;
  onReviewReorder?: (recommendation: ReorderRecommendation) => void;
  onViewVendors?: (productName: string) => void;
  onViewLotDetail?: (lotNumber: string) => void;
  onReviewDisposal?: (lotNumber: string) => void;
  onCreatePurchaseRequest?: () => void;
  onViewActions?: () => void;
  isAnalyzing: boolean;
}

export function InventoryAiAssistantPanel({
  open,
  onOpenChange,
  state,
  data,
  onRetry,
  onReviewReorder,
  onViewVendors,
  onViewLotDetail,
  onReviewDisposal,
  onCreatePurchaseRequest,
  onViewActions,
  isAnalyzing,
}: InventoryAiAssistantPanelProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* Overlay: reduced opacity for clearer drawer separation */}
      <SheetContent
        side="right"
        className="w-full sm:max-w-[440px] p-0 flex flex-col overflow-hidden bg-[#1e2530] border-l border-slate-700/50"
      >
        {/* 1. Header */}
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-slate-700/60 flex-shrink-0">
          <SheetTitle className="text-base font-bold text-slate-50">
            {state === "empty" && "재고 운영 도우미"}
            {state === "loading" && "재고 운영 도우미"}
            {state === "success" && "재고 운영 도우미"}
            {state === "warning_shortage" && "재고 운영 도우미"}
            {state === "warning_expiry" && "재고 운영 도우미"}
            {state === "error" && "재고 조치 정보를 준비하지 못했습니다"}
          </SheetTitle>
          <SheetDescription className="text-xs text-slate-400 mt-0.5">
            {state === "empty" && "재고 품목을 선택하면 부족, 유효기간, 재발주 항목을 정리합니다."}
            {state === "loading" && "현재 재고 상태를 기준으로 조치 항목을 확인하고 있습니다..."}
            {state === "success" && "현재 재고 상태를 기준으로 우선 확인할 부족·유효기간·재발주 항목을 정리했습니다."}
            {state === "warning_shortage" && "부족 재고가 감지되었습니다. 재발주 검토가 필요합니다."}
            {state === "warning_expiry" && "유효기간 임박 또는 만료 Lot가 있습니다. 확인이 필요합니다."}
            {state === "error" && "재고 수량, lot, 입고 예정 정보를 확인한 뒤 다시 시도해 주세요."}
          </SheetDescription>
        </SheetHeader>

        {/* Scroll area */}
        <div className="flex-1 overflow-y-auto">
          {state === "empty" && <EmptyState />}
          {state === "loading" && <LoadingState />}
          {state === "error" && <ErrorState onRetry={onRetry} />}

          {(state === "success" || state === "warning_shortage" || state === "warning_expiry") && (
            <div className="divide-y divide-slate-700/40">
              {/* 2. Stock risk summary */}
              {data.stockStatus && (
                <StockSummarySection
                  stockStatus={data.stockStatus}
                  item={data.item}
                />
              )}

              {/* 3. Issues requiring attention */}
              {data.issues.length > 0 && (
                <IssueWarningsSection
                  issues={data.issues}
                  isShortage={state === "warning_shortage"}
                />
              )}

              {/* 4. Reorder priority */}
              {data.reorderRecommendation && (
                <ReorderSection
                  recommendation={data.reorderRecommendation}
                  onReviewReorder={onReviewReorder}
                  onViewVendors={onViewVendors}
                  isHighlighted={state === "warning_shortage"}
                />
              )}

              {/* 5. Lot & expiry check */}
              {data.lots.length > 0 && (
                <LotExpirySection
                  lots={data.lots}
                  onViewDetail={onViewLotDetail}
                  onReviewDisposal={onReviewDisposal}
                  isHighlighted={state === "warning_expiry"}
                />
              )}

              {/* 6. Business impact */}
              {data.impacts.length > 0 && (
                <BusinessImpactSection
                  impacts={data.impacts}
                  isHighlighted={state === "warning_shortage"}
                />
              )}
            </div>
          )}
        </div>

        {/* 7. Sticky bottom actions */}
        {(state === "success" || state === "warning_shortage" || state === "warning_expiry") && (
          <StickyActions
            data={data}
            onReviewReorder={onReviewReorder}
            onViewActions={onViewActions}
            onCreatePurchaseRequest={onCreatePurchaseRequest}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

// ══════════════════════════════════════════════════════════
// Sub-components
// ══════════════════════════════════════════════════════════

// ── Empty State ──
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full py-20 px-6 text-center">
      <div className="rounded-full bg-[#252d3a] border border-slate-700/40 p-4 mb-4">
        <Package className="h-8 w-8 text-slate-400" />
      </div>
      <p className="text-sm font-medium text-slate-300">
        재고 품목을 선택하면 여기에서 확인할 수 있습니다
      </p>
      <p className="text-xs text-slate-400 mt-1.5 max-w-[240px]">
        부족 재고, 유효기간 임박, 재발주 시점 등을 분석하고 필요한 조치를 안내합니다.
      </p>
    </div>
  );
}

// ── Loading State ──
function LoadingState() {
  return (
    <div className="p-5 space-y-5">
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="p-3 rounded-lg bg-[#252d3a] border border-slate-700/40">
            <Skeleton className="h-3 w-16 mb-2" />
            <Skeleton className="h-6 w-10" />
          </div>
        ))}
      </div>
      <Separator className="bg-slate-700/40" />
      <div>
        <Skeleton className="h-3 w-28 mb-3" />
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="p-3 rounded-lg border border-slate-700/40 bg-[#252d3a]">
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          ))}
        </div>
      </div>
      <Separator className="bg-slate-700/40" />
      <div>
        <Skeleton className="h-3 w-24 mb-3" />
        <Skeleton className="h-24 w-full rounded-lg" />
      </div>
    </div>
  );
}

// ── Error State ──
function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full py-20 px-6 text-center">
      <div className="rounded-full bg-red-950/40 border border-red-800/40 p-4 mb-4">
        <TriangleAlert className="h-8 w-8 text-red-400" />
      </div>
      <p className="text-sm font-medium text-slate-200">
        재고 조치 정보를 준비하지 못했습니다
      </p>
      <p className="text-xs text-slate-400 mt-1.5 max-w-[260px]">
        재고 수량, lot, 입고 예정 정보를 확인한 뒤 다시 시도해 주세요.
      </p>
      <Button variant="outline" size="sm" className="mt-4 h-8 text-xs border-slate-600/50 text-slate-300" onClick={onRetry}>
        <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
        다시 불러오기
      </Button>
    </div>
  );
}

// ── 2. Stock Risk Summary ──
function StockSummarySection({
  stockStatus,
  item,
}: {
  stockStatus: NonNullable<InventoryAiPanelData["stockStatus"]>;
  item: InventoryAiPanelData["item"];
}) {
  const unit = item?.unit || "ea";

  // Color based on stock ratio
  const ratioColor =
    stockStatus.stockRatio <= 0.3
      ? { text: "text-red-400", bg: "bg-red-950/40", border: "border-red-800/30" }
      : stockStatus.stockRatio <= 0.7
      ? { text: "text-amber-400", bg: "bg-amber-950/40", border: "border-amber-800/30" }
      : { text: "text-emerald-400", bg: "bg-emerald-950/40", border: "border-emerald-800/30" };

  const stats = [
    {
      icon: Package,
      label: "현재 재고",
      value: `${stockStatus.currentQuantity}${unit}`,
      color: ratioColor.text,
      bg: ratioColor.bg,
      border: ratioColor.border,
    },
    {
      icon: ShieldAlert,
      label: "안전 재고 대비",
      value: stockStatus.safetyStock > 0
        ? `${Math.round(stockStatus.stockRatio * 100)}%`
        : "미설정",
      color: ratioColor.text,
      bg: ratioColor.bg,
      border: ratioColor.border,
    },
    {
      icon: Timer,
      label: "예상 소진",
      value: stockStatus.estimatedDepletionDays !== null
        ? `${stockStatus.estimatedDepletionDays}일`
        : "미정",
      color: stockStatus.estimatedDepletionDays !== null && stockStatus.estimatedDepletionDays <= 7
        ? "text-red-400"
        : "text-slate-300",
      bg: stockStatus.estimatedDepletionDays !== null && stockStatus.estimatedDepletionDays <= 7
        ? "bg-red-950/40"
        : "bg-[#252d3a]",
      border: stockStatus.estimatedDepletionDays !== null && stockStatus.estimatedDepletionDays <= 7
        ? "border-red-800/30"
        : "border-slate-700/40",
    },
    {
      icon: AlertTriangle,
      label: "조치 필요",
      value: stockStatus.actionNeededCount > 0
        ? `${stockStatus.actionNeededCount}건`
        : "없음",
      color: stockStatus.actionNeededCount > 0
        ? "text-amber-400"
        : "text-emerald-400",
      bg: stockStatus.actionNeededCount > 0
        ? "bg-amber-950/40"
        : "bg-emerald-950/40",
      border: stockStatus.actionNeededCount > 0
        ? "border-amber-800/30"
        : "border-emerald-800/30",
    },
  ];

  return (
    <div className="p-5">
      <h4 className="text-xs font-semibold text-slate-50 uppercase tracking-wider mb-3">
        재고 위험 요약
      </h4>

      {/* Product name */}
      {item && (
        <div className="flex items-center gap-2 mb-3">
          <Beaker className="h-4 w-4 text-slate-400" />
          <span className="text-sm font-medium text-white truncate">
            {item.productName}
          </span>
          {item.brand && (
            <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-slate-600/50 text-slate-300">
              {item.brand}
            </Badge>
          )}
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2.5">
        {stats.map((stat) => {
          const IconComp = stat.icon;
          return (
            <div key={stat.label} className={`px-3 py-2.5 rounded-lg border ${stat.bg} ${stat.border}`}>
              <div className="flex items-center gap-1.5 mb-1">
                <IconComp className={`h-3.5 w-3.5 ${stat.color}`} />
                <span className="text-[11px] text-slate-400">{stat.label}</span>
              </div>
              <p className={`text-lg font-bold tabular-nums ${stat.color}`}>{stat.value}</p>
            </div>
          );
        })}
      </div>

      {/* Additional info */}
      {item && (
        <div className="mt-3 space-y-1.5">
          {item.location && (
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <MapPin className="h-3.5 w-3.5 text-slate-400" />
              <span>보관 위치: <span className="font-medium text-slate-300">{item.location}</span></span>
            </div>
          )}
          {stockStatus.expiringLotCount > 0 && (
            <div className="flex items-center gap-2 text-[11px] text-amber-400">
              <CalendarClock className="h-3.5 w-3.5" />
              <span>유효기간 임박 Lot: <span className="font-bold tabular-nums">{stockStatus.expiringLotCount}건</span></span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── 3. Issue Warnings ──
function IssueWarningsSection({
  issues,
  isShortage,
}: {
  issues: InventoryIssue[];
  isShortage: boolean;
}) {
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");
  const infos = issues.filter((i) => i.severity === "info");

  const issueIcon = (type: InventoryIssue["type"]) => {
    switch (type) {
      case "shortage": return TrendingDown;
      case "expiry": return CalendarClock;
      case "depleting_fast": return Timer;
      case "no_inspection": return Eye;
      case "no_location": return MapPin;
      default: return AlertTriangle;
    }
  };

  return (
    <div className={`p-5 ${isShortage ? "bg-red-950/15" : "bg-amber-950/15"}`}>
      <div className="flex items-center gap-2 mb-3">
        <ShieldAlert className={`h-4 w-4 ${errors.length > 0 ? "text-red-400" : "text-amber-400"}`} />
        <h4 className="text-xs font-semibold text-slate-50 uppercase tracking-wider">
          확인 필요한 재고 이슈
        </h4>
        <Badge
          variant="outline"
          className={`text-[10px] h-4 px-1.5 ${
            errors.length > 0
              ? "bg-red-950/50 text-red-400 border-red-700/60"
              : "bg-amber-950/50 text-amber-400 border-amber-700/60"
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
                  ? "border-red-700/50 bg-red-950/30"
                  : isWarning
                  ? "border-amber-700/50 bg-amber-950/30"
                  : "border-slate-700/40 bg-[#252d3a]"
              }`}
            >
              <div className="flex items-start gap-2">
                <IconComp
                  className={`h-3.5 w-3.5 mt-0.5 flex-shrink-0 ${
                    isError ? "text-red-400" : isWarning ? "text-amber-400" : "text-blue-400"
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-xs font-medium text-slate-200">
                      {issue.message}
                    </p>
                    <Badge
                      variant="outline"
                      className={`text-[9px] h-3.5 px-1 flex-shrink-0 ${
                        isError
                          ? "text-red-400 border-red-700/60"
                          : isWarning
                          ? "text-amber-400 border-amber-700/60"
                          : "text-slate-400 border-slate-600"
                      }`}
                    >
                      {issue.badgeLabel}
                    </Badge>
                  </div>
                  {issue.detail && (
                    <p className="text-[11px] text-slate-300">
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

// ── 4. Reorder Priority ──
function ReorderSection({
  recommendation,
  onReviewReorder,
  onViewVendors,
  isHighlighted,
}: {
  recommendation: ReorderRecommendation;
  onReviewReorder?: (r: ReorderRecommendation) => void;
  onViewVendors?: (productName: string) => void;
  isHighlighted: boolean;
}) {
  const urgencyConfig = {
    urgent: {
      label: "긴급",
      color: "bg-red-950/50 text-red-400 border-red-700/60",
    },
    high: {
      label: "높음",
      color: "bg-amber-950/50 text-amber-400 border-amber-700/60",
    },
    medium: {
      label: "보통",
      color: "bg-blue-950/50 text-blue-400 border-blue-700/60",
    },
  };

  const urg = urgencyConfig[recommendation.urgency];

  return (
    <div className={`p-5 ${isHighlighted ? "bg-orange-950/15" : ""}`}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold text-slate-50 uppercase tracking-wider">
          재발주 우선순위
        </h4>
        <Badge variant="outline" className={`text-[10px] h-4 px-1.5 ${urg.color}`}>
          {urg.label}
        </Badge>
      </div>

      <div className="rounded-lg border border-slate-700/40 bg-[#252d3a] p-3.5">
        {/* Recommended qty */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-slate-400">권장 발주 수량</span>
          <span className="text-base font-bold text-white tabular-nums">
            {recommendation.recommendedQty}
            <span className="text-xs font-normal text-slate-400 ml-0.5">ea</span>
          </span>
        </div>

        {/* Detail info */}
        <div className="space-y-1.5 text-[11px]">
          {recommendation.estimatedMonthlyUsage != null && (
            <div className="flex justify-between text-slate-400">
              <span>월 예상 사용량</span>
              <span className="font-medium text-slate-300 tabular-nums">
                {Math.round(recommendation.estimatedMonthlyUsage)}ea
              </span>
            </div>
          )}
          {recommendation.estimatedDepletionDays != null && (
            <div className="flex justify-between text-slate-400">
              <span>예상 소진 시점</span>
              <span className={`font-medium tabular-nums ${
                recommendation.estimatedDepletionDays <= 7
                  ? "text-red-400"
                  : "text-slate-300"
              }`}>
                {recommendation.estimatedDepletionDays}일 후
              </span>
            </div>
          )}
          {recommendation.leadTimeDays != null && (
            <div className="flex justify-between text-slate-400">
              <span>예상 리드타임</span>
              <span className="font-medium text-slate-300 tabular-nums">
                {recommendation.leadTimeDays}일
              </span>
            </div>
          )}
          {recommendation.suggestedVendor && (
            <div className="flex justify-between text-slate-400">
              <span>추천 벤더</span>
              <span className="font-medium text-slate-300">
                {recommendation.suggestedVendor}
              </span>
            </div>
          )}
          {recommendation.recentUnitPrice != null && (
            <div className="flex justify-between text-slate-400">
              <span>최근 단가 참고</span>
              <span className="font-medium text-slate-300 tabular-nums">
                ₩{recommendation.recentUnitPrice.toLocaleString()}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 mt-3">
        {onReviewReorder && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[11px] flex-1 bg-slate-700/50 text-slate-300 border-slate-600/50 hover:bg-slate-700 hover:text-slate-200"
            onClick={() => onReviewReorder(recommendation)}
          >
            <ShoppingCart className="h-3 w-3 mr-1" />
            재발주안 검토하기
          </Button>
        )}
        {onViewVendors && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[11px] flex-1 bg-slate-700/50 text-slate-300 border-slate-600/50 hover:bg-slate-700 hover:text-slate-200"
            onClick={() => onViewVendors(recommendation.productName)}
          >
            <Building2 className="h-3 w-3 mr-1" />
            추천 벤더 보기
          </Button>
        )}
      </div>
    </div>
  );
}

// ── 5. Lot & Expiry Check ──
function LotExpirySection({
  lots,
  onViewDetail,
  onReviewDisposal,
  isHighlighted,
}: {
  lots: LotInfo[];
  onViewDetail?: (lotNumber: string) => void;
  onReviewDisposal?: (lotNumber: string) => void;
  isHighlighted: boolean;
}) {
  // Sort by risk: expired > expiringSoon > normal
  const sorted = [...lots].sort((a, b) => {
    if (a.isExpired && !b.isExpired) return -1;
    if (!a.isExpired && b.isExpired) return 1;
    if (a.isExpiringSoon && !b.isExpiringSoon) return -1;
    if (!a.isExpiringSoon && b.isExpiringSoon) return 1;
    return a.daysUntilExpiry - b.daysUntilExpiry;
  });

  const actionLabel = (lot: LotInfo) => {
    switch (lot.recommendAction) {
      case "discard_review": return "폐기 검토";
      case "use_first": return "우선 사용 권장";
      default: return null;
    }
  };

  return (
    <div className={`p-5 ${isHighlighted ? "bg-amber-950/15" : ""}`}>
      <div className="flex items-center gap-2 mb-3">
        <CalendarClock className="h-4 w-4 text-amber-400" />
        <h4 className="text-xs font-semibold text-slate-50 uppercase tracking-wider">
          Lot 및 유효기간 확인
        </h4>
      </div>

      <div className="space-y-2">
        {sorted.map((lot) => {
          const isExpired = lot.isExpired;
          const isSoon = lot.isExpiringSoon;
          const action = actionLabel(lot);

          return (
            <div
              key={lot.lotNumber}
              className={`p-3 rounded-lg border ${
                isExpired
                  ? "border-red-700/50 bg-red-950/30"
                  : isSoon
                  ? "border-amber-700/50 bg-amber-950/30"
                  : "border-slate-700/40 bg-[#252d3a]"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <FlaskConical className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-xs font-medium text-slate-200">
                    Lot #{lot.lotNumber}
                  </span>
                </div>
                {isExpired && (
                  <Badge variant="outline" className="text-[9px] h-3.5 px-1 bg-red-950/50 text-red-400 border-red-700/60">
                    만료됨
                  </Badge>
                )}
                {isSoon && !isExpired && (
                  <Badge variant="outline" className="text-[9px] h-3.5 px-1 bg-amber-950/50 text-amber-400 border-amber-700/60">
                    D-{lot.daysUntilExpiry}
                  </Badge>
                )}
                {!isExpired && !isSoon && (
                  <Badge variant="outline" className="text-[9px] h-3.5 px-1 text-slate-400 border-slate-600">
                    D-{lot.daysUntilExpiry}
                  </Badge>
                )}
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                <span>만료일: {formatDate(lot.expiryDate)}</span>
                <span className="tabular-nums">수량: {lot.quantity}</span>
              </div>

              {action && (
                <p className={`text-[11px] font-medium mt-1 ${
                  isExpired ? "text-red-400" : "text-amber-400"
                }`}>
                  {action}
                </p>
              )}

              {/* Lot actions */}
              <div className="flex items-center gap-2 mt-2">
                {onViewDetail && (
                  <button
                    className="text-[11px] text-blue-400 hover:text-blue-300 font-medium flex items-center gap-0.5"
                    onClick={() => onViewDetail(lot.lotNumber)}
                  >
                    <Eye className="h-3 w-3" />
                    Lot 상세 보기
                  </button>
                )}
                {(isExpired || isSoon) && onReviewDisposal && (
                  <button
                    className={`text-[11px] font-medium flex items-center gap-0.5 ml-auto ${
                      isExpired ? "text-red-400 hover:text-red-300" : "text-amber-400 hover:text-amber-300"
                    }`}
                    onClick={() => onReviewDisposal(lot.lotNumber)}
                  >
                    {isExpired ? <Trash2 className="h-3 w-3" /> : <ArrowRight className="h-3 w-3" />}
                    {isExpired ? "폐기 검토" : "우선사용 검토"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── 6. Business Impact ──
function BusinessImpactSection({
  impacts,
  isHighlighted,
}: {
  impacts: BusinessImpact[];
  isHighlighted: boolean;
}) {
  const impactIcon = (type: BusinessImpact["type"]) => {
    switch (type) {
      case "schedule_risk": return Clock;
      case "recurring_shortage": return TrendingDown;
      case "pending_order": return ShoppingCart;
      case "alternative_needed": return Replace;
      default: return AlertTriangle;
    }
  };

  return (
    <div className={`p-5 ${isHighlighted ? "bg-slate-800/20" : ""}`}>
      <div className="flex items-center gap-2 mb-3">
        <TrendingDown className="h-4 w-4 text-slate-400" />
        <h4 className="text-xs font-semibold text-slate-50 uppercase tracking-wider">
          운영 영향
        </h4>
      </div>

      <div className="space-y-2">
        {impacts.map((impact, idx) => {
          const IconComp = impactIcon(impact.type);
          return (
            <div
              key={idx}
              className="p-3 rounded-lg border border-slate-700/40 bg-[#252d3a]"
            >
              <div className="flex items-start gap-2">
                <IconComp className="h-3.5 w-3.5 mt-0.5 text-slate-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-200">
                    {impact.message}
                  </p>
                  {impact.detail && (
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {impact.detail}
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

// ── 7. Sticky Bottom Actions ──
function StickyActions({
  data,
  onReviewReorder,
  onViewActions,
  onCreatePurchaseRequest,
}: {
  data: InventoryAiPanelData;
  onReviewReorder?: (r: ReorderRecommendation) => void;
  onViewActions?: () => void;
  onCreatePurchaseRequest?: () => void;
}) {
  const hasReorder = !!data.reorderRecommendation;
  const hasIssues = data.issues.length > 0;

  return (
    <div className="flex-shrink-0 border-t border-slate-700 bg-[#1a2230] px-5 py-3">
      <div className="flex gap-2">
        {hasReorder && onReviewReorder ? (
          <Button
            className="flex-1 h-9 text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium"
            onClick={() => onReviewReorder(data.reorderRecommendation!)}
          >
            <ShoppingCart className="h-3.5 w-3.5 mr-1.5" />
            재발주안 검토하기
          </Button>
        ) : (
          <Button
            className="flex-1 h-9 text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium"
            disabled={!hasIssues}
            onClick={onViewActions}
          >
            <Eye className="h-3.5 w-3.5 mr-1.5" />
            재고 조치 항목 보기
          </Button>
        )}

        {hasReorder && (
          <Button
            variant="outline"
            className="flex-1 h-9 text-xs bg-slate-700/50 text-slate-300 border-slate-600/50 hover:bg-slate-700 hover:text-slate-200"
            onClick={onViewActions}
          >
            <Eye className="h-3.5 w-3.5 mr-1.5" />
            재고 조치 항목 보기
          </Button>
        )}
      </div>

      {/* Purchase request sub-action */}
      {hasReorder && onCreatePurchaseRequest && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full mt-2 h-7 text-[11px] text-slate-400 hover:text-slate-200 hover:bg-slate-700/30"
          onClick={onCreatePurchaseRequest}
        >
          <ArrowRight className="h-3 w-3 mr-1" />
          구매 요청으로 보내기
        </Button>
      )}

      {!hasIssues && !hasReorder && (
        <div className="flex items-center justify-center text-xs text-slate-300 mt-1">
          <CheckCircle2 className="h-3.5 w-3.5 mr-1.5 text-emerald-400" />
          현재 추가 조치가 필요하지 않습니다
        </div>
      )}
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
