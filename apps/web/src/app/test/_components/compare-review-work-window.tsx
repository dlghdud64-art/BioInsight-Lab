"use client";

import { useMemo, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { X, Check, Minus, AlertTriangle, ArrowRight, GitCompare, TrendingDown, Clock, Package, FileText, Undo2 } from "lucide-react";
import {
  type CompareReviewState,
  type CompareCandidateInfo,
  type CompareDecisionPayload,
  type CompareDecisionSnapshot,
  type RequestCandidateHandoff,
  validateCompareCategoryIntegrity,
  buildCompareDifferenceSummary,
  buildCompareDecisionSnapshot,
  buildRequestCandidateHandoffFromCompare,
  createInitialCompareReviewState,
  isComparePreviewStale,
} from "@/lib/ai/compare-review-engine";

// ══════════════════════════════════════════════════════════════════════════════
// Props
// ══════════════════════════════════════════════════════════════════════════════

interface CompareReviewWorkWindowProps {
  open: boolean;
  onClose: () => void;
  compareIds: string[];
  products: any[];
  openedBy: "ai_apply" | "manual";
  aiOptionId?: string | null;
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
  onShortlistApplied,
  onRequestHandoff,
  onUndoDecision,
}: CompareReviewWorkWindowProps) {
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

  // ── Validation + Difference ──
  const categoryResult = useMemo(() => validateCompareCategoryIntegrity(candidates), [candidates]);
  const differenceSummary = useMemo(() => buildCompareDifferenceSummary(candidates), [candidates]);

  // ── Review state ──
  const [reviewState, setReviewState] = useState<CompareReviewState | null>(null);
  const [shortlistIds, setShortlistIds] = useState<Set<string>>(new Set());
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [decisionSnapshot, setDecisionSnapshot] = useState<CompareDecisionSnapshot | null>(null);
  const [showUndoBanner, setShowUndoBanner] = useState(false);

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
    const snapshot = buildCompareDecisionSnapshot(reviewState, differenceSummary, payload);
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

        {/* ═══ Scrollable body ═══ */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* ═══ Category warnings ═══ */}
          {categoryResult.warnings.length > 0 && (
            <div className="space-y-1">
              {categoryResult.warnings.map((w, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-md bg-amber-600/[0.06] border border-amber-500/15">
                  <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" />
                  <span className="text-[10px] text-amber-300">{w}</span>
                </div>
              ))}
            </div>
          )}

          {categoryResult.blockingIssues.length > 0 && (
            <div className="space-y-1">
              {categoryResult.blockingIssues.map((b, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-md bg-red-600/[0.06] border border-red-500/15">
                  <AlertTriangle className="h-3 w-3 text-red-400 shrink-0" />
                  <span className="text-[10px] text-red-300">{b}</span>
                </div>
              ))}
            </div>
          )}

          {/* ═══ 2. Difference Summary (numbers first) ═══ */}
          <div>
            <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">핵심 차이</span>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {differenceSummary.priceAdvantage && (
                <div className="px-3 py-2.5 rounded-md border border-bd/40 bg-[#252729]">
                  <div className="flex items-center gap-1.5 mb-1">
                    <TrendingDown className="h-3 w-3 text-emerald-400" />
                    <span className="text-[9px] text-slate-500">가격 우위</span>
                  </div>
                  <span className="text-[11px] text-slate-200 font-medium block">{differenceSummary.priceAdvantage.label}</span>
                  <span className="text-[10px] text-slate-400">{differenceSummary.priceAdvantage.delta}</span>
                </div>
              )}
              {differenceSummary.leadTimeAdvantage && (
                <div className="px-3 py-2.5 rounded-md border border-bd/40 bg-[#252729]">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Clock className="h-3 w-3 text-blue-400" />
                    <span className="text-[9px] text-slate-500">납기 우위</span>
                  </div>
                  <span className="text-[11px] text-slate-200 font-medium block">{differenceSummary.leadTimeAdvantage.label}</span>
                  <span className="text-[10px] text-slate-400">{differenceSummary.leadTimeAdvantage.delta}</span>
                </div>
              )}
              <div className="px-3 py-2.5 rounded-md border border-bd/40 bg-[#252729]">
                <div className="flex items-center gap-1.5 mb-1">
                  <Package className="h-3 w-3 text-slate-400" />
                  <span className="text-[9px] text-slate-500">규격</span>
                </div>
                <span className="text-[11px] text-slate-200 font-medium">{differenceSummary.specFitNote}</span>
              </div>
              <div className="px-3 py-2.5 rounded-md border border-bd/40 bg-[#252729]">
                <div className="flex items-center gap-1.5 mb-1">
                  <Package className="h-3 w-3 text-slate-400" />
                  <span className="text-[9px] text-slate-500">브랜드</span>
                </div>
                <span className="text-[11px] text-slate-200 font-medium">{differenceSummary.brandNote}</span>
              </div>
            </div>
            {/* Operational risk line */}
            <div className="mt-2 px-3 py-2 rounded bg-[#252729] border border-bd/30">
              <span className="text-[10px] text-slate-400">{differenceSummary.operationalRisk}</span>
            </div>
          </div>

          {/* ═══ 3. Compare Matrix ═══ */}
          <div>
            <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">비교 매트릭스</span>
            <div className="mt-2 border border-bd/40 rounded-md overflow-hidden">
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
          </div>

          {/* ═══ Missing info ═══ */}
          {differenceSummary.missingInfoItems.length > 0 && (
            <div>
              <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">누락 정보</span>
              <div className="mt-1.5 space-y-0.5">
                {differenceSummary.missingInfoItems.map((item, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-[10px] text-amber-400">
                    <AlertTriangle className="h-3 w-3 shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══ 4. Decision Actions — shortlist / exclude per candidate ═══ */}
          <div>
            <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">판단</span>
            <div className="mt-2 space-y-1.5">
              {candidates.map((c) => {
                const isShortlisted = shortlistIds.has(c.id);
                const isExcluded = excludedIds.has(c.id);
                return (
                  <div key={c.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-md border transition-all ${isShortlisted ? "border-emerald-500/25 bg-emerald-600/[0.04]" : isExcluded ? "border-red-500/15 bg-red-600/[0.03] opacity-60" : "border-bd/40 bg-[#252729]"}`}>
                    <div className="flex-1 min-w-0">
                      <span className="text-[11px] text-slate-200 font-medium block truncate">{c.name}</span>
                      <span className="text-[10px] text-slate-500">{c.brand} · {c.catalogNumber || "—"}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] tabular-nums text-slate-400">{c.priceKRW > 0 ? `₩${c.priceKRW.toLocaleString("ko-KR")}` : "—"}</span>
                      <Button
                        size="sm"
                        variant={isShortlisted ? "default" : "ghost"}
                        className={`h-6 px-2 text-[9px] ${isShortlisted ? "bg-emerald-600/15 text-emerald-400 hover:bg-emerald-600/25 border border-emerald-500/25" : "text-slate-500 hover:text-emerald-400 border border-bd/30"}`}
                        onClick={() => toggleShortlist(c.id)}
                        disabled={isDecisionRecorded}
                      >
                        <Check className="h-3 w-3 mr-0.5" />
                        {isShortlisted ? "shortlist" : "남기기"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className={`h-6 px-2 text-[9px] ${isExcluded ? "bg-red-600/10 text-red-400 border border-red-500/20" : "text-slate-500 hover:text-red-400 border border-bd/30"}`}
                        onClick={() => toggleExclude(c.id)}
                        disabled={isDecisionRecorded}
                      >
                        <Minus className="h-3 w-3 mr-0.5" />
                        제외
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ═══ Undo banner ═══ */}
          {showUndoBanner && isDecisionRecorded && (
            <div className="flex items-center justify-between px-3 py-2 rounded-md bg-blue-600/[0.06] border border-blue-500/15">
              <span className="text-[10px] text-blue-300">비교 결과가 저장되었습니다 — shortlist {shortlistCount}개</span>
              <Button size="sm" variant="ghost" className="h-6 px-2 text-[9px] text-blue-400 hover:text-blue-300" onClick={handleUndo}>
                <Undo2 className="h-3 w-3 mr-0.5" />
                되돌리기
              </Button>
            </div>
          )}
        </div>

        {/* ═══ 5. Readiness Summary + Actions ═══ */}
        <div className="px-5 py-3 border-t border-bd bg-[#1a1c1f]">
          {/* Summary strip */}
          <div className="flex items-center gap-3 text-[10px] mb-2.5">
            <span className="text-slate-500">shortlist <span className="text-slate-300 font-medium">{shortlistCount}</span></span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-500">제외 <span className="text-slate-300 font-medium">{excludedCount}</span></span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-500">{categoryResult.recommendedNextAction}</span>
          </div>
          {/* Action buttons */}
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" className="h-8 px-3 text-[10px] text-slate-400 hover:text-slate-300 border border-bd/40" onClick={onClose}>
              닫기
            </Button>
            {!isDecisionRecorded ? (
              <Button
                size="sm"
                className="flex-1 h-8 text-[10px] bg-blue-600 hover:bg-blue-500 text-white font-medium"
                onClick={recordDecision}
                disabled={shortlistCount === 0 || !categoryResult.isComparable}
              >
                <Check className="h-3 w-3 mr-1" />
                비교 결과 저장 ({shortlistCount}개 shortlist)
              </Button>
            ) : (
              <Button
                size="sm"
                className="flex-1 h-8 text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
                onClick={handleRequestHandoff}
              >
                <FileText className="h-3 w-3 mr-1" />
                견적 후보로 반영
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
