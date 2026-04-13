"use client";

/**
 * Organization Overview Hub — Block Wrapper + Presentational Blocks
 *
 * 공통 wrapper로 title/helper/body/footer 구조 통일.
 * block-level loading/empty/unavailable/normal 상태 처리.
 */

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import type { BlockProps as BlockStateProps } from "@/lib/review-queue/ops-hub-block-states";
import type {
  OverviewKpiCardViewModel,
  StepFunnelStageViewModel,
  AlertItemViewModel,
  WorkQueueSectionViewModel,
  ApprovalInboxBlockViewModel,
  ActivityFeedItemViewModel,
  QuickLinkItemViewModel,
  KpiTone,
} from "@/lib/review-queue/ops-hub-view-models";

// ═══════════════════════════════════════════════════
// Block Wrapper (공통)
// ═══════════════════════════════════════════════════

interface BlockWrapperProps {
  title: string;
  helperText?: string;
  state: BlockStateProps;
  children: React.ReactNode;
  minHeight?: number;
}

export function BlockWrapper({ title, helperText, state, children, minHeight }: BlockWrapperProps) {
  return (
    <section style={{ minHeight: minHeight ? `${minHeight}px` : undefined }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        {helperText && <span className="text-[10px] text-slate-500">{helperText}</span>}
      </div>

      {state.uiState === "loading" && (
        <div className="bg-pn border border-bd rounded-lg p-6 flex items-center justify-center gap-2 text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-xs">{state.loadingMessage}</span>
        </div>
      )}

      {state.uiState === "empty" && (
        <p className="text-xs text-slate-500 bg-pn border border-bd rounded-lg p-4">{state.emptyMessage}</p>
      )}

      {state.uiState === "unavailable" && (
        <div className="bg-pn border border-bd rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-xs text-slate-400">{state.unavailableMessage}</span>
          </div>
          {state.onRetry && (
            <button onClick={state.onRetry} className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 transition-colors">
              <RefreshCw className="h-3 w-3" />
              {state.retryCta}
            </button>
          )}
        </div>
      )}

      {state.uiState === "normal" && children}
    </section>
  );
}

// ═══════════════════════════════════════════════════
// KPI Grid
// ═══════════════════════════════════════════════════

const TONE_COLORS: Record<KpiTone, string> = {
  green: "text-emerald-400",
  amber: "text-amber-400",
  red: "text-red-400",
  blue: "text-blue-400",
  slate: "text-slate-400",
};

export function OverviewKpiGrid({ kpis }: { kpis: OverviewKpiCardViewModel[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {kpis.map((k) => (
        <div key={k.key} className="bg-pn border border-bd rounded-xl p-3.5">
          <span className="text-[11px] font-medium text-slate-400 block mb-2">{k.title}</span>
          <div className="text-2xl font-bold text-slate-900 mb-1">{k.value}</div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500 truncate pr-2">{k.description}</span>
            <span className={`text-[10px] font-medium shrink-0 ${TONE_COLORS[k.tone]}`}>{k.statusLabel}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// Step Funnel Block
// ═══════════════════════════════════════════════════

export function StepFunnelBlock({ stages }: { stages: StepFunnelStageViewModel[] }) {
  return (
    <section>
      <h3 className="text-sm font-bold text-slate-900 mb-3">작업 흐름 요약</h3>
      <div className="grid md:grid-cols-3 gap-3">
        {stages.map((s) => (
          <div key={s.key} className="bg-pn border border-bd rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-600">{s.title}</span>
              <span className="text-xl font-bold text-slate-900">{s.count}</span>
            </div>
            <p className="text-[11px] text-slate-500 mb-1">{s.description}</p>
            <p className="text-[10px] text-slate-500 mb-3">{s.subStatus}</p>
            <Button asChild variant="outline" size="sm" className="h-7 text-[11px] w-full border-bd">
              <Link href={s.linkHref}>{s.ctaLabel} <ArrowRight className="h-3 w-3 ml-1" /></Link>
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════
// Alerts Block
// ═══════════════════════════════════════════════════

const SEVERITY_STYLES: Record<string, { badge: string; border: string }> = {
  urgent: { badge: "bg-red-500/10 text-red-400", border: "border-red-500/30" },
  warning: { badge: "bg-amber-500/10 text-amber-400", border: "border-amber-500/30" },
  info: { badge: "bg-blue-500/10 text-blue-400", border: "border-bd" },
};

export function AlertsBlockContent({ items }: { items: AlertItemViewModel[] }) {
  return (
    <div className="space-y-2">
      {items.map((alert) => {
        const style = SEVERITY_STYLES[alert.severity] ?? SEVERITY_STYLES.info;
        return (
          <div key={alert.id} className={`bg-pn border rounded-lg p-3 flex items-center justify-between ${style.border}`}>
            <div className="flex items-center gap-3">
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${style.badge}`}>
                {alert.severityLabel}
              </span>
              <div>
                <p className="text-xs font-medium text-slate-700">{alert.title}</p>
                <p className="text-[10px] text-slate-500">{alert.description}</p>
              </div>
            </div>
            <Button asChild variant="ghost" size="sm" className="h-7 text-[11px] text-slate-400 hover:text-slate-700">
              <Link href={alert.linkHref}>{alert.ctaLabel} <ArrowRight className="h-3 w-3 ml-1" /></Link>
            </Button>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// Work Queue Block
// ═══════════════════════════════════════════════════

export function WorkQueueBlockContent({ sections }: { sections: WorkQueueSectionViewModel[] }) {
  return (
    <div className="grid md:grid-cols-2 gap-3">
      {sections.map((s) => (
        <div key={s.id} className="bg-pn border border-bd rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-700">{s.title}</span>
            <Badge variant="secondary" className="bg-el text-slate-600 text-[10px]">{s.count}</Badge>
          </div>
          <p className="text-[10px] text-slate-500 mb-2">{s.description}</p>
          {s.details.length > 0 && (
            <div className="space-y-1 mb-3">
              {s.details.map((d, i) => (
                <div key={i} className="flex items-center justify-between text-[10px]">
                  <span className="text-slate-400">{d.label}</span>
                  <span className="text-slate-600 font-medium">{d.count}건</span>
                </div>
              ))}
            </div>
          )}
          <Button asChild variant="outline" size="sm" className="h-7 text-[11px] w-full border-bd">
            <Link href={s.linkHref}>{s.ctaLabel} <ArrowRight className="h-3 w-3 ml-1" /></Link>
          </Button>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// Approval Inbox Block
// ═══════════════════════════════════════════════════

export function ApprovalInboxBlockContent({ inbox }: { inbox: ApprovalInboxBlockViewModel }) {
  return (
    <div className="grid md:grid-cols-3 gap-3">
      <div className="bg-pn border border-bd rounded-xl p-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-slate-700">내가 처리할 승인</span>
          <span className="text-lg font-bold text-slate-900">{inbox.pendingCount}</span>
        </div>
        <p className="text-[10px] text-slate-500 mb-3">{inbox.pendingDescription}</p>
        <Button variant="outline" size="sm" className="h-7 text-[11px] w-full border-bd">전체 승인 요청 보기</Button>
      </div>
      <div className="bg-pn border border-bd rounded-xl p-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-slate-700">내가 올린 요청</span>
          <span className="text-lg font-bold text-slate-900">{inbox.myRequestsCount}</span>
        </div>
        <p className="text-[10px] text-slate-500 mb-3">{inbox.myRequestsDescription}</p>
        <Button variant="outline" size="sm" className="h-7 text-[11px] w-full border-bd">내 요청 보기</Button>
      </div>
      <div className="bg-pn border border-bd rounded-xl p-4">
        <span className="text-xs font-medium text-slate-700 block mb-2">최근 승인 결과</span>
        {inbox.recentDecisions.length === 0 ? (
          <p className="text-[10px] text-slate-500">최근 승인/반려 기록 없음</p>
        ) : (
          <div className="space-y-1.5">
            {inbox.recentDecisions.slice(0, 3).map((d) => (
              <div key={d.id} className="flex items-center justify-between text-[10px]">
                <span className="text-slate-400 truncate">{d.action}</span>
                <span className={d.state === "approved" ? "text-emerald-400" : "text-red-400"}>{d.stateLabel}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// Activity Feed Block
// ═══════════════════════════════════════════════════

export function ActivityFeedBlockContent({ items }: { items: ActivityFeedItemViewModel[] }) {
  return (
    <div className="bg-pn border border-bd rounded-xl divide-y divide-bd">
      {items.slice(0, 8).map((item) => (
        <div key={item.id} className="px-4 py-2.5">
          <p className="text-xs text-slate-700">{item.action}</p>
          <p className="text-[10px] text-slate-500">{item.actor} · {item.timeFormatted}</p>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// Quick Links Block
// ═══════════════════════════════════════════════════

export function QuickLinksBlock({ links }: { links: QuickLinkItemViewModel[] }) {
  return (
    <section>
      <h3 className="text-sm font-bold text-slate-900 mb-3">빠른 이동</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {links.map((link) => (
          <Button key={link.href} asChild variant="outline" size="sm" className="h-8 text-[11px] border-bd justify-start">
            <Link href={link.href}>{link.label} <ArrowRight className="h-3 w-3 ml-auto" /></Link>
          </Button>
        ))}
      </div>
    </section>
  );
}
