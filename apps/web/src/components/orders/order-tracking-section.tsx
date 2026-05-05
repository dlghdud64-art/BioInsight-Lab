"use client";

/**
 * #post-approval-purchase-order-flow Phase 4.2 — Order tracking UI.
 *
 * canonical truth = Order (DB). Quote → Order 1:1 (Order.quoteId @unique).
 * Phase 4.1 server (/api/orders/[id] GET + PATCH) 위에 UI mount.
 *
 * Lock:
 *   - order 미존재 시 hide (dead button 0 — 결재 승인 전이거나 cancelled)
 *   - 5 OrderStatus 한국어 label + tone 분기
 *   - PATCH 시 try/catch + toast error
 *   - mutation pending = "저장 중..." button disabled
 *   - audit log = server-side (Phase 4.1) 처리
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { csrfFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface OrderDetail {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: number;
  shippingAddress: string | null;
  expectedDelivery: string | null;
  actualDelivery: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  /** quote.id — Order.quoteId 와 매핑 (1:1). order fetch endpoint 가
   *  quote 별 order 1개 반환하는 별도 endpoint 가 필요. 본 batch 는
   *  caller 가 orderId 를 직접 전달 (quoteId 매핑은 caller 가 처리). */
  orderId: string;
}

const STATUS_META: Record<string, { label: string; tone: string; bgClass: string; textClass: string }> = {
  ORDERED: { label: "주문 완료", tone: "blue", bgClass: "bg-blue-50", textClass: "text-blue-700" },
  CONFIRMED: { label: "확인됨", tone: "indigo", bgClass: "bg-indigo-50", textClass: "text-indigo-700" },
  SHIPPING: { label: "배송 중", tone: "amber", bgClass: "bg-amber-50", textClass: "text-amber-700" },
  DELIVERED: { label: "배송 완료", tone: "emerald", bgClass: "bg-emerald-50", textClass: "text-emerald-700" },
  CANCELLED: { label: "취소됨", tone: "rose", bgClass: "bg-rose-50", textClass: "text-rose-700" },
};

const STATUS_OPTIONS = ["ORDERED", "CONFIRMED", "SHIPPING", "DELIVERED", "CANCELLED"] as const;

export function OrderTrackingSection({ orderId }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [draftStatus, setDraftStatus] = useState<string>("");

  const { data, isLoading } = useQuery<{ order: OrderDetail | null }>({
    queryKey: ["order", orderId],
    queryFn: async () => {
      const res = await fetch(`/api/orders/${orderId}`);
      if (!res.ok) return { order: null };
      return res.json();
    },
    enabled: !!orderId,
    staleTime: 30_000,
  });

  const order = data?.order;
  const currentStatus = order?.status ?? "";

  const mutation = useMutation({
    mutationFn: async (status: string) => {
      const res = await csrfFetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "주문 상태 저장 실패");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["order", orderId] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      toast({ title: "주문 상태 저장 완료", description: "변경 사항이 반영되었습니다." });
      setDraftStatus("");
    },
    onError: (err: Error) => {
      toast({ title: "저장 실패", description: err.message, variant: "destructive" });
    },
  });

  // 결재 승인 전 또는 cancelled order 미존재 → hide (dead button 0)
  if (isLoading) return null;
  if (!order) return null;

  const meta = STATUS_META[currentStatus] ?? STATUS_META.ORDERED;
  const isDirty = draftStatus !== "" && draftStatus !== currentStatus;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">주문 추적</h3>
          <span className="text-[11px] font-mono text-slate-400">{order.orderNumber}</span>
        </div>
        <p className="mt-1 text-xs text-slate-500 leading-relaxed">
          결재 승인 후 자동 생성된 주문의 진행 상태를 관리합니다.
          상태 변경 시 audit log 가 기록됩니다.
        </p>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-medium text-slate-600">현재 상태:</span>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${meta.bgClass} ${meta.textClass}`}
        >
          {meta.label}
        </span>
      </div>

      <div className="flex items-end gap-3">
        <div className="flex-1">
          <Select value={draftStatus} onValueChange={setDraftStatus}>
            <SelectTrigger className="bg-white border-slate-200 text-slate-900 h-9 text-sm">
              <SelectValue placeholder="다음 상태 선택" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s} disabled={s === currentStatus}>
                  {STATUS_META[s].label}
                  {s === currentStatus && (
                    <span className="ml-2 text-[10px] text-slate-400">(현재)</span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={() => draftStatus && mutation.mutate(draftStatus)}
          disabled={!isDirty || mutation.isPending}
          className="h-9"
        >
          {mutation.isPending ? "저장 중..." : "저장"}
        </Button>
      </div>

      {(order.expectedDelivery || order.actualDelivery) && (
        <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 gap-3 text-xs">
          {order.expectedDelivery && (
            <div>
              <span className="text-slate-400">예상 배송일</span>
              <p className="text-slate-700 font-mono mt-0.5">
                {new Date(order.expectedDelivery).toLocaleDateString("ko-KR")}
              </p>
            </div>
          )}
          {order.actualDelivery && (
            <div>
              <span className="text-slate-400">실제 배송일</span>
              <p className="text-slate-700 font-mono mt-0.5">
                {new Date(order.actualDelivery).toLocaleDateString("ko-KR")}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
