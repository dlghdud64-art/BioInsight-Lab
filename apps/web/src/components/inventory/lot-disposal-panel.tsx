"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  FlaskConical,
  Info,
  MapPin,
  Package,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  resolveDisposal,
  type DisposalInput,
  type DisposalReason,
  type DisposalResolution,
} from "@/lib/ontology/contextual-action/disposal-resolver";

export interface DisposalTarget {
  productName: string;
  brand?: string;
  catalogNumber?: string;
  unit?: string;
  lotNumber: string;
  lotQuantity: number;
  expiryDate: string;
  location?: string;
  isHazardous?: boolean;
  hasMsds?: boolean;
  requiresIsolation?: boolean;
  totalItemQuantity: number;
  safetyStock?: number;
  averageDailyUsage?: number;
}

export interface DisposalCompletionSummary {
  lotNumber: string;
  quantity: number;
  reason: DisposalReason;
  remainingQuantity: number;
  reorderReviewRequired: boolean;
}

interface LotDisposalPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: DisposalTarget | null;
  isSubmitting?: boolean;
  completionSummary?: DisposalCompletionSummary | null;
  onConfirmDisposal?: (params: {
    lotNumber: string;
    quantity: number;
    reason: DisposalReason;
    reasonDetail?: string;
    quarantine: boolean;
  }) => void;
  onNavigateToReorder?: (productName: string) => void;
}

const REASON_LABELS: Record<DisposalReason, string> = {
  expiry: "유효기간 만료",
  contamination: "오염 또는 변질",
  damage: "파손",
  other: "기타",
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "확인 필요";
  return date.toLocaleDateString("ko-KR");
}

function daysFromNow(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function buildResolution(target: DisposalTarget): DisposalResolution {
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
}

export function LotDisposalPanel({
  open,
  onOpenChange,
  target,
  isSubmitting = false,
  completionSummary = null,
  onConfirmDisposal,
  onNavigateToReorder,
}: LotDisposalPanelProps) {
  const [disposalQty, setDisposalQty] = useState<number | null>(null);
  const [selectedReason, setSelectedReason] = useState<DisposalReason | null>(
    null,
  );
  const [reasonDetail, setReasonDetail] = useState("");
  const [quarantineChecked, setQuarantineChecked] = useState(false);

  const resolution = useMemo(
    () => (target ? buildResolution(target) : null),
    [target],
  );

  if (!target || !resolution) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full p-0 sm:max-w-[460px]" />
      </Sheet>
    );
  }

  const unit = target.unit || "ea";
  const effectiveQty = disposalQty ?? target.lotQuantity;
  const effectiveReason = selectedReason ?? resolution.defaultReason;
  const effectiveQuarantine =
    quarantineChecked || resolution.requiresQuarantine;
  const remainingAfterLotDisposal = Math.max(
    target.totalItemQuantity - effectiveQty,
    0,
  );
  const daysUntilExpiry = daysFromNow(target.expiryDate);
  const isExpired = daysUntilExpiry !== null && daysUntilExpiry < 0;
  const canHandOffToReorderAfterConfirm =
    resolution.needsReorderReview && Boolean(onNavigateToReorder);
  const isCompleted =
    completionSummary?.lotNumber === target.lotNumber &&
    completionSummary.quantity === effectiveQty;
  const disposableLotCount =
    !isCompleted && effectiveQty > 0 && effectiveQty <= target.lotQuantity
      ? 1
      : 0;
  const approvalStatusItems = [
    {
      label: "승인 완료",
      value: 0,
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    },
    {
      label: "승인 대기",
      value: disposableLotCount,
      className: "border-amber-200 bg-amber-50 text-amber-700",
    },
    {
      label: "차단",
      value: disposableLotCount === 1 ? 0 : 1,
      className: "border-red-200 bg-red-50 text-red-700",
    },
  ];
  const approvalSummaryRows = [
    { label: "Lot ID", value: target.lotNumber },
    {
      label: "수량",
      value: `${effectiveQty} ${unit} 폐기 / ${target.lotQuantity} ${unit} 보유`,
    },
    { label: "만료일", value: formatDate(target.expiryDate) },
    { label: "위치", value: target.location || "미지정" },
    { label: "사유", value: REASON_LABELS[effectiveReason] },
    {
      label: "재고 감소",
      value: `${target.totalItemQuantity} ${unit} → ${remainingAfterLotDisposal} ${unit}`,
    },
  ];

  const handleConfirm = () => {
    if (isSubmitting || isCompleted) return;
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
        data-testid="labaxis-inventory-disposal-dock"
        data-legacy-testid="lot-disposal-dock"
        side="right"
        className="flex w-full flex-col overflow-hidden p-0 sm:max-w-[460px]"
      >
        <SheetHeader className="border-b border-slate-200 px-5 pb-4 pt-5">
          <div className="flex items-center gap-2">
            {effectiveQuarantine ? (
              <ShieldAlert className="h-4 w-4 text-amber-600" />
            ) : (
              <Trash2 className="h-4 w-4 text-red-600" />
            )}
            <SheetTitle className="text-[15px] font-extrabold text-slate-950">
              폐기 승인 검토
            </SheetTitle>
          </div>
          <SheetDescription className="text-[11px] leading-relaxed text-slate-500">
            만료 또는 사용 금지 LOT는 재주문보다 먼저 폐기 영향을 확인합니다.
          </SheetDescription>
          <p
            data-testid="labaxis-inventory-disposal-priority-line"
            className="text-[11px] font-extrabold text-red-700"
          >
            우선순위: 폐기 처리 먼저 · 폐기 완료 → 재주문 검토
          </p>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          <section
            data-testid="labaxis-inventory-disposal-flow-status"
            className="border-b border-slate-100 bg-slate-50 px-5 py-3"
          >
            <div className="grid grid-cols-3 gap-1.5">
              <Badge
                variant="outline"
                className={
                  isCompleted || isSubmitting
                    ? "border-slate-200 bg-white text-slate-500"
                    : "border-red-200 bg-red-50 text-red-700"
                }
              >
                1 폐기 확인
              </Badge>
              <Badge
                variant="outline"
                className={
                  isSubmitting
                    ? "border-blue-200 bg-blue-50 text-blue-700"
                    : "border-slate-200 bg-white text-slate-500"
                }
              >
                2 폐기 처리 중
              </Badge>
              <Badge
                variant="outline"
                className={
                  isCompleted
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-white text-slate-500"
                }
              >
                3 폐기 완료
              </Badge>
            </div>
            <p className="mt-2 text-[11px] font-semibold text-slate-600">
              Lot ID {target.lotNumber} · 수량 {effectiveQty} {unit} · 사유{" "}
              {REASON_LABELS[effectiveReason]}
            </p>
          </section>

          <section className="space-y-3 p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase text-slate-400">
                  대상 LOT
                </p>
                <h3 className="mt-1 truncate text-sm font-extrabold text-slate-950">
                  {target.productName}
                </h3>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {target.brand && (
                    <Badge variant="outline">{target.brand}</Badge>
                  )}
                  {target.catalogNumber && (
                    <Badge variant="outline">{target.catalogNumber}</Badge>
                  )}
                </div>
              </div>
              <Badge
                className={
                  isExpired
                    ? "bg-red-600 text-white"
                    : "bg-amber-600 text-white"
                }
              >
                {isExpired ? "만료" : "검토"}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <Fact
                icon={FlaskConical}
                label="Lot ID"
                value={target.lotNumber}
                strong
              />
              <Fact
                icon={Package}
                label="폐기 수량"
                value={`${effectiveQty} / ${target.lotQuantity} ${unit}`}
                strong
              />
              <Fact
                icon={CalendarClock}
                label="Expiry"
                value={formatDate(target.expiryDate)}
                detail={
                  daysUntilExpiry === null
                    ? "날짜 확인 필요"
                    : isExpired
                      ? `${Math.abs(daysUntilExpiry)}일 경과`
                      : `D-${daysUntilExpiry}`
                }
                danger={isExpired}
              />
              <Fact
                icon={MapPin}
                label="Location"
                value={target.location || "미지정"}
              />
            </div>
          </section>

          <Separator />

          <section
            data-testid="labaxis-inventory-disposal-approval-summary"
            className="space-y-3 p-5"
          >
            <div>
              <p className="text-[11px] font-bold uppercase text-slate-400">
                승인 전 감사 요약
              </p>
              <p className="text-xs text-slate-500">
                폐기 확정 전에 lot, 수량, 위치, 사유, 재고 감소를 한 줄씩 확인합니다.
              </p>
            </div>
            <div
              data-testid="labaxis-inventory-disposal-approval-line"
              className="grid grid-cols-3 gap-1.5"
            >
              {approvalStatusItems.map((item) => (
                <span
                  key={item.label}
                  className={`inline-flex items-center justify-between gap-2 rounded-md border px-2.5 py-2 text-[11px] font-bold ${item.className}`}
                >
                  {item.label}
                  <strong className="text-sm leading-none">{item.value}</strong>
                </span>
              ))}
            </div>
            <div
              data-testid="labaxis-inventory-disposable-count"
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
            >
              <span className="font-bold text-slate-600">폐기 처리 가능</span>
              <strong className="text-sm text-slate-950">
                {disposableLotCount}건
              </strong>
            </div>
            <div
              data-testid="labaxis-inventory-disposal-stock-impact-first"
              className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-bold">재고 영향</span>
                <strong>
                  -{effectiveQty} {unit}
                </strong>
              </div>
              <p className="mt-1 text-[11px] font-semibold">
                {resolution.causesStockBreach
                  ? "안전재고 이하"
                  : "안전재고 유지"}
              </p>
            </div>
            <dl className="space-y-1.5 rounded-lg border border-red-100 bg-red-50/50 p-3">
              {approvalSummaryRows.map((row) => (
                <div
                  key={row.label}
                  data-testid={`labaxis-inventory-disposal-summary-${row.label}`}
                  className="flex items-center justify-between gap-3 text-xs"
                >
                  <dt className="shrink-0 font-bold text-red-700">
                    {row.label}
                  </dt>
                  <dd className="min-w-0 truncate text-right font-extrabold text-slate-950">
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <Separator />

          <section className="space-y-3 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase text-slate-400">
                  폐기 사유
                </p>
                <p className="text-xs text-slate-500">
                  기본값은 LOT 상태에서 자동 제안됩니다.
                </p>
              </div>
              <Badge
                variant="outline"
                className="border-red-200 bg-red-50 text-red-700"
              >
                {REASON_LABELS[effectiveReason]}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(REASON_LABELS) as DisposalReason[]).map(
                (reason) => {
                  const selected = effectiveReason === reason;
                  return (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => setSelectedReason(reason)}
                      className={`rounded-md border px-3 py-2 text-left text-xs font-bold transition-colors ${
                        selected
                          ? "border-red-300 bg-red-50 text-red-700"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {REASON_LABELS[reason]}
                    </button>
                  );
                },
              )}
            </div>

            {effectiveReason === "other" && (
              <textarea
                className="h-20 w-full resize-none rounded-md border border-slate-200 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-red-200"
                placeholder="폐기 사유 상세를 입력하세요."
                value={reasonDetail}
                onChange={(event) => setReasonDetail(event.target.value)}
              />
            )}
          </section>

          <Separator />

          <section className="space-y-3 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase text-slate-400">
                  처리 수량
                </p>
                <p className="text-xs text-slate-500">
                  기본 CTA는 전체 LOT 폐기입니다.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-[11px]"
                onClick={() => setDisposalQty(target.lotQuantity)}
              >
                전체 LOT
              </Button>
            </div>
            <input
              type="number"
              min={1}
              max={target.lotQuantity}
              value={effectiveQty}
              onChange={(event) => {
                const next = Math.max(
                  1,
                  Math.min(Number(event.target.value), target.lotQuantity),
                );
                setDisposalQty(
                  Number.isFinite(next) ? next : target.lotQuantity,
                );
              }}
              className="h-10 w-28 rounded-md border border-slate-200 px-3 text-center text-sm font-extrabold outline-none focus:ring-2 focus:ring-red-200"
            />
          </section>

          <Separator />

          <section
            data-testid="labaxis-inventory-post-disposal-impact"
            data-legacy-testid="lot-disposal-impact-summary"
            className="space-y-3 p-5"
          >
            <p className="text-[11px] font-bold uppercase text-slate-400">
              재고 영향 고정 표시
            </p>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                <ImpactRow
                  label="현재 전체 재고"
                  value={`${target.totalItemQuantity} ${unit}`}
                />
                <ImpactRow
                  label="폐기 후 재고"
                  value={`${remainingAfterLotDisposal} ${unit}`}
                  strong
                />
                <ImpactRow
                  label="안전 재고"
                  value={
                    target.safetyStock
                      ? `${target.safetyStock} ${unit}`
                      : "미설정"
                  }
                />
                <ImpactRow
                  label="상태"
                  value={
                    resolution.causesStockBreach
                      ? "재고 부족 검토 필요"
                      : "폐기 가능"
                  }
                  danger={resolution.causesStockBreach}
                />
              </dl>
            </div>

            {isCompleted && completionSummary && (
              <div
                data-testid="labaxis-inventory-disposal-complete-summary"
                className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-extrabold">폐기 완료</span>
                  <strong>
                    -{completionSummary.quantity} {unit}
                  </strong>
                </div>
                <p className="mt-1 font-semibold">
                  폐기 후 재고 {completionSummary.remainingQuantity} {unit} ·{" "}
                  {completionSummary.reorderReviewRequired
                    ? "재주문 검토는 보조 단계로 전환됨"
                    : "재주문 없이 안전재고 유지"}
                </p>
              </div>
            )}

            {resolution.causesStockBreach ? (
              <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div>
                  <p className="text-xs font-extrabold text-slate-950">
                    폐기 후 재고 부족 가능
                  </p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-slate-600">
                    재주문 검토는 폐기 승인 이후 보조 액션으로 이동합니다.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <div>
                  <p className="text-xs font-extrabold text-slate-950">
                    폐기 후 안전 재고 유지
                  </p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-slate-600">
                    LOT 상태와 수량 차감 결과가 감사 로그에 남습니다.
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-2 px-1 text-[10px] leading-relaxed text-slate-500">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <p>폐기 전에는 재주문 CTA를 주 행동으로 노출하지 않습니다.</p>
            </div>
          </section>
        </div>

        <div className="border-t border-slate-200 bg-white px-5 py-3">
          <Button
            data-testid="labaxis-inventory-confirm-disposal-cta"
            disabled={isSubmitting || isCompleted}
            className={`h-10 w-full text-xs font-extrabold text-white ${isCompleted ? "bg-emerald-600 hover:bg-emerald-600" : "bg-red-600 hover:bg-red-700"}`}
            onClick={handleConfirm}
          >
            {isCompleted ? (
              <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
            ) : (
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            )}
            {isCompleted
              ? "폐기 완료"
              : isSubmitting
                ? "폐기 처리 중..."
                : "폐기 승인"}
          </Button>

          {isCompleted && resolution.needsReorderReview && (
            <div
              data-testid="labaxis-inventory-reorder-after-disposal-note"
              className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800"
            >
              <div className="flex items-center justify-between gap-2 font-extrabold">
                <span className="inline-flex items-center gap-1.5">
                <ArrowRight className="h-3 w-3" />
                  폐기 완료 후속
                </span>
                <Badge
                  data-testid="labaxis-inventory-reorder-after-disposal-badge"
                  variant="outline"
                  className="border-amber-300 bg-white text-amber-800"
                >
                  재주문 검토 보조
                </Badge>
              </div>
              <p className="mt-0.5 leading-relaxed">
                실행 버튼이 아니라 완료 후 판단 배지입니다. 재고 부족 시에만{" "}
                {canHandOffToReorderAfterConfirm ? "보조 연결" : "별도 검토"}로 넘깁니다.
              </p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Fact({
  icon: Icon,
  label,
  value,
  detail,
  strong,
  danger,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  detail?: string;
  strong?: boolean;
  danger?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border px-3 py-2.5 ${danger ? "border-red-200 bg-red-50" : "border-slate-100 bg-slate-50"}`}
    >
      <div className="mb-1 flex items-center gap-1.5">
        <Icon
          className={`h-3.5 w-3.5 ${danger ? "text-red-500" : "text-slate-400"}`}
        />
        <span className="text-[10px] font-bold uppercase text-slate-400">
          {label}
        </span>
      </div>
      <p
        className={`truncate text-sm ${strong ? "font-extrabold" : "font-bold"} ${danger ? "text-red-700" : "text-slate-950"}`}
      >
        {value}
      </p>
      {detail && (
        <p
          className={`mt-0.5 text-[10px] font-bold ${danger ? "text-red-600" : "text-slate-500"}`}
        >
          {detail}
        </p>
      )}
    </div>
  );
}

function ImpactRow({
  label,
  value,
  strong,
  danger,
}: {
  label: string;
  value: string;
  strong?: boolean;
  danger?: boolean;
}) {
  return (
    <>
      <dt className="text-slate-500">{label}</dt>
      <dd
        className={`text-right ${strong ? "font-extrabold" : "font-bold"} ${danger ? "text-amber-700" : "text-slate-950"}`}
      >
        {value}
      </dd>
    </>
  );
}
