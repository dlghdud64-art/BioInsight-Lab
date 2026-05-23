"use client";

/**
 * §11.290 Phase 4c #quote-scanner-modal — QuoteScannerModal NEW (skeleton).
 *
 * 호영님 P1 spec (2026-05-23):
 *   거래명세서 OCR scan trigger 위한 modal. LabelScannerModal Phase 4b 패턴
 *   복제 — ProviderBadge + CacheHitIndicator + ocrMetadata 응답 활용.
 *
 * Lock (Phase 4c skeleton):
 *   - 단순 dialog (upload image → POST /api/quotes/parse-image → result 표시)
 *   - QuoteParseResult shape 노출 (vendor / items / totalAmount 요약)
 *   - ProviderBadge + CacheHitIndicator (LabelScannerModal 와 동일 spec)
 *   - 풀스펙 (review step form 편집 / receiving 자동 매칭) 은 Phase 4c-2 별도
 *
 * Caller (Phase 4c-2):
 *   receiving/[receivingId]/page.tsx 에 trigger button 추가 후 onScanComplete
 *   handler 에서 ParsedQuoteDocument 활용 (vendor 매칭 / PO 자동 생성 등).
 */

import { useState, useRef } from "react";
import { csrfFetch } from "@/lib/api-client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  FileText,
  X,
} from "lucide-react";
import type { QuoteParseResult } from "@/lib/ocr/gemini-quote-parser";

/* ── §11.290 Phase 4c — Response shape ── */
interface QuoteScanApiResponse extends QuoteParseResult {
  success: boolean;
  ocrMetadata?: {
    jobId: string | null;
    providerUsed: "GEMINI" | "CLOUD_VISION_CLAUDE" | "REGEX";
    cached: boolean;
  } | null;
}

/* ── 신뢰도 뱃지 (LabelScannerModal 와 동일 spec) ── */
function ConfidenceBadge({ level }: { level: "high" | "medium" | "low" }) {
  if (level === "high")
    return (
      <Badge className="bg-emerald-100 text-emerald-700 border-0 text-[10px]">
        높은 신뢰도
      </Badge>
    );
  if (level === "medium")
    return (
      <Badge className="bg-yellow-100 text-yellow-700 border-0 text-[10px]">
        보통 신뢰도
      </Badge>
    );
  return (
    <Badge className="bg-red-100 text-red-700 border-0 text-[10px]">
      낮은 신뢰도
    </Badge>
  );
}

/* ── §11.290 Phase 4c — Provider 뱃지 (LabelScannerModal Phase 4b 패턴 복제) ── */
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

/* ── §11.290 Phase 4c — Cache Hit 표시 (LabelScannerModal Phase 4b 패턴 복제) ── */
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

/* ── Props ── */
interface QuoteScannerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 스캔 완료 시 부모에 결과 전달 (receiving 페이지에서 PO 매칭 등 처리). */
  onScanComplete?: (result: QuoteScanApiResponse) => void;
}

type ScanStep = "upload" | "scanning" | "review" | "error";

export function QuoteScannerModal({
  open,
  onOpenChange,
  onScanComplete,
}: QuoteScannerModalProps) {
  const [step, setStep] = useState<ScanStep>("upload");
  const [scanResult, setScanResult] = useState<QuoteScanApiResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep("upload");
    setScanResult(null);
    setErrorMessage(null);
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setStep("scanning");
    setErrorMessage(null);

    try {
      // Image → base64 data URI
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
            throw new Error((data as any)?.error || "거래명세서 파싱 실패");
          }
          setScanResult(data);
          setStep("review");
          onScanComplete?.(data);
        } catch (err: any) {
          setErrorMessage(err?.message || "거래명세서 파싱 중 오류 발생");
          setStep("error");
        }
      };
      reader.onerror = () => {
        setErrorMessage("이미지 파일을 읽을 수 없습니다.");
        setStep("error");
      };
    } catch (err: any) {
      setErrorMessage(err?.message || "거래명세서 파싱 중 오류 발생");
      setStep("error");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md sm:max-w-lg"
        data-testid="quote-scanner-modal"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" />
            거래명세서 스캔
          </DialogTitle>
        </DialogHeader>

        {/* ── Upload Step ── */}
        {step === "upload" && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              거래명세서 이미지(JPG/PNG/WebP)를 업로드하면 AI 가 자동으로
              공급사 / 품목 / 금액을 추출합니다.
            </p>
            <Button
              onClick={() => fileInputRef.current?.click()}
              className="w-full"
              data-testid="quote-scanner-upload-button"
            >
              <Upload className="h-4 w-4 mr-2" />
              이미지 선택
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
              data-testid="quote-scanner-file-input"
            />
          </div>
        )}

        {/* ── Scanning Step ── */}
        {step === "scanning" && (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <p className="text-sm text-slate-600">AI 가 거래명세서를 분석 중...</p>
          </div>
        )}

        {/* ── Review Step ── */}
        {step === "review" && scanResult && (
          <div className="space-y-4">
            {/* §11.290 Phase 4c — confidence + provider + cache hit indicator
                (LabelScannerModal Phase 4b 패턴 동일) */}
            <div className="flex items-center gap-2 flex-wrap">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <p className="text-sm font-semibold text-slate-900">
                AI 분석 완료
              </p>
              <ConfidenceBadge level={scanResult.confidence} />
              {scanResult.ocrMetadata?.providerUsed && (
                <ProviderBadge provider={scanResult.ocrMetadata.providerUsed} />
              )}
              {scanResult.ocrMetadata?.cached && <CacheHitIndicator />}
              {/* §11.290 Phase 4e — retry button (LabelScannerModal Phase 4e 패턴
                  동일). jobId null 시 disabled, 503 graceful alert. */}
              <button
                type="button"
                disabled={!scanResult.ocrMetadata?.jobId}
                data-testid="ocr-retry-button"
                onClick={async () => {
                  const jobId = scanResult.ocrMetadata?.jobId;
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
                      alert("재처리 완료. (Phase 5 wiring 후 결과 자동 반영)");
                    }
                  } catch (err: any) {
                    alert(`재처리 요청 실패: ${err?.message || "알 수 없는 오류"}`);
                  }
                }}
                className="inline-flex items-center gap-1 rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                title={
                  scanResult.ocrMetadata?.jobId
                    ? "다른 OCR provider로 재처리"
                    : "재처리는 Phase 5 활성 후 가능"
                }
              >
                <RotateCcw className="h-3 w-3" />
                재처리
              </button>
            </div>

            {/* 결과 요약 (skeleton — Phase 4c-2 에서 풀스펙 form) */}
            <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs text-slate-500">공급사</div>
              <div className="text-sm font-semibold text-slate-900">
                {scanResult.parsed.vendor?.name || "—"}
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2">
                <div>
                  <div className="text-xs text-slate-500">품목 수</div>
                  <div className="text-sm font-semibold">
                    {scanResult.itemCount}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">총 금액</div>
                  <div className="text-sm font-semibold">
                    {scanResult.parsed.totalAmount
                      ? new Intl.NumberFormat("ko-KR", {
                          style: "currency",
                          currency: scanResult.parsed.currency || "KRW",
                          maximumFractionDigits: 0,
                        }).format(scanResult.parsed.totalAmount)
                      : "—"}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={reset} className="flex-1">
                다시 스캔
              </Button>
              <Button onClick={handleClose} className="flex-1">
                완료
              </Button>
            </div>
          </div>
        )}

        {/* ── Error Step ── */}
        {step === "error" && (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
              <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-900">
                  스캔 실패
                </p>
                <p className="text-xs text-red-700 mt-1">
                  {errorMessage || "알 수 없는 오류"}
                </p>
              </div>
            </div>
            <Button onClick={reset} className="w-full" variant="outline">
              다시 시도
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
