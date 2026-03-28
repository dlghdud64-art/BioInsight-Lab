"use client";

import { useMemo, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { X, Check, AlertTriangle, ArrowRight, ArrowLeft, RefreshCw, Search, GitCompare, FileText, Eye } from "lucide-react";
import { type ProcurementReentryState, type ProcurementReentryObject, type ReentryRoute, createInitialProcurementReentryState, buildProcurementReentryRoutePlan, buildBaselineReusePlan, validateProcurementReentryBeforeRecord, buildProcurementReentryObject, buildSourcingReopenHandoff } from "@/lib/ai/procurement-reentry-engine";
import type { ProcurementReentryHandoff } from "@/lib/ai/reorder-decision-engine";

const ROUTE_CONFIG: Record<ReentryRoute, { label: string; icon: any; color: string; desc: string }> = {
  search_reopen: { label: "소싱 탐색 재개", icon: Search, color: "text-blue-400", desc: "새로운 공급사·제품 검색부터 시작" },
  compare_reopen: { label: "비교 검토 재개", icon: GitCompare, color: "text-violet-400", desc: "기존 후보 기반 비교 재검토" },
  request_reopen: { label: "요청 재생성", icon: FileText, color: "text-emerald-400", desc: "기존 구조로 RFQ 재발행" },
  watch_no_reentry: { label: "Watch 유지", icon: Eye, color: "text-amber-400", desc: "즉시 재진입 없이 모니터링" },
  blocked_from_reentry: { label: "재진입 차단", icon: AlertTriangle, color: "text-red-400", desc: "재진입 조건 미충족" },
};

interface ProcurementReentryWorkbenchProps {
  open: boolean; onClose: () => void; handoff: ProcurementReentryHandoff | null;
  onReentryRecorded: (obj: ProcurementReentryObject) => void;
  onSourcingReopenHandoff: () => void;
  onReturnToReorderDecision: () => void;
}

export function ProcurementReentryWorkbench({ open, onClose, handoff, onReentryRecorded, onSourcingReopenHandoff, onReturnToReorderDecision }: ProcurementReentryWorkbenchProps) {
  const [reentryState, setReentryState] = useState<ProcurementReentryState | null>(null);
  const [reentryObject, setReentryObject] = useState<ProcurementReentryObject | null>(null);

  useMemo(() => { if (open && handoff && !reentryState) setReentryState(createInitialProcurementReentryState(handoff)); }, [open, handoff]); // eslint-disable-line

  const routePlan = useMemo(() => reentryState ? buildProcurementReentryRoutePlan(reentryState) : null, [reentryState]);
  const baselinePlan = useMemo(() => reentryState ? buildBaselineReusePlan(reentryState) : null, [reentryState]);
  const validation = useMemo(() => reentryState ? validateProcurementReentryBeforeRecord(reentryState) : null, [reentryState]);

  const selectRoute = useCallback((route: ReentryRoute) => {
    setReentryState(prev => {
      if (!prev) return prev;
      const baseline = route === "request_reopen" ? "full_reuse" as const : route === "compare_reopen" ? "partial_reuse" as const : "full_reset" as const;
      return { ...prev, selectedReentryRoute: route, baselineReuseStatus: baseline, reentryScopeSummary: `${prev.reorderCandidateQtySummary} 재주문`, substatus: route === "watch_no_reentry" ? "procurement_reentry_blocked" as const : `ready_for_${route.replace("_reopen", "")}_reopen` as any, missingDecisionCount: 0 };
    });
  }, []);

  const recordReentry = useCallback(() => {
    if (!reentryState || !validation?.canRecordProcurementReentry) return;
    const obj = buildProcurementReentryObject(reentryState);
    setReentryObject(obj); onReentryRecorded(obj);
    setReentryState(prev => prev ? { ...prev, procurementReentryStatus: "procurement_reentry_recorded", procurementReentryObjectId: obj.id } : prev);
  }, [reentryState, validation, onReentryRecorded]);

  if (!open || !reentryState || !handoff) return null;
  const isRecorded = !!reentryObject;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#1e2024] border border-bd rounded-xl shadow-2xl w-full max-w-3xl max-h-[88vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-bd bg-[#252729]">
          <div className="flex items-center gap-3">
            <div className={`flex items-center justify-center w-7 h-7 rounded-lg border ${isRecorded ? "bg-emerald-600/15 border-emerald-500/25" : "bg-blue-600/15 border-blue-500/25"}`}>
              {isRecorded ? <Check className="h-4 w-4 text-emerald-400" /> : <RefreshCw className="h-4 w-4 text-blue-400" />}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">{isRecorded ? "Procurement Re-entry 완료" : "Procurement Re-entry"}</h2>
              <div className="flex items-center gap-2 text-[10px] mt-0.5">
                <span className="text-slate-400">Reorder <span className="text-blue-300 font-medium">{reentryState.reorderCandidateQtySummary || "—"}</span></span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-400">Watch <span className="text-amber-300 font-medium">{reentryState.watchCandidateQtySummary || "—"}</span></span>
                {reentryState.selectedReentryRoute && (
                  <><span className="text-slate-600">·</span><span className={ROUTE_CONFIG[reentryState.selectedReentryRoute].color}>{ROUTE_CONFIG[reentryState.selectedReentryRoute].label}</span></>
                )}
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded text-slate-500 hover:text-slate-300 hover:bg-white/[0.05]"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Reorder basis */}
          <div className="px-3 py-2 rounded-md bg-blue-600/[0.04] border border-blue-500/15">
            <span className="text-[9px] font-medium text-blue-400 uppercase tracking-wider block mb-0.5">Reorder Decision 근거</span>
            <span className="text-[10px] text-blue-200">Reorder: {handoff.reorderCandidateQtySummary} · Watch: {handoff.watchCandidateQtySummary} · Route: {handoff.procurementRouteSummary}</span>
          </div>

          {/* Route selection */}
          <div>
            <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">재진입 경로 선택</span>
            <div className="mt-2 space-y-1.5">
              {routePlan?.allowedRoutes.map(route => {
                const config = ROUTE_CONFIG[route];
                const Icon = config.icon;
                const isSelected = reentryState.selectedReentryRoute === route;
                return (
                  <button key={route} type="button" onClick={() => !isRecorded && selectRoute(route)} disabled={isRecorded}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-md border text-left transition-all ${isSelected ? "border-blue-500/30 bg-blue-600/[0.06]" : "border-bd/40 bg-[#252729] hover:bg-[#2a2c30]"}`}>
                    <Icon className={`h-4 w-4 shrink-0 ${isSelected ? config.color : "text-slate-500"}`} />
                    <div className="flex-1">
                      <span className={`text-[11px] font-medium block ${isSelected ? "text-slate-100" : "text-slate-300"}`}>{config.label}</span>
                      <span className="text-[9px] text-slate-500">{config.desc}</span>
                    </div>
                    {isSelected && <Check className="h-4 w-4 text-blue-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Baseline reuse */}
          {baselinePlan && reentryState.selectedReentryRoute && reentryState.selectedReentryRoute !== "watch_no_reentry" && (
            <div>
              <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">Baseline Reuse</span>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {[
                  { label: "검색 컨텍스트", reuse: baselinePlan.reuseSearchContext },
                  { label: "비교 기준", reuse: baselinePlan.reuseCompareBasis },
                  { label: "요청 라인 구조", reuse: baselinePlan.reuseRequestLineStructure },
                ].map(item => (
                  <div key={item.label} className={`px-3 py-2 rounded-md border text-center ${item.reuse ? "border-emerald-500/20 bg-emerald-600/[0.03]" : "border-bd/40 bg-[#252729]"}`}>
                    <span className="text-[9px] text-slate-500 block">{item.label}</span>
                    <span className={`text-[10px] font-medium ${item.reuse ? "text-emerald-300" : "text-slate-500"}`}>{item.reuse ? "재사용" : "초기화"}</span>
                  </div>
                ))}
              </div>
              {baselinePlan.baselineCarryForwardRisks.length > 0 && (
                <div className="mt-1.5 space-y-0.5">
                  {baselinePlan.baselineCarryForwardRisks.map((r, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-[9px] text-amber-400"><AlertTriangle className="h-3 w-3 shrink-0" />{r}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Validation */}
          {validation && validation.blockingIssues.length > 0 && !isRecorded && validation.blockingIssues.map((b, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-md bg-red-600/[0.06] border border-red-500/15"><AlertTriangle className="h-3 w-3 text-red-400 shrink-0" /><span className="text-[10px] text-red-300">{b}</span></div>
          ))}

          {isRecorded && (
            <div className="px-3 py-3 rounded-md bg-emerald-600/[0.06] border border-emerald-500/15">
              <div className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /><span className="text-[11px] text-emerald-300 font-medium">Procurement Re-entry 저장 완료</span></div>
              <span className="text-[10px] text-slate-400 block mt-1">
                {reentryState.selectedReentryRoute === "watch_no_reentry" ? "Watch 상태로 유지됩니다." : "소싱 흐름에 재진입할 수 있습니다."}
              </span>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-bd bg-[#1a1c1f]">
          <div className="flex items-center gap-3 text-[10px] mb-2.5">
            {reentryState.selectedReentryRoute && <span className={ROUTE_CONFIG[reentryState.selectedReentryRoute].color}>{ROUTE_CONFIG[reentryState.selectedReentryRoute].label}</span>}
            <span className="text-slate-600">·</span>
            <span className="text-slate-500">{validation?.recommendedNextAction || ""}</span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" className="h-8 px-3 text-[10px] text-slate-400 hover:text-slate-300 border border-bd/40" onClick={onReturnToReorderDecision}><ArrowLeft className="h-3 w-3 mr-1" />Reorder Decision</Button>
            {!isRecorded ? (
              <Button size="sm" className="flex-1 h-8 text-[10px] bg-blue-600 hover:bg-blue-500 text-white font-medium" onClick={recordReentry} disabled={!validation?.canRecordProcurementReentry}><RefreshCw className="h-3 w-3 mr-1" />Procurement Re-entry 저장</Button>
            ) : (
              <Button size="sm" className={`flex-1 h-8 text-[10px] font-medium ${validation?.canOpenSourcingReentry ? "bg-emerald-600 hover:bg-emerald-500 text-white" : "bg-slate-700 text-slate-400"}`} onClick={onSourcingReopenHandoff} disabled={!validation?.canOpenSourcingReentry}>
                <Search className="h-3 w-3 mr-1" />Sourcing Reopen<ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
