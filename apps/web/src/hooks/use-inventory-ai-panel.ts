"use client";

import { useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

// ── Types ──

export interface InventoryItem {
  id: string;
  productId: string;
  productName: string;
  brand?: string;
  catalogNumber?: string;
  currentQuantity: number;
  unit?: string;
  safetyStock?: number;
  minOrderQty?: number;
  location?: string;
  expiryDate?: string;
  lotNumber?: string;
  autoReorderEnabled: boolean;
  averageDailyUsage?: number;
  leadTimeDays?: number;
  lastInspectedAt?: string;
}

export interface LotInfo {
  lotNumber: string;
  quantity: number;
  expiryDate: string;
  daysUntilExpiry: number;
  isExpired: boolean;
  isExpiringSoon: boolean; // 30일 이내
  recommendAction: "use_first" | "discard_review" | "normal";
}

export interface ReorderRecommendation {
  inventoryId: string;
  productName: string;
  currentQuantity: number;
  safetyStock: number;
  recommendedQty: number;
  estimatedMonthlyUsage?: number;
  estimatedDepletionDays?: number;
  urgency: "urgent" | "high" | "medium";
  suggestedVendor?: string;
  recentUnitPrice?: number;
  leadTimeDays?: number;
}

export interface InventoryIssue {
  type: "shortage" | "expiry" | "no_inspection" | "no_location" | "depleting_fast";
  severity: "error" | "warning" | "info";
  message: string;
  detail?: string;
  suggestedAction?: string;
  badgeLabel: string;
}

export interface BusinessImpact {
  type: "schedule_risk" | "recurring_shortage" | "pending_order" | "alternative_needed";
  message: string;
  detail?: string;
}

// ── Panel States ──

export type InventoryPanelState =
  | "empty"
  | "loading"
  | "success"
  | "warning_shortage"
  | "warning_expiry"
  | "error";

export interface InventoryAiPanelData {
  item: InventoryItem | null;
  stockStatus: {
    currentQuantity: number;
    safetyStock: number;
    stockRatio: number; // 현재/안전 비율
    estimatedDepletionDays: number | null;
    expiringLotCount: number;
    actionNeededCount: number;
  } | null;
  issues: InventoryIssue[];
  reorderRecommendation: ReorderRecommendation | null;
  lots: LotInfo[];
  impacts: BusinessImpact[];
}

// ── Hook ──

export function useInventoryAiPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [panelData, setPanelData] = useState<InventoryAiPanelData>({
    item: null,
    stockStatus: null,
    issues: [],
    reorderRecommendation: null,
    lots: [],
    impacts: [],
  });
  const [error, setError] = useState<string | undefined>();
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // 재주문 추천 데이터 (서버 연동)
  const reorderQuery = useQuery<{ recommendations: ReorderRecommendation[] }>({
    queryKey: ["reorder-recommendations"],
    queryFn: async () => {
      const res = await fetch("/api/inventory/reorder-recommendations");
      if (!res.ok) throw new Error("Failed to fetch reorder recommendations");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    enabled: isOpen,
  });

  // 패널 상태 결정
  const panelState: InventoryPanelState = useMemo(() => {
    if (!selectedItem) return "empty";
    if (isAnalyzing) return "loading";
    if (error) return "error";

    const hasShortage = panelData.issues.some(
      (i) => i.type === "shortage" && i.severity === "error"
    );
    const hasExpiry = panelData.issues.some(
      (i) => i.type === "expiry" && (i.severity === "error" || i.severity === "warning")
    );

    if (hasShortage) return "warning_shortage";
    if (hasExpiry) return "warning_expiry";
    return "success";
  }, [selectedItem, isAnalyzing, error, panelData.issues]);

  // 재고 품목 선택 → 분석 실행
  const preparePanel = useCallback(
    (
      item: InventoryItem,
      options?: {
        lots?: LotInfo[];
        usageHistory?: Array<{ quantity: number; usageDate: string }>;
      }
    ) => {
      setSelectedItem(item);
      setError(undefined);
      setIsAnalyzing(true);
      setIsOpen(true);

      try {
        // ── 이슈 자동 감지 ──
        const issues: InventoryIssue[] = [];

        // 1. 부족 재고 감지
        if (item.safetyStock && item.currentQuantity <= item.safetyStock) {
          const ratio = item.currentQuantity / item.safetyStock;
          issues.push({
            type: "shortage",
            severity: ratio <= 0.3 ? "error" : "warning",
            message:
              ratio <= 0.3
                ? `재고가 안전 수준의 ${Math.round(ratio * 100)}%입니다`
                : `안전 재고(${item.safetyStock}${item.unit || "ea"}) 이하로 내려갔습니다`,
            detail: `현재 ${item.currentQuantity}${item.unit || "ea"} / 안전 재고 ${item.safetyStock}${item.unit || "ea"}`,
            suggestedAction: "재발주 검토",
            badgeLabel: ratio <= 0.3 ? "즉시 조치 필요" : "부족 재고",
          });
        }

        // 2. 재고 소진 속도 감지
        const estimatedDepletionDays = calcDepletionDays(item, options?.usageHistory);
        if (estimatedDepletionDays !== null && estimatedDepletionDays <= 7) {
          issues.push({
            type: "depleting_fast",
            severity: estimatedDepletionDays <= 3 ? "error" : "warning",
            message: `현재 소비 속도 기준 ${estimatedDepletionDays}일 후 소진 예상`,
            detail: "최근 사용 이력 기준으로 산출된 예상치입니다",
            suggestedAction: "재발주 시점 앞당김 검토",
            badgeLabel: estimatedDepletionDays <= 3 ? "즉시 조치 필요" : "오늘 처리 권장",
          });
        }

        // 3. 유효기간 임박 감지
        const lots = options?.lots || [];
        const processedLots = lots.length > 0 ? lots : buildLotsFromItem(item);
        const expiringLots = processedLots.filter((l) => l.isExpiringSoon || l.isExpired);

        if (expiringLots.length > 0) {
          const expiredCount = expiringLots.filter((l) => l.isExpired).length;
          const soonCount = expiringLots.filter((l) => l.isExpiringSoon && !l.isExpired).length;

          if (expiredCount > 0) {
            issues.push({
              type: "expiry",
              severity: "error",
              message: `만료된 Lot가 ${expiredCount}건 있습니다`,
              detail: "폐기 또는 사용 중지 조치가 필요합니다",
              suggestedAction: "폐기 검토",
              badgeLabel: "유효기간 위험",
            });
          }
          if (soonCount > 0) {
            issues.push({
              type: "expiry",
              severity: "warning",
              message: `30일 이내 만료 예정 Lot가 ${soonCount}건 있습니다`,
              detail: "우선 사용하거나 대체품 확보를 검토하세요",
              suggestedAction: "우선 사용 또는 대체품 검토",
              badgeLabel: "유효기간 위험",
            });
          }
        }

        // 4. 점검 미실시
        if (item.lastInspectedAt) {
          const daysSinceInspection = Math.floor(
            (Date.now() - new Date(item.lastInspectedAt).getTime()) / (1000 * 60 * 60 * 24)
          );
          if (daysSinceInspection > 90) {
            issues.push({
              type: "no_inspection",
              severity: "info",
              message: `마지막 점검으로부터 ${daysSinceInspection}일 경과`,
              suggestedAction: "정기 점검 실시",
              badgeLabel: "오늘 처리 권장",
            });
          }
        }

        // 5. 위치 미지정
        if (!item.location) {
          issues.push({
            type: "no_location",
            severity: "info",
            message: "보관 위치가 지정되지 않았습니다",
            suggestedAction: "위치 지정",
            badgeLabel: "오늘 처리 권장",
          });
        }

        // ── 재발주 추천 ──
        let reorderRecommendation: ReorderRecommendation | null = null;
        const isShortage = item.safetyStock
          ? item.currentQuantity <= item.safetyStock
          : false;

        if (isShortage && item.safetyStock) {
          const estimatedMonthly = item.averageDailyUsage
            ? item.averageDailyUsage * 30
            : undefined;
          const recommendedQty = Math.max(
            item.minOrderQty || 1,
            (item.safetyStock || 0) + (estimatedMonthly || 0) - item.currentQuantity
          );

          reorderRecommendation = {
            inventoryId: item.id,
            productName: item.productName,
            currentQuantity: item.currentQuantity,
            safetyStock: item.safetyStock,
            recommendedQty: Math.ceil(recommendedQty),
            estimatedMonthlyUsage: estimatedMonthly,
            estimatedDepletionDays: estimatedDepletionDays ?? undefined,
            urgency:
              item.currentQuantity <= (item.safetyStock * 0.3)
                ? "urgent"
                : item.currentQuantity <= (item.safetyStock * 0.6)
                ? "high"
                : "medium",
            leadTimeDays: item.leadTimeDays ?? undefined,
          };
        }

        // ── 운영 영향 ──
        const impacts: BusinessImpact[] = [];

        if (estimatedDepletionDays !== null && estimatedDepletionDays <= 7) {
          impacts.push({
            type: "schedule_risk",
            message: `${estimatedDepletionDays}일 내 소진 시 실험 일정에 영향이 있을 수 있습니다`,
            detail: "주요 실험 일정을 확인하고, 필요시 일정 조정을 검토하세요",
          });
        }

        if (isShortage && item.leadTimeDays && item.leadTimeDays > 7) {
          impacts.push({
            type: "pending_order",
            message: `리드타임이 ${item.leadTimeDays}일로 즉시 발주해도 보충까지 시간이 소요됩니다`,
            detail: "긴급 납품 가능 여부를 벤더에 확인하세요",
          });
        }

        if (expiringLots.length > 0 && isShortage) {
          impacts.push({
            type: "alternative_needed",
            message: "유효기간 임박과 부족 재고가 동시에 발생했습니다",
            detail: "대체품 또는 긴급 입고를 병행 검토하세요",
          });
        }

        // ── 패널 데이터 설정 ──
        const stockRatio = item.safetyStock
          ? item.currentQuantity / item.safetyStock
          : 1;

        setPanelData({
          item,
          stockStatus: {
            currentQuantity: item.currentQuantity,
            safetyStock: item.safetyStock || 0,
            stockRatio,
            estimatedDepletionDays,
            expiringLotCount: expiringLots.length,
            actionNeededCount: issues.filter((i) => i.severity === "error" || i.severity === "warning").length,
          },
          issues,
          reorderRecommendation,
          lots: processedLots,
          impacts,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "분석 실패");
      } finally {
        setIsAnalyzing(false);
      }
    },
    []
  );

  // 다시 분석
  const retry = useCallback(() => {
    if (selectedItem) {
      preparePanel(selectedItem);
    }
  }, [selectedItem, preparePanel]);

  return {
    isOpen,
    setIsOpen,
    panelState,
    panelData,
    preparePanel,
    retry,
    isAnalyzing,
    error,
  };
}

// ── Helper Functions ──

function calcDepletionDays(
  item: InventoryItem,
  usageHistory?: Array<{ quantity: number; usageDate: string }>
): number | null {
  // averageDailyUsage가 있으면 그걸 사용
  if (item.averageDailyUsage && item.averageDailyUsage > 0) {
    return Math.ceil(item.currentQuantity / item.averageDailyUsage);
  }

  // 사용 이력 기반 계산
  if (usageHistory && usageHistory.length >= 2) {
    const sorted = [...usageHistory].sort(
      (a, b) => new Date(a.usageDate).getTime() - new Date(b.usageDate).getTime()
    );
    const firstDate = new Date(sorted[0].usageDate).getTime();
    const lastDate = new Date(sorted[sorted.length - 1].usageDate).getTime();
    const daySpan = (lastDate - firstDate) / (1000 * 60 * 60 * 24);

    if (daySpan > 0) {
      const totalUsed = sorted.reduce((sum, r) => sum + r.quantity, 0);
      const dailyRate = totalUsed / daySpan;
      if (dailyRate > 0) {
        return Math.ceil(item.currentQuantity / dailyRate);
      }
    }
  }

  return null;
}

function buildLotsFromItem(item: InventoryItem): LotInfo[] {
  if (!item.lotNumber || !item.expiryDate) return [];

  const expiryDate = new Date(item.expiryDate);
  const now = new Date();
  const daysUntilExpiry = Math.ceil(
    (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  const isExpired = daysUntilExpiry < 0;
  const isExpiringSoon = !isExpired && daysUntilExpiry <= 30;

  let recommendAction: LotInfo["recommendAction"] = "normal";
  if (isExpired) recommendAction = "discard_review";
  else if (isExpiringSoon) recommendAction = "use_first";

  return [
    {
      lotNumber: item.lotNumber,
      quantity: item.currentQuantity,
      expiryDate: item.expiryDate,
      daysUntilExpiry,
      isExpired,
      isExpiringSoon,
      recommendAction,
    },
  ];
}
