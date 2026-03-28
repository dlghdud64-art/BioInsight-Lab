"use client";

import { useMemo, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Check, AlertTriangle, ArrowRight, ArrowLeft, Lock, Edit3, ShieldCheck, Package } from "lucide-react";
import {
  type PoConversionState,
  type PoConversionDraftObject,
  type PoCreatedHandoff,
  createInitialPoConversionState,
  buildPoCompletionSummary,
  validatePoConversionBeforeDraft,
  buildPoConversionDecisionOptions,
  buildPoConversionDraftObject,
  buildPoCreatedHandoff,
} from "@/lib/ai/po-conversion-engine";
import type { ApprovalWorkbenchHandoff } from "@/lib/ai/quote-compare-review-engine";

// ══════════════════════════════════════════════════════════════════════════════
// Props
// ══════════════════════════════════════════════════════════════════════════════

interface PoConversionEntryWorkbenchProps {
  open: boolean;
  onClose: () => void;
  approvalHandoff: ApprovalWorkbenchHandoff | null;
  onDraftRecorded: (draft: PoConversionDraftObject) => void;
  onPoCreatedHandoff: (handoff: PoCreatedHandoff) => void;
  onSendBackToApproval: () => void;
}

// ══════════════════════════════════════════════════════════════════════════════
// Component
// ══════════════════════════════════════════════════════════════════════════════

export function PoConversionEntryWorkbench({
  open,
  onClose,
  approvalHandoff,
  onDraftRecorded,
  onPoCreatedHandoff,
  onSendBackToApproval,
}: PoConversionEntryWorkbenchProps) {
  const [convState, setConvState] = useState<PoConversionState | null>(null);
  const [draftObject, setDraftObject] = useState<PoConversionDraftObject | null>(null);

  // ── Editable field state ──
  const [paymentTerm, setPaymentTerm] = useState("");
  const [billingRef, setBillingRef] = useState("");
  const [deliveryTarget, setDeliveryTarget] = useState("");
  const [receivingInst, setReceivingInst] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [supplierNote, setSupplierNote] = useState("");
  const [shipTo, setShipTo] = useState("");

  // ── Init ──
  useMemo(() => {
    if (open && approvalHandoff && !convState) {
      setConvState(createInitialPoConversionState(approvalHandoff));
    }
  }, [open, approvalHandoff]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync editable fields to state ──
  const currentState = useMemo<PoConversionState | null>(() => {
    if (!convState) return null;
    return {
      ...convState,
      editableFields: { paymentTerm, billingReference: billingRef, requestedDeliveryTarget: deliveryTarget, receivingInstruction: receivingInst, internalPoNote: internalNote, supplierFacingNote: supplierNote, shipToReference: shipTo, poHeaderMemo: "" },
      missingFieldCount: [paymentTerm, billingRef, deliveryTarget, receivingInst].filter((v) => !v).length,
    };
  }, [convState, paymentTerm, billingRef, deliveryTarget, receivingInst, internalNote, supplierNote, shipTo]);

  const completion = useMemo(() => currentState ? buildPoCompletionSummary(currentState) : null, [currentState]);
  const validation = useMemo(() => currentState ? validatePoConversionBeforeDraft(currentState) : null, [currentState]);
  const decisions = useMemo(() => currentState ? buildPoConversionDecisionOptions(currentState) : null, [currentState]);

  // ── Actions ──
  const recordDraft = useCallback(() => {
    if (!currentState || !validation?.canRecordPoConversionDraft) return;
    const draft = buildPoConversionDraftObject(currentState);
    setDraftObject(draft);
    onDraftRecorded(draft);
    setConvState((prev) => prev ? {
      ...prev,
      poConversionStatus: "po_draft_recorded",
      substatus: "ready_for_po_created_handoff",
      poConversionDraftObjectId: draft.id,
    } : prev);
  }, [currentState, validation, onDraftRecorded]);

  const handlePoCreated = useCallback(() => {
    if (!draftObject) return;
    onPoCreatedHandoff(buildPoCreatedHandoff(draftObject));
  }, [draftObject, onPoCreatedHandoff]);

  if (!open || !convState || !approvalHandoff) return null;

  const isDraftRecorded = !!draftObject;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#1e2024] border border-bd rounded-xl shadow-2xl w-full max-w-3xl max-h-[88vh] overflow-hidden flex flex-col">
        {/* ═══ Identity Strip ═══ */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-bd bg-[#252729]">
          <div className="flex items-center gap-3">
            <div className={`flex items-center justify-center w-7 h-7 rounded-lg border ${isDraftRecorded ? "bg-emerald-600/15 border-emerald-500/25" : "bg-indigo-600/15 border-indigo-500/25"}`}>
              {isDraftRecorded ? <Check className="h-4 w-4 text-emerald-400" /> : <Package className="h-4 w-4 text-indigo-400" />}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">{isDraftRecorded ? "PO 전환 초안 저장됨" : "PO 전환 입력"}</h2>
              <div className="flex items-center gap-2 text-[10px] mt-0.5">
                <span className="text-slate-400">승인 공급사 <span className="text-slate-200 font-medium">{convState.approvedVendorIds.length}개</span></span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-400">잠긴 필드 <span className="text-slate-200 font-medium">{convState.lockedFields.length}</span></span>
                <span className="text-slate-600">·</span>
                {currentState && currentState.missingFieldCount > 0 ? (
                  <span className="text-amber-400">누락 {currentState.missingFieldCount}</span>
                ) : (
                  <span className="text-emerald-400">필드 완료</span>
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
          {/* ═══ A. Approval Basis Summary ═══ */}
          <div className="px-3 py-2 rounded-md bg-blue-600/[0.04] border border-blue-500/15">
            <span className="text-[9px] font-medium text-blue-400 uppercase tracking-wider block mb-1">승인 근거</span>
            <span className="text-[10px] text-blue-200">{approvalHandoff.compareRationaleSummary}</span>
            {approvalHandoff.commercialRiskSummary && (
              <span className="text-[10px] text-slate-400 block mt-0.5">{approvalHandoff.commercialRiskSummary}</span>
            )}
          </div>

          {/* ═══ B. Locked Approval Fields ═══ */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Lock className="h-3 w-3 text-slate-500" />
              <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">잠긴 승인 필드</span>
            </div>
            <div className="space-y-1">
              {convState.lockedFields.map((field) => (
                <div key={field.fieldId} className="flex items-center gap-3 px-3 py-2 rounded-md border border-bd/40 bg-[#252729]">
                  <Lock className="h-3 w-3 text-slate-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] text-slate-400 block">{field.fieldLabel}</span>
                    <span className="text-[11px] text-slate-200 font-medium">{field.fieldValue}</span>
                  </div>
                  <span className="text-[9px] text-slate-600 shrink-0">{field.lockedReason}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ═══ C. Editable PO Entry Fields ═══ */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Edit3 className="h-3 w-3 text-blue-400" />
              <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">PO 운영 필드</span>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">결제 조건 *</label>
                  <Input placeholder="예: NET 30" value={paymentTerm} onChange={(e) => setPaymentTerm(e.target.value)} className="h-8 text-[11px] bg-[#1e2024] border-bd/40" disabled={isDraftRecorded} />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">청구 참조 *</label>
                  <Input placeholder="예: PROJ-2024-001" value={billingRef} onChange={(e) => setBillingRef(e.target.value)} className="h-8 text-[11px] bg-[#1e2024] border-bd/40" disabled={isDraftRecorded} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">납품 요청일 *</label>
                  <Input type="date" value={deliveryTarget} onChange={(e) => setDeliveryTarget(e.target.value)} className="h-8 text-[11px] bg-[#1e2024] border-bd/40" disabled={isDraftRecorded} />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">배송지 참조</label>
                  <Input placeholder="예: 연구실 A동 3층" value={shipTo} onChange={(e) => setShipTo(e.target.value)} className="h-8 text-[11px] bg-[#1e2024] border-bd/40" disabled={isDraftRecorded} />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">입고 지시 *</label>
                <Input placeholder="예: 인수 검수 후 입고 / 냉장 보관 필요" value={receivingInst} onChange={(e) => setReceivingInst(e.target.value)} className="h-8 text-[11px] bg-[#1e2024] border-bd/40" disabled={isDraftRecorded} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">내부 PO 메모</label>
                  <Input placeholder="내부 참고용" value={internalNote} onChange={(e) => setInternalNote(e.target.value)} className="h-8 text-[11px] bg-[#1e2024] border-bd/40" disabled={isDraftRecorded} />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">공급사 전달 메모</label>
                  <Input placeholder="공급사에 전달할 내용" value={supplierNote} onChange={(e) => setSupplierNote(e.target.value)} className="h-8 text-[11px] bg-[#1e2024] border-bd/40" disabled={isDraftRecorded} />
                </div>
              </div>
            </div>
          </div>

          {/* ═══ D. Completion Summary ═══ */}
          {completion && (
            <div className="grid grid-cols-2 gap-2">
              <div className={`px-3 py-2.5 rounded-md border ${completion.commercialComplete ? "border-emerald-500/20 bg-emerald-600/[0.03]" : "border-amber-500/20 bg-amber-600/[0.03]"}`}>
                <span className="text-[9px] text-slate-500 block mb-0.5">상업 필드</span>
                {completion.commercialComplete ? (
                  <div className="flex items-center gap-1"><Check className="h-3 w-3 text-emerald-400" /><span className="text-[10px] text-emerald-300">완료</span></div>
                ) : (
                  <span className="text-[10px] text-amber-300">누락: {completion.commercialMissing.join(", ")}</span>
                )}
              </div>
              <div className={`px-3 py-2.5 rounded-md border ${completion.operationalComplete ? "border-emerald-500/20 bg-emerald-600/[0.03]" : "border-amber-500/20 bg-amber-600/[0.03]"}`}>
                <span className="text-[9px] text-slate-500 block mb-0.5">운영 필드</span>
                {completion.operationalComplete ? (
                  <div className="flex items-center gap-1"><Check className="h-3 w-3 text-emerald-400" /><span className="text-[10px] text-emerald-300">완료</span></div>
                ) : (
                  <span className="text-[10px] text-amber-300">누락: {completion.operationalMissing.join(", ")}</span>
                )}
              </div>
            </div>
          )}

          {/* ═══ Validation ═══ */}
          {validation && (validation.blockingIssues.length > 0 || validation.warnings.length > 0) && !isDraftRecorded && (
            <div className="space-y-1">
              {validation.blockingIssues.map((b, i) => (
                <div key={`b-${i}`} className="flex items-center gap-2 px-3 py-2 rounded-md bg-red-600/[0.06] border border-red-500/15">
                  <AlertTriangle className="h-3 w-3 text-red-400 shrink-0" /><span className="text-[10px] text-red-300">{b}</span>
                </div>
              ))}
              {validation.warnings.map((w, i) => (
                <div key={`w-${i}`} className="flex items-center gap-2 px-3 py-2 rounded-md bg-amber-600/[0.04] border border-amber-500/10">
                  <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" /><span className="text-[10px] text-amber-300">{w}</span>
                </div>
              ))}
            </div>
          )}

          {isDraftRecorded && (
            <div className="px-3 py-3 rounded-md bg-emerald-600/[0.06] border border-emerald-500/15 space-y-1">
              <div className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /><span className="text-[11px] text-emerald-300 font-medium">PO 전환 초안이 저장되었습니다</span></div>
              <span className="text-[10px] text-slate-400">PO Created로 보내 발주를 확정할 수 있습니다.</span>
            </div>
          )}
        </div>

        {/* ═══ Action Dock ═══ */}
        <div className="px-5 py-3 border-t border-bd bg-[#1a1c1f]">
          <div className="flex items-center gap-3 text-[10px] mb-2.5">
            <span className="text-slate-500">승인 공급사 <span className="text-slate-300 font-medium">{convState.approvedVendorIds.length}</span></span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-500">누락 <span className="text-slate-300 font-medium">{currentState?.missingFieldCount || 0}</span></span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-500">{validation?.recommendedNextAction || ""}</span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" className="h-8 px-3 text-[10px] text-slate-400 hover:text-slate-300 border border-bd/40" onClick={onSendBackToApproval}>
              <ArrowLeft className="h-3 w-3 mr-1" />승인으로 되돌리기
            </Button>
            {!isDraftRecorded ? (
              <Button size="sm" className="flex-1 h-8 text-[10px] bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
                onClick={recordDraft} disabled={!validation?.canRecordPoConversionDraft}>
                <Package className="h-3 w-3 mr-1" />PO 전환 초안 저장
              </Button>
            ) : (
              <Button size="sm" className="flex-1 h-8 text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white font-medium" onClick={handlePoCreated}>
                <ShieldCheck className="h-3 w-3 mr-1" />PO Created로 보내기<ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
