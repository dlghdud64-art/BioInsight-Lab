"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { QrCode, Printer, Download, Layers, MoreHorizontal, Copy } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface LotInfo {
  id: string;
  lotNumber: string | null;
  location: string | null;
  currentQuantity: number;
  unit: string;
}

interface InventoryQRCodeProps {
  inventoryId: string;
  productName: string;
  catalogNumber?: string | null;
  location?: string | null;
  unit?: string | null;
  currentQuantity?: number;
  lotNumber?: string | null;
  /** 같은 품목의 전체 lot 목록 (일괄 출력용) */
  allLots?: LotInfo[];
}

/**
 * QR 코드 생성 및 프린트 라벨 다이얼로그
 * lot 단위 발급 + 일괄 출력 지원
 */
export function InventoryQRCode({
  inventoryId,
  productName,
  catalogNumber,
  location,
  unit,
  currentQuantity,
  lotNumber,
  allLots,
}: InventoryQRCodeProps) {
  const [open, setOpen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dataUrl, setDataUrl] = useState<string>("");
  const [printMode, setPrintMode] = useState<"single" | "batch">("single");
  const [printQty, setPrintQty] = useState(1);

  const scanUrl = typeof window !== "undefined"
    ? `${window.location.origin}/dashboard/inventory/scan?id=${inventoryId}`
    : `/dashboard/inventory/scan?id=${inventoryId}`;

  useEffect(() => {
    if (!open) return;

    const timer = setTimeout(async () => {
      if (!canvasRef.current) return;
      try {
        await QRCode.toCanvas(canvasRef.current, scanUrl, {
          width: 180,
          margin: 2,
          color: {  "#1e293b", light: "#ffffff" },
        });
        setDataUrl(canvasRef.current.toDataURL("image/png"));
      } catch (err) {
        console.error("QR 코드 생성 실패:", err);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [open, scanUrl]);

  const handleDownload = () => {
    if (!dataUrl) return;
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `QR_${lotNumber || catalogNumber || inventoryId}.png`;
    link.click();
  };

  // XSS 방어
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const buildLabelHtml = (opts: {
    qrDataUrl: string;
    name: string;
    cat?: string | null;
    lot?: string | null;
    loc?: string | null;
    qty?: number;
    unitStr?: string | null;
    invId: string;
  }) => `
    <div class="label-container">
      <div class="qr-col"><img src="${opts.qrDataUrl}" alt="QR" /></div>
      <div class="info-col">
        <div class="prod-name">${esc(opts.name)}</div>
        ${opts.cat ? `<div class="meta-row">Cat#: ${esc(opts.cat)}</div>` : ""}
        ${opts.lot ? `<div class="meta-row">Lot: ${esc(opts.lot)}</div>` : ""}
        ${opts.loc ? `<div class="meta-row">📍 ${esc(opts.loc)}</div>` : ""}
        ${opts.qty !== undefined ? `<div class="meta-row">재고: ${opts.qty}${opts.unitStr ? ` ${esc(opts.unitStr)}` : ""}</div>` : ""}
        <div class="inv-id">${esc(opts.invId.slice(0, 20))}…</div>
      </div>
    </div>`;

  const labelStyles = `
    @page { size: 60mm 40mm; margin: 0mm; }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    .label-container {
      width: 60mm; height: 40mm; overflow: hidden;
      display: flex; flex-direction: row; align-items: center;
      padding: 3mm 3.5mm; gap: 3mm; page-break-after: always;
    }
    .qr-col { flex-shrink: 0; }
    .qr-col img { width: 29mm; height: 29mm; display: block; }
    .info-col { flex: 1; min-width: 0; overflow: hidden; display: flex; flex-direction: column; }
    .prod-name {
      font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif;
      font-size: 7.5pt; font-weight: 700; color: #0f172a; line-height: 1.3;
      word-break: break-all; display: -webkit-box; -webkit-line-clamp: 2;
      -webkit-box-orient: vertical; overflow: hidden; margin-bottom: 1.2mm;
    }
    .meta-row {
      font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif;
      font-size: 6pt; color: #475569; margin-top: 0.6mm;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .inv-id {
      font-family: 'Courier New', monospace; font-size: 5pt; color: #94a3b8;
      margin-top: 1.5mm; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    @media screen {
      html, body {
        background: #f1f5f9; min-height: 100vh; display: flex; flex-direction: column;
        align-items: center; justify-content: flex-start; gap: 16px;
        font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif; padding: 24px;
      }
      .screen-hint { font-size: 13px; color: #64748b; text-align: center; line-height: 1.6; }
      .label-container {
        background: #fff; border: 1px solid #cbd5e1; border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1); margin-bottom: 8px;
      }
      .btn-row { display: flex; gap: 10px; margin-top: 12px; }
      .btn-print { padding: 10px 28px; background: #2563eb; color: #fff; border: none; border-radius: 8px; font-size: 14px; cursor: pointer; }
      .btn-print:hover { background: #1d4ed8; }
      .btn-close { padding: 10px 20px; background: transparent; color: #64748b; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 13px; cursor: pointer; }
    }
    @media print {
      .screen-hint, .btn-row { display: none !important; }
      html, body { margin: 0 !important; padding: 0 !important; background: transparent !important; }
      .label-container { background: #fff !important; box-shadow: none !important; border: none !important; border-radius: 0 !important; }
    }`;

  const handlePrintSingle = () => {
    if (!dataUrl) return;
    const labels = Array.from({ length: printQty }, () =>
      buildLabelHtml({ qrDataUrl: dataUrl, name: productName, cat: catalogNumber, lot: lotNumber, loc: location, qty: currentQuantity, unitStr: unit, invId: inventoryId })
    ).join("\n");

    const printWindow = window.open("", "_blank", "width=600,height=500");
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>QR 라벨 — ${esc(productName)}</title><style>${labelStyles}</style></head><body>
      <p class="screen-hint">📄 인쇄 미리보기 — 규격: <strong>60 × 40 mm</strong> (${printQty}장)</p>
      ${labels}
      <div class="btn-row"><button class="btn-print" onclick="window.print()">🖨️ 인쇄하기</button><button class="btn-close" onclick="window.close()">닫기</button></div>
    </body></html>`);
    printWindow.document.close();
  };

  const handlePrintBatch = async () => {
    if (!allLots || allLots.length === 0) return;

    const printWindow = window.open("", "_blank", "width=600,height=600");
    if (!printWindow) return;

    // 각 lot별 QR 생성
    const labelPromises = allLots.map(async (lot) => {
      const url = typeof window !== "undefined"
        ? `${window.location.origin}/dashboard/inventory/scan?id=${lot.id}`
        : `/dashboard/inventory/scan?id=${lot.id}`;
      const canvas = document.createElement("canvas");
      await QRCode.toCanvas(canvas, url, { width: 180, margin: 2, color: {  "#1e293b", light: "#ffffff" } });
      const qrUrl = canvas.toDataURL("image/png");
      return buildLabelHtml({ qrDataUrl: qrUrl, name: productName, cat: catalogNumber, lot: lot.lotNumber, loc: lot.location, qty: lot.currentQuantity, unitStr: lot.unit, invId: lot.id });
    });

    const labels = await Promise.all(labelPromises);

    printWindow.document.write(`<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>QR 일괄 출력 — ${esc(productName)}</title><style>${labelStyles}</style></head><body>
      <p class="screen-hint">📄 일괄 인쇄 미리보기 — <strong>${allLots.length}개 Lot</strong></p>
      ${labels.join("\n")}
      <div class="btn-row"><button class="btn-print" onclick="window.print()">🖨️ 전체 인쇄</button><button class="btn-close" onclick="window.close()">닫기</button></div>
    </body></html>`);
    printWindow.document.close();
  };

  const hasMultipleLots = allLots && allLots.length > 1;

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 w-7 p-0 text-slate-500 hover:text-blue-600"
        onClick={() => setOpen(true)}
        title="QR 코드"
      >
        <QrCode className="h-3.5 w-3.5" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <QrCode className="h-4 w-4 text-blue-600" />
              재고 QR 코드
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col items-center gap-3 py-2">
            {/* QR 캔버스 */}
            <div className="border border-bd rounded-xl p-3 bg-pn shadow-sm">
              <canvas ref={canvasRef} />
            </div>

            {/* Lot 정보 */}
            <div className="w-full bg-pg rounded-lg p-3 space-y-1 text-sm">
              <p className="font-semibold text-slate-200 leading-tight">{productName}</p>
              {lotNumber && <p className="text-slate-500 text-xs">Lot: {lotNumber}</p>}
              {catalogNumber && <p className="text-slate-500 text-xs">Cat#: {catalogNumber}</p>}
              {location && <p className="text-slate-500 text-xs">위치: {location}</p>}
              {currentQuantity !== undefined && (
                <p className="text-slate-500 text-xs">현재 재고: {currentQuantity} {unit || ""}</p>
              )}
            </div>

            {/* 출력 모드 선택 */}
            {hasMultipleLots && (
              <div className="w-full flex gap-2">
                <Button
                  variant={printMode === "single" ? "default" : "outline"}
                  size="sm"
                  className="flex-1 text-xs gap-1.5"
                  onClick={() => setPrintMode("single")}
                >
                  <QrCode className="h-3 w-3" />
                  현재 Lot
                </Button>
                <Button
                  variant={printMode === "batch" ? "default" : "outline"}
                  size="sm"
                  className="flex-1 text-xs gap-1.5"
                  onClick={() => setPrintMode("batch")}
                >
                  <Layers className="h-3 w-3" />
                  전체 Lot ({allLots!.length}개)
                </Button>
              </div>
            )}

            {/* 출력 수량 (단일 모드일 때만) */}
            {printMode === "single" && (
              <div className="w-full flex items-center gap-2">
                <Label className="text-xs text-slate-500 shrink-0">출력 수량</Label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={printQty}
                  onChange={(e) => setPrintQty(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
                  className="h-8 w-20 text-xs text-center"
                />
                <span className="text-xs text-slate-400">장</span>
              </div>
            )}

            {/* 주 액션: 인쇄 + 닫기 */}
            <div className="flex gap-2 w-full">
              {printMode === "single" ? (
                <Button className="flex-1 gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs" onClick={handlePrintSingle} disabled={!dataUrl}>
                  <Printer className="h-3.5 w-3.5" />
                  인쇄하기 {printQty > 1 ? `(${printQty}장)` : ""}
                </Button>
              ) : (
                <Button className="flex-1 gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs" onClick={handlePrintBatch}>
                  <Printer className="h-3.5 w-3.5" />
                  일괄 인쇄 ({allLots!.length}개)
                </Button>
              )}
              <Button variant="outline" className="text-xs px-4" onClick={() => setOpen(false)}>
                닫기
              </Button>
              {/* 보조 액션: overflow menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem onClick={handleDownload} disabled={!dataUrl} className="text-xs gap-2">
                    <Download className="h-3.5 w-3.5" />
                    PNG 저장
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-xs gap-2"
                    onClick={() => {
                      navigator.clipboard.writeText(scanUrl);
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    QR 값 복사
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <p className="text-[10px] text-slate-400 text-center">
              {printMode === "batch"
                ? "같은 품목의 모든 Lot를 각각 1장씩 출력합니다"
                : "스캔 시 해당 재고 상세페이지로 이동합니다"}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
