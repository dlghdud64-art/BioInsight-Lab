"use client";

/**
 * §11.308a #smart-receiving-entry — Placeholder Modal
 *
 * 호영님 P1 spec (2026-05-26):
 *   - 거래명세서 OCR → 품목/수량/LOT/공급사 구조화 → PO 매칭 → 입고 자동화
 *   - backend Phase 1 (OCR) / Phase 2 (LLM 구조화) / Phase 3 (PO 매칭) 미구현
 *   - 진입점만 먼저 배치 + "곧 제공 예정" 안내 + 수동 입고 (`/dashboard/receiving`) fallback
 *
 * dead button 회피 (LabAxis 제품 제약):
 *   - placeholder 상태에서도 [수동으로 입고 처리하기] CTA 가 alive — router.push 동작
 *   - [닫기] CTA — onClose handler 동작
 *
 * 기존 컴포넌트 분리 (재사용 0):
 *   - LabelScannerModal / QuoteScannerModal 은 라벨 / 견적서 용도
 *   - GlobalQRScannerModal 은 QR 용도
 *   - 거래명세서 OCR 흐름은 별도 backend, placeholder 만 신규
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScanLine, ArrowRight, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";

interface SmartReceivingPlaceholderModalProps {
  open: boolean;
  onClose: () => void;
}

export function SmartReceivingPlaceholderModal({
  open,
  onClose,
}: SmartReceivingPlaceholderModalProps) {
  const router = useRouter();

  const handleManualReceiving = () => {
    onClose();
    router.push("/dashboard/receiving");
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-w-md bg-white border-slate-200 p-0 gap-0">
        {/* 헤더 */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg text-slate-900">
              <ScanLine className="h-5 w-5 text-emerald-600" />
              스마트 입고
              <span className="ml-1 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                <Sparkles className="h-3 w-3" />
                곧 제공 예정
              </span>
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500 mt-1.5 leading-relaxed">
              거래명세서를 카메라로 촬영하면 AI가 품목·수량·LOT·공급사를 자동으로 인식해 입고를 처리합니다.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Phase 안내 */}
        <div className="px-6 py-4 border-b border-slate-100 space-y-3">
          <p className="text-xs font-bold text-slate-700">개발 단계</p>
          <div className="space-y-2.5">
            <div className="flex items-start gap-3">
              <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-slate-100 text-slate-600 text-[11px] font-bold flex-shrink-0">
                1
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900">거래명세서 OCR</p>
                <p className="text-xs text-slate-500 mt-0.5">카메라 촬영 + 문자 인식</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-slate-100 text-slate-600 text-[11px] font-bold flex-shrink-0">
                2
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900">AI 구조화</p>
                <p className="text-xs text-slate-500 mt-0.5">품목 · 수량 · LOT · 공급사 자동 정리</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-slate-100 text-slate-600 text-[11px] font-bold flex-shrink-0">
                3
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900">PO 자동 매칭 + 입고 확정</p>
                <p className="text-xs text-slate-500 mt-0.5">기존 발주서와 자동 매칭 후 재고 갱신</p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="px-6 py-4 space-y-2.5">
          <p className="text-xs text-slate-500 leading-relaxed">
            정식 출시 전까지는 수동으로 입고를 처리할 수 있습니다.
          </p>
          <Button
            type="button"
            data-testid="smart-receiving-manual-cta"
            onClick={handleManualReceiving}
            className="w-full h-11 min-h-[44px] bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm"
          >
            수동으로 입고 처리하기
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
          <Button
            type="button"
            data-testid="smart-receiving-close-cta"
            onClick={onClose}
            variant="outline"
            className="w-full h-11 min-h-[44px] text-sm text-slate-700 border-slate-200"
          >
            닫기
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
