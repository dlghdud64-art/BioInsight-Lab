"use client";

import { useState, useCallback, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";

// ── Types ──

export interface OrderSummary {
  orderId: string;
  orderNumber: string;
  quoteTitle: string;
  status: string;
  totalAmount: number;
  itemCount: number;
  vendorName?: string;
  vendorEmail?: string;
  expectedDelivery?: string;
  actualDelivery?: string;
  createdAt: string;
  daysSinceOrdered: number;
  items: OrderItemInfo[];
}

export interface OrderItemInfo {
  name: string;
  brand?: string;
  catalogNumber?: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface OrderIssue {
  type: "delay" | "no_response" | "partial_delivery" | "price_change" | "expiry_risk";
  severity: "error" | "warning" | "info";
  message: string;
  detail?: string;
  suggestedAction?: string;
}

export interface FollowUpDraft {
  emailSubject: string;
  emailBody: string;
  vendorName: string;
  vendorEmail?: string;
  reason: string;
}

export interface VendorResponseSummary {
  vendorName: string;
  respondedAt?: string;
  items: Array<{
    itemName: string;
    unitPrice?: number;
    leadTimeDays?: number;
    moq?: number;
    notes?: string;
    inStock?: boolean;
  }>;
  overallLeadTime?: number;
  totalQuoted?: number;
}

export interface StatusTransitionProposal {
  currentStatus: string;
  proposedStatus: string;
  reason: string;
  confidence: "high" | "medium" | "low";
  evidence: string[];
}

// ── Panel States ──

export type OrderPanelState = "empty" | "loading" | "success" | "warning" | "error";

export interface OrderAiPanelData {
  order: OrderSummary | null;
  issues: OrderIssue[];
  followUpDraft: FollowUpDraft | null;
  vendorResponses: VendorResponseSummary[];
  statusProposal: StatusTransitionProposal | null;
}

// ── Hook ──

export function useOrderAiPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [panelData, setPanelData] = useState<OrderAiPanelData>({
    order: null,
    issues: [],
    followUpDraft: null,
    vendorResponses: [],
    statusProposal: null,
  });

  // Follow-up 이메일 초안 생성 mutation
  const followUpMutation = useMutation({
    mutationFn: async (input: {
      orderId: string;
      vendorName: string;
      vendorEmail?: string;
      orderNumber: string;
      items: OrderItemInfo[];
      daysSinceOrdered: number;
    }) => {
      const res = await fetch("/api/ai-actions/generate/vendor-email-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorName: input.vendorName,
          vendorEmail: input.vendorEmail,
          items: input.items.map((item) => ({
            productName: item.name,
            catalogNumber: item.catalogNumber,
            quantity: item.quantity,
            unit: "ea",
          })),
          customMessage: `주문번호 ${input.orderNumber} 관련 후속 문의입니다. 주문일로부터 ${input.daysSinceOrdered}일이 경과하였으며, 진행 상황 확인을 요청합니다.`,
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
        followUpDraft: {
          emailSubject: preview.emailSubject || "",
          emailBody: preview.emailBody || "",
          vendorName: prev.order?.vendorName || "",
          vendorEmail: prev.order?.vendorEmail,
          reason: `주문일로부터 ${prev.order?.daysSinceOrdered || 0}일 경과`,
        },
      }));
    },
  });

  // 패널 상태 결정
  const panelState: OrderPanelState = useMemo(() => {
    if (!panelData.order) return "empty";
    if (followUpMutation.isPending) return "loading";
    if (followUpMutation.isError) return "error";
    if (panelData.issues.some((i) => i.severity === "error")) return "warning";
    return "success";
  }, [panelData, followUpMutation.isPending, followUpMutation.isError]);

  // 주문 데이터 기반 패널 준비
  const preparePanel = useCallback(
    (
      order: OrderSummary,
      options?: {
        vendorResponses?: VendorResponseSummary[];
        autoGenerateFollowUp?: boolean;
      }
    ) => {
      // 이슈 자동 감지
      const issues: OrderIssue[] = [];

      // 응답 지연 감지 (ORDERED 상태에서 3일+ 경과)
      if (order.status === "ORDERED" && order.daysSinceOrdered >= 3) {
        issues.push({
          type: "no_response",
          severity: order.daysSinceOrdered >= 7 ? "error" : "warning",
          message: `주문 후 ${order.daysSinceOrdered}일 경과, 벤더 응답 없음`,
          detail: order.vendorName
            ? `${order.vendorName}에서 아직 확인 회신이 없습니다`
            : "벤더 확인이 필요합니다",
          suggestedAction: "follow-up 이메일 발송",
        });
      }

      // 배송 지연 감지
      if (
        order.expectedDelivery &&
        (order.status === "CONFIRMED" || order.status === "ORDERED")
      ) {
        const expectedDate = new Date(order.expectedDelivery);
        const today = new Date();
        const daysUntilDelivery = Math.ceil(
          (expectedDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysUntilDelivery < 0) {
          issues.push({
            type: "delay",
            severity: "error",
            message: `배송 예정일(${formatDate(order.expectedDelivery)}) ${Math.abs(daysUntilDelivery)}일 초과`,
            detail: "예정일이 지났으나 배송이 시작되지 않았습니다",
            suggestedAction: "배송 일정 재확인 필요",
          });
        } else if (daysUntilDelivery <= 3) {
          issues.push({
            type: "delay",
            severity: "warning",
            message: `배송 예정일까지 ${daysUntilDelivery}일 남음`,
            detail: "배송 상태를 사전에 확인해 주세요",
            suggestedAction: "벤더에 배송 상태 확인",
          });
        }
      }

      // 상태 전환 제안 생성
      let statusProposal: StatusTransitionProposal | null = null;

      if (options?.vendorResponses && options.vendorResponses.length > 0) {
        const latestResponse = options.vendorResponses[0];

        if (order.status === "ORDERED" && latestResponse.respondedAt) {
          statusProposal = {
            currentStatus: order.status,
            proposedStatus: "CONFIRMED",
            reason: `${latestResponse.vendorName}에서 견적 회신이 도착했습니다`,
            confidence: "high",
            evidence: [
              `회신 일시: ${formatDate(latestResponse.respondedAt)}`,
              latestResponse.overallLeadTime
                ? `납기: ${latestResponse.overallLeadTime}일`
                : "",
              latestResponse.totalQuoted
                ? `견적 총액: ₩${latestResponse.totalQuoted.toLocaleString()}`
                : "",
            ].filter(Boolean),
          };
        }
      }

      setPanelData({
        order,
        issues,
        followUpDraft: null,
        vendorResponses: options?.vendorResponses || [],
        statusProposal,
      });
      setIsOpen(true);

      // 응답 지연 시 자동으로 Follow-up 초안 생성
      if (
        (options?.autoGenerateFollowUp ||
          issues.some((i) => i.type === "no_response" || i.type === "delay")) &&
        order.vendorName
      ) {
        followUpMutation.mutate({
          orderId: order.orderId,
          vendorName: order.vendorName,
          vendorEmail: order.vendorEmail,
          orderNumber: order.orderNumber,
          items: order.items,
          daysSinceOrdered: order.daysSinceOrdered,
        });
      }
    },
    [followUpMutation]
  );

  // Follow-up 다시 생성
  const regenerateFollowUp = useCallback(() => {
    if (!panelData.order || !panelData.order.vendorName) return;
    followUpMutation.mutate({
      orderId: panelData.order.orderId,
      vendorName: panelData.order.vendorName,
      vendorEmail: panelData.order.vendorEmail,
      orderNumber: panelData.order.orderNumber,
      items: panelData.order.items,
      daysSinceOrdered: panelData.order.daysSinceOrdered,
    });
  }, [panelData.order, followUpMutation]);

  return {
    isOpen,
    setIsOpen,
    panelState,
    panelData,
    actionId: followUpMutation.data?.actionId as string | undefined,
    preparePanel,
    regenerateFollowUp,
    isGenerating: followUpMutation.isPending,
    error: followUpMutation.error?.message,
  };
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
