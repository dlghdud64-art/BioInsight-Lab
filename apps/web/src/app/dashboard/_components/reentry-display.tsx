'use client';

import type {
  ReentryContext,
  ReentryDecisionSummary,
  ReentryFallback,
  QuoteBootstrapSummary,
} from '@/lib/ops-console/reentry-context';
import {
  SOURCE_TYPE_LABELS,
  SOURCE_TYPE_TONES,
  URGENCY_LABELS,
  URGENCY_TONES,
  ENTRY_PATH_LABELS,
  QUOTE_CREATE_MODE_LABELS,
  buildReentryDecisionSummary,
  buildReentryCommand,
  checkReentryFallbacks,
} from '@/lib/ops-console/reentry-context';

// ---------------------------------------------------------------------------
// 1. ReentryContextStrip — 검색/비교 화면 상단에 표시하는 운영 문맥
// ---------------------------------------------------------------------------

export interface ReentryContextStripProps {
  context: ReentryContext;
  /** 소스로 돌아가기 */
  onReturn?: () => void;
}

export function ReentryContextStrip({ context, onReturn }: ReentryContextStripProps) {
  const decision = buildReentryDecisionSummary(context);
  const sourceLabel = SOURCE_TYPE_LABELS[context.sourceType];
  const sourceTone = SOURCE_TYPE_TONES[context.sourceType];
  const urgencyLabel = URGENCY_LABELS[context.urgency];
  const urgencyTone = URGENCY_TONES[context.urgency];

  return (
    <div className="rounded border border-slate-800 bg-slate-900/50 px-3 py-2.5 space-y-1.5">
      {/* Row 1: Source + Urgency + Return */}
      <div className="flex items-center gap-2 text-xs">
        {context.returnRoute && (
          <>
            <a
              href={context.returnRoute}
              onClick={(e) => {
                if (onReturn) {
                  e.preventDefault();
                  onReturn();
                }
              }}
              className="flex items-center gap-1 text-slate-500 hover:text-slate-300 transition-colors shrink-0"
            >
              <span>←</span>
              <span>복귀</span>
            </a>
            <span className="text-slate-700">|</span>
          </>
        )}
        <span className={`rounded px-2 py-0.5 font-medium shrink-0 ${sourceTone}`}>
          {sourceLabel}
        </span>
        {context.urgency !== 'normal' && context.urgency !== 'low' && (
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${urgencyTone}`}>
            {urgencyLabel}
          </span>
        )}
        <span className="text-slate-400 truncate">{context.sourceSummary}</span>
      </div>

      {/* Row 2: Item hints + constraints */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
        {context.requestedItemHints.slice(0, 2).map((hint, i) => (
          <span key={i} className="text-slate-300">
            {hint.itemName}
            {hint.quantity ? ` × ${hint.quantity}${hint.unit ? ` ${hint.unit}` : ''}` : ''}
          </span>
        ))}
        {context.requestedItemHints.length > 2 && (
          <span className="text-slate-500">+{context.requestedItemHints.length - 2}건</span>
        )}
        {context.preferredVendorId && (
          <span className="text-teal-400">선호: {context.preferredVendorId}</span>
        )}
        {context.blockedVendorIds && context.blockedVendorIds.length > 0 && (
          <span className="text-red-400/70">제외: {context.blockedVendorIds.length}곳</span>
        )}
        {!context.substituteAllowed && (
          <span className="text-amber-400/70">동일 품목만</span>
        )}
        {context.requiredDocuments && context.requiredDocuments.length > 0 && (
          <span className="text-blue-400/70">필수 문서: {context.requiredDocuments.join(', ')}</span>
        )}
      </div>

      {/* Row 3: Decision summary */}
      <div className="flex items-center gap-2 text-[10px] text-slate-500">
        <span>추천: {ENTRY_PATH_LABELS[decision.recommendedEntryPath]}</span>
        <span>·</span>
        <span>{QUOTE_CREATE_MODE_LABELS[decision.quoteCreateMode]}</span>
        {decision.blockedReasons.length > 0 && (
          <>
            <span>·</span>
            <span className="text-amber-400">{decision.blockedReasons[0]}</span>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. ReentryDecisionPanel — compare/detail sidebar에서 재진입 판단 표시
// ---------------------------------------------------------------------------

export interface ReentryDecisionPanelProps {
  context: ReentryContext;
}

export function ReentryDecisionPanel({ context }: ReentryDecisionPanelProps) {
  const decision = buildReentryDecisionSummary(context);
  const fallbacks = checkReentryFallbacks(context);
  const command = buildReentryCommand(context);

  const readinessColor = decision.reentryReadiness === 'ready'
    ? 'bg-emerald-400'
    : decision.reentryReadiness === 'needs_review'
      ? 'bg-amber-400'
      : 'bg-red-400';

  return (
    <div className="rounded border border-slate-800 bg-slate-900 p-3 space-y-2.5 text-xs">
      <div className="font-medium uppercase tracking-wider text-slate-500 text-[10px]">
        재진입 판단
      </div>

      {/* Readiness */}
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${readinessColor}`} />
        <span className="text-slate-300">{decision.reasonSummary}</span>
      </div>

      {/* Blocked reasons */}
      {decision.blockedReasons.length > 0 && (
        <div className="space-y-1">
          {decision.blockedReasons.map((reason, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
              <span className="text-red-300">{reason}</span>
            </div>
          ))}
        </div>
      )}

      {/* Entry action */}
      <a
        href={command.href}
        className={`block w-full rounded px-3 py-2 text-center text-sm font-medium transition-colors ${
          decision.reentryReadiness === 'blocked'
            ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-500 text-white'
        }`}
      >
        {command.label}
      </a>

      {/* Quote create mode hint */}
      <p className="text-[10px] text-slate-500">
        → {QUOTE_CREATE_MODE_LABELS[decision.quoteCreateMode]}
        {decision.returnRoute && (
          <span className="ml-2">
            <a href={decision.returnRoute} className="text-blue-400/70 hover:text-blue-300">
              소스로 복귀 →
            </a>
          </span>
        )}
      </p>

      {/* Fallbacks */}
      {fallbacks.length > 0 && (
        <div className="border-t border-slate-800 pt-2 space-y-1">
          <div className="text-[10px] font-medium text-slate-600 uppercase tracking-wider">대안 경로</div>
          {fallbacks.map((fb, i) => (
            <div key={i} className="text-[11px]">
              <span className="text-slate-400">{fb.reason}</span>
              {fb.alternativePath && (
                <a
                  href={fb.alternativePath}
                  className="ml-2 text-blue-400/70 hover:text-blue-300 underline underline-offset-2"
                >
                  {fb.alternativeLabel} →
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3. ReentryActionButton — detail/inbox에서 인라인 re-entry 버튼
// ---------------------------------------------------------------------------

export interface ReentryActionButtonProps {
  context: ReentryContext;
  compact?: boolean;
}

export function ReentryActionButton({ context, compact = false }: ReentryActionButtonProps) {
  const command = buildReentryCommand(context);
  const urgencyTone = URGENCY_TONES[context.urgency];

  if (compact) {
    return (
      <a
        href={command.href}
        className="text-xs text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors"
      >
        {command.label} →
      </a>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <a
        href={command.href}
        className="rounded bg-slate-700 hover:bg-slate-600 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors"
      >
        {command.label}
      </a>
      {context.urgency !== 'normal' && context.urgency !== 'low' && (
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${urgencyTone}`}>
          {URGENCY_LABELS[context.urgency]}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 4. QuoteBootstrapBanner — quote draft가 운영 문맥을 가진 상태 표시
// ---------------------------------------------------------------------------

export interface QuoteBootstrapBannerProps {
  bootstrap: QuoteBootstrapSummary;
}

export function QuoteBootstrapBanner({ bootstrap }: QuoteBootstrapBannerProps) {
  const sourceTone = SOURCE_TYPE_TONES[bootstrap.sourceType];
  const sourceLabel = SOURCE_TYPE_LABELS[bootstrap.sourceType];

  return (
    <div className="rounded border border-blue-500/20 bg-blue-500/5 px-3 py-2.5 space-y-1.5">
      <div className="flex items-center gap-2 text-xs">
        <span className={`rounded px-2 py-0.5 font-medium ${sourceTone}`}>
          {sourceLabel}
        </span>
        <span className="text-slate-400 truncate">{bootstrap.operationalNote}</span>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
        {bootstrap.itemHints.slice(0, 3).map((hint, i) => (
          <span key={i} className="text-slate-300">
            {hint.itemName}
            {hint.quantity ? ` × ${hint.quantity}${hint.unit ? ` ${hint.unit}` : ''}` : ''}
          </span>
        ))}
        {bootstrap.vendorShortlistIds.length > 0 && (
          <span className="text-teal-400">공급사 {bootstrap.vendorShortlistIds.length}곳 추천</span>
        )}
        {bootstrap.excludedVendorIds.length > 0 && (
          <span className="text-red-400/70">제외 {bootstrap.excludedVendorIds.length}곳</span>
        )}
        {!bootstrap.substituteAllowed && (
          <span className="text-amber-400/70">동일 품목만</span>
        )}
        {bootstrap.requiredDocuments.length > 0 && (
          <span className="text-blue-400/70">문서: {bootstrap.requiredDocuments.join(', ')}</span>
        )}
        {bootstrap.linkedInventoryItemId && (
          <span className="text-slate-500">재고 연결: {bootstrap.linkedInventoryItemId}</span>
        )}
      </div>

      <div className="flex items-center gap-2 text-[10px]">
        <a
          href={bootstrap.linkedSourceRoute}
          className="text-blue-400/70 hover:text-blue-300 underline underline-offset-2"
        >
          소스 확인 →
        </a>
        {URGENCY_LABELS[bootstrap.urgency] !== '보통' && (
          <span className={`rounded px-1 py-0.5 ${URGENCY_TONES[bootstrap.urgency]}`}>
            {URGENCY_LABELS[bootstrap.urgency]}
          </span>
        )}
      </div>
    </div>
  );
}
