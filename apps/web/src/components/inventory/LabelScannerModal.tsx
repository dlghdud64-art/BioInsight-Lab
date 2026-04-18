"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { csrfFetch } from "@/lib/api-client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Camera, ScanLine, Type, CheckCircle2, AlertTriangle,
  Loader2, ChevronRight, RotateCcw, Package, FlaskConical,
  X, Sparkles, Upload, FileText, Edit,
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

/** 편집 가능한 추출 데이터 폼 */
export interface SmartReceiveFormData {
  productName: string;
  catalogNumber: string;
  lotNumber: string;
  expirationDate: string;
  quantity: string;
  brand: string;
  casNumber: string;
  unit: string;
}

interface LabelScannerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 스캔 결과를 입고 폼에 전달할 콜백 (기존 호환) */
  onScanComplete?: (result: ScanApiResponse) => void;
  /** 스마트 입고: 모달 내에서 직접 입고 완료 콜백 */
  onDirectReceive?: (data: SmartReceiveFormData, scanResult: ScanApiResponse | null) => void;
}

type ScanStep = "upload" | "scanning" | "review";

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

/* ── 스캔 애니메이션 CSS ── */
const scanAnimationStyle = `
@keyframes scanLine {
  0% { top: 0%; }
  50% { top: 85%; }
  100% { top: 0%; }
}
`;

/* ── 빈 폼 데이터 ── */
function emptyFormData(): SmartReceiveFormData {
  return { productName: "", catalogNumber: "", lotNumber: "", expirationDate: "", quantity: "1", brand: "", casNumber: "", unit: "개" };
}

/* ══════════════════════════════════════════════════════════════ */
/* Content-only export (GlobalModal 통합용)                        */
/* ══════════════════════════════════════════════════════════════ */

/** BaseModal 내부에 렌더링되는 순수 콘텐츠. GlobalModal registry에서 사용. */
export function LabelScannerContent({
  onClose,
  onScanComplete,
  onDirectReceive,
}: {
  onClose?: () => void;
  onScanComplete?: (result: ScanApiResponse) => void;
  onDirectReceive?: (data: SmartReceiveFormData, scanResult: ScanApiResponse | null) => void;
}) {
  return (
    <LabelScannerModal
      open={true}
      onOpenChange={(v) => { if (!v && onClose) onClose(); }}
      onScanComplete={onScanComplete}
      onDirectReceive={onDirectReceive}
      _renderContentOnly
    />
  );
}

/* ══════════════════════════════════════════════════════════════ */
/* 메인 컴포넌트 (기존 호환 유지)                                    */
/* ══════════════════════════════════════════════════════════════ */
export function LabelScannerModal({ open, onOpenChange, onScanComplete, onDirectReceive, _renderContentOnly }: LabelScannerModalProps & { _renderContentOnly?: boolean }) {
  const isMobile = useIsMobile();
  const [step, setStep] = useState<ScanStep>("upload");
  const [scanResult, setScanResult] = useState<ScanApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [formData, setFormData] = useState<SmartReceiveFormData>(emptyFormData());
  const [isDragOver, setIsDragOver] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualText, setManualText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── 리셋 ── */
  const resetState = useCallback(() => {
    setStep("upload");
    setScanResult(null);
    setError(null);
    setPreviewImage(null);
    setFormData(emptyFormData());
    setIsDragOver(false);
    setManualMode(false);
    setManualText("");
  }, []);

  useEffect(() => {
    if (!open) resetState();
  }, [open, resetState]);

  /* ── 폼 필드 변경 ── */
  const updateField = (key: keyof SmartReceiveFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  /* ── ScanApiResponse → 편집 폼 데이터로 매핑 ── */
  const mapScanToForm = (data: ScanApiResponse): SmartReceiveFormData => ({
    productName: data.parsed.productName || data.matchedProduct?.name || "",
    catalogNumber: data.parsed.catalogNo || data.matchedProduct?.catalogNumber || "",
    lotNumber: data.parsed.lotNo || "",
    expirationDate: data.parsed.expirationDate || "",
    quantity: data.parsed.quantity || "1",
    brand: data.parsed.brand || data.matchedProduct?.brand || "",
    casNumber: data.parsed.casNumber || "",
    unit: data.matchedInventory?.unit || "개",
  });

  /* ── 파일 → Gemini API 전송 ── */
  const processFile = async (file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setPreviewImage(base64);
      setStep("scanning");
      setError(null);

      try {
        const res = await csrfFetch("/api/inventory/scan-label", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: base64 }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "분석 실패");
        }

        const data: ScanApiResponse = await res.json();
        setScanResult(data);
        setFormData(mapScanToForm(data));
        setStep("review");
      } catch (err) {
        console.error("[LabelScanner] Gemini parse error:", err);
        setError(err instanceof Error ? err.message : "라벨 분석 중 오류가 발생했습니다");
        setStep("upload");
      }
    };
    reader.readAsDataURL(file);
  };

  /* ── 파일 선택/촬영 ── */
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
    e.target.value = "";
  };

  /* ── 드래그 & 드롭 ── */
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(false); };
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      await processFile(file);
    } else {
      setError("이미지 파일만 업로드할 수 있습니다.");
    }
  };

  /* ── 텍스트 수동 입력 → API ── */
  const submitManualText = async () => {
    if (!manualText.trim()) { setError("라벨 텍스트를 입력해주세요."); return; }
    setStep("scanning");
    setError(null);
    setPreviewImage(null);

    try {
      const res = await csrfFetch("/api/inventory/scan-label", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: manualText.trim() }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "파싱 실패");
      }
      const data: ScanApiResponse = await res.json();
      setScanResult(data);
      setFormData(mapScanToForm(data));
      setStep("review");
    } catch (err) {
      console.error("[LabelScanner] Parse error:", err);
      setError(err instanceof Error ? err.message : "라벨 파싱 중 오류가 발생했습니다");
      setManualMode(true);
      setStep("upload");
    }
  };

  /* ── 입고 완료 (직접 처리) ── */
  const handleDirectReceive = () => {
    if (onDirectReceive) {
      onDirectReceive(formData, scanResult);
    } else if (onScanComplete && scanResult) {
      onScanComplete(scanResult);
    }
    onOpenChange(false);
  };

  /* ── 기존 호환: 입고 폼에 적용 ── */
  const handleApplyToForm = () => {
    if (scanResult && onScanComplete) {
      onScanComplete(scanResult);
    }
    onOpenChange(false);
  };

  /* ═══════════════════════════════════════════════════════════ */
  /* 렌더링                                                      */
  /* ═══════════════════════════════════════════════════════════ */
  const content = (
    <div className="flex flex-col h-full">
      <style>{scanAnimationStyle}</style>

      {/* 히든 파일 인풋 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* ── 탭 인디케이터 ── */}
      <div className="flex border-b border-slate-200 px-4">
        <button
          className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            step === "upload" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-400"
          }`}
          onClick={() => step !== "scanning" && setStep("upload")}
        >
          <Upload className="h-3.5 w-3.5" />
          이미지 업로드
        </button>
        <button
          className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            step === "review" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-400"
          }`}
          disabled={step !== "review"}
        >
          <FileText className="h-3.5 w-3.5" />
          추출된 데이터 확인
        </button>
      </div>

      {/* ═══ Step 1: 업로드 ═══ */}
      {step === "upload" && !manualMode && (
        <div className="flex-1 flex flex-col items-center justify-center gap-5 p-6">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center">
            <ScanLine className="h-7 w-7 text-blue-600" />
          </div>
          <div className="text-center">
            <h3 className="text-base font-bold text-slate-900">스마트 입고 (AI 스캔)</h3>
            <p className="text-sm text-slate-500 mt-1">
              라벨이나 거래명세서를 촬영하면 자동으로 각고를 등록하세요.
            </p>
          </div>

          {/* 드래그 & 드롭 + 클릭 업로드 영역 */}
          <button
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`w-full max-w-sm aspect-[4/3] rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-3 group cursor-pointer ${
              isDragOver
                ? "border-blue-500 bg-blue-100/50 scale-[1.02]"
                : "border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/50"
            }`}
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
              isDragOver ? "bg-blue-200" : "bg-slate-100 group-hover:bg-blue-100"
            }`}>
              <Upload className={`h-6 w-6 ${isDragOver ? "text-blue-600" : "text-slate-400 group-hover:text-blue-500"}`} />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-slate-700">클릭하여 이미지 업로드 또는 촬영</p>
              <p className="text-xs text-slate-400 mt-0.5">시약 병의 라벨이나 앱에서 선명하게 찍어주세요</p>
            </div>
          </button>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 w-full max-w-sm">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <button
            onClick={() => setManualMode(true)}
            className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 transition-colors"
          >
            <Type className="h-3.5 w-3.5" />
            텍스트 직접 입력
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* ═══ 수동 텍스트 입력 모드 ═══ */}
      {step === "upload" && manualMode && (
        <div className="flex-1 flex flex-col gap-4 p-5">
          <div>
            <Label className="text-xs font-semibold text-slate-600 mb-1.5 block">라벨 텍스트</Label>
            <Textarea
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder={`라벨에 보이는 텍스트를 그대로 입력하세요\n\n예시:\nSIGMA-ALDRICH\nSodium Chloride\nCat. No. S9888-500G\nLot No. SLBC1234V\nExp: 2025-12`}
              className="min-h-[160px] text-sm bg-white border-slate-200 focus:border-blue-400 resize-none"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="flex items-center gap-3 mt-auto">
            <Button variant="outline" onClick={() => { setManualMode(false); setError(null); }} className="flex-1">
              뒤로
            </Button>
            <Button
              onClick={submitManualText}
              disabled={!manualText.trim()}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white gap-2"
            >
              <Sparkles className="h-4 w-4" />
              분석하기
            </Button>
          </div>
        </div>
      )}

      {/* ═══ Step 2: AI 분석 중 (로딩) ═══ */}
      {step === "scanning" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
          {previewImage ? (
            <div className="relative w-full max-w-sm rounded-xl overflow-hidden border border-slate-200">
              <img src={previewImage} alt="스캔 중인 라벨" className="w-full object-cover" />
              <div
                className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent shadow-[0_0_8px_2px_rgba(59,130,246,0.5)]"
                style={{ animation: "scanLine 2s ease-in-out infinite", top: "0%" }}
              />
              <div className="absolute inset-0 bg-blue-600/5" />
            </div>
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center">
              <Loader2 className="h-7 w-7 text-blue-600 animate-spin" />
            </div>
          )}
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-900">AI가 라벨을 분석하고 있습니다...</p>
            <p className="text-xs text-slate-500 mt-1">제품명, 카탈로그 번호, Lot, 유효기간, 수량을 추출 중</p>
          </div>
        </div>
      )}

      {/* ═══ Step 3: 검토 및 수정 (편집 가능 폼) ═══ */}
      {step === "review" && (
        <div className="flex-1 flex flex-col gap-4 p-5 overflow-y-auto">
          {/* 스캔 이미지 미니 프리뷰 + AI 상태 */}
          <div className="flex items-center gap-3">
            {previewImage && (
              <div className="relative w-14 h-14 rounded-lg overflow-hidden border border-slate-200 shrink-0">
                <img src={previewImage} alt="스캔된 라벨" className="w-full h-full object-cover" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <p className="text-sm font-semibold text-slate-900">AI 분석 완료</p>
                {scanResult && <ConfidenceBadge level={scanResult.parsed.confidence} />}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                추출된 데이터를 확인하고 필요 시 수정하세요
              </p>
            </div>
          </div>

          {/* DB 매칭 정보 */}
          {scanResult?.matchedProduct && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Package className="h-3.5 w-3.5 text-emerald-600" />
                <span className="text-xs font-semibold text-emerald-700">DB 매칭: {scanResult.matchedProduct.name}</span>
              </div>
            </div>
          )}

          {/* 동일 Lot 경고 */}
          {scanResult?.matchedInventory && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                <span className="text-xs text-amber-700">
                  동일 Lot 재고 존재 (현재: {scanResult.matchedInventory.currentQuantity} {scanResult.matchedInventory.unit}) — 입고 시 추가됩니다
                </span>
              </div>
            </div>
          )}

          {/* ── 편집 가능한 폼 ── */}
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-medium text-slate-600">제품명</Label>
              <Input
                value={formData.productName}
                onChange={(e) => updateField("productName", e.target.value)}
                placeholder="예: Sodium Chloride"
                className="mt-1 h-9 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium text-slate-600">카탈로그 번호</Label>
                <Input
                  value={formData.catalogNumber}
                  onChange={(e) => updateField("catalogNumber", e.target.value)}
                  placeholder="Cat. No."
                  className="mt-1 h-9 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs font-medium text-slate-600">Lot 번호</Label>
                <Input
                  value={formData.lotNumber}
                  onChange={(e) => updateField("lotNumber", e.target.value)}
                  placeholder="Lot No."
                  className="mt-1 h-9 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium text-slate-600">유효기간</Label>
                <Input
                  type="date"
                  value={formData.expirationDate}
                  onChange={(e) => updateField("expirationDate", e.target.value)}
                  className="mt-1 h-9 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs font-medium text-slate-600">수량</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    type="number"
                    min="0"
                    value={formData.quantity}
                    onChange={(e) => updateField("quantity", e.target.value)}
                    className="h-9 text-sm flex-1"
                  />
                  <Input
                    value={formData.unit}
                    onChange={(e) => updateField("unit", e.target.value)}
                    placeholder="단위"
                    className="h-9 text-sm w-16"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium text-slate-600">제조사</Label>
                <Input
                  value={formData.brand}
                  onChange={(e) => updateField("brand", e.target.value)}
                  placeholder="제조사명"
                  className="mt-1 h-9 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs font-medium text-slate-600">CAS 번호</Label>
                <Input
                  value={formData.casNumber}
                  onChange={(e) => updateField("casNumber", e.target.value)}
                  placeholder="CAS No."
                  className="mt-1 h-9 text-sm"
                />
              </div>
            </div>
          </div>

          {/* ── 액션 버튼 ── */}
          <div className="flex items-center gap-3 mt-auto pt-3 border-t border-slate-100">
            <Button variant="outline" onClick={resetState} className="gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" />
              다시 스캔
            </Button>
            <Button
              onClick={onDirectReceive ? handleDirectReceive : handleApplyToForm}
              disabled={!formData.productName.trim()}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white gap-2"
            >
              <CheckCircle2 className="h-4 w-4" />
              {onDirectReceive ? "입고 완료" : "입고 폼에 적용"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  /* ── GlobalModal 통합 모드: content만 반환 ── */
  if (_renderContentOnly) return content;

  /* ── 모바일: Sheet / 데스크탑: Dialog ── */
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[90vh] rounded-t-2xl p-0 bg-white text-slate-900">
          <SheetHeader className="px-4 pt-4 pb-2">
            <SheetTitle className="text-base font-bold text-slate-900">스마트 입고 (AI 스캔)</SheetTitle>
          </SheetHeader>
          {content}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 gap-0 bg-white text-slate-900 border-slate-200 z-[60]">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
            <ScanLine className="h-4 w-4 text-blue-600" />
            스마트 입고 (AI 스캔)
          </DialogTitle>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}
