"use client";

/**
 * Audit Review Workbench — governance chain 감사 검토 UI
 *
 * center = report 본문 (PO chain report 또는 period report)
 * rail = compliance 요약, risk indicators, stage timeline context
 * dock = export, refresh, filter, decision log, compliance snapshot 보기
 *
 * 모든 label은 grammar registry에서 resolve.
 * 이 surface는 read-only — truth 변경 안 함.
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import type {
  AuditReportSurface,
  POChainReport,
  PeriodReport,
  RiskIndicator,
  AuditDockAction,
} from "@/lib/ai/governance-reporting-engine";
import type { ComplianceVerdict } from "@/lib/ai/governance-audit-engine";

// ══════════════════════════════════════════════════════
// AuditReviewWorkbench
// ══════════════════════════════════════════════════════

export interface AuditReviewWorkbenchProps {
  surface: AuditReportSurface;
  onExportReport?: () => void;
  onRefreshReport?: () => void;
  onFilterChange?: () => void;
  onViewDecisionLog?: () => void;
  onViewComplianceSnapshots?: () => void;
  className?: string;
}

const VERDICT_STYLE: Record<ComplianceVerdict, { bg: string; text: string; label: string }> = {
  compliant: { bg: "bg-emerald-500/10 border-emerald-500/20", text: "text-emerald-400", label: "준수" },
  non_compliant: { bg: "bg-red-500/10 border-red-500/20", text: "text-red-400", label: "비준수" },
  needs_review: { bg: "bg-amber-500/10 border-amber-500/20", text: "text-amber-400", label: "검토 필요" },
};

const RISK_BADGE: Record<string, { bg: string; text: string }> = {
  info: { bg: "bg-slate-600/20", text: "text-slate-400" },
  warning: { bg: "bg-amber-500/10", text: "text-amber-400" },
  critical: { bg: "bg-red-500/10", text: "text-red-400" },
};

export function AuditReviewWorkbench({
  surface,
  onExportReport,
  onRefreshReport,
  onFilterChange,
  onViewDecisionLog,
  onViewComplianceSnapshots,
  className,
}: AuditReviewWorkbenchProps) {
  const actionHandlers: Record<string, (() => void) | undefined> = {
    export_report: onExportReport,
    refresh_report: onRefreshReport,
    filter_change: onFilterChange,
    view_decision_log: onViewDecisionLog,
    view_compliance_snapshots: onViewComplianceSnapshots,
  };

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* ── Center: Report Body ── */}
      <div className="rounded-lg border border-slate-700/50 bg-slate-900/60 p-4">
        {surface.center.reportType === "po_chain" ? (
          <POChainReportCenter report={surface.center.report as POChainReport} />
        ) : (
          <PeriodReportCenter report={surface.center.report as PeriodReport} />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
        {/* ── Rail: Context ── */}
        <div className="order-2 lg:order-1 flex flex-col gap-3">
          {/* Compliance Summary */}
          <ComplianceSummaryCard summary={surface.rail.complianceSummary} />

          {/* Risk Indicators */}
          {surface.rail.riskIndicators.length > 0 && (
            <RiskIndicatorCard indicators={surface.rail.riskIndicators} />
          )}
        </div>

        {/* ── Dock: Actions ── */}
        <div className="order-1 lg:order-2 rounded-lg border border-slate-700/50 bg-slate-900/40 p-3">
          <p className="text-xs text-slate-500 mb-2 font-medium tracking-wide uppercase">작업</p>
          <div className="flex flex-col gap-1.5">
            {surface.dock.actions.map((action) => (
              <button
                key={action.actionKey}
                onClick={actionHandlers[action.actionKey]}
                disabled={!action.enabled}
                className={cn(
                  "w-full rounded px-3 py-1.5 text-xs text-left transition-colors",
                  action.enabled
                    ? "bg-slate-800/60 text-slate-600 hover:bg-slate-700/60 hover:text-slate-900"
                    : "bg-slate-800/20 text-slate-600 cursor-not-allowed",
                )}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════
// Sub-components
// ══════════════════════════════════════════════════════

function POChainReportCenter({ report }: { report: POChainReport }) {
  const { auditSummary } = report;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">PO 체인 감사 보고서</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {auditSummary.poNumber} · {auditSummary.caseId}
          </p>
        </div>
        {auditSummary.latestVerdict && (
          <VerdictBadge verdict={auditSummary.latestVerdict} />
        )}
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <KPICard label="총 판단" value={auditSummary.totalDecisions} />
        <KPICard label="비가역 조치" value={auditSummary.irreversibleDecisions} highlight={auditSummary.irreversibleDecisions > 0} />
        <KPICard label="준수 점수" value={auditSummary.complianceScore !== null ? `${Math.round(auditSummary.complianceScore * 100)}%` : "-"} />
        <KPICard label="비준수" value={auditSummary.nonCompliantCount} highlight={auditSummary.nonCompliantCount > 0} />
      </div>

      {/* Stage progression */}
      {auditSummary.stagesVisited.length > 0 && (
        <div>
          <p className="text-xs text-slate-500 mb-1.5 font-medium">단계 진행</p>
          <div className="flex flex-wrap gap-1">
            {auditSummary.stagesVisited.map((sv, i) => (
              <span
                key={sv.stage}
                className={cn(
                  "rounded px-2 py-0.5 text-xs",
                  i === auditSummary.stagesVisited.length - 1
                    ? "bg-blue-500/15 text-blue-300 border border-blue-500/20"
                    : "bg-slate-800/60 text-slate-400",
                )}
              >
                {sv.stageLabel}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Longest stage */}
      {report.longestStage && (
        <div className="text-xs text-slate-500">
          가장 오래 머문 단계: <span className="text-slate-600">{report.longestStage.stageLabel}</span>
          {" "}({formatDuration(report.longestStage.durationMs)})
        </div>
      )}

      {/* Domain participation */}
      {auditSummary.domainsParticipated.length > 0 && (
        <div>
          <p className="text-xs text-slate-500 mb-1 font-medium">참여 도메인</p>
          <div className="flex flex-wrap gap-1">
            {auditSummary.domainsParticipated.map(d => (
              <span key={d} className="rounded px-2 py-0.5 text-xs bg-slate-800/60 text-slate-400">
                {d} ({auditSummary.domainDecisionCounts[d] ?? 0})
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PeriodReportCenter({ report }: { report: PeriodReport }) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700">기간 운영 보고서</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          {report.periodStart.slice(0, 10)} ~ {report.periodEnd.slice(0, 10)}
        </p>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <KPICard label="활성 PO" value={report.activePOCount} />
        <KPICard label="총 판단" value={report.totalDecisions} />
        <KPICard label="준수율" value={report.complianceRate !== null ? `${Math.round(report.complianceRate * 100)}%` : "-"} />
        <KPICard label="비준수" value={report.nonCompliantCount} highlight={report.nonCompliantCount > 0} />
      </div>

      {/* Bottleneck */}
      {report.bottleneckStage && (
        <div className="text-xs text-slate-500">
          병목 단계: <span className="text-slate-600">{report.bottleneckStage.stageLabel}</span>
          {" "}({report.bottleneckStage.count}건)
        </div>
      )}

      {/* Top blocker types */}
      {report.topBlockerTypes.length > 0 && (
        <div>
          <p className="text-xs text-slate-500 mb-1 font-medium">주요 차단 유형</p>
          <div className="flex flex-col gap-0.5">
            {report.topBlockerTypes.map(bt => (
              <div key={bt.type} className="flex items-center justify-between text-xs">
                <span className="text-slate-400">{bt.type}</span>
                <span className="text-slate-500">{bt.count}건</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actor summary */}
      {report.mostActiveActor && (
        <div className="text-xs text-slate-500">
          최다 활동: <span className="text-slate-600">{report.mostActiveActor.actor}</span>
          {" "}({report.mostActiveActor.decisionCount}건)
        </div>
      )}
    </div>
  );
}

function ComplianceSummaryCard({ summary }: {
  summary: { totalSnapshots: number; compliantCount: number; nonCompliantCount: number; needsReviewCount: number };
}) {
  return (
    <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-3">
      <p className="text-xs text-slate-500 mb-2 font-medium tracking-wide uppercase">준수 현황</p>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="text-slate-400">전체 스냅샷</div>
        <div className="text-right text-slate-600">{summary.totalSnapshots}</div>
        <div className="text-emerald-400">준수</div>
        <div className="text-right text-emerald-300">{summary.compliantCount}</div>
        <div className="text-red-400">비준수</div>
        <div className="text-right text-red-300">{summary.nonCompliantCount}</div>
        <div className="text-amber-400">검토 필요</div>
        <div className="text-right text-amber-300">{summary.needsReviewCount}</div>
      </div>
    </div>
  );
}

function RiskIndicatorCard({ indicators }: { indicators: RiskIndicator[] }) {
  return (
    <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-3">
      <p className="text-xs text-slate-500 mb-2 font-medium tracking-wide uppercase">위험 지표</p>
      <div className="flex flex-col gap-1.5">
        {indicators.map((ri, i) => {
          const badge = RISK_BADGE[ri.level] ?? RISK_BADGE.info;
          return (
            <div key={i} className={cn("rounded px-2 py-1 border text-xs", badge.bg)}>
              <span className={cn("font-medium", badge.text)}>{ri.levelLabel}</span>
              <span className="text-slate-500 mx-1">·</span>
              <span className="text-slate-400">{ri.detail}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function VerdictBadge({ verdict }: { verdict: ComplianceVerdict }) {
  const style = VERDICT_STYLE[verdict];
  return (
    <span className={cn("rounded px-2 py-0.5 text-xs font-medium border", style.bg, style.text)}>
      {style.label}
    </span>
  );
}

function KPICard({ label, value, highlight }: { label: string; value: number | string; highlight?: boolean }) {
  return (
    <div className="rounded border border-slate-700/30 bg-slate-800/30 px-2.5 py-2 text-center">
      <div className={cn("text-base font-semibold", highlight ? "text-red-400" : "text-slate-700")}>
        {value}
      </div>
      <div className="text-[10px] text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}

// ── Utility ──

function formatDuration(ms: number): string {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}일`;
  }
  if (hours > 0) return `${hours}시간 ${minutes}분`;
  return `${minutes}분`;
}
