"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Camera, ScanLine, Type, CheckCircle2, AlertTriangle,
  Loader2, ChevronRight, RotateCcw, Package, FlaskConical,
  X, Sparkles,
} from "lucide-react";
import type { LabelParseResult } from "@/lib/ocr/label-parser";

/* ── 타입 ── */
interface ScanApiResponse {
  success: boolean;
  parsed: LabelParseResult;
  matchedProduct: { id: string; name: string; brand: string | null; catalogNumber: string | null } | null;
  matchedInventory: { id: string; lotNumber: string | null; currentQuantity: number; unit: string | null } | null;
  suggestions: {
    isNewProduct: boolean;
    isNewLot: boolean;
    isExistingLot: boolean;
    action: "restock" | "new_lot" | "new_product";
  };
}

interface LabelScannerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 스캔 결과를 입고 폼에 전달할 콜백 */
  onScanComplete?: (result: ScanApiResponse) => void;
}

type ScanStep = "choose" | "camera" | "text" | "scanning" | "result";

/* ── 모바일 판별 ── */
function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    setMobile(window.innerWidth < 768);
    const handler = () => setMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return mobile;
}

/* ── 신뢰도 뱃지 ── */
function ConfidenceBadge({ level }: { level: "high" | "medium" | "low" }) {
  if (level === "high") return <Badge className="bg-emerald-100 text-emerald-700 border-0 text-[10px]">높은 신뢰도</Badge>;
  if (level === "medium") return <Badge className="bg-amber-100 text-amber-700 border-0 text-[10px]">보통 신뢰도</Badge>;
  return <Badge className="bg-red-100 text-red-700 border-0 text-[10px]">낮은 신뢰도</Badge>;
}

/* ── 메인 컴포넌트 ── */
export function LabelScannerModal({ open, onOpenChange, onScanComplete }: LabelScannerModalProps) {
  const isMobile = useIsMobile();
  const [step, setStep] = useState<ScanStep>("choose");
  const [manualText, setManualText] = useState("");
  const [scanResult, setScanResult] = useState<ScanApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 카메라
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  /* ── 리셋 ── */
  const resetState = useCallback(() => {
    setStep("choose");
    setManualText("");
    setScanResult(null);
    setError(null);
    setCapturedImage(null);
    stopCamera();
  }, []);

  useEffect(() => {
    if (!open) resetState();
  }, [open, resetState]);

  /* ── 카메라 ── */
  const startCamera = async () => {
    setStep("camera");
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err) {
      console.error("[LabelScanner] Camera error:", err);
      setError("카메라에 접근할 수 없습니다. 권한을 확인해주세요.");
      setStep("choose");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);

    const imageData = canvas.toDataURL("image/jpeg", 0.85);
    setCapturedImage(imageData);
    stopCamera();

    // 현재는 이미지 OCR 미지원 → 텍스트 입력으로 유도
    // 향후: imageData를 API에 전송하여 서버사이드 OCR 수행
    setStep("text");
  };

  /* ── API 호출 ── */
  const submitForParsing = async (text: string) => {
    if (!text.trim()) {
      setError("라벨 텍스트를 입력해주세요.");
      return;
    }
    setStep("scanning");
    setError(null);

    try {
      const res = await fetch("/api/inventory/scan-label", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim() }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "파싱 실패");
      }

      const data: ScanApiResponse = await res.json();
      setScanResult(data);
      setStep("result");
    } catch (err) {
      console.error("[LabelScanner] Parse error:", err);
      setError(err instanceof Error ? err.message : "라벨 파싱 중 오류가 발생했습니다");
      setStep("text");
    }
  };

  /* ── 결과 적용 ── */
  const handleApplyResult = () => {
    if (scanResult && onScanComplete) {
      onScanComplete(scanResult);
    }
    onOpenChange(false);
  };

  /* ── 렌더링 내용 ── */
  const content = (
    <div className="flex flex-col h-full">
      {/* 선택 화면 */}
      {step === "choose" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center">
            <ScanLine className="h-8 w-8 text-blue-600" />
          </div>
          <div className="text-center">
            <h3 className="text-lg font-bold text-slate-900">시약 라벨 스캔</h3>
            <p className="text-sm text-slate-500 mt-1">
              시약 라벨을 촬영하거나 텍스트를 입력하면<br />
              입고 폼이 자동으로 채워집니다
            </p>
          </div>
          <div className="w-full max-w-sm space-y-3">
            <button
              onClick={startCamera}
              className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all group"
            >
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                <Camera className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold text-slate-900">카메라로 촬영</p>
                <p className="text-xs text-slate-500">시약 라벨을 카메라로 찍으세요</p>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </button>

            <button
              onClick={() => setStep("text")}
              className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 transition-all group"
            >
              <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center group-hover:bg-slate-200 transition-colors">
                <Type className="h-5 w-5 text-slate-600" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold text-slate-900">텍스트 직접 입력</p>
                <p className="text-xs text-slate-500">라벨 정보를 직접 타이핑하세요</p>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </button>
          </div>
        </div>
      )}

      {/* 카메라 화면 */}
      {step === "camera" && (
        <div className="flex-1 flex flex-col">
          <div className="relative flex-1 bg-black rounded-lg overflow-hidden min-h-[300px]">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
              autoPlay
            />
            {/* 가이드 오버레이 */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-[80%] h-[60%] border-2 border-white/50 rounded-lg" />
            </div>
            <p className="absolute bottom-4 left-0 right-0 text-center text-white/80 text-xs">
              라벨이 사각형 안에 들어오게 맞추세요
            </p>
          </div>
          <canvas ref={canvasRef} className="hidden" />
          <div className="flex items-center gap-3 p-4">
            <Button variant="outline" onClick={() => { stopCamera(); setStep("choose"); }} className="flex-1">
              취소
            </Button>
            <Button onClick={capturePhoto} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white gap-2">
              <Camera className="h-4 w-4" />
              촬영
            </Button>
          </div>
        </div>
      )}

      {/* 텍스트 입력 화면 */}
      {step === "text" && (
        <div className="flex-1 flex flex-col gap-4 p-4">
          {capturedImage && (
            <div className="relative rounded-lg overflow-hidden border border-slate-200">
              <img src={capturedImage} alt="촬영된 라벨" className="w-full h-32 object-cover" />
              <div className="absolute top-2 right-2">
                <Button size="sm" variant="secondary" onClick={() => setCapturedImage(null)} className="h-7 w-7 p-0">
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                <p className="text-white text-xs">촬영 완료 — 아래에 라벨 텍스트를 입력해주세요</p>
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">라벨 텍스트</label>
            <Textarea
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder={`라벨에 보이는 텍스트를 그대로 입력하세요\n\n예시:\nSIGMA-ALDRICH\nSodium Chloride\nCat. No. S9888-500G\nLot No. SLBC1234V\nExp: 2025-12\nCAS 7647-14-5`}
              className="min-h-[180px] text-sm bg-white border-slate-200 focus:border-blue-400 resize-none"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="flex items-center gap-3 mt-auto">
            <Button variant="outline" onClick={() => { setCapturedImage(null); setStep("choose"); }} className="flex-1">
              뒤로
            </Button>
            <Button
              onClick={() => submitForParsing(manualText)}
              disabled={!manualText.trim()}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white gap-2"
            >
              <Sparkles className="h-4 w-4" />
              분석하기
            </Button>
          </div>
        </div>
      )}

      {/* 분석 중 */}
      {step === "scanning" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center">
            <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-900">라벨 정보 분석 중...</p>
            <p className="text-xs text-slate-500 mt-1">제품번호, Lot, 유통기한을 추출하고 있습니다</p>
          </div>
        </div>
      )}

      {/* 결과 화면 */}
      {step === "result" && scanResult && (
        <div className="flex-1 flex flex-col gap-4 p-4 overflow-y-auto">
          {/* 상태 헤더 */}
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              scanResult.matchedProduct ? "bg-emerald-100" : "bg-blue-100"
            }`}>
              {scanResult.matchedProduct
                ? <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                : <FlaskConical className="h-5 w-5 text-blue-600" />
              }
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-slate-900">
                  {scanResult.matchedProduct ? "기존 제품 매칭됨" : "새 제품으로 등록"}
                </p>
                <ConfidenceBadge level={scanResult.parsed.confidence} />
              </div>
              <p className="text-xs text-slate-500">
                {scanResult.parsed.matchedFields}개 필드 인식됨
                {scanResult.matchedInventory && " · 기존 Lot 재고 발견"}
              </p>
            </div>
          </div>

          {/* 매칭된 제품 정보 */}
          {scanResult.matchedProduct && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
              <div className="flex items-center gap-2 mb-1">
                <Package className="h-3.5 w-3.5 text-emerald-600" />
                <span className="text-xs font-semibold text-emerald-700">DB 매칭 결과</span>
              </div>
              <p className="text-sm font-medium text-slate-900">{scanResult.matchedProduct.name}</p>
              <p className="text-xs text-slate-500">
                {scanResult.matchedProduct.brand} · {scanResult.matchedProduct.catalogNumber}
              </p>
            </div>
          )}

          {/* 추출된 필드 */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">추출된 정보</p>
            <div className="rounded-lg border border-slate-200 divide-y divide-slate-100">
              {[
                { label: "제품명", value: scanResult.parsed.productName },
                { label: "제조사", value: scanResult.parsed.brand },
                { label: "카탈로그 번호", value: scanResult.parsed.catalogNo },
                { label: "Lot 번호", value: scanResult.parsed.lotNo },
                { label: "유통기한", value: scanResult.parsed.expirationDate },
                { label: "CAS 번호", value: scanResult.parsed.casNumber },
                { label: "용량", value: scanResult.parsed.quantity },
              ].filter((f) => f.value).map((field) => (
                <div key={field.label} className="flex items-center justify-between px-3 py-2">
                  <span className="text-xs text-slate-500">{field.label}</span>
                  <span className="text-sm font-medium text-slate-900">{field.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 기존 재고 발견 시 */}
          {scanResult.matchedInventory && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                <span className="text-xs font-semibold text-amber-700">동일 Lot 재고 존재</span>
              </div>
              <p className="text-xs text-slate-600">
                현재 재고: {scanResult.matchedInventory.currentQuantity} {scanResult.matchedInventory.unit}
                — 입고 처리 시 기존 수량에 추가됩니다
              </p>
            </div>
          )}

          {/* 액션 */}
          <div className="flex items-center gap-3 mt-auto pt-2">
            <Button variant="outline" onClick={resetState} className="gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" />
              다시 스캔
            </Button>
            <Button
              onClick={handleApplyResult}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white gap-2"
            >
              <CheckCircle2 className="h-4 w-4" />
              입고 폼에 적용
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  /* ── 모바일: Sheet / 데스크탑: Dialog ── */
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[90vh] rounded-t-2xl p-0">
          <SheetHeader className="px-4 pt-4 pb-2">
            <SheetTitle className="text-base">라벨 스캔</SheetTitle>
          </SheetHeader>
          {content}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 gap-0">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="text-base">라벨 스캔</DialogTitle>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}
