"use client";

/**
 * GovernanceDashboard — Approval Governance 운영 대시보드
 *
 * 예쁜 차트보다 "어디가 병목인지와 어떤 정책이 운영을 가장 많이 막는지"가 먼저.
 *
 * 구조:
 * - KPI Strip: 핵심 10지표 요약
 * - Bottleneck Panel: 감지된 병목 + 권장 조치
 * - Domain Breakdown: domain별 pending/SLA/escalation
 * - Top Blockers: 가장 빈번한 차단 이유
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import type {
  GovernanceMetricsSummary,
  ApprovalMetric,
  DomainMetrics,
  BlockerFrequency,
  BottleneckIndicator,
} from "@/lib/ai/approval-governance-metrics-engine";

export interface GovernanceDashboardProps {
  metrics: GovernanceMetricsSummary;
  className?: string;
}

export function GovernanceDashboard({ metrics, className }: GovernanceDashboardProps) {
  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-100">Approval Governance</h2>
          <p className="text-xs text-slate-500 mt-0.5">{metrics.periodLabel}</p>
        </div>
        <span className="text-[10px] text-slate-600">
          {new Date(metrics.generatedAt).toLocaleString("ko-KR")}
        </span>
      </div>

      {/* Bottleneck Alerts (가장 먼저 보여야 함) */}
      {metrics.bottlenecks.length > 0 && (
        <BottleneckAlerts bottlenecks={metrics.bottlenecks} />
      )}

      {/* KPI Strip */}
      <KPIStrip metrics={metrics.metrics} />

      {/* Domain Breakdown + Top Blockers */}
      <div className="grid grid-cols-2 gap-4">
        <DomainBreakdownPanel domains={metrics.domainBreakdown} />
        <TopBlockersPanel blockers={metrics.topBlockers} />
      </div>
    </div>
  );
}

// ── Bottleneck Alerts ──
function BottleneckAlerts({ bottlenecks }: { bottlenecks: BottleneckIndicator[] }) {
  return (
    <div className="space-y-2">
      {bottlenecks.map((b, i) => (
        <div
          key={i}
          className={cn(
            "rounded border px-3 py-2.5",
            b.severity === "critical"
              ? "border-red-500/20 bg-red-500/5"
              : "border-amber-500/20 bg-amber-500/5",
          )}
        >
          <div className="flex items-start gap-2">
            <span className={cn(
              "shrink-0 mt-0.5 text-xs",
              b.severity === "critical" ? "text-red-400" : "text-amber-400",
            )} aria-hidden="true">
              {b.severity === "critical" ? "✕" : "!"}
            </span>
            <div className="flex-1 min-w-0">
              <p className={cn(
                "text-sm font-medium",
                b.severity === "critical" ? "text-red-300" : "text-amber-300",
              )}>
                {b.detail}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                권장 조치: {b.recommendedAction}
              </p>
            </div>
            {b.affectedDomain && (
              <span className="shrink-0 text-[10px] text-slate-500 bg-slate-800 rounded px-1.5 py-0.5">
                {DOMAIN_LABELS[b.affectedDomain] || b.affectedDomain}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── KPI Strip ──
function KPIStrip({ metrics }: { metrics: ApprovalMetric[] }) {
  return (
    <div className="grid grid-cols-5 gap-3">
      {metrics.map((m) => (
        <div
          key={m.metricKey}
          className={cn(
            "rounded border bg-slate-900/50 p-3 space-y-1",
            m.status === "critical" && "border-red-500/20",
            m.status === "warning" && "border-amber-500/20",
            m.status === "healthy" && "border-slate-800",
          )}
        >
          <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500 truncate">
            {m.label}
          </p>
          <div className="flex items-baseline gap-1">
            <span className={cn(
              "text-lg font-semibold tabular-nums",
              m.status === "critical" && "text-red-400",
              m.status === "warning" && "text-amber-400",
              m.status === "healthy" && "text-slate-100",
            )}>
              {typeof m.value === "number" && m.value > 999
                ? `${(m.value / 60).toFixed(0)}h`
                : m.value}
            </span>
            <span className="text-[10px] text-slate-500">{m.unit === "분" && m.value > 60 ? "" : m.unit}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className={cn(
              "h-1.5 w-1.5 rounded-full",
              m.status === "critical" && "bg-red-400",
              m.status === "warning" && "bg-amber-400",
              m.status === "healthy" && "bg-emerald-400",
            )} />
            <span className="text-[10px] text-slate-600 truncate">{m.detail}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Domain Breakdown ──
const DOMAIN_LABELS: Record<string, string> = {
  fire_execution: "발송",
  stock_release: "재고 릴리스",
  exception_resolve: "예외 해결",
  exception_return_to_stage: "예외 복귀",
};

function DomainBreakdownPanel({ domains }: { domains: DomainMetrics[] }) {
  return (
    <div className="rounded border border-slate-800 bg-slate-900/50 p-4">
      <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-3">
        Domain별 현황
      </h3>
      <div className="space-y-3">
        {domains.map((d) => (
          <div key={d.domain} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-300">{DOMAIN_LABELS[d.domain] || d.domain}</span>
              <span className="text-xs tabular-nums text-slate-400">
                {d.pendingCount}건 대기
              </span>
            </div>
            <div className="flex gap-3 text-[10px]">
              <span className="text-slate-500">
                평균 <span className="text-slate-400 tabular-nums">{Math.round(d.avgLeadTimeMinutes / 60)}h</span>
              </span>
              {d.slaBreachCount > 0 && (
                <span className="text-red-400 tabular-nums">SLA초과 {d.slaBreachCount}</span>
              )}
              {d.escalationCount > 0 && (
                <span className="text-amber-400 tabular-nums">에스컬 {d.escalationCount}</span>
              )}
              {d.reapprovalCount > 0 && (
                <span className="text-amber-400 tabular-nums">재승인 {d.reapprovalCount}</span>
              )}
            </div>
            {d.oldestItemAgeMinutes > 240 && (
              <div className="text-[10px] text-red-400/70">
                최장 대기: {Math.round(d.oldestItemAgeMinutes / 60)}시간
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Top Blockers ──
function TopBlockersPanel({ blockers }: { blockers: BlockerFrequency[] }) {
  if (blockers.length === 0) {
    return (
      <div className="rounded border border-slate-800 bg-slate-900/50 p-4">
        <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-3">
          주요 차단 이유
        </h3>
        <p className="text-xs text-slate-500">활성 차단 없음</p>
      </div>
    );
  }

  return (
    <div className="rounded border border-slate-800 bg-slate-900/50 p-4">
      <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-3">
        주요 차단 이유
      </h3>
      <div className="space-y-2">
        {blockers.map((b, i) => (
          <div key={i} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-300 max-w-[200px] truncate">{b.blockerReason}</span>
              <span className="text-xs tabular-nums font-medium text-slate-200">{b.count}건</span>
            </div>
            <div className="flex items-center gap-2">
              {/* Progress bar */}
              <div className="flex-1 h-1 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    b.percentage > 30 ? "bg-red-400" : b.percentage > 15 ? "bg-amber-400" : "bg-slate-500",
                  )}
                  style={{ width: `${Math.min(100, b.percentage)}%` }}
                />
              </div>
              <span className="text-[10px] text-slate-500 tabular-nums shrink-0">{b.percentage}%</span>
            </div>
            <div className="flex gap-1">
              {b.affectedDomains.map(d => (
                <span key={d} className="text-[9px] text-slate-600 bg-slate-800/50 rounded px-1 py-0.5">
                  {DOMAIN_LABELS[d] || d}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
