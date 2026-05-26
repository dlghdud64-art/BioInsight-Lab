"use client";

/**
 * §11.309d #smart-receiving-scanner-modal — 스마트 입고 카메라/갤러리 스캔 모달.
 *
 * 호영님 P0 spec (2026-05-26) — backend MVP Phase D:
 *   1. 사용자가 카메라/갤러리에서 거래명세서 또는 라벨 이미지 선택
 *   2. POST /api/quotes/parse-image (§11.290 OCR pipeline) → ParsedQuoteDocument
 *   3. 추출 결과 form 표시 (모든 필드 사용자 수정 가능)
 *   4. [입고 등록] → POST /api/inventory/smart-receiving (§11.309c) → 신규 Product +
 *      ProductInventory + InventoryRestock create + 재고 갱신
 *   5. 성공 시 toast + close
 *
 * MVP scope:
 *   - 신규 등록 분기만 (inventoryId 안 보냄) — server side product 신규 create
 *   - 기존 매칭 분기 (catalog 검색 + fuzzy 후보 표시) 는 §11.309d-2 후속
 *   - 거래명세서 다수 품목 일괄 입고 는 §11.309e 후속
 *
 * 패턴 정합 (QuoteScannerModal §11.290 Phase 4c 복제):
 *   - Dialog + step state (upload / scanning / review / submitting / success / error)
 *   - file → base64 → /api/quotes/parse-image
 *   - ProviderBadge + ConfidenceBadge + CacheHitIndicator
 *
 * dead button 0 — 모든 CTA real handler wiring.
 * 호영님 §11.308a-v2 placeholder modal 의 실제 동작 swap 대상.
 */

import { useState, useRef } from "react";
import { csrfFetch } from "@/lib/api-client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  ScanLine,
  Upload,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  X,
  Camera,
  ArrowRight,
} from "lucide-react";
import type { QuoteParseResult, ParsedQuoteDocument } from "@/lib/ocr/gemini-quote-parser";

/* ── /api/quotes/parse-image response (QuoteScannerModal §11.290 패턴 정합) ── */
interface QuoteScanApiResponse extends QuoteParseResult {
  success: boolean;
  ocrMetadata?: {
    jobId: string | null;
    providerUsed: "GEMINI" | "CLOUD_VISION_CLAUDE" | "REGEX";
    cached: boolean;
  } | null;
}

/* ── /api/inventory/smart-receiving response (§11.309c 정합) ── */
interface SmartReceivingApiResponse {
  inventoryId?: string;
  inventoryRestockId?: string;
  productId?: string;
  quantity?: number;
  isNew?: boolean;
  error?: string;
}

/* ── 사용자 확인 form state (Product + Restock 합쳐서 single form) ── */
interface ConfirmedFormState {
  productName: string;
  brand: string;
  catalogNumber: string;
  lotNumber: string;
  expirationDate: string; // YYYY-MM-DD or YYYY-MM
  quantity: number;
  unit: string;
  storageCondition: string;
  notes: string;
}

const EMPTY_FORM: ConfirmedFormState = {
  productName: "",
  brand: "",
  catalogNumber: "",
  lotNumber: "",
  expirationDate: "",
  quantity: 1,
  unit: "",
  storageCondition: "",
  notes: "",
};

function ConfidenceBadge({ level }: { level: "high" | "medium" | "low" }) {
  if (level === "high") {
    return (
      <Badge className="bg-emerald-100 text-emerald-700 border-0 text-[10px]">
        높은 신뢰도
      </Badge>
    );
  }
  if (level === "medium") {
    return (
      <Badge className="bg-yellow-100 text-yellow-700 border-0 text-[10px]">
        보통 신뢰도
      </Badge>
    );
  }
  return (
    <Badge className="bg-red-100 text-red-700 border-0 text-[10px]">
      낮은 신뢰도
    </Badge>
  );
}

function ProviderBadge({
  provider,
}: {
  provider: "GEMINI" | "CLOUD_VISION_CLAUDE" | "REGEX";
}) {
  const label =
    provider === "GEMINI"
      ? "Gemini"
      : provider === "CLOUD_VISION_CLAUDE"
        ? "Vision+Claude"
        : "정규식";
  return (
    <Badge
      className="bg-slate-100 text-slate-700 border-0 text-[10px]"
      data-testid="ocr-provider-badge"
    >
      {label}
    </Badge>
  );
}

function CacheHitIndicator() {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
      <RotateCcw className="h-3 w-3" />
      캐시 적중
    </span>
  );
}

/** OCR 결과 ParsedQuoteDocument → form state initial 값 추출 (첫 번째 item 우선). */
function extractInitialForm(doc: ParsedQuoteDocument): ConfirmedFormState {
  const firstItem = doc.items[0];
  if (!firstItem) {
    return {
      ...EMPTY_FORM,
      brand: doc.vendor?.name ?? "",
    };
  }
  return {
    productName: firstItem.productName ?? "",
    brand: doc.vendor?.name ?? "",
    catalogNumber: firstItem.catalogNumber ?? "",
    lotNumber: "",
    expirationDate: doc.validUntil ?? "",
    quantity: firstItem.quantity > 0 ? firstItem.quantity : 1,
    unit: firstItem.unit ?? "",
    storageCondition: "",
    notes: firstItem.notes ?? "",
  };
}

interface SmartReceivingScannerModalProps {
  open: boolean;
  onClose: () => void;
  /** 입고 등록 성공 시 호출 — caller (Header / inventory) 가 React Query invalidate 등. */
  onReceivingRegistered?: (result: SmartReceivingApiResponse) => void;
  /** organizationId — 신규 ProductInventory 의 org 격리용 (caller 가 현재 org 주입). */
  organizationId?: string | null;
}

type ScanStep = "upload" | "scanning" | "review" | "submitting" | "success" | "error";

export function SmartReceivingScannerModal({
  open,
  onClose,
  onReceivingRegistered,
  organizationId,
}: SmartReceivingScannerModalProps) {
  const [step, setStep] = useState<ScanStep>("upload");
  const [scanResult, setScanResult] = useState<QuoteScanApiResponse | null>(null);
  const [form, setForm] = useState<ConfirmedFormState>(EMPTY_FORM);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep("upload");
    setScanResult(null);
    setForm(EMPTY_FORM);
    setErrorMessage(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setStep("scanning");
    setErrorMessage(null);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64 = reader.result as string;
        try {
          const response = await csrfFetch("/api/quotes/parse-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageBase64: base64 }),
          });
          const data: QuoteScanApiResponse = await response.json();
          if (!response.ok || !data.success) {
            throw new Error((data as { error?: string })?.error || "거래명세서 파싱 실패");
          }
          setScanResult(data);
          setForm(extractInitialForm(data.parsed));
          setStep("review");
        } catch (err) {
          const msg = err instanceof Error ? err.message : "거래명세서 파싱 중 오류 발생";
          setErrorMessage(msg);
          setStep("error");
        }
      };
      reader.onerror = () => {
        setErrorMessage("이미지 파일을 읽을 수 없습니다.");
        setStep("error");
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "거래명세서 파싱 중 오류 발생";
      setErrorMessage(msg);
      setStep("error");
    }
  };

  const handleSubmit = async () => {
    if (!scanResult?.ocrMetadata?.jobId) {
      setErrorMessage("ocrJobId 가 없어 입고 등록할 수 없습니다. 다시 스캔해 주세요.");
      setStep("error");
      return;
    }
    if (!form.productName.trim()) {
      toast.error("품목명을 입력해 주세요.");
      return;
    }
    if (form.quantity <= 0) {
      toast.error("수량은 0보다 커야 합니다.");
      return;
    }

    setStep("submitting");
    try {
      const response = await csrfFetch("/api/inventory/smart-receiving", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ocrJobId: scanResult.ocrMetadata.jobId,
          organizationId: organizationId ?? null,
          confirmedData: {
            productName: form.productName.trim(),
            brand: form.brand.trim() || null,
            catalogNumber: form.catalogNumber.trim() || null,
            lotNumber: form.lotNumber.trim() || null,
            expirationDate: form.expirationDate || null,
            quantity: form.quantity,
            unit: form.unit.trim() || null,
            storageCondition: form.storageCondition.trim() || null,
            notes: form.notes.trim() || null,
          },
        }),
      });
      const data: SmartReceivingApiResponse = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || "입고 등록 실패");
      }
      onReceivingRegistered?.(data);
      toast.success(
        data.isNew ? "신규 품목 입고 등록 완료" : "기존 재고 입고 추가 완료",
      );
      setStep("success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "입고 등록 중 오류 발생";
      setErrorMessage(msg);
      setStep("error");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) handleClose(); }}>
      <DialogContent
        className="max-w-md sm:max-w-lg max-h-[90vh] overflow-y-auto"
        data-testid="smart-receiving-scanner-modal"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <ScanLine className="h-5 w-5 text-emerald-600" />
            스마트 입고
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-500">
            거래명세서 또는 라벨을 촬영하면 AI 가 자동으로 품목·수량·LOT을 인식해 입고를 처리합니다.
          </DialogDescription>
        </DialogHeader>

        {/* ── Step: upload ── */}
        {step === "upload" && (
          <div className="space-y-4 py-2">
            <p className="text-xs text-slate-600 leading-relaxed">
              JPG/PNG/WebP 이미지를 선택해 주세요. 모바일에서는 카메라 직접 촬영도 가능합니다.
            </p>
            <Button
              type="button"
              data-testid="smart-receiving-upload-cta"
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-12 min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold"
            >
              <Camera className="h-4 w-4 mr-2" />
              사진 선택 / 촬영
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileSelect}
            />
            <p className="text-[10px] text-slate-400 text-center">
              스캔 후 모든 항목을 수정할 수 있습니다.
            </p>
          </div>
        )}

        {/* ── Step: scanning ── */}
        {step === "scanning" && (
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <Loader2 className="h-10 w-10 text-emerald-600 animate-spin" />
            <p className="text-sm font-medium text-slate-700">AI 가 이미지를 분석 중입니다...</p>
            <p className="text-xs text-slate-500">3~5초 소요됩니다.</p>
          </div>
        )}

        {/* ── Step: review (사용자 확인 form) ── */}
        {step === "review" && scanResult && (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2 flex-wrap">
              <ConfidenceBadge level={scanResult.confidence} />
              {scanResult.ocrMetadata?.providerUsed && (
                <ProviderBadge provider={scanResult.ocrMetadata.providerUsed} />
              )}
              {scanResult.ocrMetadata?.cached && <CacheHitIndicator />}
              <span className="text-[10px] text-slate-500">
                {scanResult.itemCount} 품목 인식
              </span>
            </div>

            <div className="space-y-3 bg-slate-50/60 rounded-lg p-3 border border-slate-200">
              <div>
                <Label htmlFor="srm-productName" className="text-xs font-semibold">
                  품목명 <span className="text-rose-600">*</span>
                </Label>
                <Input
                  id="srm-productName"
                  value={form.productName}
                  onChange={(e) => setForm({ ...form, productName: e.target.value })}
                  placeholder="예: Trypsin-EDTA 0.25% 100ml"
                  className="mt-1 h-9 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <Label htmlFor="srm-brand" className="text-xs font-semibold">제조사</Label>
                  <Input
                    id="srm-brand"
                    value={form.brand}
                    onChange={(e) => setForm({ ...form, brand: e.target.value })}
                    placeholder="Thermo Fisher"
                    className="mt-1 h-9 text-sm"
                  />
                </div>
                <div>
                  <Label htmlFor="srm-catalogNumber" className="text-xs font-semibold">Cat.No</Label>
                  <Input
                    id="srm-catalogNumber"
                    value={form.catalogNumber}
                    onChange={(e) => setForm({ ...form, catalogNumber: e.target.value })}
                    placeholder="25200-056"
                    className="mt-1 h-9 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <Label htmlFor="srm-lotNumber" className="text-xs font-semibold">LOT 번호</Label>
                  <Input
                    id="srm-lotNumber"
                    value={form.lotNumber}
                    onChange={(e) => setForm({ ...form, lotNumber: e.target.value })}
                    placeholder="2587934"
                    className="mt-1 h-9 text-sm"
                  />
                </div>
                <div>
                  <Label htmlFor="srm-expirationDate" className="text-xs font-semibold">유효기한</Label>
                  <Input
                    id="srm-expirationDate"
                    type="text"
                    value={form.expirationDate}
                    onChange={(e) => setForm({ ...form, expirationDate: e.target.value })}
                    placeholder="2026-12-31"
                    className="mt-1 h-9 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <Label htmlFor="srm-quantity" className="text-xs font-semibold">
                    수량 <span className="text-rose-600">*</span>
                  </Label>
                  <Input
                    id="srm-quantity"
                    type="number"
                    min={1}
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) || 0 })}
                    className="mt-1 h-9 text-sm"
                  />
                </div>
                <div>
                  <Label htmlFor="srm-unit" className="text-xs font-semibold">단위</Label>
                  <Input
                    id="srm-unit"
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    placeholder="bottle / EA / mL"
                    className="mt-1 h-9 text-sm"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="srm-storageCondition" className="text-xs font-semibold">보관 조건</Label>
                <Input
                  id="srm-storageCondition"
                  value={form.storageCondition}
                  onChange={(e) => setForm({ ...form, storageCondition: e.target.value })}
                  placeholder="-20°C 냉동 보관"
                  className="mt-1 h-9 text-sm"
                />
              </div>

              <div>
                <Label htmlFor="srm-notes" className="text-xs font-semibold">비고</Label>
                <Input
                  id="srm-notes"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="추가 메모 (선택)"
                  className="mt-1 h-9 text-sm"
                />
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <Button
                type="button"
                data-testid="smart-receiving-submit-cta"
                onClick={handleSubmit}
                className="w-full h-11 min-h-[44px] bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold"
              >
                입고 등록
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={reset}
                className="w-full h-9 text-xs text-slate-600 border-slate-200"
              >
                다시 스캔
              </Button>
            </div>
          </div>
        )}

        {/* ── Step: submitting ── */}
        {step === "submitting" && (
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <Loader2 className="h-10 w-10 text-blue-600 animate-spin" />
            <p className="text-sm font-medium text-slate-700">입고 등록 중...</p>
          </div>
        )}

        {/* ── Step: success ── */}
        {step === "success" && (
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <CheckCircle2 className="h-12 w-12 text-emerald-600" />
            <p className="text-base font-semibold text-slate-900">입고 등록 완료</p>
            <p className="text-xs text-slate-500">재고가 자동으로 갱신되었습니다.</p>
            <Button
              type="button"
              data-testid="smart-receiving-success-close"
              onClick={handleClose}
              className="mt-2 h-10 text-sm bg-slate-900 hover:bg-slate-800 text-white"
            >
              닫기
            </Button>
          </div>
        )}

        {/* ── Step: error ── */}
        {step === "error" && (
          <div className="flex flex-col items-center justify-center py-10 space-y-3 px-4">
            <AlertTriangle className="h-10 w-10 text-rose-600" />
            <p className="text-sm font-semibold text-slate-900">오류 발생</p>
            <p className="text-xs text-slate-600 text-center leading-relaxed">
              {errorMessage ?? "알 수 없는 오류"}
            </p>
            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={reset}
                className="h-9 text-xs"
              >
                다시 시도
              </Button>
              <Button
                type="button"
                onClick={handleClose}
                className="h-9 text-xs bg-slate-900 hover:bg-slate-800 text-white"
              >
                닫기
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
