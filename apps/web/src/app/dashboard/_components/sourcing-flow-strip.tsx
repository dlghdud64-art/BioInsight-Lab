'use client';

import Link from 'next/link';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  SourcingFlowContext,
  SourcingOrientationStep,
} from '@/lib/ops-console/sourcing-flow-adapter';
import {
  buildSourcingOrientation,
  buildSourcingBlockers,
} from '@/lib/ops-console/sourcing-flow-adapter';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SourcingFlowStripProps {
  flowContext: SourcingFlowContext;
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * SourcingFlowStrip — sourcing flow 전체에서 재사용하는 공통 progress/orientation strip.
 *
 * 표시 내용:
 * - 5단계 progress indicator (search → narrowing → compare → draft → execution)
 * - source context summary
 * - urgency badge
 * - blocker count (있으면)
 * - return path action
 */
export function SourcingFlowStrip({ flowContext, className }: SourcingFlowStripProps) {
  const orientation = buildSourcingOrientation(flowContext);
  const blockers = buildSourcingBlockers(flowContext);

  return (
    <div className={cn('bg-slate-900 border border-slate-800 rounded-lg p-3', className)}>
      {/* Row 1: Return + Source context */}
      <div className="flex items-center gap-2 mb-2 text-xs">
        {flowContext.returnRoute && (
          <Link
            href={flowContext.returnRoute}
            className="flex items-center gap-1 text-slate-400 hover:text-slate-200 transition-colors shrink-0"
          >
            <ArrowLeft className="h-3 w-3" />
            <span className="hidden sm:inline">원본으로</span>
          </Link>
        )}
        <span className="text-slate-500">출처:</span>
        <span className="text-slate-300 font-medium truncate">{orientation.sourceLabel}</span>
        {flowContext.sourceSummary && (
          <>
            <ChevronRight className="h-3 w-3 text-slate-600 shrink-0" />
            <span className="text-slate-400 truncate max-w-[200px]">{flowContext.sourceSummary}</span>
          </>
        )}
        {/* Urgency */}
        <span
          className={cn(
            'ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0',
            flowContext.urgency === '긴급' || flowContext.urgency === 'critical'
              ? 'bg-red-500/10 text-red-400'
              : flowContext.urgency === '높음' || flowContext.urgency === 'high'
                ? 'bg-amber-500/10 text-amber-400'
                : 'bg-slate-700 text-slate-400',
          )}
        >
          {flowContext.urgency}
        </span>
      </div>

      {/* Row 2: Stage progress */}
      <div className="flex items-center gap-1">
        {orientation.steps.map((step, idx) => (
          <div key={step.stage} className="flex items-center gap-1">
            {idx > 0 && (
              <ChevronRight className="h-3 w-3 text-slate-700 shrink-0" />
            )}
            <span
              className={cn(
                'text-[10px] font-medium px-2 py-0.5 rounded whitespace-nowrap',
                step.isCurrent
                  ? step.tone
                  : step.isCompleted
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-slate-800 text-slate-600',
              )}
            >
              {step.label}
            </span>
          </div>
        ))}

        {/* Blocker count */}
        {blockers.length > 0 && (
          <span className="ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 shrink-0">
            차단 {blockers.length}
          </span>
        )}
      </div>

      {/* Row 3: Requested item + recommended path */}
      {flowContext.requestedItemSummary && (
        <div className="flex items-center gap-2 mt-2 text-xs">
          <span className="text-slate-500">요청 품목:</span>
          <span className="text-slate-300 truncate">{flowContext.requestedItemSummary}</span>
          <span
            className={cn(
              'ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0',
              flowContext.recommendedPath === 'quick_quote_create'
                ? 'bg-emerald-500/10 text-emerald-400'
                : flowContext.recommendedPath === 'compare_first'
                  ? 'bg-amber-500/10 text-amber-400'
                  : 'bg-blue-500/10 text-blue-400',
            )}
          >
            {flowContext.recommendedPath === 'quick_quote_create'
              ? '바로 견적'
              : flowContext.recommendedPath === 'compare_first'
                ? '비교 후 진행'
                : '검토 우선'}
          </span>
        </div>
      )}
    </div>
  );
}
