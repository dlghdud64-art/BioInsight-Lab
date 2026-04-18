"use client";

import { useMemo, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { X, AlertTriangle, Check, Clock, Mail, MailOpen, ArrowRight, RefreshCw, GitCompare, FileText, Building2 } from "lucide-react";
import {
  type QuoteWorkqueueState,
  type QuoteWorkqueueRow,
  type QuoteCompareReadiness,
  type QuoteWorkqueueObject,
  createInitialQuoteWorkqueueState,
  buildQuoteWorkqueueRows,
  evaluateQuoteCompareReadiness,
  buildQuoteWorkqueueObject,
  buildQuoteNormalizationHandoff,
  buildQuoteCompareReviewHandoff,
} from "@/lib/ai/quote-workqueue-engine";
import type { QuoteWorkqueueHandoff } from "@/lib/ai/request-submission-engine";

// ══════════════════════════════════════════════════════════════════════════════
// Props
// ══════════════════════════════════════════════════════════════════════════════

interface QuoteManagementWorkqueueProps {
  open: boolean;
  onClose: () => void;
  handoff: QuoteWorkqueueHandoff | null;
  onNormalizationOpen: (vendorId: string) => void;
  onCompareReviewOpen: () => void;
  onFollowUpOpen: (vendorId: string) => void;
}

// ══════════════════════════════════════════════════════════════════════════════
// Status helpers
// ══════════════════════════════════════════════════════════════════════════════

const STATUS_CONFIG = {
  no_response: { label: "미응답", color: "text-slate-500", bg: "bg-slate-700/30", icon: Mail },
  partial_response: { label: "일부 응답", color: "text-amber-400", bg: "bg-amber-600/10", icon: MailOpen },
  quote_received: { label: "견적 수신", color: "text-blue-400", bg: "bg-blue-600/10", icon: MailOpen },
  normalization_required: { label: "정리 필요", color: "text-orange-400", bg: "bg-orange-600/10", icon: RefreshCw },
  ready_for_compare: { label: "비교 준비", color: "text-emerald-400", bg: "bg-emerald-600/10", icon: Check },
  needs_followup: { label: "추가 요청", color: "text-red-400", bg: "bg-red-600/10", icon: AlertTriangle },
} as const;

// ══════════════════════════════════════════════════════════════════════════════
// Component
// ══════════════════════════════════════════════════════════════════════════════

export function QuoteManagementWorkqueue({
  open,
  onClose,
  handoff,
  onNormalizationOpen,
  onCompareReviewOpen,
  onFollowUpOpen,
}: QuoteManagementWorkqueueProps) {
  // ── State ──
  const [queueState, setQueueState] = useState<QuoteWorkqueueState | null>(null);
  const [rows, setRows] = useState<QuoteWorkqueueRow[]>([]);
  const [workqueueObject, setWorkqueueObject] = useState<QuoteWorkqueueObject | null>(null);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);

  // ── Init ──
  useMemo(() => {
    if (open && handoff && !queueState) {
      setQueueState(createInitialQuoteWorkqueueState(handoff));
      setRows(buildQuoteWorkqueueRows(handoff));
      setWorkqueueObject(buildQuoteWorkqueueObject(handoff));
    }
  }, [open, handoff]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived ──
  const compareReadiness = useMemo<QuoteCompareReadiness | null>(
    () => rows.length > 0 ? evaluateQuoteCompareReadiness(rows) : null,
    [rows],
  );

  const noResponseCount = rows.filter((r) => r.responseStatus === "no_response").length;
  const receivedCount = rows.filter((r) => r.quoteReceivedFlag).length;
  const normalizationCount = rows.filter((r) => r.normalizationStatus === "required").length;
  const compareReadyCount = rows.filter((r) => r.compareReadinessStatus === "ready").length;
  const selectedRow = selectedRowId ? rows.find((r) => r.rowId === selectedRowId) : null;

  // ── Simulate response (demo) ──
  const simulateResponse = useCallback((rowId: string) => {
    setRows((prev) => prev.map((r) =>
      r.rowId === rowId ? {
        ...r,
        responseStatus: "quote_received" as const,
        quoteReceivedFlag: true,
        quoteLineCoverageCount: r.missingLineCount,
        missingLineCount: 0,
        normalizationStatus: "required" as const,
        lastUpdatedAt: new Date().toISOString(),
        nextAction: "견적 정리 필요",
      } : r,
    ));
    setQueueState((prev) => prev ? {
      ...prev,
      quoteWorkqueueStatus: "quote_response_in_progress",
      substatus: "partial_response_received",
      receivedVendorResponseCount: prev.receivedVendorResponseCount + 1,
    } : prev);
  }, []);

  const simulateNormalization = useCallback((rowId: string) => {
    setRows((prev) => prev.map((r) =>
      r.rowId === rowId ? {
        ...r,
        responseStatus: "ready_for_compare" as const,
        normalizationStatus: "completed" as const,
        compareReadinessStatus: "ready" as const,
        nextAction: "비교 준비 완료",
      } : r,
    ));
  }, []);

  if (!open || !queueState || !handoff) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#1C2028] border border-bd rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* ═══ 1. Identity Strip ═══ */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-bd bg-[#252A33]">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-violet-600/15 border border-violet-500/25">
              <FileText className="h-4 w-4 text-violet-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">Quote Management</h2>
              <div className="flex items-center gap-2 text-[10px] mt-0.5">
                <span className="text-slate-400">공급사 <span className="text-slate-200 font-medium">{rows.length}개</span></span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-400">응답 <span className="text-emerald-300 font-medium">{receivedCount}</span> / {rows.length}</span>
                <span className="text-slate-600">·</span>
                {compareReadiness?.canOpenQuoteCompareReview ? (
                  <span className="text-emerald-400 font-medium">비교 검토 가능</span>
                ) : (
                  <span className="text-amber-400">비교 준비 중</span>
                )}
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded text-slate-500 hover:text-slate-300 hover:bg-white/[0.05] transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ═══ 2. Response Status Summary ═══ */}
        <div className="px-5 py-3 border-b border-bd/40">
          <div className="grid grid-cols-4 gap-2">
            <div className="px-3 py-2 rounded-md border border-bd/40 bg-[#252A33] text-center">
              <span className="text-[9px] text-slate-500 block">미응답</span>
              <span className={`text-lg font-bold tabular-nums ${noResponseCount > 0 ? "text-slate-300" : "text-slate-600"}`}>{noResponseCount}</span>
            </div>
            <div className="px-3 py-2 rounded-md border border-bd/40 bg-[#252A33] text-center">
              <span className="text-[9px] text-slate-500 block">수신 완료</span>
              <span className={`text-lg font-bold tabular-nums ${receivedCount > 0 ? "text-blue-400" : "text-slate-600"}`}>{receivedCount}</span>
            </div>
            <div className="px-3 py-2 rounded-md border border-bd/40 bg-[#252A33] text-center">
              <span className="text-[9px] text-slate-500 block">정리 필요</span>
              <span className={`text-lg font-bold tabular-nums ${normalizationCount > 0 ? "text-orange-400" : "text-slate-600"}`}>{normalizationCount}</span>
            </div>
            <div className="px-3 py-2 rounded-md border border-bd/40 bg-[#252A33] text-center">
              <span className="text-[9px] text-slate-500 block">비교 준비</span>
              <span className={`text-lg font-bold tabular-nums ${compareReadyCount > 0 ? "text-emerald-400" : "text-slate-600"}`}>{compareReadyCount}</span>
            </div>
          </div>
        </div>

        {/* ═══ 3. Scrollable Queue Table ═══ */}
        <div className="flex-1 overflow-y-auto">
          {/* Queue rows */}
          <div className="px-5 py-3 space-y-1.5">
            {rows.map((row) => {
              const config = STATUS_CONFIG[row.responseStatus];
              const StatusIcon = config.icon;
              const isSelected = selectedRowId === row.rowId;
              return (
                <div
                  key={row.rowId}
                  className={`flex items-center gap-3 px-3 py-3 rounded-md border cursor-pointer transition-all ${isSelected ? "border-violet-500/30 bg-violet-600/[0.04]" : "border-bd/40 bg-[#252A33] hover:bg-[#2a2c30]"}`}
                  onClick={() => setSelectedRowId(isSelected ? null : row.rowId)}
                >
                  {/* Status dot */}
                  <div className={`w-2 h-2 rounded-full shrink-0 ${row.responseStatus === "ready_for_compare" ? "bg-emerald-400" : row.responseStatus === "no_response" ? "bg-slate-500" : row.responseStatus === "normalization_required" ? "bg-orange-400" : row.quoteReceivedFlag ? "bg-blue-400" : "bg-slate-500"}`} />

                  {/* Vendor */}
                  <Building2 className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-[11px] text-slate-200 font-medium block truncate">{row.vendorDisplayName}</span>
                    <span className="text-[9px] text-slate-500">
                      라인 {row.quoteLineCoverageCount}/{row.quoteLineCoverageCount + row.missingLineCount}
                      {row.missingLineCount > 0 && ` · 누락 ${row.missingLineCount}`}
                    </span>
                  </div>

                  {/* Status badge */}
                  <span className={`text-[9px] px-2 py-0.5 rounded font-medium ${config.color} ${config.bg}`}>
                    <StatusIcon className="h-3 w-3 inline mr-0.5" />
                    {config.label}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {row.responseStatus === "no_response" && (
                      <Button size="sm" variant="ghost" className="h-6 px-2 text-[9px] text-blue-400 hover:text-blue-300 border border-blue-500/20"
                        onClick={(e) => { e.stopPropagation(); simulateResponse(row.rowId); }}>
                        응답 시뮬레이션
                      </Button>
                    )}
                    {row.normalizationStatus === "required" && (
                      <Button size="sm" variant="ghost" className="h-6 px-2 text-[9px] text-orange-400 hover:text-orange-300 border border-orange-500/20"
                        onClick={(e) => { e.stopPropagation(); simulateNormalization(row.rowId); }}>
                        견적 정리
                      </Button>
                    )}
                    {row.responseStatus === "ready_for_compare" && (
                      <span className="text-[9px] text-emerald-400">
                        <Check className="h-3 w-3 inline" /> 준비됨
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ═══ 4. Blocking / Missing Summary ═══ */}
          {compareReadiness && (compareReadiness.blockingIssues.length > 0 || compareReadiness.warnings.length > 0) && (
            <div className="px-5 py-3 space-y-1">
              {compareReadiness.blockingIssues.map((b, i) => (
                <div key={`b-${i}`} className="flex items-center gap-2 px-3 py-2 rounded-md bg-red-600/[0.06] border border-red-500/15">
                  <AlertTriangle className="h-3 w-3 text-red-400 shrink-0" />
                  <span className="text-[10px] text-red-300">{b}</span>
                </div>
              ))}
              {compareReadiness.warnings.map((w, i) => (
                <div key={`w-${i}`} className="flex items-center gap-2 px-3 py-2 rounded-md bg-amber-600/[0.04] border border-amber-500/10">
                  <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" />
                  <span className="text-[10px] text-amber-300">{w}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ═══ 5. Action Dock ═══ */}
        <div className="px-5 py-3 border-t border-bd bg-[#181E28]">
          <div className="flex items-center gap-3 text-[10px] mb-2.5">
            <span className="text-slate-500">응답 <span className="text-slate-300 font-medium">{receivedCount}/{rows.length}</span></span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-500">정리 필요 <span className="text-slate-300 font-medium">{normalizationCount}</span></span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-500">비교 준비 <span className="text-slate-300 font-medium">{compareReadyCount}</span></span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-500">{compareReadiness?.recommendedNextAction || ""}</span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" className="h-8 px-3 text-[10px] text-slate-400 hover:text-slate-300 border border-bd/40" onClick={onClose}>
              닫기
            </Button>
            {normalizationCount > 0 && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 px-3 text-[10px] text-orange-400 hover:text-orange-300 border border-orange-500/20"
                onClick={() => {
                  const row = rows.find((r) => r.normalizationStatus === "required");
                  if (row) onNormalizationOpen(row.vendorTargetId);
                }}
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                정리 필요 견적 열기
              </Button>
            )}
            <Button
              size="sm"
              className={`flex-1 h-8 text-[10px] font-medium ${compareReadiness?.canOpenQuoteCompareReview ? "bg-emerald-600 hover:bg-emerald-500 text-white" : "bg-slate-700 text-slate-400 cursor-not-allowed"}`}
              onClick={onCompareReviewOpen}
              disabled={!compareReadiness?.canOpenQuoteCompareReview}
            >
              <GitCompare className="h-3 w-3 mr-1" />
              견적 비교 검토
              {compareReadiness?.canOpenQuoteCompareReview && <ArrowRight className="h-3 w-3 ml-1" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
