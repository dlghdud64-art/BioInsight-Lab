"use client";

/**
 * §inventory-mobile-reorder-gate P3 — 중복 발주 위험 소프트 게이트 바텀시트.
 *
 * 원칙(하드 차단 금지):
 *   canonical blockReasons(/api/inventory/reorder-recommendations — RFQ 진행·예산 초과)는
 *   "차단"이 아니라 "게이트"다. 진행 중 견적이 수요를 못 덮는 케이스(증산·분할 납품·취소 예정)가
 *   실재하므로 '그래도 재발주 검토 진행'(primary)으로 경로를 막지 않는다. 진행 시 override 사유가
 *   검토 시트·견적 초안 reason에 전파되어 중복 위험을 알고 결정했음이 남는다.
 *
 * 정직 경계:
 *   - 사유는 canonical blockReasons 문자열 그대로(가공·추정 금지).
 *   - 인바운드 예정 수량은 canonical 소스 부재로 미표시 — 대신 실값(현재/안전재고 부족분)만 정량 표기.
 *   - 현재 사유는 전부 soft(정책상 진행 불가 사유 생기면 severity 분기 추가).
 *
 * 색: 주의 = yellow 계열 hex(#fffbeb/#fde68a/#92400e, 시안 ③) — Tailwind amber·orange 클래스 0.
 */

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowRight, ClipboardList } from "lucide-react";

export interface InventoryReorderBlockedSheetProps {
  open: boolean;
  onClose: () => void;
  productName: string | null;
  /** canonical blockReasons(/reorder-recommendations). 빈 배열이면 시트 무의미 → 미표시. */
  reasons: string[];
  currentQuantity?: number | null;
  safetyStock?: number | null;
  unit?: string;
  /** 진행 중 견적 보기(outline) — RFQ 사유 존재 시 /dashboard/quotes 라우팅. caller 주입. */
  onViewQuotes?: () => void;
  /** 그래도 재발주 검토 진행(primary) — override 사유 전파는 caller 소관. */
  onProceed: () => void;
}

export function InventoryReorderBlockedSheet({
  open,
  onClose,
  productName,
  reasons,
  currentQuantity = null,
  safetyStock = null,
  unit,
  onViewQuotes,
  onProceed,
}: InventoryReorderBlockedSheetProps) {
  if (!productName || reasons.length === 0) return null;

  const hasRfqReason = reasons.some((r) => r.includes("견적"));
  const shortage =
    safetyStock != null && currentQuantity != null
      ? Math.max(0, safetyStock - currentQuantity)
      : null;

  return (
    <Sheet open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <SheetContent
        side="bottom"
        className="max-h-[85vh] overflow-y-auto"
        overlayClassName="!top-14"
        data-testid="reorder-blocked-sheet"
      >
        <SheetHeader className="text-left">
          <SheetTitle className="text-lg text-slate-900">{productName}</SheetTitle>
          <SheetDescription className="text-sm text-slate-500">
            재발주 검토 전에 아래 위험을 확인하세요.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* ── 위험 카드(yellow, 시안 ③) ── */}
          <div
            className="rounded-xl p-4 space-y-3"
            style={{ backgroundColor: "#fffbeb", border: "1px solid #fde68a" }}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" style={{ color: "#92400e" }} />
              <p className="text-sm font-bold" style={{ color: "#92400e" }}>
                중복 발주 위험이 있습니다
              </p>
            </div>

            {/* 사유별 흰 미니 카드 — canonical blockReasons 그대로 */}
            <div className="space-y-1.5">
              {reasons.map((reason, i) => (
                <div
                  key={i}
                  data-testid="reorder-blocked-reason"
                  className="rounded-lg bg-white p-2.5"
                  style={{ border: "1px solid #fde68a" }}
                >
                  <p className="text-xs font-semibold text-slate-800 leading-relaxed">{reason}</p>
                </div>
              ))}
            </div>

            {/* 정량 근거 — 실값(현재/안전재고)만. 인바운드 예정 수량은 canonical 부재로 미표시. */}
            {shortage != null && (
              <p className="text-xs leading-relaxed" style={{ color: "#92400e" }}>
                현재 {currentQuantity}
                {unit ?? "ea"} / 안전재고 {safetyStock}
                {unit ?? "ea"} 기준 부족분 {shortage}
                {unit ?? "ea"}입니다. 진행 중인 요청이 이 부족분을 덮는지 확인 후 진행하세요.
              </p>
            )}
          </div>

          {/* ── 액션: 게이트지 차단이 아님 ── */}
          <div className="flex flex-col gap-2 pt-1">
            {hasRfqReason && onViewQuotes && (
              <Button
                type="button"
                variant="outline"
                data-testid="reorder-blocked-view-quotes"
                onClick={onViewQuotes}
                className="w-full h-11 min-h-[44px] text-sm border-slate-300 text-slate-700"
              >
                <ClipboardList className="h-4 w-4 mr-1.5" />
                진행 중 견적 보기
              </Button>
            )}
            <Button
              type="button"
              data-testid="reorder-blocked-proceed"
              onClick={onProceed}
              className="w-full h-11 min-h-[44px] text-sm bg-blue-600 hover:bg-blue-700 text-white font-semibold"
            >
              그래도 재발주 검토 진행
              <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
