"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PriceDisplay } from "@/components/products/price-display";
import {
  FileText,
  Trash2,
  GitCompare,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Info,
  X,
  Eye,
} from "lucide-react";
import { CenterWorkWindow } from "@/components/work-window/center-work-window";
import { ProductDetailSummary, toDetailData } from "./product-detail-summary";
import {
  calculateRequestReadiness,
  type RequestReadiness,
  type CandidateAssessment,
  type RequestReadinessLevel,
} from "./request-readiness";

// ── Props ──

interface RequestReviewWindowProps {
  open: boolean;
  onClose: () => void;
  quoteItems: any[];
  compareIds: string[];
  products: any[];
  onRemoveItem: (itemId: string) => void;
  onUpdateItem: (itemId: string, updates: any) => void;
  onClearAll: () => void;
  onCreateRequest: () => void;
  onSwitchToCompare: () => void;
  onToggleCompare: (productId: string) => void;
  onToggleRequest: (productId: string) => void;
  totalAmount: number;
}

// ── Readiness config ──

const READINESS_CONFIG: Record<RequestReadinessLevel, { color: string; icon: any }> = {
  ready_to_create_request: { color: "bg-emerald-600/10 text-emerald-400 border-emerald-600/30", icon: CheckCircle2 },
  review_first: { color: "bg-amber-600/10 text-amber-400 border-amber-600/30", icon: AlertTriangle },
  blocked: { color: "bg-red-600/10 text-red-400 border-red-600/30", icon: AlertCircle },
  partial_ready: { color: "bg-amber-600/10 text-amber-400 border-amber-600/30", icon: Info },
};

function ReadinessBadge({ level, label }: { level: RequestReadinessLevel; label: string }) {
  const config = READINESS_CONFIG[level];
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border font-medium ${config.color}`}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

// ── Candidate Row ──

function CandidateReviewRow({
  candidate,
  isInspected,
  onRemove,
  onInspect,
}: {
  candidate: CandidateAssessment;
  isInspected: boolean;
  onRemove: () => void;
  onInspect: () => void;
}) {
  const statusColor =
    candidate.status === "ready"
      ? "border-l-emerald-500"
      : candidate.status === "review"
        ? "border-l-amber-500"
        : "border-l-red-500";

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2 rounded border border-l-2 ${statusColor} transition-colors cursor-pointer ${
        isInspected ? "bg-blue-600/10 border-blue-600/40" : "border-bd bg-el hover:bg-st"
      }`}
      onClick={onInspect}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="text-sm font-medium text-slate-100 truncate">{candidate.productName}</span>
          {candidate.isInCompare && (
            <span className="inline-flex items-center gap-0.5 text-[9px] px-1 py-0 rounded bg-blue-600/10 text-blue-400 shrink-0">
              <GitCompare className="h-2 w-2" />비교중
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
          <span className="truncate max-w-[100px]">{candidate.vendorName}</span>
          {candidate.catalogNumber && (
            <>
              <span className="text-slate-600">·</span>
              <span className="font-mono text-slate-500 truncate max-w-[80px]">Cat. {candidate.catalogNumber}</span>
            </>
          )}
        </div>
      </div>

      {/* Flags */}
      <div className="shrink-0 flex items-center gap-1">
        {candidate.flags.filter(f => f.type !== "soft_warning").map((flag, i) => (
          <span
            key={i}
            className={`text-[9px] px-1.5 py-0.5 rounded ${
              flag.type === "hard_blocker"
                ? "bg-red-600/10 text-red-400"
                : "bg-amber-600/10 text-amber-400"
            }`}
            title={flag.detail}
          >
            {flag.label}
          </span>
        ))}
      </div>

      {/* Price */}
      <div className="shrink-0 text-right">
        {candidate.unitPrice > 0 ? (
          <span className="text-sm font-semibold tabular-nums text-slate-100 whitespace-nowrap">
            <PriceDisplay price={candidate.lineTotal} currency="KRW" />
          </span>
        ) : (
          <span className="text-xs text-slate-500">가격 문의</span>
        )}
        <p className="text-[10px] text-slate-500">×{candidate.quantity}</p>
      </div>

      {/* Actions */}
      <div className="shrink-0 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-slate-500 hover:text-blue-400"
          onClick={onInspect}
          title="상세보기"
        >
          <Eye className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-slate-500 hover:text-red-400"
          onClick={onRemove}
          title="제거"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

// ── Main Component ──

export function RequestReviewWindow({
  open,
  onClose,
  quoteItems,
  compareIds,
  products,
  onRemoveItem,
  onUpdateItem,
  onClearAll,
  onCreateRequest,
  onSwitchToCompare,
  onToggleCompare,
  onToggleRequest,
  totalAmount,
}: RequestReviewWindowProps) {
  const [inspectedProductId, setInspectedProductId] = useState<string | null>(null);

  const readiness: RequestReadiness = useMemo(
    () => calculateRequestReadiness(quoteItems, compareIds, products),
    [quoteItems, compareIds, products],
  );

  const { level, summary, candidates, hardBlockers, reviewItems, softWarnings } = readiness;
  const canCreate = level === "ready_to_create_request" || level === "partial_ready";
  const uniqueVendors = new Set(quoteItems.map((q: any) => q.vendorName).filter(Boolean));

  // Nested inspect: find the product for the inspected candidate
  const inspectedProduct = inspectedProductId
    ? products.find((p: any) => p.id === inspectedProductId) || null
    : null;

  // Close nested inspect when the item is removed
  const inspectedStillExists = inspectedProductId
    ? quoteItems.some((q: any) => q.productId === inspectedProductId)
    : false;
  const showNestedInspect = inspectedProduct && inspectedStillExists;

  return (
    <CenterWorkWindow
      open={open}
      onClose={() => { setInspectedProductId(null); onClose(); }}
      title="견적 요청 검토"
      subtitle={`${summary.total}개 품목 · ₩${totalAmount.toLocaleString("ko-KR")}`}
      phase="ready"
      contextHeader={
        <div className="flex items-center gap-3 flex-wrap">
          <ReadinessBadge level={level} label={readiness.label} />
          <div className="flex items-center gap-2 text-[10px] text-slate-500">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-emerald-400" />준비 {summary.ready}
            </span>
            {summary.review > 0 && (
              <span className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-amber-400" />검토 {summary.review}
              </span>
            )}
            {summary.blocked > 0 && (
              <span className="flex items-center gap-1">
                <AlertCircle className="h-3 w-3 text-red-400" />차단 {summary.blocked}
              </span>
            )}
          </div>
        </div>
      }
      primaryAction={{
        label: canCreate
          ? `견적서 작성 (${summary.ready}건)`
          : level === "review_first"
            ? "검토 후 진행"
            : "요청 불가",
        onClick: onCreateRequest,
        disabled: level === "blocked",
      }}
      secondaryAction={{ label: "워크벤치로 닫기", onClick: () => { setInspectedProductId(null); onClose(); } }}
      linkedSummary={
        <div className="space-y-2">
          <div className="text-xs font-medium uppercase tracking-wider text-slate-500">요청 구성 요약</div>
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-slate-500">요청 대상</span>
              <p className="text-slate-200 font-medium">{summary.total}건</p>
            </div>
            <div>
              <span className="text-slate-500">공급사</span>
              <p className="text-slate-200 font-medium">{uniqueVendors.size}곳</p>
            </div>
            <div>
              <span className="text-slate-500">예상 합계</span>
              <p className="text-slate-200 font-medium tabular-nums">₩{totalAmount.toLocaleString("ko-KR")}</p>
            </div>
          </div>
        </div>
      }
    >
      {/* ═══ Split layout: review list + nested inspect rail ═══ */}
      <div className="flex gap-0 -mx-5">
        {/* Left: Review content */}
        <div className={`${showNestedInspect ? "w-[55%]" : "w-full"} px-5 space-y-4 transition-all`}>

          {/* Candidate Summary */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium uppercase tracking-wider text-slate-500">후보 리스트</span>
              {candidates.length > 0 && (
                <div className="flex items-center gap-1.5">
                  {summary.blocked > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 px-2 text-[10px] text-red-400 hover:text-red-300"
                      onClick={() => {
                        candidates
                          .filter((c) => c.status === "blocked")
                          .forEach((c) => onRemoveItem(c.itemId));
                      }}
                    >
                      차단 항목 제거
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 px-2 text-[10px] text-slate-500 hover:text-red-400"
                    onClick={onClearAll}
                  >
                    <Trash2 className="h-2.5 w-2.5 mr-1" />전체 초기화
                  </Button>
                </div>
              )}
            </div>

            {candidates.length > 0 ? (
              <div className="space-y-1">
                {candidates.map((c) => (
                  <CandidateReviewRow
                    key={c.itemId}
                    candidate={c}
                    isInspected={inspectedProductId === c.productId}
                    onRemove={() => onRemoveItem(c.itemId)}
                    onInspect={() => setInspectedProductId(
                      inspectedProductId === c.productId ? null : c.productId
                    )}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center py-8 text-center">
                <FileText className="h-6 w-6 text-slate-600 mb-2" />
                <p className="text-xs text-slate-400">견적 요청 후보가 없습니다</p>
                <p className="text-[10px] text-slate-500 mt-0.5">워크벤치에서 제품을 담아주세요</p>
              </div>
            )}
          </div>

          {/* Readiness Summary */}
          {candidates.length > 0 && (
            <div className="rounded border border-bd bg-pn px-3 py-2.5">
              <div className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">요청 준비 상태</div>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div>
                  <p className="text-lg font-bold tabular-nums text-emerald-400">{summary.ready}</p>
                  <p className="text-[10px] text-slate-500">준비</p>
                </div>
                <div>
                  <p className="text-lg font-bold tabular-nums text-amber-400">{summary.review}</p>
                  <p className="text-[10px] text-slate-500">검토</p>
                </div>
                <div>
                  <p className="text-lg font-bold tabular-nums text-red-400">{summary.blocked}</p>
                  <p className="text-[10px] text-slate-500">차단</p>
                </div>
                <div>
                  <p className="text-lg font-bold tabular-nums text-slate-200">{summary.total}</p>
                  <p className="text-[10px] text-slate-500">전체</p>
                </div>
              </div>
            </div>
          )}

          {/* Blocker / Review Surface */}
          {(hardBlockers.length > 0 || reviewItems.length > 0 || softWarnings.length > 0) && (
            <div className="space-y-2">
              <div className="text-xs font-medium uppercase tracking-wider text-slate-500">확인 사항</div>
              {hardBlockers.length > 0 && (
                <div className="rounded border border-red-600/20 bg-red-600/5 px-3 py-2">
                  <div className="flex items-center gap-1.5 mb-1">
                    <AlertCircle className="h-3 w-3 text-red-400" />
                    <span className="text-[10px] font-medium text-red-400 uppercase">차단</span>
                  </div>
                  <ul className="space-y-0.5">
                    {hardBlockers.map((msg, i) => (
                      <li key={i} className="text-xs text-red-300">{msg}</li>
                    ))}
                  </ul>
                </div>
              )}
              {reviewItems.length > 0 && (
                <div className="rounded border border-amber-600/20 bg-amber-600/5 px-3 py-2">
                  <div className="flex items-center gap-1.5 mb-1">
                    <AlertTriangle className="h-3 w-3 text-amber-400" />
                    <span className="text-[10px] font-medium text-amber-400 uppercase">검토 필요</span>
                  </div>
                  <ul className="space-y-0.5">
                    {reviewItems.map((msg, i) => (
                      <li key={i} className="text-xs text-amber-300">{msg}</li>
                    ))}
                  </ul>
                </div>
              )}
              {softWarnings.length > 0 && (
                <div className="rounded border border-bd bg-pn px-3 py-2">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Info className="h-3 w-3 text-slate-400" />
                    <span className="text-[10px] font-medium text-slate-400 uppercase">참고</span>
                  </div>
                  <ul className="space-y-0.5">
                    {softWarnings.map((msg, i) => (
                      <li key={i} className="text-xs text-slate-400">{msg}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Compare 복귀 경로 — 비교 미완료 시 blocker, 완료 시 secondary review */}
          {reviewItems.some((r) => r.includes("비교")) && (
            <div className="flex items-center gap-2 px-3 py-2 rounded border border-amber-600/20 bg-amber-600/5">
              <GitCompare className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              <span className="text-xs text-amber-300 flex-1">비교 판단 미완료 후보가 있습니다.</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[10px] text-amber-400 hover:text-amber-300 shrink-0"
                onClick={onSwitchToCompare}
              >
                비교 판단 먼저
              </Button>
            </div>
          )}
        </div>

        {/* ═══ Right: Nested Inspect Rail ═══ */}
        {showNestedInspect && inspectedProduct && (
          <div className="w-[45%] border-l border-bd bg-pn overflow-y-auto">
            {/* Nested rail header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-bd bg-el sticky top-0 z-10">
              <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">후보 상세</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0 text-slate-500 hover:text-slate-300"
                onClick={() => setInspectedProductId(null)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
            {/* Same ProductDetailSummary — compact variant */}
            <ProductDetailSummary
              data={toDetailData(inspectedProduct)}
              isInCompare={compareIds.includes(inspectedProduct.id)}
              isInRequest={quoteItems.some((q: any) => q.productId === inspectedProduct.id)}
              onToggleCompare={() => onToggleCompare(inspectedProduct.id)}
              onToggleRequest={() => onToggleRequest(inspectedProduct.id)}
              compareCount={compareIds.length}
              requestCount={quoteItems.length}
              variant="compact"
              showDetailLink={true}
            />
          </div>
        )}
      </div>
    </CenterWorkWindow>
  );
}
