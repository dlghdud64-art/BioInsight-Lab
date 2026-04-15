"use client";

import { csrfFetch } from "@/lib/api-client";
import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { X, Check, AlertTriangle, Send, ArrowRight, Building2, Package, FileText, ClipboardCheck, Shield, Loader2, AlertCircle, ChevronRight } from "lucide-react";
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
  /**
   * 제출 성공 후 자동으로 견적 관리(handoff)로 이동하기까지의 지연 시간(ms).
   * - 양수: success card 노출 후 카운트다운 → onQuoteWorkqueueOpen 자동 호출
   * - 0 또는 null: 자동 이동 없음 (사용자가 직접 "견적 관리로 이동" 클릭)
   * 사용자는 카운트다운 도중 "취소" 버튼으로 자동 이동을 막을 수 있다.
   * 기본값 2500ms — silent success 방지 + 사용자 인지 시간 확보의 균형.
   */
  autoHandoffDelayMs?: number | null;
}

const DEFAULT_AUTO_HANDOFF_DELAY_MS = 2500;

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
  autoHandoffDelayMs = DEFAULT_AUTO_HANDOFF_DELAY_MS,
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
    if (isExecutingRef.current) return;
    setExecutionError(null);
    setBlockedReason(null);

    if (!submissionState || !draftSnapshot) {
      const msg = "제출 데이터가 준비되지 않았습니다. 초안으로 돌아가 다시 시도하세요.";
      setBlockedReason(msg);
      toast.error(msg);
      return;
    }
    if (!validation?.canSubmit) {
      const reasons = validation?.blockingIssues?.length
        ? validation.blockingIssues.join(", ")
        : "제출 조건을 충족하지 못했습니다.";
      setBlockedReason(reasons);
      toast.error(`견적 요청 제출 차단: ${reasons}`);
      return;
    }

    isExecutingRef.current = true;
    setIsSubmitting(true);

    try {
      const event = buildRequestSubmissionEvent(submissionState, draftSnapshot);

      // ── DB 저장: POST /api/quotes로 견적 생성 ──
      const lines = draftSnapshot.requestDraftLines;
      const vendorIds = draftSnapshot.targetVendorIds;

      // 빈 견적 방지: 품목 또는 공급사가 없으면 제출 차단
      if (!lines || lines.length === 0) {
        toast.error("요청 품목이 없습니다. 품목을 선택한 후 다시 시도하세요.");
        setIsSubmitting(false);
        isExecutingRef.current = false;
        return;
      }
      const condSummary = event.submissionConditionSummary;

      // 각 라인 × 각 벤더 조합으로 items 구성
      const items = lines.map((l: { itemId: string; requestedQty: number; lineNote: string }) => ({
        productId: l.itemId,
        vendorId: vendorIds[0] || undefined,
        quantity: l.requestedQty,
        notes: l.lineNote || "",
      }));

      const quotePayload = {
        title: condSummary.outboundSummary || `견적 요청 — ${lines.length}개 품목`,
        message: condSummary.requesterContext || "",
        items,
        deliveryDate: null,
        deliveryLocation: null,
        specialNotes: condSummary.purpose || "",
      };

      const res = await csrfFetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(quotePayload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `견적 저장 실패 (${res.status})`);
      }

      setSubmissionEvent(event);
      onSubmissionExecuted(event);
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
      toast.success(
        `견적 요청이 제출되었습니다 — 공급사 ${event.submittedVendorTargetIds.length}곳, 품목 ${event.submittedLineIds.length}건`,
      );
    } catch (err: any) {
      const msg = err?.message || "요청 제출 중 오류가 발생했습니다. 다시 시도해주세요.";
      setExecutionError(msg);
      toast.error(`견적 요청 제출 실패: ${msg}`);
    } finally {
      setIsSubmitting(false);
      isExecutingRef.current = false;
    }
  }, [submissionState, draftSnapshot, validation, onSubmissionExecuted]);

  // ── Auto handoff state (D-4) ──
  // 성공 직후 사용자가 success card를 인지할 시간을 확보한 뒤 자동으로 caller에게
  // 핸드오프를 위임한다. 사용자는 카운트다운 도중 "취소" 버튼으로 자동 이동을 막을 수 있다.
  const [autoHandoffCancelled, setAutoHandoffCancelled] = useState(false);
  const [autoHandoffRemainingMs, setAutoHandoffRemainingMs] = useState<number | null>(null);

  // ref 로 최신 callback 을 보장 — setTimeout 클로저에서 stale closure 방지
  const handleQuoteWorkqueueRef = useRef<() => void>(() => {});
  const handleQuoteWorkqueue = useCallback(() => {
    if (!submissionEvent) return;
    const handoff = buildQuoteWorkqueueHandoff(
      submissionEvent,
      draftSnapshot?.compareRationaleSummary || "",
    );
    onQuoteWorkqueueOpen(handoff);
  }, [submissionEvent, draftSnapshot, onQuoteWorkqueueOpen]);
  handleQuoteWorkqueueRef.current = handleQuoteWorkqueue;

  // 제출 성공 시 카운트다운 + 자동 handoff timer 구동.
  useEffect(() => {
    if (!submissionEvent) return;
    if (autoHandoffCancelled) return;
    if (!autoHandoffDelayMs || autoHandoffDelayMs <= 0) return;

    const startedAt = Date.now();
    setAutoHandoffRemainingMs(autoHandoffDelayMs);

    const tick = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(0, autoHandoffDelayMs - elapsed);
      setAutoHandoffRemainingMs(remaining);
      if (remaining <= 0) {
        clearInterval(tick);
      }
    }, 100);

    const handoffTimer = setTimeout(() => {
      // ref.current 는 항상 최신 submissionEvent 를 참조
      handleQuoteWorkqueueRef.current();
    }, autoHandoffDelayMs);

    return () => {
      clearInterval(tick);
      clearTimeout(handoffTimer);
    };
  }, [submissionEvent, autoHandoffCancelled, autoHandoffDelayMs]);

  const handleCancelAutoHandoff = useCallback(() => {
    setAutoHandoffCancelled(true);
    setAutoHandoffRemainingMs(null);
    toast.info("자동 이동을 취소했습니다. '견적 관리로 이동' 버튼으로 직접 이동할 수 있습니다.");
  }, []);

  if (!open || !draftSnapshot || !submissionState) return null;

  const isSubmitted = !!submissionEvent;
  const incompleteLines = submissionLines.filter((l) => !l.isComplete);
  const blockedLines = submissionLines.filter((l) => l.blockingReason);
  const hasBlockers = (validation?.blockingIssues.length ?? 0) > 0;
  const hasWarnings = (validation?.warnings.length ?? 0) > 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/35 flex items-center justify-center p-4 md:p-8" onClick={(e) => { if (e.target === e.currentTarget && !isSubmitting) onClose(); }}>
      <div className="bg-[#24272d] border border-slate-600/40 rounded-2xl shadow-2xl w-full flex flex-col" style={{ maxWidth: "1160px", maxHeight: "84vh" }}>

        {/* ═══ 1. Stage Chrome — header ═══ */}
        <div className="shrink-0 px-6 py-4 border-b border-slate-600/30 bg-[#282c33]" style={{ borderTopLeftRadius: "16px", borderTopRightRadius: "16px" }}>
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-2.5">
            <span className="cursor-default">소싱</span>
            <ChevronRight className="h-3 w-3 text-slate-600" />
            <span className="cursor-default">비교 검토</span>
            <ChevronRight className="h-3 w-3 text-slate-600" />
            <span className="cursor-default">요청 조립</span>
            <ChevronRight className="h-3 w-3 text-slate-600" />
            <span className="text-white font-semibold">{isSubmitted ? "제출 완료" : "제출 검토"}</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`flex items-center justify-center w-10 h-10 rounded-xl border ${isSubmitted ? "bg-emerald-600/15 border-emerald-500/25" : "bg-orange-600/15 border-orange-500/25"}`}>
                {isSubmitted ? <Check className="h-5 w-5 text-emerald-400" /> : <Send className="h-5 w-5 text-orange-400" />}
              </div>
              <div>
                <h2 className="text-lg font-bold text-white leading-tight">{isSubmitted ? "요청 제출 완료" : "요청 제출 검토"}</h2>
                <div className="flex items-center gap-3 mt-1 text-sm">
                  <span className="text-slate-300">공급사 <span className="text-white font-semibold">{draftSnapshot.targetVendorIds.length}곳</span></span>
                  <span className="text-slate-500">·</span>
                  <span className="text-slate-300">품목 <span className="text-white font-semibold">{submissionLines.length}건</span></span>
                  <span className="text-slate-500">·</span>
                  {isSubmitted ? (
                    <span className="text-emerald-400 font-medium text-xs">제출 완료</span>
                  ) : validation?.canSubmit ? (
                    <span className="text-blue-400 font-medium text-xs">제출 가능</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-red-400 font-medium text-xs">
                      <AlertCircle className="h-3 w-3" />차단됨
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className={`h-9 w-9 flex items-center justify-center rounded-lg transition-colors ${isSubmitting ? "text-slate-600 cursor-not-allowed" : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.06]"}`}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* ═══ 2. Scrollable body ═══ */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* ═══ A. Draft Basis Summary ═══ */}
          <section>
            <div className="grid grid-cols-2 gap-3">
              <div className="px-4 py-3 rounded-lg border border-slate-600/25 bg-[#2a2e35]">
                <span className="text-xs font-medium text-slate-400 block mb-1">요청 목적</span>
                <span className="text-sm text-slate-100 font-medium">{conditionSummary?.purpose || "미지정"}</span>
              </div>
              <div className="px-4 py-3 rounded-lg border border-slate-600/25 bg-[#2a2e35]">
                <span className="text-xs font-medium text-slate-400 block mb-1">긴급도</span>
                <span className={`text-sm font-medium ${conditionSummary?.urgency === "critical" ? "text-red-300" : conditionSummary?.urgency === "urgent" ? "text-amber-300" : "text-slate-100"}`}>
                  {conditionSummary?.urgencyLabel || "일반"}
                </span>
              </div>
            </div>
          </section>

          {/* Compare provenance */}
          {draftSnapshot.compareRationaleSummary && (
            <div className="px-4 py-3 rounded-lg bg-blue-600/[0.06] border border-blue-500/20">
              <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider block mb-1">비교 판단 근거</span>
              <span className="text-sm text-blue-200 leading-relaxed">{draftSnapshot.compareRationaleSummary}</span>
            </div>
          )}

          {/* Unresolved info */}
          {draftSnapshot.unresolvedInfoItems.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="h-4 w-4 text-amber-400" />
                <h3 className="text-[15px] font-semibold text-slate-100">미확인 항목</h3>
              </div>
              <div className="space-y-1.5">
                {draftSnapshot.unresolvedInfoItems.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-600/[0.04] border border-amber-500/15">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                    <span className="text-sm text-amber-200">{item}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ═══ B. Final Vendor Target Review ═══ */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="h-4 w-4 text-slate-400" />
              <h3 className="text-[15px] font-semibold text-slate-100">공급사 대상 (최종)</h3>
            </div>
            <div className="space-y-2">
              {vendorTargets.map((vt) => (
                <div key={vt.vendorId} className={`flex items-center gap-4 px-4 py-3.5 rounded-lg border transition-all ${vt.eligibilityStatus === "eligible" ? "border-emerald-500/25 bg-emerald-600/[0.04]" : vt.eligibilityStatus === "warning" ? "border-amber-500/25 bg-amber-600/[0.04]" : "border-red-500/20 bg-red-600/[0.04]"}`}>
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${vt.eligibilityStatus === "eligible" ? "bg-emerald-400" : vt.eligibilityStatus === "warning" ? "bg-amber-400" : "bg-red-400"}`} />
                  <Building2 className="h-4 w-4 text-slate-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-slate-100 font-medium block truncate">{vt.vendorDisplayName}</span>
                    <span className="text-xs text-slate-400 mt-0.5 block">품목 {vt.lineCoverageCount}건 · {vt.eligibilityReason}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ═══ C. Final Request Line Review ═══ */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Package className="h-4 w-4 text-slate-400" />
              <h3 className="text-[15px] font-semibold text-slate-100">요청 품목 (최종)</h3>
              <span className="text-xs text-slate-400 ml-1">{submissionLines.length}건</span>
            </div>
            <div className="border border-slate-600/25 rounded-lg overflow-hidden">
              {submissionLines.map((line, i) => (
                <div key={line.lineId} className={`flex items-center gap-4 px-4 py-3 ${i > 0 ? "border-t border-slate-600/15" : ""} ${!line.isComplete ? "bg-amber-600/[0.03]" : ""}`}>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-slate-100 font-medium block truncate">{line.itemName}</span>
                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                      <span>{line.catalogReference || "—"}</span>
                      <span>·</span>
                      <span>{line.specBasis || "규격 미확인"}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm tabular-nums text-slate-200 font-medium">{line.requestedQty}개</span>
                    <span className={`text-xs px-2 py-0.5 rounded-md border ${line.substituteAllowed ? "bg-emerald-600/12 border-emerald-500/20 text-emerald-300" : "bg-slate-700/30 border-slate-600/20 text-slate-400"}`}>
                      {line.substituteAllowed ? "대체 허용" : "대체 불가"}
                    </span>
                    {line.blockingReason && (
                      <AlertTriangle className="h-4 w-4 text-amber-400" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ═══ D. Submission Condition / Outbound Summary ═══ */}
          {conditionSummary && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Shield className="h-4 w-4 text-slate-400" />
                <h3 className="text-[15px] font-semibold text-slate-100">제출 조건 요약</h3>
              </div>
              <div className="px-4 py-3.5 rounded-lg border border-slate-600/25 bg-[#2a2e35] space-y-3">
                <span className="text-sm text-slate-100 font-medium block">{conditionSummary.outboundSummary}</span>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs font-medium text-slate-400 block mb-1.5">응답 요청</span>
                    <div className="flex flex-wrap gap-1.5">
                      {conditionSummary.responseRequirements.map((r, i) => (
                        <span key={i} className="text-xs px-2 py-1 rounded-md bg-slate-700/50 text-slate-200 border border-slate-600/20">{r}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-slate-400 block mb-1.5">대체 정책</span>
                    <span className="text-sm text-slate-200">{conditionSummary.substituteScopeLabel}</span>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ═══ Validation / Warning / Blocker ═══ */}
          {validation && (hasBlockers || hasWarnings) && !isSubmitted && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-4 w-4 text-red-400" />
                <h3 className="text-[15px] font-semibold text-slate-100">검증 결과</h3>
              </div>
              <div className="space-y-2">
                {validation.blockingIssues.map((b, i) => (
                  <div key={`block-${i}`} className="flex items-start gap-3 px-4 py-3 rounded-lg bg-red-600/[0.07] border border-red-500/20">
                    <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs font-semibold text-red-300 uppercase tracking-wider block mb-0.5">차단</span>
                      <span className="text-sm text-red-200">{b}</span>
                    </div>
                  </div>
                ))}
                {validation.warnings.map((w, i) => (
                  <div key={`warn-${i}`} className="flex items-start gap-3 px-4 py-3 rounded-lg bg-amber-600/[0.06] border border-amber-500/15">
                    <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs font-semibold text-amber-300 uppercase tracking-wider block mb-0.5">경고</span>
                      <span className="text-sm text-amber-200">{w}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ═══ Submission success ═══ */}
          {isSubmitted && submissionEvent && (
            <div className="px-5 py-5 rounded-lg bg-emerald-600/[0.08] border border-emerald-500/20 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-600/20 flex items-center justify-center shrink-0">
                  <Check className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <span className="text-base text-emerald-200 font-bold block">견적 요청이 제출되었습니다</span>
                  <span className="text-xs text-emerald-400/70 mt-0.5 block">{new Date(submissionEvent.submittedAt).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="px-3 py-2.5 rounded-lg bg-emerald-900/20 border border-emerald-700/20 text-center">
                  <span className="text-xs text-emerald-500 block mb-0.5">공급사</span>
                  <span className="text-lg font-bold text-emerald-300 tabular-nums">{submissionEvent.submittedVendorTargetIds.length}</span>
                </div>
                <div className="px-3 py-2.5 rounded-lg bg-emerald-900/20 border border-emerald-700/20 text-center">
                  <span className="text-xs text-emerald-500 block mb-0.5">품목</span>
                  <span className="text-lg font-bold text-emerald-300 tabular-nums">{submissionEvent.submittedLineIds.length}</span>
                </div>
                <div className="px-3 py-2.5 rounded-lg bg-emerald-900/20 border border-emerald-700/20 text-center">
                  <span className="text-xs text-emerald-500 block mb-0.5">상태</span>
                  <span className="text-sm font-semibold text-emerald-300">발송 요청됨</span>
                </div>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">
                {conditionSummary?.outboundSummary} — 다음 단계: 견적 관리에서 공급사 회신을 추적하고 견적을 비교할 수 있습니다.
              </p>

              {/* Auto-handoff countdown (D-4) */}
              {!autoHandoffCancelled
                && autoHandoffDelayMs
                && autoHandoffDelayMs > 0
                && autoHandoffRemainingMs !== null
                && autoHandoffRemainingMs > 0 && (
                <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg bg-emerald-900/15 border border-emerald-700/25">
                  <div className="flex items-center gap-3 min-w-0">
                    <Loader2 className="h-4 w-4 text-emerald-400 animate-spin shrink-0" />
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-semibold text-emerald-300">
                        {Math.ceil(autoHandoffRemainingMs / 1000)}초 후 견적 관리로 자동 이동
                      </span>
                      <div className="mt-1 h-1 w-full bg-emerald-950/40 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-400/70 transition-[width] duration-100 ease-linear"
                          style={{
                            width: `${Math.max(
                              0,
                              Math.min(100, (autoHandoffRemainingMs / autoHandoffDelayMs) * 100),
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    className="h-8 px-3 text-xs text-emerald-300 hover:text-emerald-100 border border-emerald-600/40 shrink-0"
                    onClick={handleCancelAutoHandoff}
                  >
                    취소
                  </Button>
                </div>
              )}
              {autoHandoffCancelled && (
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-800/40 border border-slate-600/30">
                  <AlertCircle className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span className="text-xs text-slate-300">
                    자동 이동이 취소되었습니다. 아래 "견적 관리로 이동" 버튼으로 직접 이동하세요.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ═══ 3. Sticky Dock ═══ */}
        <div className="shrink-0 px-6 py-4 border-t border-slate-600/30 bg-[#1e2126] space-y-3" style={{ borderBottomLeftRadius: "16px", borderBottomRightRadius: "16px" }}>
          {/* Execution feedback: blocked reason */}
          {blockedReason && !isSubmitted && (
            <div className="flex items-start gap-2.5 px-4 py-3 rounded-lg bg-red-600/[0.08] border border-red-500/20">
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-xs font-semibold text-red-300 block">제출이 차단되었습니다</span>
                <span className="text-xs text-red-400/80 mt-0.5 block">{blockedReason}</span>
              </div>
            </div>
          )}

          {/* Execution feedback: error */}
          {executionError && !isSubmitted && (
            <div className="flex items-start gap-2.5 px-4 py-3 rounded-lg bg-red-600/[0.08] border border-red-500/20">
              <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-xs font-semibold text-red-300 block">제출 실패</span>
                <span className="text-xs text-red-400/80 mt-0.5 block">{executionError}</span>
              </div>
            </div>
          )}

          {/* Status strip */}
          <div className="flex items-center gap-4 text-xs">
            <span className="text-slate-400">공급사 <span className="text-slate-200 font-semibold">{vendorTargets.length}</span></span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-400">품목 <span className="text-slate-200 font-semibold">{submissionLines.length}</span></span>
            {blockedLines.length > 0 && (
              <>
                <span className="text-slate-600">·</span>
                <span className="text-amber-400 font-medium">차단 {blockedLines.length}</span>
              </>
            )}
            <span className="text-slate-600">·</span>
            <span className="text-slate-400">{isSubmitted ? "제출 완료" : isSubmitting ? "제출 처리 중..." : validation?.recommendedNextAction || ""}</span>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            {!isSubmitted ? (
              <>
                <Button
                  variant="ghost"
                  className="h-10 px-4 text-sm text-slate-400 hover:text-slate-200 border border-slate-600/30 hover:border-slate-500/40"
                  onClick={onBackToAssembly}
                  disabled={isSubmitting}
                >
                  초안으로 돌아가기
                </Button>
                <Button
                  className={cn(
                    "flex-1 h-10 text-sm font-semibold transition-all",
                    isSubmitting
                      ? "bg-orange-700 text-orange-200 cursor-wait"
                      : !validation?.canSubmit
                        ? "bg-slate-700/60 text-slate-400 cursor-not-allowed border border-slate-600/40"
                        : "bg-orange-600 hover:bg-orange-500 text-white",
                  )}
                  onClick={executeSubmission}
                  disabled={isSubmitting || !validation?.canSubmit}
                  aria-disabled={isSubmitting || !validation?.canSubmit}
                  title={
                    !validation?.canSubmit
                      ? validation?.blockingIssues?.[0] ?? "제출 조건을 충족하지 못했습니다."
                      : undefined
                  }
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      제출 중...
                    </span>
                  ) : !validation?.canSubmit ? (
                    <span className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      제출 차단됨
                    </span>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      요청 제출
                    </>
                  )}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  className="h-10 px-4 text-sm text-slate-400 hover:text-slate-200 border border-slate-600/30"
                  onClick={onClose}
                >
                  닫기
                </Button>
                <Button
                  className="flex-1 h-10 text-sm bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                  onClick={handleQuoteWorkqueue}
                >
                  <ClipboardCheck className="h-4 w-4 mr-2" />
                  견적 관리로 이동
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
