"use client";

export const dynamic = "force-dynamic";

/**
 * §11.80 #order-operator-surface
 * ──────────────────────────────────────────────────────────────────
 * §11.59 Phase 0 audit 에서 발견된 Order 운영 surface 부재 (admin 이
 * Order.status 를 ORDERED → CONFIRMED → SHIPPING → DELIVERED 로 전환할
 * UI 진입점이 LabAxis frontend 에 없던 문제) 의 Track B 후속 fix.
 *
 * Surface:
 *   - admin sub-tree 의 신규 page (`/admin/orders`)
 *   - AdminSidebar layout 사용 (다른 /admin/* 일관)
 *   - Order list table (orderNumber / status / user / totalAmount / createdAt)
 *   - row 의 status 전환 dialog: 다음 status 선택 + DELIVERED 시 lot/expiry
 *     /location/receivedAt input (§11.59 deliveryDefaults forward)
 *   - mutation 후 list refetch
 *
 * Out of scope:
 *   - 모바일 최적화 (admin desktop primary)
 *   - bulk transition (별도 트랙 #admin-order-bulk-status)
 *   - PO 발행 (별도 트랙)
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { csrfFetch } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { AdminSidebar } from "../_components/admin-sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ShoppingCart,
  RefreshCw,
  Loader2,
  Package,
  ArrowRight,
} from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

type OrderStatus = "ORDERED" | "CONFIRMED" | "SHIPPING" | "DELIVERED" | "CANCELLED";

const STATUS_LABEL: Record<OrderStatus, string> = {
  ORDERED: "주문 완료",
  CONFIRMED: "확인됨",
  SHIPPING: "배송 중",
  DELIVERED: "배송 완료",
  CANCELLED: "취소됨",
};

const STATUS_TONE: Record<OrderStatus, string> = {
  ORDERED: "bg-blue-50 text-blue-700 border-blue-200",
  CONFIRMED: "bg-purple-50 text-purple-700 border-purple-200",
  SHIPPING: "bg-yellow-50 text-yellow-700 border-yellow-200",
  DELIVERED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  CANCELLED: "bg-rose-50 text-rose-700 border-rose-200",
};

// Allowed transitions (admin status route 와 정합)
const NEXT_STATES: Record<OrderStatus, OrderStatus[]> = {
  ORDERED: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["SHIPPING", "CANCELLED"],
  SHIPPING: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: ["ORDERED"],
};

interface OrderRow {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  totalAmount: number;
  notes: string | null;
  shippingAddress: string | null;
  expectedDelivery: string | null;
  actualDelivery: string | null;
  createdAt: string;
  user: { id: string; email: string; name: string | null };
  organization: { id: string; name: string } | null;
  items: Array<{
    id: string;
    productId: string | null;
    name: string;
    brand: string | null;
    catalogNumber: string | null;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  quote: { id: string; title: string; quoteNumber: string | null } | null;
}

export default function AdminOrdersPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedOrder, setSelectedOrder] = useState<OrderRow | null>(null);
  const [nextStatus, setNextStatus] = useState<OrderStatus | "">("");
  const [notes, setNotes] = useState("");
  const [lotNumber, setLotNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [location, setLocation] = useState("");
  const [receivedAt, setReceivedAt] = useState("");
  // §11.102 — bulk transition state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkNextStatus, setBulkNextStatus] = useState<OrderStatus | "">("");

  const { data, isLoading, isError, refetch, isFetching } = useQuery<{
    orders: OrderRow[];
    total: number;
  }>({
    queryKey: ["admin-orders", statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);
      const res = await fetch(`/api/admin/orders?${params.toString()}`);
      if (!res.ok) throw new Error("Order 목록 조회 실패");
      return res.json();
    },
  });

  const orders = data?.orders ?? [];

  const statusMutation = useMutation({
    mutationFn: async (vars: {
      orderId: string;
      status: OrderStatus;
      notes?: string;
      deliveryDefaults?: {
        lotNumber?: string;
        expiryDate?: string;
        location?: string;
        receivedAt?: string;
      };
    }) => {
      const res = await csrfFetch(`/api/admin/orders/${vars.orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: vars.status,
          notes: vars.notes,
          deliveryDefaults: vars.deliveryDefaults,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "상태 전환 실패");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "상태 전환 완료",
        description: `Order ${selectedOrder?.orderNumber} ${
          STATUS_LABEL[nextStatus as OrderStatus] ?? ""
        } 처리됨`,
      });
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      closeDialog();
    },
    onError: (err: Error) => {
      toast({
        title: "상태 전환 실패",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  // §11.102 — bulk transition mutation
  const bulkStatusMutation = useMutation({
    mutationFn: async (vars: {
      orderIds: string[];
      status: OrderStatus;
    }) => {
      const res = await csrfFetch(`/api/admin/orders/bulk-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderIds: vars.orderIds,
          status: vars.status,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "일괄 전환 실패");
      }
      return res.json() as Promise<{
        successCount: number;
        failedItems: Array<{ orderId: string; error: string }>;
      }>;
    },
    onSuccess: (result) => {
      const failedCount = result.failedItems.length;
      if (failedCount === 0) {
        toast({
          title: "일괄 전환 완료",
          description: `${result.successCount}건 처리됨`,
        });
      } else {
        toast({
          title: "부분 성공",
          description: `${result.successCount}건 성공, ${failedCount}건 실패. 실패 항목: ${result.failedItems
            .slice(0, 3)
            .map((f) => f.orderId.slice(0, 8))
            .join(", ")}${failedCount > 3 ? " 외" : ""}`,
          variant: failedCount > result.successCount ? "destructive" : "default",
        });
      }
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      setSelectedIds(new Set());
      setBulkNextStatus("");
    },
    onError: (err: Error) => {
      toast({
        title: "일괄 전환 실패",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const openDialog = (order: OrderRow) => {
    setSelectedOrder(order);
    setNextStatus("");
    setNotes("");
    setLotNumber("");
    setExpiryDate("");
    setLocation("");
    setReceivedAt("");
  };

  const closeDialog = () => {
    setSelectedOrder(null);
    setNextStatus("");
  };

  const handleSubmit = () => {
    if (!selectedOrder || !nextStatus) return;
    const deliveryDefaults =
      nextStatus === "DELIVERED" &&
      (lotNumber || expiryDate || location || receivedAt)
        ? {
            lotNumber: lotNumber || undefined,
            expiryDate: expiryDate || undefined,
            location: location || undefined,
            receivedAt: receivedAt || undefined,
          }
        : undefined;
    statusMutation.mutate({
      orderId: selectedOrder.id,
      status: nextStatus,
      notes: notes || undefined,
      deliveryDefaults,
    });
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-6 py-3.5 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <ShoppingCart className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <h1 className="text-base font-bold text-slate-900">주문 운영</h1>
                <p className="text-[11px] text-slate-500 mt-0.5 break-keep">
                  Order 상태를 ORDERED → CONFIRMED → SHIPPING → DELIVERED 로 전환합니다.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 w-[140px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 상태</SelectItem>
                  {(Object.keys(STATUS_LABEL) as OrderStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1.5"
                onClick={() => refetch()}
                disabled={isFetching}
              >
                {isFetching ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
                새로 고침
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-6">
          {isLoading ? (
            <div className="bg-white border border-slate-200 rounded-lg py-16 text-center">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400 mx-auto mb-2" />
              <p className="text-sm text-slate-500">Order 목록 로딩 중...</p>
            </div>
          ) : isError ? (
            <div className="bg-rose-50 border border-rose-200 rounded-lg py-12 text-center">
              <p className="text-sm text-rose-700">Order 목록을 불러오지 못했습니다.</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-lg py-16 text-center">
              <Package className="h-8 w-8 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-700 mb-1">Order 가 없습니다.</p>
              <p className="text-[11px] text-slate-400">
                견적이 PURCHASED 상태로 전환되면 Order 가 자동 생성됩니다.
              </p>
            </div>
          ) : (
            <>
              {/* §11.102 — bulk action bar (selectedIds 가 있을 때만 노출)
                  §11.119 — 모바일 fixed bottom (선택 후 즉시 액션) / 데스크탑 inline */}
              {selectedIds.size > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-3 flex items-center gap-3 flex-wrap fixed bottom-0 inset-x-0 z-40 md:static md:rounded-xl shadow-lg md:shadow-sm">
                  <span className="text-sm font-bold text-blue-900">
                    선택 {selectedIds.size}개
                  </span>
                  <Select
                    value={bulkNextStatus}
                    onValueChange={(v) => setBulkNextStatus(v as OrderStatus)}
                  >
                    <SelectTrigger className="h-8 w-[160px] text-xs bg-white">
                      <SelectValue placeholder="다음 상태 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {(["CONFIRMED", "SHIPPING", "DELIVERED", "CANCELLED"] as OrderStatus[]).map((s) => (
                        <SelectItem key={s} value={s}>
                          {STATUS_LABEL[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                    disabled={!bulkNextStatus || bulkStatusMutation.isPending}
                    onClick={() => {
                      if (!bulkNextStatus) return;
                      bulkStatusMutation.mutate({
                        orderIds: Array.from(selectedIds),
                        status: bulkNextStatus,
                      });
                    }}
                  >
                    {bulkStatusMutation.isPending ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                        처리 중
                      </>
                    ) : (
                      "일괄 전환"
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-xs text-blue-700 hover:bg-blue-100 ml-auto"
                    onClick={() => {
                      setSelectedIds(new Set());
                      setBulkNextStatus("");
                    }}
                  >
                    선택 해제
                  </Button>
                </div>
              )}

              {/* §11.119 — mobile card list (md 미만) */}
              <div className="md:hidden space-y-2">
                {orders.map((order) => {
                  const canTransition = NEXT_STATES[order.status].length > 0;
                  const isSelected = selectedIds.has(order.id);
                  return (
                    <div
                      key={order.id}
                      className={`bg-white border rounded-xl p-3 shadow-sm ${
                        isSelected
                          ? "border-blue-300 bg-blue-50/40"
                          : "border-slate-200"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          className="h-4 w-4 mt-1 cursor-pointer accent-blue-600 shrink-0"
                          checked={isSelected}
                          disabled={!canTransition}
                          onChange={(e) => {
                            setSelectedIds((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(order.id);
                              else next.delete(order.id);
                              return next;
                            });
                          }}
                        />
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-sm font-semibold text-slate-900 truncate">
                              {order.orderNumber}
                            </span>
                            <Badge
                              variant="outline"
                              className={`${STATUS_TONE[order.status]} text-[10px] shrink-0`}
                            >
                              {STATUS_LABEL[order.status]}
                            </Badge>
                          </div>
                          <div className="text-xs text-slate-700 break-keep">
                            {order.user.name || order.user.email}
                            {order.organization && (
                              <span className="text-slate-400 ml-1">
                                · {order.organization.name}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-600 break-keep">
                            {order.items[0]?.name ?? "-"}
                            {order.items.length > 1 && (
                              <span className="text-slate-400 ml-1">
                                외 {order.items.length - 1}건
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                            <span className="text-sm font-bold text-slate-900 tabular-nums">
                              ₩{order.totalAmount.toLocaleString("ko-KR")}
                            </span>
                            {canTransition ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-[11px] gap-1"
                                onClick={() => openDialog(order)}
                              >
                                상태 전환
                                <ArrowRight className="h-3 w-3" />
                              </Button>
                            ) : (
                              <span className="text-[10px] text-slate-400">
                                최종 상태
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400">
                            {format(
                              new Date(order.createdAt),
                              "yyyy-MM-dd HH:mm",
                              { locale: ko },
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {/* 모바일에서 select-all toggle */}
                <div className="flex items-center justify-between py-2 px-1">
                  <button
                    type="button"
                    className="text-[11px] text-blue-700 font-medium"
                    onClick={() => {
                      if (
                        orders.length > 0 &&
                        orders.every((o) => selectedIds.has(o.id))
                      ) {
                        setSelectedIds(new Set());
                      } else {
                        setSelectedIds(new Set(orders.map((o) => o.id)));
                      }
                    }}
                  >
                    {orders.length > 0 &&
                    orders.every((o) => selectedIds.has(o.id))
                      ? "전체 선택 해제"
                      : "전체 선택"}
                  </button>
                  <span className="text-[10px] text-slate-400">
                    {orders.length}건
                  </span>
                </div>
              </div>

              {/* §11.119 — desktop table (md 이상) */}
              <div className="hidden md:block bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50">
                    {/* §11.102 — header checkbox: select-all (현재 보이는 row 만) */}
                    <TableHead className="w-10">
                      <input
                        type="checkbox"
                        className="h-4 w-4 cursor-pointer accent-blue-600"
                        checked={
                          orders.length > 0 &&
                          orders.every((o) => selectedIds.has(o.id))
                        }
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds(new Set(orders.map((o) => o.id)));
                          } else {
                            setSelectedIds(new Set());
                          }
                        }}
                      />
                    </TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">
                      Order Number
                    </TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">
                      상태
                    </TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">
                      사용자 / 조직
                    </TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">
                      품목
                    </TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 text-right">
                      총액
                    </TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">
                      생성일
                    </TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 text-right">
                      액션
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => {
                    const canTransition = NEXT_STATES[order.status].length > 0;
                    const isSelected = selectedIds.has(order.id);
                    return (
                      <TableRow
                        key={order.id}
                        className={`hover:bg-slate-50/50 ${isSelected ? "bg-blue-50/40" : ""}`}
                      >
                        {/* §11.102 — row checkbox */}
                        <TableCell className="w-10">
                          <input
                            type="checkbox"
                            className="h-4 w-4 cursor-pointer accent-blue-600"
                            checked={isSelected}
                            disabled={!canTransition}
                            onChange={(e) => {
                              setSelectedIds((prev) => {
                                const next = new Set(prev);
                                if (e.target.checked) next.add(order.id);
                                else next.delete(order.id);
                                return next;
                              });
                            }}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-sm font-semibold text-slate-900">
                          {order.orderNumber}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={STATUS_TONE[order.status]}>
                            {STATUS_LABEL[order.status]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-slate-900 break-keep">
                            {order.user.name || order.user.email}
                          </div>
                          {order.organization && (
                            <div className="text-[11px] text-slate-400 break-keep">
                              {order.organization.name}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-slate-700">
                            {order.items[0]?.name ?? "-"}
                            {order.items.length > 1 && (
                              <span className="text-slate-400 ml-1">
                                외 {order.items.length - 1}건
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-sm font-bold text-slate-900 tabular-nums">
                          ₩{order.totalAmount.toLocaleString("ko-KR")}
                        </TableCell>
                        <TableCell className="text-[11px] font-mono text-slate-500">
                          {format(new Date(order.createdAt), "yyyy-MM-dd HH:mm", {
                            locale: ko,
                          })}
                        </TableCell>
                        <TableCell className="text-right">
                          {canTransition ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs gap-1.5"
                              onClick={() => openDialog(order)}
                            >
                              상태 전환
                              <ArrowRight className="h-3 w-3" />
                            </Button>
                          ) : (
                            <span className="text-[11px] text-slate-400">최종</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Status transition dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={(o) => { if (!o) closeDialog(); }}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle>Order 상태 전환</DialogTitle>
            <DialogDescription className="text-xs break-keep">
              {selectedOrder?.orderNumber} — 현재 상태:{" "}
              <span className="font-semibold">
                {selectedOrder ? STATUS_LABEL[selectedOrder.status] : ""}
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5 block">
                다음 상태
              </label>
              <Select
                value={nextStatus}
                onValueChange={(v) => setNextStatus(v as OrderStatus)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="상태 선택" />
                </SelectTrigger>
                <SelectContent>
                  {selectedOrder &&
                    NEXT_STATES[selectedOrder.status].map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* §11.59 deliveryDefaults — DELIVERED 전환 시만 노출 */}
            {nextStatus === "DELIVERED" && (
              <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50/30 p-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                  입고 정보 (선택)
                </p>
                <div>
                  <label className="text-[10px] font-medium text-slate-600 mb-1 block">
                    Lot 번호
                  </label>
                  <Input
                    value={lotNumber}
                    onChange={(e) => setLotNumber(e.target.value)}
                    placeholder="예: 24A01-X"
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-slate-600 mb-1 block">
                    유효기한
                  </label>
                  <Input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-slate-600 mb-1 block">
                    보관 위치
                  </label>
                  <Input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="예: 냉동고 -20°C"
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-slate-600 mb-1 block">
                    수령 시각
                  </label>
                  <Input
                    type="datetime-local"
                    value={receivedAt}
                    onChange={(e) => setReceivedAt(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5 block">
                메모 (선택)
              </label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="상태 전환 사유"
                className="h-9 text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={closeDialog}>
              취소
            </Button>
            <Button
              size="sm"
              className="bg-slate-900 hover:bg-slate-800 text-white"
              disabled={!nextStatus || statusMutation.isPending}
              onClick={handleSubmit}
            >
              {statusMutation.isPending ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                  처리 중
                </>
              ) : (
                "상태 전환"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
