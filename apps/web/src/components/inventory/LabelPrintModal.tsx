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

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  /** 라벨 1칸 실치수 (mm) — 인쇄 width/height 의 canonical source. */
  widthMm: number;
  heightMm: number;
  perSheet: string;
  /** 커스텀 규격(사용자 입력) 표식 — widthMm/heightMm 는 입력값으로 대체. */
  custom?: boolean;
  recommended?: boolean;
}

// §11.355-B 규격 데이터화 — 폼텍/DYMO 실측 치수(2026-06 formtec/retailer 대조).
//   하드코딩 width(`.includes("3104")`) 제거 → widthMm/heightMm 가 canonical.
//   구 값 정정: 3101 60칸 38.1×19.2 / 3102 40칸 47×26.9 / 3104 27칸 62.7×30.1.
const LABEL_SPECS: LabelSpec[] = [
  { id: "formtec-3100", name: "폼텍 3100 (바코드용)", widthMm: 38.1, heightMm: 21.2, perSheet: "1시트 65칸", recommended: true },
  { id: "formtec-3101", name: "폼텍 3101 (소형)", widthMm: 38.1, heightMm: 19.2, perSheet: "1시트 60칸" },
  { id: "formtec-3102", name: "폼텍 3102 (바코드용)", widthMm: 47, heightMm: 26.9, perSheet: "1시트 40칸" },
  { id: "formtec-3104", name: "폼텍 3104 (바코드용)", widthMm: 62.7, heightMm: 30.1, perSheet: "1시트 27칸" },
  { id: "dymo-11354", name: "DYMO 11354 (다목적)", widthMm: 57, heightMm: 32, perSheet: "롤 타입" },
  { id: "custom", name: "커스텀 규격 (직접 입력)", widthMm: 50, heightMm: 30, perSheet: "직접 설정", custom: true },
];

/** mm 표시 문자열 (size 컬럼 대체 — dims 에서 파생, 단일 출처). */
function specSizeLabel(s: { widthMm: number; heightMm: number }): string {
  return `${s.widthMm} × ${s.heightMm} mm`;
}

// §11.355-B — 인쇄 HTML 안전 이스케이프 (품명 등에 < > & " 포함 시 깨짐/주입 방지).
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// §11.355-B — 미리보기/인쇄 공용 데모 시드 (selectedItems 비었을 때만).
const DEMO_PREVIEW_ITEMS = [
  { id: "preview-1", name: "Sample Reagent A", catalogNumber: "CAT-001", lotNumber: "LOT-2026-01", expiryDate: "2027-03-15", brand: "Sigma" },
  { id: "preview-2", name: "Sample Reagent B", catalogNumber: "CAT-002", lotNumber: "LOT-2026-02", expiryDate: "2026-12-31", brand: "Thermo" },
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
  // §11.355-B 커스텀 규격 입력 (selectedSpec === "custom" 일 때만 사용).
  const [customW, setCustomW] = useState("50");
  const [customH, setCustomH] = useState("30");

  const activeSpec = LABEL_SPECS.find((s) => s.id === selectedSpec);
  const isCustomSpec = activeSpec?.custom === true;
  // §11.355-B — 인쇄/미리보기의 canonical 치수(mm). 커스텀이면 입력값, 아니면 프리셋 실측.
  const labelWidthMm = isCustomSpec ? (parseFloat(customW) || 50) : (activeSpec?.widthMm ?? 38.1);
  const labelHeightMm = isCustomSpec ? (parseFloat(customH) || 30) : (activeSpec?.heightMm ?? 21.2);

  // §11.355-B — 미리보기 라벨의 실 QR dataURL (inv.id 인코딩 = 스캔 payload 표준).
  //   미리보기=인쇄 일치(dead toggle 해소). selectedItems/QR 토글 변동 시 재생성.
  const previewSourceItems = selectedItems.length > 0 ? selectedItems.slice(0, 3) : DEMO_PREVIEW_ITEMS;
  const [qrPreviewMap, setQrPreviewMap] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!includeQR) { if (!cancelled) setQrPreviewMap({}); return; }
      const map: Record<string, string> = {};
      for (const it of previewSourceItems) {
        try { map[it.id] = await QRCode.toDataURL(it.id, { width: 120, margin: 0 }); } catch { /* skip */ }
      }
      if (!cancelled) setQrPreviewMap(map);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItems, includeQR]);

  const handlePrint = async () => {
    // 새 창에서 라벨 전용 인쇄 페이지 생성
    const items = selectedItems.length > 0 ? selectedItems : [
      { id: "sample", name: "Sample Reagent", catalogNumber: "CAT-001", lotNumber: "LOT-001", expiryDate: "2027-01-01" },
    ];

    // §11.355-B — 실 QR 생성 (inv.id 인코딩 = 스캔 payload 표준). 가짜 바코드 제거,
    //   includeBarcode 는 스캔/수기 입력용 고유번호(inv.id) 텍스트로 대체(정직).
    const qrMap: Record<string, string> = {};
    if (includeQR) {
      for (const item of items) {
        if (!qrMap[item.id]) {
          try { qrMap[item.id] = await QRCode.toDataURL(item.id, { width: 120, margin: 0 }); } catch { /* skip */ }
        }
      }
    }

    const labelsHtml = items.flatMap((item) =>
      Array.from({ length: copies }).map(() => `
        <div class="label">
          <div class="name">${escapeHtml(item.name)}</div>
          ${item.catalogNumber ? `<div class="cat">Cat. ${escapeHtml(item.catalogNumber)}</div>` : ""}
          ${item.lotNumber ? `<div class="lot">Lot: ${escapeHtml(item.lotNumber)}</div>` : ""}
          ${includeQR && qrMap[item.id] ? `<img class="qr" src="${qrMap[item.id]}" alt="QR ${escapeHtml(item.id)}" />` : ""}
          ${includeBarcode ? `<div class="code">${escapeHtml(item.id)}</div>` : ""}
          ${includeExpiry && item.expiryDate ? `<div class="expiry">EXP: ${escapeHtml(item.expiryDate)}</div>` : ""}
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
          width: ${labelWidthMm}mm; min-height: ${labelHeightMm}mm;
        }
        .name { font-size: 9px; font-weight: bold; }
        .cat, .lot { font-size: 7px; color: #666; }
        .qr { width: 56px; height: 56px; margin: 3px 0; display: block; }
        .code { font-family: monospace; font-size: 6px; color: #444; word-break: break-all; margin: 1px 0; }
        .expiry { font-size: 6px; color: #999; }
      </style>
    </head><body>${labelsHtml}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    // QR dataURL 이미지 렌더 시간 확보 후 인쇄 (즉시 print 시 빈 QR 위험).
    setTimeout(() => { try { printWindow.print(); } catch { /* noop */ } }, 250);
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
                      <span className="text-xs text-slate-500">{spec.custom ? spec.perSheet : `${specSizeLabel(spec)} · ${spec.perSheet}`}</span>
                    </div>
                    {selectedSpec === spec.id && (
                      <CheckCircle2 className="h-4 w-4 text-blue-600 flex-shrink-0" />
                    )}
                  </label>
                ))}
              </div>
              {/* §11.355-B 커스텀 규격 입력 — 프리셋이 실물과 다를 때 직접 치수 지정 */}
              {isCustomSpec && (
                <div className="mt-2 flex items-center gap-2 px-4 py-3 rounded-xl border border-blue-200 bg-blue-50/40">
                  <span className="text-xs font-medium text-slate-600">가로</span>
                  <Input
                    type="number" min="1" step="any" value={customW}
                    onChange={(e) => setCustomW(e.target.value)}
                    className="h-9 w-20"
                  />
                  <span className="text-xs text-slate-400">×</span>
                  <span className="text-xs font-medium text-slate-600">세로</span>
                  <Input
                    type="number" min="1" step="any" value={customH}
                    onChange={(e) => setCustomH(e.target.value)}
                    className="h-9 w-20"
                  />
                  <span className="text-xs text-slate-500">mm</span>
                </div>
              )}
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
                    minHeight: `${Math.max(48, Math.round(labelHeightMm * 1.8))}px`,
                  }}
                >
                  <p className="text-[10px] font-bold text-slate-900 truncate">{item.name}</p>
                  {item.catalogNumber && (
                    <p className="text-[8px] text-slate-500 mt-0.5">Cat. {item.catalogNumber}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1.5">
                    {/* §11.355-B — 실 QR(inv.id 인코딩) 미리보기 = 인쇄 결과와 일치 */}
                    {includeQR && qrPreviewMap[item.id] && (
                      <img src={qrPreviewMap[item.id]} alt="QR" className="w-8 h-8 flex-shrink-0" />
                    )}
                    {includeBarcode && (
                      <span className="text-[6px] font-mono text-slate-500 break-all leading-tight">{item.id}</span>
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
            <div className="flex items-center gap-2 text-yellow-600">
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
