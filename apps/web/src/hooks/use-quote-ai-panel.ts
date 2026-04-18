"use client";

import { csrfFetch } from "@/lib/api-client";
import { useState, useCallback, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";

// ── Types ──

export interface QuoteItem {
  productId?: string;
  productName: string;
  brand?: string;
  catalogNumber?: string;
  quantity: number;
  unit?: string;
  specifications?: string;
  estimatedPrice?: number;
}

export interface RecommendedVendor {
  vendorId?: string;
  vendorName: string;
  reason: string;
  recentPrice?: number;
  leadTimeDays?: number;
  moq?: number;
  contactAvailable: boolean;
  email?: string;
}

export interface DraftData {
  emailSubject: string;
  emailBody: string;
  suggestedDeliveryDate: string;
  items: QuoteItem[];
  vendorNames: string[];
}

export interface ValidationIssue {
  field: string;
  message: string;
  severity: "error" | "warning";
}

// ── Panel States ──

export type PanelState = "empty" | "loading" | "success" | "warning" | "error";

export interface QuoteAiPanelData {
  items: QuoteItem[];
  vendors: RecommendedVendor[];
  draft: DraftData | null;
  validationIssues: ValidationIssue[];
  estimatedLeadTime: { min: number; max: number } | null;
}

// ── Hook ──

export function useQuoteAiPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [panelData, setPanelData] = useState<QuoteAiPanelData>({
    items: [],
    vendors: [],
    draft: null,
    validationIssues: [],
    estimatedLeadTime: null,
  });

  // AI 초안 생성 mutation
  const generateMutation = useMutation({
    mutationFn: async (input: {
      items: QuoteItem[];
      deliveryDate?: string;
      deliveryLocation?: string;
      vendorNames?: string[];
    }) => {
      const res = await csrfFetch("/api/ai-actions/generate/quote-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: input.items.map((item) => ({
            productName: item.productName,
            catalogNumber: item.catalogNumber,
            brand: item.brand,
            quantity: item.quantity,
            unit: item.unit || "ea",
            specifications: item.specifications,
          })),
          vendorNames: input.vendorNames,
          deliveryDate: input.deliveryDate,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "생성 실패" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      return res.json();
    },
    onSuccess: (data) => {
      const preview = data.preview || {};
      setPanelData((prev) => ({
        ...prev,
        draft: {
          emailSubject: preview.emailSubject || "",
          emailBody: preview.emailBody || "",
          suggestedDeliveryDate: preview.suggestedDeliveryDate || "",
          items: prev.items,
          vendorNames: prev.vendors.map((v) => v.vendorName),
        },
      }));
    },
  });

  // 패널 상태 결정
  const panelState: PanelState = useMemo(() => {
    if (panelData.items.length === 0) return "empty";
    if (generateMutation.isPending) return "loading";
    if (generateMutation.isError) return "error";
    if (panelData.validationIssues.filter((v) => v.severity === "error").length > 0) return "warning";
    if (panelData.draft) return "success";
    return "empty";
  }, [panelData, generateMutation.isPending, generateMutation.isError]);

  // 품목 설정 + 벤더 추천 + 유효성 검사
  const preparePanel = useCallback(
    (
      items: QuoteItem[],
      options?: {
        vendors?: RecommendedVendor[];
        deliveryDate?: string;
        deliveryLocation?: string;
      }
    ) => {
      // 유효성 검사
      const issues: ValidationIssue[] = [];
      items.forEach((item) => {
        if (!item.quantity || item.quantity <= 0) {
          issues.push({
            field: `${item.productName} 수량`,
            message: `${item.productName}의 수량이 비어 있습니다`,
            severity: "error",
          });
        }
      });
      if (!options?.deliveryDate) {
        issues.push({
          field: "희망 납기",
          message: "희망 납기가 비어 있습니다",
          severity: "warning",
        });
      }
      if (!options?.deliveryLocation) {
        issues.push({
          field: "납품 위치",
          message: "납품 위치가 비어 있습니다",
          severity: "warning",
        });
      }
      if (items.length > 0 && (!options?.vendors || options.vendors.length === 0)) {
        issues.push({
          field: "벤더",
          message: "추천 벤더 정보가 없습니다",
          severity: "warning",
        });
      }

      // 리드타임 범위 계산
      const leadTimes = (options?.vendors || [])
        .filter((v) => v.leadTimeDays != null)
        .map((v) => v.leadTimeDays!);
      const estimatedLeadTime =
        leadTimes.length > 0
          ? { min: Math.min(...leadTimes), max: Math.max(...leadTimes) }
          : null;

      setPanelData({
        items,
        vendors: options?.vendors || [],
        draft: null,
        validationIssues: issues,
        estimatedLeadTime,
      });
      setIsOpen(true);

      // 유효성 에러가 없으면 자동 생성
      const hasErrors = issues.some((i) => i.severity === "error");
      if (!hasErrors && items.length > 0) {
        generateMutation.mutate({
          items,
          deliveryDate: options?.deliveryDate,
          deliveryLocation: options?.deliveryLocation,
          vendorNames: options?.vendors?.map((v) => v.vendorName),
        });
      }
    },
    [generateMutation]
  );

  // 초안 다시 생성
  const regenerate = useCallback(() => {
    if (panelData.items.length === 0) return;
    generateMutation.mutate({
      items: panelData.items,
      vendorNames: panelData.vendors.map((v) => v.vendorName),
    });
  }, [panelData.items, panelData.vendors, generateMutation]);

  return {
    isOpen,
    setIsOpen,
    panelState,
    panelData,
    actionId: generateMutation.data?.actionId as string | undefined,
    preparePanel,
    regenerate,
    isGenerating: generateMutation.isPending,
    error: generateMutation.error?.message,
  };
}
