"use client";

import { useMemo, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Check, AlertTriangle, FileText, ArrowRight, Package, Building2, ClipboardList } from "lucide-react";
import {
  type RequestAssemblyState,
  type RequestCandidateInfo,
  type RequestDraftSnapshot,
  type RequestSubmissionHandoff,
  type RequestCandidateHandoff,
  createInitialRequestAssemblyState,
  validateRequestAssemblyBeforeDraft,
  buildRequestDraftSnapshot,
  buildRequestSubmissionHandoff,
} from "@/lib/ai/request-assembly-engine";
import type { RequestCandidateHandoff as CompareHandoff } from "@/lib/ai/compare-review-engine";

// ══════════════════════════════════════════════════════════════════════════════
// Props
// ══════════════════════════════════════════════════════════════════════════════

interface RequestAssemblyWorkWindowProps {
  open: boolean;
  onClose: () => void;
  handoff: CompareHandoff | null;
  products: any[];
  quoteItems: any[];
  onDraftRecorded: (snapshot: RequestDraftSnapshot) => void;
  onSubmissionReady: (handoff: RequestSubmissionHandoff) => void;
  onGoToSubmission: () => void;
}

// ══════════════════════════════════════════════════════════════════════════════
// Component
// ══════════════════════════════════════════════════════════════════════════════

export function RequestAssemblyWorkWindow({
  open,
  onClose,
  handoff,
  products,
  quoteItems,
  onDraftRecorded,
  onSubmissionReady,
  onGoToSubmission,
}: RequestAssemblyWorkWindowProps) {
  // ── Resolve candidates ──
  const candidateInfos = useMemo<RequestCandidateInfo[]>(() => {
    const ids = handoff?.requestCandidateIds ?? quoteItems.map((q: any) => q.productId);
    return ids.map((id: string) => {
      const p = products.find((pp: any) => pp.id === id);
      if (!p) return null;
      const v = p.vendors?.[0];
      return {
        id: p.id,
        name: p.name,
        brand: p.brand || "",
        catalogNumber: p.catalogNumber || "",
        spec: p.specification || p.packSize || "",
        priceKRW: v?.priceInKRW || 0,
        leadTimeDays: v?.leadTimeDays || 0,
        vendorName: v?.vendor?.name || "",
        vendorId: v?.vendor?.id || "",
      };
    }).filter(Boolean) as RequestCandidateInfo[];
  }, [handoff, products, quoteItems]);

  // ── Assembly state ──
  const [assemblyState, setAssemblyState] = useState<RequestAssemblyState | null>(null);
  const [purpose, setPurpose] = useState("");
  const [draftSnapshot, setDraftSnapshot] = useState<RequestDraftSnapshot | null>(null);

  // Initialize on open
  useMemo(() => {
    if (open && candidateInfos.length > 0 && !assemblyState) {
      const mockHandoff: CompareHandoff = handoff ?? {
        compareDecisionSnapshotId: "",
        shortlistedItemIds: candidateInfos.map((c) => c.id),
        excludedItemIds: [],
        requestCandidateIds: candidateInfos.map((c) => c.id),
        compareRationaleSummary: "수동 선택",
        unresolvedInfoItems: [],
        nextRequestActionSeed: "견적 요청 조립",
      };
      setAssemblyState(createInitialRequestAssemblyState(mockHandoff, candidateInfos));
    }
  }, [open, candidateInfos.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Validation ──
  const validation = useMemo(() => {
    if (!assemblyState) return null;
    return validateRequestAssemblyBeforeDraft({
      ...assemblyState,
      requestConditions: { ...assemblyState.requestConditions, purpose },
    });
  }, [assemblyState, purpose]);

  // ── Actions ──
  const toggleVendor = useCallback((vendorId: string) => {
    setAssemblyState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        targetVendors: prev.targetVendors.map((v) =>
          v.vendorId === vendorId ? { ...v, included: !v.included } : v,
        ),
      };
    });
  }, []);

  const updateLineQty = useCallback((lineId: string, qty: number) => {
    setAssemblyState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        requestLines: prev.requestLines.map((l) =>
          l.lineId === lineId ? { ...l, requestedQty: qty } : l,
        ),
      };
    });
  }, []);

  const recordDraft = useCallback(() => {
    if (!assemblyState || !validation?.canRecordDraft) return;
    const stateWithPurpose: RequestAssemblyState = {
      ...assemblyState,
      requestConditions: { ...assemblyState.requestConditions, purpose },
    };
    const snapshot = buildRequestDraftSnapshot(stateWithPurpose);
    setDraftSnapshot(snapshot);
    onDraftRecorded(snapshot);
    const subHandoff = buildRequestSubmissionHandoff(snapshot);
    onSubmissionReady(subHandoff);
    setAssemblyState((prev) => prev ? {
      ...prev,
      requestAssemblyStatus: "request_draft_recorded",
      substatus: "ready_for_submission_prep",
      requestDraftSnapshotId: snapshot.id,
    } : prev);
  }, [assemblyState, validation, purpose, onDraftRecorded, onSubmissionReady]);

  if (!open || !assemblyState) return null;

  const includedVendors = assemblyState.targetVendors.filter((v) => v.included);
  const isDraftRecorded = !!draftSnapshot;
  const incompleteLines = assemblyState.requestLines.filter((l) => !l.isComplete);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#1e2024] border border-bd rounded-xl shadow-2xl w-full max-w-3xl max-h-[88vh] overflow-hidden flex flex-col">
        {/* ═══ 1. Identity Strip ═══ */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-bd bg-[#252729]">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-600/15 border border-emerald-500/25">
              <FileText className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">견적 요청 조립</h2>
              <div className="flex items-center gap-2 text-[10px] mt-0.5">
                <span className="text-slate-400">품목 <span className="text-slate-200 font-medium">{assemblyState.requestLines.length}개</span></span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-400">공급사 <span className="text-emerald-300 font-medium">{includedVendors.length}개</span></span>
                {handoff?.compareDecisionSnapshotId && (
                  <>
                    <span className="text-slate-600">·</span>
                    <span className="text-blue-400">비교 결과 기반</span>
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
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* ═══ Compare provenance ═══ */}
          {handoff?.compareRationaleSummary && (
            <div className="px-3 py-2 rounded-md bg-blue-600/[0.04] border border-blue-500/15">
              <span className="text-[9px] font-medium text-blue-400 uppercase tracking-wider block mb-0.5">비교 판단 근거</span>
              <span className="text-[10px] text-blue-200">{handoff.compareRationaleSummary}</span>
            </div>
          )}

          {/* ═══ A. Request Target Summary ═══ */}
          <div>
            <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">요청 품목</span>
            <div className="mt-2 space-y-1">
              {assemblyState.requestLines.map((line) => (
                <div key={line.lineId} className={`flex items-center gap-3 px-3 py-2.5 rounded-md border transition-all ${line.isComplete ? "border-bd/40 bg-[#252729]" : "border-amber-500/20 bg-amber-600/[0.03]"}`}>
                  <div className="flex-1 min-w-0">
                    <span className="text-[11px] text-slate-200 font-medium block truncate">{line.itemName}</span>
                    <span className="text-[10px] text-slate-500">{line.catalogReference || "카탈로그 미확인"}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] text-slate-500">수량</span>
                      <Input
                        type="number"
                        min={1}
                        value={line.requestedQty}
                        onChange={(e) => updateLineQty(line.lineId, parseInt(e.target.value) || 1)}
                        className="w-16 h-6 text-[10px] text-center bg-[#1e2024] border-bd/40"
                        disabled={isDraftRecorded}
                      />
                    </div>
                    {!line.isComplete && (
                      <AlertTriangle className="h-3 w-3 text-amber-400" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ═══ B. Vendor Target Selection ═══ */}
          <div>
            <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">공급사 대상</span>
            <div className="mt-2 space-y-1">
              {assemblyState.targetVendors.map((vendor) => (
                <div key={vendor.vendorId} className={`flex items-center gap-3 px-3 py-2.5 rounded-md border transition-all ${vendor.included ? "border-emerald-500/20 bg-emerald-600/[0.03]" : "border-bd/40 bg-[#252729] opacity-50"}`}>
                  <button
                    type="button"
                    onClick={() => toggleVendor(vendor.vendorId)}
                    disabled={isDraftRecorded}
                    className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-all ${vendor.included ? "bg-emerald-600/20 border-emerald-500/40 text-emerald-400" : "border-bd/60 text-transparent"}`}
                  >
                    {vendor.included && <Check className="h-3 w-3" />}
                  </button>
                  <Building2 className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-[11px] text-slate-200 font-medium block truncate">{vendor.vendorDisplayName}</span>
                    <span className="text-[10px] text-slate-500">커버 품목 {vendor.lineCoverage.length}개</span>
                  </div>
                  <span className="text-[9px] text-slate-500 shrink-0">우선순위 {vendor.priority}</span>
                </div>
              ))}
              {assemblyState.targetVendors.length === 0 && (
                <div className="flex items-center gap-2 px-3 py-3 rounded-md border border-amber-500/20 bg-amber-600/[0.03]">
                  <AlertTriangle className="h-3 w-3 text-amber-400" />
                  <span className="text-[10px] text-amber-300">공급사 정보가 없습니다. 수동으로 지정하거나 견적 요청 시 확인이 필요합니다.</span>
                </div>
              )}
            </div>
          </div>

          {/* ═══ C. Request Conditions ═══ */}
          <div>
            <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">요청 조건</span>
            <div className="mt-2 space-y-2">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">요청 목적</label>
                <Input
                  placeholder="예: 연구실 재고 보충 / 프로젝트 시약 구매"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  className="h-8 text-[11px] bg-[#1e2024] border-bd/40"
                  disabled={isDraftRecorded}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="px-3 py-2 rounded-md border border-bd/40 bg-[#252729]">
                  <span className="text-[9px] text-slate-500 block mb-0.5">응답 요청 항목</span>
                  <span className="text-[10px] text-slate-300">{assemblyState.requestConditions.responseRequirements.join(", ")}</span>
                </div>
                <div className="px-3 py-2 rounded-md border border-bd/40 bg-[#252729]">
                  <span className="text-[9px] text-slate-500 block mb-0.5">대체 허용</span>
                  <span className="text-[10px] text-slate-300">{assemblyState.requestConditions.substituteScope === "none" ? "불가" : assemblyState.requestConditions.substituteScope === "same_brand" ? "동일 브랜드" : "동등 규격"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ═══ Unresolved info from compare ═══ */}
          {handoff && handoff.unresolvedInfoItems.length > 0 && (
            <div>
              <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">미확인 항목 (비교 단계)</span>
              <div className="mt-1.5 space-y-0.5">
                {handoff.unresolvedInfoItems.map((item, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-[10px] text-amber-400">
                    <AlertTriangle className="h-3 w-3 shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══ Validation summary ═══ */}
          {validation && (validation.blockingIssues.length > 0 || validation.warnings.length > 0) && (
            <div className="space-y-1">
              {validation.blockingIssues.map((b, i) => (
                <div key={`block-${i}`} className="flex items-center gap-2 px-3 py-2 rounded-md bg-red-600/[0.06] border border-red-500/15">
                  <AlertTriangle className="h-3 w-3 text-red-400 shrink-0" />
                  <span className="text-[10px] text-red-300">{b}</span>
                </div>
              ))}
              {validation.warnings.map((w, i) => (
                <div key={`warn-${i}`} className="flex items-center gap-2 px-3 py-2 rounded-md bg-amber-600/[0.04] border border-amber-500/10">
                  <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" />
                  <span className="text-[10px] text-amber-300">{w}</span>
                </div>
              ))}
            </div>
          )}

          {/* ═══ Draft success ═══ */}
          {isDraftRecorded && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-md bg-emerald-600/[0.06] border border-emerald-500/15">
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-[10px] text-emerald-300">요청 초안이 저장되었습니다</span>
            </div>
          )}
        </div>

        {/* ═══ D. Submission Readiness + Actions ═══ */}
        <div className="px-5 py-3 border-t border-bd bg-[#1a1c1f]">
          <div className="flex items-center gap-3 text-[10px] mb-2.5">
            <span className="text-slate-500">품목 <span className="text-slate-300 font-medium">{assemblyState.requestLines.length}</span></span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-500">공급사 <span className="text-slate-300 font-medium">{includedVendors.length}</span></span>
            {incompleteLines.length > 0 && (
              <>
                <span className="text-slate-600">·</span>
                <span className="text-amber-400">불완전 {incompleteLines.length}</span>
              </>
            )}
            <span className="text-slate-600">·</span>
            <span className="text-slate-500">{validation?.recommendedNextAction || ""}</span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" className="h-8 px-3 text-[10px] text-slate-400 hover:text-slate-300 border border-bd/40" onClick={onClose}>
              닫기
            </Button>
            {!isDraftRecorded ? (
              <Button
                size="sm"
                className="flex-1 h-8 text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
                onClick={recordDraft}
                disabled={!validation?.canRecordDraft}
              >
                <ClipboardList className="h-3 w-3 mr-1" />
                요청 초안 저장
              </Button>
            ) : (
              <Button
                size="sm"
                className="flex-1 h-8 text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
                onClick={onGoToSubmission}
              >
                <FileText className="h-3 w-3 mr-1" />
                제출 준비
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
