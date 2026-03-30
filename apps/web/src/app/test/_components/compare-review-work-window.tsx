"use client";

import { useMemo, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { X, Check, Minus, AlertTriangle, ArrowRight, GitCompare, TrendingDown, Clock, Package, FileText, Undo2, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import {
  type CompareReviewState,
  type CompareCandidateInfo,
  type CompareDecisionPayload,
  type CompareDecisionSnapshot,
  type RequestCandidateHandoff,
  type ClassifiedCandidate,
  validateCompareCategoryIntegrity,
  buildCompareDifferenceSummary,
  buildCompareDecisionSnapshot,
  buildRequestCandidateHandoffFromCompare,
  createInitialCompareReviewState,
  classifyCandidatesForReview,
  buildAiVerdictSummary,
} from "@/lib/ai/compare-review-engine";

// ══════════════════════════════════════════════════════════════════════════════
// Props
// ══════════════════════════════════════════════════════════════════════════════

interface AiOptionPreview {
  id: string;
  frame: "conservative" | "balanced" | "alternative";
  title: string;
  rationale: string;
  strengths: string[];
  risks: Array<{ label: string; severity: string } | string>;
  nextAction: string;
}

interface CompareReviewWorkWindowProps {
  open: boolean;
  onClose: () => void;
  compareIds: string[];
  products: any[];
  openedBy: "ai_apply" | "manual";
  aiOptionId?: string | null;
  aiOptions?: AiOptionPreview[];
  onShortlistApplied: (shortlistIds: string[], requestCandidateIds: string[]) => void;
  onRequestHandoff: (handoff: RequestCandidateHandoff) => void;
  onUndoDecision: () => void;
}

// ══════════════════════════════════════════════════════════════════════════════
// Component
// ══════════════════════════════════════════════════════════════════════════════

export function CompareReviewWorkWindow({
  open,
  onClose,
  compareIds,
  products,
  openedBy,
  aiOptionId,
  aiOptions = [],
  onShortlistApplied,
  onRequestHandoff,
  onUndoDecision,
}: CompareReviewWorkWindowProps) {
  // ── Mode state ── AI가 기본 진입, 기본 비교는 fallback
  const hasAiOptions = aiOptions.length === 3;
  const [surfaceMode, setSurfaceMode] = useState<"ai" | "basic">(hasAiOptions ? "ai" : "basic");
  const isAiMode = surfaceMode === "ai" && hasAiOptions;

  // ── AI strategy state — default: 비용 우선 (conservative) ──
  const [activeAiFrame, setActiveAiFrame] = useState<"conservative" | "balanced" | "alternative">("conservative");

  // ── Collapsed sections ──
  const [showReferenceGroup, setShowReferenceGroup] = useState(false);
  const [showMatrix, setShowMatrix] = useState(false);

  // ── Candidate resolution ──
  const candidates = useMemo<CompareCandidateInfo[]>(() => {
    return compareIds.map((id) => {
      const p = products.find((pp: any) => pp.id === id);
      if (!p) return null;
      const v = p.vendors?.[0];
      return {
        id: p.id,
        name: p.name,
        brand: p.brand || "",
        category: p.category || "",
        catalogNumber: p.catalogNumber || "",
        spec: p.specification || p.packSize || "",
        priceKRW: v?.priceInKRW || 0,
        leadTimeDays: v?.leadTimeDays || 0,
      };
    }).filter(Boolean) as CompareCandidateInfo[];
  }, [compareIds, products]);

  // ── Validation + Difference + Classification ──
  const categoryResult = useMemo(() => validateCompareCategoryIntegrity(candidates), [candidates]);
  const differenceSummary = useMemo(() => buildCompareDifferenceSummary(candidates), [candidates]);
  const classifiedCandidates = useMemo(() => classifyCandidatesForReview(candidates, categoryResult, differenceSummary), [candidates, categoryResult, differenceSummary]);
  const aiVerdict = useMemo(() => buildAiVerdictSummary(classifiedCandidates), [classifiedCandidates]);

  // 분류별 그룹
  const directGroup = useMemo(() => classifiedCandidates.filter((c) => c.candidateClass === "direct"), [classifiedCandidates]);
  const referenceGroup = useMemo(() => classifiedCandidates.filter((c) => c.candidateClass === "reference"), [classifiedCandidates]);
  const blockedGroup = useMemo(() => classifiedCandidates.filter((c) => c.candidateClass === "blocked"), [classifiedCandidates]);

  // ── Blocker summary one-liner ──
  const blockerSummaryChips = useMemo(() => {
    const chips: Array<{ id: string; label: string; tone: string }> = [];
    if (directGroup.length > 0) {
      chips.push({ id: "direct", label: `선택 가능 ${directGroup.length}건`, tone: "emerald" });
    }
    if (categoryResult.compareMode === "mixed_warning") {
      chips.push({ id: "mixed", label: "직접 비교 불가 — 혼합 카테고리", tone: "amber" });
    } else if (categoryResult.compareMode !== "direct") {
      chips.push({ id: "incompat", label: "비교 불가 후보 포함", tone: "red" });
    }
    if (referenceGroup.length > 0) {
      chips.push({ id: "ref", label: `규격 재확인 필요 ${referenceGroup.length}건`, tone: "amber" });
    }
    if (blockedGroup.length > 0) {
      chips.push({ id: "blocked", label: `제외·보류 ${blockedGroup.length}건`, tone: "red" });
    }
    return chips;
  }, [directGroup.length, referenceGroup.length, blockedGroup.length, categoryResult.compareMode]);

  // ── Review state ──
  const [reviewState, setReviewState] = useState<CompareReviewState | null>(null);
  const [shortlistIds, setShortlistIds] = useState<Set<string>>(new Set());
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [decisionSnapshot, setDecisionSnapshot] = useState<CompareDecisionSnapshot | null>(null);

  useMemo(() => {
    if (open && candidates.length >= 2 && !reviewState) {
      setReviewState(createInitialCompareReviewState(compareIds, categoryResult, openedBy, aiOptionId));
      setShortlistIds(new Set(compareIds));
      setExcludedIds(new Set());
    }
  }, [open, candidates.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Actions ──
  const toggleShortlist = useCallback((id: string) => {
    setShortlistIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
    setExcludedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const toggleExclude = useCallback((id: string) => {
    setExcludedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
    setShortlistIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const recordDecision = useCallback(() => {
    if (!reviewState) return;
    const sl = [...shortlistIds];
    const ex = [...excludedIds];
    const held = compareIds.filter((id) => !shortlistIds.has(id) && !excludedIds.has(id));
    const payload: CompareDecisionPayload = {
      shortlistIds: sl,
      excludedIds: ex,
      heldIds: held,
      requestCandidateIds: sl,
      decisionReasonSummary: `선택 후보 ${sl.length}개, 제외 ${ex.length}개`,
    };
    const snapshot = buildCompareDecisionSnapshot(reviewState, differenceSummary, payload, {
      aiDefaultOptionId: aiOptionId ?? "conservative",
      aiPreviewOptionIdAtDecision: activeAiFrame,
      operatorOverrideFlag: hasAiOptions && activeAiFrame !== (aiOptionId ?? "conservative"),
    });
    setDecisionSnapshot(snapshot);
    onShortlistApplied(sl, sl);
    setReviewState((prev) => prev ? {
      ...prev,
      compareReviewStatus: "compare_shortlist_recorded",
      substatus: "ready_for_request_candidate",
      compareShortlistIds: sl,
      compareExcludedIds: ex,
      compareHeldIds: held,
      compareDecisionSnapshotId: snapshot.id,
      compareDecisionSummary: payload.decisionReasonSummary,
    } : prev);
  }, [reviewState, shortlistIds, excludedIds, compareIds, differenceSummary, onShortlistApplied]);

  const handleRequestHandoff = useCallback(() => {
    if (!decisionSnapshot) return;
    const handoff = buildRequestCandidateHandoffFromCompare(decisionSnapshot);
    onRequestHandoff(handoff);
  }, [decisionSnapshot, onRequestHandoff]);

  const handleUndo = useCallback(() => {
    setDecisionSnapshot(null);
    setShortlistIds(new Set(compareIds));
    setExcludedIds(new Set());
    onUndoDecision();
  }, [compareIds, onUndoDecision]);

  if (!open) return null;

  const isDecisionRecorded = !!decisionSnapshot;
  const shortlistCount = shortlistIds.size;
  const excludedCount = excludedIds.size;

  const compareModeLabel =
    categoryResult.compareMode === "direct" ? "직접 비교 가능" :
    categoryResult.compareMode === "mixed_warning" ? "혼합 카테고리" : "비교 불가";
  const compareModeColor =
    categoryResult.compareMode === "direct" ? "text-emerald-400" :
    categoryResult.compareMode === "mixed_warning" ? "text-amber-400" : "text-red-400";

  // ── Candidate card renderer ──
  const renderCandidateCard = (cl: ClassifiedCandidate, variant: "direct" | "reference") => {
    const c = candidates.find((cc) => cc.id === cl.id);
    if (!c) return null;
    const isShortlisted = shortlistIds.has(c.id);
    const isExcluded = excludedIds.has(c.id);
    const isDirect = variant === "direct";

    const cardBg = isShortlisted
      ? "border-emerald-500/40 bg-emerald-950/50"
      : isExcluded
        ? "border-red-500/25 bg-red-950/25 opacity-50"
        : isDirect
          ? "border-slate-500/40 bg-[#1e2128]"
          : "border-slate-600/30 bg-[#1a1d22]";

    return (
      <div key={c.id} className={`px-6 py-5 rounded-xl border transition-all ${cardBg}`}>
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            {/* 제품명 — 18px bold, 가장 먼저 읽힘 */}
            <span className={`text-[18px] font-bold block truncate leading-snug ${isDirect ? "text-white" : "text-slate-200"}`}>{c.name}</span>
            {/* 가격 — 18px, 제품명 바로 아래 강조 */}
            <div className="flex items-center gap-3 mt-2">
              <span className={`text-[18px] font-bold ${isDirect ? "text-emerald-300" : "text-slate-300"}`}>
                {c.priceKRW > 0 ? `₩${c.priceKRW.toLocaleString("ko-KR")}` : "가격 미확인"}
              </span>
              {cl.deltaOneLiner && (
                <span className={`shrink-0 text-[13px] px-2.5 py-0.5 rounded-md font-semibold ${isDirect ? "bg-emerald-500/20 text-emerald-200 border border-emerald-500/25" : "bg-amber-500/15 text-amber-200 border border-amber-500/20"}`}>
                  {cl.deltaOneLiner}
                </span>
              )}
            </div>
            {/* 브랜드·카탈로그 — 14px 메타 */}
            <span className="text-[14px] text-slate-400 block mt-1.5 leading-relaxed">
              {c.brand}{c.catalogNumber ? ` · ${c.catalogNumber}` : ""}
            </span>
            {/* 판단 신호 — chip */}
            {!isDirect && cl.classReason && (
              <span className="inline-block text-[12px] text-amber-300 bg-amber-500/10 border border-amber-500/15 px-2.5 py-0.5 rounded mt-2">{cl.classReason}{cl.riskNote ? ` — ${cl.riskNote}` : ""}</span>
            )}
          </div>
          {/* 액션 버튼 — h-10, positive 강조, negative ghost */}
          <div className="flex items-center gap-2 shrink-0 pt-1">
            <button
              type="button"
              onClick={() => toggleShortlist(c.id)}
              disabled={isDecisionRecorded}
              className={`h-10 px-4 rounded-lg text-[13px] font-bold flex items-center gap-2 transition-all ${
                isShortlisted
                  ? "bg-emerald-500/30 text-emerald-100 border border-emerald-400/50"
                  : "text-slate-300 hover:text-emerald-200 hover:bg-emerald-500/15 border border-slate-600/50 hover:border-emerald-400/40"
              } ${isDecisionRecorded ? "opacity-40 cursor-not-allowed" : ""}`}
            >
              <Check className="h-4 w-4" />{isShortlisted ? "선택됨" : "선택"}
            </button>
            <button
              type="button"
              onClick={() => toggleExclude(c.id)}
              disabled={isDecisionRecorded}
              className={`h-10 px-3.5 rounded-lg text-[13px] font-medium flex items-center gap-2 transition-all ${
                isExcluded
                  ? "bg-red-500/20 text-red-300 border border-red-500/30"
                  : "text-slate-500 hover:text-red-300 hover:bg-red-500/10 border border-slate-700/40"
              } ${isDecisionRecorded ? "opacity-40 cursor-not-allowed" : ""}`}
            >
              <Minus className="h-4 w-4" />제외
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#181b21] border border-slate-600/50 rounded-2xl shadow-2xl w-full max-w-[1080px] max-h-[82vh] overflow-hidden flex flex-col">

        {/* ═══════════════════════════════════════════════════════════════════
            HEADER — 20px title, AI 기본 진입, 기본 비교는 secondary
        ═══════════════════════════════════════════════════════════════════ */}
        <div className="px-8 py-5 border-b border-slate-600/40 bg-[#1e2128] flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${isAiMode ? "bg-blue-600/20 border-blue-500/30" : "bg-slate-600/20 border-slate-500/30"}`}>
              {isAiMode
                ? <Sparkles className="h-5 w-5 text-blue-400" />
                : <GitCompare className="h-5 w-5 text-slate-400" />
              }
            </div>
            <div>
              <h2 className="text-[20px] font-bold text-white leading-tight">
                {isAiMode ? "AI 비교 판단" : "기본 비교"}
              </h2>
              <div className="flex items-center gap-2.5 text-[14px] mt-1">
                <span className="text-slate-400">후보 <span className="text-slate-100 font-semibold">{candidates.length}개</span></span>
                <span className="text-slate-600">·</span>
                <span className={compareModeColor}>{compareModeLabel}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {hasAiOptions && (
              <button
                type="button"
                onClick={() => setSurfaceMode(isAiMode ? "basic" : "ai")}
                className="flex items-center gap-2 text-[13px] text-slate-400 hover:text-slate-200 px-3.5 py-2 rounded-lg border border-slate-600/40 hover:border-slate-500/60 transition-colors"
              >
                {isAiMode ? <><GitCompare className="h-3.5 w-3.5" />기본 비교</> : <><Sparkles className="h-3.5 w-3.5" />AI 판단</>}
              </button>
            )}
            <button type="button" onClick={onClose} className="h-9 w-9 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/[0.08] transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            BLOCKER SUMMARY BAR
        ═══════════════════════════════════════════════════════════════════ */}
        <div className="px-8 py-3 border-b border-slate-700/40 bg-[#1a1d23] flex items-center gap-2.5 flex-wrap">
          {blockerSummaryChips.length === 0 ? (
            <span className="text-[13px] text-slate-500">비교 상태 확인 중…</span>
          ) : (
            blockerSummaryChips.map((chip) => (
              <span
                key={chip.id}
                className={`text-[13px] font-semibold px-3 py-1 rounded-full ${
                  chip.tone === "emerald"
                    ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20"
                    : chip.tone === "amber"
                      ? "bg-amber-500/12 text-amber-300 border border-amber-500/15"
                      : "bg-red-500/12 text-red-400 border border-red-500/15"
                }`}
              >
                {chip.label}
              </span>
            ))
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            AI STRATEGY SELECTOR — 15px bold, radio segment
        ═══════════════════════════════════════════════════════════════════ */}
        {isAiMode && (
          <div className="px-8 py-4 border-b border-slate-700/30 bg-[#1a1c22]">
            <div className="flex gap-1.5 p-1.5 rounded-xl bg-[#12151a] border border-slate-600/35">
              {(["conservative", "balanced", "alternative"] as const).map((frame) => {
                const label = frame === "conservative" ? "비용 우선" : frame === "balanced" ? "납기·가격 균형" : "규격 신뢰";
                const isActive = activeAiFrame === frame;
                return (
                  <button
                    key={frame}
                    type="button"
                    onClick={() => setActiveAiFrame(frame)}
                    className={`flex-1 py-3 text-center rounded-lg text-[15px] font-bold transition-all ${
                      isActive
                        ? "bg-blue-600/25 text-blue-100 border border-blue-500/40 shadow-sm shadow-blue-500/10"
                        : "text-slate-400 hover:text-slate-200 border border-transparent hover:bg-white/[0.04]"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            SCROLLABLE BODY — Decision Surface
        ═══════════════════════════════════════════════════════════════════ */}
        <div className="flex-1 overflow-y-auto">

          {/* ── ZONE A: 우선 검토 후보 (direct) ── */}
          {directGroup.length > 0 && (
            <div className="px-8 pt-7 pb-6 bg-[#181b21]">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-3 h-3 rounded bg-emerald-400" />
                <span className="text-[16px] font-bold text-emerald-300">우선 검토 후보</span>
                <span className="text-[14px] text-slate-400 font-medium">{directGroup.length}개</span>
              </div>
              <div className="space-y-4">
                {directGroup.map((cl) => renderCandidateCard(cl, "direct"))}
              </div>
            </div>
          )}

          {/* ── ZONE B: 참고 후보 (reference) — 접기 기본값 ── */}
          {referenceGroup.length > 0 && (
            <div className="border-t border-slate-600/30 bg-[#171a1f]">
              <button
                type="button"
                onClick={() => setShowReferenceGroup(!showReferenceGroup)}
                className="w-full flex items-center gap-3 px-8 py-4 text-left hover:bg-white/[0.02] transition-colors"
              >
                <div className="w-2.5 h-2.5 rounded bg-amber-400/70" />
                <span className="text-[15px] font-semibold text-amber-300">참고 후보</span>
                <span className="text-[13px] text-slate-500 font-medium">{referenceGroup.length}개 — 직접 비교 제한</span>
                {showReferenceGroup
                  ? <ChevronUp className="ml-auto h-4 w-4 text-slate-500" />
                  : <ChevronDown className="ml-auto h-4 w-4 text-slate-500" />
                }
              </button>
              {showReferenceGroup && (
                <div className="px-8 pb-5 space-y-3">
                  {referenceGroup.map((cl) => renderCandidateCard(cl, "reference"))}
                </div>
              )}
            </div>
          )}

          {/* ── ZONE C: 제외·보류 (blocked) ── */}
          {blockedGroup.length > 0 && (
            <div className="px-8 py-5 border-t border-slate-700/30 bg-[#161820]">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-2.5 h-2.5 rounded bg-red-400/60" />
                <span className="text-[14px] font-semibold text-red-300/80">제외·보류</span>
                <span className="text-[13px] text-slate-500">{blockedGroup.length}개</span>
              </div>
              <div className="space-y-2">
                {blockedGroup.map((cl) => {
                  const c = candidates.find((cc) => cc.id === cl.id);
                  if (!c) return null;
                  return (
                    <div key={c.id} className="flex items-center gap-4 px-5 py-3.5 rounded-lg border border-red-500/15 bg-red-950/15">
                      <div className="flex-1 min-w-0">
                        <span className="text-[14px] text-slate-400 font-medium block truncate">{c.name}</span>
                        <span className="text-[12px] text-red-400/60 block mt-0.5">{cl.classReason}</span>
                      </div>
                      <span className="shrink-0 text-[12px] px-3 py-1 rounded-md bg-red-500/12 text-red-400/80 font-medium border border-red-500/15">{cl.suggestedAction === "hold" ? "보류" : "제외"}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── ZONE D: 핵심 차이 — 대비 복구, 가시 영역 확보 ── */}
          <div className="border-t border-slate-600/30 bg-[#161820]">
            <div className="px-8 py-5">
              <span className="text-[12px] font-bold text-slate-400 uppercase tracking-wider">핵심 차이</span>
              <div className="mt-3 grid grid-cols-2 gap-2.5">
                {differenceSummary.priceAdvantage && (
                  <div className="px-4 py-3 rounded-lg border border-slate-600/30 bg-[#1c1f26]">
                    <div className="flex items-center gap-1.5 mb-1">
                      <TrendingDown className="h-3.5 w-3.5 text-emerald-500/60" />
                      <span className="text-[11px] text-slate-400 font-medium">가격</span>
                    </div>
                    <span className="text-[13px] text-slate-300 leading-relaxed">{differenceSummary.priceAdvantage.label}</span>
                  </div>
                )}
                {differenceSummary.leadTimeAdvantage && (
                  <div className="px-4 py-3 rounded-lg border border-slate-600/30 bg-[#1c1f26]">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Clock className="h-3.5 w-3.5 text-blue-500/60" />
                      <span className="text-[11px] text-slate-400 font-medium">납기</span>
                    </div>
                    <span className="text-[13px] text-slate-300 leading-relaxed">{differenceSummary.leadTimeAdvantage.label}</span>
                  </div>
                )}
                <div className="px-4 py-3 rounded-lg border border-slate-600/30 bg-[#1c1f26]">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Package className="h-3.5 w-3.5 text-slate-500/60" />
                    <span className="text-[11px] text-slate-400 font-medium">규격</span>
                  </div>
                  <span className="text-[13px] text-slate-300 leading-relaxed">{differenceSummary.specFitNote}</span>
                </div>
                <div className="px-4 py-3 rounded-lg border border-slate-600/30 bg-[#1c1f26]">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Package className="h-3.5 w-3.5 text-slate-500/60" />
                    <span className="text-[11px] text-slate-400 font-medium">브랜드</span>
                  </div>
                  <span className="text-[13px] text-slate-300 leading-relaxed">{differenceSummary.brandNote}</span>
                </div>
              </div>
            </div>

            {/* 상세 비교표 — collapsed */}
            <div className="px-8 py-3 border-t border-slate-700/25">
              <button
                type="button"
                onClick={() => setShowMatrix(!showMatrix)}
                className="w-full flex items-center justify-between py-1.5 group"
              >
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-slate-400 transition-colors">상세 비교표</span>
                {showMatrix
                  ? <ChevronUp className="h-4 w-4 text-slate-500" />
                  : <ChevronDown className="h-4 w-4 text-slate-500" />
                }
              </button>
              {showMatrix && (
                <div className="mt-2 border border-slate-600/35 rounded-lg overflow-hidden mb-3">
                  <div className="grid bg-[#1e2128] border-b border-slate-600/30" style={{ gridTemplateColumns: `1fr repeat(${candidates.length}, minmax(0, 1fr))` }}>
                    <div className="px-4 py-2.5 text-[11px] text-slate-400 font-semibold">항목</div>
                    {candidates.map((c) => (
                      <div key={c.id} className="px-4 py-2.5 text-[12px] text-slate-300 font-semibold truncate border-l border-slate-700/30">{c.brand || c.name}</div>
                    ))}
                  </div>
                  {[
                    { label: "제품명", getter: (c: CompareCandidateInfo) => c.name },
                    { label: "카탈로그", getter: (c: CompareCandidateInfo) => c.catalogNumber || "—" },
                    { label: "규격", getter: (c: CompareCandidateInfo) => c.spec || "—" },
                    { label: "단가", getter: (c: CompareCandidateInfo) => c.priceKRW > 0 ? `₩${c.priceKRW.toLocaleString("ko-KR")}` : "견적 필요" },
                    { label: "납기", getter: (c: CompareCandidateInfo) => c.leadTimeDays > 0 ? `${c.leadTimeDays}영업일` : "확인 필요" },
                  ].map((row, ri) => (
                    <div key={ri} className="grid border-b border-slate-700/20 last:border-b-0" style={{ gridTemplateColumns: `1fr repeat(${candidates.length}, minmax(0, 1fr))` }}>
                      <div className="px-4 py-2 text-[11px] text-slate-500 font-medium">{row.label}</div>
                      {candidates.map((c) => (
                        <div key={c.id} className="px-4 py-2 text-[13px] text-slate-300 truncate border-l border-slate-700/20">{row.getter(c)}</div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            STICKY DOCK — 주 CTA (h-12, 15px bold)
        ═══════════════════════════════════════════════════════════════════ */}
        <div className="px-8 py-5 border-t border-slate-600/50 bg-[#1e2128]">
          {!isDecisionRecorded ? (
            <div className="flex items-center gap-4">
              <div className="text-[13px] text-slate-400 shrink-0">
                선택 <span className="text-white font-bold">{shortlistCount}</span>
                {excludedCount > 0 && <> · 제외 <span className="text-slate-300 font-semibold">{excludedCount}</span></>}
              </div>
              <Button
                className="flex-1 h-12 text-[15px] font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-xl"
                onClick={recordDecision}
                disabled={shortlistCount === 0 || !categoryResult.isComparable}
              >
                <Check className="h-5 w-5 mr-2" />
                {shortlistCount > 0
                  ? `선택한 ${shortlistCount}건으로 비교 계속`
                  : "후보를 1개 이상 선택하세요"
                }
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-emerald-950/40 border border-emerald-500/25 flex-1 min-w-0">
                <Check className="h-5 w-5 text-emerald-400 shrink-0" />
                <span className="text-[14px] text-emerald-200 font-bold truncate">후보 {shortlistCount}건 저장됨</span>
                <button type="button" onClick={handleUndo} className="ml-auto shrink-0 text-[13px] text-blue-400 hover:text-blue-300 flex items-center gap-1.5 font-semibold">
                  <Undo2 className="h-4 w-4" />되돌리기
                </button>
              </div>
              <Button
                className="h-12 px-6 text-[15px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl whitespace-nowrap shrink-0"
                onClick={handleRequestHandoff}
              >
                <FileText className="h-5 w-5 mr-2" />
                견적 후보로 반영
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
