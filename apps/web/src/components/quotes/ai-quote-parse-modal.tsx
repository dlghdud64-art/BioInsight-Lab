"use client";

/**
 * AI 견적서 파싱 모달
 *
 * 공급사 견적서(PDF/이미지)를 업로드하면 Gemini 2.5 Flash로 파싱하여
 * 품목별 단가/납기/조건을 자동 추출하고, 벤더 응답으로 등록합니다.
 *
 * 흐름: 파일 업로드 → AI 파싱 → 결과 검토/수정 → 벤더 응답 등록
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { csrfFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import {
  Upload, FileText, Loader2, CheckCircle2, AlertTriangle, X,
  Sparkles, ChevronRight, Edit3, Save,
} from "lucide-react";
import type {
  ParsedQuoteDocument,
  ParsedQuoteLineItem,
  QuoteParseResult,
} from "@/lib/ocr/gemini-quote-parser";

// ══════════════════════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════════════════════

interface AiQuoteParseModalProps {
  open: boolean;
  onClose: () => void;
  /** 연결할 견적 ID (벤더 응답으로 등록할 대상) */
  quoteId: string | null;
  /** 등록 완료 후 콜백 */
  onRegistered?: () => void;
}

type Step = "upload" | "parsing" | "review" | "registering" | "done" | "error";

// ══════════════════════════════════════════════════════════════════════════════
// Component
// ══════════════════════════════════════════════════════════════════════════════

export function AiQuoteParseModal({ open, onClose, quoteId, onRegistered }: AiQuoteParseModalProps) {
  const [step, setStep] = React.useState<Step>("upload");
  const [parseResult, setParseResult] = React.useState<QuoteParseResult | null>(null);
  const [editableDoc, setEditableDoc] = React.useState<ParsedQuoteDocument | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [fileName, setFileName] = React.useState<string>("");
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Reset on open
  React.useEffect(() => {
    if (open) {
      setStep("upload");
      setParseResult(null);
      setEditableDoc(null);
      setErrorMessage(null);
      setFileName("");
    }
  }, [open]);

  if (!open) return null;

  // ── File Upload Handler ──
  async function handleFileSelect(file: File) {
    setFileName(file.name);
    setStep("parsing");
    setErrorMessage(null);

    try {
      const isPDF = file.type === "application/pdf";

      if (isPDF) {
        // PDF → FormData → /api/quotes/parse-pdf
        const formData = new FormData();
        formData.append("file", file);

        const res = await csrfFetch("/api/quotes/parse-pdf", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `파싱 실패 (${res.status})`);
        }

        const data = await res.json();
        setParseResult(data);
        setEditableDoc(data.parsed);
      } else {
        // Image → base64 → /api/quotes/parse-image
        const base64 = await fileToBase64(file);

        const res = await csrfFetch("/api/quotes/parse-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: base64 }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `파싱 실패 (${res.status})`);
        }

        const data = await res.json();
        setParseResult(data);
        setEditableDoc(data.parsed);
      }

      setStep("review");
    } catch (err: any) {
      setErrorMessage(err?.message || "견적서 파싱에 실패했습니다.");
      setStep("error");
    }
  }

  // ── Register as Vendor Reply ──
  async function handleRegister() {
    if (!editableDoc || !quoteId) return;
    setStep("registering");

    try {
      const res = await csrfFetch(`/api/quotes/${quoteId}/vendor-replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorName: editableDoc.vendor?.name || "AI 파싱 공급사",
          items: editableDoc.items.map((item: ParsedQuoteLineItem) => ({
            quoteItemId: "", // 빈 값 — 서버에서 매칭 처리
            unitPrice: item.unitPrice || 0,
            currency: editableDoc.currency || "KRW",
            leadTimeDays: item.leadTimeDays ?? undefined,
            moq: undefined,
            vendorSku: item.catalogNumber ?? undefined,
            notes: [
              item.productName,
              item.specification,
              item.notes,
            ].filter(Boolean).join(" / "),
          })),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "벤더 응답 등록 실패");
      }

      setStep("done");
      onRegistered?.();
    } catch (err: any) {
      setErrorMessage(err?.message || "벤더 응답 등록에 실패했습니다.");
      setStep("error");
    }
  }

  // ── Editable field update ──
  function updateItem(index: number, field: keyof ParsedQuoteLineItem, value: string | number | null) {
    if (!editableDoc) return;
    setEditableDoc({
      ...editableDoc,
      items: editableDoc.items.map((item: ParsedQuoteLineItem, i: number) =>
        i === index ? { ...item, [field]: value } : item
      ),
    });
  }

  function updateVendorName(name: string) {
    if (!editableDoc) return;
    setEditableDoc({
      ...editableDoc,
      vendor: { ...editableDoc.vendor, name },
    });
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl mx-4 rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-blue-400" />
            <span className="text-sm font-semibold text-slate-900">AI 견적서 파싱</span>
            <span className="text-[10px] font-mono text-slate-500 bg-slate-100 rounded px-1.5 py-0.5">
              Gemini 2.5 Flash
            </span>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-600 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* Step: Upload */}
          {step === "upload" && (
            <div className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.classList.add("border-blue-500", "bg-blue-50"); }}
                onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove("border-blue-500", "bg-blue-50"); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.currentTarget.classList.remove("border-blue-500", "bg-blue-50");
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleFileSelect(file);
                }}
                className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-200 hover:border-blue-400 bg-slate-50 hover:bg-blue-50 py-12 cursor-pointer transition-all active:scale-[0.99]"
              >
                <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <Upload className="h-5 w-5 text-blue-400" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-600">견적서 파일을 여기에 끌어다 놓거나 클릭하세요</p>
                  <p className="text-[11px] text-slate-400 mt-1">PDF, JPG, PNG, WebP (최대 10MB) · 드래그 앤 드롭 지원</p>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelect(file);
                }}
              />
              <p className="text-[10px] text-slate-600 text-center">
                Gemini 2.5 Flash가 견적서를 분석하여 공급사명, 품목별 단가, 납기, 조건 등을 자동 추출합니다.
              </p>
            </div>
          )}

          {/* Step: Parsing */}
          {step === "parsing" && (
            <div className="flex flex-col items-center gap-4 py-12">
              <div className="relative">
                <div className="h-14 w-14 rounded-xl bg-blue-500/10 flex items-center justify-center animate-pulse">
                  <Sparkles className="h-6 w-6 text-blue-400" />
                </div>
                <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-blue-500 animate-ping" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-slate-600">AI가 견적서를 분석하고 있습니다</p>
                <p className="text-[11px] text-slate-500 mt-1">{fileName}</p>
                <div className="mt-3 flex items-center gap-2 text-[10px] text-slate-600">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>문서 구조 인식 → 품목 추출 → 단가/조건 파싱 중...</span>
                </div>
              </div>
            </div>
          )}

          {/* Step: Review */}
          {step === "review" && editableDoc && (
            <div className="space-y-4">
              {/* Confidence Badge */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className={cn("h-4 w-4",
                    parseResult?.confidence === "high" ? "text-emerald-400" :
                    parseResult?.confidence === "medium" ? "text-amber-400" : "text-red-400"
                  )} />
                  <span className="text-xs text-slate-500">
                    파싱 완료 — 신뢰도{" "}
                    <span className={cn("font-semibold",
                      parseResult?.confidence === "high" ? "text-emerald-400" :
                      parseResult?.confidence === "medium" ? "text-amber-400" : "text-red-400"
                    )}>
                      {parseResult?.confidence === "high" ? "높음" : parseResult?.confidence === "medium" ? "보통" : "낮음"}
                    </span>
                  </span>
                </div>
                <span className="text-[10px] text-slate-600">{parseResult?.itemCount}개 품목</span>
              </div>

              {/* Vendor Info */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <label className="text-[10px] text-slate-600 uppercase tracking-wider block mb-1">공급사명</label>
                <input
                  value={editableDoc.vendor?.name || ""}
                  onChange={(e) => updateVendorName(e.target.value)}
                  className="w-full bg-transparent text-sm text-slate-600 border-b border-slate-200 focus:border-blue-500 outline-none pb-1"
                />
                <div className="flex gap-4 mt-2 text-[10px] text-slate-500">
                  {editableDoc.quoteNumber && <span>견적번호: {editableDoc.quoteNumber}</span>}
                  {editableDoc.quoteDate && <span>견적일: {editableDoc.quoteDate}</span>}
                  {editableDoc.currency && <span>통화: {editableDoc.currency}</span>}
                </div>
              </div>

              {/* Items Table */}
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <div className="bg-slate-100 px-3 py-1.5 flex items-center gap-2">
                  <Edit3 className="h-3 w-3 text-slate-500" />
                  <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">품목 상세 (수정 가능)</span>
                </div>
                <div className="divide-y divide-slate-200 max-h-64 overflow-y-auto">
                  {editableDoc.items.map((item: ParsedQuoteLineItem, idx: number) => (
                    <div key={idx} className="px-3 py-2 hover:bg-slate-50">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[9px] text-slate-600 font-mono w-4 text-right shrink-0">{idx + 1}</span>
                        <input
                          value={item.productName || ""}
                          onChange={(e) => updateItem(idx, "productName", e.target.value)}
                          className="flex-1 bg-transparent text-xs text-slate-600 outline-none"
                          placeholder="품목명"
                        />
                        {item.catalogNumber && (
                          <span className="text-[9px] text-slate-600 font-mono">{item.catalogNumber}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 ml-6 text-[10px]">
                        <span className="text-slate-600">수량:</span>
                        <input
                          type="number"
                          value={item.quantity || 0}
                          onChange={(e) => updateItem(idx, "quantity", parseInt(e.target.value) || 0)}
                          className="w-14 bg-slate-100 rounded px-1.5 py-0.5 text-slate-500 outline-none text-center"
                        />
                        <span className="text-slate-600">{item.unit}</span>
                        <span className="text-slate-700">|</span>
                        <span className="text-slate-600">단가:</span>
                        <input
                          type="number"
                          value={item.unitPrice || 0}
                          onChange={(e) => updateItem(idx, "unitPrice", parseInt(e.target.value) || 0)}
                          className="w-24 bg-slate-100 rounded px-1.5 py-0.5 text-slate-500 outline-none text-right"
                        />
                        <span className="text-slate-600">원</span>
                        {item.leadTimeDays != null && (
                          <>
                            <span className="text-slate-700">|</span>
                            <span className="text-slate-600">납기:</span>
                            <input
                              type="number"
                              value={item.leadTimeDays}
                              onChange={(e) => updateItem(idx, "leadTimeDays", parseInt(e.target.value) || 0)}
                              className="w-12 bg-slate-100 rounded px-1.5 py-0.5 text-slate-500 outline-none text-center"
                            />
                            <span className="text-slate-600">일</span>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total */}
              {editableDoc.totalAmount != null && (
                <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-slate-200 bg-slate-50">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider">합계</span>
                  <span className="text-sm font-semibold text-slate-600 tabular-nums">
                    {editableDoc.currency} {editableDoc.totalAmount.toLocaleString()}
                    {editableDoc.vat != null && (
                      <span className="text-[10px] text-slate-600 ml-2">(VAT {editableDoc.vat.toLocaleString()})</span>
                    )}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Step: Registering */}
          {step === "registering" && (
            <div className="flex flex-col items-center gap-4 py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
              <p className="text-sm text-slate-500">벤더 응답으로 등록하는 중...</p>
            </div>
          )}

          {/* Step: Done */}
          {step === "done" && (
            <div className="flex flex-col items-center gap-4 py-12">
              <div className="h-14 w-14 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-7 w-7 text-emerald-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-slate-600">벤더 응답 등록 완료</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  {editableDoc?.vendor?.name} — {editableDoc?.items.length}개 품목이 등록되었습니다.
                </p>
              </div>
            </div>
          )}

          {/* Step: Error */}
          {step === "error" && (
            <div className="flex flex-col items-center gap-4 py-12">
              <div className="h-14 w-14 rounded-xl bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="h-7 w-7 text-red-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-red-400">오류 발생</p>
                <p className="text-[11px] text-slate-500 mt-1">{errorMessage}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="shrink-0 px-5 py-3 border-t border-slate-200 flex items-center justify-between bg-slate-50">
          <button onClick={onClose} className="text-xs text-slate-500 hover:text-slate-600 transition-colors">
            닫기
          </button>
          <div className="flex items-center gap-2">
            {step === "review" && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs border-slate-200 text-slate-500 hover:text-slate-700"
                  onClick={() => { setStep("upload"); setParseResult(null); setEditableDoc(null); }}
                >
                  다시 업로드
                </Button>
                {quoteId ? (
                  <Button
                    size="sm"
                    className="text-xs bg-blue-600 hover:bg-blue-500 active:scale-95 transition-all"
                    onClick={handleRegister}
                  >
                    <Save className="h-3.5 w-3.5 mr-1" />
                    벤더 응답으로 등록
                  </Button>
                ) : (
                  <span className="text-[10px] text-amber-500">견적 ID가 없어 등록할 수 없습니다</span>
                )}
              </>
            )}
            {step === "error" && (
              <Button
                size="sm"
                variant="outline"
                className="text-xs border-slate-200 text-slate-500"
                onClick={() => setStep("upload")}
              >
                다시 시도
              </Button>
            )}
            {step === "done" && (
              <Button
                size="sm"
                className="text-xs bg-emerald-600 hover:bg-emerald-500 active:scale-95"
                onClick={onClose}
              >
                완료
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Utility ──

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
