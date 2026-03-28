"use client";

/**
 * Governance Dashboard Batch 2 Panels — 운영 통제실 시야
 *
 * - TeamSiteBreakdownPanel: team/site 별 병목 + risk score
 * - EscalationHotspotPanel: domain별 escalation source 분해
 * - ReapprovalLoopPanel: reapproval 반복 케이스 + invalidation 빈도
 * - PolicyImpactTrendPanel: publish/rollback 이후 영향 추세
 *
 * 원칙:
 * - 모든 패널은 inbox/case/workbench로 deep link 가능
 * - explanation은 PolicyApprovalConflictPayload만 참조
 * - operator-safe summary와 audit detail 구분 유지
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import type { BreakdownRecord, GovernanceBreakdownSummary } from "@/lib/ai/governance-dashboard-breakdown-engine";
import type { EscalationHotspotSummary, ReapprovalLoopAnalysis, PolicyImpactTrendSummary, PolicyChangeImpact } from "@/lib/ai/governance-escalation-hotspot-engine";

// ══════════════════════════════════════════════
// TeamSiteBreakdownPanel
// ══════════════════════════════════════════════

export interface TeamSiteBreakdownPanelProps {
  breakdown: GovernanceBreakdownSummary;
  onDrilldown?: (record: BreakdownRecord) => void;
  className?: string;
}

export function TeamSiteBreakdownPanel({ breakdown, onDrilldown, className }: TeamSiteBreakdownPanelProps) {
  return (
    <div className={cn("rounded border border-slate-800 bg-slate-900/50 p-4 space-y-3", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500">
          {breakdown.dimension === "team" ? "팀별" : breakdown.dimension === "site" ? "사이트별" : breakdown.dimension === "department" ? "부서별" : "도메인별"} 현황
        </h3>
        {breakdown.criticalCount > 0 && (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
            위험 {breakdown.criticalCount}
          </span>
        )}
      </div>

      <div className="space-y-2">
        {breakdown.records.slice(0, 8).map((record) => (
          <button
            key={record.dimensionId}
            onClick={() => onDrilldown?.(record)}
            className="w-full text-left rounded border border-slate-800/50 hover:border-slate-700 bg-slate-900/30 hover:bg-slate-800/30 p-2.5 transition-colors"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-slate-200">{record.dimensionLabel}</span>
              <div className="flex items-center gap-2">
                <RiskBadge level={record.riskLevel} score={record.riskScore} />
                <span className="text-xs tabular-nums text-slate-400">{record.pendingCount}건</span>
              </div>
            </div>
            <div className="flex gap-3 text-[10px]">
              {record.slaBreachCount > 0 && <span className="text-red-400">SLA초과 {record.slaBreachCount}</span>}
              {record.escalationCount > 0 && <span className="text-amber-400">에스컬 {record.escalationCount}</span>}
              {record.reapprovalCount > 0 && <span className="text-amber-400">재승인 {record.reapprovalCount}</span>}
              <span className="text-slate-600">평균 {Math.round(record.avgLeadTimeMinutes / 60)}h</span>
              {record.oldestPendingAgeMinutes > 240 && (
                <span className="text-red-400/70">최장 {Math.round(record.oldestPendingAgeMinutes / 60)}h</span>
              )}
            </div>
            {record.topBlocker && (
              <p className="text-[10px] text-slate-600 mt-1 truncate">주요 차단: {record.topBlocker}</p>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// EscalationHotspotPanel
// ══════════════════════════════════════════════

export interface EscalationHotspotPanelProps {
  data: EscalationHotspotSummary;
  onDrilldown?: (domain: string) => void;
  className?: string;
}

const DOMAIN_LABELS: Record<string, string> = {
  fire_execution: "발송", stock_release: "릴리스",
  exception_resolve: "예외해결", exception_return_to_stage: "예외복귀",
};

export function EscalationHotspotPanel({ data, onDrilldown, className }: EscalationHotspotPanelProps) {
  return (
    <div className={cn("rounded border border-slate-800 bg-slate-900/50 p-4 space-y-3", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500">에스컬레이션 핫스팟</h3>
        <span className="text-xs tabular-nums text-slate-400">총 {data.totalEscalations}건</span>
      </div>

      {data.hottestSource && (
        <div className="rounded bg-amber-500/5 border border-amber-500/10 px-2.5 py-1.5 text-xs text-amber-400">
          최다 원인: <span className="font-medium">{data.hottestSource}</span>
        </div>
      )}

      <div className="space-y-2">
        {data.hotspots.map((hotspot) => (
          <button
            key={hotspot.domain}
            onClick={() => onDrilldown?.(hotspot.domain)}
            className="w-full text-left rounded border border-slate-800/50 hover:border-slate-700 p-2 transition-colors"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-200">{DOMAIN_LABELS[hotspot.domain] || hotspot.domain}</span>
              <span className="text-xs tabular-nums font-medium text-amber-400">{hotspot.escalationCount}건 ({hotspot.escalationRate}%)</span>
            </div>
            {hotspot.sourceBreakdown.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {hotspot.sourceBreakdown.slice(0, 3).map((s, i) => (
                  <span key={i} className="text-[9px] bg-slate-800/50 text-slate-500 rounded px-1 py-0.5">
                    {s.source} {s.count}
                  </span>
                ))}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// ReapprovalLoopPanel
// ══════════════════════════════════════════════

export interface ReapprovalLoopPanelProps {
  data: ReapprovalLoopAnalysis;
  onDrilldown?: (caseId: string) => void;
  className?: string;
}

export function ReapprovalLoopPanel({ data, onDrilldown, className }: ReapprovalLoopPanelProps) {
  return (
    <div className={cn("rounded border border-slate-800 bg-slate-900/50 p-4 space-y-3", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500">재승인 루프 분석</h3>
        <span className="text-xs tabular-nums text-slate-400">{data.totalReapprovals}건 재승인</span>
      </div>

      {/* Domain breakdown */}
      <div className="grid grid-cols-2 gap-2">
        {data.domainBreakdown.filter(d => d.reapprovalCount > 0).map((d) => (
          <div key={d.domain} className="rounded bg-slate-800/30 p-2 text-xs">
            <span className="text-slate-400">{DOMAIN_LABELS[d.domain] || d.domain}</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-sm font-semibold tabular-nums text-amber-400">{d.reapprovalCount}</span>
              <span className="text-[10px] text-slate-600">({d.loopRate}%)</span>
            </div>
          </div>
        ))}
      </div>

      {/* Top repeaters */}
      {data.topRepeaters.length > 0 && (
        <div className="space-y-1">
          <span className="text-[10px] text-slate-600">반복 케이스</span>
          {data.topRepeaters.slice(0, 3).map((r) => (
            <button
              key={r.caseId}
              onClick={() => onDrilldown?.(r.caseId)}
              className="w-full text-left flex items-center justify-between rounded hover:bg-slate-800/30 px-2 py-1 text-xs transition-colors"
            >
              <span className="text-slate-300 font-mono text-[10px]">{r.caseId.slice(0, 12)}</span>
              <span className="text-amber-400 tabular-nums">{r.totalLoops}회</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════
// PolicyImpactTrendPanel
// ══════════════════════════════════════════════

export interface PolicyImpactTrendPanelProps {
  data: PolicyImpactTrendSummary;
  onDrilldown?: (changeId: string) => void;
  className?: string;
}

export function PolicyImpactTrendPanel({ data, onDrilldown, className }: PolicyImpactTrendPanelProps) {
  return (
    <div className={cn("rounded border border-slate-800 bg-slate-900/50 p-4 space-y-3", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500">정책 변경 영향</h3>
        <span className="text-xs text-slate-400">
          {data.totalPublishes} publish · {data.totalRollbacks} rollback
        </span>
      </div>

      {/* Net impact summary */}
      <div className="flex gap-3 text-xs">
        {data.netTighteningEvents > 0 && (
          <span className="text-red-400">강화 {data.netTighteningEvents}건</span>
        )}
        {data.netRelaxingEvents > 0 && (
          <span className="text-emerald-400">완화 {data.netRelaxingEvents}건</span>
        )}
      </div>

      {/* Recent changes */}
      <div className="space-y-1.5">
        {data.changes.slice(0, 5).map((change) => (
          <button
            key={change.changeEventId}
            onClick={() => onDrilldown?.(change.changeEventId)}
            className="w-full text-left rounded border border-slate-800/50 hover:border-slate-700 p-2 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className={cn(
                  "text-[10px] font-medium px-1 py-0.5 rounded",
                  change.changeType === "publish" ? "bg-blue-500/10 text-blue-400" : "bg-red-500/10 text-red-400",
                )}>
                  {change.changeType}
                </span>
                <span className="text-xs text-slate-400">{change.policyDomain}</span>
              </div>
              <ImpactBadge impact={change.overallImpact} />
            </div>
            <div className="flex gap-2 mt-1 text-[10px] text-slate-600">
              {change.approvalDelta !== 0 && <span>승인 {change.approvalDelta > 0 ? "+" : ""}{change.approvalDelta}</span>}
              {change.escalationDelta !== 0 && <span>에스컬 {change.escalationDelta > 0 ? "+" : ""}{change.escalationDelta}</span>}
              {change.blockDelta !== 0 && <span>차단 {change.blockDelta > 0 ? "+" : ""}{change.blockDelta}</span>}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// Shared Sub-components
// ══════════════════════════════════════════════

function RiskBadge({ level, score }: { level: string; score: number }) {
  return (
    <span className={cn(
      "text-[9px] font-medium px-1 py-0.5 rounded tabular-nums",
      level === "critical" && "bg-red-500/10 text-red-400",
      level === "high" && "bg-amber-500/10 text-amber-400",
      level === "medium" && "bg-blue-500/10 text-blue-400",
      level === "low" && "bg-slate-500/10 text-slate-400",
    )}>
      {score}
    </span>
  );
}

function ImpactBadge({ impact }: { impact: string }) {
  return (
    <span className={cn(
      "text-[9px] font-medium px-1 py-0.5 rounded",
      impact === "tightened" && "bg-red-500/10 text-red-400",
      impact === "relaxed" && "bg-emerald-500/10 text-emerald-400",
      impact === "mixed" && "bg-amber-500/10 text-amber-400",
      impact === "neutral" && "bg-slate-500/10 text-slate-400",
    )}>
      {impact === "tightened" ? "강화" : impact === "relaxed" ? "완화" : impact === "mixed" ? "혼합" : "변동없음"}
    </span>
  );
}
