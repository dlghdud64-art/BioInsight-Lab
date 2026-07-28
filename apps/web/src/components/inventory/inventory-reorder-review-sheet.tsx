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
 * §inventory-mobile-reorder-gate P2 — 침묵 금지 보강:
 *   - fallbackQty: AI 추천 미산출/로딩 시 caller가 안전재고 기준 수량(safetyStock−current)을 주입.
 *     이때 qtySource="safety-fallback"으로 시트에 출처 배지 노출(가짜 AI 라벨 금지).
 *   - breakdown: canonical recommendationBreakdown → 스테퍼 근거 캡션.
 *   - overrideReasons: 소프트 게이트(P3) 통과 시 차단 사유 — 시트 표기 + 견적 초안 reason 전파.
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
  /** §inventory-mobile-reorder-gate P2 — AI 미산출 시 안전재고 기준 수량(출처 배지 표기). */
  fallbackQty?: number | null;
  /** §inventory-mobile-reorder-gate P2 — 현재/부족 요약·상태 pill 용(실값). */
  currentQuantity?: number | null;
  safetyStock?: number | null;
  /** §inventory-mobile-reorder-gate P2 — canonical recommendationBreakdown(스테퍼 근거 캡션). */
  breakdown?: { safetyGap: number; leadTimeConsumption: number; rawQuantity: number; minOrderQty: number } | null;
  /** §inventory-mobile-reorder-gate P3 — 소프트 게이트 통과(override) 사유. 시트 표기 + 견적 reason 전파. */
  overrideReasons?: string[] | null;
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
  fallbackQty = null,
  currentQuantity = null,
  safetyStock = null,
  breakdown = null,
  overrideReasons = null,
  onSearchVendors,
}: InventoryReorderReviewSheetProps) {
  // productName null/닫힘 시 hook 호출 0(enabled 가드). open 시에만 벤더·최근구매 fetch.
  const rec = useReorderRecommendation(open ? productName : null);

  // §inventory-mobile-reorder-gate P2 — canonical 우선, 미산출 시 fallback(출처 구분). 둘 다 없으면 미표시.
  const hasCanonicalQty = recommendedQty != null && recommendedQty > 0;
  const effectiveQty = hasCanonicalQty
    ? recommendedQty
    : fallbackQty != null && fallbackQty > 0
      ? fallbackQty
      : null;

  const data: ReorderReviewInput | null =
    productName && effectiveQty != null
      ? {
          productId,
          productName,
          recommendedQty: effectiveQty,
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

  return (
    <ReorderReviewSheet
      open={open}
      onClose={onClose}
      data={data}
      qtySource={hasCanonicalQty ? "ai" : "safety-fallback"}
      currentQuantity={currentQuantity}
      safetyStock={safetyStock}
      breakdown={hasCanonicalQty ? breakdown : null}
      overrideReasons={overrideReasons}
      onSearchVendors={onSearchVendors}
    />
  );
}
