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
// §11.253b-1 — RelativeTimeText hydration-safe helper reuse (§11.212 lineage)
//   "X분 전" / "X시간 전" 표시 — conflict banner 시간 정보 ⑤.
import { RelativeTimeText } from "@/components/ui/relative-time-text";
// §11.253b-3 — 본인 다른 탭 detection (case 1). BroadcastChannel 으로 같은
//   origin 의 다른 탭이 동일 productId/lotNumber 작업 중인지 감지. backend 0.
import { useInventoryEditBroadcast } from "@/hooks/use-inventory-edit-broadcast";

/* ── 타입 ── */
interface ScanApiResponse {
  success: boolean;
  parsed: LabelParseResult;
  matchedProduct: { id: string; name: string; brand: string | null; catalogNumber: string | null } | null;
  // §11.253b-1 — matchedInventory shape 확장: updatedAt (시간 정보 ⑤) +
  //   user.name (행위자 ③). RelativeTimeText 가 ISO string 받으므로 updatedAt
  //   string serialized (Date → JSON.stringify Date → ISO string).
  matchedInventory: {
    id: string;
    lotNumber: string | null;
    currentQuantity: number;
    unit: string | null;
    updatedAt: string;
    user: { name: string | null } | null;
  } | null;
  // §11.290 Phase 4b — OCR pipeline metadata (provider / cache / jobId).
  // null = regex fallback path (text-only input, image 미사용).
  ocrMetadata?: {
    jobId: string | null;
    providerUsed: "GEMINI" | "CLOUD_VISION_CLAUDE" | "REGEX";
    cached: boolean;
  } | null;
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
  /** §11.315-b — 스마트 재고 등록: 모달 내에서 직접 등록 완료 콜백 (라벨 OCR → 재고 직접 추가, PO 없음). */
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
  if (level === "medium") return <Badge className="bg-yellow-100 text-yellow-700 border-0 text-[10px]">보통 신뢰도</Badge>;
  return <Badge className="bg-red-100 text-red-700 border-0 text-[10px]">낮은 신뢰도</Badge>;
}

/* ── §11.290 Phase 4b — OCR Provider 뱃지 ──
 *  multi-provider fallback 결과 시각화. GEMINI (Tier 1 primary) /
 *  CLOUD_VISION_CLAUDE (Tier 2 fallback) / REGEX (Tier 3 fallback).
 *  STORAGE_PROVIDER 미설정 (현재 production) 시 GEMINI 기본값.
 */
function ProviderBadge({ provider }: { provider: "GEMINI" | "CLOUD_VISION_CLAUDE" | "REGEX" }) {
  const pathLabel =
    provider === "GEMINI"
      ? "Gemini T1"
      : provider === "CLOUD_VISION_CLAUDE"
        ? "Cloud Vision T2 (Claude 구조화)"
        : "정규식 T3";
  const fallbackActive = provider !== "GEMINI";
  return (
    <>
      <Badge
        className="bg-slate-100 text-slate-700 border-0 text-[10px]"
        data-testid="ocr-provider-badge"
      >
        사용 경로: {pathLabel}
      </Badge>
      <Badge
        className={fallbackActive
          ? "bg-yellow-100 text-yellow-700 border-0 text-[10px]"
          : "bg-emerald-100 text-emerald-700 border-0 text-[10px]"}
        data-testid="ocr-fallback-badge"
      >
        폴백: {fallbackActive ? "활성" : "비활성"}
      </Badge>
    </>
  );
}

/* ── §11.290 Phase 4b — Cache Hit 표시 ──
 *  imageHash 기반 cache lookup 적중 시 API 호출 0. 비용 절감 + UX 개선.
 *  Phase 1 schema OcrJob.imageHash @@index + Phase 2 findCachedOcrJob 활용.
 */
function CacheHitIndicator() {
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] text-slate-500"
      data-testid="ocr-cache-hit"
    >
      <RotateCcw className="h-3 w-3" />
      캐시 적중
    </span>
  );
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
  // §11.253 — 충돌 경고 acknowledge state. matchedInventory 존재 (case 3: 이미
  // 등록된 Lot 중복) 시 conflict banner 노출. 사용자 [그래도 진행] click → ack=true
  // → banner hide. [취소] click → onOpenChange(false) 모달 닫기. scanResult 변경
  // (재스캔) 또는 모달 close 시 자동 reset.
  const [conflictAck, setConflictAck] = useState(false);
  // §11.253b-3 — 본인 다른 탭 detection (case 1). BroadcastChannel hook.
  // scanResult 가 matchedInventory 보유 시 broadcast 발화. 다른 탭에서 같은
  // productId/lotNumber 작업 중이면 otherTabActive=true → Info banner 노출.
  const { otherTabActive, broadcast: broadcastEdit, acknowledge: acknowledgeOtherTab } =
    useInventoryEditBroadcast();
  useEffect(() => {
    if (!open) return;
    const matched = scanResult?.matchedInventory;
    const product = scanResult?.matchedProduct;
    if (!matched || !product) return;
    broadcastEdit(product.id, matched.lotNumber);
  }, [open, scanResult, broadcastEdit]);
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
    setConflictAck(false);
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
            <h3 className="text-base font-bold text-slate-900">스마트 재고 등록 (AI 라벨 스캔)</h3>
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
              {/* §11.290 Phase 4b — confidence badge + provider badge + cache hit
                  indicator. multi-provider fallback 결과 + cache lookup 적중 시각화. */}
              <div className="flex items-center gap-2 flex-wrap">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <p className="text-sm font-semibold text-slate-900">AI 분석 완료</p>
                {scanResult && <ConfidenceBadge level={scanResult.parsed.confidence} />}
                {scanResult?.ocrMetadata?.providerUsed && (
                  <ProviderBadge provider={scanResult.ocrMetadata.providerUsed} />
                )}
                {scanResult?.ocrMetadata?.cached && <CacheHitIndicator />}
                {/* §11.290 Phase 4e — retry button (provider swap 재처리).
                    jobId null (STORAGE_PROVIDER 미설정 = Phase 5 이전) 시 disabled.
                    503 graceful response 시 alert. Phase 5 SDK install + Vercel env
                    설정 후 실제 multi-provider fallback 자동 활성. */}
                <button
                  type="button"
                  disabled={!scanResult?.ocrMetadata?.jobId}
                  data-testid="ocr-retry-button"
                  onClick={async () => {
                    const jobId = scanResult?.ocrMetadata?.jobId;
                    if (!jobId) return;
                    try {
                      const res = await csrfFetch(`/api/ocr/retry/${jobId}`, {
                        method: "POST",
                      });
                      const data = await res.json();
                      if (res.status === 503) {
                        alert(data?.error || "재처리는 Phase 5 후 활성됩니다.");
                      } else if (!res.ok) {
                        alert(data?.error || "재처리 실패");
                      } else {
                        // Phase 5 후: 결과로 scanResult 업데이트
                        alert("재처리 완료. (Phase 5 wiring 후 결과 자동 반영)");
                      }
                    } catch (err: any) {
                      alert(`재처리 요청 실패: ${err?.message || "알 수 없는 오류"}`);
                    }
                  }}
                  className="inline-flex items-center gap-1 rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                  title={
                    scanResult?.ocrMetadata?.jobId
                      ? "다른 OCR provider로 재처리"
                      : "재처리는 Phase 5 활성 후 가능"
                  }
                >
                  <RotateCcw className="h-3 w-3" />
                  재처리
                </button>
                {/* §11.290 Phase 4e-2 — correct (수동 보정) button. 사용자가
                    form input 편집한 결과 (formData) 를 correctedFields body 로
                    POST /api/ocr/correct/[jobId]. jobId null 시 disabled.
                    Phase 5 후 실제 OcrResult INSERT (provider=MANUAL,
                    confidence=1.0) + finalResultId update + status SUCCESS. */}
                <button
                  type="button"
                  disabled={!scanResult?.ocrMetadata?.jobId}
                  data-testid="ocr-correct-button"
                  onClick={async () => {
                    const jobId = scanResult?.ocrMetadata?.jobId;
                    if (!jobId) return;
                    try {
                      // formData (SmartReceiveFormData) 를 correctedFields body 로 전송
                      const correctedFields = {
                        productName: formData.productName,
                        catalogNo: formData.catalogNumber,
                        lotNo: formData.lotNumber,
                        expirationDate: formData.expirationDate,
                        brand: formData.brand,
                        casNumber: formData.casNumber,
                        quantity: formData.quantity,
                      };
                      const res = await csrfFetch(`/api/ocr/correct/${jobId}`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ correctedFields }),
                      });
                      const data = await res.json();
                      if (res.status === 503) {
                        alert(data?.error || "수동 보정 저장은 Phase 5 후 활성됩니다.");
                      } else if (!res.ok) {
                        alert(data?.error || "수동 보정 저장 실패");
                      } else {
                        alert("수동 보정 저장 완료. (Phase 5 wiring 후 결과 자동 반영)");
                      }
                    } catch (err: any) {
                      alert(`수동 보정 요청 실패: ${err?.message || "알 수 없는 오류"}`);
                    }
                  }}
                  className="inline-flex items-center gap-1 rounded border border-blue-300 bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                  title={
                    scanResult?.ocrMetadata?.jobId
                      ? "사용자 보정 결과 저장 (Phase 5 후 OcrResult INSERT)"
                      : "수동 보정 저장은 Phase 5 활성 후 가능"
                  }
                >
                  <Edit className="h-3 w-3" />
                  보정 저장
                </button>
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

          {/* §11.253b-3 — case 1 Info banner (본인 다른 탭). BroadcastChannel
              으로 같은 origin 의 다른 탭이 동일 productId/lotNumber 작업 중일 때
              파란 톤 Info 노출. case 3 (red Error) 와 별개 surface — case 1 +
              case 3 동시 가능 (드물지만 사용자 명시 인지 필요). [확인] 후 hide. */}
          {otherTabActive && (
            <div className="rounded-lg border border-blue-200 bg-blue-50/60 px-3 py-2.5">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-blue-600 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-blue-700 mb-0.5 break-keep">
                    다른 탭에서 같은 항목 작업 중입니다
                  </p>
                  <p className="text-[11px] text-blue-600/90 leading-relaxed break-keep">
                    이 탭에서 계속하시겠습니까? 동시에 진행하면 의도하지 않은 중복 입고가 발생할 수 있습니다.
                  </p>
                  <button
                    type="button"
                    onClick={acknowledgeOtherTab}
                    className="mt-2 inline-flex items-center justify-center h-8 px-3 rounded-md border border-blue-200 bg-white text-blue-700 text-xs font-medium hover:bg-blue-50 active:scale-95 transition-all"
                  >
                    확인
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* §11.253 — 충돌 경고 banner 강화 (case 3 = 이미 등록된 Lot 중복).
              호영님 spec 4 요구사항 정합:
                ① 항목 특정 — matchedProduct.name + lotNumber inline 노출.
                ② 작업 유형 — "입고 처리" 명시.
                ④ 액션 — [그래도 진행] / [취소] button 2개.
              톤 — Error (red) — 이미 완료된 입고 항목 중복 시도 case 정합.
              ack 후 (conflictAck === true) banner 자동 hide → 폼 그대로 사용.
              ③ 행위자 / ⑤ 시간 정보 — backend lock infra 필요 (§11.253b 별도 cluster). */}
          {scanResult?.matchedInventory && !conflictAck && (
            <div className="rounded-lg border border-red-200 bg-red-50/60 px-3 py-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-red-700 mb-1 break-keep">
                    이미 등록된 항목에 입고 처리를 시도하고 있습니다
                  </p>
                  <p className="text-[11px] text-red-600/90 leading-relaxed break-keep">
                    <span className="font-medium">{scanResult.matchedProduct?.name ?? "동일 제품"}</span>
                    {" "}— Lot {scanResult.matchedInventory.lotNumber ?? "—"}
                    {" "}(현재 {scanResult.matchedInventory.currentQuantity}{" "}
                    {scanResult.matchedInventory.unit ?? ""})
                    <br />
                    {/* §11.253b-1 — 행위자 ③ + 시간 ⑤ 정보 inline. user.name
                        없으면 "나" fallback (matchedInventory 는 userId session
                        본인 만 매칭 — 같은 사용자의 다른 입력). updatedAt 은
                        RelativeTimeText "X분 전" hydration-safe. */}
                    <span className="font-medium">
                      {scanResult.matchedInventory.user?.name ?? "나"}
                    </span>
                    님이{" "}
                    <RelativeTimeText
                      iso={scanResult.matchedInventory.updatedAt}
                      variant="minute"
                      fallback="이전에"
                    />{" "}
                    마지막으로 수정했습니다.
                    <br />
                    계속 진행 시 기존 재고에 수량이 추가됩니다.
                  </p>
                  <div className="flex items-center gap-2 mt-2.5">
                    <button
                      type="button"
                      onClick={() => setConflictAck(true)}
                      className="inline-flex items-center justify-center h-9 px-3 rounded-md bg-red-600 text-white text-xs font-semibold hover:bg-red-500 active:scale-95 transition-all"
                    >
                      그래도 진행
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenChange(false)}
                      className="inline-flex items-center justify-center h-9 px-3 rounded-md border border-red-200 bg-white text-red-700 text-xs font-medium hover:bg-red-50 active:scale-95 transition-all"
                    >
                      취소
                    </button>
                  </div>
                </div>
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
            <SheetTitle className="text-base font-bold text-slate-900">스마트 재고 등록 (AI 라벨 스캔)</SheetTitle>
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
            스마트 재고 등록 (AI 라벨 스캔)
          </DialogTitle>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}
