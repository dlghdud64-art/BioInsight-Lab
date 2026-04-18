/**
 * ops-console/sourcing-flow-adapter.ts
 *
 * 소싱 흐름 공통 UI 모델 어댑터.
 * search / compare / quote draft 화면에서 공유하는
 * 소싱 단계, 차단기, orientation strip 데이터를 제공합니다.
 *
 * reentry-context.ts의 ReentryContext를 입력으로 받아
 * UI 렌더링에 필요한 SourcingFlowContext를 생성합니다.
 *
 * @module ops-console/sourcing-flow-adapter
 */

import type {
  ReentryContext,
  ReentrySourceType,
} from './reentry-context';
import {
  buildReentryDecisionSummary,
  SOURCE_TYPE_LABELS,
  URGENCY_LABELS,
} from './reentry-context';

// ---------------------------------------------------------------------------
// 1. Sourcing Flow Stage
// ---------------------------------------------------------------------------

export type SourcingFlowStage =
  | 'search_entry'
  | 'candidate_narrowing'
  | 'compare_gate'
  | 'quote_draft_bootstrap'
  | 'quote_execution';

// ---------------------------------------------------------------------------
// 2. Sourcing Flow Context
// ---------------------------------------------------------------------------

export interface SourcingFlowContext {
  flowStage: SourcingFlowStage;
  sourceType: string; // ReentrySourceType or 'manual'
  sourceSummary: string;
  requestedItemSummary: string;
  urgency: string;
  compareReadyCount: number;
  reviewRequiredCount: number;
  blockedReasonSummary?: string;
  recommendedPath: 'quick_quote_create' | 'compare_first' | 'review_first';
  returnRoute?: string;
  nextRoute?: string;
  nextOwnerName?: string;
}

// ---------------------------------------------------------------------------
// 3. Sourcing Blocker Types
// ---------------------------------------------------------------------------

export type SourcingBlockerType =
  | 'no_compare_ready_candidate'
  | 'blocked_vendor_only'
  | 'required_docs_unclear'
  | 'substitute_review_required'
  | 'budget_context_missing'
  | 'invalid_source_lineage';

export interface SourcingBlocker {
  type: SourcingBlockerType;
  label: string;
  recoveryOptions: { label: string; route: string }[];
}

// ---------------------------------------------------------------------------
// 4. Flow Stage Labels (Korean)
// ---------------------------------------------------------------------------

export const FLOW_STAGE_LABELS: Record<SourcingFlowStage, string> = {
  search_entry: '검색 진입',
  candidate_narrowing: '후보 축소',
  compare_gate: '비교 게이트',
  quote_draft_bootstrap: '견적 초안',
  quote_execution: '견적 실행',
};

// ---------------------------------------------------------------------------
// 5. Flow Stage Order (orientation strip)
// ---------------------------------------------------------------------------

export const FLOW_STAGE_ORDER: SourcingFlowStage[] = [
  'search_entry',
  'candidate_narrowing',
  'compare_gate',
  'quote_draft_bootstrap',
  'quote_execution',
];

// ---------------------------------------------------------------------------
// 6. Flow Stage Tone Classes
// ---------------------------------------------------------------------------

const FLOW_STAGE_TONES: Record<SourcingFlowStage, string> = {
  search_entry: 'bg-slate-700 text-slate-300',
  candidate_narrowing: 'bg-blue-500/10 text-blue-400',
  compare_gate: 'bg-amber-500/10 text-amber-400',
  quote_draft_bootstrap: 'bg-teal-500/10 text-teal-400',
  quote_execution: 'bg-emerald-500/10 text-emerald-400',
};

// ---------------------------------------------------------------------------
// 7. buildSourcingFlowContext
// ---------------------------------------------------------------------------

/**
 * ReentryContext 기반으로 SourcingFlowContext 생성.
 * 재진입 문맥이 없으면 수동 검색 기본값으로 생성.
 */
export function buildSourcingFlowContext(
  stage: SourcingFlowStage,
  reentryCtx?: ReentryContext,
  candidateCount?: number,
  reviewCount?: number,
): SourcingFlowContext {
  // 재진입 없는 수동 검색
  if (!reentryCtx) {
    return {
      flowStage: stage,
      sourceType: 'manual',
      sourceSummary: '수동 카탈로그 검색',
      requestedItemSummary: '',
      urgency: '보통',
      compareReadyCount: candidateCount ?? 0,
      reviewRequiredCount: reviewCount ?? 0,
      recommendedPath: 'quick_quote_create',
    };
  }

  const decision = buildReentryDecisionSummary(reentryCtx);

  // Item summary
  const itemHints = reentryCtx.requestedItemHints;
  let requestedItemSummary = '';
  if (itemHints.length > 0) {
    const first = itemHints[0];
    const parts: string[] = [];
    if (first?.itemName) parts.push(first.itemName);
    if (first?.catalogNumber) parts.push(`Cat# ${first.catalogNumber}`);
    if (first?.quantity && first?.unit) parts.push(`${first.quantity} ${first.unit}`);
    else if (first?.quantity) parts.push(`${first.quantity}개`);
    requestedItemSummary = parts.join(' / ');
    if (itemHints.length > 1) {
      requestedItemSummary += ` 외 ${itemHints.length - 1}건`;
    }
  }

  // Blocked reason summary
  const blockedReasonSummary =
    decision.blockedReasons.length > 0
      ? decision.blockedReasons.join('; ')
      : undefined;

  // Determine next route from stage
  const nextRoute = resolveNextRoute(stage, decision.recommendedEntryPath);

  return {
    flowStage: stage,
    sourceType: reentryCtx.sourceType,
    sourceSummary: reentryCtx.sourceSummary,
    requestedItemSummary,
    urgency: URGENCY_LABELS[reentryCtx.urgency],
    compareReadyCount: candidateCount ?? decision.preferredCandidateCount,
    reviewRequiredCount: reviewCount ?? decision.reviewRequiredCount,
    blockedReasonSummary,
    recommendedPath: decision.quoteCreateMode,
    returnRoute: reentryCtx.returnRoute,
    nextRoute,
    nextOwnerName: decision.nextOwner,
  };
}

// ---------------------------------------------------------------------------
// 8. Resolve next route from stage
// ---------------------------------------------------------------------------

function resolveNextRoute(
  stage: SourcingFlowStage,
  entryPath: string,
): string | undefined {
  switch (stage) {
    case 'search_entry':
      return entryPath === 'compare' ? '/compare' : '/search';
    case 'candidate_narrowing':
      return '/compare';
    case 'compare_gate':
      return '/dashboard/quotes';
    case 'quote_draft_bootstrap':
      return '/dashboard/quotes';
    case 'quote_execution':
      return undefined; // terminal stage
  }
}

// ---------------------------------------------------------------------------
// 9. buildSourcingBlockers
// ---------------------------------------------------------------------------

/**
 * SourcingFlowContext에서 현재 차단기를 추출.
 */
export function buildSourcingBlockers(
  ctx: SourcingFlowContext,
): SourcingBlocker[] {
  const blockers: SourcingBlocker[] = [];

  // No compare-ready candidates
  if (
    ctx.compareReadyCount === 0 &&
    ctx.flowStage !== 'search_entry' &&
    ctx.flowStage !== 'quote_execution'
  ) {
    blockers.push({
      type: 'no_compare_ready_candidate',
      label: '비교 가능한 후보가 없습니다',
      recoveryOptions: [
        { label: '검색 다시 시작', route: '/search' },
        { label: '수동 후보 추가', route: '/compare' },
      ],
    });
  }

  // Blocked vendor only
  if (ctx.blockedReasonSummary?.includes('공급사')) {
    blockers.push({
      type: 'blocked_vendor_only',
      label: '기존 공급사가 모두 제외되었습니다',
      recoveryOptions: [
        { label: '공급사 제약 없이 검색', route: '/search' },
        { label: '신규 공급사 탐색', route: '/search?expand_vendors=true' },
      ],
    });
  }

  // Required docs unclear
  if (ctx.blockedReasonSummary?.includes('문서')) {
    blockers.push({
      type: 'required_docs_unclear',
      label: '필수 문서 요구사항이 불분명합니다',
      recoveryOptions: [
        { label: '문서 요구사항 검토', route: ctx.returnRoute ?? '/dashboard' },
      ],
    });
  }

  // Substitute review required
  if (ctx.reviewRequiredCount > 0 && ctx.recommendedPath === 'review_first') {
    blockers.push({
      type: 'substitute_review_required',
      label: `대체품 검토 ${ctx.reviewRequiredCount}건 필요`,
      recoveryOptions: [
        { label: '대체품 검토', route: '/compare' },
      ],
    });
  }

  // Budget context missing
  if (ctx.blockedReasonSummary?.includes('예산')) {
    blockers.push({
      type: 'budget_context_missing',
      label: '예산 컨텍스트가 연결되지 않았습니다',
      recoveryOptions: [
        { label: '예산 확인', route: '/dashboard/budget' },
        { label: '예산 없이 진행', route: ctx.nextRoute ?? '/dashboard/quotes' },
      ],
    });
  }

  // Invalid source lineage
  if (ctx.blockedReasonSummary?.includes('엔티티')) {
    blockers.push({
      type: 'invalid_source_lineage',
      label: '원본 엔티티 추적이 불가합니다',
      recoveryOptions: [
        { label: '수동 검색으로 전환', route: '/search' },
      ],
    });
  }

  return blockers;
}

// ---------------------------------------------------------------------------
// 10. Sourcing Orientation Data
// ---------------------------------------------------------------------------

export interface SourcingOrientationStep {
  stage: SourcingFlowStage;
  label: string;
  tone: string;
  isCurrent: boolean;
  isCompleted: boolean;
  isUpcoming: boolean;
}

export interface SourcingOrientation {
  steps: SourcingOrientationStep[];
  currentStageLabel: string;
  sourceLabel: string;
  urgencyLabel: string;
  blockerCount: number;
}

/**
 * Orientation strip 데이터 생성.
 * 현재 stage 기준으로 각 단계의 완료/현재/예정 상태를 표시.
 */
export function buildSourcingOrientation(
  flowCtx: SourcingFlowContext,
): SourcingOrientation {
  const currentIndex = FLOW_STAGE_ORDER.indexOf(flowCtx.flowStage);
  const blockers = buildSourcingBlockers(flowCtx);

  const steps: SourcingOrientationStep[] = FLOW_STAGE_ORDER.map(
    (stage, index) => ({
      stage,
      label: FLOW_STAGE_LABELS[stage],
      tone: index === currentIndex
        ? FLOW_STAGE_TONES[stage]
        : index < currentIndex
          ? 'bg-emerald-500/10 text-emerald-400'
          : 'bg-slate-800 text-slate-500',
      isCurrent: index === currentIndex,
      isCompleted: index < currentIndex,
      isUpcoming: index > currentIndex,
    }),
  );

  // Source label
  const sourceLabel =
    flowCtx.sourceType === 'manual'
      ? '수동 검색'
      : SOURCE_TYPE_LABELS[flowCtx.sourceType as ReentrySourceType] ?? flowCtx.sourceType;

  return {
    steps,
    currentStageLabel: FLOW_STAGE_LABELS[flowCtx.flowStage],
    sourceLabel,
    urgencyLabel: flowCtx.urgency,
    blockerCount: blockers.length,
  };
}
