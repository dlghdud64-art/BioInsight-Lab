"use client";

import { useState, useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle,
  Trash2,
  ShieldAlert,
  MapPin,
  CalendarClock,
  FlaskConical,
  Package,
  ArrowRight,
  Info,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";
import {
  resolveDisposal,
  DISPOSAL_REASON_LABELS,
  type DisposalInput,
  type DisposalReason,
  type DisposalResolution,
} from "@/lib/ontology/contextual-action/disposal-resolver";

// ── Props ──

export interface DisposalTarget {
  /** 품목 정보 */
  productName: string;
  brand?: string;
  catalogNumber?: string;
  unit?: string;

  /** LOT 정보 */
  lotNumber: string;
  lotQuantity: number;
  expiryDate: string;
  location?: string;

  /** 위험물 */
  isHazardous?: boolean;
  hasMsds?: boolean;
  requiresIsolation?: boolean;

  /** 전체 재고 */
  totalItemQuantity: number;
  safetyStock?: number;
  averageDailyUsage?: number;
}

interface LotDisposalPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: DisposalTarget | null;
  isSubmitting?: boolean;
  onConfirmDisposal?: (params: {
    lotNumber: string;
    quantity: number;
    reason: DisposalReason;
    reasonDetail?: string;
    quarantine: boolean;
  }) => void;
  onNavigateToReorder?: (productName: string) => void;
}

export function LotDisposalPanel({
  open,
  onOpenChange,
  target,
  isSubmitting = false,
  onConfirmDisposal,
  onNavigateToReorder,
}: LotDisposalPanelProps) {
  const [disposalQty, setDisposalQty] = useState<number | null>(null);
  const [selectedReason, setSelectedReason] = useState<DisposalReason | null>(null);
  const [reasonDetail, setReasonDetail] = useState("");
  const [quarantineChecked, setQuarantineChecked] = useState(false);

  // Ontology resolution
  const resolution: DisposalResolution | null = useMemo(() => {
    if (!target) return null;
    const input: DisposalInput = {
      productName: target.productName,
      brand: target.brand,
      catalogNumber: target.catalogNumber,
      unit: target.unit,
      lotNumber: target.lotNumber,
      lotQuantity: target.lotQuantity,
      expiryDate: target.expiryDate,
      location: target.location,
      isHazardous: target.isHazardous,
      hasMsds: target.hasMsds,
      requiresIsolation: target.requiresIsolation,
      totalItemQuantity: target.totalItemQuantity,
      safetyStock: target.safetyStock,
      averageDailyUsage: target.averageDailyUsage,
    };
    return resolveDisposal(input);
  }, [target]);

  // 패널 열릴 때 기본값 세팅
  const effectiveQty = disposalQty ?? target?.lotQuantity ?? 0;
  const effectiveReason = selectedReason ?? resolution?.defaultReason ?? "expiry";
  const effectiveQuarantine = quarantineChecked || (resolution?.requiresQuarantine ?? false);

  if (!target || !resolution) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-[440px] p-0 flex flex-col overflow-hidden" />
      </Sheet>
    );
  }

  const unit = target.unit || "ea";
  const expiryDate = new Date(target.expiryDate);
  const isExpired = expiryDate.getTime() < Date.now();
  const daysUntilExpiry = Math.ceil(
    (expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  const handleConfirm = () => {
    if (isSubmitting) return;
    onConfirmDisposal?.({
      lotNumber: target.lotNumber,
      quantity: effectiveQty,
      reason: effectiveReason,
      reasonDetail: reasonDetail || undefined,
      quarantine: effectiveQuarantine,
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[440px] p-0 flex flex-col overflow-hidden"
      >
        {/* ═══ 헤더 ═══ */}
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-slate-200/80 flex-shrink-0">
          <div className="flex items-center gap-2">
            {resolution.requiresQuarantine && (
              <ShieldAlert className="h-4 w-4 text-amber-500 flex-shrink-0" />
            )}
            {!resolution.requiresQuarantine && (
              <Trash2 className="h-4 w-4 text-red-500 flex-shrink-0" />
            )}
            <SheetTitle className="text-[15px] font-extrabold text-slate-900">
              {resolution.title}
            </SheetTitle>
          </div>
          <SheetDescription className="text-[11px] text-slate-500 mt-0.5">
            {resolution.description}
          </SheetDescription>
        </SheetHeader>

        {/* ═══ 스크롤 영역 ═══ */}
        <div className="flex-1 overflow-y-auto">

          {/* ── 1. 대상 정보 ── */}
          <div className="p-5">
            <h4 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-3">
              대상 정보
            </h4>

            {/* 품목명 */}
            <div className="flex items-center gap-2 mb-3">
              <FlaskConical className="h-4 w-4 text-slate-400" />
              <span className="text-[13px] font-bold text-slate-900 truncate">
                {target.productName}
              </span>
              {target.brand && (
                <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-slate-200 text-slate-500">
                  {target.brand}
                </Badge>
              )}
            </div>

            {/* LOT / 위치 / 만료일 / 잔량 그리드 */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="px-3 py-2.5 rounded-lg border border-slate-100 bg-slate-50">
                <div className="flex items-center gap-1.5 mb-1">
                  <FlaskConical className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-[10px] font-semibold text-slate-400">LOT</span>
                </div>
                <p className="text-sm font-extrabold text-slate-900">#{target.lotNumber}</p>
              </div>

              <div className={`px-3 py-2.5 rounded-lg border border-slate-100 ${
                isExpired ? "bg-red-50" : "bg-slate-50"
              }`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <CalendarClock className={`h-3.5 w-3.5 ${isExpired ? "text-red-500" : "text-slate-400"}`} />
                  <span className="text-[10px] font-semibold text-slate-400">만료일</span>
                </div>
                <p className={`text-sm font-extrabold ${isExpired ? "text-red-600" : "text-slate-900"}`}>
                  {expiryDate.toLocaleDateString("ko-KR")}
                </p>
                {isExpired && (
                  <p className="text-[10px] font-bold text-red-500 mt-0.5">
                    {Math.abs(daysUntilExpiry)}일 경과
                  </p>
                )}
              </div>

              <div className="px-3 py-2.5 rounded-lg border border-slate-100 bg-slate-50">
                <div className="flex items-center gap-1.5 mb-1">
                  <Package className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-[10px] font-semibold text-slate-400">현재 잔량</span>
                </div>
                <p className="text-sm font-extrabold text-slate-900">
                  {target.lotQuantity}<span className="text-xs font-normal text-slate-400 ml-0.5">{unit}</span>
                </p>
              </div>

              {target.location && (
                <div className="px-3 py-2.5 rounded-lg border border-slate-100 bg-slate-50">
                  <div className="flex items-center gap-1.5 mb-1">
                    <MapPin className="h-3.5 w-3.5 text-slate-400" />
                    <span className="text-[10px] font-semibold text-slate-400">보관 위치</span>
                  </div>
                  <p className="text-sm font-bold text-slate-900 truncate">{target.location}</p>
                </div>
              )}
            </div>
          </div>

          <Separator className="bg-slate-100" />

          {/* ── 2. 폐기 사유 ── */}
          <div className="p-5">
            <h4 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-3">
              폐기 사유
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(DISPOSAL_REASON_LABELS) as DisposalReason[]).map((reason) => {
                const isSelected = effectiveReason === reason;
                return (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setSelectedReason(reason)}
                    className={`px-3 py-2 rounded-lg border text-xs font-semibold transition-colors text-left ${
                      isSelected
                        ? "border-blue-300 bg-blue-50 text-blue-700"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {DISPOSAL_REASON_LABELS[reason]}
                  </button>
                );
              })}
            </div>
            {effectiveReason === "other" && (
              <textarea
                className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-300 resize-none"
                rows={2}
                placeholder="폐기 사유를 입력하세요..."
                value={reasonDetail}
                onChange={(e) => setReasonDetail(e.target.value)}
              />
            )}
          </div>

          <Separator className="bg-slate-100" />

          {/* ── 3. 처리 수량 ── */}
          <div className="p-5">
            <h4 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-3">
              처리 수량
            </h4>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="number"
                  min={1}
                  max={target.lotQuantity}
                  value={effectiveQty}
                  onChange={(e) => setDisposalQty(Math.min(Number(e.target.value), target.lotQuantity))}
                  className="w-20 h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 text-center focus:outline-none focus:ring-1 focus:ring-blue-300"
                />
                <span className="text-xs text-slate-500">/ {target.lotQuantity} {unit}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-[11px] border-slate-200"
                onClick={() => setDisposalQty(target.lotQuantity)}
              >
                전량 폐기
              </Button>
            </div>
          </div>

          <Separator className="bg-slate-100" />

          {/* ── 4. 격리 필요 여부 ── */}
          <div className="p-5">
            <h4 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-3">
              격리 필요 여부
            </h4>
            {resolution.requiresQuarantine ? (
              <div className="flex items-start gap-2 p-3 rounded-lg border border-amber-200 bg-amber-50/80">
                <ShieldAlert className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-bold text-slate-900">격리 조치 필요</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {resolution.needsMsdsCheck
                      ? "MSDS 미확보 위험물입니다. 격리 보관 후 MSDS 확인이 필요합니다."
                      : "위험물 또는 격리 대상입니다. 별도 격리 보관 후 폐기를 진행합니다."}
                  </p>
                </div>
              </div>
            ) : (
              <label className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-slate-200 bg-white cursor-pointer hover:bg-slate-50 transition-colors">
                <input
                  type="checkbox"
                  checked={quarantineChecked}
                  onChange={(e) => setQuarantineChecked(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-300"
                />
                <div>
                  <p className="text-xs font-semibold text-slate-700">격리 보관 후 폐기</p>
                  <p className="text-[10px] text-slate-400">즉시 폐기가 어려운 경우 격리 구역으로 이동합니다</p>
                </div>
              </label>
            )}
          </div>

          <Separator className="bg-slate-100" />

          {/* ── 5. 폐기 후 영향 ── */}
          <div className="p-5">
            <h4 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-3">
              폐기 후 영향
            </h4>
            <div className="space-y-2">
              {/* 안전재고 미달 여부 */}
              {resolution.causesStockBreach ? (
                <div className="flex items-start gap-2 p-3 rounded-lg border border-red-200 bg-red-50/80">
                  <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-slate-900">안전재고 미달 발생</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      폐기 후 잔여 수량 {resolution.remainingAfterDisposal}{unit}으로, 안전재고({target.safetyStock}{unit}) 미만입니다.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2 p-3 rounded-lg border border-slate-200 bg-slate-50">
                  <ShieldCheck className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-slate-900">안전재고 유지</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      폐기 후 잔여 수량 {resolution.remainingAfterDisposal}{unit}
                      {target.safetyStock ? ` (안전재고 ${target.safetyStock}${unit})` : ""}
                    </p>
                  </div>
                </div>
              )}

              {/* 재주문 검토 필요 */}
              {resolution.needsReorderReview && (
                <button
                  type="button"
                  onClick={() => onNavigateToReorder?.(target.productName)}
                  className="w-full flex items-center gap-2 p-3 rounded-lg border border-blue-200 bg-blue-50/80 hover:bg-blue-50 transition-colors text-left group"
                >
                  <ArrowRight className="h-4 w-4 text-blue-500 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs font-bold text-slate-900">재주문 검토 필요</p>
                    <p className="text-[11px] text-slate-500">폐기 확정 후 재발주를 검토하세요</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-blue-400 group-hover:text-blue-600 flex-shrink-0" />
                </button>
              )}
            </div>

            {/* 감사 로그 안내 */}
            <div className="flex items-start gap-2 mt-3 px-1">
              <Info className="h-3.5 w-3.5 text-slate-300 mt-0.5 flex-shrink-0" />
              <p className="text-[10px] text-slate-400 leading-relaxed">
                폐기 기록은 감사 로그에 자동 반영되며, 수량 차감 및 LOT 상태 변경이 즉시 적용됩니다.
              </p>
            </div>
          </div>
        </div>

        {/* ═══ CTA (Sticky Bottom) ═══ */}
        <div className="flex-shrink-0 border-t border-slate-200 bg-white px-5 py-3">
          <div className="flex gap-2">
            <Button
              disabled={isSubmitting}
              className={`flex-1 h-10 text-xs font-bold ${
                effectiveQuarantine
                  ? "bg-amber-600 hover:bg-amber-700 text-white"
                  : "bg-red-600 hover:bg-red-700 text-white"
              }`}
              onClick={handleConfirm}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              {isSubmitting
                ? "처리 중..."
                : effectiveQuarantine
                  ? "격리 후 폐기"
                  : "폐기 확정"}
            </Button>
          </div>

          {resolution.needsReorderReview && onNavigateToReorder && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-2 h-7 text-[11px] text-slate-500 hover:text-slate-700"
              onClick={() => onNavigateToReorder(target.productName)}
            >
              <ArrowRight className="h-3 w-3 mr-1" />
              재주문 검토로 이동
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
