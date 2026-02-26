"use client";

import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, ChevronRight, Bell } from "lucide-react";

type OrderStatus = "pending" | "quoted" | "ordered" | "shipping" | "delivered";

const STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; dot: "amber" | "blue" | "slate" | "emerald"; dotPulse?: boolean; className: string; borderClass: string }
> = {
  pending: {
    label: "견적 대기",
    dot: "amber",
    className: "bg-amber-50 text-amber-700 border-amber-200",
    borderClass: "border-slate-200",
  },
  quoted: {
    label: "견적 도착",
    dot: "blue",
    dotPulse: true,
    className: "bg-blue-50 text-blue-700 border-blue-200",
    borderClass: "border-blue-100",
  },
  ordered: {
    label: "발주 완료",
    dot: "slate",
    className: "bg-slate-100 text-slate-600 border-slate-200",
    borderClass: "border-slate-200",
  },
  shipping: {
    label: "배송 중",
    dot: "emerald",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    borderClass: "border-slate-200",
  },
  delivered: {
    label: "배송 완료",
    dot: "emerald",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    borderClass: "border-slate-200",
  },
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

function OrderCard({
  order,
}: {
  order: (typeof MOCK_ORDERS)[number];
}) {
  const config = STATUS_CONFIG[order.status];
  const isQuoted = order.status === "quoted";

  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-white border rounded-xl shadow-sm hover:shadow-md transition-all ${config.borderClass}`}
    >
      <div className="flex items-center gap-4 min-w-0">
        <div
          className={`h-12 w-12 rounded-full flex items-center justify-center shrink-0 ${
            isQuoted ? "bg-blue-50" : "bg-slate-50"
          }`}
        >
          <FileText
            className={`h-6 w-6 ${isQuoted ? "text-blue-600" : "text-slate-400"}`}
          />
        </div>
        <div className="min-w-0">
          <h3 className="font-bold text-slate-900 text-lg truncate">
            {order.title}
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            요청일: {order.requestedAt} • 주문번호: {order.id}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 sm:gap-6">
        <Badge
          variant="outline"
          dot={config.dot}
          dotPulse={config.dotPulse}
          className={`${config.className} shrink-0`}
        >
          {config.label}
        </Badge>
        <div className="text-right hidden md:block shrink-0">
          <p className="text-sm text-slate-500">{order.amountLabel}</p>
          <p
            className={`font-bold text-lg ${
              order.amountDisplay ? "text-slate-400" : ""
            }`}
          >
            {order.amountDisplay ??
              (order.amount != null
                ? `₩ ${order.amount.toLocaleString("ko-KR")}`
                : "-")}
          </p>
        </div>
        <Button
          variant={order.actionPrimary ? "default" : "outline"}
          className={
            order.actionPrimary
              ? "bg-blue-600 hover:bg-blue-700 shrink-0"
              : "text-slate-600 border-slate-200 shrink-0"
          }
          asChild
        >
          <Link href={`/dashboard/orders/${order.id}`}>
            {order.actionLabel}
            <ChevronRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

export default function OrderHistoryPage() {
  const allOrders = MOCK_ORDERS;
  const pendingOrders = MOCK_ORDERS.filter((o) => o.status === "pending");
  const quotedOrders = MOCK_ORDERS.filter((o) => o.status === "quoted");
  const orderedOrders = MOCK_ORDERS.filter((o) => o.status === "ordered");
  const shippingOrders = MOCK_ORDERS.filter((o) =>
    ["shipping", "delivered"].includes(o.status)
  );

  return (
    <div className="flex-1 space-y-6 p-8 pt-6 max-w-6xl mx-auto w-full">
      <div className="flex flex-col space-y-2 mb-6">
        <h2 className="text-3xl font-bold tracking-tight">견적 및 구매 내역</h2>
        <p className="text-muted-foreground">
          요청하신 견적과 진행 중인 주문을 확인하세요.
        </p>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="mb-6 bg-slate-100/50 p-1 flex flex-wrap h-auto gap-1">
          <TabsTrigger value="all">전체</TabsTrigger>
          <TabsTrigger value="pending">견적 대기</TabsTrigger>
          <TabsTrigger
            value="quoted"
            className="text-blue-600 data-[state=active]:text-blue-700 data-[state=active]:bg-blue-50 dark:data-[state=active]:bg-blue-950/30 text-slate-600 dark:text-slate-300"
          >
            <Bell className="mr-2 h-4 w-4 text-slate-500" />
            견적 도착
          </TabsTrigger>
          <TabsTrigger value="ordered">발주 완료</TabsTrigger>
          <TabsTrigger value="shipping">배송 중</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4 mt-0">
          {allOrders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </TabsContent>
        <TabsContent value="pending" className="space-y-4 mt-0">
          {pendingOrders.length > 0 ? (
            pendingOrders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))
          ) : (
            <p className="text-muted-foreground py-8 text-center">
              견적 대기 중인 건이 없습니다.
            </p>
          )}
        </TabsContent>
        <TabsContent value="quoted" className="space-y-4 mt-0">
          {quotedOrders.length > 0 ? (
            quotedOrders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))
          ) : (
            <p className="text-muted-foreground py-8 text-center">
              도착한 견적이 없습니다.
            </p>
          )}
        </TabsContent>
        <TabsContent value="ordered" className="space-y-4 mt-0">
          {orderedOrders.length > 0 ? (
            orderedOrders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))
          ) : (
            <p className="text-muted-foreground py-8 text-center">
              발주 완료된 건이 없습니다.
            </p>
          )}
        </TabsContent>
        <TabsContent value="shipping" className="space-y-4 mt-0">
          {shippingOrders.length > 0 ? (
            shippingOrders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))
          ) : (
            <p className="text-muted-foreground py-8 text-center">
              배송 중인 건이 없습니다.
            </p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
