"use client";

/**
 * §inventory-reorder-surface-unify P2 — ReorderReviewSheet content-level 승격 래퍼.
 *
 * 목적: ReorderReviewSheet(§11.310)는 그동안 InventoryAiAssistantPanel 내부 state
 *   (isReorderSheetOpen)로만 열렸다. ContextPanel·모바일이 재발주 검토를 직접 열 수 있도록
 *   open/onClose/품목 입력만 받는 얇은 래퍼로 분리한다(분석 래퍼 비의존).
 *
 * canonical 경계(honesty):
 *   - recommendedQty: caller(content)가 /api/inventory/reorder-recommendations(데스크탑 패널과
 *     동일 소스)에서 주입. null/0이면 data=null → 시트 미표시(가짜 수량 0 금지).
 *   - vendors / recentPurchases: useReorderRecommendation(§11.310b, PurchaseRecord 집계). 파생만.
 *
 * 바로 발주(PO) purchasing-off 게이팅은 P3에서 ReorderReviewSheet prop으로 추가 예정.
 */

import {
  ReorderReviewSheet,
  type ReorderReviewInput,
} from "@/components/inventory/ReorderReviewSheet";
import { useReorderRecommendation } from "@/hooks/use-reorder-recommendation";

export interface InventoryReorderReviewSheetProps {
  open: boolean;
  onClose: () => void;
  productId: string | null;
  productName: string | null;
  /** canonical(/reorder-recommendations) 주입. null/0 → 미표시(가짜 0 금지). */
  recommendedQty: number | null;
  unit?: string;
  storageLocation?: string | null;
  /** §inventory-reorder-surface-unify P4 — 공급사 소싱 검색 진입(/app/search?q=, §11.381c 재배선). */
  onSearchVendors?: () => void;
}

export function InventoryReorderReviewSheet({
  open,
  onClose,
  productId,
  productName,
  recommendedQty,
  unit,
  storageLocation,
  onSearchVendors,
}: InventoryReorderReviewSheetProps) {
  // productName null/닫힘 시 hook 호출 0(enabled 가드). open 시에만 벤더·최근구매 fetch.
  const rec = useReorderRecommendation(open ? productName : null);

  const data: ReorderReviewInput | null =
    productName && recommendedQty != null && recommendedQty > 0
      ? {
          productId,
          productName,
          recommendedQty,
          unit: unit ?? "ea",
          storageLocation: storageLocation ?? null,
          vendors: rec.vendors.map((v) => ({
            vendorName: v.vendorName,
            unitPrice: v.unitPrice,
            lastPurchasedAt: v.lastPurchasedAt || null,
          })),
          recentPurchases: rec.recentPurchases.map((p) => ({
            poNumber: p.poNumber,
            purchasedAt: p.purchasedAt,
            quantity: p.quantity,
            unitPrice: p.unitPrice,
          })),
        }
      : null;

  return <ReorderReviewSheet open={open} onClose={onClose} data={data} onSearchVendors={onSearchVendors} />;
}
