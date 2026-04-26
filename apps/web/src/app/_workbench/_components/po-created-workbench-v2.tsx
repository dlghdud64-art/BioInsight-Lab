"use client";

import { useMemo, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Check, AlertTriangle, ArrowRight, ArrowLeft, Package, Truck, Building2, FileText, CreditCard, MapPin, Pause, RotateCcw } from "lucide-react";
import {
  type PoCreatedWorkbenchState,
  type OutboundReadinessResult,
  createInitialPoCreatedWorkbenchState,
  evaluateOutboundReadiness,
  setWorkbenchHold,
  routeToDispatchPrep,
  setCorrectionTarget,
  buildDispatchPreparationPackageV2,
} from "@/lib/ai/po-created-workbench-engine";
import type { PoRecord } from "@/lib/ai/po-creation-execution-engine";

// ══════════════════════════════════════════════════════════════════════════════
// Props
// ══════════════════════════════════════════════════════════════════════════════

interface PoCreatedWorkbenchV2Props {
  open: boolean;
  onClose: () => void;
  poRecord: PoRecord | null;
  onDispatchPrepRouted: () => void;
  onCorrectionRouted: (target: string) => void;
  onHoldSet: () => void;
}

// ══════════════════════════════════════════════════════════════════════════════
// Component
// ══════════════════════════════════════════════════════════════════════════════

export function PoCreatedWorkbenchV2({
  open,
  onClose,
  poRecord,
  onDispatchPrepRouted,
  onCorrectionRouted,
  onHoldSet,
}: PoCreatedWorkbenchV2Props) {
  const [wbState, setWbState] = useState<PoCreatedWorkbenchState | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [isRouted, setIsRouted] = useState(false);

  // ── Init ──
  useMemo(() => {
    if (open && poRecord && !wbState) {
      setWbState(createInitialPoCreatedWorkbenchState(poRecord));
    }
  }, [open, poRecord]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived ──
  const readiness = useMemo<OutboundReadinessResult | null>(
    () => (poRecord ? evaluateOutboundReadiness(poRecord) : null),
    [poRecord],
  );

  // ── Actions ──
  const handleHold = useCallback(() => {
    setWbState((prev) => (prev ? setWorkbenchHold(prev, reviewNote || "운영자 hold") : prev));
    onHoldSet();
  }, [reviewNote, onHoldSet]);

  const handleDispatchPrep = useCallback(() => {
    if (!wbState || !readiness || readiness.status === "blocked") return;
    setWbState((prev) => (prev ? routeToDispatchPrep(prev) : prev));
    setIsRouted(true);
    onDispatchPrepRouted();
  }, [wbState, readiness, onDispatchPrepRouted]);

  const handleCorrection = useCallback(
    (target: string) => {
      setWbState((prev) => (prev ? setCorrectionTarget(prev, target) : prev));
      onCorrectionRouted(target);
    },
    [onCorrectionRouted],
  );

  if (!open || !wbState || !poRecord) return null;

  const isHold = wbState.workbenchStatus === "hold";

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#1C2028] border border-bd rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">

        {/* ═══ A. Created PO Header ═══ */}
        <div className="px-5 py-3 border-b border-bd bg-[#252A33]">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-3">
              <div className={`flex items-center justify-center w-7 h-7 rounded-lg border ${isRouted ? "bg-emerald-600/15 border-emerald-500/25" : isHold ? "bg-amber-600/15 border-amber-500/25" : "bg-teal-600/15 border-teal-500/25"}`}>
                {isRouted ? <Truck className="h-4 w-4 text-emerald-400" /> : isHold ? <Pause className="h-4 w-4 text-amber-400" /> : <Package className="h-4 w-4 text-teal-400" />}
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-100">PO Created Workbench</h2>
                <span className="text-[10px] text-slate-500">{poRecord.id} · {poRecord.vendorId}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[9px] px-2 py-0.5 rounded font-medium ${readiness?.status === "ready" ? "bg-emerald-600/15 text-emerald-300 border border-emerald-500/20" : readiness?.status === "blocked" ? "bg-red-600/10 text-red-300 border border-red-500/15" : "bg-amber-600/10 text-amber-300 border border-amber-500/15"}`}>
                {readiness?.status === "ready" ? "발송 준비 가능" : readiness?.status === "blocked" ? "발송 차단" : "경고 있음"}
              </span>
              <button type="button" onClick={onClose} className="h-6 w-6 flex items-center justify-center rounded text-slate-500 hover:text-slate-300"><X className="h-3.5 w-3.5" /></button>
            </div>
          </div>
          <div className="flex items-center gap-3 text-[10px]">
            <span className="text-slate-400">Lines <span className="text-slate-200 font-medium">{poRecord.lineItems.length}</span></span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-400">Amount <span className="text-slate-200 font-medium">{poRecord.amountSummary}</span></span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-400">Status <span className="text-teal-300 font-medium">{poRecord.status}</span></span>
            {isHold && <><span className="text-slate-600">·</span><span className="text-amber-400 font-medium">Hold</span></>}
          </div>
        </div>

        {/* ═══ Scrollable body ═══ */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* ═══ B. Canonical PO Summary (read-only) ═══ */}
          <div>
            <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">Canonical PO Summary</span>
            <div className="mt-2 rounded-md border border-bd/40 bg-[#252A33] divide-y divide-bd/20">
              {[
                { icon: Building2, label: "공급사", value: `${poRecord.vendorId} · ${poRecord.vendorOrderContact || "연락처 미확인"}` },
                { icon: MapPin, label: "배송지", value: poRecord.shipTo || "미지정" },
                { icon: CreditCard, label: "청구지", value: poRecord.billTo || "미지정" },
                { icon: FileText, label: "요청자", value: `${poRecord.requesterContext} · ${poRecord.departmentContext}` },
                { icon: Package, label: "라인 요약", value: `${poRecord.lineItems.length}개 라인 · ${poRecord.currency} ${poRecord.amountSummary}` },
                { icon: Package, label: "입고 지시", value: poRecord.receivingInstruction || "미입력" },
                { icon: FileText, label: "첨부", value: poRecord.attachmentSummary || "없음" },
              ].map((row) => {
                const Icon = row.icon;
                return (
                  <div key={row.label} className="flex items-center gap-3 px-3 py-2">
                    <Icon className="h-3 w-3 text-slate-500 shrink-0" />
                    <span className="text-[9px] text-slate-500 w-16 shrink-0">{row.label}</span>
                    <span className="text-[10px] text-slate-300 truncate">{row.value}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ═══ C. Outbound Readiness Summary ═══ */}
          {readiness && (
            <div>
              <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">Outbound Readiness</span>
              <div className="mt-2 space-y-1">
                {readiness.blockers.map((b, i) => (
                  <div key={`blk-${i}`} className="flex items-center gap-2 px-3 py-2 rounded-md bg-red-600/[0.06] border border-red-500/15">
                    <AlertTriangle className="h-3 w-3 text-red-400 shrink-0" />
                    <span className="text-[10px] text-red-300 flex-1">{b}</span>
                    <Button size="sm" variant="ghost" className="h-5 px-2 text-[8px] text-blue-400 border border-blue-500/20" onClick={() => handleCorrection("po_conversion_entry")}>수정</Button>
                  </div>
                ))}
                {readiness.warnings.map((w, i) => (
                  <div key={`wrn-${i}`} className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-amber-600/[0.04] border border-amber-500/10">
                    <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" />
                    <span className="text-[10px] text-amber-300">{w}</span>
                  </div>
                ))}
                {readiness.infos.map((info, i) => (
                  <div key={`inf-${i}`} className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-blue-600/[0.04] border border-blue-500/10">
                    <span className="text-[9px] text-blue-300">{info}</span>
                  </div>
                ))}
                {readiness.blockers.length === 0 && readiness.warnings.length === 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-emerald-600/[0.04] border border-emerald-500/15">
                    <Check className="h-3 w-3 text-emerald-400" />
                    <span className="text-[10px] text-emerald-300">발송 준비 가능</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══ D. Review Note ═══ */}
          <div>
            <label className="text-[10px] text-slate-400 block mb-1">검토 메모 (선택)</label>
            <Input
              placeholder="created PO에 대한 검토 메모를 남기세요"
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              className="h-8 text-[11px] bg-[#1C2028] border-bd/40"
              disabled={isRouted}
            />
          </div>

          {/* ═══ Routed success ═══ */}
          {isRouted && (
            <div className="px-3 py-3 rounded-md bg-emerald-600/[0.06] border border-emerald-500/15">
              <div className="flex items-center gap-2"><Truck className="h-4 w-4 text-emerald-400" /><span className="text-[11px] text-emerald-300 font-medium">Dispatch Preparation으로 이관 완료</span></div>
              <span className="text-[10px] text-slate-400 block mt-1">다음 단계에서 공급사 발송을 준비합니다.</span>
            </div>
          )}
        </div>

        {/* ═══ Sticky Action Dock ═══ */}
        <div className="px-5 py-3 border-t border-bd bg-[#181E28]">
          {readiness?.status === "blocked" && readiness.blockers.length > 0 && (
            <div className="text-[9px] text-red-400 mb-2">이동 불가: {readiness.blockers[0]}</div>
          )}
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" className="h-8 px-3 text-[10px] text-slate-400 hover:text-slate-300 border border-bd/40" onClick={onClose}>
              <ArrowLeft className="h-3 w-3 mr-1" />닫기
            </Button>
            {!isRouted && (
              <>
                <Button size="sm" variant="ghost" className="h-8 px-3 text-[10px] text-amber-400 hover:text-amber-300 border border-amber-500/20" onClick={handleHold}>
                  <Pause className="h-3 w-3 mr-1" />Hold
                </Button>
                <Button size="sm" variant="ghost" className="h-8 px-3 text-[10px] text-slate-400 hover:text-slate-300 border border-bd/40" onClick={() => handleCorrection("po_conversion_entry")}>
                  <RotateCcw className="h-3 w-3 mr-1" />수정 경로
                </Button>
                <Button
                  size="sm"
                  className={`flex-1 h-8 text-[10px] font-medium ${readiness?.status !== "blocked" ? "bg-emerald-600 hover:bg-emerald-500 text-white" : "bg-slate-700 text-slate-400 cursor-not-allowed"}`}
                  onClick={handleDispatchPrep}
                  disabled={readiness?.status === "blocked"}
                >
                  <Truck className="h-3 w-3 mr-1" />Dispatch Preparation<ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
