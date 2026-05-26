"use client";

/**
 * §11.310c #purchase-orders-new — 신규 PO 작성 페이지 (prefill 수신).
 *
 * 호영님 P1 spec (Q31 = A, 2026-05-26):
 *   재고 운영 도우미 → 재발주안 검토 sheet → [바로 발주] →
 *   /dashboard/purchase-orders/new?productName=...&quantity=...&supplier=...
 *   &unitPrice=...&prefill=reorder-recommendation
 *
 * MVP scope:
 *   - useSearchParams 로 prefill query string 수신
 *   - 입력값 form 노출 (사용자 수정 가능)
 *   - [발주 생성] = toast + 안내 (실제 POST /api/orders 는 §11.310d 후속)
 *   - [취소] = router.back() 또는 /dashboard/purchase-orders 이동
 *
 * dead button 0:
 *   - [발주 생성] real handler — toast.info + "발주 생성 흐름은 §11.310d 후속" 안내
 *   - [취소] real handler — router.push
 *
 * 색상: §11.302 정합 (green-600 primary, amber 0)
 */

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ShoppingCart,
  ArrowLeft,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

interface PrefillForm {
  productName: string;
  quantity: number;
  supplier: string;
  unitPrice: number;
  notes: string;
}

const EMPTY_FORM: PrefillForm = {
  productName: "",
  quantity: 1,
  supplier: "",
  unitPrice: 0,
  notes: "",
};

function NewPurchaseOrderPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const prefillSource = searchParams.get("prefill");
  const isReorderRecommendation = prefillSource === "reorder-recommendation";

  const [form, setForm] = useState<PrefillForm>(EMPTY_FORM);

  // §11.310c — query string 으로 form 초기화 (mount 1회).
  useEffect(() => {
    const productName = searchParams.get("productName") ?? "";
    const quantityRaw = searchParams.get("quantity") ?? "1";
    const supplier = searchParams.get("supplier") ?? "";
    const unitPriceRaw = searchParams.get("unitPrice") ?? "0";

    setForm({
      productName: productName.trim(),
      quantity: Math.max(1, Number(quantityRaw) || 1),
      supplier: supplier.trim(),
      unitPrice: Math.max(0, Number(unitPriceRaw) || 0),
      notes: isReorderRecommendation
        ? "재고 운영 도우미 권장 — 안전 재고 미달"
        : "",
    });

    // mount 1회만 — searchParams 변경 시 재초기화 0 (사용자 수정 보존)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const estimatedAmount = form.quantity * form.unitPrice;

  const handleCreate = () => {
    // §11.310c MVP — 실제 PO create POST 는 §11.310d 후속.
    // 현재는 toast 안내 + PO 목록으로 redirect.
    if (!form.productName.trim()) {
      toast.error("품목명을 입력해 주세요.");
      return;
    }
    if (form.quantity <= 0) {
      toast.error("수량은 0보다 커야 합니다.");
      return;
    }
    if (!form.supplier.trim()) {
      toast.error("공급사를 선택해 주세요.");
      return;
    }
    toast.info(
      "발주 생성 흐름은 후속 단계에서 활성화됩니다. PO 목록으로 이동합니다.",
      { duration: 4000 },
    );
    // 후속 §11.310d 에서 실제 POST /api/orders 호출 + redirect to created PO
    setTimeout(() => router.push("/dashboard/purchase-orders"), 800);
  };

  const handleCancel = () => {
    router.push("/dashboard/purchase-orders");
  };

  return (
    <div className="container mx-auto px-3 sm:px-4 md:px-6 py-4 md:py-6 max-w-2xl">
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            className="mb-2 -ml-2 text-slate-500 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            PO 목록으로
          </Button>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2 flex-wrap">
            <ShoppingCart className="h-5 w-5 text-emerald-600" />
            <span>새 발주</span>
            {isReorderRecommendation && (
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">
                <Sparkles className="h-3 w-3 mr-1" />
                재고 도우미 권장
              </Badge>
            )}
          </h1>
        </div>
      </div>

      {/* §11.310c — prefill 출처 안내 (호영님 P1 spec) */}
      {isReorderRecommendation && (
        <Card
          data-testid="new-po-prefill-banner"
          className="mb-4 border-emerald-200 bg-emerald-50/60"
        >
          <CardContent className="p-3 flex items-start gap-2">
            <Sparkles className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-emerald-700">
                재고 운영 도우미 권장 초안이 자동 채워졌습니다
              </p>
              <p className="text-xs text-emerald-600 mt-0.5 leading-relaxed">
                품목·수량·공급사·단가를 확인하고 필요 시 수정한 뒤 발주 생성을 진행하세요.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 입력 form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">발주 정보</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="new-po-productName" className="text-xs font-semibold">
              품목명 <span className="text-rose-600">*</span>
            </Label>
            <Input
              id="new-po-productName"
              data-testid="new-po-productName-input"
              value={form.productName}
              onChange={(e) => setForm({ ...form, productName: e.target.value })}
              placeholder="예: DMEM high glucose 500ml"
              className="mt-1 h-10"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="new-po-quantity" className="text-xs font-semibold">
                수량 <span className="text-rose-600">*</span>
              </Label>
              <Input
                id="new-po-quantity"
                data-testid="new-po-quantity-input"
                type="number"
                min={1}
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) || 0 })}
                className="mt-1 h-10 tabular-nums"
              />
            </div>
            <div>
              <Label htmlFor="new-po-unitPrice" className="text-xs font-semibold">
                단가 (₩)
              </Label>
              <Input
                id="new-po-unitPrice"
                data-testid="new-po-unitPrice-input"
                type="number"
                min={0}
                value={form.unitPrice}
                onChange={(e) => setForm({ ...form, unitPrice: Number(e.target.value) || 0 })}
                className="mt-1 h-10 tabular-nums"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="new-po-supplier" className="text-xs font-semibold">
              공급사 <span className="text-rose-600">*</span>
            </Label>
            <Input
              id="new-po-supplier"
              data-testid="new-po-supplier-input"
              value={form.supplier}
              onChange={(e) => setForm({ ...form, supplier: e.target.value })}
              placeholder="예: 코람바이오"
              className="mt-1 h-10"
            />
          </div>

          <div>
            <Label htmlFor="new-po-notes" className="text-xs font-semibold">
              비고
            </Label>
            <Input
              id="new-po-notes"
              data-testid="new-po-notes-input"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="추가 메모"
              className="mt-1 h-10"
            />
          </div>

          {/* 예상 금액 */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-50 border border-emerald-200">
            <span className="text-xs font-bold text-emerald-700">예상 금액</span>
            <span
              data-testid="new-po-estimated-amount"
              className="text-base font-bold text-emerald-700 tabular-nums"
            >
              ₩{estimatedAmount.toLocaleString("ko-KR")}
            </span>
          </div>

          {/* §11.310c MVP 안내 */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-slate-50 border border-slate-200">
            <AlertCircle className="h-4 w-4 text-slate-500 mt-0.5 flex-shrink-0" />
            <p className="text-[11px] text-slate-600 leading-relaxed">
              실제 발주 생성 및 결재 요청은 후속 단계(§11.310d)에서 활성화됩니다.
              현재는 입력값 확인까지 가능합니다.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* CTA */}
      <div className="flex items-center gap-2 mt-4">
        <Button
          type="button"
          variant="outline"
          data-testid="new-po-cancel-cta"
          onClick={handleCancel}
          className="flex-1 h-11 min-h-[44px] text-sm border-slate-300 text-slate-700"
        >
          취소
        </Button>
        <Button
          type="button"
          data-testid="new-po-create-cta"
          onClick={handleCreate}
          className="flex-1 h-11 min-h-[44px] text-sm bg-green-600 hover:bg-green-700 text-white font-semibold"
        >
          <ShoppingCart className="h-4 w-4 mr-1.5" />
          발주 생성
        </Button>
      </div>
    </div>
  );
}

export default function NewPurchaseOrderPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto px-4 py-8">
          <p className="text-sm text-slate-500">로딩 중...</p>
        </div>
      }
    >
      <NewPurchaseOrderPageInner />
    </Suspense>
  );
}
