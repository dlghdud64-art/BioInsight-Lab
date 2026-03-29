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
  // ── AI option state ──
  const [activeAiFrame, setActiveAiFrame] = useState<"conservative" | "balanced" | "alternative">(
    (aiOptionId as any) || "balanced",
  );
  const activeAiOption = aiOptions.find((o) => o.frame === activeAiFrame) ?? aiOptions.find((o) => o.frame === "balanced") ?? null;
  const hasAiOptions = aiOptions.length === 3;
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
      // Default: all candidates in shortlist
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
      decisionReasonSummary: `${sl.length}개 shortlist, ${ex.length}개 제외`,
    };
    const snapshot = buildCompareDecisionSnapshot(reviewState, differenceSummary, payload, {
      aiDefaultOptionId: aiOptionId ?? "balanced",
      aiPreviewOptionIdAtDecision: activeAiFrame,
      operatorOverrideFlag: hasAiOptions && activeAiFrame !== (aiOptionId ?? "balanced"),
    });
    setDecisionSnapshot(snapshot);
    setShowUndoBanner(true);
    onShortlistApplied(sl, sl);
    // Update state
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

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#1e2024] border border-bd rounded-xl shadow-2xl w-full max-w-3xl max-h-[88vh] overflow-hidden flex flex-col">
        {/* ═══ 1. Identity Strip ═══ */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-bd bg-[#252729]">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-600/15 border border-blue-500/25">
              <GitCompare className="h-4 w-4 text-blue-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">비교 검토</h2>
              <div className="flex items-center gap-2 text-[10px] mt-0.5">
                <span className="text-slate-400">후보 <span className="text-slate-200 font-medium">{candidates.length}개</span></span>
                <span className="text-slate-600">·</span>
                <span className={categoryResult.compareMode === "direct" ? "text-emerald-400" : categoryResult.compareMode === "mixed_warning" ? "text-amber-400" : "text-red-400"}>
                  {categoryResult.compareMode === "direct" ? "직접 비교" : categoryResult.compareMode === "mixed_warning" ? "혼합 카테고리" : "비교 불가"}
                </span>
                {isDecisionRecorded && (
                  <>
                    <span className="text-slate-600">·</span>
                    <span className="text-emerald-400 font-medium">shortlist {shortlistCount}개</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded text-slate-500 hover:text-slate-300 hover:bg-white/[0.05] transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ═══ AI Decision Header + Segmented Switch ═══ */}
        {hasAiOptions && (
          <div className="px-5 py-3 border-b border-bd/40 bg-blue-600/[0.02]">
            {/* AI activation status */}
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                <span className="text-[10px] font-semibold text-slate-200">AI 비교 판단 활성</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-600/15 text-blue-300 font-medium">
                  기본안: {activeAiFrame === "conservative" ? "비용 우선" : activeAiFrame === "balanced" ? "균형안" : "규격 신뢰"}
                </span>
              </div>
              <span className="text-[9px] text-slate-500">다른 판단안으로 전환 가능</span>
            </div>
            {/* Segmented switch */}
            <div className="flex gap-1.5 mb-3">
              {(["conservative", "balanced", "alternative"] as const).map((frame) => {
                const label = frame === "conservative" ? "비용 우선" : frame === "balanced" ? "납기·가격 균형" : "규격 신뢰";
                const isActive = activeAiFrame === frame;
                return (
                  <button
                    key={frame}
                    type="button"
                    onClick={() => setActiveAiFrame(frame)}
                    className={`flex-1 text-center px-2 py-2 rounded-md text-[10px] font-medium transition-all ${isActive
                      ? "bg-blue-600/15 text-blue-300 border border-blue-500/30 shadow-sm shadow-blue-500/10"
                      : "text-slate-500 hover:text-slate-400 hover:bg-white/[0.03] border border-transparent"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            {/* Active AI option preview */}
            {activeAiOption && (
              <div className="px-3 py-2.5 rounded-md bg-[#252729] border border-bd/30 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3 w-3 text-blue-400 shrink-0" />
                  <span className="text-[10px] text-blue-200 leading-relaxed">{activeAiOption.rationale}</span>
                </div>
                {activeAiOption.strengths.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {activeAiOption.strengths.slice(0, 2).map((s, i) => (
                      <span key={i} className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded bg-emerald-600/10 text-emerald-400">
                        <Check className="h-2.5 w-2.5" />{s}
                      </span>
                    ))}
                  </div>
                )}
                {activeAiOption.risks.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" />
                    <span className="text-[9px] text-amber-400">{typeof activeAiOption.risks[0] === "string" ? activeAiOption.risks[0] : (activeAiOption.risks[0] as any).label}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ═══ Scrollable body — AI verdict → 분류별 후보 → delta → matrix ═══ */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* ═══ 1. AI Verdict Block — 3줄 판단 요약 ═══ */}
          <div className="px-3 py-3 rounded-md bg-[#1a1f2e] border border-blue-500/15">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-3.5 w-3.5 text-blue-400 shrink-0" />
              <span className="text-[10px] font-semibold text-slate-200">후보군 판단</span>
            </div>
            <div className="space-y-1.5">
              {/* 우선 검토 */}
              <div className="flex items-start gap-2">
                <span className="shrink-0 mt-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="text-[11px] text-slate-200 leading-relaxed">{aiVerdict.priorityLine}</span>
              </div>
              {/* 참고 후보 */}
              {aiVerdict.referenceLine && (
                <div className="flex items-start gap-2">
                  <span className="shrink-0 mt-0.5 w-1.5 h-1.5 rounded-full bg-amber-400" />
                  <span className="text-[11px] text-slate-400 leading-relaxed">{aiVerdict.referenceLine}</span>
                </div>
              )}
              {/* 제외·보류 */}
              {aiVerdict.blockedLine && (
                <div className="flex items-start gap-2">
                  <span className="shrink-0 mt-0.5 w-1.5 h-1.5 rounded-full bg-red-400" />
                  <span className="text-[11px] text-slate-400 leading-relaxed">{aiVerdict.blockedLine}</span>
                </div>
              )}
            </div>
          </div>

          {/* ═══ 2. Primary CTA — verdict 직하 ═══ */}
          {!isDecisionRecorded && (
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1 h-8 text-[10px] bg-blue-600 hover:bg-blue-500 text-white font-medium"
                onClick={recordDecision}
                disabled={shortlistCount === 0 || !categoryResult.isComparable}
              >
                <Check className="h-3 w-3 mr-1" />
                비교 결과 저장 ({shortlistCount}개 shortlist)
              </Button>
            </div>
          )}
          {isDecisionRecorded && (
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1 h-8 text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
                onClick={handleRequestHandoff}
              >
                <FileText className="h-3 w-3 mr-1" />
                견적 후보로 반영
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
              <Button size="sm" variant="ghost" className="h-8 px-3 text-[9px] text-blue-400 hover:text-blue-300 border border-bd/40" onClick={handleUndo}>
                <Undo2 className="h-3 w-3 mr-0.5" />
                되돌리기
              </Button>
            </div>
          )}

          {/* ═══ 3. 분류별 후보 카드 — direct → reference → blocked ═══ */}
          {/* ── 직접 비교 (direct) ── */}
          {directGroup.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">직접 비교</span>
                <span className="text-[9px] text-slate-600">{directGroup.length}</span>
              </div>
              <div className="space-y-1.5">
                {directGroup.map((cl) => {
                  const c = candidates.find((cc) => cc.id === cl.id);
                  if (!c) return null;
                  const isShortlisted = shortlistIds.has(c.id);
                  const isExcluded = excludedIds.has(c.id);
                  return (
                    <div key={c.id} className={`px-3 py-2.5 rounded-md border transition-all ${isShortlisted ? "border-emerald-500/25 bg-emerald-600/[0.04]" : isExcluded ? "border-red-500/15 bg-red-600/[0.03] opacity-60" : "border-bd/40 bg-[#252729]"}`}>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-slate-200 font-medium truncate">{c.name}</span>
                            {cl.deltaOneLiner && (
                              <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded bg-emerald-600/10 text-emerald-400">{cl.deltaOneLiner}</span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-500">{c.brand} · {c.catalogNumber || "—"}</span>
                          <span className="text-[9px] text-slate-500 block mt-0.5">{cl.classReason}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] tabular-nums text-slate-400">{c.priceKRW > 0 ? `₩${c.priceKRW.toLocaleString("ko-KR")}` : "—"}</span>
                          <Button size="sm" variant={isShortlisted ? "default" : "ghost"} className={`h-6 px-2 text-[9px] ${isShortlisted ? "bg-emerald-600/15 text-emerald-400 hover:bg-emerald-600/25 border border-emerald-500/25" : "text-slate-500 hover:text-emerald-400 border border-bd/30"}`} onClick={() => toggleShortlist(c.id)} disabled={isDecisionRecorded}>
                            <Check className="h-3 w-3 mr-0.5" />{isShortlisted ? "shortlist" : "남기기"}
                          </Button>
                          <Button size="sm" variant="ghost" className={`h-6 px-2 text-[9px] ${isExcluded ? "bg-red-600/10 text-red-400 border border-red-500/20" : "text-slate-500 hover:text-red-400 border border-bd/30"}`} onClick={() => toggleExclude(c.id)} disabled={isDecisionRecorded}>
                            <Minus className="h-3 w-3 mr-0.5" />제외
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── 참고 후보 (reference) ── */}
          {referenceGroup.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">참고 후보</span>
                <span className="text-[9px] text-slate-600">{referenceGroup.length}</span>
              </div>
              <div className="space-y-1.5">
                {referenceGroup.map((cl) => {
                  const c = candidates.find((cc) => cc.id === cl.id);
                  if (!c) return null;
                  const isShortlisted = shortlistIds.has(c.id);
                  const isExcluded = excludedIds.has(c.id);
                  return (
                    <div key={c.id} className={`px-3 py-2.5 rounded-md border transition-all ${isShortlisted ? "border-emerald-500/25 bg-emerald-600/[0.04]" : isExcluded ? "border-red-500/15 bg-red-600/[0.03] opacity-60" : "border-amber-500/15 bg-amber-600/[0.02]"}`}>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-slate-200 font-medium truncate">{c.name}</span>
                            {cl.deltaOneLiner && (
                              <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded bg-amber-600/10 text-amber-400">{cl.deltaOneLiner}</span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-500">{c.brand} · {c.catalogNumber || "—"}</span>
                          <span className="text-[9px] text-amber-400/80 block mt-0.5">{cl.classReason}</span>
                          {cl.riskNote && <span className="text-[9px] text-slate-500 block">{cl.riskNote}</span>}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] tabular-nums text-slate-400">{c.priceKRW > 0 ? `₩${c.priceKRW.toLocaleString("ko-KR")}` : "—"}</span>
                          <Button size="sm" variant="ghost" className={`h-6 px-2 text-[9px] ${isShortlisted ? "bg-emerald-600/15 text-emerald-400 hover:bg-emerald-600/25 border border-emerald-500/25" : "text-slate-500 hover:text-emerald-400 border border-bd/30"}`} onClick={() => toggleShortlist(c.id)} disabled={isDecisionRecorded}>
                            <Check className="h-3 w-3 mr-0.5" />{isShortlisted ? "shortlist" : "남기기"}
                          </Button>
                          <Button size="sm" variant="ghost" className={`h-6 px-2 text-[9px] ${isExcluded ? "bg-red-600/10 text-red-400 border border-red-500/20" : "text-slate-500 hover:text-red-400 border border-bd/30"}`} onClick={() => toggleExclude(c.id)} disabled={isDecisionRecorded}>
                            <Minus className="h-3 w-3 mr-0.5" />제외
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── 제외·보류 (blocked) ── */}
          {blockedGroup.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">제외·보류</span>
                <span className="text-[9px] text-slate-600">{blockedGroup.length}</span>
              </div>
              <div className="space-y-1.5">
                {blockedGroup.map((cl) => {
                  const c = candidates.find((cc) => cc.id === cl.id);
                  if (!c) return null;
                  return (
                    <div key={c.id} className="px-3 py-2.5 rounded-md border border-red-500/10 bg-red-600/[0.02] opacity-70">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <span className="text-[11px] text-slate-300 font-medium block truncate">{c.name}</span>
                          <span className="text-[10px] text-slate-500">{c.brand} · {c.catalogNumber || "—"}</span>
                          <span className="text-[9px] text-red-400/80 block mt-0.5">{cl.classReason}</span>
                          {cl.riskNote && <span className="text-[9px] text-slate-500 block">{cl.riskNote}</span>}
                        </div>
                        <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded bg-red-600/10 text-red-400">{cl.suggestedAction === "hold" ? "보류" : "제외"}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ═══ 4. Delta Summary — 핵심 차이 (축약) ═══ */}
          <div>
            <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">핵심 차이</span>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {differenceSummary.priceAdvantage && (
                <div className="px-3 py-2 rounded-md border border-bd/40 bg-[#252729]">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <TrendingDown className="h-3 w-3 text-emerald-400" />
                    <span className="text-[9px] text-slate-500">가격 우위</span>
                  </div>
                  <span className="text-[10px] text-slate-200 font-medium">{differenceSummary.priceAdvantage.label}</span>
                </div>
              )}
              {differenceSummary.leadTimeAdvantage && (
                <div className="px-3 py-2 rounded-md border border-bd/40 bg-[#252729]">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Clock className="h-3 w-3 text-blue-400" />
                    <span className="text-[9px] text-slate-500">납기 우위</span>
                  </div>
                  <span className="text-[10px] text-slate-200 font-medium">{differenceSummary.leadTimeAdvantage.label}</span>
                </div>
              )}
              <div className="px-3 py-2 rounded-md border border-bd/40 bg-[#252729]">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Package className="h-3 w-3 text-slate-400" />
                  <span className="text-[9px] text-slate-500">규격</span>
                </div>
                <span className="text-[10px] text-slate-200 font-medium">{differenceSummary.specFitNote}</span>
              </div>
              <div className="px-3 py-2 rounded-md border border-bd/40 bg-[#252729]">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Package className="h-3 w-3 text-slate-400" />
                  <span className="text-[9px] text-slate-500">브랜드</span>
                </div>
                <span className="text-[10px] text-slate-200 font-medium">{differenceSummary.brandNote}</span>
              </div>
            </div>
          </div>

          {/* ═══ 5. Compare Matrix — collapsed by default ═══ */}
          <div>
            <button
              type="button"
              onClick={() => setShowMatrix(!showMatrix)}
              className="w-full flex items-center justify-between py-1.5 group"
            >
              <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider group-hover:text-slate-400 transition-colors">비교 매트릭스</span>
              {showMatrix
                ? <ChevronUp className="h-3 w-3 text-slate-500" />
                : <ChevronDown className="h-3 w-3 text-slate-500" />
              }
            </button>
            {showMatrix && (
              <div className="mt-1 border border-bd/40 rounded-md overflow-hidden">
                {/* Header */}
                <div className="grid grid-cols-[1fr_repeat(var(--cols),minmax(0,1fr))] bg-[#252729] border-b border-bd/40" style={{ "--cols": candidates.length } as React.CSSProperties}>
                  <div className="px-3 py-2 text-[9px] text-slate-500 font-medium">항목</div>
                  {candidates.map((c) => (
                    <div key={c.id} className="px-3 py-2 text-[10px] text-slate-300 font-medium truncate border-l border-bd/30">{c.brand || c.name}</div>
                  ))}
                </div>
                {/* Rows */}
                {[
                  { label: "제품명", getter: (c: CompareCandidateInfo) => c.name },
                  { label: "카탈로그", getter: (c: CompareCandidateInfo) => c.catalogNumber || "—" },
                  { label: "규격", getter: (c: CompareCandidateInfo) => c.spec || "—" },
                  { label: "단가", getter: (c: CompareCandidateInfo) => c.priceKRW > 0 ? `₩${c.priceKRW.toLocaleString("ko-KR")}` : "견적 필요" },
                  { label: "납기", getter: (c: CompareCandidateInfo) => c.leadTimeDays > 0 ? `${c.leadTimeDays}영업일` : "확인 필요" },
                ].map((row, ri) => (
                  <div key={ri} className="grid border-b border-bd/20 last:border-b-0" style={{ gridTemplateColumns: `1fr repeat(${candidates.length}, minmax(0, 1fr))` }}>
                    <div className="px-3 py-1.5 text-[9px] text-slate-500">{row.label}</div>
                    {candidates.map((c) => (
                      <div key={c.id} className="px-3 py-1.5 text-[10px] text-slate-300 truncate border-l border-bd/20">{row.getter(c)}</div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ═══ Dock — status strip + 닫기 ═══ */}
        <div className="px-5 py-2.5 border-t border-bd bg-[#1a1c1f]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-[10px]">
              <span className="text-slate-500">shortlist <span className="text-slate-300 font-medium">{shortlistCount}</span></span>
              <span className="text-slate-600">·</span>
              <span className="text-slate-500">제외 <span className="text-slate-300 font-medium">{excludedCount}</span></span>
              {isDecisionRecorded && (
                <>
                  <span className="text-slate-600">·</span>
                  <span className="text-emerald-400 font-medium">저장됨</span>
                </>
              )}
            </div>
            <Button size="sm" variant="ghost" className="h-7 px-3 text-[10px] text-slate-400 hover:text-slate-300 border border-bd/40" onClick={onClose}>
              닫기
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
