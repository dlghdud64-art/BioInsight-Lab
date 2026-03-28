"use client";

import { useMemo, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { X, Check, AlertTriangle, ArrowRight, ArrowLeft, RefreshCw, GitCompare, Mail, Clock, FileText } from "lucide-react";
import { type QuoteManagementReentryState, type QuoteManagementReentryObject, type QuoteReentryClassification, createInitialQuoteManagementReentryState, buildPriorQuoteReconciliationPlan, buildQuoteReentryQueueClassification, validateQuoteManagementReentryBeforeRecord, buildQuoteManagementReentryObject } from "@/lib/ai/quote-management-reentry-engine";
import type { QuoteManagementReentryHandoff } from "@/lib/ai/request-submission-reopen-engine";

const CLASS_CONFIG: Record<QuoteReentryClassification, { label: string; color: string }> = {
  new_expected: { label: "신규 대기", color: "text-blue-400" },
  prior_active_retained: { label: "기존 유지", color: "text-emerald-400" },
  stale: { label: "Stale", color: "text-slate-500" },
  needs_normalization_reentry: { label: "정규화 재진입", color: "text-orange-400" },
  ready_for_compare_reentry: { label: "비교 재진입", color: "text-violet-400" },
  blocked_pending_response: { label: "응답 대기", color: "text-amber-400" },
};

interface QuoteManagementReentryWorkbenchProps {
  open: boolean; onClose: () => void; handoff: QuoteManagementReentryHandoff | null;
  onReentryRecorded: (obj: QuoteManagementReentryObject) => void;
  onNormalizationReentryHandoff: () => void;
  onCompareReentryHandoff: () => void;
  onReturnToSubmissionReopen: () => void;
}

export function QuoteManagementReentryWorkbench({ open, onClose, handoff, onReentryRecorded, onNormalizationReentryHandoff, onCompareReentryHandoff, onReturnToSubmissionReopen }: QuoteManagementReentryWorkbenchProps) {
  const [reentryState, setReentryState] = useState<QuoteManagementReentryState | null>(null);
  const [reentryObject, setReentryObject] = useState<QuoteManagementReentryObject | null>(null);

  useMemo(() => { if (open && handoff && !reentryState) setReentryState(createInitialQuoteManagementReentryState(handoff)); }, [open, handoff]); // eslint-disable-line

  const reconciliation = useMemo(() => reentryState ? buildPriorQuoteReconciliationPlan(reentryState.queueRows) : null, [reentryState]);
  const classification = useMemo(() => reentryState ? buildQuoteReentryQueueClassification(reentryState.queueRows) : null, [reentryState]);
  const validation = useMemo(() => reentryState ? validateQuoteManagementReentryBeforeRecord(reentryState) : null, [reentryState]);

  const recordReentry = useCallback(() => {
    if (!reentryState || !validation?.canRecordQuoteManagementReentry) return;
    const obj = buildQuoteManagementReentryObject(reentryState);
    setReentryObject(obj); onReentryRecorded(obj);
    setReentryState(prev => prev ? { ...prev, quoteManagementReentryStatus: "quote_management_reentry_recorded", quoteManagementReentryObjectId: obj.id } : prev);
  }, [reentryState, validation, onReentryRecorded]);

  if (!open || !reentryState || !handoff) return null;
  const isRecorded = !!reentryObject;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#1e2024] border border-bd rounded-xl shadow-2xl w-full max-w-3xl max-h-[88vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-bd bg-[#252729]">
          <div className="flex items-center gap-3">
            <div className={`flex items-center justify-center w-7 h-7 rounded-lg border ${isRecorded ? "bg-emerald-600/15 border-emerald-500/25" : "bg-violet-600/15 border-violet-500/25"}`}>
              {isRecorded ? <Check className="h-4 w-4 text-emerald-400" /> : <RefreshCw className="h-4 w-4 text-violet-400" />}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">{isRecorded ? "Quote Re-entry 완료" : "Quote Management Re-entry"}</h2>
              <div className="flex items-center gap-2 text-[10px] mt-0.5">
                <span className="text-slate-400">신규 <span className="text-blue-300 font-medium">{reentryState.newExpectedQuoteCount}</span></span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-400">Stale <span className="text-slate-500 font-medium">{reentryState.staleQuoteCount}</span></span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-400">정규화 <span className="text-orange-300 font-medium">{reentryState.normalizationReentryCandidateCount}</span></span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-400">비교 <span className="text-violet-300 font-medium">{reentryState.compareReentryCandidateCount}</span></span>
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded text-slate-500 hover:text-slate-300 hover:bg-white/[0.05]"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Resubmission basis */}
          <div className="px-3 py-2 rounded-md bg-blue-600/[0.04] border border-blue-500/15">
            <span className="text-[9px] font-medium text-blue-400 uppercase tracking-wider block mb-0.5">Request Resubmission 근거</span>
            <span className="text-[10px] text-blue-200">Vendor: {handoff.finalVendorTargetIds.length}개 · Lines: {handoff.finalRequestLinePayloadCount}개 · Delta: {handoff.requestConditionDeltaSummary || "없음"}</span>
          </div>

          {/* Reconciliation */}
          {reconciliation && (
            <div>
              <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">Prior Quote Reconciliation</span>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <div className="px-3 py-2.5 rounded-md border border-emerald-500/20 bg-emerald-600/[0.03] text-center"><span className="text-[9px] text-slate-500 block">유지</span><span className="text-lg font-bold text-emerald-400">{reconciliation.activePriorQuoteIds.length}</span></div>
                <div className="px-3 py-2.5 rounded-md border border-bd/40 bg-[#252729] text-center"><span className="text-[9px] text-slate-500 block">Stale</span><span className="text-lg font-bold text-slate-500">{reconciliation.stalePriorQuoteIds.length}</span></div>
                <div className="px-3 py-2.5 rounded-md border border-blue-500/20 bg-blue-600/[0.03] text-center"><span className="text-[9px] text-slate-500 block">신규 대기</span><span className="text-lg font-bold text-blue-400">{reentryState.newExpectedQuoteCount}</span></div>
              </div>
              {reconciliation.reconciliationRiskSummary && (
                <div className="mt-1.5 px-3 py-1.5 rounded bg-[#252729] border border-bd/30"><span className="text-[10px] text-slate-400">{reconciliation.reconciliationRiskSummary}</span></div>
              )}
            </div>
          )}

          {/* Queue rows */}
          <div>
            <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">Re-entry Queue</span>
            <div className="mt-2 space-y-1">
              {reentryState.queueRows.map(row => {
                const config = CLASS_CONFIG[row.classification];
                return (
                  <div key={row.rowId} className="flex items-center gap-3 px-3 py-2.5 rounded-md border border-bd/40 bg-[#252729]">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${row.classification === "new_expected" ? "bg-blue-400" : row.classification === "stale" ? "bg-slate-500" : row.classification === "prior_active_retained" ? "bg-emerald-400" : "bg-amber-400"}`} />
                    <div className="flex-1 min-w-0">
                      <span className="text-[11px] text-slate-200 font-medium block truncate">{row.vendorName}</span>
                      <span className="text-[9px] text-slate-500">Norm: {row.normalizationRequired ? "필요" : "불필요"} · Compare: {row.compareReady ? "준비" : "대기"}</span>
                    </div>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${config.color} ${row.classification === "new_expected" ? "bg-blue-600/10" : row.classification === "stale" ? "bg-slate-700/30" : "bg-emerald-600/10"}`}>{config.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Route readiness */}
          {classification && (
            <div className="grid grid-cols-2 gap-2">
              <div className={`px-3 py-2.5 rounded-md border ${classification.normalizationReentryCandidateIds.length > 0 ? "border-orange-500/20 bg-orange-600/[0.03]" : "border-bd/40 bg-[#252729]"}`}>
                <span className="text-[9px] text-slate-500 block mb-0.5">Normalization Re-entry</span>
                <span className={`text-[10px] font-medium ${classification.normalizationReentryCandidateIds.length > 0 ? "text-orange-300" : "text-slate-500"}`}>{classification.normalizationReentryCandidateIds.length}개 후보</span>
              </div>
              <div className={`px-3 py-2.5 rounded-md border ${classification.compareReentryCandidateIds.length >= 2 ? "border-violet-500/20 bg-violet-600/[0.03]" : "border-bd/40 bg-[#252729]"}`}>
                <span className="text-[9px] text-slate-500 block mb-0.5">Compare Re-entry</span>
                <span className={`text-[10px] font-medium ${classification.compareReentryCandidateIds.length >= 2 ? "text-violet-300" : "text-slate-500"}`}>{classification.compareReentryCandidateIds.length}개 후보</span>
              </div>
            </div>
          )}

          {reconciliation && reconciliation.warnings.length > 0 && !isRecorded && reconciliation.warnings.map((w, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-md bg-amber-600/[0.04] border border-amber-500/10"><AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" /><span className="text-[10px] text-amber-300">{w}</span></div>
          ))}

          {isRecorded && (
            <div className="px-3 py-3 rounded-md bg-emerald-600/[0.06] border border-emerald-500/15">
              <div className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /><span className="text-[11px] text-emerald-300 font-medium">Quote Management Re-entry 저장 완료</span></div>
              <span className="text-[10px] text-slate-400 block mt-1">Normalization Re-entry 또는 Compare Re-entry로 진행하여 견적 처리 흐름을 재개할 수 있습니다.</span>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-bd bg-[#1a1c1f]">
          <div className="flex items-center gap-3 text-[10px] mb-2.5">
            <span className="text-slate-500">Norm <span className="text-orange-300 font-medium">{reentryState.normalizationReentryCandidateCount}</span></span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-500">Compare <span className="text-violet-300 font-medium">{reentryState.compareReentryCandidateCount}</span></span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-500">{validation?.recommendedNextAction || ""}</span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" className="h-8 px-3 text-[10px] text-slate-400 hover:text-slate-300 border border-bd/40" onClick={onReturnToSubmissionReopen}><ArrowLeft className="h-3 w-3 mr-1" />Submission Reopen</Button>
            {!isRecorded ? (
              <Button size="sm" className="flex-1 h-8 text-[10px] bg-violet-600 hover:bg-violet-500 text-white font-medium" onClick={recordReentry} disabled={!validation?.canRecordQuoteManagementReentry}><RefreshCw className="h-3 w-3 mr-1" />Quote Re-entry 저장</Button>
            ) : (
              <div className="flex gap-1.5 flex-1">
                {validation?.canOpenNormalizationReentry && (
                  <Button size="sm" className="flex-1 h-8 text-[10px] bg-orange-600 hover:bg-orange-500 text-white font-medium" onClick={onNormalizationReentryHandoff}><FileText className="h-3 w-3 mr-1" />Normalization<ArrowRight className="h-3 w-3 ml-1" /></Button>
                )}
                {validation?.canOpenCompareReentry && (
                  <Button size="sm" className="flex-1 h-8 text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white font-medium" onClick={onCompareReentryHandoff}><GitCompare className="h-3 w-3 mr-1" />Compare<ArrowRight className="h-3 w-3 ml-1" /></Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
