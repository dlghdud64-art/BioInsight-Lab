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
      ? "border-emerald-500/35 bg-emerald-950/40"
      : isExcluded
        ? "border-red-500/20 bg-red-950/20 opacity-45"
        : isDirect
          ? "border-slate-600/35 bg-slate-800/50"
          : "border-slate-700/25 bg-slate-800/25";

    return (
      <div key={c.id} className={`px-4 py-4 rounded-lg border transition-all ${cardBg}`}>
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            {/* 제품명 — 가장 크게 */}
            <span className={`text-[14px] font-bold block truncate leading-snug ${isDirect ? "text-slate-50" : "text-slate-300"}`}>{c.name}</span>
            {/* delta one-liner — 바로 아래 */}
            <div className="flex items-center gap-2 mt-1.5">
              <span className={`text-[13px] font-semibold ${isDirect ? "text-emerald-300" : "text-slate-400"}`}>
                {c.priceKRW > 0 ? `₩${c.priceKRW.toLocaleString("ko-KR")}` : "가격 미확인"}
              </span>
              {cl.deltaOneLiner && (
                <span className={`shrink-0 text-[11px] px-2 py-0.5 rounded font-medium ${isDirect ? "bg-emerald-500/20 text-emerald-200" : "bg-amber-500/15 text-amber-300"}`}>
                  {cl.deltaOneLiner}
                </span>
              )}
            </div>
            {/* 브랜드·카탈로그 — 메타 2행 */}
            <span className="text-[11px] text-slate-600 block mt-1">
              {c.brand}{c.catalogNumber ? ` · ${c.catalogNumber}` : ""}
            </span>
            {!isDirect && cl.classReason && (
              <span className="text-[10px] text-amber-400/60 block mt-1">{cl.classReason}{cl.riskNote ? ` — ${cl.riskNote}` : ""}</span>
            )}
          </div>
          {/* 액션 버튼 — positive 강조, negative ghost */}
          <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
            <button
              type="button"
              onClick={() => toggleShortlist(c.id)}
              disabled={isDecisionRecorded}
              className={`h-9 px-3.5 rounded-md text-[12px] font-bold flex items-center gap-1.5 transition-all ${
                isShortlisted
                  ? "bg-emerald-500/25 text-emerald-200 border border-emerald-500/40"
                  : "text-slate-400 hover:text-emerald-300 hover:bg-emerald-500/15 border border-slate-700/50 hover:border-emerald-500/30"
              } ${isDecisionRecorded ? "opacity-40 cursor-not-allowed" : ""}`}
            >
              <Check className="h-3.5 w-3.5" />{isShortlisted ? "선택됨" : "선택"}
            </button>
            <button
              type="button"
              onClick={() => toggleExclude(c.id)}
              disabled={isDecisionRecorded}
              className={`h-9 px-3 rounded-md text-[12px] font-medium flex items-center gap-1.5 transition-all ${
                isExcluded
                  ? "bg-red-500/15 text-red-400 border border-red-500/25"
                  : "text-slate-600 hover:text-red-400 hover:bg-red-500/10 border border-slate-800/50"
              } ${isDecisionRecorded ? "opacity-40 cursor-not-allowed" : ""}`}
            >
              <Minus className="h-3.5 w-3.5" />제외
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#13151a] border border-slate-700/40 rounded-xl shadow-2xl w-full max-w-3xl max-h-[88vh] overflow-hidden flex flex-col">

        {/* ═══════════════════════════════════════════════════════════════════
            HEADER — Identity + Mode Switch
            AI 비교 판단이 기본. 기본 비교는 secondary text button.
        ═══════════════════════════════════════════════════════════════════ */}
        <div className="px-5 py-4 border-b border-slate-700/40 bg-[#1c1e24] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${isAiMode ? "bg-blue-600/15 border-blue-500/25" : "bg-slate-600/15 border-slate-500/25"}`}>
              {isAiMode
                ? <Sparkles className="h-4 w-4 text-blue-400" />
                : <GitCompare className="h-4 w-4 text-slate-400" />
              }
            </div>
            <div>
              <h2 className="text-[16px] font-bold text-slate-50">
                {isAiMode ? "AI 비교 판단" : "기본 비교"}
              </h2>
              <div className="flex items-center gap-2 text-[12px] mt-0.5">
                <span className="text-slate-400">후보 <span className="text-slate-200 font-semibold">{candidates.length}개</span></span>
                <span className="text-slate-600">·</span>
                <span className={compareModeColor}>{compareModeLabel}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* 기본 비교는 secondary text button */}
            {hasAiOptions && (
              <button
                type="button"
                onClick={() => setSurfaceMode(isAiMode ? "basic" : "ai")}
                className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-300 px-2.5 py-1.5 rounded border border-slate-700/35 hover:border-slate-600/50 transition-colors"
              >
                {isAiMode ? <><GitCompare className="h-3 w-3" />기본 비교</> : <><Sparkles className="h-3 w-3" />AI 판단</>}
              </button>
            )}
            <button type="button" onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-md text-slate-500 hover:text-slate-300 hover:bg-white/[0.06] transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            BLOCKER SUMMARY BAR — one-liner chip strip
            3초 안에 읽히는 상황 요약
        ═══════════════════════════════════════════════════════════════════ */}
        <div className="px-5 py-2.5 border-b border-slate-800/50 bg-[#15171c] flex items-center gap-2 flex-wrap">
          {blockerSummaryChips.length === 0 ? (
            <span className="text-[11px] text-slate-600">비교 상태 확인 중…</span>
          ) : (
            blockerSummaryChips.map((chip) => (
              <span
                key={chip.id}
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                  chip.tone === "emerald"
                    ? "bg-emerald-500/15 text-emerald-300"
                    : chip.tone === "amber"
                      ? "bg-amber-500/12 text-amber-300"
                      : "bg-red-500/12 text-red-400"
                }`}
              >
                {chip.label}
              </span>
            ))
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            AI STRATEGY SELECTOR — radio segment style, bigger labels
        ═══════════════════════════════════════════════════════════════════ */}
        {isAiMode && (
          <div className="px-5 py-3 border-b border-slate-700/20 bg-[#14161b]">
            <div className="flex gap-1 p-1 rounded-xl bg-[#0d1014] border border-slate-700/35">
              {(["conservative", "balanced", "alternative"] as const).map((frame) => {
                const label = frame === "conservative" ? "비용 우선" : frame === "balanced" ? "납기·가격 균형" : "규격 신뢰";
                const isActive = activeAiFrame === frame;
                return (
                  <button
                    key={frame}
                    type="button"
                    onClick={() => setActiveAiFrame(frame)}
                    className={`flex-1 py-2.5 text-center rounded-lg text-[13px] font-bold transition-all ${
                      isActive
                        ? "bg-blue-600/20 text-blue-100 border border-blue-500/35 shadow-sm"
                        : "text-slate-500 hover:text-slate-300 border border-transparent hover:bg-white/[0.03]"
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

          {/* ── ZONE A: 우선 검토 후보 (direct) — 최강 강조 ── */}
          {directGroup.length > 0 && (
            <div className="px-5 pt-5 pb-4 bg-[#14171d]">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-2.5 h-2.5 rounded bg-emerald-400" />
                <span className="text-[13px] font-bold text-emerald-300 tracking-wide">우선 검토 후보</span>
                <span className="text-[11px] text-slate-500 font-medium">{directGroup.length}개</span>
              </div>
              <div className="space-y-3">
                {directGroup.map((cl) => renderCandidateCard(cl, "direct"))}
              </div>
            </div>
          )}

          {/* ── ZONE B: 참고 후보 (reference) — 접기 기본값 ── */}
          {referenceGroup.length > 0 && (
            <div className="border-t border-slate-800/40 bg-[#13151a]">
              <button
                type="button"
                onClick={() => setShowReferenceGroup(!showReferenceGroup)}
                className="w-full flex items-center gap-2.5 px-5 py-3.5 text-left hover:bg-white/[0.02] transition-colors"
              >
                <div className="w-2 h-2 rounded bg-amber-400/60" />
                <span className="text-[12px] font-semibold text-amber-400/80">참고 후보</span>
                <span className="text-[11px] text-slate-600 font-medium">{referenceGroup.length}개 — 직접 비교 제한</span>
                {showReferenceGroup
                  ? <ChevronUp className="ml-auto h-3.5 w-3.5 text-slate-600" />
                  : <ChevronDown className="ml-auto h-3.5 w-3.5 text-slate-600" />
                }
              </button>
              {showReferenceGroup && (
                <div className="px-5 pb-4 space-y-2.5">
                  {referenceGroup.map((cl) => renderCandidateCard(cl, "reference"))}
                </div>
              )}
            </div>
          )}

          {/* ── ZONE C: 제외·보류 (blocked) — minimal ── */}
          {blockedGroup.length > 0 && (
            <div className="px-5 py-3 border-t border-slate-800/30 bg-[#111316]">
              <div className="flex items-center gap-2 mb-2.5">
                <div className="w-2 h-2 rounded bg-red-400/50" />
                <span className="text-[11px] font-semibold text-red-400/70">제외·보류</span>
                <span className="text-[10px] text-slate-700">{blockedGroup.length}개 — 비교 불가</span>
              </div>
              <div className="space-y-1.5">
                {blockedGroup.map((cl) => {
                  const c = candidates.find((cc) => cc.id === cl.id);
                  if (!c) return null;
                  return (
                    <div key={c.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-red-500/10 bg-red-950/10">
                      <div className="flex-1 min-w-0">
                        <span className="text-[12px] text-slate-500 font-medium block truncate">{c.name}</span>
                        <span className="text-[10px] text-red-400/50 block mt-0.5">{cl.classReason}</span>
                      </div>
                      <span className="shrink-0 text-[10px] px-2 py-0.5 rounded bg-red-500/10 text-red-400/70 font-medium">{cl.suggestedAction === "hold" ? "보류" : "제외"}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── ZONE D: 참고 정보 (핵심 차이 + 상세 비교표) — 최저 무게 ── */}
          <div className="border-t border-slate-800/20 bg-[#0f1114]">
            {/* 핵심 차이 */}
            <div className="px-5 py-3">
              <span className="text-[9px] font-semibold text-slate-700 uppercase tracking-widest">참고 — 핵심 차이</span>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {differenceSummary.priceAdvantage && (
                  <div className="px-2.5 py-1.5 rounded border border-slate-800/30 bg-[#13151a]">
                    <div className="flex items-center gap-1 mb-0.5">
                      <TrendingDown className="h-2.5 w-2.5 text-emerald-800/50" />
                      <span className="text-[8px] text-slate-700">가격</span>
                    </div>
                    <span className="text-[9px] text-slate-600">{differenceSummary.priceAdvantage.label}</span>
                  </div>
                )}
                {differenceSummary.leadTimeAdvantage && (
                  <div className="px-2.5 py-1.5 rounded border border-slate-800/30 bg-[#13151a]">
                    <div className="flex items-center gap-1 mb-0.5">
                      <Clock className="h-2.5 w-2.5 text-blue-800/50" />
                      <span className="text-[8px] text-slate-700">납기</span>
                    </div>
                    <span className="text-[9px] text-slate-600">{differenceSummary.leadTimeAdvantage.label}</span>
                  </div>
                )}
                <div className="px-2.5 py-1.5 rounded border border-slate-800/30 bg-[#13151a]">
                  <div className="flex items-center gap-1 mb-0.5">
                    <Package className="h-2.5 w-2.5 text-slate-800" />
                    <span className="text-[8px] text-slate-700">규격</span>
                  </div>
                  <span className="text-[9px] text-slate-600">{differenceSummary.specFitNote}</span>
                </div>
                <div className="px-2.5 py-1.5 rounded border border-slate-800/30 bg-[#13151a]">
                  <div className="flex items-center gap-1 mb-0.5">
                    <Package className="h-2.5 w-2.5 text-slate-800" />
                    <span className="text-[8px] text-slate-700">브랜드</span>
                  </div>
                  <span className="text-[9px] text-slate-600">{differenceSummary.brandNote}</span>
                </div>
              </div>
            </div>

            {/* 상세 비교표 — collapsed */}
            <div className="px-5 py-2 border-t border-slate-800/20">
              <button
                type="button"
                onClick={() => setShowMatrix(!showMatrix)}
                className="w-full flex items-center justify-between py-1 group"
              >
                <span className="text-[8px] font-medium text-slate-700 uppercase tracking-widest group-hover:text-slate-600 transition-colors">상세 비교표</span>
                {showMatrix
                  ? <ChevronUp className="h-3 w-3 text-slate-700" />
                  : <ChevronDown className="h-3 w-3 text-slate-700" />
                }
              </button>
              {showMatrix && (
                <div className="mt-1.5 border border-slate-800/40 rounded-md overflow-hidden mb-2">
                  <div className="grid bg-[#16181c] border-b border-slate-800/40" style={{ gridTemplateColumns: `1fr repeat(${candidates.length}, minmax(0, 1fr))` }}>
                    <div className="px-3 py-1.5 text-[8px] text-slate-600 font-medium">항목</div>
                    {candidates.map((c) => (
                      <div key={c.id} className="px-3 py-1.5 text-[9px] text-slate-500 font-medium truncate border-l border-slate-800/30">{c.brand || c.name}</div>
                    ))}
                  </div>
                  {[
                    { label: "제품명", getter: (c: CompareCandidateInfo) => c.name },
                    { label: "카탈로그", getter: (c: CompareCandidateInfo) => c.catalogNumber || "—" },
                    { label: "규격", getter: (c: CompareCandidateInfo) => c.spec || "—" },
                    { label: "단가", getter: (c: CompareCandidateInfo) => c.priceKRW > 0 ? `₩${c.priceKRW.toLocaleString("ko-KR")}` : "견적 필요" },
                    { label: "납기", getter: (c: CompareCandidateInfo) => c.leadTimeDays > 0 ? `${c.leadTimeDays}영업일` : "확인 필요" },
                  ].map((row, ri) => (
                    <div key={ri} className="grid border-b border-slate-800/20 last:border-b-0" style={{ gridTemplateColumns: `1fr repeat(${candidates.length}, minmax(0, 1fr))` }}>
                      <div className="px-3 py-1 text-[8px] text-slate-600">{row.label}</div>
                      {candidates.map((c) => (
                        <div key={c.id} className="px-3 py-1 text-[9px] text-slate-500 truncate border-l border-slate-800/20">{row.getter(c)}</div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            STICKY DOCK — 주 CTA
            화면 전체에서 가장 명확한 1순위 액션
        ═══════════════════════════════════════════════════════════════════ */}
        <div className="px-5 py-4 border-t border-slate-700/40 bg-[#1c1e24]">
          {!isDecisionRecorded ? (
            <div className="flex items-center gap-3">
              {/* 상태 요약 */}
              <div className="text-[11px] text-slate-500 shrink-0">
                선택 <span className="text-slate-200 font-semibold">{shortlistCount}</span>
                {excludedCount > 0 && <> · 제외 <span className="text-slate-400 font-medium">{excludedCount}</span></>}
              </div>
              {/* 주 CTA */}
              <Button
                className="flex-1 h-11 text-[14px] font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-lg"
                onClick={recordDecision}
                disabled={shortlistCount === 0 || !categoryResult.isComparable}
              >
                <Check className="h-4 w-4 mr-2" />
                {shortlistCount > 0
                  ? `선택한 후보 ${shortlistCount}건으로 비교 계속`
                  : "후보를 1개 이상 선택하세요"
                }
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-emerald-950/30 border border-emerald-500/20 flex-1 min-w-0">
                <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                <span className="text-[12px] text-emerald-300 font-semibold truncate">후보 {shortlistCount}건 저장됨</span>
                <button type="button" onClick={handleUndo} className="ml-auto shrink-0 text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1.5 font-medium">
                  <Undo2 className="h-3.5 w-3.5" />되돌리기
                </button>
              </div>
              <Button
                className="h-11 px-5 text-[13px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg whitespace-nowrap shrink-0"
                onClick={handleRequestHandoff}
              >
                <FileText className="h-4 w-4 mr-2" />
                견적 후보로 반영
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
