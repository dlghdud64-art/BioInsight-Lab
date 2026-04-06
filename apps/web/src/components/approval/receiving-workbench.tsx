"use client";

/**
 * ReceivingWorkbench — 입고 준비/실행 통합 center/rail/dock workbench
 *
 * Tier 1 — 승인 불필요, policy는 가이드 + 제약 조건 표시.
 * center = receiving lines + status + qty input
 * rail = expected vs received + lot/expiry + policy guide
 * dock = record receipt / complete
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { PolicyStatusBadge, PolicyMessageStack, NextActionHint } from "./index";
import { useWorkspacePolicySurface } from "@/hooks/use-approval-policy";
import type { ActorContext } from "@/lib/ai/dispatch-v2-permission-policy-engine";

export interface ReceivingLineItem {
  lineId: string;
  productIdentity: string;
  expectedQty: number;
  receivedQty: number;
  unit: string;
  lotNumber: string;
  expiryDate: string;
  status: "pending" | "received" | "partial" | "rejected" | "damaged";
}

export interface ReceivingWorkbenchProps {
  caseId: string;
  actor: ActorContext;
  // Mode
  mode: "preparation" | "execution";
  // Lines
  lines: ReceivingLineItem[];
  // State
  allLinesComplete: boolean;
  hasVariance: boolean;
  // Handlers
  onRecordLine?: (lineId: string, receivedQty: number, status: ReceivingLineItem["status"]) => void;
  onCompleteReceiving?: () => void;
  className?: string;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "대기",
  received: "입고 완료",
  partial: "부분 입고",
  rejected: "거부",
  damaged: "손상",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "text-slate-400",
  received: "text-emerald-400",
  partial: "text-amber-400",
  rejected: "text-red-400",
  damaged: "text-red-400",
};

export function ReceivingWorkbench({
  caseId,
  actor,
  mode,
  lines,
  allLinesComplete,
  hasVariance,
  onRecordLine,
  onCompleteReceiving,
  className,
}: ReceivingWorkbenchProps) {
  const workspaceKey = mode === "preparation" ? "receiving_preparation" : "receiving_execution";
  const { data: policySurface } = useWorkspacePolicySurface(workspaceKey, actor, caseId);
  const guidance = policySurface?.inlineGuidance;

  const totalExpected = lines.reduce((s, l) => s + l.expectedQty, 0);
  const totalReceived = lines.reduce((s, l) => s + l.receivedQty, 0);
  const pendingLines = lines.filter(l => l.status === "pending");

  return (
    <div className={cn("flex gap-4 h-full", className)}>
      {/* ═══ CENTER ═══ */}
      <div className="flex-1 min-w-0 space-y-4">
        {guidance && (
          <div className="flex items-center gap-3 px-4 py-2.5 rounded bg-slate-900 border border-slate-800">
            <PolicyStatusBadge status={guidance.statusBadge} />
            <PolicyMessageStack
              primaryMessage={guidance.primaryMessage}
              compact
            />
          </div>
        )}

        {/* Summary strip */}
        <div className="rounded border border-slate-800 bg-slate-900/50 p-4">
          <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-3">
            {mode === "preparation" ? "입고 준비" : "입고 실행"}
          </h3>
          <div className="grid grid-cols-4 gap-3 text-sm">
            <div>
              <span className="text-slate-500 text-xs">총 라인</span>
              <p className="text-sm font-semibold tabular-nums text-slate-900">{lines.length}건</p>
            </div>
            <div>
              <span className="text-slate-500 text-xs">예상 수량</span>
              <p className="text-sm font-semibold tabular-nums text-slate-900">{totalExpected}</p>
            </div>
            <div>
              <span className="text-slate-500 text-xs">입고 수량</span>
              <p className="text-sm font-semibold tabular-nums text-slate-900">{totalReceived}</p>
            </div>
            <div>
              <span className="text-slate-500 text-xs">미완료</span>
              <p className={cn("text-sm font-semibold tabular-nums", pendingLines.length > 0 ? "text-amber-400" : "text-emerald-400")}>
                {pendingLines.length}건
              </p>
            </div>
          </div>
        </div>

        {/* Lines table */}
        <div className="rounded border border-slate-800 bg-slate-900/50 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500">
                <th className="px-3 py-2 text-left font-medium">Line</th>
                <th className="px-3 py-2 text-left font-medium">품목</th>
                <th className="px-3 py-2 text-right font-medium">예상</th>
                <th className="px-3 py-2 text-right font-medium">입고</th>
                <th className="px-3 py-2 text-left font-medium">단위</th>
                <th className="px-3 py-2 text-left font-medium">Lot</th>
                <th className="px-3 py-2 text-left font-medium">유효기한</th>
                <th className="px-3 py-2 text-left font-medium">상태</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.lineId} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="px-3 py-1.5 text-slate-600">{line.lineId}</td>
                  <td className="px-3 py-1.5 text-slate-700 max-w-[120px] truncate">{line.productIdentity}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-slate-400">{line.expectedQty}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-slate-700">{line.receivedQty}</td>
                  <td className="px-3 py-1.5 text-slate-400">{line.unit}</td>
                  <td className="px-3 py-1.5 text-slate-400 font-mono text-[10px]">{line.lotNumber || "—"}</td>
                  <td className="px-3 py-1.5 text-slate-400">{line.expiryDate || "—"}</td>
                  <td className="px-3 py-1.5">
                    <span className={STATUS_COLORS[line.status]}>{STATUS_LABELS[line.status]}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ RAIL ═══ */}
      <div className="w-64 shrink-0 space-y-3">
        <div className="rounded border border-slate-800 bg-slate-900/50 p-3 space-y-1.5">
          <h4 className="text-xs font-medium uppercase tracking-wider text-slate-500">입고 현황</h4>
          <div className="text-xs space-y-1">
            {["received", "partial", "pending", "rejected", "damaged"].map(status => {
              const count = lines.filter(l => l.status === status).length;
              if (count === 0) return null;
              return (
                <div key={status} className="flex justify-between">
                  <span className="text-slate-500">{STATUS_LABELS[status]}</span>
                  <span className={STATUS_COLORS[status]}>{count}건</span>
                </div>
              );
            })}
          </div>
        </div>

        {hasVariance && (
          <div className="rounded border border-amber-500/20 bg-amber-500/5 p-3">
            <p className="text-xs text-amber-400">
              입고 수량 차이 감지됨. 완료 후 variance disposition 단계로 이동합니다.
            </p>
          </div>
        )}
      </div>

      {/* ═══ DOCK ═══ */}
      <div className="absolute bottom-0 left-0 right-0 border-t border-slate-800 bg-slate-950 px-4 py-3">
        <div className="flex items-center justify-between">
          <NextActionHint
            message={allLinesComplete
              ? (hasVariance ? "입고 완료 — variance disposition으로 이동" : "입고 완료 — 재고 릴리스 준비")
              : `${pendingLines.length}건 입고 대기`}
            variant={pendingLines.length > 0 ? "default" : "default"}
          />
          <div className="flex items-center gap-2 shrink-0 ml-4">
            {onCompleteReceiving && (
              <button
                onClick={onCompleteReceiving}
                disabled={!allLinesComplete}
                className="rounded bg-blue-600 hover:bg-blue-500 px-4 py-1.5 text-xs font-medium text-white transition-colors disabled:opacity-40"
              >
                입고 완료
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
