'use client';

import type {
  AggregatedBlockerView,
  BlockerSummary,
  BlockerSeverity,
} from '@/lib/ops-console/blocker-adapter';
import {
  SEVERITY_LABELS,
  SEVERITY_TONES,
  SEVERITY_DOT_COLORS,
  RESOLUTION_ACTION_LABELS,
} from '@/lib/ops-console/blocker-adapter';

// ---------------------------------------------------------------------------
// BlockerSeveritySection — severity별 blocker 목록
// ---------------------------------------------------------------------------

function BlockerSeveritySection({
  severity,
  blockers,
}: {
  severity: BlockerSeverity;
  blockers: BlockerSummary[];
}) {
  if (blockers.length === 0) return null;
  const tone = SEVERITY_TONES[severity];
  const dotColor = SEVERITY_DOT_COLORS[severity];
  const label = SEVERITY_LABELS[severity];

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${tone}`}>
          {label} {blockers.length}
        </span>
      </div>
      {blockers.map((b) => (
        <div key={b.summaryKey} className="space-y-0.5 pl-0.5">
          <div className="flex items-start gap-2 text-xs">
            <span className={`w-1.5 h-1.5 rounded-full ${dotColor} shrink-0 mt-1`} />
            <div className="min-w-0 space-y-0.5">
              <p className="text-slate-600">{b.whatIsBlocked}</p>
              <p className="text-slate-500 text-[11px]">{b.whyBlocked}</p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px]">
                {/* Resolution hint */}
                <span className="text-blue-400">
                  → {b.whatCanResolveIt}
                </span>
                {/* Resolution owner */}
                {(b.resolutionOwnerName || b.resolutionOwnerRole) && (
                  <span className="text-slate-500">
                    담당: {b.resolutionOwnerName ?? b.resolutionOwnerRole}
                  </span>
                )}
                {/* External wait label */}
                {b.waitingExternalLabel && (
                  <span className="text-purple-400">
                    ⏳ {b.waitingExternalLabel}
                  </span>
                )}
                {/* Escalation */}
                {b.escalationRequired && (
                  <span className="text-red-400 font-medium">에스컬레이션 필요</span>
                )}
              </div>
              {/* Partial continuation */}
              {b.canPartiallyContinue && b.partialContinuationLabel && (
                <p className="text-emerald-400/70 text-[10px]">
                  ▸ {b.partialContinuationLabel}
                </p>
              )}
              {/* After resolution handoff */}
              {b.afterResolutionHandoff && (
                <p className="text-teal-400/60 text-[10px]">
                  해결 후 → {b.afterResolutionHandoff}
                </p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AggregatedBlockerStrip — 전체 blocker view를 severity 구간별로 렌더링
// ---------------------------------------------------------------------------

export interface AggregatedBlockerStripProps {
  blockerView: AggregatedBlockerView;
  /** compact 모드 — sidebar/inbox에서 사용 */
  compact?: boolean;
}

export function AggregatedBlockerStrip({
  blockerView,
  compact = false,
}: AggregatedBlockerStripProps) {
  if (blockerView.totalCount === 0) return null;

  return (
    <div className="rounded border border-slate-800 bg-slate-900/50 p-3 space-y-2.5">
      {/* Header with counts */}
      <div className="flex items-center gap-2 text-xs">
        {blockerView.hardBlocks.length > 0 && (
          <span className="rounded bg-red-500/10 px-2 py-0.5 text-red-400 font-medium">
            차단 {blockerView.hardBlocks.length}
          </span>
        )}
        {blockerView.reviewGates.length > 0 && (
          <span className="rounded bg-amber-500/10 px-2 py-0.5 text-amber-400 font-medium">
            검토 {blockerView.reviewGates.length}
          </span>
        )}
        {blockerView.externalWaits.length > 0 && (
          <span className="rounded bg-purple-500/10 px-2 py-0.5 text-purple-400 font-medium">
            외부 {blockerView.externalWaits.length}
          </span>
        )}
        {blockerView.softWarnings.length > 0 && (
          <span className="rounded bg-slate-700 px-2 py-0.5 text-slate-400 font-medium">
            주의 {blockerView.softWarnings.length}
          </span>
        )}
        {/* Partial continuation indicator */}
        {blockerView.hasHardBlock && blockerView.canPartiallyContinue && (
          <span className="ml-auto text-[10px] text-emerald-400/80">
            부분 진행 가능
          </span>
        )}
      </div>

      {/* Severity sections */}
      {!compact && (
        <div className="space-y-2">
          <BlockerSeveritySection severity="hard_block" blockers={blockerView.hardBlocks} />
          <BlockerSeveritySection severity="review_gate" blockers={blockerView.reviewGates} />
          <BlockerSeveritySection severity="external_wait" blockers={blockerView.externalWaits} />
          <BlockerSeveritySection severity="soft_warning" blockers={blockerView.softWarnings} />
        </div>
      )}

      {/* Compact mode — only show first item per severity */}
      {compact && (
        <div className="space-y-1">
          {[...blockerView.hardBlocks, ...blockerView.reviewGates, ...blockerView.externalWaits, ...blockerView.softWarnings]
            .slice(0, 3)
            .map((b) => (
              <div key={b.summaryKey} className="flex items-center gap-2 text-xs">
                <span className={`w-1.5 h-1.5 rounded-full ${SEVERITY_DOT_COLORS[b.severity]} shrink-0`} />
                <span className="text-slate-600 truncate">{b.whatIsBlocked}</span>
              </div>
            ))}
          {blockerView.totalCount > 3 && (
            <p className="text-[10px] text-slate-500 pl-3.5">
              +{blockerView.totalCount - 3}건 더 있음
            </p>
          )}
        </div>
      )}

      {/* Partial continuation message */}
      {!compact && blockerView.hasHardBlock && blockerView.canPartiallyContinue && blockerView.partialContinuationLabel && (
        <div className="border-t border-slate-800 pt-2 text-xs">
          <span className="text-slate-500">부분 진행: </span>
          <span className="text-emerald-400">{blockerView.partialContinuationLabel}</span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// BlockerCommandHints — command bar 내부에서 blocker 해결 액션 표시
// ---------------------------------------------------------------------------

export interface BlockerCommandHintsProps {
  blockerView: AggregatedBlockerView;
}

export function BlockerCommandHints({ blockerView }: BlockerCommandHintsProps) {
  if (blockerView.totalCount === 0) return null;

  // Collect unique resolution actions from all blockers
  const resolutionActions = [
    ...blockerView.hardBlocks,
    ...blockerView.reviewGates,
    ...blockerView.externalWaits,
  ].map((b) => ({
    key: b.summaryKey,
    severity: b.severity,
    label: b.recommendedResolutionLabel,
    actionType: b.recommendedResolutionAction,
    linkedRoute: b.linkedEntityRoute,
  }));

  if (resolutionActions.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <div className="text-[10px] font-medium uppercase tracking-wider text-slate-600">
        차단 해소 경로
      </div>
      {resolutionActions.map((action) => (
        <div key={action.key} className="flex items-center gap-2 text-xs">
          <span className={`w-1 h-1 rounded-full ${SEVERITY_DOT_COLORS[action.severity]} shrink-0`} />
          {action.linkedRoute ? (
            <a
              href={action.linkedRoute}
              className="text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors"
            >
              {action.label} →
            </a>
          ) : (
            <span className="text-slate-400">{action.label}</span>
          )}
          <span className="text-[10px] text-slate-600">
            ({RESOLUTION_ACTION_LABELS[action.actionType]})
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// InboxBlockerBadge — inbox row에서 compact blocker 심각도 표시
// ---------------------------------------------------------------------------

export interface InboxBlockerBadgeProps {
  blockers: BlockerSummary[];
}

export function InboxBlockerBadge({ blockers }: InboxBlockerBadgeProps) {
  if (blockers.length === 0) return null;

  const hasHard = blockers.some((b) => b.severity === 'hard_block');
  const hasExternal = blockers.some((b) => b.severity === 'external_wait');
  const hasReview = blockers.some((b) => b.severity === 'review_gate');

  const dotColor = hasHard
    ? 'bg-red-400'
    : hasExternal
      ? 'bg-purple-400'
      : hasReview
        ? 'bg-amber-400'
        : 'bg-slate-500';

  const label = hasHard
    ? '차단'
    : hasExternal
      ? '외부 대기'
      : hasReview
        ? '검토 필요'
        : '주의';

  return (
    <div className="flex items-center gap-1">
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
      <span className="text-[10px] text-slate-400">{label}</span>
    </div>
  );
}
