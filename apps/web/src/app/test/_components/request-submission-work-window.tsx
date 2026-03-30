"use client";

import { useMemo, useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { X, Check, AlertTriangle, Send, ArrowRight, Building2, Package, FileText, ClipboardCheck, Shield, Loader2, AlertCircle } from "lucide-react";
import {
  type RequestSubmissionState,
  type RequestSubmissionEvent,
  type QuoteWorkqueueHandoff,
  type SubmissionVendorTarget,
  type SubmissionLine,
  type SubmissionConditionSummary,
  createInitialSubmissionState,
  buildSubmissionVendorTargets,
  resolveSubmissionLines,
  buildSubmissionConditionSummary,
  validateRequestSubmissionBeforeExecute,
  buildRequestSubmissionEvent,
  buildQuoteWorkqueueHandoff,
} from "@/lib/ai/request-submission-engine";
import type { RequestDraftSnapshot } from "@/lib/ai/request-assembly-engine";

// ══════════════════════════════════════════════════════════════════════════════
// Props
// ══════════════════════════════════════════════════════════════════════════════

interface RequestSubmissionWorkWindowProps {
  open: boolean;
  onClose: () => void;
  draftSnapshot: RequestDraftSnapshot | null;
  onSubmissionExecuted: (event: RequestSubmissionEvent) => void;
  onQuoteWorkqueueOpen: (handoff: QuoteWorkqueueHandoff) => void;
  onBackToAssembly: () => void;
}

// ══════════════════════════════════════════════════════════════════════════════
// Component
// ══════════════════════════════════════════════════════════════════════════════

export function RequestSubmissionWorkWindow({
  open,
  onClose,
  draftSnapshot,
  onSubmissionExecuted,
  onQuoteWorkqueueOpen,
  onBackToAssembly,
}: RequestSubmissionWorkWindowProps) {
  // ── State ──
  const [submissionState, setSubmissionState] = useState<RequestSubmissionState | null>(null);
  const [submissionEvent, setSubmissionEvent] = useState<RequestSubmissionEvent | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Derived data ──
  const vendorTargets = useMemo<SubmissionVendorTarget[]>(() =>
    draftSnapshot ? buildSubmissionVendorTargets(draftSnapshot) : [], [draftSnapshot]);
  const submissionLines = useMemo<SubmissionLine[]>(() =>
    draftSnapshot ? resolveSubmissionLines(draftSnapshot) : [], [draftSnapshot]);
  const conditionSummary = useMemo<SubmissionConditionSummary | null>(() =>
    draftSnapshot ? buildSubmissionConditionSummary(draftSnapshot) : null, [draftSnapshot]);

  // ── Init ──
  useMemo(() => {
    if (open && draftSnapshot && !submissionState) {
      setSubmissionState(createInitialSubmissionState(draftSnapshot));
    }
  }, [open, draftSnapshot]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Validation ──
  const validation = useMemo(() => {
    if (!submissionState || !draftSnapshot) return null;
    return validateRequestSubmissionBeforeExecute(submissionState, draftSnapshot);
  }, [submissionState, draftSnapshot]);

  // ── Execution feedback state ──
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [blockedReason, setBlockedReason] = useState<string | null>(null);
  const isExecutingRef = useRef(false);

  // ── Actions ──
  const executeSubmission = useCallback(async () => {
    // Prevent duplicate clicks
    if (isExecutingRef.current) return;

    // Clear previous feedback
    setExecutionError(null);
    setBlockedReason(null);

    // Guard with explicit feedback — never silent fail
    if (!submissionState || !draftSnapshot) {
      setBlockedReason("제출 데이터가 준비되지 않았습니다. 초안으로 돌아가 다시 시도하세요.");
      return;
    }
    if (!validation?.canSubmit) {
      const reasons = validation?.blockingIssues?.length
        ? validation.blockingIssues.join(", ")
        : "제출 조건을 충족하지 못했습니다.";
      setBlockedReason(reasons);
      return;
    }

    // Begin execution with pending state
    isExecutingRef.current = true;
    setIsSubmitting(true);

    try {
      // Simulate network latency for realistic feedback
      await new Promise((resolve) => setTimeout(resolve, 600));

      // Build canonical submission event
      const event = buildRequestSubmissionEvent(submissionState, draftSnapshot);
      setSubmissionEvent(event);
      onSubmissionExecuted(event);

      // Update state
      setSubmissionState((prev) => prev ? {
        ...prev,
        requestSubmissionStatus: "request_submitted",
        substatus: "submitted_to_quote_workqueue",
        requestSubmissionEventId: event.id,
        submittedAt: event.submittedAt,
        submittedBy: event.submittedBy,
        submittedVendorTargetCount: event.submittedVendorTargetIds.length,
        submittedLineCount: event.submittedLineIds.length,
      } : prev);
    } catch (err: any) {
      setExecutionError(err?.message || "요청 제출 중 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setIsSubmitting(false);
      isExecutingRef.current = false;
    }
  }, [submissionState, draftSnapshot, validation, onSubmissionExecuted]);

  const handleQuoteWorkqueue = useCallback(() => {
    if (!submissionEvent) return;
    const handoff = buildQuoteWorkqueueHandoff(
      submissionEvent,
      draftSnapshot?.compareRationaleSummary || "",
    );
    onQuoteWorkqueueOpen(handoff);
  }, [submissionEvent, draftSnapshot, onQuoteWorkqueueOpen]);

  if (!open || !draftSnapshot || !submissionState) return null;

  const isSubmitted = !!submissionEvent;
  const incompleteLines = submissionLines.filter((l) => !l.isComplete);
  const blockedLines = submissionLines.filter((l) => l.blockingReason);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center" onClick={(e) => { if (e.target === e.currentTarget && !isSubmitting) onClose(); }}>
      <div className="bg-[#22252a] border border-bd rounded-xl shadow-2xl w-full max-w-[1080px] max-h-[82vh] overflow-hidden flex flex-col">
        {/* ═══ 1. Identity Strip ═══ */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-bd bg-[#252729]">
          <div className="flex items-center gap-3">
            <div className={`flex items-center justify-center w-7 h-7 rounded-lg border ${isSubmitted ? "bg-emerald-600/15 border-emerald-500/25" : "bg-orange-600/15 border-orange-500/25"}`}>
              {isSubmitted ? <Check className="h-4 w-4 text-emerald-400" /> : <Send className="h-4 w-4 text-orange-400" />}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">{isSubmitted ? "요청 제출 완료" : "요청 제출 검토"}</h2>
              <div className="flex items-center gap-2 text-[10px] mt-0.5">
                <span className="text-slate-400">공급사 <span className="text-slate-200 font-medium">{draftSnapshot.targetVendorIds.length}개</span></span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-400">품목 <span className="text-slate-200 font-medium">{submissionLines.length}개</span></span>
                <span className="text-slate-600">·</span>
                {isSubmitted ? (
                  <span className="text-emerald-400 font-medium">제출 완료</span>
                ) : validation?.canSubmit ? (
                  <span className="text-blue-400 font-medium">제출 가능</span>
                ) : (
                  <span className="text-red-400 font-medium">차단됨</span>
                )}
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={isSubmitting} className={`h-7 w-7 flex items-center justify-center rounded transition-colors ${isSubmitting ? "text-slate-600 cursor-not-allowed" : "text-slate-500 hover:text-slate-300 hover:bg-white/[0.05]"}`}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ═══ Scrollable body ═══ */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* ═══ A. Draft Basis Summary ═══ */}
          <div className="grid grid-cols-2 gap-2">
            <div className="px-3 py-2 rounded-md border border-bd/40 bg-[#252729]">
              <span className="text-[9px] text-slate-500 block mb-0.5">요청 목적</span>
              <span className="text-[11px] text-slate-200 font-medium">{conditionSummary?.purpose || "미지정"}</span>
            </div>
            <div className="px-3 py-2 rounded-md border border-bd/40 bg-[#252729]">
              <span className="text-[9px] text-slate-500 block mb-0.5">긴급도</span>
              <span className={`text-[11px] font-medium ${conditionSummary?.urgency === "critical" ? "text-red-300" : conditionSummary?.urgency === "urgent" ? "text-amber-300" : "text-slate-200"}`}>
                {conditionSummary?.urgencyLabel || "일반"}
              </span>
            </div>
          </div>

          {/* Compare provenance */}
          {draftSnapshot.compareRationaleSummary && (
            <div className="px-3 py-2 rounded-md bg-blue-600/[0.04] border border-blue-500/15">
              <span className="text-[9px] font-medium text-blue-400 uppercase tracking-wider block mb-0.5">비교 판단 근거</span>
              <span className="text-[10px] text-blue-200">{draftSnapshot.compareRationaleSummary}</span>
            </div>
          )}

          {/* Unresolved info */}
          {draftSnapshot.unresolvedInfoItems.length > 0 && (
            <div>
              <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">미확인 항목</span>
              <div className="mt-1.5 space-y-0.5">
                {draftSnapshot.unresolvedInfoItems.map((item, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-[10px] text-amber-400">
                    <AlertTriangle className="h-3 w-3 shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══ B. Final Vendor Target Review ═══ */}
          <div>
            <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">공급사 대상 (최종)</span>
            <div className="mt-2 space-y-1">
              {vendorTargets.map((vt) => (
                <div key={vt.vendorId} className={`flex items-center gap-3 px-3 py-2.5 rounded-md border transition-all ${vt.eligibilityStatus === "eligible" ? "border-emerald-500/20 bg-emerald-600/[0.03]" : vt.eligibilityStatus === "warning" ? "border-amber-500/20 bg-amber-600/[0.03]" : "border-red-500/15 bg-red-600/[0.03]"}`}>
                  <div className={`w-2 h-2 rounded-full shrink-0 ${vt.eligibilityStatus === "eligible" ? "bg-emerald-400" : vt.eligibilityStatus === "warning" ? "bg-amber-400" : "bg-red-400"}`} />
                  <Building2 className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-[11px] text-slate-200 font-medium block truncate">{vt.vendorDisplayName}</span>
                    <span className="text-[10px] text-slate-500">품목 {vt.lineCoverageCount}개 · {vt.eligibilityReason}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ═══ C. Final Request Line Review ═══ */}
          <div>
            <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">요청 품목 (최종)</span>
            <div className="mt-2 border border-bd/40 rounded-md overflow-hidden">
              {submissionLines.map((line, i) => (
                <div key={line.lineId} className={`flex items-center gap-3 px-3 py-2 ${i > 0 ? "border-t border-bd/20" : ""} ${!line.isComplete ? "bg-amber-600/[0.02]" : ""}`}>
                  <div className="flex-1 min-w-0">
                    <span className="text-[11px] text-slate-200 font-medium block truncate">{line.itemName}</span>
                    <div className="flex items-center gap-2 text-[9px] text-slate-500 mt-0.5">
                      <span>{line.catalogReference || "—"}</span>
                      <span>·</span>
                      <span>{line.specBasis || "규격 미확인"}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] tabular-nums text-slate-300 font-medium">{line.requestedQty}개</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded ${line.substituteAllowed ? "bg-emerald-600/10 text-emerald-400" : "bg-slate-700/50 text-slate-500"}`}>
                      {line.substituteAllowed ? "대체 허용" : "대체 불가"}
                    </span>
                    {line.blockingReason && (
                      <AlertTriangle className="h-3 w-3 text-amber-400" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ═══ D. Submission Condition / Outbound Summary ═══ */}
          {conditionSummary && (
            <div>
              <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">제출 조건 요약</span>
              <div className="mt-2 px-3 py-2.5 rounded-md border border-bd/40 bg-[#252729] space-y-2">
                <div className="flex items-center gap-2">
                  <Shield className="h-3 w-3 text-slate-400 shrink-0" />
                  <span className="text-[10px] text-slate-200 font-medium">{conditionSummary.outboundSummary}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[9px] text-slate-500 block mb-0.5">응답 요청</span>
                    <div className="flex flex-wrap gap-1">
                      {conditionSummary.responseRequirements.map((r, i) => (
                        <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-300">{r}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 block mb-0.5">대체 정책</span>
                    <span className="text-[10px] text-slate-300">{conditionSummary.substituteScopeLabel}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ Validation summary ═══ */}
          {validation && (validation.blockingIssues.length > 0 || validation.warnings.length > 0) && !isSubmitted && (
            <div className="space-y-1">
              {validation.blockingIssues.map((b, i) => (
                <div key={`block-${i}`} className="flex items-center gap-2 px-3 py-2 rounded-md bg-red-600/[0.06] border border-red-500/15">
                  <AlertTriangle className="h-3 w-3 text-red-400 shrink-0" />
                  <span className="text-[10px] text-red-300">{b}</span>
                </div>
              ))}
              {validation.warnings.map((w, i) => (
                <div key={`warn-${i}`} className="flex items-center gap-2 px-3 py-2 rounded-md bg-amber-600/[0.04] border border-amber-500/10">
                  <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" />
                  <span className="text-[10px] text-amber-300">{w}</span>
                </div>
              ))}
            </div>
          )}

          {/* ═══ Submission success ═══ */}
          {isSubmitted && submissionEvent && (
            <div className="px-4 py-4 rounded-lg bg-emerald-600/[0.08] border border-emerald-500/20 space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-emerald-600/20 flex items-center justify-center shrink-0">
                  <Check className="h-4 w-4 text-emerald-400" />
                </div>
                <div>
                  <span className="text-[12px] text-emerald-300 font-semibold block">견적 요청이 제출되었습니다</span>
                  <span className="text-[10px] text-emerald-400/70">{new Date(submissionEvent.submittedAt).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="px-2.5 py-1.5 rounded bg-emerald-900/20 border border-emerald-700/20 text-center">
                  <span className="text-[9px] text-emerald-500 block">공급사</span>
                  <span className="text-sm font-bold text-emerald-300 tabular-nums">{submissionEvent.submittedVendorTargetIds.length}</span>
                </div>
                <div className="px-2.5 py-1.5 rounded bg-emerald-900/20 border border-emerald-700/20 text-center">
                  <span className="text-[9px] text-emerald-500 block">품목</span>
                  <span className="text-sm font-bold text-emerald-300 tabular-nums">{submissionEvent.submittedLineIds.length}</span>
                </div>
                <div className="px-2.5 py-1.5 rounded bg-emerald-900/20 border border-emerald-700/20 text-center">
                  <span className="text-[9px] text-emerald-500 block">상태</span>
                  <span className="text-[10px] font-medium text-emerald-300">발송 요청됨</span>
                </div>
              </div>
              <div className="text-[10px] text-slate-400 leading-relaxed">
                {conditionSummary?.outboundSummary} — 다음 단계: Quote Workqueue에서 공급사 회신을 추적하고 견적을 비교할 수 있습니다.
              </div>
            </div>
          )}
        </div>

        {/* ═══ 6. Submission Gate + Actions ═══ */}
        <div className="px-5 py-3 border-t border-bd bg-[#1a1c1f] space-y-2">
          {/* Execution feedback: blocked reason */}
          {blockedReason && !isSubmitted && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-md bg-red-600/[0.08] border border-red-500/20">
              <AlertCircle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-[10px] font-medium text-red-300 block">제출이 차단되었습니다</span>
                <span className="text-[10px] text-red-400/80">{blockedReason}</span>
              </div>
            </div>
          )}

          {/* Execution feedback: error */}
          {executionError && !isSubmitted && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-md bg-red-600/[0.08] border border-red-500/20">
              <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-[10px] font-medium text-red-300 block">제출 실패</span>
                <span className="text-[10px] text-red-400/80">{executionError}</span>
              </div>
            </div>
          )}

          {/* Summary strip */}
          <div className="flex items-center gap-3 text-[10px]">
            <span className="text-slate-500">공급사 <span className="text-slate-300 font-medium">{vendorTargets.length}</span></span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-500">품목 <span className="text-slate-300 font-medium">{submissionLines.length}</span></span>
            {blockedLines.length > 0 && (
              <>
                <span className="text-slate-600">·</span>
                <span className="text-amber-400">차단 {blockedLines.length}</span>
              </>
            )}
            <span className="text-slate-600">·</span>
            <span className="text-slate-500">{isSubmitted ? "제출 완료" : isSubmitting ? "제출 처리 중..." : validation?.recommendedNextAction || ""}</span>
          </div>
          {/* Action buttons */}
          <div className="flex gap-2">
            {!isSubmitted ? (
              <>
                <Button size="sm" variant="ghost" className="h-8 px-3 text-[10px] text-slate-400 hover:text-slate-300 border border-bd/40" onClick={onBackToAssembly} disabled={isSubmitting}>
                  초안으로 돌아가기
                </Button>
                <Button
                  size="sm"
                  className={`flex-1 h-8 text-[10px] font-medium transition-all ${isSubmitting ? "bg-orange-700 text-orange-200 cursor-wait" : "bg-orange-600 hover:bg-orange-500 text-white"}`}
                  onClick={executeSubmission}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      제출 중...
                    </span>
                  ) : (
                    <>
                      <Send className="h-3 w-3 mr-1" />
                      요청 제출
                    </>
                  )}
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="ghost" className="h-8 px-3 text-[10px] text-slate-400 hover:text-slate-300 border border-bd/40" onClick={onClose}>
                  닫기
                </Button>
                <Button
                  size="sm"
                  className="flex-1 h-8 text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
                  onClick={handleQuoteWorkqueue}
                >
                  <ClipboardCheck className="h-3 w-3 mr-1" />
                  Quote Workqueue 열기
                  <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
