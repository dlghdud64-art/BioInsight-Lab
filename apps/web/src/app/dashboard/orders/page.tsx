"use client";

import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, ChevronRight, Bell, Sparkles } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import { useOrderAiPanel } from "@/hooks/use-order-ai-panel";
import { OrderAiAssistantPanel } from "@/components/ai/order-ai-assistant-panel";
import { OpsExecutionContext } from "@/components/ops/ops-execution-context";

type OrderStatus = "pending" | "quoted" | "ordered" | "shipping" | "delivered";

const STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; borderClass: string }
> = {
  pending:   { label: "견적 대기",  borderClass: "border-l-amber-400" },
  quoted:    { label: "견적 도착",  borderClass: "border-l-blue-400" },
  ordered:   { label: "발주 완료",  borderClass: "border-l-slate-300" },
  shipping:  { label: "배송 중",    borderClass: "border-l-emerald-400" },
  delivered: { label: "배송 완료",  borderClass: "border-l-emerald-400" },
};

const MOCK_ORDERS = [
  {
    id: "ORD-202602-001",
    title: "Fetal Bovine Serum 외 2건",
    requestedAt: "2026. 02. 25",
    status: "quoted" as OrderStatus,
    amount: 1092000,
    amountLabel: "최저가 견적",
    actionLabel: "견적서 확인",
    actionPrimary: true,
  },
  {
    id: "ORD-202602-002",
    title: "Sigma-Aldrich Acetone 500ml",
    requestedAt: "2026. 02. 24",
    status: "pending" as OrderStatus,
    amount: null,
    amountLabel: "예상 금액",
    amountDisplay: "심사 중",
    actionLabel: "상세 보기",
    actionPrimary: false,
  },
  {
    id: "ORD-202602-003",
    title: "Centrifuge 튜브 50ml × 10박스",
    requestedAt: "2026. 02. 20",
    status: "ordered" as OrderStatus,
    amount: 850000,
    amountLabel: "확정 금액",
    actionLabel: "상세 보기",
    actionPrimary: false,
  },
  {
    id: "ORD-202602-004",
    title: "DMEM Medium 500ml × 5",
    requestedAt: "2026. 02. 18",
    status: "shipping" as OrderStatus,
    amount: 420000,
    amountLabel: "결제 금액",
    actionLabel: "배송 추적",
    actionPrimary: false,
  },
];

// ── Order Row (replaces OrderCard) ──
function OrderRow({
  order,
  onTrack,
}: {
  order: (typeof MOCK_ORDERS)[number];
  onTrack?: () => void;
}) {
  const config = STATUS_CONFIG[order.status];
  const showTrackButton = order.status === "ordered" || order.status === "shipping";

  return (
    <div className={`flex items-center gap-3 px-3 py-2 border-b border-l-[3px] hover:bg-muted/30 transition-colors ${config.borderClass}`}>
      {/* Status badge first */}
      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 flex-shrink-0 whitespace-nowrap">
        {config.label}
      </Badge>

      {/* Title + meta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-foreground truncate">{order.title}</span>
          <span className="text-[10px] font-mono text-muted-foreground flex-shrink-0">{order.id}</span>
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
          <span>{order.requestedAt}</span>
          {order.amount != null && (
            <span className="font-medium text-foreground tabular-nums">₩{order.amount.toLocaleString("ko-KR")}</span>
          )}
          {!!(order as Record<string, unknown>).amountDisplay && (
            <span className="text-muted-foreground">{String((order as Record<string, unknown>).amountDisplay)}</span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {showTrackButton && onTrack && (
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-[11px] px-2"
            onClick={onTrack}
          >
            <Sparkles className="h-3 w-3 mr-0.5" />추적
          </Button>
        )}
        <Button
          variant={order.actionPrimary ? "default" : "outline"}
          size="sm"
          className="h-6 text-[11px] px-2.5"
          asChild
        >
          <Link href={`/dashboard/orders/${order.id}`}>
            {order.actionLabel}
          </Link>
        </Button>
      </div>
    </div>
  );
}

function OrderHistoryPageContent() {
  const searchParams = useSearchParams();
  const aiPanelOpen = searchParams.get("ai_panel") === "open";
  const entityIdParam = searchParams.get("entity_id");

  const allOrders = MOCK_ORDERS;
  const pendingOrders = MOCK_ORDERS.filter((o) => o.status === "pending");
  const quotedOrders = MOCK_ORDERS.filter((o) => o.status === "quoted");
  const orderedOrders = MOCK_ORDERS.filter((o) => o.status === "ordered");
  const shippingOrders = MOCK_ORDERS.filter((o) =>
    ["shipping", "delivered"].includes(o.status)
  );

  const aiPanel = useOrderAiPanel();

  useEffect(() => {
    if (aiPanelOpen && !aiPanel.isOpen) {
      aiPanel.setIsOpen(true);
    }
  }, [aiPanelOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTrackOrder = (order: (typeof MOCK_ORDERS)[number]) => {
    const statusMap: Record<string, string> = {
      pending: "ORDERED", quoted: "ORDERED", ordered: "ORDERED",
      shipping: "SHIPPING", delivered: "DELIVERED",
    };
    const daysSince = Math.floor(
      (Date.now() - new Date(order.requestedAt.replace(/\. /g, "-")).getTime()) / (1000 * 60 * 60 * 24)
    );
    aiPanel.preparePanel({
      orderId: order.id,
      orderNumber: order.id,
      quoteTitle: order.title,
      status: statusMap[order.status] || "ORDERED",
      totalAmount: order.amount || 0,
      itemCount: 1,
      vendorName: "Sigma-Aldrich",
      expectedDelivery: undefined,
      createdAt: order.requestedAt,
      daysSinceOrdered: daysSince,
      items: [{ name: order.title.split(" 외")[0], quantity: 1, unitPrice: order.amount || 0, lineTotal: order.amount || 0 }],
    });
  };

  const renderOrders = (orders: typeof MOCK_ORDERS, showTrack = false) =>
    orders.length > 0 ? (
      <div className="bg-card border rounded-md">
        {orders.map((order) => (
          <OrderRow
            key={order.id}
            order={order}
            onTrack={showTrack ? () => handleTrackOrder(order) : undefined}
          />
        ))}
      </div>
    ) : (
      <div className="py-8 text-center text-sm text-muted-foreground">해당 상태의 주문이 없습니다.</div>
    );

  return (
    <>
      <div className="flex-1 space-y-5 p-4 md:p-8 pt-4 md:pt-6 max-w-6xl mx-auto w-full">
        <div className="flex flex-col space-y-0.5">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">견적 및 구매 내역</h2>
          <p className="text-xs text-muted-foreground">요청하신 견적과 진행 중인 주문을 확인하세요.</p>
        </div>

        {/* Summary Strip */}
        <div className="flex flex-wrap items-center gap-4 border rounded-md px-3 py-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">전체</span>
            <span className="text-sm font-semibold tabular-nums text-foreground">{allOrders.length}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">견적 대기</span>
            <span className={`text-sm font-semibold tabular-nums ${pendingOrders.length > 0 ? "text-amber-400" : "text-foreground"}`}>{pendingOrders.length}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">견적 도착</span>
            <span className={`text-sm font-semibold tabular-nums ${quotedOrders.length > 0 ? "text-blue-400" : "text-foreground"}`}>{quotedOrders.length}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">배송 중</span>
            <span className={`text-sm font-semibold tabular-nums ${shippingOrders.length > 0 ? "text-emerald-400" : "text-foreground"}`}>{shippingOrders.length}</span>
          </div>
        </div>

        <Tabs defaultValue="all" className="w-full">
          <TabsList className="mb-4 bg-muted/50 p-1 flex flex-wrap h-auto gap-0.5">
            <TabsTrigger value="all" className="text-xs">전체 ({allOrders.length})</TabsTrigger>
            <TabsTrigger value="pending" className="text-xs">견적 대기 ({pendingOrders.length})</TabsTrigger>
            <TabsTrigger value="quoted" className="text-xs">견적 도착 ({quotedOrders.length})</TabsTrigger>
            <TabsTrigger value="ordered" className="text-xs">발주 완료 ({orderedOrders.length})</TabsTrigger>
            <TabsTrigger value="shipping" className="text-xs">배송 중 ({shippingOrders.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-0">{renderOrders(allOrders, true)}</TabsContent>
          <TabsContent value="pending" className="mt-0">{renderOrders(pendingOrders)}</TabsContent>
          <TabsContent value="quoted" className="mt-0">{renderOrders(quotedOrders)}</TabsContent>
          <TabsContent value="ordered" className="mt-0">{renderOrders(orderedOrders, true)}</TabsContent>
          <TabsContent value="shipping" className="mt-0">{renderOrders(shippingOrders, true)}</TabsContent>
        </Tabs>
      </div>

      {/* 운영 실행 현황 (deep-link) */}
      {entityIdParam && (
        <div className="fixed bottom-4 right-4 z-40 w-80 border rounded-md bg-card p-3">
          <OpsExecutionContext entityType="ORDER" entityId={entityIdParam} compact />
        </div>
      )}

      {/* AI Assistant Panel */}
      <OrderAiAssistantPanel
        open={aiPanel.isOpen}
        onOpenChange={aiPanel.setIsOpen}
        state={aiPanel.panelState}
        data={aiPanel.panelData}
        actionId={aiPanel.actionId}
        onRegenerateFollowUp={aiPanel.regenerateFollowUp}
        onApproveFollowUp={async (actionId, payload) => {
          const res = await fetch(`/api/ai-actions/${actionId}/approve`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ payload }),
          });
          if (res.ok) aiPanel.setIsOpen(false);
        }}
        isGenerating={aiPanel.isGenerating}
        error={aiPanel.error}
      />
    </>
  );
}

export default function OrderHistoryPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      }
    >
      <OrderHistoryPageContent />
    </Suspense>
  );
}
