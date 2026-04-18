'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  buildNavigationContext,
  readNavigationParams,
  buildOrientationData,
  type OrientationData,
} from '@/lib/ops-console/navigation-context';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface OrientationStripProps {
  /** Override entity label (detail pages set this) */
  entityLabel?: string;
  /** Override entity id */
  entityId?: string;
  /** Additional className */
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * OrientationStrip — 모든 주요 화면의 상단에 배치되는 공통 위치/문맥 표시.
 *
 * 표시 내용:
 * - 현재 모듈 > 화면 역할 > entity context
 * - origin context (있으면)
 * - return path action
 *
 * Hub 화면에서는 return action을 숨긴다.
 * Direct route 진입 시에도 fallback orientation을 보여준다.
 */
export function OrientationStrip({ entityLabel, entityId, className }: OrientationStripProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const navParams = readNavigationParams(searchParams);
  const navContext = buildNavigationContext(pathname, {
    entityId,
    entityLabel,
    originType: navParams.originType,
    originRoute: navParams.originRoute,
    originSummary: navParams.originSummary,
    returnRoute: navParams.returnRoute,
    returnLabel: navParams.returnLabel,
    activeQueueFilter: navParams.activeQueueFilter,
  });

  const orientation: OrientationData = buildOrientationData(navContext, pathname);

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 text-xs text-slate-500 min-h-[28px] px-1',
        className,
      )}
    >
      {/* Return action */}
      {orientation.returnAction && (
        <Link
          href={orientation.returnAction.href}
          className="flex items-center gap-1 text-slate-400 hover:text-slate-700 transition-colors mr-2 shrink-0"
        >
          <ArrowLeft className="h-3 w-3" />
          <span className="hidden sm:inline">{orientation.returnAction.label}</span>
        </Link>
      )}

      {/* Module */}
      <span className="text-slate-400 font-medium shrink-0">{orientation.moduleLabel}</span>

      {/* Screen role */}
      {orientation.roleLabel && (
        <>
          <ChevronRight className="h-3 w-3 text-slate-600 shrink-0" />
          <span className="shrink-0">{orientation.roleLabel}</span>
        </>
      )}

      {/* Entity label */}
      {orientation.entityLabel && (
        <>
          <ChevronRight className="h-3 w-3 text-slate-600 shrink-0" />
          <span className="text-slate-600 font-medium truncate max-w-[200px]">
            {orientation.entityLabel}
          </span>
        </>
      )}

      {/* Origin context */}
      {orientation.originSummary && (
        <span className="ml-2 text-slate-600 truncate max-w-[200px] hidden md:inline">
          — {orientation.originSummary}
        </span>
      )}
    </div>
  );
}
