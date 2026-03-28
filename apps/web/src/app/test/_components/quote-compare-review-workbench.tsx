"use client";

import { useMemo, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { X, Check, Minus, AlertTriangle, ArrowRight, GitCompare, TrendingDown, Clock, Package, Building2, ShieldCheck } from "lucide-react";
import {
  type QuoteCompareReviewState,
  type QuoteCompareDecisionSnapshot,
  type ApprovalWorkbenchHandoff,
  createInitialQuoteCompareState,
  buildQuoteCompareDifferenceSummary,
  validateQuoteCompareBeforeDecision,
  buildQuoteCompareDecisionSnapshot,
  buildApprovalWorkbenchHandoff,
} from "@/lib/ai/quote-compare-review-engine";
import type { NormalizedQuoteObject } from "@/lib/ai/quote-normalization-engine";

// ══════════════════════════════════════════════════════════════════════════════
// Props
// ══════════════════════════════════════════════════════════════════════════════

interface QuoteCompareReviewWorkbenchProps {
  open: boolean;
  onClose: () => void;
  workqueueObjectId: string;
  requestSubmissionEventId: string;
  normalizedQuotes: NormalizedQuoteObject[];
  onDecisionRecorded: (snapshot: QuoteCompareDecisionSnapshot) => void;
  onApprovalHandoff: (handoff: ApprovalWorkbenchHandoff) => void;
  onBackToQueue: () => void;
}

// ══════════════════════════════════════════════════════════════════════════════
// Component
// ══════════════════════════════════════════════════════════════════════════════

export function QuoteCompareReviewWorkbench({
  open,
  onClose,
  workqueueObjectId,
  requestSubmissionEventId,
  normalizedQuotes,
  onDecisionRecorded,
  onApprovalHandoff,
  onBackToQueue,
}: QuoteCompareReviewWorkbenchProps) {
  const [compareState, setCompareState] = useState<QuoteCompareReviewState | null>(null);
  const [decisionSnapshot, setDecisionSnapshot] = useState<QuoteCompareDecisionSnapshot | null>(null);

  // ── Init ──
  useMemo(() => {
    if (open && normalizedQuotes.length > 0 && !compareState) {
      setCompareState(createInitialQuoteCompareState(workqueueObjectId, requestSubmissionEventId, normalizedQuotes));
    }
  }, [open, normalizedQuotes.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived ──
  const diffSummary = useMemo(() => buildQuoteCompareDifferenceSummary(normalizedQuotes), [normalizedQuotes]);
  const validation = useMemo(() => {
    if (!compareState) return null;
    return validateQuoteCompareBeforeDecision(compareState, normalizedQuotes);
  }, [compareState, normalizedQuotes]);

  // ── Actions ──
  const toggleShortlist = useCallback((vendorId: string) => {
    setCompareState((prev) => {
      if (!prev) return prev;
      const isShortlisted = prev.shortlistVendorIds.includes(vendorId);
      return {
        ...prev,
        shortlistVendorIds: isShortlisted ? prev.shortlistVendorIds.filter((v) => v !== vendorId) : [...prev.shortlistVendorIds, vendorId],
        excludedVendorIds: prev.excludedVendorIds.filter((v) => v !== vendorId),
        followupVendorIds: prev.followupVendorIds.filter((v) => v !== vendorId),
      };
    });
  }, []);

  const toggleExclude = useCallback((vendorId: string) => {
    setCompareState((prev) => {
      if (!prev) return prev;
      const isExcluded = prev.excludedVendorIds.includes(vendorId);
      return {
        ...prev,
        excludedVendorIds: isExcluded ? prev.excludedVendorIds.filter((v) => v !== vendorId) : [...prev.excludedVendorIds, vendorId],
        shortlistVendorIds: prev.shortlistVendorIds.filter((v) => v !== vendorId),
        followupVendorIds: prev.followupVendorIds.filter((v) => v !== vendorId),
      };
    });
  }, []);

  const toggleFollowup = useCallback((vendorId: string) => {
    setCompareState((prev) => {
      if (!prev) return prev;
      const isFollowup = prev.followupVendorIds.includes(vendorId);
      return {
        ...prev,
        followupVendorIds: isFollowup ? prev.followupVendorIds.filter((v) => v !== vendorId) : [...prev.followupVendorIds, vendorId],
        shortlistVendorIds: prev.shortlistVendorIds.filter((v) => v !== vendorId),
        excludedVendorIds: prev.excludedVendorIds.filter((v) => v !== vendorId),
      };
    });
  }, []);

  const recordDecision = useCallback(() => {
    if (!compareState || !validation?.canRecordCompareDecision) return;
    const rationale = `${compareState.shortlistVendorIds.length}개 shortlist, ${compareState.excludedVendorIds.length}개 제외, ${compareState.followupVendorIds.length}개 추가 확인`;
    const snapshot = buildQuoteCompareDecisionSnapshot(compareState, rationale);
    setDecisionSnapshot(snapshot);
    onDecisionRecorded(snapshot);
    setCompareState((prev) => prev ? {
      ...prev,
      quoteCompareStatus: "quote_compare_decision_recorded",
      substatus: "ready_for_approval_handoff",
      quoteCompareDecisionSnapshotId: snapshot.id,
    } : prev);
  }, [compareState, validation, onDecisionRecorded]);

  const handleApprovalHandoff = useCallback(() => {
    if (!decisionSnapshot) return;
    const handoff = buildApprovalWorkbenchHandoff(decisionSnapshot);
    onApprovalHandoff(handoff);
  }, [decisionSnapshot, onApprovalHandoff]);

  if (!open || !compareState) return null;

  const isDecisionRecorded = !!decisionSnapshot;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#1e2024] border border-bd rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* ═══ Identity Strip ═══ */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-bd bg-[#252729]">
          <div className="flex items-center gap-3">
            <div className={`flex items-center justify-center w-7 h-7 rounded-lg border ${isDecisionRecorded ? "bg-emerald-600/15 border-emerald-500/25" : "bg-violet-600/15 border-violet-500/25"}`}>
              {isDecisionRecorded ? <Check className="h-4 w-4 text-emerald-400" /> : <GitCompare className="h-4 w-4 text-violet-400" />}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">{isDecisionRecorded ? "견적 비교 완료" : "견적 비교 검토"}</h2>
              <div className="flex items-center gap-2 text-[10px] mt-0.5">
                <span className="text-slate-400">공급사 <span className="text-slate-200 font-medium">{normalizedQuotes.length}개</span></span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-400">shortlist <span className="text-emerald-300 font-medium">{compareState.shortlistVendorIds.length}</span></span>
                {compareState.followupVendorIds.length > 0 && (
                  <>
                    <span className="text-slate-600">·</span>
                    <span className="text-amber-400">추가 확인 {compareState.followupVendorIds.length}</span>
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
          {/* ═══ Difference Summary (먼저) ═══ */}
          <div>
            <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">핵심 차이</span>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {diffSummary.lowestPrice && (
                <div className="px-3 py-2.5 rounded-md border border-bd/40 bg-[#252729]">
                  <div className="flex items-center gap-1.5 mb-1"><TrendingDown className="h-3 w-3 text-emerald-400" /><span className="text-[9px] text-slate-500">가격 우위</span></div>
                  <span className="text-[11px] text-slate-200 font-medium block">{diffSummary.lowestPrice.label}</span>
                  <span className="text-[10px] text-slate-400">{diffSummary.lowestPrice.delta}</span>
                </div>
              )}
              {diffSummary.fastestLeadTime && (
                <div className="px-3 py-2.5 rounded-md border border-bd/40 bg-[#252729]">
                  <div className="flex items-center gap-1.5 mb-1"><Clock className="h-3 w-3 text-blue-400" /><span className="text-[9px] text-slate-500">납기 우위</span></div>
                  <span className="text-[11px] text-slate-200 font-medium block">{diffSummary.fastestLeadTime.label}</span>
                  <span className="text-[10px] text-slate-400">{diffSummary.fastestLeadTime.delta}</span>
                </div>
              )}
              {diffSummary.bestStock && (
                <div className="px-3 py-2.5 rounded-md border border-bd/40 bg-[#252729]">
                  <div className="flex items-center gap-1.5 mb-1"><Package className="h-3 w-3 text-emerald-400" /><span className="text-[9px] text-slate-500">재고</span></div>
                  <span className="text-[11px] text-slate-200 font-medium">{diffSummary.bestStock.label}</span>
                </div>
              )}
              {diffSummary.moqWarning && (
                <div className="px-3 py-2.5 rounded-md border border-amber-500/20 bg-amber-600/[0.03]">
                  <div className="flex items-center gap-1.5 mb-1"><AlertTriangle className="h-3 w-3 text-amber-400" /><span className="text-[9px] text-slate-500">MOQ</span></div>
                  <span className="text-[11px] text-amber-300 font-medium">{diffSummary.moqWarning.label}</span>
                </div>
              )}
            </div>
            {diffSummary.operatorCheckpoints.length > 0 && (
              <div className="mt-2 px-3 py-2 rounded bg-[#252729] border border-bd/30">
                {diffSummary.operatorCheckpoints.map((cp, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-[10px] text-slate-400">
                    <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" />{cp}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ═══ Normalized Quote Matrix ═══ */}
          <div>
            <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">견적 비교 매트릭스</span>
            <div className="mt-2 border border-bd/40 rounded-md overflow-x-auto">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="bg-[#252729] border-b border-bd/40">
                    <th className="px-3 py-2 text-left text-slate-500 font-medium">항목</th>
                    {normalizedQuotes.map((q) => (
                      <th key={q.id} className="px-3 py-2 text-left text-slate-300 font-medium border-l border-bd/30">{q.vendorTargetId}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {["단가", "납기", "MOQ", "재고", "대체"].map((field) => (
                    <tr key={field} className="border-b border-bd/20 last:border-b-0">
                      <td className="px-3 py-1.5 text-slate-500">{field}</td>
                      {normalizedQuotes.map((q) => {
                        const line = q.normalizedQuoteLines[0];
                        if (!line) return <td key={q.id} className="px-3 py-1.5 text-slate-600 border-l border-bd/20">—</td>;
                        const val = field === "단가" ? (line.normalizedUnitPrice ? `₩${line.normalizedUnitPrice.toLocaleString("ko-KR")}` : "누락")
                          : field === "납기" ? (line.normalizedLeadTimeDays ? `${line.normalizedLeadTimeDays}일` : "누락")
                          : field === "MOQ" ? (line.normalizedMOQ ?? "누락")
                          : field === "재고" ? (line.normalizedStockAvailability === "in_stock" ? "있음" : line.normalizedStockAvailability === "unknown" ? "미확인" : "없음")
                          : line.substituteOffered ? "제안 있음" : "—";
                        const isMissing = typeof val === "string" && val === "누락";
                        return <td key={q.id} className={`px-3 py-1.5 border-l border-bd/20 tabular-nums ${isMissing ? "text-red-400" : "text-slate-300"}`}>{val}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ═══ Vendor Decision Actions ═══ */}
          <div>
            <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">공급사 판단</span>
            <div className="mt-2 space-y-1.5">
              {normalizedQuotes.map((q) => {
                const vid = q.vendorTargetId;
                const isShortlisted = compareState.shortlistVendorIds.includes(vid);
                const isExcluded = compareState.excludedVendorIds.includes(vid);
                const isFollowup = compareState.followupVendorIds.includes(vid);
                return (
                  <div key={q.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-md border transition-all ${isShortlisted ? "border-emerald-500/25 bg-emerald-600/[0.04]" : isExcluded ? "border-red-500/15 bg-red-600/[0.03] opacity-60" : isFollowup ? "border-amber-500/20 bg-amber-600/[0.03]" : "border-bd/40 bg-[#252729]"}`}>
                    <Building2 className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-[11px] text-slate-200 font-medium block truncate">{vid}</span>
                      <span className="text-[9px] text-slate-500">라인 {q.normalizedQuoteLines.length}개 · {q.normalizedQuoteLines.filter((l) => l.isComplete).length}개 완전</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="sm" variant={isShortlisted ? "default" : "ghost"}
                        className={`h-6 px-2 text-[9px] ${isShortlisted ? "bg-emerald-600/15 text-emerald-400 border border-emerald-500/25" : "text-slate-500 border border-bd/30"}`}
                        onClick={() => toggleShortlist(vid)} disabled={isDecisionRecorded}>
                        <Check className="h-3 w-3 mr-0.5" />shortlist
                      </Button>
                      <Button size="sm" variant="ghost"
                        className={`h-6 px-2 text-[9px] ${isFollowup ? "bg-amber-600/10 text-amber-400 border border-amber-500/20" : "text-slate-500 border border-bd/30"}`}
                        onClick={() => toggleFollowup(vid)} disabled={isDecisionRecorded}>
                        <AlertTriangle className="h-3 w-3 mr-0.5" />확인
                      </Button>
                      <Button size="sm" variant="ghost"
                        className={`h-6 px-2 text-[9px] ${isExcluded ? "bg-red-600/10 text-red-400 border border-red-500/20" : "text-slate-500 border border-bd/30"}`}
                        onClick={() => toggleExclude(vid)} disabled={isDecisionRecorded}>
                        <Minus className="h-3 w-3 mr-0.5" />제외
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Validation */}
          {validation && (validation.blockingIssues.length > 0 || validation.warnings.length > 0) && !isDecisionRecorded && (
            <div className="space-y-1">
              {validation.blockingIssues.map((b, i) => (
                <div key={`b-${i}`} className="flex items-center gap-2 px-3 py-2 rounded-md bg-red-600/[0.06] border border-red-500/15">
                  <AlertTriangle className="h-3 w-3 text-red-400 shrink-0" /><span className="text-[10px] text-red-300">{b}</span>
                </div>
              ))}
              {validation.warnings.map((w, i) => (
                <div key={`w-${i}`} className="flex items-center gap-2 px-3 py-2 rounded-md bg-amber-600/[0.04] border border-amber-500/10">
                  <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" /><span className="text-[10px] text-amber-300">{w}</span>
                </div>
              ))}
            </div>
          )}

          {isDecisionRecorded && (
            <div className="px-3 py-3 rounded-md bg-emerald-600/[0.06] border border-emerald-500/15 space-y-1">
              <div className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /><span className="text-[11px] text-emerald-300 font-medium">비교 결과가 저장되었습니다</span></div>
              <span className="text-[10px] text-slate-400">Approval 검토로 보내 최종 승인을 진행할 수 있습니다.</span>
            </div>
          )}
        </div>

        {/* ═══ Action Dock ═══ */}
        <div className="px-5 py-3 border-t border-bd bg-[#1a1c1f]">
          <div className="flex items-center gap-3 text-[10px] mb-2.5">
            <span className="text-slate-500">shortlist <span className="text-slate-300 font-medium">{compareState.shortlistVendorIds.length}</span></span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-500">추가 확인 <span className="text-slate-300 font-medium">{compareState.followupVendorIds.length}</span></span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-500">제외 <span className="text-slate-300 font-medium">{compareState.excludedVendorIds.length}</span></span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-500">{validation?.recommendedNextAction || ""}</span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" className="h-8 px-3 text-[10px] text-slate-400 hover:text-slate-300 border border-bd/40" onClick={onBackToQueue}>
              Queue로 돌아가기
            </Button>
            {!isDecisionRecorded ? (
              <Button size="sm" className="flex-1 h-8 text-[10px] bg-violet-600 hover:bg-violet-500 text-white font-medium"
                onClick={recordDecision} disabled={!validation?.canRecordCompareDecision}>
                <GitCompare className="h-3 w-3 mr-1" />비교 결과 저장
              </Button>
            ) : (
              <Button size="sm" className="flex-1 h-8 text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white font-medium" onClick={handleApprovalHandoff}>
                <ShieldCheck className="h-3 w-3 mr-1" />Approval 검토로 보내기<ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
