"use client";

/**
 * Ownership-aware Dashboard Panels
 *
 * - OwnerBacklogPanel: owner별 backlog/SLA/load 현황
 * - OwnerlessHotspotPanel: 미지정 건 + 긴급 미지정 경고
 * - OverloadedOwnerPanel: 과부하 owner + 재배정 권장
 * - OwnershipCoverageCard: 전체 coverage health 요약
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { OwnerBadge } from "./dashboard-action-panels";
import type { OwnerMetrics, UnassignedDetection, OverloadedOwnerDetection, OwnershipCoverageSummary } from "@/lib/ai/ownership-aware-governance-metrics";
import type { ResolvedOwner } from "@/lib/ai/multi-team-ownership-engine";

// ══════════════════════════════════════════════
// OwnerBacklogPanel
// ══════════════════════════════════════════════

export interface OwnerBacklogPanelProps {
  owners: OwnerMetrics[];
  onOwnerClick?: (ownerId: string) => void;
  className?: string;
}

const LOAD_COLORS: Record<string, string> = {
  low: "text-emerald-400 bg-emerald-500/10",
  normal: "text-blue-400 bg-blue-500/10",
  high: "text-amber-400 bg-amber-500/10",
  overloaded: "text-red-400 bg-red-500/10",
};

export function OwnerBacklogPanel({ owners, onOwnerClick, className }: OwnerBacklogPanelProps) {
  const sorted = [...owners].sort((a, b) => b.loadScore - a.loadScore);

  return (
    <div className={cn("rounded border border-slate-800 bg-slate-900/50 p-4 space-y-3", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500">담당자별 현황</h3>
        <span className="text-[10px] text-slate-500">{owners.length}명</span>
      </div>

      <div className="space-y-2">
        {sorted.slice(0, 8).map((owner) => (
          <button
            key={owner.ownerId}
            onClick={() => onOwnerClick?.(owner.ownerId)}
            className="w-full text-left rounded border border-slate-800/50 hover:border-slate-700 p-2 transition-colors"
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-200">{owner.ownerName}</span>
                <span className="text-[10px] text-slate-500">{owner.ownerRole}</span>
              </div>
              <span className={cn("text-[9px] font-medium px-1.5 py-0.5 rounded tabular-nums", LOAD_COLORS[owner.loadLevel])}>
                {owner.loadScore}
              </span>
            </div>
            <div className="flex gap-3 text-[10px]">
              <span className="text-slate-400">대기 <span className="tabular-nums text-slate-200">{owner.pendingCount}</span></span>
              {owner.slaBreachCount > 0 && <span className="text-red-400">SLA초과 {owner.slaBreachCount}</span>}
              {owner.escalationCount > 0 && <span className="text-amber-400">에스컬 {owner.escalationCount}</span>}
              <span className="text-slate-600">평균 {Math.round(owner.avgLeadTimeMinutes / 60)}h</span>
            </div>
            {owner.oldestPendingAgeMinutes > 240 && (
              <p className="text-[10px] text-red-400/70 mt-0.5">최장 대기: {Math.round(owner.oldestPendingAgeMinutes / 60)}시간</p>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// OwnerlessHotspotPanel
// ══════════════════════════════════════════════

export interface OwnerlessHotspotPanelProps {
  data: UnassignedDetection;
  onAssignClick?: () => void;
  className?: string;
}

export function OwnerlessHotspotPanel({ data, onAssignClick, className }: OwnerlessHotspotPanelProps) {
  if (data.count === 0) {
    return (
      <div className={cn("rounded border border-emerald-500/20 bg-emerald-500/5 p-3", className)}>
        <p className="text-xs text-emerald-400">모든 대기 건에 담당자 배정 완료</p>
      </div>
    );
  }

  return (
    <div className={cn("rounded border border-red-500/20 bg-red-500/5 p-4 space-y-2", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium text-red-300">미지정 건 경고</h3>
        <span className="text-xs tabular-nums font-medium text-red-400">{data.count}건</span>
      </div>

      <div className="text-xs space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-red-400/70">영향 도메인:</span>
          <div className="flex gap-1">
            {data.domains.map(d => (
              <span key={d} className="text-[9px] bg-red-500/10 text-red-400 rounded px-1 py-0.5">{d}</span>
            ))}
          </div>
        </div>
        {data.urgentCount > 0 && (
          <p className="text-red-400 font-medium">긴급 미지정 {data.urgentCount}건 — 즉시 배정 필요</p>
        )}
        {data.oldestAgeMinutes > 0 && (
          <p className="text-red-400/70">최장 대기: {Math.round(data.oldestAgeMinutes / 60)}시간</p>
        )}
      </div>

      {onAssignClick && (
        <button
          onClick={onAssignClick}
          className="w-full rounded bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 px-3 py-1.5 text-xs font-medium text-red-300 transition-colors"
        >
          담당자 배정
        </button>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════
// OverloadedOwnerPanel
// ══════════════════════════════════════════════

export interface OverloadedOwnerPanelProps {
  data: OverloadedOwnerDetection;
  onRebalanceClick?: (ownerId: string) => void;
  className?: string;
}

export function OverloadedOwnerPanel({ data, onRebalanceClick, className }: OverloadedOwnerPanelProps) {
  if (data.totalOverloaded === 0) return null;

  return (
    <div className={cn("rounded border border-amber-500/20 bg-amber-500/5 p-4 space-y-2", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium text-amber-300">과부하 담당자</h3>
        <span className="text-xs tabular-nums text-amber-400">{data.totalOverloaded}명</span>
      </div>

      <div className="space-y-1.5">
        {data.recommendedRebalance.map((rec) => (
          <div key={rec.fromOwnerId} className="rounded bg-amber-500/5 p-2 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-200">{rec.fromOwnerName}</span>
              {rec.excessCount > 0 && (
                <span className="text-[10px] text-amber-400">+{rec.excessCount}건 초과</span>
              )}
            </div>
            <p className="text-[10px] text-amber-400/70">{rec.suggestedAction}</p>
            {onRebalanceClick && (
              <button
                onClick={() => onRebalanceClick(rec.fromOwnerId)}
                className="text-[10px] text-amber-300 hover:text-amber-200 underline"
              >
                재배정 검토
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// OwnershipCoverageCard
// ══════════════════════════════════════════════

export interface OwnershipCoverageCardProps {
  coverage: OwnershipCoverageSummary;
  className?: string;
}

const HEALTH_CONFIG: Record<string, { color: string; label: string; border: string }> = {
  healthy: { color: "text-emerald-400", label: "양호", border: "border-emerald-500/20" },
  attention: { color: "text-amber-400", label: "주의", border: "border-amber-500/20" },
  critical: { color: "text-red-400", label: "위험", border: "border-red-500/20" },
};

export function OwnershipCoverageCard({ coverage, className }: OwnershipCoverageCardProps) {
  const health = HEALTH_CONFIG[coverage.healthStatus] || HEALTH_CONFIG.attention;

  return (
    <div className={cn("rounded border bg-slate-900/50 p-3 space-y-2", health.border, className)}>
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-medium uppercase tracking-wider text-slate-500">Ownership 현황</h4>
        <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded", health.color, `bg-${health.color.split("-")[1]}-500/10`)}>
          {health.label}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <span className="text-slate-500 text-[10px]">Coverage</span>
          <p className={cn("text-sm font-semibold tabular-nums", coverage.coverageRate >= 90 ? "text-emerald-400" : coverage.coverageRate >= 70 ? "text-amber-400" : "text-red-400")}>
            {coverage.coverageRate}%
          </p>
        </div>
        <div>
          <span className="text-slate-500 text-[10px]">미지정</span>
          <p className={cn("text-sm font-semibold tabular-nums", coverage.unassignedCount === 0 ? "text-slate-400" : "text-red-400")}>
            {coverage.unassignedCount}
          </p>
        </div>
        <div>
          <span className="text-slate-500 text-[10px]">과부하</span>
          <p className={cn("text-sm font-semibold tabular-nums", coverage.overloadedCount === 0 ? "text-slate-400" : "text-amber-400")}>
            {coverage.overloadedCount}
          </p>
        </div>
      </div>
    </div>
  );
}
