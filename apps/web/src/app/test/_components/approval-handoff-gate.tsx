"use client";

import { useMemo, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { X, Check, AlertTriangle, AlertCircle, ArrowRight, ArrowLeft, ShieldCheck, Info } from "lucide-react";
import {
  type ApprovalHandoffGateState,
  type CanonicalApprovalHandoffPackage,
  type GateItem,
  type GateItemSeverity,
  evaluateApprovalHandoffGate,
  buildCanonicalApprovalHandoffPackage,
  createGateActivityEvent,
} from "@/lib/ai/approval-handoff-gate-engine";
import type { CompareReviewCenterState } from "@/lib/ai/compare-review-center-engine";

// ══════════════════════════════════════════════════════════════════════════════
// Props
// ══════════════════════════════════════════════════════════════════════════════

interface ApprovalHandoffGateProps {
  open: boolean;
  onClose: () => void;
  compareReviewState: CompareReviewCenterState | null;
  onReturnToReview: () => void;
  onHandoffConfirmed: (pkg: CanonicalApprovalHandoffPackage) => void;
  onFixBlocker: (blockerId: string) => void;
}

const SEVERITY_CONFIG: Record<GateItemSeverity, { icon: any; color: string; bg: string; border: string }> = {
  blocker: { icon: AlertCircle, color: "text-red-400", bg: "bg-red-600/[0.06]", border: "border-red-500/15" },
  warning: { icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-600/[0.04]", border: "border-amber-500/10" },
  info: { icon: Info, color: "text-blue-400", bg: "bg-blue-600/[0.04]", border: "border-blue-500/10" },
};

// ══════════════════════════════════════════════════════════════════════════════
// Component
// ══════════════════════════════════════════════════════════════════════════════

export function ApprovalHandoffGate({
  open,
  onClose,
  compareReviewState,
  onReturnToReview,
  onHandoffConfirmed,
  onFixBlocker,
}: ApprovalHandoffGateProps) {
  const [gateState, setGateState] = useState<ApprovalHandoffGateState | null>(null);
  const [handoffPackage, setHandoffPackage] = useState<CanonicalApprovalHandoffPackage | null>(null);

  // ── Evaluate gate ──
  useMemo(() => {
    if (open && compareReviewState && !handoffPackage) {
      setGateState(evaluateApprovalHandoffGate(compareReviewState));
    }
  }, [open, compareReviewState]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Actions ──
  const handleHandoff = useCallback((withWarnings: boolean) => {
    if (!compareReviewState || !gateState) return;
    if (gateState.gateStatus === "blocked") return;
    if (gateState.gateStatus === "warning" && !withWarnings) return;

    const pkg = buildCanonicalApprovalHandoffPackage(compareReviewState, gateState);
    setHandoffPackage(pkg);
    setGateState((prev) => prev ? { ...prev, gateStatus: "handed_off", handoffPackageId: pkg.id, handedOffAt: new Date().toISOString(), handedOffBy: "operator" } : prev);
    onHandoffConfirmed(pkg);
  }, [compareReviewState, gateState, onHandoffConfirmed]);

  if (!open || !gateState) return null;

  const isHandedOff = gateState.gateStatus === "handed_off";
  const blockers = gateState.gateItems.filter((g) => g.severity === "blocker");
  const warnings = gateState.gateItems.filter((g) => g.severity === "warning");
  const infos = gateState.gateItems.filter((g) => g.severity === "info");
  const preview = gateState.approvalPayloadPreview;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#1C2028] border border-bd rounded-xl shadow-2xl w-full max-w-3xl max-h-[88vh] overflow-hidden flex flex-col">

        {/* ═══ A. Gate Header ═══ */}
        <div className="px-5 py-3 border-b border-bd bg-[#252A33]">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-3">
              <div className={`flex items-center justify-center w-7 h-7 rounded-lg border ${isHandedOff ? "bg-emerald-600/15 border-emerald-500/25" : gateState.gateStatus === "ready" ? "bg-emerald-600/15 border-emerald-500/25" : gateState.gateStatus === "blocked" ? "bg-red-600/15 border-red-500/25" : "bg-amber-600/15 border-amber-500/25"}`}>
                {isHandedOff ? <Check className="h-4 w-4 text-emerald-400" /> : <ShieldCheck className={`h-4 w-4 ${gateState.gateStatus === "ready" ? "text-emerald-400" : gateState.gateStatus === "blocked" ? "text-red-400" : "text-amber-400"}`} />}
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-100">{isHandedOff ? "승인 이관 완료" : "Approval Handoff Gate"}</h2>
                <span className="text-[10px] text-slate-500">{gateState.requestReference} · {gateState.compareReviewId}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[9px] px-2 py-0.5 rounded font-medium ${gateState.gateStatus === "ready" || isHandedOff ? "bg-emerald-600/15 text-emerald-300 border border-emerald-500/20" : gateState.gateStatus === "blocked" ? "bg-red-600/10 text-red-300 border border-red-500/15" : "bg-amber-600/10 text-amber-300 border border-amber-500/15"}`}>
                {isHandedOff ? "이관 완료" : gateState.gateStatus === "ready" ? "이관 가능" : gateState.gateStatus === "blocked" ? "차단됨" : "경고 있음"}
              </span>
              <button type="button" onClick={onClose} className="h-6 w-6 flex items-center justify-center rounded text-slate-500 hover:text-slate-300"><X className="h-3.5 w-3.5" /></button>
            </div>
          </div>
          <div className="flex items-center gap-3 text-[10px]">
            <span className="text-red-400 font-medium">Blocker {gateState.blockerCount}</span>
            <span className="text-slate-600">·</span>
            <span className="text-amber-400">Warning {gateState.warningCount}</span>
            <span className="text-slate-600">·</span>
            <span className="text-blue-400">Info {gateState.infoCount}</span>
          </div>
        </div>

        {/* ═══ Scrollable body ═══ */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* ═══ B. Blocker / Warning / Info Summary ═══ */}
          {gateState.gateItems.length > 0 && (
            <div className="space-y-1.5">
              {/* Blockers first */}
              {blockers.map((item) => {
                const config = SEVERITY_CONFIG[item.severity];
                const Icon = config.icon;
                return (
                  <div key={item.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-md border ${config.border} ${config.bg}`}>
                    <Icon className={`h-3.5 w-3.5 shrink-0 ${config.color}`} />
                    <span className={`text-[10px] flex-1 ${config.color}`}>{item.message}</span>
                    {item.fixAction && (
                      <Button size="sm" variant="ghost" className="h-6 px-2 text-[9px] text-blue-400 hover:text-blue-300 border border-blue-500/20" onClick={() => onFixBlocker(item.id)}>
                        {item.fixAction}
                      </Button>
                    )}
                  </div>
                );
              })}
              {/* Warnings */}
              {warnings.map((item) => {
                const config = SEVERITY_CONFIG[item.severity];
                const Icon = config.icon;
                return (
                  <div key={item.id} className={`flex items-center gap-3 px-3 py-2 rounded-md border ${config.border} ${config.bg}`}>
                    <Icon className={`h-3.5 w-3.5 shrink-0 ${config.color}`} />
                    <span className={`text-[10px] flex-1 ${config.color}`}>{item.message}</span>
                    {item.fixAction && <Button size="sm" variant="ghost" className="h-6 px-2 text-[9px] text-amber-400 hover:text-amber-300 border border-amber-500/15" onClick={() => onFixBlocker(item.id)}>{item.fixAction}</Button>}
                  </div>
                );
              })}
              {/* Info */}
              {infos.map((item) => {
                const config = SEVERITY_CONFIG[item.severity];
                const Icon = config.icon;
                return (
                  <div key={item.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-md border ${config.border} ${config.bg}`}>
                    <Icon className={`h-3 w-3 shrink-0 ${config.color}`} />
                    <span className="text-[9px] text-blue-300">{item.message}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* ═══ C. Approval Payload Preview ═══ */}
          {preview && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">Approval Payload Preview</span>
                <span className="text-[8px] text-slate-600">(읽기 전용 — 실제 수정은 검토 화면에서)</span>
              </div>
              <div className="rounded-md border border-bd/40 bg-[#252A33] divide-y divide-bd/20">
                {[
                  { label: "선택 옵션", value: preview.selectedOptionSummary },
                  { label: "공급사", value: preview.vendorSummary },
                  { label: "수량/규격/가격", value: preview.qtyPackPriceSummary },
                  { label: "예상 납기", value: preview.expectedLeadTimeSummary },
                  { label: "선택 사유", value: preview.selectionRationaleSummary },
                  { label: "제외 요약", value: preview.exclusionSummary },
                  { label: "후속 확인", value: preview.followupStatus },
                ].map((row) => (
                  <div key={row.label} className="flex items-center gap-3 px-3 py-1.5">
                    <span className="text-[9px] text-slate-500 w-24 shrink-0">{row.label}</span>
                    <span className="text-[10px] text-slate-300">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══ Handoff success ═══ */}
          {isHandedOff && handoffPackage && (
            <div className="px-3 py-3 rounded-md bg-emerald-600/[0.06] border border-emerald-500/15">
              <div className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /><span className="text-[11px] text-emerald-300 font-medium">Approval Handoff 완료</span></div>
              <span className="text-[10px] text-slate-400 block mt-1">Package ID: {handoffPackage.id} — Approval Workbench에서 최종 승인 검토를 진행할 수 있습니다.</span>
            </div>
          )}
        </div>

        {/* ═══ D. Sticky Action Dock ═══ */}
        <div className="px-5 py-3 border-t border-bd bg-[#181E28]">
          {/* Blocker reason when disabled */}
          {gateState.gateStatus === "blocked" && blockers.length > 0 && (
            <div className="text-[9px] text-red-400 mb-2">
              승인 이관 불가: {blockers[0].message}
            </div>
          )}
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" className="h-8 px-3 text-[10px] text-slate-400 hover:text-slate-300 border border-bd/40" onClick={onReturnToReview}>
              <ArrowLeft className="h-3 w-3 mr-1" />검토로 돌아가기
            </Button>
            {!isHandedOff ? (
              <>
                {gateState.gateStatus === "warning" && (
                  <Button size="sm" className="flex-1 h-8 text-[10px] bg-amber-600 hover:bg-amber-500 text-white font-medium" onClick={() => handleHandoff(true)}>
                    <AlertTriangle className="h-3 w-3 mr-1" />경고 포함 승인 이관
                  </Button>
                )}
                {gateState.gateStatus === "ready" && (
                  <Button size="sm" className="flex-1 h-8 text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white font-medium" onClick={() => handleHandoff(false)}>
                    <ShieldCheck className="h-3 w-3 mr-1" />승인 이관 확정<ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                )}
                {gateState.gateStatus === "blocked" && (
                  <Button size="sm" className="flex-1 h-8 text-[10px] bg-slate-700 text-slate-400 cursor-not-allowed" disabled>
                    <ShieldCheck className="h-3 w-3 mr-1" />승인 이관 불가
                  </Button>
                )}
              </>
            ) : (
              <div className="flex-1 text-center text-[10px] text-emerald-400 py-2">Approval Handoff 완료 — Package 생성됨</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
