'use client';

import type { ReactNode } from 'react';
import type { CommandSurface } from '@/lib/ops-console/action-model';
import type { OwnershipSummary } from '@/lib/ops-console/ownership-adapter';
import type { AggregatedBlockerView } from '@/lib/ops-console/blocker-adapter';
import { OperationalCommandBar } from './operational-command-bar';
import { OwnershipStrip, DecisionOwnerContext } from './ownership-display';
import { AggregatedBlockerStrip } from './blocker-display';

// ---------------------------------------------------------------------------
// Sub-component types
// ---------------------------------------------------------------------------

export interface InboxContextStripProps {
  /** 어떤 종류의 작업인지 */
  workTypeLabel: string;
  /** 왜 지금 이 화면을 보고 있는지 */
  whyNow: string;
  /** 기한 표시 */
  dueLabel?: string;
  dueTone?: 'normal' | 'due_soon' | 'overdue';
  /** 담당자 */
  owner?: string;
  /** inbox 복귀 경로 */
  returnHref?: string;
}

export interface OperationalHeaderProps {
  /** Entity 제목 */
  title: string;
  /** ID/Reference */
  reference: string;
  /** 주 상태 */
  statusLabel: string;
  statusTone: 'info' | 'warning' | 'danger' | 'success' | 'neutral';
  /** 부 상태 / readiness */
  subStatus?: string;
  /** 핵심 날짜 */
  keyDates?: Array<{ label: string; value: string; tone?: 'normal' | 'due_soon' | 'overdue' }>;
  /** 핵심 당사자 */
  keyParties?: Array<{ label: string; value: string }>;
  /** 위험 뱃지 */
  riskBadges?: string[];
  /** 다음 액션 요약 */
  nextActionSummary?: string;
}

export interface BlockerReviewStripProps {
  blockers: Array<{ label: string; actionable: boolean }>;
  reviewPoints: Array<{ label: string }>;
  warnings: Array<{ label: string }>;
}

export interface DecisionPanelAction {
  label: string;
  onClick: () => void;
  variant: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  disabledReason?: string;
}

export interface DecisionPanelProps {
  readinessSummary: string;
  readinessReady: boolean;
  blockedReasons: string[];
  recommendedAction?: string;
  recommendedOwner?: string;
  handoffTarget?: { label: string; href: string };
  actions: DecisionPanelAction[];
}

export interface MetaRailItem {
  label: string;
  value: string;
  href?: string;
}

export interface MetaRailProps {
  lastUpdated?: string;
  sourceLinks?: MetaRailItem[];
  linkedEntities?: MetaRailItem[];
  recentActivity?: Array<{ label: string; timestamp: string }>;
}

// ---------------------------------------------------------------------------
// InboxContextStrip
// ---------------------------------------------------------------------------

export function InboxContextStrip({
  workTypeLabel,
  whyNow,
  dueLabel,
  dueTone = 'normal',
  owner,
  returnHref = '/dashboard/inbox',
}: InboxContextStripProps) {
  const dueBg =
    dueTone === 'overdue'
      ? 'bg-red-500/10 text-red-400'
      : dueTone === 'due_soon'
        ? 'bg-amber-500/10 text-amber-400'
        : 'bg-slate-700 text-slate-400';

  return (
    <div className="flex items-center gap-3 rounded border border-slate-800 bg-slate-900/50 px-3 py-2 text-xs">
      <a
        href={returnHref}
        className="flex items-center gap-1 text-slate-500 hover:text-slate-600 transition-colors shrink-0"
      >
        <span>←</span>
        <span>작업함</span>
      </a>
      <span className="text-slate-700">|</span>
      <span className="rounded bg-blue-500/10 px-2 py-0.5 text-blue-400 font-medium shrink-0">
        {workTypeLabel}
      </span>
      <span className="text-slate-400 truncate">{whyNow}</span>
      <div className="ml-auto flex items-center gap-2 shrink-0">
        {dueLabel && (
          <span className={`rounded px-2 py-0.5 font-medium ${dueBg}`}>
            {dueLabel}
          </span>
        )}
        {owner && (
          <span className="text-slate-500">
            담당: <span className="text-slate-600">{owner}</span>
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// OperationalHeader
// ---------------------------------------------------------------------------

const STATUS_TONE_STYLES: Record<OperationalHeaderProps['statusTone'], string> = {
  info: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  danger: 'bg-red-500/10 text-red-400 border-red-500/20',
  success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  neutral: 'bg-slate-700 text-slate-600 border-slate-600',
};

export function OperationalHeader({
  title,
  reference,
  statusLabel,
  statusTone,
  subStatus,
  keyDates,
  keyParties,
  riskBadges,
  nextActionSummary,
}: OperationalHeaderProps) {
  return (
    <div className="rounded border border-slate-800 bg-slate-900 p-4">
      {/* Row 1: Title + Status */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold text-slate-900 truncate">{title}</h1>
            <span className="text-xs text-slate-500 shrink-0">{reference}</span>
          </div>
          {subStatus && (
            <p className="mt-0.5 text-xs text-slate-400">{subStatus}</p>
          )}
        </div>
        <span
          className={`shrink-0 rounded border px-2.5 py-1 text-xs font-medium ${STATUS_TONE_STYLES[statusTone]}`}
        >
          {statusLabel}
        </span>
      </div>

      {/* Row 2: Key dates + parties + risk */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
        {keyDates?.map((d) => {
          const dateTone =
            d.tone === 'overdue'
              ? 'text-red-400'
              : d.tone === 'due_soon'
                ? 'text-amber-400'
                : 'text-slate-600';
          return (
            <span key={d.label} className="text-slate-500">
              {d.label}: <span className={dateTone}>{d.value}</span>
            </span>
          );
        })}
        {keyParties?.map((p) => (
          <span key={p.label} className="text-slate-500">
            {p.label}: <span className="text-slate-600">{p.value}</span>
          </span>
        ))}
        {riskBadges?.map((badge) => (
          <span
            key={badge}
            className="rounded bg-red-500/10 px-1.5 py-0.5 text-red-400 text-[10px] font-medium"
          >
            {badge}
          </span>
        ))}
      </div>

      {/* Row 3: Next action */}
      {nextActionSummary && (
        <div className="mt-2 flex items-center gap-1.5 text-xs">
          <span className="text-slate-500">다음:</span>
          <span className="text-blue-400 font-medium">{nextActionSummary}</span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// BlockerReviewStrip
// ---------------------------------------------------------------------------

export function BlockerReviewStrip({
  blockers,
  reviewPoints,
  warnings,
}: BlockerReviewStripProps) {
  const totalIssues = blockers.length + reviewPoints.length + warnings.length;
  if (totalIssues === 0) return null;

  return (
    <div className="rounded border border-slate-800 bg-slate-900/50 p-3">
      <div className="flex items-center gap-3 text-xs mb-2">
        {blockers.length > 0 && (
          <span className="rounded bg-red-500/10 px-2 py-0.5 text-red-400 font-medium">
            차단 {blockers.length}
          </span>
        )}
        {reviewPoints.length > 0 && (
          <span className="rounded bg-amber-500/10 px-2 py-0.5 text-amber-400 font-medium">
            검토 {reviewPoints.length}
          </span>
        )}
        {warnings.length > 0 && (
          <span className="rounded bg-slate-700 px-2 py-0.5 text-slate-400 font-medium">
            주의 {warnings.length}
          </span>
        )}
      </div>
      <div className="space-y-1">
        {blockers.map((b, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
            <span className="text-slate-600">{b.label}</span>
            {b.actionable && (
              <span className="text-blue-400 text-[10px]">조치 가능</span>
            )}
          </div>
        ))}
        {reviewPoints.map((r, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
            <span className="text-slate-600">{r.label}</span>
          </div>
        ))}
        {warnings.map((w, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500 shrink-0" />
            <span className="text-slate-400">{w.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DecisionPanelShell
// ---------------------------------------------------------------------------

const ACTION_VARIANT_STYLES: Record<DecisionPanelAction['variant'], string> = {
  primary: 'bg-blue-600 hover:bg-blue-500 text-white',
  secondary: 'bg-slate-700 hover:bg-slate-600 text-slate-700',
  danger: 'bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/20',
};

export function DecisionPanelShell({
  readinessSummary,
  readinessReady,
  blockedReasons,
  recommendedAction,
  recommendedOwner,
  handoffTarget,
  actions,
}: DecisionPanelProps) {
  return (
    <div className="rounded border border-slate-800 bg-slate-900 p-4 space-y-3">
      <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
        판단 & 조치
      </div>

      {/* Readiness */}
      <div className="flex items-center gap-2 text-xs">
        <span
          className={`w-2 h-2 rounded-full ${readinessReady ? 'bg-emerald-400' : 'bg-amber-400'}`}
        />
        <span className="text-slate-600">{readinessSummary}</span>
      </div>

      {/* Blocked reasons */}
      {blockedReasons.length > 0 && (
        <div className="space-y-1">
          {blockedReasons.map((reason, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
              <span className="text-red-300">{reason}</span>
            </div>
          ))}
        </div>
      )}

      {/* Recommended */}
      {recommendedAction && (
        <div className="text-xs text-slate-400">
          권장: <span className="text-blue-400 font-medium">{recommendedAction}</span>
          {recommendedOwner && (
            <span className="text-slate-500 ml-1">({recommendedOwner})</span>
          )}
        </div>
      )}

      {/* Handoff */}
      {handoffTarget && (
        <div className="text-xs">
          <span className="text-slate-500">다음 단계: </span>
          <a
            href={handoffTarget.href}
            className="text-blue-400 hover:text-blue-300 underline underline-offset-2"
          >
            {handoffTarget.label} →
          </a>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-2 pt-1">
        {actions.map((action, i) => (
          <button
            key={i}
            onClick={action.onClick}
            disabled={action.disabled}
            className={`w-full rounded px-3 py-2 text-sm font-medium transition-colors ${
              action.disabled
                ? 'opacity-50 cursor-not-allowed bg-slate-800 text-slate-500'
                : ACTION_VARIANT_STYLES[action.variant]
            }`}
            title={action.disabledReason}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LinkedEntityMetaRail
// ---------------------------------------------------------------------------

export function LinkedEntityMetaRail({
  lastUpdated,
  sourceLinks,
  linkedEntities,
  recentActivity,
}: MetaRailProps) {
  const hasContent =
    lastUpdated || sourceLinks?.length || linkedEntities?.length || recentActivity?.length;

  if (!hasContent) return null;

  return (
    <div className="rounded border border-slate-800 bg-slate-900/50 p-3 space-y-3 text-xs">
      <div className="font-medium uppercase tracking-wider text-slate-500">
        참조 정보
      </div>

      {lastUpdated && (
        <div className="text-slate-500">
          최종 갱신: <span className="text-slate-400">{lastUpdated}</span>
        </div>
      )}

      {sourceLinks && sourceLinks.length > 0 && (
        <div className="space-y-1">
          <div className="text-slate-500 font-medium">출처</div>
          {sourceLinks.map((link, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="text-slate-500">{link.label}:</span>
              {link.href ? (
                <a href={link.href} className="text-blue-400 hover:text-blue-300">
                  {link.value}
                </a>
              ) : (
                <span className="text-slate-600">{link.value}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {linkedEntities && linkedEntities.length > 0 && (
        <div className="space-y-1">
          <div className="text-slate-500 font-medium">연결</div>
          {linkedEntities.map((entity, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="text-slate-500">{entity.label}:</span>
              {entity.href ? (
                <a href={entity.href} className="text-blue-400 hover:text-blue-300">
                  {entity.value}
                </a>
              ) : (
                <span className="text-slate-600">{entity.value}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {recentActivity && recentActivity.length > 0 && (
        <div className="space-y-1">
          <div className="text-slate-500 font-medium">최근 활동</div>
          {recentActivity.map((act, i) => (
            <div key={i} className="flex items-center justify-between">
              <span className="text-slate-400">{act.label}</span>
              <span className="text-slate-600">{act.timestamp}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DetailStateFallback
// ---------------------------------------------------------------------------

export interface DetailStateFallbackProps {
  type: 'not_found' | 'invalid_state' | 'missing_link' | 'completed' | 'reset_needed';
  entityLabel?: string;
  message?: string;
  nextRoute?: { label: string; href: string };
  onReset?: () => void;
}

export function DetailStateFallback({
  type,
  entityLabel,
  message,
  nextRoute,
  onReset,
}: DetailStateFallbackProps) {
  const configs: Record<DetailStateFallbackProps['type'], { icon: string; title: string; defaultMessage: string }> = {
    not_found: {
      icon: '🔍',
      title: `${entityLabel ?? '항목'}을 찾을 수 없습니다`,
      defaultMessage: '요청한 항목이 존재하지 않거나 삭제되었습니다.',
    },
    invalid_state: {
      icon: '⚠️',
      title: '유효하지 않은 상태',
      defaultMessage: '이 항목의 현재 상태에서는 이 화면을 사용할 수 없습니다.',
    },
    missing_link: {
      icon: '🔗',
      title: '연결된 항목 없음',
      defaultMessage: '필요한 연결 데이터가 누락되어 있습니다.',
    },
    completed: {
      icon: '✅',
      title: '처리 완료',
      defaultMessage: '이 항목의 처리가 완료되었습니다. 다음 단계로 이동하세요.',
    },
    reset_needed: {
      icon: '🔄',
      title: '시나리오 초기화 필요',
      defaultMessage: '데모 데이터가 유효하지 않습니다. 초기화 후 다시 시도하세요.',
    },
  };

  const config = configs[type];

  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] rounded border border-slate-800 bg-slate-900/50 p-8 text-center">
      <div className="text-3xl mb-3">{config.icon}</div>
      <h2 className="text-sm font-semibold text-slate-700 mb-1">{config.title}</h2>
      <p className="text-xs text-slate-400 max-w-sm mb-4">
        {message ?? config.defaultMessage}
      </p>
      <div className="flex gap-2">
        {nextRoute && (
          <a
            href={nextRoute.href}
            className="rounded bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-500 transition-colors"
          >
            {nextRoute.label}
          </a>
        )}
        {onReset && (
          <button
            onClick={onReset}
            className="rounded bg-slate-700 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-600 transition-colors"
          >
            초기화
          </button>
        )}
        <a
          href="/dashboard/inbox"
          className="rounded bg-slate-800 px-4 py-2 text-xs font-medium text-slate-400 hover:bg-slate-700 transition-colors"
        >
          작업함으로 돌아가기
        </a>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// OperationalDetailShell — 6-zone layout
// ---------------------------------------------------------------------------

export interface OperationalDetailShellProps {
  /** A. Inbox context */
  contextStrip?: InboxContextStripProps;
  /** B. Operational header */
  header: OperationalHeaderProps;
  /** B'. Ownership summary (header 하단에 표시) */
  ownership?: OwnershipSummary;
  /** C. Blockers/review (legacy) */
  blockerStrip?: BlockerReviewStripProps;
  /** C'. Aggregated blocker view (new — takes precedence over blockerStrip) */
  blockerView?: AggregatedBlockerView;
  /** D. Primary work area — domain-specific content */
  children: ReactNode;
  /** E. Decision panel (legacy) */
  decisionPanel?: DecisionPanelProps;
  /** E'. Command surface (new — takes precedence over decisionPanel) */
  commandSurface?: CommandSurface;
  /** F. Meta rail */
  metaRail?: MetaRailProps;
}

export function OperationalDetailShell({
  contextStrip,
  header,
  ownership,
  blockerStrip,
  blockerView,
  children,
  decisionPanel,
  commandSurface,
  metaRail,
}: OperationalDetailShellProps) {
  return (
    <div className="space-y-3">
      {/* A. Inbox Context Strip */}
      {contextStrip && <InboxContextStrip {...contextStrip} />}

      {/* B. Operational Header */}
      <OperationalHeader {...header} />

      {/* B'. Ownership Strip */}
      {ownership && (
        <div className="rounded border border-slate-800 bg-slate-900/50 px-4 py-2">
          <OwnershipStrip ownership={ownership} />
        </div>
      )}

      {/* C. Blocker/Review Strip — AggregatedBlockerView takes precedence */}
      {blockerView && blockerView.totalCount > 0
        ? <AggregatedBlockerStrip blockerView={blockerView} />
        : blockerStrip && <BlockerReviewStrip {...blockerStrip} />}

      {/* D+E+F: Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-3">
        {/* D. Primary Work Area */}
        <div className="min-w-0 space-y-3">{children}</div>

        {/* E+F. Sidebar: CommandBar (preferred) or legacy DecisionPanel + Meta */}
        <div className="space-y-3 lg:sticky lg:top-4 lg:self-start">
          {commandSurface
            ? <OperationalCommandBar surface={commandSurface} ownership={ownership} blockerView={blockerView} />
            : decisionPanel && <DecisionPanelShell {...decisionPanel} />}
          {metaRail && <LinkedEntityMetaRail {...metaRail} />}
        </div>
      </div>
    </div>
  );
}
