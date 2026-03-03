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
import { QrCode, Printer, Download, X } from "lucide-react";

interface InventoryQRCodeProps {
  inventoryId: string;
  productName: string;
  catalogNumber?: string | null;
  location?: string | null;
  unit?: string | null;
  currentQuantity?: number;
}

/**
 * QR 코드 생성 및 프린트 라벨 다이얼로그
 * QR 데이터: /dashboard/inventory/scan?id={inventoryId}
 */
export function InventoryQRCode({
  inventoryId,
  productName,
  catalogNumber,
  location,
  unit,
  currentQuantity,
}: InventoryQRCodeProps) {
  const [open, setOpen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dataUrl, setDataUrl] = useState<string>("");

  const scanUrl = typeof window !== "undefined"
    ? `${window.location.origin}/dashboard/inventory/scan?id=${inventoryId}`
    : `/dashboard/inventory/scan?id=${inventoryId}`;

  useEffect(() => {
    if (!open) return;

    const timer = setTimeout(async () => {
      if (!canvasRef.current) return;
      try {
        await QRCode.toCanvas(canvasRef.current, scanUrl, {
          width: 200,
          margin: 2,
          color: { dark: "#1e293b", light: "#ffffff" },
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
    link.download = `QR_${catalogNumber || inventoryId}.png`;
    link.click();
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow || !dataUrl) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>재고 QR 라벨 — ${productName}</title>
          <style>
            @page { size: 80mm 60mm; margin: 4mm; }
            body {
              margin: 0;
              font-family: 'Malgun Gothic', sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
            }
            .label {
              border: 1.5px solid #334155;
              border-radius: 6px;
              padding: 8px 12px;
              display: flex;
              flex-direction: row;
              align-items: center;
              gap: 12px;
              width: 72mm;
              box-sizing: border-box;
            }
            .qr { flex-shrink: 0; }
            .qr img { width: 56px; height: 56px; display: block; }
            .info { flex: 1; overflow: hidden; }
            .name {
              font-size: 9pt;
              font-weight: 700;
              color: #0f172a;
              margin-bottom: 2px;
              word-break: break-word;
            }
            .meta { font-size: 7pt; color: #475569; margin-top: 2px; }
            .id { font-size: 6pt; color: #94a3b8; margin-top: 4px; font-family: monospace; }
          </style>
        </head>
        <body>
          <div class="label">
            <div class="qr"><img src="${dataUrl}" /></div>
            <div class="info">
              <div class="name">${productName}</div>
              ${catalogNumber ? `<div class="meta">Cat#: ${catalogNumber}</div>` : ""}
              ${location ? `<div class="meta">위치: ${location}</div>` : ""}
              ${currentQuantity !== undefined ? `<div class="meta">현재 재고: ${currentQuantity} ${unit || ""}</div>` : ""}
              <div class="id">${inventoryId.slice(0, 16)}…</div>
            </div>
          </div>
          <script>window.onload = () => { window.print(); window.close(); }<\/script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        className="h-8 w-8 p-0 text-slate-500 hover:text-blue-600"
        onClick={() => setOpen(true)}
        title="QR 코드"
      >
        <QrCode className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <QrCode className="h-4 w-4 text-blue-600" />
              재고 QR 코드
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col items-center gap-4 py-2">
            {/* QR 캔버스 */}
            <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-sm">
              <canvas ref={canvasRef} />
            </div>

            {/* 제품 정보 */}
            <div className="w-full bg-slate-50 rounded-lg p-3 space-y-1 text-sm">
              <p className="font-semibold text-slate-800 leading-tight">{productName}</p>
              {catalogNumber && <p className="text-slate-500 text-xs">Cat#: {catalogNumber}</p>}
              {location && <p className="text-slate-500 text-xs">위치: {location}</p>}
              {currentQuantity !== undefined && (
                <p className="text-slate-500 text-xs">현재 재고: {currentQuantity} {unit || ""}</p>
              )}
            </div>

            {/* 액션 버튼 */}
            <div className="flex gap-2 w-full">
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={handleDownload}
                disabled={!dataUrl}
              >
                <Download className="h-4 w-4" />
                PNG 저장
              </Button>
              <Button
                className="flex-1 gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                onClick={handlePrint}
                disabled={!dataUrl}
              >
                <Printer className="h-4 w-4" />
                라벨 인쇄
              </Button>
            </div>

            <p className="text-[10px] text-slate-400 text-center">
              스캔 시 해당 재고 상세페이지로 이동합니다
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
