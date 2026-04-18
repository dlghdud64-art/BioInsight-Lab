"use client";

/**
 * LabelPrintModal — 실험실 전용 라벨 인쇄
 *
 * 폼텍/DYMO 등 실험실에서 자주 쓰이는 라벨 규격을 선택하고,
 * 바코드/QR/유효기간 옵션을 설정하여 인쇄합니다.
 *
 * 기능:
 * - 규격 선택 (폼텍 3100/3101/3102/3104, DYMO 11354)
 * - 출력 옵션 (매수, 1D 바코드, QR코드, 유효기간)
 * - 실시간 미리보기
 * - 브라우저 인쇄 연동
 */

import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Printer, Tag, Minus, Plus, CheckCircle2, AlertCircle,
  QrCode, Barcode, Calendar, Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ══════════════════════════════════════════════
// Label Specs
// ══════════════════════════════════════════════

interface LabelSpec {
  id: string;
  name: string;
  size: string;
  perSheet: string;
  recommended?: boolean;
}

const LABEL_SPECS: LabelSpec[] = [
  { id: "formtec-3100", name: "폼텍 3100 (바코드용)", size: "38.1 × 21.2 mm", perSheet: "1시트 65칸", recommended: true },
  { id: "formtec-3101", name: "폼텍 3101 (주소용)", size: "63.5 × 38.1 mm", perSheet: "1시트 21칸" },
  { id: "formtec-3102", name: "폼텍 3102 (물류용)", size: "99.1 × 38.1 mm", perSheet: "1시트 14칸" },
  { id: "formtec-3104", name: "폼텍 3104 (대형)", size: "99.1 × 67.7 mm", perSheet: "1시트 8칸" },
  { id: "dymo-11354", name: "DYMO 11354 (다목적)", size: "57 × 32 mm", perSheet: "롤 타입" },
];

// ══════════════════════════════════════════════
// Props
// ══════════════════════════════════════════════

interface LabelPrintModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 선택된 재고 품목 (인쇄 대상) */
  selectedItems?: Array<{
    id: string;
    name: string;
    catalogNumber?: string;
    lotNumber?: string;
    expiryDate?: string;
    brand?: string;
  }>;
}

// ══════════════════════════════════════════════
// Component
// ══════════════════════════════════════════════

export function LabelPrintModal({ open, onOpenChange, selectedItems = [] }: LabelPrintModalProps) {
  const [selectedSpec, setSelectedSpec] = useState("formtec-3100");
  const [copies, setCopies] = useState(1);
  const [includeBarcode, setIncludeBarcode] = useState(true);
  const [includeQR, setIncludeQR] = useState(true);
  const [includeExpiry, setIncludeExpiry] = useState(true);

  const activeSpec = LABEL_SPECS.find((s) => s.id === selectedSpec);

  const handlePrint = () => {
    // 새 창에서 라벨 전용 인쇄 페이지 생성
    const items = selectedItems.length > 0 ? selectedItems : [
      { id: "sample", name: "Sample Reagent", catalogNumber: "CAT-001", lotNumber: "LOT-001", expiryDate: "2027-01-01" },
    ];

    const labelsHtml = items.flatMap((item) =>
      Array.from({ length: copies }).map((_, i) => `
        <div class="label">
          <div class="name">${item.name}</div>
          ${item.catalogNumber ? `<div class="cat">Cat. ${item.catalogNumber}</div>` : ""}
          ${item.lotNumber ? `<div class="lot">Lot: ${item.lotNumber}</div>` : ""}
          ${includeBarcode ? `<div class="barcode">||||||||||||||||||||</div>` : ""}
          ${includeExpiry && item.expiryDate ? `<div class="expiry">EXP: ${item.expiryDate}</div>` : ""}
        </div>
      `)
    ).join("");

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
      <title>라벨 인쇄</title>
      <style>
        @page { margin: 5mm; }
        body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
        .label {
          border: 1px solid #ccc; border-radius: 4px; padding: 6px 8px;
          margin-bottom: 4px; page-break-inside: avoid;
          width: ${activeSpec?.id.includes("3104") ? "90mm" : activeSpec?.id.includes("3102") ? "90mm" : activeSpec?.id.includes("3101") ? "60mm" : "36mm"};
        }
        .name { font-size: 9px; font-weight: bold; }
        .cat, .lot { font-size: 7px; color: #666; }
        .barcode { font-family: monospace; font-size: 10px; letter-spacing: -1px; margin: 3px 0; }
        .expiry { font-size: 6px; color: #999; }
      </style>
    </head><body>${labelsHtml}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <Tag className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-slate-900">실험실 라벨 인쇄</DialogTitle>
              <DialogDescription className="text-sm text-slate-500">
                표준 규격 라벨지에 맞게 바코드 및 품목 정보를 출력합니다.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col lg:flex-row">
          {/* ── 좌측: 설정 영역 ── */}
          <div className="flex-1 p-6 space-y-6 border-r border-slate-100">
            {/* 라벨 규격 선택 */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Tag className="h-4 w-4 text-slate-500" />
                <h3 className="text-sm font-bold text-slate-800">라벨 규격 선택</h3>
              </div>
              <div className="space-y-2">
                {LABEL_SPECS.map((spec) => (
                  <label
                    key={spec.id}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all",
                      selectedSpec === spec.id
                        ? "border-blue-300 bg-blue-50/50 ring-1 ring-blue-200"
                        : "border-slate-200 bg-white hover:border-slate-300",
                    )}
                  >
                    <input
                      type="radio"
                      name="labelSpec"
                      value={spec.id}
                      checked={selectedSpec === spec.id}
                      onChange={() => setSelectedSpec(spec.id)}
                      className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-800">{spec.name}</span>
                        {spec.recommended && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-bold">추천</span>
                        )}
                      </div>
                      <span className="text-xs text-slate-500">{spec.size} · {spec.perSheet}</span>
                    </div>
                    {selectedSpec === spec.id && (
                      <CheckCircle2 className="h-4 w-4 text-blue-600 flex-shrink-0" />
                    )}
                  </label>
                ))}
              </div>
            </div>

            {/* 출력 옵션 */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Printer className="h-4 w-4 text-slate-500" />
                <h3 className="text-sm font-bold text-slate-800">출력 옵션</h3>
              </div>
              <div className="space-y-3">
                {/* 출력 매수 */}
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-slate-700">품목당 출력 매수</Label>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 w-8 p-0 border-slate-200"
                      onClick={() => setCopies((prev) => Math.max(1, prev - 1))}
                      disabled={copies <= 1}
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </Button>
                    <span className="w-8 text-center text-sm font-bold text-slate-900 tabular-nums">{copies}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 w-8 p-0 border-slate-200"
                      onClick={() => setCopies((prev) => Math.min(99, prev + 1))}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* 토글 옵션 */}
                {[
                  { id: "barcode", label: "1D 바코드 포함", icon: <Barcode className="h-4 w-4 text-slate-400" />, checked: includeBarcode, onChange: setIncludeBarcode },
                  { id: "qr", label: "QR 코드 포함", icon: <QrCode className="h-4 w-4 text-slate-400" />, checked: includeQR, onChange: setIncludeQR },
                  { id: "expiry", label: "유효기간 표시", icon: <Calendar className="h-4 w-4 text-slate-400" />, checked: includeExpiry, onChange: setIncludeExpiry },
                ].map((opt) => (
                  <div key={opt.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {opt.icon}
                      <Label htmlFor={opt.id} className="text-sm text-slate-700">{opt.label}</Label>
                    </div>
                    <Switch
                      id={opt.id}
                      checked={opt.checked}
                      onCheckedChange={opt.onChange}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── 우측: 미리보기 ── */}
          <div className="w-full lg:w-[280px] p-6 bg-slate-50">
            <div className="flex items-center gap-2 mb-3">
              <Eye className="h-4 w-4 text-slate-500" />
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">미리보기 (PREVIEW)</h3>
            </div>

            {/* 미리보기 라벨 카드 */}
            <div className="space-y-2">
              {(selectedItems.length > 0 ? selectedItems.slice(0, 3) : [
                { id: "preview-1", name: "Sample Reagent A", catalogNumber: "CAT-001", lotNumber: "LOT-2026-01", expiryDate: "2027-03-15", brand: "Sigma" },
                { id: "preview-2", name: "Sample Reagent B", catalogNumber: "CAT-002", lotNumber: "LOT-2026-02", expiryDate: "2026-12-31", brand: "Thermo" },
              ]).map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm"
                  style={{
                    width: "100%",
                    minHeight: activeSpec?.id.includes("3104") ? "80px" : "56px",
                  }}
                >
                  <p className="text-[10px] font-bold text-slate-900 truncate">{item.name}</p>
                  {item.catalogNumber && (
                    <p className="text-[8px] text-slate-500 mt-0.5">Cat. {item.catalogNumber}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1.5">
                    {includeBarcode && (
                      <div className="flex gap-px">
                        {Array.from({ length: 20 }).map((_, i) => (
                          <div key={i} className="w-[1px] bg-slate-800" style={{ height: `${8 + Math.random() * 6}px` }} />
                        ))}
                      </div>
                    )}
                    {includeQR && (
                      <div className="w-5 h-5 bg-slate-200 rounded-sm flex items-center justify-center flex-shrink-0">
                        <QrCode className="h-3 w-3 text-slate-600" />
                      </div>
                    )}
                  </div>
                  {includeExpiry && item.expiryDate && (
                    <p className="text-[7px] text-slate-400 mt-1">EXP: {item.expiryDate}</p>
                  )}
                </div>
              ))}

              {selectedItems.length > 3 && (
                <p className="text-[10px] text-slate-400 text-center">+{selectedItems.length - 3} labels...</p>
              )}
            </div>

            {/* 인쇄 정보 요약 */}
            <div className="mt-4 pt-3 border-t border-slate-200">
              <p className="text-[10px] text-slate-500">
                {activeSpec?.name} · {copies}매 × {Math.max(selectedItems.length, 1)}종 = {copies * Math.max(selectedItems.length, 1)}장 인쇄
              </p>
            </div>
          </div>
        </div>

        {/* ── 하단: 선택 상태 + 액션 ── */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
          {selectedItems.length === 0 ? (
            <div className="flex items-center gap-2 text-amber-600">
              <AlertCircle className="h-4 w-4" />
              <span className="text-xs font-medium">선택된 품목이 없습니다. 재고 관리에서 품목을 선택해주세요.</span>
            </div>
          ) : (
            <span className="text-xs text-slate-500">
              총 {selectedItems.length}개 품목 × {copies}장 = {selectedItems.length * copies}장 인쇄
            </span>
          )}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              취소
            </Button>
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
              onClick={handlePrint}
            >
              <Printer className="h-3.5 w-3.5" />
              인쇄 시작
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** LabelPrintContent — GlobalModal 통합용 */
export function LabelPrintContent({
  onClose,
  selectedItems,
}: {
  onClose?: () => void;
  selectedItems?: LabelPrintModalProps["selectedItems"];
}) {
  return (
    <LabelPrintModal
      open={true}
      onOpenChange={(v) => { if (!v && onClose) onClose(); }}
      selectedItems={selectedItems}
    />
  );
}
