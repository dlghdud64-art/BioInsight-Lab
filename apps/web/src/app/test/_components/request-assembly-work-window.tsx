"use client";

import { useMemo, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Check, AlertTriangle, FileText, ArrowRight, Package, Building2, ClipboardList, ChevronRight, AlertCircle } from "lucide-react";
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
  const [urgency, setUrgency] = useState<"normal" | "urgent" | "critical">("normal");
  const [substituteScope, setSubstituteScope] = useState<"none" | "same_brand" | "equivalent">("none");
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
      requestConditions: { ...assemblyState.requestConditions, purpose, urgency, substituteScope },
    });
  }, [assemblyState, purpose, urgency, substituteScope]);

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

  const toggleLineSubstitute = useCallback((lineId: string) => {
    setAssemblyState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        requestLines: prev.requestLines.map((l) =>
          l.lineId === lineId ? { ...l, substituteAllowed: !l.substituteAllowed } : l,
        ),
      };
    });
  }, []);

  const recordDraft = useCallback(() => {
    if (!assemblyState || !validation?.canRecordDraft) return;
    const stateWithPurpose: RequestAssemblyState = {
      ...assemblyState,
      requestConditions: { ...assemblyState.requestConditions, purpose, urgency, substituteScope },
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
  }, [assemblyState, validation, purpose, urgency, substituteScope, onDraftRecorded, onSubmissionReady]);

  if (!open || !assemblyState) return null;

  const includedVendors = assemblyState.targetVendors.filter((v) => v.included);
  const isDraftRecorded = !!draftSnapshot;
  const incompleteLines = assemblyState.requestLines.filter((l) => !l.isComplete);

  // ── Validation state for dock ──
  const hasBlockers = (validation?.blockingIssues.length ?? 0) > 0;
  const hasWarnings = (validation?.warnings.length ?? 0) > 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/35 flex items-center justify-center p-4 md:p-8" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#24272d] border border-slate-600/40 rounded-2xl shadow-2xl w-full flex flex-col" style={{ maxWidth: "1160px", maxHeight: "84vh" }}>

        {/* ═══ 1. Stage Chrome — header ═══ */}
        <div className="shrink-0 px-6 py-4 border-b border-slate-600/30 bg-[#282c33]" style={{ borderTopLeftRadius: "16px", borderTopRightRadius: "16px" }}>
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-2.5">
            <span className="hover:text-slate-300 transition-colors cursor-default">소싱</span>
            <ChevronRight className="h-3 w-3 text-slate-600" />
            <span className="hover:text-slate-300 transition-colors cursor-default">비교 검토</span>
            <ChevronRight className="h-3 w-3 text-slate-600" />
            <span className="text-white font-semibold">견적 요청 조립</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-600/15 border border-emerald-500/25">
                <FileText className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white leading-tight">견적 요청 조립</h2>
                <div className="flex items-center gap-3 mt-1 text-sm">
                  <span className="text-slate-300">품목 <span className="text-white font-semibold">{assemblyState.requestLines.length}건</span></span>
                  <span className="text-slate-500">·</span>
                  <span className="text-slate-300">공급사 <span className="text-emerald-300 font-semibold">{includedVendors.length}곳</span></span>
                  {handoff?.compareDecisionSnapshotId && (
                    <>
                      <span className="text-slate-500">·</span>
                      <span className="inline-flex items-center gap-1 text-blue-400 text-xs font-medium">비교 결과 기반</span>
                    </>
                  )}
                  {incompleteLines.length > 0 && (
                    <>
                      <span className="text-slate-500">·</span>
                      <span className="inline-flex items-center gap-1 text-amber-400 text-xs font-medium">
                        <AlertTriangle className="h-3 w-3" />불완전 {incompleteLines.length}건
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="h-9 w-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/[0.06] transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* ═══ 2. Scrollable Body ═══ */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* ═══ Compare provenance ═══ */}
          {handoff?.compareRationaleSummary && (
            <div className="px-4 py-3 rounded-lg bg-blue-600/[0.06] border border-blue-500/20">
              <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider block mb-1">비교 판단 근거</span>
              <span className="text-sm text-blue-200 leading-relaxed">{handoff.compareRationaleSummary}</span>
            </div>
          )}

          {/* ═══ A. Request Target Summary — 품목 섹션 ═══ */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Package className="h-4 w-4 text-slate-400" />
              <h3 className="text-[15px] font-semibold text-slate-100">요청 품목</h3>
              <span className="text-xs text-slate-400 ml-1">{assemblyState.requestLines.length}건</span>
            </div>
            <div className="space-y-2">
              {assemblyState.requestLines.map((line) => (
                <div
                  key={line.lineId}
                  className={`flex items-center gap-4 px-4 py-3.5 rounded-lg border transition-all ${
                    line.isComplete
                      ? "border-slate-600/30 bg-[#2a2e35]"
                      : "border-amber-500/25 bg-amber-600/[0.04]"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-slate-100 font-medium block truncate">{line.itemName}</span>
                    <span className="text-xs text-slate-400 mt-0.5 block">{line.catalogReference || "카탈로그 미확인"}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-slate-400">수량</span>
                      <Input
                        type="number"
                        min={1}
                        value={line.requestedQty}
                        onChange={(e) => updateLineQty(line.lineId, parseInt(e.target.value) || 1)}
                        className="w-20 h-8 text-sm text-center bg-[#1e2126] border-slate-600/30 text-slate-100"
                        disabled={isDraftRecorded}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleLineSubstitute(line.lineId)}
                      disabled={isDraftRecorded}
                      className={`h-8 px-3 rounded-md text-xs font-medium border transition-all ${
                        line.substituteAllowed
                          ? "border-emerald-500/30 bg-emerald-600/12 text-emerald-300"
                          : "border-slate-600/30 text-slate-400 hover:text-slate-300 hover:border-slate-500/40"
                      }`}
                    >
                      {line.substituteAllowed ? "대체 허용" : "대체 불가"}
                    </button>
                    {!line.isComplete && (
                      <AlertTriangle className="h-4 w-4 text-amber-400" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ═══ B. Vendor Target Selection — 공급사 섹션 ═══ */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="h-4 w-4 text-slate-400" />
              <h3 className="text-[15px] font-semibold text-slate-100">공급사 대상</h3>
              <span className="text-xs text-slate-400 ml-1">{includedVendors.length}/{assemblyState.targetVendors.length}곳 선택</span>
            </div>
            <div className="space-y-2">
              {assemblyState.targetVendors.map((vendor) => (
                <div
                  key={vendor.vendorId}
                  className={`flex items-center gap-4 px-4 py-3.5 rounded-lg border transition-all ${
                    vendor.included
                      ? "border-emerald-500/25 bg-emerald-600/[0.05]"
                      : "border-slate-600/25 bg-[#2a2e35] opacity-60"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleVendor(vendor.vendorId)}
                    disabled={isDraftRecorded}
                    className={`w-6 h-6 rounded-md border flex items-center justify-center shrink-0 transition-all ${
                      vendor.included
                        ? "bg-emerald-600/25 border-emerald-500/50 text-emerald-300"
                        : "border-slate-600/40 text-transparent hover:border-slate-500/50"
                    }`}
                  >
                    {vendor.included && <Check className="h-3.5 w-3.5" />}
                  </button>
                  <Building2 className="h-4 w-4 text-slate-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-slate-100 font-medium block truncate">{vendor.vendorDisplayName}</span>
                    <span className="text-xs text-slate-400 mt-0.5 block">커버 품목 {vendor.lineCoverage.length}건</span>
                  </div>
                  <span className={`text-xs shrink-0 px-2 py-0.5 rounded-md border ${
                    vendor.priority === 1
                      ? "bg-blue-600/10 border-blue-500/20 text-blue-300"
                      : "bg-slate-700/30 border-slate-600/20 text-slate-400"
                  }`}>
                    우선순위 {vendor.priority}
                  </span>
                </div>
              ))}
              {assemblyState.targetVendors.length === 0 && (
                <div className="flex items-center gap-3 px-4 py-3.5 rounded-lg border border-amber-500/25 bg-amber-600/[0.04]">
                  <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                  <span className="text-sm text-amber-200">공급사 정보가 없습니다. 수동으로 지정하거나 견적 요청 시 확인이 필요합니다.</span>
                </div>
              )}
            </div>
          </section>

          {/* ═══ C. Request Conditions — 조건 섹션 ═══ */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <ClipboardList className="h-4 w-4 text-slate-400" />
              <h3 className="text-[15px] font-semibold text-slate-100">요청 조건</h3>
            </div>
            <div className="space-y-4">
              {/* Purpose */}
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1.5">요청 목적</label>
                <Input
                  placeholder="예: 연구실 재고 보충 / 프로젝트 시약 구매"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  className="h-10 text-sm bg-[#1e2126] border-slate-600/30 text-slate-100 placeholder:text-slate-500"
                  disabled={isDraftRecorded}
                />
              </div>

              {/* Urgency + Substitute scope */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1.5">긴급도</label>
                  <div className="flex gap-1.5">
                    {(["normal", "urgent", "critical"] as const).map((u) => {
                      const label = u === "normal" ? "일반" : u === "urgent" ? "긴급" : "최우선";
                      const isActive = urgency === u;
                      return (
                        <button
                          key={u}
                          type="button"
                          onClick={() => setUrgency(u)}
                          disabled={isDraftRecorded}
                          className={`flex-1 h-9 rounded-md text-sm font-medium border transition-all ${
                            isActive
                              ? u === "critical" ? "bg-red-600/15 border-red-500/30 text-red-300"
                                : u === "urgent" ? "bg-amber-600/15 border-amber-500/30 text-amber-300"
                                : "bg-blue-600/12 border-blue-500/25 text-blue-300"
                              : "border-slate-600/30 text-slate-400 hover:text-slate-300 hover:border-slate-500/40"
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1.5">대체품 허용 범위</label>
                  <div className="flex gap-1.5">
                    {(["none", "same_brand", "equivalent"] as const).map((s) => {
                      const label = s === "none" ? "불가" : s === "same_brand" ? "동일 브랜드" : "동등 규격";
                      const isActive = substituteScope === s;
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setSubstituteScope(s)}
                          disabled={isDraftRecorded}
                          className={`flex-1 h-9 rounded-md text-sm font-medium border transition-all ${
                            isActive
                              ? "bg-blue-600/12 border-blue-500/25 text-blue-300"
                              : "border-slate-600/30 text-slate-400 hover:text-slate-300 hover:border-slate-500/40"
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Response requirements + inquiry items */}
              <div className="grid grid-cols-2 gap-4">
                <div className="px-4 py-3 rounded-lg border border-slate-600/25 bg-[#2a2e35]">
                  <span className="text-xs font-medium text-slate-400 block mb-2">응답 요청 항목</span>
                  <div className="flex flex-wrap gap-1.5">
                    {assemblyState.requestConditions.responseRequirements.map((r, i) => (
                      <span key={i} className="text-xs px-2 py-1 rounded-md bg-slate-700/50 text-slate-200 border border-slate-600/20">{r}</span>
                    ))}
                  </div>
                </div>
                <div className="px-4 py-3 rounded-lg border border-slate-600/25 bg-[#2a2e35]">
                  <span className="text-xs font-medium text-slate-400 block mb-2">확인 요청 사항</span>
                  <div className="flex flex-wrap gap-1.5">
                    {["납기", "재고", "MOQ", "단가"].map((item) => (
                      <span key={item} className="text-xs px-2 py-1 rounded-md bg-slate-700/50 text-slate-200 border border-slate-600/20">{item}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ═══ Unresolved info from compare ═══ */}
          {handoff && handoff.unresolvedInfoItems.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="h-4 w-4 text-amber-400" />
                <h3 className="text-[15px] font-semibold text-slate-100">미확인 항목</h3>
                <span className="text-xs text-slate-400">(비교 단계에서 이월)</span>
              </div>
              <div className="space-y-1.5">
                {handoff.unresolvedInfoItems.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-600/[0.04] border border-amber-500/15">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                    <span className="text-sm text-amber-200">{item}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ═══ Validation / Warning / Blocker 섹션 ═══ */}
          {validation && (hasBlockers || hasWarnings) && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-4 w-4 text-red-400" />
                <h3 className="text-[15px] font-semibold text-slate-100">검증 결과</h3>
              </div>
              <div className="space-y-2">
                {validation.blockingIssues.map((b, i) => (
                  <div key={`block-${i}`} className="flex items-start gap-3 px-4 py-3 rounded-lg bg-red-600/[0.07] border border-red-500/20">
                    <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs font-semibold text-red-300 uppercase tracking-wider block mb-0.5">차단</span>
                      <span className="text-sm text-red-200">{b}</span>
                    </div>
                  </div>
                ))}
                {validation.warnings.map((w, i) => (
                  <div key={`warn-${i}`} className="flex items-start gap-3 px-4 py-3 rounded-lg bg-amber-600/[0.06] border border-amber-500/15">
                    <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs font-semibold text-amber-300 uppercase tracking-wider block mb-0.5">경고</span>
                      <span className="text-sm text-amber-200">{w}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ═══ No issues — neutral-positive strip ═══ */}
          {validation && !hasBlockers && !hasWarnings && !isDraftRecorded && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-emerald-600/[0.05] border border-emerald-500/15">
              <Check className="h-4 w-4 text-emerald-400 shrink-0" />
              <span className="text-sm text-emerald-200">검증 통과 — 차단 항목 없음</span>
            </div>
          )}

          {/* ═══ Draft success ═══ */}
          {isDraftRecorded && (
            <div className="flex items-center gap-3 px-4 py-3.5 rounded-lg bg-emerald-600/[0.08] border border-emerald-500/20">
              <Check className="h-5 w-5 text-emerald-400 shrink-0" />
              <div>
                <span className="text-sm font-semibold text-emerald-200 block">요청 초안이 저장되었습니다</span>
                <span className="text-xs text-emerald-300/70 mt-0.5 block">제출 준비 단계로 이동할 수 있습니다</span>
              </div>
            </div>
          )}
        </div>

        {/* ═══ 3. Sticky Dock ═══ */}
        <div className="shrink-0 px-6 py-4 border-t border-slate-600/30 bg-[#1e2126]" style={{ borderBottomLeftRadius: "16px", borderBottomRightRadius: "16px" }}>
          {/* Status strip */}
          <div className="flex items-center gap-4 text-xs mb-3">
            <span className="text-slate-400">품목 <span className="text-slate-200 font-semibold">{assemblyState.requestLines.length}</span></span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-400">공급사 <span className="text-slate-200 font-semibold">{includedVendors.length}</span></span>
            {incompleteLines.length > 0 && (
              <>
                <span className="text-slate-600">·</span>
                <span className="text-amber-400 font-medium">불완전 {incompleteLines.length}</span>
              </>
            )}
            {validation?.recommendedNextAction && (
              <>
                <span className="text-slate-600">·</span>
                <span className="text-slate-400">{validation.recommendedNextAction}</span>
              </>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              variant="ghost"
              className="h-10 px-4 text-sm text-slate-400 hover:text-slate-200 border border-slate-600/30 hover:border-slate-500/40"
              onClick={onClose}
            >
              닫기
            </Button>
            {!isDraftRecorded ? (
              <Button
                className="flex-1 h-10 text-sm bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                onClick={recordDraft}
                disabled={!validation?.canRecordDraft}
              >
                <ClipboardList className="h-4 w-4 mr-2" />
                요청 초안 저장
              </Button>
            ) : (
              <Button
                className="flex-1 h-10 text-sm bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                onClick={onGoToSubmission}
              >
                <FileText className="h-4 w-4 mr-2" />
                제출 준비
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
