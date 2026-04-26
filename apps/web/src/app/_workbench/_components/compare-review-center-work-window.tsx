"use client";

import { useMemo, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { X, Check, Minus, AlertTriangle, ArrowRight, GitCompare, RefreshCw, Clock, FileText, ShieldCheck } from "lucide-react";
import {
  type CompareReviewCenterState,
  type CompareOption,
  type OptionReviewStatus,
  type SelectionReasonCode,
  type ExclusionReasonCode,
  createInitialCompareReviewCenterState,
  updateOptionReviewStatus,
  validateCompareReviewCompletion,
  markCompareReviewCompleted,
  markCompareReviewHandoffReady,
  buildCompareReviewApprovalHandoff,
} from "@/lib/ai/compare-review-center-engine";

// ══════════════════════════════════════════════════════════════════════════════
// Props
// ══════════════════════════════════════════════════════════════════════════════

interface CompareReviewCenterWorkWindowProps {
  open: boolean;
  onClose: () => void;
  compareId: string;
  requestReference: string;
  initialOptions: CompareOption[];
  isReopened?: boolean;
  reopenReason?: string;
  previousShortlistIds?: string[];
  onReviewCompleted: (state: CompareReviewCenterState) => void;
  onApprovalHandoff: () => void;
  onFollowupRequest: (optionIds: string[]) => void;
}

// ══════════════════════════════════════════════════════════════════════════════
// Reason Configs
// ══════════════════════════════════════════════════════════════════════════════

const SELECTION_REASONS: { code: SelectionReasonCode; label: string }[] = [
  { code: "price", label: "가격 우위" },
  { code: "lead_time", label: "납기 우위" },
  { code: "preferred_vendor", label: "선호 공급사" },
  { code: "availability", label: "재고 확보" },
  { code: "spec_match", label: "규격 적합" },
  { code: "policy_fit", label: "정책 부합" },
  { code: "prior_history", label: "거래 이력" },
];

const EXCLUSION_REASONS: { code: ExclusionReasonCode; label: string }[] = [
  { code: "price_too_high", label: "가격 과다" },
  { code: "lead_time_too_long", label: "납기 초과" },
  { code: "spec_mismatch", label: "규격 불일치" },
  { code: "availability_issue", label: "재고 문제" },
  { code: "vendor_risk", label: "공급사 리스크" },
  { code: "policy_violation", label: "정책 위반" },
];

const STATUS_CONFIG: Record<OptionReviewStatus, { label: string; color: string; bg: string }> = {
  pending_review: { label: "미검토", color: "text-slate-500", bg: "bg-slate-700/30" },
  shortlisted: { label: "Shortlist", color: "text-emerald-400", bg: "bg-emerald-600/10" },
  excluded: { label: "제외", color: "text-red-400", bg: "bg-red-600/10" },
  needs_followup: { label: "확인 필요", color: "text-amber-400", bg: "bg-amber-600/10" },
};

// ══════════════════════════════════════════════════════════════════════════════
// Component
// ══════════════════════════════════════════════════════════════════════════════

export function CompareReviewCenterWorkWindow({
  open,
  onClose,
  compareId,
  requestReference,
  initialOptions,
  isReopened = false,
  reopenReason = "",
  previousShortlistIds = [],
  onReviewCompleted,
  onApprovalHandoff,
  onFollowupRequest,
}: CompareReviewCenterWorkWindowProps) {
  const [reviewState, setReviewState] = useState<CompareReviewCenterState | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);

  // ── Init ──
  useMemo(() => {
    if (open && initialOptions.length > 0 && !reviewState) {
      setReviewState(
        createInitialCompareReviewCenterState(compareId, requestReference, initialOptions, {
          isReopened,
          reopenedAt: isReopened ? new Date().toISOString() : null,
          reopenedBy: isReopened ? "operator" : null,
          reopenReason,
          reopenCount: isReopened ? 1 : 0,
          previousShortlistIds,
          previousExcludedIds: [],
        }),
      );
    }
  }, [open, initialOptions.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived ──
  const validation = useMemo(
    () => (reviewState ? validateCompareReviewCompletion(reviewState) : null),
    [reviewState],
  );

  const shortlistedCount = reviewState?.options.filter((o) => o.reviewStatus === "shortlisted").length ?? 0;
  const excludedCount = reviewState?.options.filter((o) => o.reviewStatus === "excluded").length ?? 0;
  const pendingCount = reviewState?.options.filter((o) => o.reviewStatus === "pending_review").length ?? 0;
  const followupCount = reviewState?.options.filter((o) => o.reviewStatus === "needs_followup").length ?? 0;

  // ── Actions ──
  const setOptionStatus = useCallback(
    (optionId: string, status: OptionReviewStatus, reasons?: SelectionReasonCode[] | ExclusionReasonCode[]) => {
      setReviewState((prev) => {
        if (!prev) return prev;
        const rationale: any = {};
        if (status === "shortlisted" && reasons) rationale.selectionReasonCodes = reasons;
        if (status === "excluded" && reasons) rationale.exclusionReasonCodes = reasons;
        return updateOptionReviewStatus(prev, optionId, status, rationale);
      });
    },
    [],
  );

  const handleMarkCompleted = useCallback(() => {
    if (!reviewState || !validation?.canMarkCompleted) return;
    const completed = markCompareReviewCompleted(reviewState);
    setReviewState(completed);
    onReviewCompleted(completed);
  }, [reviewState, validation, onReviewCompleted]);

  const handleHandoff = useCallback(() => {
    if (!reviewState) return;
    const ready = markCompareReviewHandoffReady(reviewState);
    setReviewState(ready);
    onApprovalHandoff();
  }, [reviewState, onApprovalHandoff]);

  const handleFollowup = useCallback(() => {
    if (!reviewState) return;
    const followupIds = reviewState.options
      .filter((o) => o.reviewStatus === "needs_followup")
      .map((o) => o.optionId);
    onFollowupRequest(followupIds);
  }, [reviewState, onFollowupRequest]);

  if (!open || !reviewState) return null;

  const isCompleted = reviewState.compareReviewCenterStatus === "completed" || reviewState.compareReviewCenterStatus === "handoff_ready";
  const selectedOption = selectedOptionId ? reviewState.options.find((o) => o.optionId === selectedOptionId) : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#1C2028] border border-bd rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">

        {/* ═══ Review Status Bar ═══ */}
        <div className="px-5 py-2.5 border-b border-bd/60 bg-[#252A33] flex items-center justify-between">
          <div className="flex items-center gap-3">
            {reviewState.reopenMeta.isReopened && (
              <span className="text-[9px] px-2 py-0.5 rounded bg-amber-600/15 text-amber-300 font-medium border border-amber-500/20">
                <RefreshCw className="h-3 w-3 inline mr-0.5" />재검토 #{reviewState.reopenMeta.reopenCount}
              </span>
            )}
            <span className="text-[10px] text-slate-400">{reviewState.compareId}</span>
            <span className="text-slate-600">·</span>
            <span className="text-[10px] text-slate-500">{reviewState.nextRequiredAction}</span>
          </div>
          <button type="button" onClick={onClose} className="h-6 w-6 flex items-center justify-center rounded text-slate-500 hover:text-slate-300"><X className="h-3.5 w-3.5" /></button>
        </div>

        {/* ═══ A. Decision Header ═══ */}
        <div className="px-5 py-3 border-b border-bd/40">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-600/15 border border-blue-500/25">
                <GitCompare className="h-4 w-4 text-blue-400" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-100">Compare Review</h2>
                <span className="text-[10px] text-slate-500">{requestReference}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 text-[10px]">
            <span className="text-slate-400">옵션 <span className="text-slate-200 font-medium">{reviewState.options.length}</span></span>
            <span className="text-slate-600">·</span>
            <span className="text-emerald-400 font-medium">Shortlist {shortlistedCount}</span>
            <span className="text-slate-600">·</span>
            <span className="text-red-400">제외 {excludedCount}</span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-500">미검토 {pendingCount}</span>
            {followupCount > 0 && <><span className="text-slate-600">·</span><span className="text-amber-400">확인 필요 {followupCount}</span></>}
            {reviewState.reopenMeta.isReopened && (
              <><span className="text-slate-600">·</span><span className="text-amber-300 text-[9px]">사유: {reviewState.reopenMeta.reopenReason || "미지정"}</span></>
            )}
          </div>
        </div>

        {/* ═══ B. Option Review Table ═══ */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
          {/* Reopen previous decisions note */}
          {reviewState.reopenMeta.isReopened && reviewState.reopenMeta.previousShortlistIds.length > 0 && (
            <div className="px-3 py-2 rounded-md bg-amber-600/[0.04] border border-amber-500/15 mb-2">
              <span className="text-[9px] font-medium text-amber-400 block mb-0.5">이전 판단 기록</span>
              <span className="text-[10px] text-amber-200">이전 Shortlist: {reviewState.reopenMeta.previousShortlistIds.join(", ")}</span>
            </div>
          )}

          {reviewState.options.map((opt) => {
            const statusConfig = STATUS_CONFIG[opt.reviewStatus];
            const isSelected = selectedOptionId === opt.optionId;
            const wasPreviouslyShortlisted = reviewState.reopenMeta.previousShortlistIds.includes(opt.optionId);
            return (
              <div
                key={opt.optionId}
                className={`rounded-md border transition-all cursor-pointer ${isSelected ? "border-blue-500/30 bg-blue-600/[0.04]" : opt.reviewStatus === "shortlisted" ? "border-emerald-500/20 bg-emerald-600/[0.02]" : opt.reviewStatus === "excluded" ? "border-bd/40 bg-[#252A33] opacity-60" : "border-bd/40 bg-[#252A33]"}`}
                onClick={() => setSelectedOptionId(isSelected ? null : opt.optionId)}
              >
                {/* Row header */}
                <div className="flex items-center gap-3 px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-200 font-medium truncate">{opt.supplier}</span>
                      {wasPreviouslyShortlisted && <span className="text-[8px] px-1 py-0.5 rounded bg-slate-700/50 text-slate-500">이전 SL</span>}
                    </div>
                    <div className="flex items-center gap-2 text-[9px] text-slate-500 mt-0.5">
                      <span>{opt.itemName}</span>
                      <span>·</span>
                      <span>{opt.packSpec}</span>
                      {opt.priceKRW && <><span>·</span><span className="text-slate-300 tabular-nums">₩{opt.priceKRW.toLocaleString("ko-KR")}</span></>}
                      {opt.leadTimeDays && <><span>·</span><span>{opt.leadTimeDays}일</span></>}
                    </div>
                  </div>
                  {/* Status badge */}
                  <span className={`text-[9px] px-2 py-0.5 rounded font-medium ${statusConfig.color} ${statusConfig.bg}`}>{statusConfig.label}</span>
                  {/* Quick actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="sm" variant={opt.reviewStatus === "shortlisted" ? "default" : "ghost"}
                      className={`h-6 px-2 text-[9px] ${opt.reviewStatus === "shortlisted" ? "bg-emerald-600/15 text-emerald-400 border border-emerald-500/25" : "text-slate-500 border border-bd/30"}`}
                      onClick={(e) => { e.stopPropagation(); setOptionStatus(opt.optionId, "shortlisted", ["spec_match"]); }}
                      disabled={isCompleted}>
                      <Check className="h-3 w-3 mr-0.5" />SL
                    </Button>
                    <Button size="sm" variant="ghost"
                      className={`h-6 px-2 text-[9px] ${opt.reviewStatus === "excluded" ? "bg-red-600/10 text-red-400 border border-red-500/20" : "text-slate-500 border border-bd/30"}`}
                      onClick={(e) => { e.stopPropagation(); setOptionStatus(opt.optionId, "excluded", ["spec_mismatch"]); }}
                      disabled={isCompleted}>
                      <Minus className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="ghost"
                      className={`h-6 px-2 text-[9px] ${opt.reviewStatus === "needs_followup" ? "bg-amber-600/10 text-amber-400 border border-amber-500/20" : "text-slate-500 border border-bd/30"}`}
                      onClick={(e) => { e.stopPropagation(); setOptionStatus(opt.optionId, "needs_followup"); }}
                      disabled={isCompleted}>
                      <AlertTriangle className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {/* Expanded rationale (when selected) */}
                {isSelected && (
                  <div className="px-3 pb-3 pt-1 border-t border-bd/20 space-y-2">
                    {opt.reviewStatus === "shortlisted" && (
                      <div>
                        <span className="text-[9px] text-slate-500 block mb-1">선택 이유 (복수 선택)</span>
                        <div className="flex flex-wrap gap-1">
                          {SELECTION_REASONS.map((r) => {
                            const isActive = opt.rationale.selectionReasonCodes.includes(r.code);
                            return (
                              <button key={r.code} type="button" disabled={isCompleted}
                                onClick={(e) => { e.stopPropagation(); const codes = isActive ? opt.rationale.selectionReasonCodes.filter((c) => c !== r.code) : [...opt.rationale.selectionReasonCodes, r.code]; setOptionStatus(opt.optionId, "shortlisted", codes); }}
                                className={`text-[9px] px-2 py-0.5 rounded border transition-all ${isActive ? "bg-emerald-600/15 border-emerald-500/30 text-emerald-400" : "border-bd/40 text-slate-500 hover:text-slate-400"}`}>
                                {r.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {opt.reviewStatus === "excluded" && (
                      <div>
                        <span className="text-[9px] text-slate-500 block mb-1">제외 이유 (복수 선택)</span>
                        <div className="flex flex-wrap gap-1">
                          {EXCLUSION_REASONS.map((r) => {
                            const isActive = opt.rationale.exclusionReasonCodes.includes(r.code);
                            return (
                              <button key={r.code} type="button" disabled={isCompleted}
                                onClick={(e) => { e.stopPropagation(); const codes = isActive ? opt.rationale.exclusionReasonCodes.filter((c) => c !== r.code) : [...opt.rationale.exclusionReasonCodes, r.code]; setOptionStatus(opt.optionId, "excluded", codes); }}
                                className={`text-[9px] px-2 py-0.5 rounded border transition-all ${isActive ? "bg-red-600/10 border-red-500/20 text-red-400" : "border-bd/40 text-slate-500 hover:text-slate-400"}`}>
                                {r.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {/* Risk flags */}
                    {opt.riskFlags.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {opt.riskFlags.map((flag, i) => (
                          <span key={i} className="text-[8px] px-1.5 py-0.5 rounded bg-amber-600/10 text-amber-400">{flag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* C. Decision Summary (when completed) */}
          {reviewState.decisionSummary && (
            <div className="px-3 py-3 rounded-md bg-emerald-600/[0.06] border border-emerald-500/15 space-y-1">
              <div className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /><span className="text-[11px] text-emerald-300 font-medium">검토 완료</span></div>
              <span className="text-[10px] text-slate-400">Shortlist {reviewState.decisionSummary.shortlistedOptionIds.length}개 · {reviewState.decisionSummary.exclusionSummary}{reviewState.decisionSummary.followupRequired ? " · 후속 확인 필요" : ""}</span>
            </div>
          )}

          {/* Validation warnings */}
          {validation && validation.blockingIssues.length > 0 && !isCompleted && (
            <div className="space-y-1">
              {validation.blockingIssues.map((b, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-md bg-red-600/[0.06] border border-red-500/15">
                  <AlertTriangle className="h-3 w-3 text-red-400 shrink-0" /><span className="text-[10px] text-red-300">{b}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ═══ Sticky Action Dock ═══ */}
        <div className="px-5 py-3 border-t border-bd bg-[#181E28]">
          <div className="flex items-center gap-3 text-[10px] mb-2.5">
            <span className="text-emerald-400 font-medium">SL {shortlistedCount}</span>
            <span className="text-slate-600">·</span>
            <span className="text-red-400">제외 {excludedCount}</span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-500">미검토 {pendingCount}</span>
            {followupCount > 0 && <><span className="text-slate-600">·</span><span className="text-amber-400">확인 {followupCount}</span></>}
            <span className="text-slate-600">·</span>
            <span className="text-slate-500">{validation?.recommendedNextAction || ""}</span>
          </div>
          <div className="flex gap-2">
            {!isCompleted ? (
              <>
                {followupCount > 0 && (
                  <Button size="sm" variant="ghost" className="h-8 px-3 text-[10px] text-amber-400 hover:text-amber-300 border border-amber-500/20" onClick={handleFollowup}>
                    <AlertTriangle className="h-3 w-3 mr-1" />후속 확인 요청
                  </Button>
                )}
                <Button size="sm" className="flex-1 h-8 text-[10px] bg-blue-600 hover:bg-blue-500 text-white font-medium"
                  onClick={handleMarkCompleted} disabled={!validation?.canMarkCompleted}>
                  <Check className="h-3 w-3 mr-1" />검토 완료로 표시
                </Button>
              </>
            ) : reviewState.compareReviewCenterStatus === "completed" ? (
              <Button size="sm" className="flex-1 h-8 text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white font-medium" onClick={handleHandoff}>
                <ShieldCheck className="h-3 w-3 mr-1" />Approval로 넘기기<ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            ) : (
              <div className="flex-1 text-center text-[10px] text-emerald-400 py-2">Approval Handoff 준비 완료</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
