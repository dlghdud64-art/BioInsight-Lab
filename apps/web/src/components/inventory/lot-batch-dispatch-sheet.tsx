"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Truck, Loader2, AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
// #inventory-batch-dispatch — CSRF 필수 라우트(레지스트리 미등록 = 기본 required). 전역 CSRF 게이트 대응.
import { csrfFetch } from "@/lib/api-client";

/**
 * #inventory-batch-dispatch — 다건 lot 원자적 배치출고 sheet.
 *
 * POST /api/inventory/dispatch-batch (단일 트랜잭션 all-or-nothing).
 *  - 선택 lot별 수량 입력 + 배치 공유 destination/operator(GMP, 결정 a).
 *  - 서버 사전검증 실패(422)는 그대로 노출(placeholder success 금지).
 */

export interface BatchDispatchLot {
  inventoryId: string;
  lotCode: string;
  productName: string;
  unit: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lots: BatchDispatchLot[];
  onDispatched?: () => void;
}

interface ItemError {
  inventoryId: string;
  reason: string;
}

export function LotBatchDispatchSheet({ open, onOpenChange, lots, onDispatched }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [qtyByLot, setQtyByLot] = useState<Record<string, string>>({});
  const [destination, setDestination] = useState("");
  const [operator, setOperator] = useState("");
  const [itemErrors, setItemErrors] = useState<ItemError[]>([]);

  const parsedItems = useMemo(
    () =>
      lots.map((l) => ({
        ...l,
        qty: Number(qtyByLot[l.inventoryId] ?? ""),
      })),
    [lots, qtyByLot]
  );

  const allQtyValid = parsedItems.length > 0 && parsedItems.every((i) => Number.isFinite(i.qty) && i.qty > 0);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await csrfFetch("/api/inventory/dispatch-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: parsedItems.map((i) => ({
            inventoryId: i.inventoryId,
            lotNumber: i.lotCode,
            quantity: i.qty,
            unit: i.unit,
          })),
          destination: destination.trim() || undefined,
          operator: operator.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw { status: res.status, data };
      }
      return data;
    },
    onSuccess: (data) => {
      setItemErrors([]);
      queryClient.invalidateQueries({ queryKey: ["team-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-usage"] });
      toast({ title: "배치 출고 완료", description: `${data.dispatchedCount ?? lots.length}개 Lot 출고 처리됨.` });
      setQtyByLot({});
      setDestination("");
      setOperator("");
      onDispatched?.();
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      const e = err as { status?: number; data?: { error?: string; itemErrors?: ItemError[] } };
      if (e?.data?.itemErrors) setItemErrors(e.data.itemErrors);
      toast({
        title: "배치 출고 실패",
        description: e?.data?.error ?? "처리 중 오류가 발생했습니다. 전건 미처리(롤백)되었습니다.",
        variant: "destructive",
      });
    },
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            일괄 출고 · {lots.length}개 Lot
          </SheetTitle>
          <SheetDescription>
            선택한 Lot을 한 번에 출고합니다. 하나라도 실패하면 전체 취소(원자적 처리)됩니다.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-3">
          {/* 선택 lot별 수량 */}
          <div className="space-y-2">
            {lots.map((l) => (
              <div key={l.inventoryId} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-900 truncate">{l.lotCode}</p>
                  <p className="text-[11px] text-slate-500 truncate">{l.productName}</p>
                </div>
                <Input
                  type="number"
                  min={0}
                  inputMode="decimal"
                  value={qtyByLot[l.inventoryId] ?? ""}
                  onChange={(e) => setQtyByLot((prev) => ({ ...prev, [l.inventoryId]: e.target.value }))}
                  placeholder="수량"
                  className="h-10 w-24 text-sm"
                  aria-label={`${l.lotCode} 출고 수량`}
                />
                <span className="w-8 text-[11px] text-slate-500">{l.unit}</span>
              </div>
            ))}
          </div>

          {/* 공유 GMP 필드 */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-600">사용처</label>
              <Input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="예: 3층 세포배양실" className="h-10 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-600">담당자</label>
              <Input value={operator} onChange={(e) => setOperator(e.target.value)} placeholder="예: 홍길동" className="h-10 text-sm" />
            </div>
          </div>
          <p className="text-[10px] text-slate-400">GMP 추적 품목은 로트번호·사용처·담당자가 필수입니다. 누락 시 전건 미처리됩니다.</p>

          {/* 사전검증 에러(422) */}
          {itemErrors.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 space-y-1">
              <p className="flex items-center gap-1 text-xs font-bold text-red-700">
                <AlertTriangle className="h-3.5 w-3.5" /> 처리되지 않았습니다(롤백)
              </p>
              {itemErrors.map((e) => (
                <p key={e.inventoryId} className="text-[11px] text-red-600">{e.reason}</p>
              ))}
            </div>
          )}

          <Button
            onClick={() => mutation.mutate()}
            disabled={!allQtyValid || mutation.isPending}
            className="w-full min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {mutation.isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> 출고 처리 중...</>
            ) : (
              <><Truck className="mr-2 h-4 w-4" /> {lots.length}개 Lot 일괄 출고</>
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
