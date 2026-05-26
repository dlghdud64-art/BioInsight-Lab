"use client";

/**
 * §11.310 #reorder-review-sheet — 재발주안 검토 바텀시트.
 *
 * 호영님 P1 spec (2026-05-26):
 *   재고 운영 도우미 (inventory-ai-assistant-panel) 하단 CTA "재발주안 검토하기"
 *   탭 → 본 시트 노출. 품목 / 권장 수량 / 보관 위치 / 추천 벤더 / 최근 구매 /
 *   예상 금액 요약 + [견적 요청] / [바로 발주] 분기.
 *
 * 호영님 결정 (Q30/Q31/Q32):
 *   - Q30 = A: 견적 pre-fill = query string (DB write 0)
 *   - Q31 = A: PO pre-fill = query string + 클라이언트 draft auto-create
 *   - Q32 = A: 추천 벤더 = PurchaseRecord 집계 (caller 가 props 로 주입)
 *
 * 색상:
 *   - primary "바로 발주" = bg-green-600 (실행 가능 액션, §11.302 정합)
 *   - secondary "견적 요청" = border-gray-300
 *   - amber/orange 0 (§11.310 scope 정합)
 *
 * dead button 0 — 추천 벤더 0건 시 "바로 발주" disabled + "견적 요청" only.
 */

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package, Building2, History, DollarSign, FileText, ShoppingCart, X } from "lucide-react";
import { useRouter } from "next/navigation";

/** 추천 벤더 (PurchaseRecord 집계, 최근 3개월 해당 품목). */
export interface VendorSuggestion {
  vendorName: string;
  unitPrice: number;
  lastPurchasedAt?: string | null; // ISO date — 최근 구매처 표시
}

/** 최근 구매 이력 (PurchaseRecord). */
export interface PurchaseHistoryEntry {
  poNumber: string;
  purchasedAt: string; // ISO date
  quantity: number;
  unitPrice: number;
}

/** 재발주안 요약 입력 (panel → sheet 전달). */
export interface ReorderReviewInput {
  productId: string | null;        // 기존 ProductInventory.productId (신규 시 null)
  productName: string;
  recommendedQty: number;
  unit?: string;
  storageLocation?: string | null; // "Lab-A · Cold-4C" 형태
  vendors: VendorSuggestion[];     // 최대 2~3개
  recentPurchases: PurchaseHistoryEntry[]; // 최대 3개
}

interface ReorderReviewSheetProps {
  open: boolean;
  onClose: () => void;
  data: ReorderReviewInput | null;
}

export function ReorderReviewSheet({ open, onClose, data }: ReorderReviewSheetProps) {
  const router = useRouter();

  if (!data) return null;

  // 예상 금액 = 권장 수량 × 최근 단가 (최우선 vendor)
  const primaryVendor = data.vendors[0];
  const estimatedAmount = primaryVendor
    ? data.recommendedQty * primaryVendor.unitPrice
    : 0;
  const hasVendor = data.vendors.length > 0;

  /** §11.310 Q30 — 견적 요청 = query string pre-fill (DB write 0) */
  const handleRequestQuote = () => {
    const params = new URLSearchParams({
      productName: data.productName,
      quantity: String(data.recommendedQty),
      reason: "안전 재고 미달 — 재고 운영 도우미 권장",
    });
    if (primaryVendor) {
      params.set("supplier", primaryVendor.vendorName);
    }
    router.push(`/dashboard/quotes?${params.toString()}`);
    onClose();
  };

  /** §11.310 Q31 — 바로 발주 = query string + PO 화면 진입 시 draft auto-create */
  const handleDirectPurchase = () => {
    if (!hasVendor) return;
    const params = new URLSearchParams({
      productName: data.productName,
      quantity: String(data.recommendedQty),
      supplier: primaryVendor.vendorName,
      unitPrice: String(primaryVendor.unitPrice),
      prefill: "reorder-recommendation",
    });
    router.push(`/dashboard/purchase-orders/new?${params.toString()}`);
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <SheetContent
        side="bottom"
        className="max-h-[85vh] overflow-y-auto"
        data-testid="reorder-review-sheet"
      >
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2 text-lg">
            <ShoppingCart className="h-5 w-5 text-emerald-600" />
            재발주안 요약
          </SheetTitle>
          <SheetDescription className="text-sm text-slate-500">
            재고 운영 도우미 권장안 검토 후 견적 요청 또는 바로 발주를 선택하세요.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* ── 품목 요약 ── */}
          <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 space-y-2">
            <div className="flex items-start gap-2">
              <Package className="h-4 w-4 text-slate-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  품목
                </p>
                <p className="text-sm font-bold text-slate-900 break-keep">
                  {data.productName}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  권장 수량
                </p>
                <p className="text-sm font-bold text-emerald-700 tabular-nums">
                  {data.recommendedQty}
                  <span className="text-xs font-medium text-slate-400 ml-0.5">
                    {data.unit ?? "ea"}
                  </span>
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  보관 위치
                </p>
                <p className="text-sm font-medium text-slate-900 truncate">
                  {data.storageLocation ?? "—"}
                </p>
              </div>
            </div>
          </div>

          {/* ── 추천 벤더 ── */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-slate-500" />
              <p className="text-xs font-bold text-slate-700">추천 벤더</p>
            </div>
            {data.vendors.length === 0 ? (
              <div
                data-testid="reorder-review-no-vendor"
                className="rounded-lg border border-yellow-200 bg-yellow-50 p-3"
              >
                <p className="text-xs text-yellow-700 leading-relaxed">
                  등록된 공급사가 없습니다. 견적 요청으로 시작하세요.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {data.vendors.slice(0, 3).map((v, idx) => (
                  <div
                    key={`${v.vendorName}-${idx}`}
                    data-testid="reorder-review-vendor-row"
                    className="flex items-center justify-between p-2 rounded-md bg-white border border-slate-200"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] font-bold text-slate-400 tabular-nums">
                        {idx + 1}.
                      </span>
                      <span className="text-sm font-medium text-slate-900 truncate">
                        {v.vendorName}
                      </span>
                      {idx === 0 && (
                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] px-1.5 py-0">
                          최근 구매
                        </Badge>
                      )}
                    </div>
                    <span className="text-sm font-semibold text-slate-700 tabular-nums flex-shrink-0">
                      ₩{v.unitPrice.toLocaleString("ko-KR")}/{data.unit ?? "ea"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── 최근 구매 이력 ── */}
          {data.recentPurchases.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-slate-500" />
                <p className="text-xs font-bold text-slate-700">최근 구매</p>
              </div>
              <div className="space-y-1">
                {data.recentPurchases.slice(0, 3).map((p) => (
                  <div
                    key={p.poNumber}
                    data-testid="reorder-review-purchase-row"
                    className="flex items-center justify-between text-xs text-slate-600"
                  >
                    <span className="font-mono text-[11px] text-slate-500">
                      {p.poNumber}
                    </span>
                    <span className="text-slate-500">
                      {p.purchasedAt.slice(0, 10)}
                    </span>
                    <span className="tabular-nums">
                      {p.quantity}
                      {data.unit ?? "ea"} · ₩{p.unitPrice.toLocaleString("ko-KR")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── 예상 금액 ── */}
          {hasVendor && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-50 border border-emerald-200">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-emerald-700" />
                <p className="text-xs font-bold text-emerald-700">예상 금액</p>
              </div>
              <p
                data-testid="reorder-review-estimated-amount"
                className="text-base font-bold text-emerald-700 tabular-nums"
              >
                ₩{estimatedAmount.toLocaleString("ko-KR")}
              </p>
            </div>
          )}

          {/* ── CTA: 견적 요청 / 바로 발주 ── */}
          <div className="flex items-center gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              data-testid="reorder-review-request-quote-cta"
              onClick={handleRequestQuote}
              className="flex-1 h-11 min-h-[44px] text-sm border-slate-300 text-slate-700"
            >
              <FileText className="h-4 w-4 mr-1.5" />
              견적 요청
            </Button>
            <Button
              type="button"
              data-testid="reorder-review-direct-purchase-cta"
              onClick={handleDirectPurchase}
              disabled={!hasVendor}
              className="flex-1 h-11 min-h-[44px] text-sm bg-green-600 hover:bg-green-700 text-white font-semibold disabled:opacity-50"
            >
              <ShoppingCart className="h-4 w-4 mr-1.5" />
              바로 발주
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
