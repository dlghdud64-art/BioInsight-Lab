"use client";

import { useState, useMemo, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Printer, Eye, X, AlertTriangle, QrCode } from "lucide-react";

interface LabelItem {
  id: string;
  productName: string;
  catalogNumber?: string | null;
  lotNumber?: string | null;
  location?: string | null;
  currentQuantity: number;
  unit?: string | null;
  expiryDate?: string | null;
}

interface LabelPrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: LabelItem[];
}

type LabelPreset = "a4-3x7" | "a4-3x10" | "a4-2x5" | "single-60x40" | "single-50x30";
type StartPosition = "1-1" | "2-1" | "3-1" | "custom";
type OutputMethod = "print" | "pdf" | "png";

interface PresetSpec { label: string; cols: number; rows: number; w: number; h: number }
interface IncludeFields {
  productName: true;
  catalogNumber: boolean;
  lotNumber: boolean;
  location: boolean;
  quantity: boolean;
  expiryDate: boolean;
  qrCode: boolean;
}

const PRESETS: Record<LabelPreset, PresetSpec> = {
  "a4-3x7": { label: "A4 일반 라벨 (3x7, 63.5x38.1mm) - 폼텍 LQ-3107 호환", cols: 3, rows: 7, w: 63.5, h: 38.1 },
  "a4-3x10": { label: "A4 소형 라벨 (3x10, 63.5x25.4mm) - 폼텍 LQ-3105 호환", cols: 3, rows: 10, w: 63.5, h: 25.4 },
  "a4-2x5": { label: "A4 중형 라벨 (2x5, 99.1x57mm)", cols: 2, rows: 5, w: 99.1, h: 57 },
  "single-60x40": { label: "소형 QR 라벨 (60x40mm) - 개별 출력", cols: 1, rows: 1, w: 60, h: 40 },
  "single-50x30": { label: "미니 라벨 (50x30mm)", cols: 1, rows: 1, w: 50, h: 30 },
};

const FIELD_LABELS: Array<[keyof Omit<IncludeFields, "productName">, string]> = [
  ["catalogNumber", "Cat. No."], ["lotNumber", "Lot"], ["location", "위치"],
  ["quantity", "수량"], ["expiryDate", "유효기간"], ["qrCode", "QR코드"],
];

function metaLine(item: LabelItem, include: IncludeFields) {
  const parts: string[] = [];
  if (include.catalogNumber && item.catalogNumber) parts.push(`Cat#: ${item.catalogNumber}`);
  if (include.lotNumber && item.lotNumber) parts.push(`Lot: ${item.lotNumber}`);
  if (include.location && item.location) parts.push(item.location);
  if (include.quantity) parts.push(`${item.currentQuantity}${item.unit ? ` ${item.unit}` : ""}`);
  if (include.expiryDate && item.expiryDate) parts.push(`EXP: ${item.expiryDate}`);
  return parts;
}

export function LabelPrintDialog({ open, onOpenChange, items }: LabelPrintDialogProps) {
  const [preset, setPreset] = useState<LabelPreset>("a4-3x7");
  const [startPos, setStartPos] = useState<StartPosition>("1-1");
  const [customRow, setCustomRow] = useState(1);
  const [customCol, setCustomCol] = useState(1);
  const [outputMethod, setOutputMethod] = useState<OutputMethod>("print");
  const [includeFields, setIncludeFields] = useState<IncludeFields>({
    productName: true, catalogNumber: true, lotNumber: true, location: true,
    quantity: false, expiryDate: false, qrCode: true,
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(items.map((i) => i.id)));

  const itemIds = items.map((i) => i.id).join(",");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useMemo(() => setSelectedIds(new Set(items.map((i) => i.id))), [itemIds]);

  const spec = PRESETS[preset];
  const isSingle = spec.cols === 1 && spec.rows === 1;
  const selectedItems = useMemo(() => items.filter((i) => selectedIds.has(i.id)), [items, selectedIds]);

  const startOffset = useMemo(() => {
    if (startPos === "2-1") return spec.cols;
    if (startPos === "3-1") return spec.cols * 2;
    if (startPos === "custom") return (customRow - 1) * spec.cols + (customCol - 1);
    return 0;
  }, [startPos, spec.cols, customRow, customCol]);

  const nameOverflowIds = useMemo(() => {
    const ids = new Set<string>();
    for (const it of selectedItems) if (it.productName.length > 40) ids.add(it.id);
    return ids;
  }, [selectedItems]);

  const toggleItem = useCallback((id: string) => {
    setSelectedIds((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);
  const toggleAll = useCallback(() => {
    setSelectedIds((p) => p.size === items.length ? new Set() : new Set(items.map((i) => i.id)));
  }, [items]);
  const toggleField = useCallback((f: keyof Omit<IncludeFields, "productName">) => {
    setIncludeFields((p) => ({ ...p, [f]: !p[f] }));
  }, []);

  const totalSlots = isSingle ? selectedItems.length : spec.cols * spec.rows;
  const previewSlots = useMemo(() => {
    const s: Array<LabelItem | "empty" | "skip"> = [];
    for (let i = 0; i < startOffset && i < totalSlots; i++) s.push("skip");
    for (const it of selectedItems) { if (s.length >= totalSlots && !isSingle) break; s.push(it); }
    if (!isSingle) while (s.length < totalSlots) s.push("empty");
    return s;
  }, [startOffset, totalSlots, selectedItems, isSingle]);

  const actionLabel = outputMethod === "print" ? "인쇄하기" : outputMethod === "pdf" ? "PDF 저장" : "PNG 저장";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[800px] max-w-[95vw] max-h-[90vh] overflow-y-auto p-0 gap-0 bg-pg border-bd">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="text-base font-semibold flex items-center gap-2 text-foreground">
            <Printer className="h-4 w-4 text-blue-500" />
            라벨 인쇄
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            선택된 재고 항목의 라벨을 인쇄하거나 저장합니다
          </DialogDescription>
        </DialogHeader>

        {/* Settings bar */}
        <div className="mx-6 mb-4 bg-el rounded-xl p-4 border border-bd">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">라벨 규격</Label>
              <Select value={preset} onValueChange={(v) => setPreset(v as LabelPreset)}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(PRESETS) as LabelPreset[]).map((k) => (
                    <SelectItem key={k} value={k} className="text-xs">{PRESETS[k].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">시작 위치</Label>
              <Select value={startPos} onValueChange={(v) => setStartPos(v as StartPosition)} disabled={isSingle}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1-1" className="text-xs">1행 1열부터 (새 용지)</SelectItem>
                  <SelectItem value="2-1" className="text-xs">2행 1열부터</SelectItem>
                  <SelectItem value="3-1" className="text-xs">3행 1열부터</SelectItem>
                  <SelectItem value="custom" className="text-xs">직접 입력</SelectItem>
                </SelectContent>
              </Select>
              {startPos === "custom" && !isSingle && (
                <div className="flex items-center gap-2 mt-1.5">
                  <Input type="number" min={1} max={spec.rows} value={customRow}
                    onChange={(e) => setCustomRow(Math.max(1, Math.min(spec.rows, Number(e.target.value) || 1)))}
                    className="h-7 w-16 text-xs text-center" />
                  <span className="text-xs text-muted-foreground">행</span>
                  <Input type="number" min={1} max={spec.cols} value={customCol}
                    onChange={(e) => setCustomCol(Math.max(1, Math.min(spec.cols, Number(e.target.value) || 1)))}
                    className="h-7 w-16 text-xs text-center" />
                  <span className="text-xs text-muted-foreground">열</span>
                </div>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">포함 정보</Label>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-not-allowed">
                  <Checkbox checked disabled className="h-3.5 w-3.5" />품목명
                </label>
                {FIELD_LABELS.map(([field, lbl]) => (
                  <label key={field} className="flex items-center gap-1.5 text-xs text-foreground cursor-pointer">
                    <Checkbox checked={includeFields[field]} onCheckedChange={() => toggleField(field)} className="h-3.5 w-3.5" />
                    {lbl}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-1.5 min-w-[180px]">
              <Label className="text-xs text-muted-foreground">출력 방식</Label>
              <Select value={outputMethod} onValueChange={(v) => setOutputMethod(v as OutputMethod)}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="print" className="text-xs">브라우저 인쇄 (Ctrl+P)</SelectItem>
                  <SelectItem value="pdf" className="text-xs">PDF 저장</SelectItem>
                  <SelectItem value="png" className="text-xs">PNG 저장 (단일 라벨)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Body: 2 columns */}
        <div className="mx-6 mb-4 grid grid-cols-1 md:grid-cols-[1fr_1fr] gap-4">
          {/* Left: item list */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <button type="button" onClick={toggleAll}
                className="flex items-center gap-1.5 text-xs text-blue-500 hover:text-blue-400 transition-colors">
                <Checkbox checked={selectedIds.size === items.length} className="h-3.5 w-3.5" onCheckedChange={toggleAll} />
                전체 선택
              </button>
              <span className="text-xs text-muted-foreground">{selectedIds.size}/{items.length}개 선택</span>
            </div>
            <div className="max-h-[300px] overflow-y-auto space-y-1 pr-1">
              {items.map((item) => {
                const chk = selectedIds.has(item.id), ov = nameOverflowIds.has(item.id);
                return (
                  <label key={item.id} className={`flex items-start gap-2.5 p-2.5 rounded-lg cursor-pointer transition-colors ${chk ? "bg-el border border-blue-500/30" : "bg-pn border border-bd hover:border-blue-500/20"}`}>
                    <Checkbox checked={chk} onCheckedChange={() => toggleItem(item.id)} className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-foreground truncate">{item.productName}</span>
                        {ov && <span title="품목명이 2줄을 초과할 수 있습니다"><AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" /></span>}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {item.lotNumber && <span className="text-[10px] text-muted-foreground">Lot: {item.lotNumber}</span>}
                        <span className="text-[10px] text-muted-foreground">{item.currentQuantity}{item.unit ? ` ${item.unit}` : ""}</span>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Right: preview */}
          <div className="space-y-2">
            <span className="text-xs text-muted-foreground">미리보기</span>
            <div className="bg-white rounded-lg p-4 border border-slate-200 min-h-[200px]">
              {isSingle ? (
                <div className="flex flex-col gap-2">
                  {previewSlots.map((slot) => {
                    if (typeof slot === "string") return null;
                    const meta = metaLine(slot, includeFields), ov = nameOverflowIds.has(slot.id);
                    return (
                      <div key={slot.id} className={`bg-white rounded border p-3 flex gap-3 ${ov ? "border-amber-300" : "border-slate-200"}`}
                        style={{ maxWidth: `${Math.min(spec.w * 3, 220)}px` }}>
                        {includeFields.qrCode && <div className="shrink-0 flex items-center justify-center w-16 h-16 bg-slate-50 rounded"><QrCode className="h-10 w-10 text-slate-400" /></div>}
                        <div className="flex-1 min-w-0 space-y-0.5">
                          <p className={`text-xs font-semibold leading-tight ${ov ? "text-amber-700" : "text-slate-800"}`}>{slot.productName}</p>
                          {meta.map((m, i) => <p key={i} className="text-[10px] text-slate-500">{m}</p>)}
                        </div>
                      </div>
                    );
                  })}
                  {selectedItems.length === 0 && <p className="text-xs text-slate-400 text-center py-8">항목을 선택하세요</p>}
                </div>
              ) : (
                <div className="grid gap-[2px]" style={{ gridTemplateColumns: `repeat(${spec.cols}, 1fr)` }}>
                  {previewSlots.map((slot, i) => {
                    if (slot === "skip") return <div key={`skip-${i}`} className="bg-slate-100 rounded-sm border border-dashed border-slate-200" style={{ aspectRatio: `${spec.w}/${spec.h}` }} />;
                    if (slot === "empty") return <div key={`empty-${i}`} className="bg-slate-50 rounded-sm border border-slate-100" style={{ aspectRatio: `${spec.w}/${spec.h}` }} />;
                    const meta = metaLine(slot, includeFields), ov = nameOverflowIds.has(slot.id);
                    return (
                      <div key={slot.id} className={`bg-white rounded-sm border p-[3px] overflow-hidden flex gap-[2px] ${ov ? "border-amber-300" : "border-slate-200"}`}
                        style={{ aspectRatio: `${spec.w}/${spec.h}` }}>
                        {includeFields.qrCode && <div className="shrink-0 flex items-center justify-center"><QrCode className="h-[60%] w-auto text-slate-400" /></div>}
                        <div className="flex-1 min-w-0 flex flex-col justify-center overflow-hidden">
                          <span className="text-[5px] leading-[1.2] font-semibold text-slate-800 line-clamp-2">{slot.productName}</span>
                          {meta.map((m, j) => <span key={j} className="text-[3.5px] text-slate-500 truncate">{m}</span>)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {nameOverflowIds.size > 0 && (
              <p className="text-[10px] text-amber-500 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />{nameOverflowIds.size}개 항목의 품목명이 2줄을 초과할 수 있습니다
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-bd bg-pn flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" className="text-xs gap-1.5" onClick={() => onOpenChange(false)}>
            <X className="h-3.5 w-3.5" />닫기
          </Button>
          <Button variant="outline" size="sm" className="text-xs gap-1.5" disabled={selectedItems.length === 0}>
            <Eye className="h-3.5 w-3.5" />단일 라벨 보기
          </Button>
          <Button size="sm" className="text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 text-white" disabled={selectedItems.length === 0}>
            <Printer className="h-3.5 w-3.5" />{actionLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
