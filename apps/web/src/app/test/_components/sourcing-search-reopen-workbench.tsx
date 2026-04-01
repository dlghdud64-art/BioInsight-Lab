"use client";

import { useMemo, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Check, AlertTriangle, ArrowRight, ArrowLeft, Search, RefreshCw, Filter, Zap } from "lucide-react";
import { type SourcingSearchReopenState, type SourcingSearchReopenObject, createInitialSourcingSearchReopenState, buildSourcingSearchSeeds, buildSearchBaselineReuseDecision, validateSourcingSearchReopenBeforeRecord, buildSourcingSearchReopenObject, buildSourcingSearchResultHandoff, type SourcingStrategyOption, type SourcingStrategyType } from "@/lib/ai/sourcing-search-reopen-engine";
import type { SourcingReopenHandoff } from "@/lib/ai/procurement-reentry-engine";

const STRATEGY_CONFIG: Record<SourcingStrategyType, { label: string; color: string; bg: string }> = {
  exact_match_first: { label: "Exact Match", color: "text-blue-400", bg: "bg-blue-600/10" },
  cross_vendor_equivalent: { label: "Cross-Vendor", color: "text-violet-400", bg: "bg-violet-600/10" },
  alternative_pack_substitute: { label: "Alt Pack/Sub", color: "text-emerald-400", bg: "bg-emerald-600/10" },
};

interface SourcingSearchReopenWorkbenchProps {
  open: boolean; onClose: () => void; handoff: SourcingReopenHandoff | null;
  onReopenRecorded: (obj: SourcingSearchReopenObject) => void;
  onSourcingResultHandoff: () => void;
  onReturnToReentry: () => void;
}

export function SourcingSearchReopenWorkbench({ open, onClose, handoff, onReopenRecorded, onSourcingResultHandoff, onReturnToReentry }: SourcingSearchReopenWorkbenchProps) {
  const [reopenState, setReopenState] = useState<SourcingSearchReopenState | null>(null);
  const [reopenObject, setReopenObject] = useState<SourcingSearchReopenObject | null>(null);
  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState("");
  const [selectedStrategy, setSelectedStrategy] = useState<string | null>(null);
  const defaultStrategies: SourcingStrategyOption[] = [
    { id: "strat_exact", strategyType: "exact_match_first", label: "Exact Match First", rationale: "동일 제품·동일 규격 우선 검색", risk: "대체 후보 부족 가능", recommendedScenario: "기존 제품 재구매", downstreamEffect: "비교 단계 최소화" },
    { id: "strat_cross", strategyType: "cross_vendor_equivalent", label: "Cross-Vendor Equivalent", rationale: "다른 공급사의 동등 제품 탐색", risk: "규격 차이 검증 필요", recommendedScenario: "가격·납기 최적화", downstreamEffect: "비교 단계 확대" },
    { id: "strat_alt", strategyType: "alternative_pack_substitute", label: "Alternative Pack / Substitute", rationale: "대체 용량·대체 제품 포함 검색", risk: "호환성 검증 필요", recommendedScenario: "긴급 재고 확보", downstreamEffect: "비교+규격 검증 필요" },
  ];

  useMemo(() => { if (open && handoff && !reopenState) setReopenState(createInitialSourcingSearchReopenState(handoff)); }, [open, handoff]); // eslint-disable-line

  const currentState = useMemo<SourcingSearchReopenState | null>(() => {
    if (!reopenState) return null;
    return { ...reopenState, querySeed: { ...reopenState.querySeed, keywordBasis: keyword, categorySeed: category }, missingDecisionCount: (!keyword && !category) ? 1 : 0 };
  }, [reopenState, keyword, category]);

  const seeds = useMemo(() => currentState ? buildSourcingSearchSeeds(currentState) : null, [currentState]);
  const baselineDecision = useMemo(() => currentState ? buildSearchBaselineReuseDecision(currentState) : null, [currentState]);
  const validation = useMemo(() => currentState ? validateSourcingSearchReopenBeforeRecord(currentState) : null, [currentState]);

  const recordReopen = useCallback(() => {
    if (!currentState || !validation?.canRecordSourcingSearchReopen) return;
    const obj = buildSourcingSearchReopenObject(currentState);
    setReopenObject(obj); onReopenRecorded(obj);
    setReopenState(prev => prev ? { ...prev, sourcingSearchReopenStatus: "sourcing_search_reopen_recorded", sourcingSearchReopenObjectId: obj.id, substatus: "ready_for_search_result_open" } : prev);
  }, [currentState, validation, onReopenRecorded]);

  if (!open || !reopenState || !handoff) return null;
  const isRecorded = !!reopenObject;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#1C2028] border border-bd rounded-xl shadow-2xl w-full max-w-3xl max-h-[88vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-bd bg-[#252A33]">
          <div className="flex items-center gap-3">
            <div className={`flex items-center justify-center w-7 h-7 rounded-lg border ${isRecorded ? "bg-emerald-600/15 border-emerald-500/25" : "bg-blue-600/15 border-blue-500/25"}`}>
              {isRecorded ? <Check className="h-4 w-4 text-emerald-400" /> : <Search className="h-4 w-4 text-blue-400" />}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">{isRecorded ? "Search Reopen 완료" : "Sourcing Search Reopen"}</h2>
              <div className="flex items-center gap-2 text-[10px] mt-0.5">
                <span className="text-slate-400">Route: <span className="text-blue-300 font-medium">{handoff.selectedReentryRoute}</span></span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-400">Qty: <span className="text-slate-200 font-medium">{handoff.reorderCandidateQtySummary}</span></span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-400">Baseline: <span className="text-slate-200 font-medium">{reopenState.baselineReuseMode}</span></span>
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded text-slate-500 hover:text-slate-300 hover:bg-white/[0.05]"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Re-entry basis */}
          <div className="px-3 py-2 rounded-md bg-blue-600/[0.04] border border-blue-500/15">
            <span className="text-[9px] font-medium text-blue-400 uppercase tracking-wider block mb-0.5">Procurement Re-entry 근거</span>
            <span className="text-[10px] text-blue-200">Reorder: {handoff.reorderCandidateQtySummary} · Baseline: {handoff.baselineReuseSummary} · Scope: {handoff.reentryScopeSummary || "미지정"}</span>
          </div>

          {/* Query seed */}
          <div>
            <div className="flex items-center gap-1.5 mb-2"><Search className="h-3 w-3 text-slate-500" /><span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">Query Seed</span></div>
            <div className="space-y-2">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">검색 키워드</label>
                <Input placeholder="시약명, CAS No., 카탈로그 번호" value={keyword} onChange={e => setKeyword(e.target.value)} className="h-8 text-[11px] bg-[#1C2028] border-bd/40" disabled={isRecorded} />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">카테고리</label>
                <Input placeholder="카테고리 (예: Antibody, Reagent)" value={category} onChange={e => setCategory(e.target.value)} className="h-8 text-[11px] bg-[#1C2028] border-bd/40" disabled={isRecorded} />
              </div>
            </div>
          </div>

          {/* Filter seed / priority */}
          <div>
            <div className="flex items-center gap-1.5 mb-2"><Filter className="h-3 w-3 text-slate-500" /><span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">Filter · Priority</span></div>
            <div className="grid grid-cols-3 gap-2">
              <div className="px-3 py-2 rounded-md border border-bd/40 bg-[#252A33]"><span className="text-[9px] text-slate-500 block">재고 선호</span><span className="text-[10px] text-slate-300">{reopenState.filterSeed.inStockPreference ? "선호" : "무관"}</span></div>
              <div className="px-3 py-2 rounded-md border border-bd/40 bg-[#252A33]"><span className="text-[9px] text-slate-500 block">납기 우선순위</span><span className="text-[10px] text-slate-300">{reopenState.filterSeed.leadTimePreference}</span></div>
              <div className="px-3 py-2 rounded-md border border-bd/40 bg-[#252A33]"><span className="text-[9px] text-slate-500 block">가격 민감도</span><span className="text-[10px] text-slate-300">{reopenState.filterSeed.priceSensitivity}</span></div>
            </div>
            <div className="mt-2 px-3 py-2 rounded-md border border-bd/40 bg-[#252A33]">
              <div className="flex items-center gap-1.5 mb-0.5"><Zap className="h-3 w-3 text-slate-500" /><span className="text-[9px] text-slate-500">긴급도</span></div>
              <span className="text-[10px] text-slate-300 font-medium">{reopenState.prioritySignal.urgency} — {reopenState.prioritySignal.reorderQtyBasis}</span>
            </div>
          </div>

          {/* AI Sourcing Strategy Options (tri-option decision strip) */}
          <div>
            <div className="flex items-center gap-1.5 mb-2"><Zap className="h-3 w-3 text-blue-400" /><span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">AI Sourcing Strategy</span></div>
            <div className="space-y-1.5">
              {defaultStrategies.map(strat => {
                const config = STRATEGY_CONFIG[strat.strategyType];
                const isSelected = selectedStrategy === strat.id;
                return (
                  <button key={strat.id} type="button" onClick={() => !isRecorded && setSelectedStrategy(strat.id)} disabled={isRecorded}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md border text-left transition-all ${isSelected ? "border-blue-500/30 bg-blue-600/[0.06]" : "border-bd/40 bg-[#252A33] hover:bg-[#2a2c30]"}`}>
                    <div className="flex-1 min-w-0">
                      <span className={`text-[11px] font-medium block ${isSelected ? "text-slate-100" : "text-slate-300"}`}>{strat.label}</span>
                      <span className="text-[9px] text-slate-500">{strat.rationale}</span>
                      <div className="flex items-center gap-2 mt-0.5"><span className="text-[8px] text-amber-400">Risk: {strat.risk}</span><span className="text-[8px] text-slate-600">·</span><span className="text-[8px] text-slate-500">{strat.downstreamEffect}</span></div>
                    </div>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium shrink-0 ${isSelected ? config.color + " " + config.bg : "text-slate-500 bg-slate-700/30"}`}>{config.label}</span>
                    {isSelected && <Check className="h-4 w-4 text-blue-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Baseline reuse */}
          {baselineDecision && (
            <div>
              <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">Baseline Reuse</span>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {[
                  { label: "검색 컨텍스트", reuse: baselineDecision.reuseSearchQueryContext },
                  { label: "카테고리·규격", reuse: baselineDecision.reuseCategoryAndSpecBaseline },
                  { label: "공급사 힌트", reuse: baselineDecision.reusePreferredVendorHints },
                ].map(item => (
                  <div key={item.label} className={`px-3 py-2 rounded-md border text-center ${item.reuse ? "border-emerald-500/20 bg-emerald-600/[0.03]" : "border-bd/40 bg-[#252A33]"}`}>
                    <span className="text-[9px] text-slate-500 block">{item.label}</span>
                    <span className={`text-[10px] font-medium ${item.reuse ? "text-emerald-300" : "text-slate-500"}`}>{item.reuse ? "재사용" : "초기화"}</span>
                  </div>
                ))}
              </div>
              {baselineDecision.baselineCarryForwardRiskSummary && (
                <div className="mt-1.5 flex items-center gap-1.5 text-[9px] text-amber-400"><AlertTriangle className="h-3 w-3 shrink-0" />{baselineDecision.baselineCarryForwardRiskSummary}</div>
              )}
            </div>
          )}

          {/* Seed validation */}
          {seeds && seeds.blockingIssues.length > 0 && !isRecorded && seeds.blockingIssues.map((b, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-md bg-red-600/[0.06] border border-red-500/15"><AlertTriangle className="h-3 w-3 text-red-400 shrink-0" /><span className="text-[10px] text-red-300">{b}</span></div>
          ))}

          {isRecorded && (
            <div className="px-3 py-3 rounded-md bg-emerald-600/[0.06] border border-emerald-500/15">
              <div className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /><span className="text-[11px] text-emerald-300 font-medium">Search Reopen 저장 완료</span></div>
              <span className="text-[10px] text-slate-400 block mt-1">소싱 결과 화면으로 진행하여 AI 판단 활성 → 비교 → 요청 흐름을 다시 시작할 수 있습니다.</span>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-bd bg-[#181E28]">
          <div className="flex items-center gap-3 text-[10px] mb-2.5">
            <span className="text-slate-500">Query: <span className="text-slate-300 font-medium">{keyword || category || "미지정"}</span></span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-500">Baseline: <span className="text-slate-300 font-medium">{reopenState.baselineReuseMode}</span></span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-500">{validation?.recommendedNextAction || ""}</span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" className="h-8 px-3 text-[10px] text-slate-400 hover:text-slate-300 border border-bd/40" onClick={onReturnToReentry}><ArrowLeft className="h-3 w-3 mr-1" />Procurement Re-entry</Button>
            {!isRecorded ? (
              <Button size="sm" className="flex-1 h-8 text-[10px] bg-blue-600 hover:bg-blue-500 text-white font-medium" onClick={recordReopen} disabled={!validation?.canRecordSourcingSearchReopen}><Search className="h-3 w-3 mr-1" />Search Reopen 저장</Button>
            ) : (
              <Button size="sm" className="flex-1 h-8 text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white font-medium" onClick={onSourcingResultHandoff}><Search className="h-3 w-3 mr-1" />Sourcing Result<ArrowRight className="h-3 w-3 ml-1" /></Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
