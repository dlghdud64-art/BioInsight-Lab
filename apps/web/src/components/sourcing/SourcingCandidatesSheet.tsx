"use client";

/**
 * §11.312 #sourcing-candidates-sheet — 소싱 sticky bar 바텀시트.
 *
 * 호영님 P1 spec (2026-05-26):
 *   비교/견적 sticky bar 의 숫자/배지 탭 시 바텀시트로 담긴 항목 목록 표시.
 *   각 항목에 ✕ 개별 삭제 + 검토 모드 시 [재고 확인] / [그래도 유지] 액션.
 *
 * Mode:
 *   - "compare" : 비교 후보 목록 (compareIds → products lookup)
 *   - "quote"   : 견적 후보 목록 (quoteItems + 검토/차단 배지)
 *   - "review"  : 검토 필요 항목만 필터 (requestReadiness.entries 중 review)
 *
 * dead button 0 — 모든 CTA real handler wiring.
 * 호영님 §11.302 색상 체계 정합 (amber → yellow-100, red-100/red-700).
 */

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, AlertTriangle, Trash2, Package, FileText, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";

/* ── 외부 타입 (search page 의 product / quoteItem shape 호환) ── */
export interface CandidateProduct {
  id: string;
  name: string;
  brand?: string | null;
  catalogNumber?: string | null;
  category?: string | null;
  price?: number | null;
}

export interface CandidateQuoteItem {
  id: string;
  productId: string;
  productName?: string;
  brand?: string;
  catalogNumber?: string;
  category?: string;
  price?: number | null;
  quantity?: number;              // §11.339 — 견적 수량(기본 1)
  unit?: string | null;           // §11.339 — 단위(ea/box 등, Product.unit)
  reviewReason?: string | null;   // §11.312 — 검토 필요 사유
  isBlocked?: boolean;
}

export type CandidatesSheetMode = "compare" | "quote" | "review";

interface SourcingCandidatesSheetProps {
  open: boolean;
  onClose: () => void;
  mode: CandidatesSheetMode;
  /** Compare 모드 — products lookup */
  compareIds?: string[];
  products?: CandidateProduct[];
  /** Quote 모드 — quoteItems */
  quoteItems?: CandidateQuoteItem[];
  /** 합산 금액 (quote/review 모드 표시) */
  totalAmount?: number;
  /** Compare 개별 삭제 */
  onRemoveCompare?: (productId: string) => void;
  onClearCompare?: () => void;
  /** Quote 개별 삭제 */
  onRemoveQuoteItem?: (itemId: string) => void;
  /** §11.339 — 견적 후보 수량 조절 (itemId, 새 수량). */
  onQuantityChange?: (itemId: string, quantity: number) => void;
  onClearQuote?: () => void;
  /** Review 모드 — 검토 해제 (item 을 정상 견적으로 전환) */
  onClearReviewFlag?: (itemId: string) => void;
  /** CTA */
  onCompareReview?: () => void;
  onQuoteRequest?: () => void;
}

export function SourcingCandidatesSheet(props: SourcingCandidatesSheetProps) {
  const {
    open,
    onClose,
    mode,
    compareIds = [],
    products = [],
    quoteItems = [],
    totalAmount = 0,
    onRemoveCompare,
    onClearCompare,
    onRemoveQuoteItem,
    onQuantityChange,
    onClearQuote,
    onClearReviewFlag,
    onCompareReview,
    onQuoteRequest,
  } = props;

  const router = useRouter();

  // ── Compare mode 데이터 ──
  const compareItems = compareIds
    .map((id) => products.find((p) => p.id === id))
    .filter((p): p is CandidateProduct => Boolean(p));

  // ── Review mode — review reason 있는 quoteItems 만 필터 ──
  const reviewItems = quoteItems.filter((q) => q.reviewReason);

  const handleInventoryCheck = (productName?: string) => {
    onClose();
    router.push(
      productName
        ? `/dashboard/inventory?search=${encodeURIComponent(productName)}`
        : "/dashboard/inventory",
    );
  };

  // ── Title 분기 ──
  const titleMap: Record<CandidatesSheetMode, string> = {
    compare: `비교 후보 (${compareItems.length})`,
    quote: `견적 후보 (${quoteItems.length}) · ₩${totalAmount.toLocaleString("ko-KR")}`,
    review: `⚠ 검토 필요 (${reviewItems.length})`,
  };

  // ── Confirm 전체 삭제 ──
  const handleClearAll = () => {
    const target = mode === "compare" ? "비교 후보" : "견적 후보";
    if (
      typeof window !== "undefined" &&
      window.confirm(`${target} 전체를 삭제하시겠습니까?`)
    ) {
      if (mode === "compare") onClearCompare?.();
      else onClearQuote?.();
      onClose();
    }
  };

  return (
    <Sheet open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <SheetContent
        side="bottom"
        className="max-h-[80vh] overflow-y-auto"
        data-testid="sourcing-candidates-sheet"
        data-mode={mode}
      >
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2 text-base">
            {mode === "compare" && <Sparkles className="h-4 w-4 text-blue-600" />}
            {mode === "quote" && <FileText className="h-4 w-4 text-emerald-600" />}
            {mode === "review" && <AlertTriangle className="h-4 w-4 text-yellow-600" />}
            {titleMap[mode]}
          </SheetTitle>
        </SheetHeader>

        {/* ── Compare mode ── */}
        {mode === "compare" && (
          <div className="mt-4 space-y-2">
            {compareItems.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">
                비교 후보가 비어 있습니다.
              </p>
            ) : (
              compareItems.map((p) => (
                <div
                  key={p.id}
                  data-testid="candidate-row"
                  className="flex items-start gap-2 p-3 rounded-lg border border-slate-200 bg-white"
                >
                  <Package className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {p.name}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {[p.brand, p.category, p.price ? `${p.price.toLocaleString("ko-KR")}원` : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`${p.name} 비교 후보에서 제거`}
                    data-testid="candidate-remove-cta"
                    onClick={() => onRemoveCompare?.(p.id)}
                    className="h-8 w-8 flex-shrink-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
            <div className="flex items-center gap-2 pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleClearAll}
                data-testid="candidates-clear-all"
                disabled={compareItems.length === 0}
                className="flex-1 h-10 text-sm border-slate-300 text-slate-700"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                전체 삭제
              </Button>
              <Button
                type="button"
                onClick={() => {
                  onCompareReview?.();
                  onClose();
                }}
                disabled={compareItems.length < 2}
                data-testid="candidates-compare-review-cta"
                className="flex-1 h-10 text-sm bg-blue-600 hover:bg-blue-700 text-white font-semibold"
              >
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                비교 검토
              </Button>
            </div>
          </div>
        )}

        {/* ── Quote mode ── */}
        {mode === "quote" && (
          <div className="mt-4 space-y-2">
            {quoteItems.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">
                견적 후보가 비어 있습니다.
              </p>
            ) : (
              quoteItems.map((q) => (
                <div
                  key={q.id}
                  data-testid="candidate-row"
                  className={`flex items-start gap-2 p-3 rounded-lg border ${
                    q.reviewReason
                      ? "border-yellow-200 bg-yellow-50"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  {q.reviewReason ? (
                    <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                  ) : (
                    <FileText className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {q.productName ?? "이름 없음"}
                      </p>
                      {q.reviewReason && (
                        <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 text-[10px] px-1.5 py-0">
                          재고 확인
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {[
                        q.brand,
                        q.category,
                        // §11.338 — 확정가만 금액 표시, 미견적은 "견적 후 확정".
                        (q.price ?? 0) > 0 ? `${(q.price as number).toLocaleString("ko-KR")}원` : "견적 후 확정",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {/* §11.339 — 수량 조절(−/숫자/+). 기본 1, 단위 표시. */}
                    <div className="flex items-center gap-1.5 mt-2" data-testid="candidate-qty">
                      <button
                        type="button"
                        aria-label="수량 감소"
                        onClick={() => onQuantityChange?.(q.id, Math.max(1, (q.quantity ?? 1) - 1))}
                        className="h-7 w-7 inline-flex items-center justify-center rounded border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                        disabled={(q.quantity ?? 1) <= 1}
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min={1}
                        value={q.quantity ?? 1}
                        onChange={(e) => onQuantityChange?.(q.id, Math.max(1, Number(e.target.value) || 1))}
                        aria-label="수량"
                        className="h-7 w-12 text-center text-xs border border-slate-300 rounded tabular-nums"
                      />
                      <button
                        type="button"
                        aria-label="수량 증가"
                        onClick={() => onQuantityChange?.(q.id, (q.quantity ?? 1) + 1)}
                        className="h-7 w-7 inline-flex items-center justify-center rounded border border-slate-300 text-slate-600 hover:bg-slate-50"
                      >
                        +
                      </button>
                      {q.unit && <span className="text-[10px] text-slate-400 ml-0.5">{q.unit}</span>}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`${q.productName ?? "항목"} 견적 후보에서 제거`}
                    data-testid="candidate-remove-cta"
                    onClick={() => onRemoveQuoteItem?.(q.id)}
                    className="h-8 w-8 flex-shrink-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
            <div className="flex items-center gap-2 pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleClearAll}
                data-testid="candidates-clear-all"
                disabled={quoteItems.length === 0}
                className="flex-1 h-10 text-sm border-slate-300 text-slate-700"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                전체 삭제
              </Button>
              <Button
                type="button"
                onClick={() => {
                  onQuoteRequest?.();
                  onClose();
                }}
                disabled={quoteItems.length === 0}
                data-testid="candidates-quote-request-cta"
                className="flex-1 h-10 text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              >
                <FileText className="h-3.5 w-3.5 mr-1.5" />
                견적 요청
              </Button>
            </div>
          </div>
        )}

        {/* ── Review mode (dead button 해소) ── */}
        {mode === "review" && (
          <div className="mt-4 space-y-3">
            {reviewItems.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">
                검토가 필요한 항목이 없습니다.
              </p>
            ) : (
              reviewItems.map((q) => (
                <div
                  key={q.id}
                  data-testid="review-candidate-row"
                  className="p-3 rounded-lg border border-yellow-200 bg-yellow-50 space-y-2"
                >
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900">
                        {q.productName ?? "이름 없음"}
                      </p>
                      <p className="text-xs text-slate-600 mt-0.5">
                        사유: {q.reviewReason ?? "재고 확인 필요"}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                        현재 재고와 중복 가능 → 재고 확인 후 견적 진행 권장
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`${q.productName ?? "항목"} 검토 항목에서 제거`}
                      onClick={() => onRemoveQuoteItem?.(q.id)}
                      className="h-8 w-8 flex-shrink-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      data-testid="review-inventory-check-cta"
                      onClick={() => handleInventoryCheck(q.productName)}
                      className="flex-1 h-9 text-xs border-slate-300 text-slate-700"
                    >
                      <Package className="h-3.5 w-3.5 mr-1.5" />
                      재고 확인
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      data-testid="review-keep-anyway-cta"
                      onClick={() => onClearReviewFlag?.(q.id)}
                      className="flex-1 h-9 text-xs bg-slate-700 hover:bg-slate-800 text-white"
                    >
                      그래도 견적에 유지
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
