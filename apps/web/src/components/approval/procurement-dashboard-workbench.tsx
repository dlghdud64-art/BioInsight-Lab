"use client";

/**
 * Procurement Dashboard Workbench — 구매 운영 체인 전체 대시보드
 *
 * summary가 아니라 entry system.
 * panel 클릭 = exact workbench 진입 (handoff token 포함).
 *
 * center = panel grid + chain health KPI strip
 * rail = chain timeline + stale context warnings + filter
 * dock = refresh / filter reset / view toggle
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import type {
  ProcurementDashboardSurface,
  ProcurementPanelData,
  ProcurementPanelItem,
  ProcurementPanelId,
  ProcurementDashboardContext,
  ProcurementDashboardHandoffToken,
  ProcurementDashboardFilter,
  ChainTimeline,
  ChainTimelineEntry,
  StaleBannerState,
} from "@/lib/ai/procurement-dashboard-engine";

// ══════════════════════════════════════════════
// Props
// ══════════════════════════════════════════════

export interface ProcurementDashboardWorkbenchProps {
  surface: ProcurementDashboardSurface;
  context: ProcurementDashboardContext;
  chainTimelines?: ChainTimeline[];
  onPanelClick?: (panelId: ProcurementPanelId) => void;
  onItemClick?: (item: ProcurementPanelItem, panelId: ProcurementPanelId) => void;
  onHandoffCreate?: (token: ProcurementDashboardHandoffToken) => void;
  onFilterChange?: (filter: ProcurementDashboardFilter) => void;
  onFilterReset?: () => void;
  onRefresh?: (panels?: ProcurementPanelId[]) => void;
  onViewChange?: (view: ProcurementDashboardContext["activeView"]) => void;
  className?: string;
}

// ══════════════════════════════════════════════
// Color / Style maps
// ══════════════════════════════════════════════

const SEVERITY_BG: Record<string, string> = {
  critical: "border-red-500/30 bg-red-500/5",
  warning: "border-amber-500/20 bg-amber-500/5",
  normal: "border-slate-600/20 bg-slate-800/30",
};

const SEVERITY_DOT: Record<string, string> = {
  critical: "bg-red-400",
  warning: "bg-amber-400",
  normal: "bg-slate-500",
};

const SEVERITY_TEXT: Record<string, string> = {
  critical: "text-red-400",
  warning: "text-amber-400",
  normal: "text-slate-400",
};

const STALE_BANNER_STYLE: Record<string, string> = {
  none: "",
  info: "border-blue-500/20 bg-blue-500/5 text-blue-300",
  warning: "border-amber-500/20 bg-amber-500/5 text-amber-300",
  blocking: "border-red-500/30 bg-red-500/10 text-red-300",
};

const HEALTH_COLOR: Record<string, string> = {
  healthy: "text-emerald-400",
  at_risk: "text-amber-400",
  blocked: "text-red-400",
};

const HEALTH_LABEL: Record<string, string> = {
  healthy: "정상",
  at_risk: "주의",
  blocked: "차단",
};

const TIMELINE_STATUS_DOT: Record<string, string> = {
  completed: "bg-emerald-400",
  active: "bg-blue-400",
  blocked: "bg-red-400",
  pending: "bg-slate-600",
  skipped: "bg-slate-700",
};

// ══════════════════════════════════════════════
// Sub-components
// ══════════════════════════════════════════════

function StaleBanner({ banner }: { banner: StaleBannerState }) {
  if (banner.level === "none") return null;

  return (
    <div className={cn(
      "rounded border px-3 py-2 text-xs",
      STALE_BANNER_STYLE[banner.level],
    )}>
      <span className="font-medium">
        {banner.level === "blocking" ? "⛔ " : banner.level === "warning" ? "⚠ " : "ℹ "}
      </span>
      {banner.message}
      {banner.locksIrreversibleActions && (
        <span className="ml-2 text-red-400/80">— 실행 작업이 잠겨 있습니다</span>
      )}
    </div>
  );
}

function KPIStrip({
  totalActive,
  totalCritical,
  totalWarning,
  isFiltered,
}: {
  totalActive: number;
  totalCritical: number;
  totalWarning: number;
  isFiltered: boolean;
}) {
  return (
    <div className="flex items-center gap-4 text-xs">
      <div className="flex items-center gap-1.5">
        <span className="text-slate-400">활성</span>
        <span className="font-mono font-medium text-slate-700">{totalActive}</span>
      </div>
      {totalCritical > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
          <span className="text-red-400 font-mono">{totalCritical}</span>
        </div>
      )}
      {totalWarning > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
          <span className="text-amber-400 font-mono">{totalWarning}</span>
        </div>
      )}
      {isFiltered && (
        <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-blue-400 border border-blue-500/20">
          필터 적용 중
        </span>
      )}
    </div>
  );
}

function PanelCard({
  panel,
  isStale,
  onPanelClick,
  onItemClick,
}: {
  panel: ProcurementPanelData;
  isStale: boolean;
  onPanelClick?: (id: ProcurementPanelId) => void;
  onItemClick?: (item: ProcurementPanelItem, panelId: ProcurementPanelId) => void;
}) {
  const hasCritical = panel.criticalCount > 0;
  const borderColor = isStale
    ? "border-amber-500/30"
    : hasCritical
      ? "border-red-500/20"
      : panel.count > 0
        ? "border-slate-600/30"
        : "border-slate-700/20";

  return (
    <div
      className={cn(
        "rounded-lg border bg-slate-900/50 p-3 transition-colors hover:bg-slate-800/50",
        borderColor,
        onPanelClick && "cursor-pointer",
      )}
      onClick={() => onPanelClick?.(panel.panelId)}
      role={onPanelClick ? "button" : undefined}
      tabIndex={onPanelClick ? 0 : undefined}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-600">{panel.label}</span>
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-sm font-medium text-slate-700">{panel.count}</span>
          {isStale && (
            <span className="text-amber-400 text-xs" title={panel.staleReason ?? undefined}>⚠</span>
          )}
        </div>
      </div>

      {/* Severity breakdown */}
      {panel.count > 0 && (
        <div className="flex items-center gap-2 mb-2 text-xs">
          {panel.criticalCount > 0 && (
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
              <span className="text-red-400 font-mono">{panel.criticalCount}</span>
            </span>
          )}
          {panel.warningCount > 0 && (
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              <span className="text-amber-400 font-mono">{panel.warningCount}</span>
            </span>
          )}
          {panel.normalCount > 0 && (
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
              <span className="text-slate-500 font-mono">{panel.normalCount}</span>
            </span>
          )}
        </div>
      )}

      {/* Top items (max 3) */}
      {panel.items.length > 0 && (
        <div className="space-y-1">
          {panel.items.slice(0, 3).map(item => (
            <div
              key={item.itemId}
              className={cn(
                "rounded border px-2 py-1 text-xs transition-colors",
                SEVERITY_BG[item.severity],
                onItemClick && "cursor-pointer hover:bg-slate-700/50",
              )}
              onClick={(e) => {
                e.stopPropagation();
                onItemClick?.(item, panel.panelId);
              }}
              role={onItemClick ? "button" : undefined}
              tabIndex={onItemClick ? 0 : undefined}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-slate-600 truncate max-w-[120px]">
                  {item.primaryLabel}
                </span>
                <span className={cn("text-xs", SEVERITY_TEXT[item.severity])}>
                  {item.daysInState > 0 ? `${item.daysInState}일` : "오늘"}
                </span>
              </div>
              <div className="text-slate-500 truncate">{item.secondaryLabel}</div>
            </div>
          ))}
          {panel.items.length > 3 && (
            <div className="text-xs text-slate-600 text-center py-0.5">
              +{panel.items.length - 3}건 더
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {panel.count === 0 && (
        <div className="text-xs text-slate-600 text-center py-2">없음</div>
      )}
    </div>
  );
}

function ChainTimelineRow({
  timeline,
  onStageClick,
}: {
  timeline: ChainTimeline;
  onStageClick?: (poNumber: string, stage: ChainTimelineEntry) => void;
}) {
  return (
    <div className="rounded-lg border border-slate-700/30 bg-slate-900/30 p-2">
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-mono text-xs text-slate-600">{timeline.poNumber}</span>
        <div className="flex items-center gap-2">
          <span className={cn("text-xs font-medium", HEALTH_COLOR[timeline.overallHealth])}>
            {HEALTH_LABEL[timeline.overallHealth]}
          </span>
          <span className="text-xs text-slate-600">{timeline.totalDaysInChain}일</span>
        </div>
      </div>

      {/* Stage dots */}
      <div className="flex items-center gap-0.5">
        {timeline.entries.map((entry, i) => (
          <React.Fragment key={entry.stage}>
            <button
              className={cn(
                "h-2 w-2 rounded-full transition-colors",
                TIMELINE_STATUS_DOT[entry.status],
                entry.stale && "ring-1 ring-amber-400/50",
                onStageClick && "cursor-pointer hover:ring-1 hover:ring-slate-400/50",
              )}
              title={`${entry.stage}: ${entry.status}${entry.blockerCount > 0 ? ` (차단 ${entry.blockerCount})` : ""}${entry.stale ? " ⚠ stale" : ""}`}
              onClick={() => onStageClick?.(timeline.poNumber, entry)}
            />
            {i < timeline.entries.length - 1 && (
              <span className={cn(
                "h-px w-2",
                entry.status === "completed" ? "bg-emerald-400/30" : "bg-slate-700/50",
              )} />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// Main Workbench
// ══════════════════════════════════════════════

export function ProcurementDashboardWorkbench({
  surface,
  context,
  chainTimelines = [],
  onPanelClick,
  onItemClick,
  onFilterChange,
  onFilterReset,
  onRefresh,
  onViewChange,
  className,
}: ProcurementDashboardWorkbenchProps) {
  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* ── Stale Banner ── */}
      <StaleBanner banner={surface.staleBanner} />

      <div className="flex flex-1 min-h-0">
        {/* ══════════ CENTER ══════════ */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* KPI Strip */}
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-slate-700">구매 운영 현황</h2>
            <KPIStrip
              totalActive={surface.totalActiveCount}
              totalCritical={surface.totalCriticalCount}
              totalWarning={surface.totalWarningCount}
              isFiltered={surface.isFiltered}
            />
          </div>

          {/* Panel Grid */}
          {context.activeView === "panels" && (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {surface.panels.map(panel => (
                <PanelCard
                  key={panel.panelId}
                  panel={panel}
                  isStale={surface.stalePanelIds.includes(panel.panelId)}
                  onPanelClick={onPanelClick}
                  onItemClick={onItemClick}
                />
              ))}
            </div>
          )}

          {/* Chain Timeline View */}
          {context.activeView === "chain_timeline" && chainTimelines.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-slate-400">PO별 체인 타임라인</h3>
              {chainTimelines.map(tl => (
                <ChainTimelineRow key={tl.poNumber} timeline={tl} />
              ))}
            </div>
          )}

          {context.activeView === "chain_timeline" && chainTimelines.length === 0 && (
            <div className="text-sm text-slate-600 text-center py-8">타임라인 데이터 없음</div>
          )}
        </div>

        {/* ══════════ RAIL ══════════ */}
        <aside className="w-64 border-l border-slate-700/30 bg-slate-900/20 overflow-y-auto p-3 space-y-4 hidden lg:block">
          {/* Stale Panels List */}
          {surface.hasStalePanel && (
            <div className="space-y-1">
              <h4 className="text-xs font-medium text-amber-400">변경 감지 패널</h4>
              {surface.stalePanelIds.map(id => {
                const panel = surface.panels.find(p => p.panelId === id);
                return (
                  <div
                    key={id}
                    className="text-xs text-amber-300/70 rounded bg-amber-500/5 border border-amber-500/10 px-2 py-1"
                  >
                    {panel?.label ?? id}
                    {panel?.staleReason && (
                      <span className="block text-amber-500/50 mt-0.5">{panel.staleReason}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Filter Summary */}
          {surface.isFiltered && (
            <div className="space-y-1">
              <h4 className="text-xs font-medium text-blue-400">적용 필터</h4>
              {context.filter.domainFilter && (
                <div className="text-xs text-slate-400">도메인: {context.filter.domainFilter}</div>
              )}
              {context.filter.severityFilter && (
                <div className="text-xs text-slate-400">심각도: {context.filter.severityFilter}</div>
              )}
              {context.filter.poNumberSearch && (
                <div className="text-xs text-slate-400">PO: {context.filter.poNumberSearch}</div>
              )}
              {context.filter.daysInStateMin != null && (
                <div className="text-xs text-slate-400">체류일 ≥ {context.filter.daysInStateMin}</div>
              )}
            </div>
          )}

          {/* Chain Health Summary */}
          {chainTimelines.length > 0 && (
            <div className="space-y-1">
              <h4 className="text-xs font-medium text-slate-400">체인 건강도</h4>
              <div className="grid grid-cols-3 gap-1 text-center text-xs">
                <div>
                  <div className="font-mono text-emerald-400">
                    {chainTimelines.filter(t => t.overallHealth === "healthy").length}
                  </div>
                  <div className="text-slate-600">정상</div>
                </div>
                <div>
                  <div className="font-mono text-amber-400">
                    {chainTimelines.filter(t => t.overallHealth === "at_risk").length}
                  </div>
                  <div className="text-slate-600">주의</div>
                </div>
                <div>
                  <div className="font-mono text-red-400">
                    {chainTimelines.filter(t => t.overallHealth === "blocked").length}
                  </div>
                  <div className="text-slate-600">차단</div>
                </div>
              </div>
            </div>
          )}

          {/* Active Handoff Info */}
          {context.activeHandoff && (
            <div className="space-y-1">
              <h4 className="text-xs font-medium text-slate-400">활성 핸드오프</h4>
              <div className="text-xs text-slate-500 rounded border border-slate-700/20 bg-slate-800/30 p-2">
                <div>PO: {context.activeHandoff.poNumber}</div>
                <div>출발 패널: {context.activeHandoff.originPanel}</div>
                <div>대상: {context.activeHandoff.targetDomain}</div>
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* ══════════ DOCK ══════════ */}
      <div className="border-t border-slate-700/30 bg-slate-900/50 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <button
            className={cn(
              "rounded px-2 py-1 text-xs transition-colors",
              context.activeView === "panels"
                ? "bg-slate-700 text-slate-700"
                : "text-slate-500 hover:text-slate-600",
            )}
            onClick={() => onViewChange?.("panels")}
          >
            패널
          </button>
          <button
            className={cn(
              "rounded px-2 py-1 text-xs transition-colors",
              context.activeView === "chain_timeline"
                ? "bg-slate-700 text-slate-700"
                : "text-slate-500 hover:text-slate-600",
            )}
            onClick={() => onViewChange?.("chain_timeline")}
          >
            타임라인
          </button>
        </div>

        <div className="flex items-center gap-2">
          {surface.isFiltered && (
            <button
              className="rounded border border-slate-600/30 bg-transparent px-2 py-1 text-xs text-slate-400 hover:text-slate-700 transition-colors"
              onClick={onFilterReset}
            >
              필터 초기화
            </button>
          )}
          <button
            className="rounded border border-slate-600/30 bg-transparent px-2 py-1 text-xs text-slate-400 hover:text-slate-700 transition-colors"
            onClick={() => onRefresh?.()}
          >
            새로고침
          </button>
        </div>
      </div>
    </div>
  );
}
