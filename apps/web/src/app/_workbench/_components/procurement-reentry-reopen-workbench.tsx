"use client";
import { useMemo, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { X, Check, AlertTriangle, ArrowRight, ArrowLeft, RefreshCw, Search, GitCompare, FileText, Eye } from "lucide-react";
import { type ProcurementReentryReopenState, type ProcurementReentryReopenObject, type ReopenRoute, createInitialProcurementReentryReopenState, validateProcurementReentryReopenBeforeRecord, buildProcurementReentryReopenObject } from "@/lib/ai/procurement-reentry-reopen-engine";
import type { ProcurementReentryReopenHandoff } from "@/lib/ai/reorder-decision-reentry-engine";

const ROUTE_CONFIG: Record<ReopenRoute, { label: string; icon: any; color: string; desc: string }> = {
  search_reopen: { label: "소싱 탐색 재개", icon: Search, color: "text-blue-400", desc: "새로운 공급사·제품 검색부터 시작" },
  compare_reopen: { label: "비교 검토 재개", icon: GitCompare, color: "text-violet-400", desc: "기존 후보 기반 비교 재검토" },
  request_reopen: { label: "요청 재생성", icon: FileText, color: "text-emerald-400", desc: "기존 구조로 견적 요청 재발행" },
  watch_only: { label: "Watch 유지", icon: Eye, color: "text-amber-400", desc: "즉시 재진입 없이 모니터링" },
  blocked_from_procurement_reopen: { label: "재진입 차단", icon: AlertTriangle, color: "text-red-400", desc: "재진입 조건 미충족" },
};

interface Props { open: boolean; onClose: () => void; handoff: ProcurementReentryReopenHandoff | null; onReopenRecorded: (obj: ProcurementReentryReopenObject) => void; onSourcingSearchReopenHandoff: () => void; onCompareReopenHandoff: () => void; onRequestReopenHandoff: () => void; onReturnToReorderDecisionReentry: () => void; }

export function ProcurementReentryReopenWorkbench({ open, onClose, handoff, onReopenRecorded, onSourcingSearchReopenHandoff, onCompareReopenHandoff, onRequestReopenHandoff, onReturnToReorderDecisionReentry }: Props) {
  const [state, setState] = useState<ProcurementReentryReopenState | null>(null);
  const [obj, setObj] = useState<ProcurementReentryReopenObject | null>(null);
  useMemo(() => { if (open && handoff && !state) setState(createInitialProcurementReentryReopenState(handoff)); }, [open, handoff]); // eslint-disable-line
  const validation = useMemo(() => state ? validateProcurementReentryReopenBeforeRecord(state) : null, [state]);
  const selectRoute = useCallback((route: ReopenRoute) => { setState(prev => { if (!prev) return prev; const baseline = route === "request_reopen" ? "full_reuse" as const : route === "compare_reopen" ? "partial_reuse" as const : "full_reset" as const; return { ...prev, selectedReopenRoute: route, baselineReuseMode: baseline, reopenScopeSummary: `${prev.reorderCandidateQtySummary} 재주문`, missingDecisionCount: 0 }; }); }, []);
  const recordReopen = useCallback(() => { if (!state || !validation?.canRecordProcurementReentryReopen) return; const o = buildProcurementReentryReopenObject(state); setObj(o); onReopenRecorded(o); setState(prev => prev ? { ...prev, procurementReentryReopenStatus: "procurement_reentry_reopen_recorded", procurementReentryReopenObjectId: o.id } : prev); }, [state, validation, onReopenRecorded]);
  if (!open || !state || !handoff) return null;
  const isRecorded = !!obj;
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#1C2028] border border-bd rounded-xl shadow-2xl w-full max-w-3xl max-h-[88vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-bd bg-[#252A33]">
          <div className="flex items-center gap-3"><div className={`flex items-center justify-center w-7 h-7 rounded-lg border ${isRecorded ? "bg-emerald-600/15 border-emerald-500/25" : "bg-blue-600/15 border-blue-500/25"}`}>{isRecorded ? <Check className="h-4 w-4 text-emerald-400" /> : <RefreshCw className="h-4 w-4 text-blue-400" />}</div><div><h2 className="text-sm font-semibold text-slate-100">{isRecorded ? "Procurement Reopen 완료" : "Procurement Re-entry Reopen"}</h2><div className="flex items-center gap-2 text-[10px] mt-0.5"><span className="text-slate-400">Reorder <span className="text-blue-300 font-medium">{state.reorderCandidateQtySummary || "—"}</span></span><span className="text-slate-600">·</span><span className="text-slate-400">Watch <span className="text-amber-300 font-medium">{state.watchCandidateQtySummary || "—"}</span></span>{state.selectedReopenRoute && <><span className="text-slate-600">·</span><span className={ROUTE_CONFIG[state.selectedReopenRoute].color}>{ROUTE_CONFIG[state.selectedReopenRoute].label}</span></>}</div></div></div>
          <button type="button" onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded text-slate-500 hover:text-slate-300 hover:bg-white/[0.05]"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="px-3 py-2 rounded-md bg-blue-600/[0.04] border border-blue-500/15"><span className="text-[9px] font-medium text-blue-400 uppercase tracking-wider block mb-0.5">Reorder Decision Re-entry 근거</span><span className="text-[10px] text-blue-200">Reorder: {handoff.reorderCandidateQtySummary} · Watch: {handoff.watchCandidateQtySummary} · Coverage: {handoff.coverageRiskStatus} · Expiry: {handoff.expiryRiskStatus}</span></div>
          <div><span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">재진입 경로 선택</span><div className="mt-2 space-y-1.5">
            {(["search_reopen", "compare_reopen", "request_reopen", "watch_only"] as ReopenRoute[]).map(route => { const config = ROUTE_CONFIG[route]; const Icon = config.icon; const isSelected = state.selectedReopenRoute === route; return (
              <button key={route} type="button" onClick={() => !isRecorded && selectRoute(route)} disabled={isRecorded} className={`w-full flex items-center gap-3 px-3 py-3 rounded-md border text-left transition-all ${isSelected ? "border-blue-500/30 bg-blue-600/[0.06]" : "border-bd/40 bg-[#252A33] hover:bg-[#2a2c30]"}`}><Icon className={`h-4 w-4 shrink-0 ${isSelected ? config.color : "text-slate-500"}`} /><div className="flex-1"><span className={`text-[11px] font-medium block ${isSelected ? "text-slate-100" : "text-slate-300"}`}>{config.label}</span><span className="text-[9px] text-slate-500">{config.desc}</span></div>{isSelected && <Check className="h-4 w-4 text-blue-400 shrink-0" />}</button>
            ); })}
          </div></div>
          {state.selectedReopenRoute && state.selectedReopenRoute !== "watch_only" && <div><span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">Baseline Reuse</span><div className="mt-2 grid grid-cols-3 gap-2">{[{ label: "검색 컨텍스트", reuse: state.baselineReuseMode === "full_reuse" || state.baselineReuseMode === "partial_reuse" }, { label: "비교 기준", reuse: state.baselineReuseMode === "full_reuse" }, { label: "요청 라인 구조", reuse: state.baselineReuseMode === "full_reuse" }].map(item => <div key={item.label} className={`px-3 py-2 rounded-md border text-center ${item.reuse ? "border-emerald-500/20 bg-emerald-600/[0.03]" : "border-bd/40 bg-[#252A33]"}`}><span className="text-[9px] text-slate-500 block">{item.label}</span><span className={`text-[10px] font-medium ${item.reuse ? "text-emerald-300" : "text-slate-500"}`}>{item.reuse ? "재사용" : "초기화"}</span></div>)}</div></div>}
          {validation && validation.blockingIssues.length > 0 && !isRecorded && validation.blockingIssues.map((b, i) => <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-md bg-red-600/[0.06] border border-red-500/15"><AlertTriangle className="h-3 w-3 text-red-400 shrink-0" /><span className="text-[10px] text-red-300">{b}</span></div>)}
          {isRecorded && <div className="px-3 py-3 rounded-md bg-emerald-600/[0.06] border border-emerald-500/15"><div className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /><span className="text-[11px] text-emerald-300 font-medium">Procurement Re-entry Reopen 저장 완료</span></div><span className="text-[10px] text-slate-400 block mt-1">소싱 흐름에 재진입하여 전체 procurement cycle을 다시 시작할 수 있습니다.</span></div>}
        </div>
        <div className="px-5 py-3 border-t border-bd bg-[#181E28]">
          <div className="flex items-center gap-3 text-[10px] mb-2.5">{state.selectedReopenRoute && <span className={ROUTE_CONFIG[state.selectedReopenRoute].color}>{ROUTE_CONFIG[state.selectedReopenRoute].label}</span>}<span className="text-slate-600">·</span><span className="text-slate-500">{validation?.recommendedNextAction || ""}</span></div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" className="h-8 px-3 text-[10px] text-slate-400 hover:text-slate-300 border border-bd/40" onClick={onReturnToReorderDecisionReentry}><ArrowLeft className="h-3 w-3 mr-1" />Reorder Re-entry</Button>
            {!isRecorded ? <Button size="sm" className="flex-1 h-8 text-[10px] bg-blue-600 hover:bg-blue-500 text-white font-medium" onClick={recordReopen} disabled={!validation?.canRecordProcurementReentryReopen}><RefreshCw className="h-3 w-3 mr-1" />Procurement Reopen 저장</Button> : <div className="flex gap-1.5 flex-1">
              {validation?.canOpenSourcingSearchReopen && <Button size="sm" className="flex-1 h-8 text-[10px] bg-blue-600 hover:bg-blue-500 text-white font-medium" onClick={onSourcingSearchReopenHandoff}><Search className="h-3 w-3 mr-1" />Search Reopen<ArrowRight className="h-3 w-3 ml-1" /></Button>}
              {validation?.canOpenCompareReopen && <Button size="sm" className="flex-1 h-8 text-[10px] bg-violet-600 hover:bg-violet-500 text-white font-medium" onClick={onCompareReopenHandoff}><GitCompare className="h-3 w-3 mr-1" />Compare<ArrowRight className="h-3 w-3 ml-1" /></Button>}
              {validation?.canOpenRequestReopen && <Button size="sm" className="flex-1 h-8 text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white font-medium" onClick={onRequestReopenHandoff}><FileText className="h-3 w-3 mr-1" />Request<ArrowRight className="h-3 w-3 ml-1" /></Button>}
            </div>}
          </div>
        </div>
      </div>
    </div>
  );
}
