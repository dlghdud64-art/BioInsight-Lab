"use client";

/**
 * §11.339 v2 #quote-cart-panel — 소싱 검색 우측 패널 탭 카트.
 *
 * 하단 드로어 난립(견적 후보 / 검토 필요 SourcingCandidatesSheet 2종)을 우측 패널
 * 탭 카트로 흡수. 탭 = 견적함 / 비교함 / 상세.
 *   - 견적함: quoteItems + 수량(−/+) + 검토필요 인라인 경고(별도 레이어 X).
 *   - 비교함: compareIds 제품 목록(기존 비교 기능 연결).
 *   - 상세:   SourcingContextRail(railProduct, §11.337 Part C 통합) — 부모가 slot 주입.
 *
 * §11.302 색상: 카드 배경 중립(white/slate). 경고 = 좌측 보더 + ⚠ 배지만(전체 노랑 X).
 * §11.338 가격: 미견적(unitPrice<=0) = "견적 후 확정"(₩0 표시 안 함).
 * dead button 0 — 모든 CTA real handler.
 */

import { useState, useEffect, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, AlertTriangle, FileText, Package, PenLine } from "lucide-react";

export interface QuoteCartItem {
  id: string;
  productId: string;
  productName?: string;
  vendorName?: string | null;
  brand?: string | null;
  category?: string | null;
  unitPrice?: number;
  quantity?: number;
  unit?: string | null;
}

/** 항목별 검토 경고(§11.339 v2 — 검토 필요 드로어 인라인 흡수). */
export interface QuoteCartReviewFlag {
  itemId: string;
  detail: string;          // 사유(가격 미정/재고 중복 등)
  resolvable: boolean;     // [재고 확인]/[유지] 액션 노출 여부
}

export interface CompareCartItem {
  id: string;
  name: string;
  brand?: string | null;
  category?: string | null;
}

type CartTab = "quote" | "compare" | "detail";

interface QuoteCartPanelProps {
  quoteItems: QuoteCartItem[];
  compareItems: CompareCartItem[];
  reviewFlags?: QuoteCartReviewFlag[];
  /** 상세 탭 슬롯 — 부모가 SourcingContextRail 주입(§11.337 Part C). null = 빈 안내. */
  detailSlot?: ReactNode;
  /** 외부에서 상세 탭으로 강제 전환(제품 "상세 보기" 클릭 시). */
  forceDetailKey?: string | null;
  onQuantityChange?: (itemId: string, quantity: number) => void;
  onRemoveQuoteItem?: (itemId: string) => void;
  onRemoveCompareItem?: (productId: string) => void;
  /** §11.339 v2 2단계 — 비교 검토 상태(혼합 카테고리 경고 등). 비교함 탭 상단 표시. */
  compareReadiness?: { active: boolean; mode: "direct" | "mixed_warning" | "inactive" | string; label: string } | null;
  onCompareReview?: () => void;
  onResolveReview?: (itemId: string) => void;   // [재고 확인]
  onKeepReview?: (itemId: string) => void;       // [그래도 유지]
  onQuoteRequest?: () => void;
}

function priceText(unitPrice?: number): string {
  return (unitPrice ?? 0) > 0
    ? `${(unitPrice as number).toLocaleString("ko-KR")}원`
    : "견적 후 확정";
}

export function QuoteCartPanel({
  quoteItems,
  compareItems,
  reviewFlags = [],
  detailSlot,
  forceDetailKey,
  onQuantityChange,
  onRemoveQuoteItem,
  onRemoveCompareItem,
  compareReadiness,
  onCompareReview,
  onResolveReview,
  onKeepReview,
  onQuoteRequest,
}: QuoteCartPanelProps) {
  const [tab, setTab] = useState<CartTab>("quote");

  // 제품 "상세 보기" 클릭(forceDetailKey 변경) → 상세 탭 전환.
  useEffect(() => {
    if (forceDetailKey) setTab("detail");
  }, [forceDetailKey]);

  // 담은 게 없고 상세도 없으면 견적함 기본(빈 안내).
  const flagByItem = new Map(reviewFlags.map((f) => [f.itemId, f]));

  const TabButton = ({ id, label, count }: { id: CartTab; label: string; count?: number }) => (
    <button
      type="button"
      data-testid={`cart-tab-${id}`}
      onClick={() => setTab(id)}
      className={`flex-1 h-10 text-xs font-semibold inline-flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
        tab === id
          ? "border-blue-600 text-blue-700"
          : "border-transparent text-slate-500 hover:text-slate-700"
      }`}
    >
      {label}
      {typeof count === "number" && count > 0 && (
        <Badge variant="secondary" className="h-4 min-w-4 px-1 text-[10px] bg-slate-200 text-slate-700">
          {count}
        </Badge>
      )}
    </button>
  );

  return (
    <div className="flex flex-col h-full" data-testid="quote-cart-panel">
      {/* 탭 헤더 */}
      <div className="flex items-stretch border-b border-slate-200 shrink-0">
        <TabButton id="quote" label="견적함" count={quoteItems.length} />
        <TabButton id="compare" label="비교함" count={compareItems.length} />
        <TabButton id="detail" label="상세" />
      </div>

      {/* 탭 본문 */}
      <div className="flex-1 overflow-y-auto">
        {/* ── 견적함 ── */}
        {tab === "quote" && (
          <div className="p-3 space-y-2" data-testid="cart-quote-tab">
            {quoteItems.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-10">
                담은 견적 후보가 없습니다.<br />
                <span className="text-xs text-slate-400">검색 결과에서 "견적 담기"로 추가하세요.</span>
              </p>
            ) : (
              <>
                {quoteItems.map((q) => {
                  const flag = flagByItem.get(q.id);
                  const qty = q.quantity ?? 1;
                  return (
                    <div
                      key={q.id}
                      data-testid="cart-quote-item"
                      className={`rounded-lg border bg-white ${
                        flag ? "border-l-2 border-l-yellow-400 border-slate-200" : "border-slate-200"
                      }`}
                    >
                      <div className="flex items-start gap-2 p-3">
                        <FileText className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">
                            {q.productName ?? "이름 없음"}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {[q.vendorName ?? q.brand, q.category, priceText(q.unitPrice)]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                          {/* 수량 조절 */}
                          <div className="flex items-center gap-1.5 mt-2" data-testid="cart-qty">
                            <button
                              type="button"
                              aria-label="수량 감소"
                              disabled={qty <= 1}
                              onClick={() => onQuantityChange?.(q.id, Math.max(1, qty - 1))}
                              className="h-7 w-7 inline-flex items-center justify-center rounded border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                            >
                              −
                            </button>
                            <input
                              type="number"
                              min={1}
                              value={qty}
                              aria-label="수량"
                              onChange={(e) => onQuantityChange?.(q.id, Math.max(1, Number(e.target.value) || 1))}
                              className="h-7 w-12 text-center text-xs border border-slate-300 rounded tabular-nums"
                            />
                            <button
                              type="button"
                              aria-label="수량 증가"
                              onClick={() => onQuantityChange?.(q.id, qty + 1)}
                              className="h-7 w-7 inline-flex items-center justify-center rounded border border-slate-300 text-slate-600 hover:bg-slate-50"
                            >
                              +
                            </button>
                            {q.unit && <span className="text-[10px] text-slate-400 ml-0.5">{q.unit}</span>}
                          </div>
                        </div>
                        <button
                          type="button"
                          aria-label={`${q.productName ?? "항목"} 견적함에서 제거`}
                          data-testid="cart-quote-remove"
                          onClick={() => onRemoveQuoteItem?.(q.id)}
                          className="h-7 w-7 inline-flex items-center justify-center rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 shrink-0"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      {/* §11.339 v2 — 검토 필요 인라인 경고(별도 드로어 흡수). 배경 중립 + ⚠ 배지/보더만. */}
                      {flag && (
                        <div className="px-3 pb-3 -mt-1" data-testid="cart-review-inline">
                          <div className="flex items-start gap-1.5 text-[11px] text-yellow-700">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                            <span className="flex-1">{flag.detail}</span>
                          </div>
                          {flag.resolvable && (
                            <div className="flex gap-1.5 mt-1.5">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                data-testid="cart-review-resolve"
                                onClick={() => onResolveReview?.(q.id)}
                                className="h-7 text-[11px] flex-1 border-slate-300"
                              >
                                재고 확인
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                data-testid="cart-review-keep"
                                onClick={() => onKeepReview?.(q.id)}
                                className="h-7 text-[11px] flex-1 text-slate-600"
                              >
                                그래도 유지
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                <Button
                  type="button"
                  data-testid="cart-quote-request"
                  disabled={quoteItems.length === 0}
                  onClick={() => onQuoteRequest?.()}
                  className="w-full h-10 mt-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                >
                  견적 요청서 만들기
                </Button>
              </>
            )}
          </div>
        )}

        {/* ── 비교함 ── */}
        {tab === "compare" && (
          <div className="p-3 space-y-2" data-testid="cart-compare-tab">
            {/* §11.339 v2 2단계 — 비교 검토 상태(혼합 카테고리 경고) 비교함 탭 내부로 일원화.
                §11.302: mixed_warning 만 노랑 보더, 그 외 중립/blue. 전체 배경 노랑 X. */}
            {compareReadiness?.active && (
              <div
                data-testid="cart-compare-readiness"
                className={`rounded-lg border bg-white p-3 ${
                  compareReadiness.mode === "mixed_warning"
                    ? "border-l-2 border-l-yellow-400 border-slate-200"
                    : compareReadiness.mode === "direct"
                      ? "border-l-2 border-l-blue-400 border-slate-200"
                      : "border-l-2 border-l-red-400 border-slate-200"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-800">비교 검토 활성</span>
                  <span className="text-[10px] text-slate-500">{compareItems.length}개 선택</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">{compareReadiness.label}</p>
                <Button
                  type="button"
                  size="sm"
                  data-testid="cart-compare-review"
                  onClick={() => onCompareReview?.()}
                  className="w-full h-8 mt-2 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                >
                  비교 검토
                </Button>
              </div>
            )}
            {compareItems.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-10">
                담은 비교 후보가 없습니다.
              </p>
            ) : (
              compareItems.map((c) => (
                <div
                  key={c.id}
                  data-testid="cart-compare-item"
                  className="flex items-start gap-2 p-3 rounded-lg border border-slate-200 bg-white"
                >
                  <Package className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{c.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {[c.brand, c.category].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={`${c.name} 비교함에서 제거`}
                    data-testid="cart-compare-remove"
                    onClick={() => onRemoveCompareItem?.(c.id)}
                    className="h-7 w-7 inline-flex items-center justify-center rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── 상세 (§11.337 Part C — 부모 SourcingContextRail slot) ── */}
        {tab === "detail" && (
          <div data-testid="cart-detail-tab" className="h-full">
            {detailSlot ?? (
              <div className="flex flex-col items-center justify-center text-center px-6 py-12">
                <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center mb-4">
                  <PenLine className="h-6 w-6 text-blue-600/60" />
                </div>
                <p className="text-sm font-semibold text-slate-800 mb-1.5">제품을 선택하세요</p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  검색 결과에서 "상세 보기"를 누르면<br />여기에 제품 상세가 표시됩니다.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
