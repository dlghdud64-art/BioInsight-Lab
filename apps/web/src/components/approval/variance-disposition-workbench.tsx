"use client";

/**
 * VarianceDispositionWorkbench — 입고 차이 처리 center/rail/dock workbench
 *
 * Tier 2 — variance 10% 초과 시 승인 필요, 미만 시 operator 자체 처리.
 * center = variance summary + line disposition + policy strip
 * rail = receiving evidence + threshold detail + disposition guide
 * dock = confirm disposition / request approval
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  PolicyStatusBadge,
  PolicyMessageStack,
  ApproverRequirementCard,
  NextActionHint,
} from "./index";
import { useWorkspacePolicySurface } from "@/hooks/use-approval-policy";
import type { ActorContext } from "@/lib/ai/dispatch-v2-permission-policy-engine";

export interface VarianceLineItem {
  lineId: string;
  expectedQty: number;
  receivedQty: number;
  varianceQty: number;
  variancePercent: number;
  disposition: "accept" | "return" | "dispose" | "hold" | "pending";
}

export interface VarianceDispositionWorkbenchProps {
  caseId: string;
  actor: ActorContext;
  // Variance data
  lines: VarianceLineItem[];
  totalVariancePercent: number;
  totalExpectedQty: number;
  totalReceivedQty: number;
  // State
  canConfirm: boolean;
  needsApproval: boolean;
  // Handlers
  onLineDisposition?: (lineId: string, disposition: VarianceLineItem["disposition"]) => void;
  onConfirmAll?: () => void;
  onRequestApproval?: () => void;
  className?: string;
}

const DISPOSITION_LABELS: Record<string, string> = {
  accept: "수용",
  return: "반품",
  dispose: "폐기",
  hold: "보류",
  pending: "미결정",
};

const DISPOSITION_COLORS: Record<string, string> = {
  accept: "text-emerald-400",
  return: "text-amber-400",
  dispose: "text-red-400",
  hold: "text-blue-400",
  pending: "text-slate-500",
};

export function VarianceDispositionWorkbench({
  caseId,
  actor,
  lines,
  totalVariancePercent,
  totalExpectedQty,
  totalReceivedQty,
  canConfirm,
  needsApproval,
  onLineDisposition,
  onConfirmAll,
  onRequestApproval,
  className,
}: VarianceDispositionWorkbenchProps) {
  const { data: policySurface } = useWorkspacePolicySurface(
    "variance_disposition", actor, caseId, { variancePercentage: totalVariancePercent }
  );
  const guidance = policySurface?.inlineGuidance;
  const surface = policySurface?.policySurface;

  const [railOpen, setRailOpen] = React.useState(false);
  const pendingLines = lines.filter(l => l.disposition === "pending");
  const allDecided = pendingLines.length === 0;

  return (
    <div className={cn("flex flex-col pb-20 md:flex-row md:gap-4 md:pb-0 h-full", className)}>
      {/* ═══ CENTER ═══ */}
      <div className="flex-1 min-w-0 space-y-4">
        {guidance && (
          <div className="flex items-center gap-3 px-4 py-2.5 rounded bg-slate-900 border border-slate-800">
            <PolicyStatusBadge status={guidance.statusBadge} />
            <PolicyMessageStack
              primaryMessage={guidance.primaryMessage}
              blockerMessages={guidance.blockerMessages}
              warningMessages={guidance.warningMessages}
              nextActionMessage={guidance.nextActionMessage}
              compact
            />
          </div>
        )}

        {/* Variance summary */}
        <div className="rounded border border-slate-800 bg-slate-900/50 p-3 md:p-4">
          <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-3">차이 요약</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-3 text-sm">
            <div>
              <span className="text-slate-500 text-xs">예상 수량</span>
              <p className="text-sm font-semibold tabular-nums text-slate-900">{totalExpectedQty}</p>
            </div>
            <div>
              <span className="text-slate-500 text-xs">입고 수량</span>
              <p className="text-sm font-semibold tabular-nums text-slate-900">{totalReceivedQty}</p>
            </div>
            <div>
              <span className="text-slate-500 text-xs">차이</span>
              <p className={cn("text-sm font-semibold tabular-nums", totalReceivedQty < totalExpectedQty ? "text-red-400" : "text-emerald-400")}>
                {totalReceivedQty - totalExpectedQty}
              </p>
            </div>
            <div>
              <span className="text-slate-500 text-xs">Variance %</span>
              <p className={cn("text-sm font-semibold tabular-nums", totalVariancePercent > 10 ? "text-red-400" : totalVariancePercent > 5 ? "text-amber-400" : "text-slate-700")}>
                {totalVariancePercent.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>

        {/* Line disposition table */}
        <div className="rounded border border-slate-800 bg-slate-900/50 overflow-x-auto">
          <table className="w-full text-xs min-w-[400px]">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500">
                <th className="px-3 py-2 text-left font-medium">Line</th>
                <th className="px-3 py-2 text-right font-medium">예상</th>
                <th className="px-3 py-2 text-right font-medium">입고</th>
                <th className="px-3 py-2 text-right font-medium">차이</th>
                <th className="px-3 py-2 text-right font-medium">%</th>
                <th className="px-3 py-2 text-left font-medium">처리</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.lineId} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="px-3 py-1.5 text-slate-600">{line.lineId}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-slate-400">{line.expectedQty}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-slate-700">{line.receivedQty}</td>
                  <td className={cn("px-3 py-1.5 text-right tabular-nums", line.varianceQty < 0 ? "text-red-400" : "text-emerald-400")}>
                    {line.varianceQty}
                  </td>
                  <td className={cn("px-3 py-1.5 text-right tabular-nums", line.variancePercent > 10 ? "text-red-400" : "text-slate-400")}>
                    {line.variancePercent.toFixed(1)}%
                  </td>
                  <td className="px-3 py-1.5">
                    {onLineDisposition ? (
                      <select
                        value={line.disposition}
                        onChange={(e) => onLineDisposition(line.lineId, e.target.value as VarianceLineItem["disposition"])}
                        className="rounded bg-slate-950 border border-slate-700 px-1.5 py-0.5 text-xs text-slate-700 focus:border-blue-600 focus:outline-none"
                      >
                        {Object.entries(DISPOSITION_LABELS).map(([key, label]) => (
                          <option key={key} value={key}>{label}</option>
                        ))}
                      </select>
                    ) : (
                      <span className={DISPOSITION_COLORS[line.disposition]}>
                        {DISPOSITION_LABELS[line.disposition]}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ RAIL ═══ */}
      <button className="flex items-center justify-between w-full py-2 text-xs text-slate-500 md:hidden" onClick={() => setRailOpen(!railOpen)}>처리 현황 {railOpen ? "▲" : "▼"}</button>
      <div className={cn("mt-3 md:mt-0 md:w-64 lg:w-72 shrink-0 overflow-hidden transition-all duration-200 md:max-h-none md:opacity-100 space-y-3", railOpen ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0 md:max-h-none md:opacity-100")}>
        {guidance?.approverInfo && (
          <ApproverRequirementCard
            requiredRole={guidance.approverInfo.requiredRole}
            selfApprovalAllowed={guidance.approverInfo.selfApprovalAllowed}
            dualApprovalRequired={guidance.approverInfo.dualApprovalRequired}
            riskTier={surface?.riskTier}
          />
        )}

        <div className="rounded border border-slate-800 bg-slate-900/50 p-3 space-y-1.5">
          <h4 className="text-xs font-medium uppercase tracking-wider text-slate-500">처리 현황</h4>
          <div className="text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">전체</span>
              <span className="text-slate-700">{lines.length}건</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">결정 완료</span>
              <span className="text-emerald-400">{lines.length - pendingLines.length}건</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">미결정</span>
              <span className={pendingLines.length > 0 ? "text-amber-400" : "text-slate-400"}>
                {pendingLines.length}건
              </span>
            </div>
          </div>
        </div>

        <div className="rounded border border-slate-800 bg-slate-900/50 p-3">
          <h4 className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-1">Threshold</h4>
          <p className="text-xs text-slate-400">
            Variance 10% 초과 시 승인 필요.
            현재 {totalVariancePercent.toFixed(1)}%
            {totalVariancePercent > 10 ? " — 승인 필요" : " — 자체 처리 가능"}.
          </p>
        </div>
      </div>

      {/* ═══ DOCK ═══ */}
      <div className="fixed bottom-0 left-0 right-0 z-30 md:absolute md:bottom-auto border-t border-slate-800 bg-slate-950 px-3 md:px-4 py-3">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2 md:gap-0">
          {guidance && (
            <NextActionHint
              message={allDecided ? (needsApproval ? "모든 라인 결정 완료 — 승인 요청 필요" : "모든 라인 결정 완료 — 확정 가능") : `${pendingLines.length}건 미결정`}
              variant={needsApproval ? "urgent" : "default"}
            />
          )}
          <div className="flex items-center gap-2 w-full md:w-auto shrink-0 md:ml-4 flex-wrap md:flex-nowrap">
            {needsApproval && (
              <button
                onClick={onRequestApproval}
                disabled={!allDecided}
                className="flex-1 md:flex-none rounded bg-blue-600 hover:bg-blue-500 px-4 py-1.5 text-xs font-medium text-white transition-colors disabled:opacity-40 active:scale-95 min-h-[40px]"
              >
                승인 요청
              </button>
            )}
            {canConfirm && !needsApproval && (
              <button
                onClick={onConfirmAll}
                disabled={!allDecided}
                className="flex-1 md:flex-none rounded bg-blue-600 hover:bg-blue-500 px-4 py-1.5 text-xs font-medium text-white transition-colors disabled:opacity-40 active:scale-95 min-h-[40px]"
              >
                처리 확정
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
