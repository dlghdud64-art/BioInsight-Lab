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
  isComparePreviewStale,
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
  /** AI 3-option set for decision header */
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
  // ── Mode state ──
  const hasAiOptions = aiOptions.length === 3;
  const [surfaceMode, setSurfaceMode] = useState<"ai" | "basic">(hasAiOptions ? "ai" : "basic");
  const isAiMode = surfaceMode === "ai" && hasAiOptions;

  // ── AI option state ──
  const [activeAiFrame, setActiveAiFrame] = useState<"conservative" | "balanced" | "alternative">(
    (aiOptionId as any) || "balanced",
  );
  const activeAiOption = aiOptions.find((o) => o.frame === activeAiFrame) ?? aiOptions.find((o) => o.frame === "balanced") ?? null;

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

  // ── Review state ──
  const [reviewState, setReviewState] = useState<CompareReviewState | null>(null);
  const [shortlistIds, setShortlistIds] = useState<Set<string>>(new Set());
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [decisionSnapshot, setDecisionSnapshot] = useState<CompareDecisionSnapshot | null>(null);
  const [showUndoBanner, setShowUndoBanner] = useState(false);
  const [showMatrix, setShowMatrix] = useState(false);

  // Initialize state when opened
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
      aiDefaultOptionId: aiOptionId ?? "balanced",
      aiPreviewOptionIdAtDecision: activeAiFrame,
      operatorOverrideFlag: hasAiOptions && activeAiFrame !== (aiOptionId ?? "balanced"),
    });
    setDecisionSnapshot(snapshot);
    setShowUndoBanner(true);
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
    setShowUndoBanner(false);
    setShortlistIds(new Set(compareIds));
    setExcludedIds(new Set());
    onUndoDecision();
  }, [compareIds, onUndoDecision]);

  if (!open) return null;

  const isDecisionRecorded = !!decisionSnapshot;
  const shortlistCount = shortlistIds.size;
  const excludedCount = excludedIds.size;

  // ── Candidate card renderer ──
  const renderCandidateCard = (cl: ClassifiedCandidate, variant: "direct" | "reference") => {
    const c = candidates.find((cc) => cc.id === cl.id);
    if (!c) return null;
    const isShortlisted = shortlistIds.has(c.id);
    const isExcluded = excludedIds.has(c.id);
    const isDirect = variant === "direct";

    const cardBg = isShortlisted
      ? "border-emerald-500/30 bg-emerald-950/40"
      : isExcluded
        ? "border-red-500/20 bg-red-950/20 opacity-50"
        : isDirect
          ? "border-slate-600/30 bg-slate-800/50"
          : "border-slate-700/20 bg-slate-800/30";

    return (
      <div key={c.id} className={`px-4 py-3.5 rounded-lg border transition-all ${cardBg}`}>
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            {/* 제품명 — 가장 크게 */}
            <span className={`text-[13px] font-bold block truncate ${isDirect ? "text-slate-50" : "text-slate-200"}`}>{c.name}</span>
            {/* 가격 + delta 한 줄 */}
            <div className="flex items-center gap-2 mt-1.5">
              <span className={`text-[12px] font-semibold ${isDirect ? "text-emerald-300" : "text-slate-300"}`}>
                {c.priceKRW > 0 ? `₩${c.priceKRW.toLocaleString("ko-KR")}` : "가격 미확인"}
              </span>
              {cl.deltaOneLiner && (
                <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded font-medium ${isDirect ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/15 text-amber-300"}`}>
                  {cl.deltaOneLiner}
                </span>
              )}
            </div>
            {/* 보조 정보 — 한 단계 약하게 */}
            <span className="text-[11px] text-slate-500 block mt-1">
              {c.brand} · {c.catalogNumber || "—"}
            </span>
            {!isDirect && cl.classReason && (
              <span className="text-[10px] text-amber-400/60 block mt-1">{cl.classReason}{cl.riskNote ? ` — ${cl.riskNote}` : ""}</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0 pt-1">
            <button
              type="button"
              onClick={() => toggleShortlist(c.id)}
              disabled={isDecisionRecorded}
              className={`h-8 px-3 rounded-md text-[11px] font-semibold flex items-center gap-1.5 transition-all ${
                isShortlisted
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  : "text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 border border-slate-700/40"
              } ${isDecisionRecorded ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <Check className="h-3.5 w-3.5" />{isShortlisted ? "선택됨" : "선택"}
            </button>
            <button
              type="button"
              onClick={() => toggleExclude(c.id)}
              disabled={isDecisionRecorded}
              className={`h-8 px-3 rounded-md text-[11px] font-semibold flex items-center gap-1.5 transition-all ${
                isExcluded
                  ? "bg-red-500/15 text-red-400 border border-red-500/25"
                  : "text-slate-400 hover:text-red-400 hover:bg-red-500/10 border border-slate-700/40"
              } ${isDecisionRecorded ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <Minus className="h-3.5 w-3.5" />제외
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#16181c] border border-slate-700/50 rounded-xl shadow-2xl w-full max-w-3xl max-h-[88vh] overflow-hidden flex flex-col">

        {/* ═══════════════════════════════════════════════════════════════════
            HEADER — Identity + Mode Segmented Control
        ═══════════════════════════════════════════════════════════════════ */}
        <div className="px-5 py-3.5 border-b border-slate-700/40 bg-[#1c1e22]">
          {/* Row 1: Title + Close */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600/15 border border-blue-500/25">
                <GitCompare className="h-4.5 w-4.5 text-blue-400" />
              </div>
              <div>
                <h2 className="text-[15px] font-bold text-slate-100">비교 검토</h2>
                <div className="flex items-center gap-2 text-[11px] mt-0.5">
                  <span className="text-slate-400">후보 <span className="text-slate-200 font-semibold">{candidates.length}개</span></span>
                  <span className="text-slate-600">·</span>
                  <span className={categoryResult.compareMode === "direct" ? "text-emerald-400" : categoryResult.compareMode === "mixed_warning" ? "text-amber-400" : "text-red-400"}>
                    {categoryResult.compareMode === "direct" ? "직접 비교" : categoryResult.compareMode === "mixed_warning" ? "혼합 카테고리" : "비교 불가"}
                  </span>
                </div>
              </div>
            </div>
            <button type="button" onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-md text-slate-500 hover:text-slate-300 hover:bg-white/[0.06] transition-colors">
              <X className="h-4.5 w-4.5" />
            </button>
          </div>

          {/* Row 2: Segmented Control — AI 비교 판단 / 기본 비교 */}
          {hasAiOptions && (
            <div className="p-1.5 rounded-xl bg-[#0e1014] border border-slate-700/40 flex gap-1">
              <button
                type="button"
                onClick={() => setSurfaceMode("ai")}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-[12px] font-bold transition-all ${
                  isAiMode
                    ? "bg-blue-600/25 text-blue-100 border border-blue-500/40 shadow-md shadow-blue-500/15"
                    : "text-slate-500 hover:text-slate-400 border border-slate-700/30 hover:border-slate-600/40"
                }`}
              >
                {isAiMode && <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />}
                <Sparkles className={`h-4 w-4 ${isAiMode ? "text-blue-400" : "text-slate-600"}`} />
                AI 비교 판단
              </button>
              <button
                type="button"
                onClick={() => setSurfaceMode("basic")}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-[12px] font-bold transition-all ${
                  !isAiMode
                    ? "bg-slate-600/25 text-slate-100 border border-slate-500/40 shadow-md"
                    : "text-slate-500 hover:text-slate-400 border border-slate-700/30 hover:border-slate-600/40"
                }`}
              >
                <GitCompare className={`h-4 w-4 ${!isAiMode ? "text-slate-300" : "text-slate-600"}`} />
                기본 비교
              </button>
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            SCROLLABLE BODY — Decision Surface
        ═══════════════════════════════════════════════════════════════════ */}
        <div className="flex-1 overflow-y-auto">

          {/* ═══ AI Sub-frame selector (only in AI mode) ═══ */}
          {isAiMode && (
            <div className="px-5 py-2.5 border-b border-slate-700/20 bg-[#14161a]">
              <div className="flex gap-1">
                {(["conservative", "balanced", "alternative"] as const).map((frame) => {
                  const label = frame === "conservative" ? "비용 우선" : frame === "balanced" ? "납기·가격 균형" : "규격 신뢰";
                  const isActive = activeAiFrame === frame;
                  return (
                    <button
                      key={frame}
                      type="button"
                      onClick={() => setActiveAiFrame(frame)}
                      className={`flex-1 text-center px-2.5 py-2 rounded-md text-[10px] font-semibold transition-all ${
                        isActive
                          ? "bg-blue-600/15 text-blue-300 border border-blue-500/20"
                          : "text-slate-600 hover:text-slate-500 border border-transparent"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              ZONE A — AI Judgment Surface
              3단 판단면: 우선 검토 / 참고 후보 / 제외·보류
              각 단 = 독립 패널 + chip 기반 이유
          ═══════════════════════════════════════════════════════════════ */}
          {isAiMode && (
            <div className="px-5 pt-4 pb-3 bg-[#12151c] border-b border-blue-500/10">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-blue-400" />
                <span className="text-[11px] font-bold text-blue-300 uppercase tracking-widest">판단 요약</span>
              </div>

              {/* ── 우선 검토 ── */}
              <div className="rounded-lg border-l-[3px] border-l-emerald-400 border border-emerald-500/15 bg-emerald-950/30 px-4 py-3 mb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">우선 검토</span>
                  {directGroup.length > 0 && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 font-semibold">{directGroup.length}개</span>
                  )}
                </div>
                <p className="text-[12px] text-slate-200 mt-2 leading-relaxed">{aiVerdict.priorityLine.replace(/^우선 검토:\s*/, "")}</p>
              </div>

              {/* ── 참고 후보 ── */}
              {aiVerdict.referenceLine && (
                <div className="rounded-lg border-l-[3px] border-l-amber-400 border border-amber-500/10 bg-amber-950/20 px-4 py-3 mb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">참고 후보</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 font-semibold">{referenceGroup.length}개</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    {referenceGroup.map((r) => (
                      <span key={r.id} className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-300/80">{r.classReason}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* ── 제외·보류 ── */}
              {aiVerdict.blockedLine && (
                <div className="rounded-lg border-l-[3px] border-l-red-400 border border-red-500/10 bg-red-950/20 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest">제외·보류</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-red-500/10 text-red-300 font-semibold">{blockedGroup.length}개</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    {blockedGroup.map((b) => (
                      <span key={b.id} className="text-[10px] px-2 py-0.5 rounded bg-red-500/10 text-red-300/80">{b.classReason}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              ZONE B — 후보군 Surfaces (분류별 독립 섹션)
              direct = 가장 강한 surface
              reference = 한 단계 약한 surface
              blocked = muted + warning accent
          ═══════════════════════════════════════════════════════════════ */}

          {/* ── SURFACE: 우선 검토 후보 (direct) ── */}
          {directGroup.length > 0 && (
            <div className="px-5 pt-5 pb-4 bg-[#171a1f] border-t-2 border-t-emerald-500/25">
              <div className="flex items-center gap-2.5 mb-3.5">
                <div className="w-3 h-3 rounded bg-emerald-400" />
                <span className="text-[12px] font-bold text-emerald-300 uppercase tracking-wider">우선 검토 후보</span>
                <span className="text-[11px] text-slate-500 font-medium">{directGroup.length}개</span>
              </div>
              <div className="space-y-2.5">
                {directGroup.map((cl) => renderCandidateCard(cl, "direct"))}
              </div>
            </div>
          )}

          {/* ── SURFACE: 참고 후보 (reference) ── */}
          {referenceGroup.length > 0 && (
            <div className="px-5 pt-5 pb-4 bg-[#15161a] border-t-2 border-t-amber-500/20">
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-3 h-3 rounded bg-amber-400" />
                <span className="text-[12px] font-bold text-amber-300 uppercase tracking-wider">참고 후보</span>
                <span className="text-[11px] text-slate-500 font-medium">{referenceGroup.length}개</span>
              </div>
              <p className="text-[10px] text-slate-600 mb-3.5">직접 비교 제한 — 규격·카테고리·정보 차이</p>
              <div className="space-y-2.5">
                {referenceGroup.map((cl) => renderCandidateCard(cl, "reference"))}
              </div>
            </div>
          )}

          {/* ── SURFACE: 제외·보류 (blocked) ── */}
          {blockedGroup.length > 0 && (
            <div className="px-5 pt-5 pb-4 bg-[#161314] border-t-2 border-t-red-500/20">
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-3 h-3 rounded bg-red-400/70" />
                <span className="text-[12px] font-bold text-red-300/80 uppercase tracking-wider">제외·보류</span>
                <span className="text-[11px] text-slate-600 font-medium">{blockedGroup.length}개</span>
              </div>
              <p className="text-[10px] text-slate-600 mb-3.5">비교 불가 또는 핵심 정보 누락</p>
              <div className="space-y-2">
                {blockedGroup.map((cl) => {
                  const c = candidates.find((cc) => cc.id === cl.id);
                  if (!c) return null;
                  return (
                    <div key={c.id} className="px-4 py-3 rounded-lg border border-red-500/10 bg-red-950/15">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <span className="text-[12px] text-slate-400 font-medium block truncate">{c.name}</span>
                          <span className="text-[11px] text-slate-600">{c.brand} · {c.catalogNumber || "—"}</span>
                        </div>
                        <span className="shrink-0 text-[10px] px-2.5 py-0.5 rounded bg-red-500/10 text-red-400 font-semibold">{cl.suggestedAction === "hold" ? "보류" : "제외"}</span>
                      </div>
                      <span className="text-[10px] text-red-400/60 block mt-1.5">{cl.classReason}{cl.riskNote ? ` — ${cl.riskNote}` : ""}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              ZONE C — Decision CTA
              판단 요약 + 후보 확인 후 행동
          ═══════════════════════════════════════════════════════════════ */}
          <div className="px-5 py-4 border-t border-slate-700/30 bg-[#16181c]">
            {!isDecisionRecorded ? (
              <div>
                <Button
                  size="sm"
                  className="w-full h-11 text-[13px] bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg"
                  onClick={recordDecision}
                  disabled={shortlistCount === 0 || !categoryResult.isComparable}
                >
                  <Check className="h-4 w-4 mr-2" />
                  선택 후보로 계속 — {shortlistCount}개
                </Button>
                {shortlistCount === 0 && (
                  <p className="text-[10px] text-slate-600 text-center mt-2">후보를 1개 이상 선택하세요</p>
                )}
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="flex items-center gap-2.5 px-4 py-3 rounded-lg bg-emerald-950/30 border border-emerald-500/20">
                  <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span className="text-[12px] text-emerald-300 font-semibold">선택 후보 {shortlistCount}개 저장됨</span>
                  <button type="button" onClick={handleUndo} className="ml-auto text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1.5 font-medium">
                    <Undo2 className="h-3.5 w-3.5" />되돌리기
                  </button>
                </div>
                <Button
                  size="sm"
                  className="w-full h-11 text-[13px] bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg"
                  onClick={handleRequestHandoff}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  견적 후보로 반영
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            )}
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              ZONE D — 참고 정보 (시각적 무게 최저)
              delta summary + collapsed matrix
          ═══════════════════════════════════════════════════════════════ */}
          <div className="px-5 py-2.5 border-t border-slate-800/30 bg-[#0f1114]">
            <span className="text-[9px] font-medium text-slate-700 uppercase tracking-widest">참고 — 핵심 차이</span>
            <div className="mt-1.5 grid grid-cols-2 gap-1.5">
              {differenceSummary.priceAdvantage && (
                <div className="px-2.5 py-1.5 rounded border border-slate-800/30 bg-[#13151a]">
                  <div className="flex items-center gap-1 mb-0.5">
                    <TrendingDown className="h-2.5 w-2.5 text-emerald-700/40" />
                    <span className="text-[8px] text-slate-700">가격</span>
                  </div>
                  <span className="text-[9px] text-slate-600">{differenceSummary.priceAdvantage.label}</span>
                </div>
              )}
              {differenceSummary.leadTimeAdvantage && (
                <div className="px-2.5 py-1.5 rounded border border-slate-800/30 bg-[#13151a]">
                  <div className="flex items-center gap-1 mb-0.5">
                    <Clock className="h-2.5 w-2.5 text-blue-700/40" />
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

          {/* ── Compare Matrix — collapsed ── */}
          <div className="px-5 py-2 border-t border-slate-800/20 bg-[#0f1114]">
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
              <div className="mt-1.5 border border-slate-800/40 rounded-md overflow-hidden">
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

        {/* ═══ Dock — status strip + 닫기 ═══ */}
        <div className="px-5 py-2.5 border-t border-slate-700/40 bg-[#1c1e22]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-[11px]">
              <span className="text-slate-500">선택 후보 <span className="text-slate-300 font-semibold">{shortlistCount}</span></span>
              <span className="text-slate-700">·</span>
              <span className="text-slate-500">제외 <span className="text-slate-300 font-semibold">{excludedCount}</span></span>
              {isDecisionRecorded && (
                <>
                  <span className="text-slate-700">·</span>
                  <span className="text-emerald-400 font-semibold">저장됨</span>
                </>
              )}
            </div>
            <Button size="sm" variant="ghost" className="h-8 px-3.5 text-[11px] text-slate-500 hover:text-slate-300 border border-slate-700/40" onClick={onClose}>
              닫기
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
