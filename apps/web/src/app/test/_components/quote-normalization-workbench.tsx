"use client";

import { useMemo, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { X, Check, AlertTriangle, ArrowRight, RefreshCw, Link2, GitCompare, Building2 } from "lucide-react";
import {
  type QuoteNormalizationState,
  type NormalizedQuoteObject,
  type RawQuoteLine,
  createInitialNormalizationState,
  validateQuoteNormalizationBeforeRecord,
  buildNormalizedQuoteObject,
} from "@/lib/ai/quote-normalization-engine";
import type { QuoteNormalizationHandoff } from "@/lib/ai/quote-workqueue-engine";

// ══════════════════════════════════════════════════════════════════════════════
// Props
// ══════════════════════════════════════════════════════════════════════════════

interface QuoteNormalizationWorkbenchProps {
  open: boolean;
  onClose: () => void;
  handoff: QuoteNormalizationHandoff | null;
  onNormalizationRecorded: (normalizedQuote: NormalizedQuoteObject) => void;
  onCompareHandoffReady: () => void;
  onBackToQueue: () => void;
}

// ══════════════════════════════════════════════════════════════════════════════
// Demo raw lines generator
// ══════════════════════════════════════════════════════════════════════════════

function generateDemoRawLines(count: number): RawQuoteLine[] {
  return Array.from({ length: count }, (_, i) => ({
    rawLineId: `raw_${i}_${Date.now().toString(36)}`,
    itemDescription: `견적 품목 ${i + 1}`,
    catalogNumber: `CAT-${1000 + i}`,
    rawUnitPrice: `${(50000 + Math.floor(Math.random() * 200000)).toLocaleString("ko-KR")}원`,
    rawCurrency: "KRW",
    rawLeadTime: `${3 + Math.floor(Math.random() * 15)}영업일`,
    rawMOQ: `${1 + Math.floor(Math.random() * 5)}`,
    rawStockAvailability: Math.random() > 0.3 ? "재고 있음" : "",
    rawSubstituteNote: Math.random() > 0.7 ? "대체품 제안 가능" : "",
    rawNote: "",
  }));
}

// ══════════════════════════════════════════════════════════════════════════════
// Component
// ══════════════════════════════════════════════════════════════════════════════

export function QuoteNormalizationWorkbench({
  open,
  onClose,
  handoff,
  onNormalizationRecorded,
  onCompareHandoffReady,
  onBackToQueue,
}: QuoteNormalizationWorkbenchProps) {
  const [normState, setNormState] = useState<QuoteNormalizationState | null>(null);
  const [normalizedObject, setNormalizedObject] = useState<NormalizedQuoteObject | null>(null);

  // ── Init with demo data ──
  useMemo(() => {
    if (open && handoff && !normState) {
      const rawLines = generateDemoRawLines(handoff.expectedRequestLineCount || 2);
      setNormState(createInitialNormalizationState(handoff, rawLines));
    }
  }, [open, handoff]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Validation ──
  const validation = useMemo(() => {
    if (!normState) return null;
    return validateQuoteNormalizationBeforeRecord(normState);
  }, [normState]);

  // ── Actions ──
  const recordNormalization = useCallback(() => {
    if (!normState || !validation?.canRecordNormalizedQuote) return;
    const obj = buildNormalizedQuoteObject(normState);
    setNormalizedObject(obj);
    onNormalizationRecorded(obj);
    setNormState((prev) => prev ? {
      ...prev,
      quoteNormalizationStatus: "quote_normalized_recorded",
      substatus: "ready_for_compare_handoff",
      normalizedQuoteObjectId: obj.id,
    } : prev);
  }, [normState, validation, onNormalizationRecorded]);

  if (!open || !normState || !handoff) return null;

  const isRecorded = !!normalizedObject;
  const mappedCount = normState.lineMapping.mappedPairs.length;
  const unmappedCount = normState.lineMapping.unmappedRawLines.length;
  const uncoveredCount = normState.lineMapping.uncoveredRequestLines.length;
  const incompleteCount = normState.normalizedLines.filter((l) => !l.isComplete).length;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#1C2028] border border-bd rounded-xl shadow-2xl w-full max-w-3xl max-h-[88vh] overflow-hidden flex flex-col">
        {/* ═══ 1. Identity Strip ═══ */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-bd bg-[#252A33]">
          <div className="flex items-center gap-3">
            <div className={`flex items-center justify-center w-7 h-7 rounded-lg border ${isRecorded ? "bg-emerald-600/15 border-emerald-500/25" : "bg-orange-600/15 border-orange-500/25"}`}>
              {isRecorded ? <Check className="h-4 w-4 text-emerald-400" /> : <RefreshCw className="h-4 w-4 text-orange-400" />}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">{isRecorded ? "견적 정리 완료" : "공급사별 견적 정리"}</h2>
              <div className="flex items-center gap-2 text-[10px] mt-0.5">
                <Building2 className="h-3 w-3 text-slate-500" />
                <span className="text-slate-400">{handoff.vendorTargetId}</span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-400">매핑 <span className="text-slate-200 font-medium">{mappedCount}</span>/{normState.expectedRequestLineCount}</span>
                {incompleteCount > 0 && (
                  <>
                    <span className="text-slate-600">·</span>
                    <span className="text-amber-400">누락 {incompleteCount}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded text-slate-500 hover:text-slate-300 hover:bg-white/[0.05] transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ═══ Scrollable body ═══ */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* ═══ A. Mapping Summary ═══ */}
          <div>
            <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">라인 매핑 상태</span>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <div className="px-3 py-2 rounded-md border border-bd/40 bg-[#252A33] text-center">
                <span className="text-[9px] text-slate-500 block">매핑 완료</span>
                <span className={`text-lg font-bold tabular-nums ${mappedCount > 0 ? "text-emerald-400" : "text-slate-600"}`}>{mappedCount}</span>
              </div>
              <div className="px-3 py-2 rounded-md border border-bd/40 bg-[#252A33] text-center">
                <span className="text-[9px] text-slate-500 block">미매핑 견적 라인</span>
                <span className={`text-lg font-bold tabular-nums ${unmappedCount > 0 ? "text-amber-400" : "text-slate-600"}`}>{unmappedCount}</span>
              </div>
              <div className="px-3 py-2 rounded-md border border-bd/40 bg-[#252A33] text-center">
                <span className="text-[9px] text-slate-500 block">미커버 요청 라인</span>
                <span className={`text-lg font-bold tabular-nums ${uncoveredCount > 0 ? "text-red-400" : "text-slate-600"}`}>{uncoveredCount}</span>
              </div>
            </div>
          </div>

          {/* ═══ B. Line Mapping Table ═══ */}
          <div>
            <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">라인 매핑</span>
            <div className="mt-2 border border-bd/40 rounded-md overflow-hidden">
              {normState.lineMapping.mappedPairs.map((pair, i) => {
                const rawLine = normState.normalizedLines.find((l) => l.rawLineId === pair.rawLineId);
                return (
                  <div key={pair.rawLineId} className={`flex items-center gap-3 px-3 py-2.5 ${i > 0 ? "border-t border-bd/20" : ""}`}>
                    <div className={`w-2 h-2 rounded-full shrink-0 ${pair.mappedStatus === "confirmed" ? "bg-emerald-400" : pair.mappedStatus === "ambiguous" ? "bg-amber-400" : "bg-blue-400"}`} />
                    <Link2 className="h-3 w-3 text-slate-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] text-slate-200 font-medium block truncate">{rawLine?.rawLineId || pair.rawLineId}</span>
                      <span className="text-[9px] text-slate-500">{pair.requestLineId} → {pair.mappedStatus === "confirmed" ? "확정" : pair.mappedStatus === "ambiguous" ? "모호" : "대체"}</span>
                    </div>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded ${pair.mappedStatus === "confirmed" ? "bg-emerald-600/10 text-emerald-400" : pair.mappedStatus === "ambiguous" ? "bg-amber-600/10 text-amber-400" : "bg-blue-600/10 text-blue-400"}`}>
                      {pair.mappedStatus === "confirmed" ? "확정" : pair.mappedStatus === "ambiguous" ? "모호" : "대체"}
                    </span>
                  </div>
                );
              })}
              {normState.lineMapping.unmappedRawLines.length > 0 && (
                <div className="px-3 py-2 border-t border-bd/20 bg-amber-600/[0.02]">
                  <span className="text-[9px] text-amber-400">미매핑: {normState.lineMapping.unmappedRawLines.join(", ")}</span>
                </div>
              )}
              {normState.lineMapping.uncoveredRequestLines.length > 0 && (
                <div className="px-3 py-2 border-t border-bd/20 bg-red-600/[0.02]">
                  <span className="text-[9px] text-red-400">미커버: {normState.lineMapping.uncoveredRequestLines.join(", ")}</span>
                </div>
              )}
            </div>
          </div>

          {/* ═══ C. Normalized Commercial Fields ═══ */}
          <div>
            <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">정리된 상업 조건</span>
            <div className="mt-2 border border-bd/40 rounded-md overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-6 bg-[#252A33] border-b border-bd/40 px-3 py-1.5">
                {["품목", "단가", "납기", "최소 주문", "재고", "상태"].map((h) => (
                  <span key={h} className="text-[9px] text-slate-500 font-medium">{h}</span>
                ))}
              </div>
              {normState.normalizedLines.map((line, i) => (
                <div key={line.normalizedLineId} className={`grid grid-cols-6 px-3 py-2 ${i > 0 ? "border-t border-bd/20" : ""} ${!line.isComplete ? "bg-amber-600/[0.02]" : ""}`}>
                  <span className="text-[10px] text-slate-300 truncate">{line.rawLineId}</span>
                  <span className={`text-[10px] tabular-nums ${line.normalizedUnitPrice ? "text-slate-200" : "text-red-400"}`}>
                    {line.normalizedUnitPrice ? `₩${line.normalizedUnitPrice.toLocaleString("ko-KR")}` : "누락"}
                  </span>
                  <span className={`text-[10px] tabular-nums ${line.normalizedLeadTimeDays ? "text-slate-200" : "text-amber-400"}`}>
                    {line.normalizedLeadTimeDays ? `${line.normalizedLeadTimeDays}일` : "누락"}
                  </span>
                  <span className={`text-[10px] tabular-nums ${line.normalizedMOQ ? "text-slate-200" : "text-amber-400"}`}>
                    {line.normalizedMOQ ?? "누락"}
                  </span>
                  <span className={`text-[10px] ${line.normalizedStockAvailability === "in_stock" ? "text-emerald-400" : line.normalizedStockAvailability === "unknown" ? "text-amber-400" : "text-red-400"}`}>
                    {line.normalizedStockAvailability === "in_stock" ? "있음" : line.normalizedStockAvailability === "out_of_stock" ? "없음" : line.normalizedStockAvailability === "limited" ? "제한" : "미확인"}
                  </span>
                  <span className={`text-[9px] ${line.isComplete ? "text-emerald-400" : "text-amber-400"}`}>
                    {line.isComplete ? "완료" : `누락 ${line.missingFields.length}`}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ═══ D. Validation ═══ */}
          {validation && (validation.blockingIssues.length > 0 || validation.warnings.length > 0) && !isRecorded && (
            <div className="space-y-1">
              {validation.blockingIssues.map((b, i) => (
                <div key={`b-${i}`} className="flex items-center gap-2 px-3 py-2 rounded-md bg-red-600/[0.06] border border-red-500/15">
                  <AlertTriangle className="h-3 w-3 text-red-400 shrink-0" />
                  <span className="text-[10px] text-red-300">{b}</span>
                </div>
              ))}
              {validation.warnings.map((w, i) => (
                <div key={`w-${i}`} className="flex items-center gap-2 px-3 py-2 rounded-md bg-amber-600/[0.04] border border-amber-500/10">
                  <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" />
                  <span className="text-[10px] text-amber-300">{w}</span>
                </div>
              ))}
            </div>
          )}

          {/* ═══ Success ═══ */}
          {isRecorded && (
            <div className="px-3 py-3 rounded-md bg-emerald-600/[0.06] border border-emerald-500/15 space-y-1">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-400" />
                <span className="text-[11px] text-emerald-300 font-medium">견적 정리가 완료되었습니다</span>
              </div>
              <span className="text-[10px] text-slate-400">견적 관리에서 비교 준비 상태를 확인하세요.</span>
            </div>
          )}
        </div>

        {/* ═══ Action Dock ═══ */}
        <div className="px-5 py-3 border-t border-bd bg-[#181E28]">
          <div className="flex items-center gap-3 text-[10px] mb-2.5">
            <span className="text-slate-500">매핑 <span className="text-slate-300 font-medium">{mappedCount}/{normState.expectedRequestLineCount}</span></span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-500">누락 필드 <span className="text-slate-300 font-medium">{incompleteCount}</span></span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-500">{validation?.recommendedNextAction || ""}</span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" className="h-8 px-3 text-[10px] text-slate-400 hover:text-slate-300 border border-bd/40" onClick={onBackToQueue}>
              Queue로 돌아가기
            </Button>
            {!isRecorded ? (
              <Button
                size="sm"
                className="flex-1 h-8 text-[10px] bg-orange-600 hover:bg-orange-500 text-white font-medium"
                onClick={recordNormalization}
                disabled={!validation?.canRecordNormalizedQuote}
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                견적 정리 완료
              </Button>
            ) : (
              <Button
                size="sm"
                className="flex-1 h-8 text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
                onClick={onCompareHandoffReady}
              >
                <GitCompare className="h-3 w-3 mr-1" />
                비교 검토 준비 확인
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
