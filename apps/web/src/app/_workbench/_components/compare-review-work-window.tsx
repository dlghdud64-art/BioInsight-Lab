"use client";

import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { X, Check, Minus, AlertTriangle, ArrowRight, GitCompare, TrendingDown, Clock, Package, FileText, Undo2, Sparkles, ChevronDown, ChevronUp, ShieldCheck, Zap, Scale } from "lucide-react";
import {
  type CompareReviewState,
  type CompareCandidateInfo,
  type CompareDecisionPayload,
  type CompareDecisionSnapshot,
  type RequestCandidateHandoff,
  type ClassifiedCandidate,
  type StrategyDecisionOption,
  type StrategyCandidate,
  type StrategyFrame,
  validateCompareCategoryIntegrity,
  buildCompareDifferenceSummary,
  buildCompareDecisionSnapshot,
  buildRequestCandidateHandoffFromCompare,
  createInitialCompareReviewState,
  classifyCandidatesForReview,
  buildAiVerdictSummary,
  buildStrategyDecisionOptions,
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
// Constants
// ══════════════════════════════════════════════════════════════════════════════

const FRAME_ICON: Record<StrategyFrame, any> = { cost: Zap, balanced: Scale, spec: ShieldCheck };
const FRAME_COLOR: Record<StrategyFrame, { bg: string; border: string; text: string; accent: string }> = {
  cost: { bg: "bg-emerald-950/30", border: "border-emerald-500/20", text: "text-emerald-300", accent: "bg-emerald-500/15" },
  balanced: { bg: "bg-blue-950/30", border: "border-blue-500/20", text: "text-blue-300", accent: "bg-blue-500/15" },
  spec: { bg: "bg-amber-950/25", border: "border-amber-500/20", text: "text-amber-300", accent: "bg-amber-500/15" },
};

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
  // AI가 기본 진입면 — aiOptions가 있으면 무조건 ai, 없으면 fallback basic
  const hasAiOptions = aiOptions.length === 3;
  const [surfaceMode, setSurfaceMode] = useState<"ai" | "basic">(hasAiOptions ? "ai" : "basic");
  const isAiMode = surfaceMode === "ai" && hasAiOptions;

  // ── 열릴 때마다 AI 모드로 강제 리셋 (이전 탭 기억 차단) + 스크롤 top ──
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) {
      setSurfaceMode(hasAiOptions ? "ai" : "basic");
      // 스크롤 시작점을 항상 최상단으로 보정
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: 0 }));
    }
  }, [open, hasAiOptions]);

  // ── AI strategy state ──
  const [activeFrame, setActiveFrame] = useState<StrategyFrame>("balanced");
  const [showRationale, setShowRationale] = useState(false);

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

  // ── Validation + Classification ──
  const categoryResult = useMemo(() => validateCompareCategoryIntegrity(candidates), [candidates]);
  const differenceSummary = useMemo(() => buildCompareDifferenceSummary(candidates), [candidates]);
  const classifiedCandidates = useMemo(() => classifyCandidatesForReview(candidates, categoryResult, differenceSummary), [candidates, categoryResult, differenceSummary]);

  // ── Strategy decision options (AI mode) ──
  const { options: strategyOptions, header: decisionHeader } = useMemo(
    () => buildStrategyDecisionOptions(candidates, classifiedCandidates, categoryResult, differenceSummary),
    [candidates, classifiedCandidates, categoryResult, differenceSummary],
  );
  const activeOption = strategyOptions.find((o: StrategyDecisionOption) => o.frame === activeFrame) || strategyOptions[1] || null;

  // ── Review state ──
  const [reviewState, setReviewState] = useState<CompareReviewState | null>(null);
  const [shortlistIds, setShortlistIds] = useState<Set<string>>(new Set());
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [decisionSnapshot, setDecisionSnapshot] = useState<CompareDecisionSnapshot | null>(null);
  const [showUndoBanner, setShowUndoBanner] = useState(false);
  const [showMatrix, setShowMatrix] = useState(false);

  // Initialize
  useMemo(() => {
    if (open && candidates.length >= 2 && !reviewState) {
      setReviewState(createInitialCompareReviewState(compareIds, categoryResult, openedBy, aiOptionId));
      setShortlistIds(new Set(compareIds));
      setExcludedIds(new Set());
    }
  }, [open, candidates.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Actions ──
  const toggleShortlist = useCallback((id: string) => {
    setShortlistIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
    setExcludedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
  }, []);

  const toggleExclude = useCallback((id: string) => {
    setExcludedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
    setShortlistIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
  }, []);

  const applyStrategyDecision = useCallback(() => {
    if (!activeOption) return;
    const recIds = new Set<string>(activeOption.recommended.map((r: StrategyCandidate) => r.id));
    const exIds = new Set<string>(activeOption.excluded.map((e: StrategyCandidate) => e.id));
    setShortlistIds(recIds);
    setExcludedIds(exIds);
  }, [activeOption]);

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
      aiPreviewOptionIdAtDecision: activeFrame,
      operatorOverrideFlag: hasAiOptions && activeFrame !== (aiOptionId as any ?? "balanced"),
    });
    setDecisionSnapshot(snapshot);
    setShowUndoBanner(true);
    onShortlistApplied(sl, sl);
    setReviewState((prev: CompareReviewState | null) => prev ? {
      ...prev,
      compareReviewStatus: "compare_shortlist_recorded",
      substatus: "ready_for_request_candidate",
      compareShortlistIds: sl,
      compareExcludedIds: ex,
      compareHeldIds: held,
      compareDecisionSnapshotId: snapshot.id,
      compareDecisionSummary: payload.decisionReasonSummary,
    } : prev);
  }, [reviewState, shortlistIds, excludedIds, compareIds, differenceSummary, onShortlistApplied, activeFrame, aiOptionId, hasAiOptions]);

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

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════════════

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] flex items-center justify-center" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#1C2028] border border-slate-600/40 rounded-xl shadow-[0_8px_40px_rgba(0,0,0,0.5)] w-full max-w-3xl max-h-[88vh] overflow-hidden flex flex-col">

        {/* ═══ HEADER — Identity + Mode Switch ═══ */}
        <div className="px-5 py-3.5 border-b border-slate-600/30 bg-[#262930]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600/15 border border-blue-500/25">
                <GitCompare className="h-4 w-4 text-blue-400" />
              </div>
              <div>
                <h2 className="text-[15px] font-bold text-white">비교 검토</h2>
                <div className="flex items-center gap-2 text-[11px] mt-0.5">
                  <span className="text-slate-400">후보 <span className="text-slate-200 font-semibold">{candidates.length}개</span></span>
                  <span className="text-slate-600">·</span>
                  <span className={categoryResult.compareMode === "direct" ? "text-emerald-400" : categoryResult.compareMode === "mixed_warning" ? "text-amber-400" : "text-red-400"}>
                    {categoryResult.compareMode === "direct" ? "직접 비교" : categoryResult.compareMode === "mixed_warning" ? "혼합 카테고리" : "비교 불가"}
                  </span>
                </div>
              </div>
            </div>
            <button type="button" onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-md text-slate-500 hover:text-slate-300 hover:bg-white/[0.06]">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Segmented Control — AI = primary mode, 상세 비교 = secondary drilldown */}
          {hasAiOptions && (
            <div className="p-1 rounded-xl bg-[#14161a] border border-slate-700/40 flex gap-1">
              <button type="button" onClick={() => setSurfaceMode("ai")}
                className={`flex-[1.2] flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-[12px] font-bold transition-all ${
                  isAiMode
                    ? "bg-blue-600/30 text-blue-50 border border-blue-500/50 shadow-lg shadow-blue-500/20 ring-1 ring-blue-400/25"
                    : "text-slate-500 hover:text-slate-400 border border-transparent"
                }`}>
                {isAiMode && <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />}
                <Sparkles className={`h-4 w-4 ${isAiMode ? "text-blue-300" : "text-slate-600"}`} />
                AI 결정 보조
              </button>
              <button type="button" onClick={() => setSurfaceMode("basic")}
                className={`flex-[0.8] flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg text-[11px] font-medium transition-all ${
                  !isAiMode
                    ? "bg-slate-700/30 text-slate-200 border border-slate-500/30"
                    : "text-slate-600 hover:text-slate-500 border border-transparent"
                }`}>
                <GitCompare className={`h-3.5 w-3.5 ${!isAiMode ? "text-slate-400" : "text-slate-700"}`} />
                상세 비교
              </button>
            </div>
          )}
        </div>

        {/* ═══ SCROLLABLE BODY ═══ */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">

          {isAiMode ? (
            /* ═══════════════════════════════════════════════════════════════════
                AI DECISION SURFACE
                목적: 무엇을 해야 하는가
            ═══════════════════════════════════════════════════════════════════ */
            <>
              {/* ── Decision Header — 권장 판단 한줄 + 카운트 ── */}
              <div className="px-5 py-3.5 bg-[#1a1e28] border-b border-blue-500/15">
                {/* 한줄 판단 */}
                <p className="text-[13px] font-bold text-blue-50 mb-2.5">
                  {decisionHeader.requestReadyCount > 0
                    ? `${decisionHeader.requestReadyCount}건 즉시 요청 가능 — 선택 후 진행하세요`
                    : decisionHeader.holdCount > 0
                      ? "확인 필요 항목이 있습니다 — 검토 후 결정하세요"
                      : "비교 대상이 부족합니다"
                  }
                </p>
                {/* 카운트 strip */}
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/15 border border-emerald-500/20">
                    <span className="text-[14px] font-bold text-emerald-300">{decisionHeader.requestReadyCount}</span>
                    <span className="text-[10px] text-emerald-400/80">요청 가능</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/15">
                    <span className="text-[14px] font-bold text-amber-300">{decisionHeader.holdCount}</span>
                    <span className="text-[10px] text-amber-400/80">보류</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-500/10 border border-red-500/15">
                    <span className="text-[14px] font-bold text-red-300">{decisionHeader.excludedCount}</span>
                    <span className="text-[10px] text-red-400/80">제외</span>
                  </span>
                </div>
                {decisionHeader.topBlocker && (
                  <div className="flex items-center gap-2 mt-2 px-2.5 py-1.5 rounded-md bg-[#28251e] border border-amber-500/15">
                    <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" />
                    <span className="text-[11px] text-amber-300">{decisionHeader.topBlocker}</span>
                  </div>
                )}
              </div>

              {/* ── Tri-Option Strategy Cards ── */}
              <div className="px-5 pt-4 pb-3 border-b border-slate-600/15">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 block">결정 시나리오 선택</span>
                <div className="grid grid-cols-3 gap-2">
                  {strategyOptions.map((opt: StrategyDecisionOption) => {
                    const FrameIcon = FRAME_ICON[opt.frame];
                    const colors = FRAME_COLOR[opt.frame];
                    const isActive = activeFrame === opt.frame;
                    return (
                      <button key={opt.frame} type="button" onClick={() => { setActiveFrame(opt.frame); }}
                        className={`text-left px-3.5 py-3 rounded-lg border-2 transition-all ${
                          isActive ? `${colors.bg} ${colors.border} ring-1 ring-offset-0 ring-${opt.frame === "cost" ? "emerald" : opt.frame === "balanced" ? "blue" : "amber"}-500/20` : "border-slate-600/30 hover:border-slate-500/40 bg-[#24272c]"
                        }`}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <FrameIcon className={`h-4 w-4 ${isActive ? colors.text : "text-slate-500"}`} />
                          <span className={`text-[12px] font-bold ${isActive ? colors.text : "text-slate-300"}`}>{opt.title}</span>
                        </div>
                        <p className={`text-[10px] leading-snug ${isActive ? "text-slate-200" : "text-slate-500"}`}>{opt.subtitle}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${isActive ? colors.accent + " " + colors.text : "bg-slate-700/50 text-slate-500"}`}>
                            요청 {opt.recommended.length}
                          </span>
                          {opt.held.length > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-500">
                              보류 {opt.held.length}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── Active Option Detail ── */}
              {activeOption && (
                <div className="px-5 pt-4 pb-3">
                  {/* Recommended */}
                  {activeOption.recommended.length > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center gap-2 mb-2.5">
                        <div className="w-3 h-3 rounded bg-emerald-400" />
                        <span className="text-[12px] font-bold text-emerald-300 uppercase tracking-wider">즉시 요청 가능</span>
                      </div>
                      <div className="space-y-2">
                        {activeOption.recommended.map((sc: StrategyCandidate) => (
                          <StrategyCandidateCard key={sc.id} sc={sc} variant="recommended"
                            isShortlisted={shortlistIds.has(sc.id)} isExcluded={excludedIds.has(sc.id)}
                            onToggleShortlist={toggleShortlist} onToggleExclude={toggleExclude}
                            disabled={isDecisionRecorded} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Held */}
                  {activeOption.held.length > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center gap-2 mb-2.5">
                        <div className="w-3 h-3 rounded bg-amber-400" />
                        <span className="text-[12px] font-bold text-amber-300 uppercase tracking-wider">보류 · 확인 필요</span>
                      </div>
                      <div className="space-y-2">
                        {activeOption.held.map((sc: StrategyCandidate) => (
                          <StrategyCandidateCard key={sc.id} sc={sc} variant="held"
                            isShortlisted={shortlistIds.has(sc.id)} isExcluded={excludedIds.has(sc.id)}
                            onToggleShortlist={toggleShortlist} onToggleExclude={toggleExclude}
                            disabled={isDecisionRecorded} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Excluded */}
                  {activeOption.excluded.length > 0 && (
                    <div className="mb-3">
                      <div className="flex items-center gap-2 mb-2.5">
                        <div className="w-3 h-3 rounded bg-red-400/70" />
                        <span className="text-[12px] font-bold text-red-300/80 uppercase tracking-wider">제외</span>
                      </div>
                      <div className="space-y-1.5">
                        {activeOption.excluded.map((sc: StrategyCandidate) => (
                          <div key={sc.id} className="px-4 py-2.5 rounded-lg border border-red-500/15 bg-[#241e1e]">
                            <span className="text-[12px] text-slate-300 font-medium block">{sc.name}</span>
                            <span className="text-[10px] text-red-400/70 block mt-0.5">{sc.selectionReason}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Recommendation Block — 접힘 섹션 ── */}
                  <div className="mt-3">
                    <button type="button" onClick={() => setShowRationale(!showRationale)}
                      className="flex items-center gap-1.5 text-[10px] text-slate-500 hover:text-slate-400 font-medium uppercase tracking-widest transition-colors">
                      {showRationale ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      결정 근거 {showRationale ? "접기" : "보기"}
                    </button>
                    {showRationale && (
                      <div className="mt-2 px-4 py-3 rounded-lg bg-[#1c2030] border border-blue-500/10">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px]">
                          <div>
                            <span className="text-slate-500 block text-[10px]">추천 이유</span>
                            <span className="text-slate-200">{activeOption.keyBenefit}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[10px]">운영 리스크</span>
                            <span className="text-slate-200">{activeOption.keyRisk || "없음"}</span>
                          </div>
                          {activeOption.blockers.length > 0 && (
                            <div className="col-span-2">
                              <span className="text-slate-500 block text-[10px]">요청 전 확인</span>
                              <span className="text-amber-300">{activeOption.blockers.join(" / ")}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── AI Decision CTA ── */}
              <div className="px-5 py-4 border-t border-slate-600/25 bg-[#262930]">
                {!isDecisionRecorded ? (
                  <div className="space-y-2">
                    {/* 결정안 적용 버튼 */}
                    <Button size="sm"
                      className="w-full h-10 text-[12px] bg-blue-600/25 hover:bg-blue-600/35 text-blue-100 font-semibold rounded-lg border border-blue-500/35"
                      onClick={applyStrategyDecision}
                      disabled={!activeOption || activeOption.recommended.length === 0}>
                      <Sparkles className="h-3.5 w-3.5 mr-2" />
                      이 결정안 적용 — {activeOption?.recommended.length || 0}건 선택, {activeOption?.held.length || 0}건 보류
                    </Button>
                    {/* 확정 */}
                    <Button size="sm"
                      className="w-full h-11 text-[13px] bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg"
                      onClick={recordDecision}
                      disabled={shortlistCount === 0 || !categoryResult.isComparable}>
                      <Check className="h-4 w-4 mr-2" />
                      선택 후보로 요청 조립 시작 — {shortlistCount}건
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2.5 px-4 py-3 rounded-lg bg-emerald-950/30 border border-emerald-500/20">
                      <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                      <span className="text-[12px] text-emerald-300 font-semibold">선택 후보 {shortlistCount}건 저장됨</span>
                      <button type="button" onClick={handleUndo} className="ml-auto text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1.5 font-medium">
                        <Undo2 className="h-3.5 w-3.5" />되돌리기
                      </button>
                    </div>
                    <Button size="sm"
                      className="w-full h-11 text-[13px] bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg"
                      onClick={handleRequestHandoff}>
                      <FileText className="h-4 w-4 mr-2" />
                      견적 후보로 반영
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* ═══════════════════════════════════════════════════════════════════
                BASIC RAW COMPARISON SURFACE
                목적: 무엇이 다른가
            ═══════════════════════════════════════════════════════════════════ */
            <>
              {/* ── Fact Comparison Table ── */}
              <div className="px-5 pt-4 pb-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 block">후보 상세 비교</span>
                <div className="border border-slate-600/20 rounded-lg overflow-hidden">
                  <div className="grid bg-[#262930] border-b border-slate-600/20"
                    style={{ gridTemplateColumns: `100px repeat(${candidates.length}, minmax(0, 1fr))` }}>
                    <div className="px-3 py-2 text-[10px] text-slate-600 font-medium">항목</div>
                    {candidates.map((c) => (
                      <div key={c.id} className="px-3 py-2 text-[11px] text-slate-200 font-semibold truncate border-l border-slate-600/20">{c.name}</div>
                    ))}
                  </div>
                  {[
                    { label: "브랜드", getter: (c: CompareCandidateInfo) => c.brand || "—" },
                    { label: "카탈로그", getter: (c: CompareCandidateInfo) => c.catalogNumber || "—" },
                    { label: "규격", getter: (c: CompareCandidateInfo) => c.spec || "—" },
                    { label: "카테고리", getter: (c: CompareCandidateInfo) => c.category || "—" },
                    { label: "단가", getter: (c: CompareCandidateInfo) => c.priceKRW > 0 ? `₩${c.priceKRW.toLocaleString("ko-KR")}` : "미확인" },
                    { label: "납기", getter: (c: CompareCandidateInfo) => c.leadTimeDays > 0 ? `${c.leadTimeDays}영업일` : "미확인" },
                  ].map((row, ri) => (
                    <div key={ri} className="grid border-b border-slate-700/15 last:border-b-0"
                      style={{ gridTemplateColumns: `100px repeat(${candidates.length}, minmax(0, 1fr))` }}>
                      <div className="px-3 py-2 text-[10px] text-slate-500 font-medium">{row.label}</div>
                      {candidates.map((c) => (
                        <div key={c.id} className="px-3 py-2 text-[11px] text-slate-300 truncate border-l border-slate-700/15">{row.getter(c)}</div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Key Differences ── */}
              <div className="px-5 py-3 border-t border-slate-600/15">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">핵심 차이</span>
                <div className="grid grid-cols-2 gap-2">
                  {differenceSummary.priceAdvantage && (
                    <div className="px-3 py-2 rounded border border-slate-600/20 bg-[#262830]">
                      <div className="flex items-center gap-1.5 mb-0.5"><TrendingDown className="h-3 w-3 text-emerald-500/70" /><span className="text-[10px] text-slate-400">가격</span></div>
                      <span className="text-[11px] text-slate-200">{differenceSummary.priceAdvantage.label}</span>
                    </div>
                  )}
                  {differenceSummary.leadTimeAdvantage && (
                    <div className="px-3 py-2 rounded border border-slate-600/20 bg-[#262830]">
                      <div className="flex items-center gap-1.5 mb-0.5"><Clock className="h-3 w-3 text-blue-500/70" /><span className="text-[10px] text-slate-400">납기</span></div>
                      <span className="text-[11px] text-slate-200">{differenceSummary.leadTimeAdvantage.label}</span>
                    </div>
                  )}
                  <div className="px-3 py-2 rounded border border-slate-600/20 bg-[#262830]">
                    <div className="flex items-center gap-1.5 mb-0.5"><Package className="h-3 w-3 text-slate-600" /><span className="text-[10px] text-slate-500">규격</span></div>
                    <span className="text-[11px] text-slate-200">{differenceSummary.specFitNote}</span>
                  </div>
                  <div className="px-3 py-2 rounded border border-slate-600/20 bg-[#262830]">
                    <div className="flex items-center gap-1.5 mb-0.5"><Package className="h-3 w-3 text-slate-600" /><span className="text-[10px] text-slate-500">브랜드</span></div>
                    <span className="text-[11px] text-slate-200">{differenceSummary.brandNote}</span>
                  </div>
                </div>
              </div>

              {/* ── Manual Selection ── */}
              <div className="px-5 pt-3 pb-3 border-t border-slate-600/15">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 block">수동 선택</span>
                <div className="space-y-2">
                  {candidates.map((c) => {
                    const isShortlisted = shortlistIds.has(c.id);
                    const isExcluded = excludedIds.has(c.id);
                    return (
                      <div key={c.id} className={`px-4 py-3 rounded-lg border transition-all ${
                        isShortlisted ? "border-emerald-500/30 bg-[#1e2820]"
                          : isExcluded ? "border-red-500/20 bg-[#241e1e] opacity-60"
                            : "border-slate-600/25 bg-[#282b32]"
                      }`}>
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <span className="text-[13px] font-bold text-white block truncate">{c.name}</span>
                            <span className="text-[11px] text-slate-400 block mt-0.5">{c.brand} · {c.priceKRW > 0 ? `₩${c.priceKRW.toLocaleString("ko-KR")}` : "가격 미확인"}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button type="button" onClick={() => toggleShortlist(c.id)} disabled={isDecisionRecorded}
                              className={`h-8 px-3 rounded-md text-[11px] font-semibold flex items-center gap-1.5 transition-all ${
                                isShortlisted ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 border border-slate-700/40"
                              } ${isDecisionRecorded ? "opacity-50 cursor-not-allowed" : ""}`}>
                              <Check className="h-3.5 w-3.5" />{isShortlisted ? "선택됨" : "선택"}
                            </button>
                            <button type="button" onClick={() => toggleExclude(c.id)} disabled={isDecisionRecorded}
                              className={`h-8 px-3 rounded-md text-[11px] font-semibold flex items-center gap-1.5 transition-all ${
                                isExcluded ? "bg-red-500/15 text-red-400 border border-red-500/25" : "text-slate-400 hover:text-red-400 hover:bg-red-500/10 border border-slate-700/40"
                              } ${isDecisionRecorded ? "opacity-50 cursor-not-allowed" : ""}`}>
                              <Minus className="h-3.5 w-3.5" />제외
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── Basic CTA ── */}
              <div className="px-5 py-4 border-t border-slate-600/25 bg-[#262930]">
                {!isDecisionRecorded ? (
                  <div>
                    <Button size="sm"
                      className="w-full h-11 text-[13px] bg-slate-600 hover:bg-slate-500 text-white font-bold rounded-lg"
                      onClick={recordDecision}
                      disabled={shortlistCount === 0 || !categoryResult.isComparable}>
                      <Check className="h-4 w-4 mr-2" />
                      수동 비교 결과 저장 — {shortlistCount}건
                    </Button>
                    {shortlistCount === 0 && (
                      <p className="text-[10px] text-slate-600 text-center mt-2">후보를 1개 이상 선택하세요</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2.5 px-4 py-3 rounded-lg bg-emerald-950/30 border border-emerald-500/20">
                      <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                      <span className="text-[12px] text-emerald-300 font-semibold">선택 후보 {shortlistCount}건 저장됨</span>
                      <button type="button" onClick={handleUndo} className="ml-auto text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1.5 font-medium">
                        <Undo2 className="h-3.5 w-3.5" />되돌리기
                      </button>
                    </div>
                    <Button size="sm"
                      className="w-full h-11 text-[13px] bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg"
                      onClick={handleRequestHandoff}>
                      <FileText className="h-4 w-4 mr-2" />
                      견적 후보로 반영
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ═══ Dock ═══ */}
        <div className="px-5 py-2.5 border-t border-slate-600/30 bg-[#262930]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-[11px]">
              <span className="text-slate-400">선택 후보 <span className="text-slate-200 font-semibold">{shortlistCount}</span></span>
              <span className="text-slate-600">·</span>
              <span className="text-slate-400">제외 <span className="text-slate-200 font-semibold">{excludedCount}</span></span>
              {isDecisionRecorded && (
                <><span className="text-slate-700">·</span><span className="text-emerald-400 font-semibold">저장됨</span></>
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

// ══════════════════════════════════════════════════════════════════════════════
// Sub-Component: Strategy Candidate Card (AI mode)
// ══════════════════════════════════════════════════════════════════════════════

function StrategyCandidateCard({
  sc,
  variant,
  isShortlisted,
  isExcluded,
  onToggleShortlist,
  onToggleExclude,
  disabled,
}: {
  sc: StrategyCandidate;
  variant: "recommended" | "held";
  isShortlisted: boolean;
  isExcluded: boolean;
  onToggleShortlist: (id: string) => void;
  onToggleExclude: (id: string) => void;
  disabled: boolean;
}) {
  const isRecommended = variant === "recommended";
  const cardBg = isShortlisted
    ? isRecommended ? "border-emerald-500/40 bg-emerald-950/40 ring-1 ring-emerald-500/20" : "border-emerald-500/30 bg-[#1e2820]"
    : isExcluded
      ? "border-red-500/20 bg-[#241e1e] opacity-60"
      : isRecommended
        ? "border-blue-500/25 bg-[#1e2230]"
        : "border-slate-600/20 bg-[#24272c]";

  return (
    <div className={`px-4 py-3.5 rounded-lg border-2 transition-all ${cardBg}`}>
      {/* Name + badge row */}
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-[13px] font-bold text-white truncate">{sc.name}</span>
        <span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase tracking-wider shrink-0 ${
          isRecommended ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/25" : "bg-amber-500/15 text-amber-400 border border-amber-500/20"
        }`}>{sc.readinessLabel}</span>
      </div>
      {/* 핵심 판단 1줄 */}
      <span className="text-[11px] text-slate-200 block leading-snug">{sc.selectionReason}</span>
      <span className="text-[10px] text-slate-500 block mt-0.5">{sc.brand}</span>

      {/* Actions — 즉시 보이게 상단 배치 */}
      <div className="flex items-center gap-1.5 mt-2.5">
        <button type="button" onClick={() => onToggleShortlist(sc.id)} disabled={disabled}
          className={`h-9 px-3.5 rounded-md text-[11px] font-bold flex items-center gap-1.5 transition-all ${
            isShortlisted ? "bg-emerald-500/25 text-emerald-200 border border-emerald-500/40 shadow-sm shadow-emerald-500/10" : "text-slate-300 hover:text-emerald-300 hover:bg-emerald-500/15 border border-slate-600/40"
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}>
          <Check className="h-3.5 w-3.5" />{isShortlisted ? "선택됨" : "선택"}
        </button>
        <button type="button" onClick={() => onToggleExclude(sc.id)} disabled={disabled}
          className={`h-9 px-3.5 rounded-md text-[11px] font-bold flex items-center gap-1.5 transition-all ${
            isExcluded ? "bg-red-500/20 text-red-300 border border-red-500/30" : "text-slate-400 hover:text-red-400 hover:bg-red-500/10 border border-slate-600/40"
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}>
          <Minus className="h-3.5 w-3.5" />제외
        </button>
      </div>
    </div>
  );
}
