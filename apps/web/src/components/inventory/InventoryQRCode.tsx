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
    const printWindow = window.open("", "_blank", "width=560,height=460");
    if (!printWindow || !dataUrl) return;

    // productName XSS 방어 (print window는 innerHTML 삽입)
    const esc = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="ko">
        <head>
          <meta charset="UTF-8" />
          <title>QR 라벨 — ${esc(productName)}</title>
          <style>
            /* ━━ 브라우저 Header/Footer 완전 제거 ━━━━━━━━━━━━━━━━━━━━ */
            @page {
              size: 60mm 40mm;   /* 범용 감열 라벨 규격 (폼텍 OA / 롤 프린터) */
              margin: 0mm;       /* 상하좌우 0 → URL·날짜 헤더 제거         */
            }

            /* ━━ 리셋 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
            *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

            /* ━━ 라벨 컨테이너 공통 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
            .label-container {
              width: 60mm;
              height: 40mm;
              overflow: hidden;
              display: flex;
              flex-direction: row;
              align-items: center;
              padding: 3mm 3.5mm;
              gap: 3mm;
            }
            .qr-col         { flex-shrink: 0; }
            .qr-col img     { width: 29mm; height: 29mm; display: block; }
            .info-col       { flex: 1; min-width: 0; overflow: hidden; display: flex; flex-direction: column; }
            .prod-name {
              font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif;
              font-size: 7.5pt;
              font-weight: 700;
              color: #0f172a;
              line-height: 1.3;
              word-break: break-all;
              display: -webkit-box;
              -webkit-line-clamp: 2;
              -webkit-box-orient: vertical;
              overflow: hidden;
              margin-bottom: 1.2mm;
            }
            .meta-row {
              font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif;
              font-size: 6pt;
              color: #475569;
              margin-top: 0.6mm;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .inv-id {
              font-family: 'Courier New', monospace;
              font-size: 5pt;
              color: #94a3b8;
              margin-top: 1.5mm;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }

            /* ━━ 화면(Screen) 미리보기 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
            @media screen {
              html, body {
                background: #f1f5f9;
                min-height: 100vh;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 20px;
                font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif;
                padding: 32px;
              }
              .screen-hint {
                font-size: 13px;
                color: #64748b;
                text-align: center;
                line-height: 1.6;
              }
              .label-container {
                background: #ffffff;
                border: 1px solid #cbd5e1;
                border-radius: 6px;
                box-shadow: 0 6px 24px rgba(0,0,0,0.12), 0 1px 6px rgba(0,0,0,0.07);
              }
              .btn-row { display: flex; gap: 10px; }
              .btn-print {
                padding: 10px 28px;
                background: #2563eb;
                color: #fff;
                border: none;
                border-radius: 8px;
                font-size: 14px;
                font-family: inherit;
                cursor: pointer;
                letter-spacing: 0.02em;
                transition: background 0.15s;
              }
              .btn-print:hover { background: #1d4ed8; }
              .btn-close {
                padding: 10px 20px;
                background: transparent;
                color: #64748b;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                font-size: 13px;
                font-family: inherit;
                cursor: pointer;
              }
            }

            /* ━━ 인쇄(Print): 라벨만 남기고 나머지 숨김 ━━━━━━━━━━━━━━ */
            @media print {
              .screen-hint,
              .btn-row        { display: none !important; }

              html, body {
                margin: 0 !important;
                padding: 0 !important;
                background: transparent !important;
                width: 60mm !important;
                height: 40mm !important;
              }
              .label-container {
                background: #ffffff !important;
                box-shadow: none !important;
                border: none !important;
                border-radius: 0 !important;
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
              }
            }
          </style>
        </head>
        <body>
          <p class="screen-hint">
            📄 인쇄 미리보기 &nbsp;—&nbsp; 규격: <strong>60 × 40 mm</strong><br />
            <span style="font-size:11px;">범용 감열 라벨 / 폼텍 OA 라벨 호환</span>
          </p>

          <div class="label-container">
            <div class="qr-col">
              <img src="${dataUrl}" alt="QR Code" />
            </div>
            <div class="info-col">
              <div class="prod-name">${esc(productName)}</div>
              ${catalogNumber ? `<div class="meta-row">Cat#: ${esc(catalogNumber)}</div>` : ""}
              ${location     ? `<div class="meta-row">📍 ${esc(location)}</div>`         : ""}
              ${currentQuantity !== undefined
                ? `<div class="meta-row">재고: ${currentQuantity}${unit ? ` ${esc(unit)}` : ""}</div>`
                : ""}
              <div class="inv-id">${esc(inventoryId.slice(0, 20))}…</div>
            </div>
          </div>

          <div class="btn-row">
            <button class="btn-print" onclick="window.print()">🖨️ 인쇄하기</button>
            <button class="btn-close" onclick="window.close()">닫기</button>
          </div>
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
