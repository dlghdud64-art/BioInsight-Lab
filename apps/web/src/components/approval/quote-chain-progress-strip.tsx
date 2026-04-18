"use client";

/**
 * QuoteChainProgressStrip — 13-stage procurement chain 시각화
 *
 * CLAUDE.md 규칙:
 * - PO Conversion 뒤에 PO Created / Dispatch Prep stage 이어짐
 * - 다음 확장 슬롯(Sent / Supplier Confirmed / Receiving Prep) 깨지지 않게 구조 열어둠
 * - governance-grammar-registry CHAIN_STAGE_GRAMMAR과 정렬
 * - center = judgment, rail = reference, dock = execution 분리 유지
 *
 * Phase 구조:
 * sourcing → approval → dispatch → fulfillment → inventory
 */

import * as React from "react";
import { cn } from "@/lib/utils";

// ══════════════════════════════════════════════
// Stage Definition (governance grammar 정렬)
// ══════════════════════════════════════════════

export type ChainStageKey =
  // Sourcing
  | "quote_review"
  | "quote_shortlist"
  // Approval
  | "quote_approval"
  | "po_conversion"
  | "po_approval"
  // Dispatch
  | "po_send_readiness"
  | "po_created"
  | "dispatch_prep"
  | "sent"
  // Fulfillment
  | "supplier_confirmed"
  | "receiving_prep"
  // Inventory
  | "stock_release"
  | "reorder_decision";

export type ChainPhase = "sourcing" | "approval" | "dispatch" | "fulfillment" | "inventory";

export type StageStatus = "completed" | "current" | "upcoming" | "blocked" | "skipped";

export interface ChainStageConfig {
  key: ChainStageKey;
  shortLabel: string;
  phase: ChainPhase;
  order: number;
}

const STAGE_CONFIGS: readonly ChainStageConfig[] = [
  { key: "quote_review",       shortLabel: "검토",    phase: "sourcing",    order: 0 },
  { key: "quote_shortlist",    shortLabel: "선정",    phase: "sourcing",    order: 1 },
  { key: "quote_approval",     shortLabel: "견적승인", phase: "approval",    order: 2 },
  { key: "po_conversion",      shortLabel: "PO전환",   phase: "approval",    order: 3 },
  { key: "po_approval",        shortLabel: "PO승인",   phase: "approval",    order: 4 },
  { key: "po_send_readiness",  shortLabel: "발송준비", phase: "dispatch",    order: 5 },
  { key: "po_created",         shortLabel: "PO생성",   phase: "dispatch",    order: 6 },
  { key: "dispatch_prep",      shortLabel: "발송검증", phase: "dispatch",    order: 7 },
  { key: "sent",               shortLabel: "발송완료", phase: "dispatch",    order: 8 },
  { key: "supplier_confirmed", shortLabel: "공급확인", phase: "fulfillment", order: 9 },
  { key: "receiving_prep",     shortLabel: "입고준비", phase: "fulfillment", order: 10 },
  { key: "stock_release",      shortLabel: "릴리즈",   phase: "inventory",   order: 11 },
  { key: "reorder_decision",   shortLabel: "재주문",   phase: "inventory",   order: 12 },
] as const;

// ══════════════════════════════════════════════
// Phase colors
// ══════════════════════════════════════════════

const PHASE_COLORS: Record<ChainPhase, { bg: string; border: string; text: string; label: string }> = {
  sourcing:    { bg: "bg-blue-500/10",    border: "border-blue-500/20",    text: "text-blue-400",    label: "소싱" },
  approval:    { bg: "bg-violet-500/10",  border: "border-violet-500/20",  text: "text-violet-400",  label: "승인" },
  dispatch:    { bg: "bg-amber-500/10",   border: "border-amber-500/20",   text: "text-amber-400",   label: "발송" },
  fulfillment: { bg: "bg-emerald-500/10", border: "border-emerald-500/20", text: "text-emerald-400", label: "이행" },
  inventory:   { bg: "bg-cyan-500/10",    border: "border-cyan-500/20",    text: "text-cyan-400",    label: "재고" },
};

const STATUS_STYLES: Record<StageStatus, { dot: string; label: string; connector: string }> = {
  completed: { dot: "bg-emerald-500", label: "text-slate-400",   connector: "bg-emerald-500/40" },
  current:   { dot: "bg-blue-500",    label: "text-white",       connector: "bg-slate-700" },
  upcoming:  { dot: "bg-slate-700",   label: "text-slate-600",   connector: "bg-slate-800" },
  blocked:   { dot: "bg-red-500",     label: "text-red-400",     connector: "bg-red-500/20" },
  skipped:   { dot: "bg-slate-800",   label: "text-slate-700",   connector: "bg-slate-800" },
};

// ══════════════════════════════════════════════
// Props
// ══════════════════════════════════════════════

export interface QuoteChainProgressStripProps {
  /** 현재 active stage */
  currentStage: ChainStageKey;
  /** stage별 status override (기본: currentStage 기준 자동 계산) */
  stageStatuses?: Partial<Record<ChainStageKey, StageStatus>>;
  /** 표시할 stage 범위 (기본: 전체) */
  visibleStages?: ChainStageKey[];
  /** compact 모드 (shortLabel 숨김) */
  compact?: boolean;
  /** stage 클릭 핸들러 */
  onStageClick?: (stage: ChainStageKey) => void;
  className?: string;
}

// ══════════════════════════════════════════════
// Helper
// ══════════════════════════════════════════════

function resolveStageStatuses(
  currentStage: ChainStageKey,
  overrides?: Partial<Record<ChainStageKey, StageStatus>>,
): Record<ChainStageKey, StageStatus> {
  const currentOrder = STAGE_CONFIGS.find(s => s.key === currentStage)?.order ?? 0;
  const result: Record<string, StageStatus> = {};

  for (const stage of STAGE_CONFIGS) {
    if (overrides?.[stage.key]) {
      result[stage.key] = overrides[stage.key]!;
    } else if (stage.order < currentOrder) {
      result[stage.key] = "completed";
    } else if (stage.order === currentOrder) {
      result[stage.key] = "current";
    } else {
      result[stage.key] = "upcoming";
    }
  }

  return result as Record<ChainStageKey, StageStatus>;
}

// ══════════════════════════════════════════════
// Component
// ══════════════════════════════════════════════

export function QuoteChainProgressStrip({
  currentStage,
  stageStatuses,
  visibleStages,
  compact = false,
  onStageClick,
  className,
}: QuoteChainProgressStripProps) {
  const resolved = resolveStageStatuses(currentStage, stageStatuses);
  const stages = visibleStages
    ? STAGE_CONFIGS.filter(s => visibleStages.includes(s.key))
    : STAGE_CONFIGS;

  // Phase group boundaries
  let lastPhase: ChainPhase | null = null;

  return (
    <div
      role="navigation"
      aria-label="구매 진행 단계"
      className={cn(
        // 모바일: 가로 스크롤 가능한 strip (snap-x 로 스와이프 UX)
        "flex items-center gap-0 overflow-x-auto snap-x scrollbar-none",
        // 모바일 터치 영역 확보
        "py-1 -my-1",
        className,
      )}>
      {stages.map((stage, idx) => {
        const status = resolved[stage.key];
        const styles = STATUS_STYLES[status];
        const phaseColors = PHASE_COLORS[stage.phase];
        const isNewPhase = stage.phase !== lastPhase;
        lastPhase = stage.phase;

        return (
          <React.Fragment key={stage.key}>
            {/* Phase divider */}
            {isNewPhase && idx > 0 && (
              <div className="mx-0.5 md:mx-1 h-4 w-px bg-slate-800 shrink-0" />
            )}

            {/* Connector line (between stages in same phase) */}
            {!isNewPhase && idx > 0 && (
              <div className={cn("h-0.5 w-2 md:w-3 shrink-0", styles.connector)} />
            )}

            {/* Stage node — 모바일: 더 큰 터치 타겟 */}
            <button
              type="button"
              onClick={() => onStageClick?.(stage.key)}
              disabled={!onStageClick}
              aria-current={status === "current" ? "step" : undefined}
              aria-label={`${stage.shortLabel} (${status})`}
              className={cn(
                "flex items-center gap-1 md:gap-1.5 px-1.5 md:px-1.5 py-1.5 md:py-1 rounded transition-colors shrink-0 snap-start",
                // 모바일 터치 타겟: 최소 40px 높이
                "min-h-[36px] md:min-h-0",
                onStageClick && "hover:bg-slate-800/50 cursor-pointer active:scale-95",
                !onStageClick && "cursor-default",
                status === "current" && cn(phaseColors.bg, phaseColors.border, "border"),
              )}
            >
              {/* Dot indicator */}
              <span className={cn(
                "h-2 w-2 rounded-full shrink-0",
                styles.dot,
                status === "current" && "ring-2 ring-offset-1 ring-offset-slate-950 ring-blue-500/30",
              )} />

              {/* Label — 모바일에서도 표시하되 약간 큰 text */}
              {!compact && (
                <span className={cn(
                  "text-[11px] md:text-[10px] font-medium whitespace-nowrap",
                  styles.label,
                  status === "current" && phaseColors.text,
                )}>
                  {stage.shortLabel}
                </span>
              )}
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════
// Helpers for external use
// ══════════════════════════════════════════════

export function getStageConfig(key: ChainStageKey): ChainStageConfig | undefined {
  return STAGE_CONFIGS.find(s => s.key === key);
}

export function getStagesForPhase(phase: ChainPhase): readonly ChainStageConfig[] {
  return STAGE_CONFIGS.filter(s => s.phase === phase);
}

export function getPhaseLabel(phase: ChainPhase): string {
  return PHASE_COLORS[phase].label;
}

/** CLAUDE.md: 다음 확장 슬롯 — 현재 stage 이후 upcoming stages 목록 */
export function getUpcomingStages(currentStage: ChainStageKey): readonly ChainStageConfig[] {
  const currentOrder = STAGE_CONFIGS.find(s => s.key === currentStage)?.order ?? 0;
  return STAGE_CONFIGS.filter(s => s.order > currentOrder);
}

// ══════════════════════════════════════════════════════════════════════════════
// H. Smart Sourcing Handoff → ProgressStrip 매핑
//
// AI 견적 분석 결과의 handoff 상태를 chain stage로 변환하여
// QuoteChainProgressStrip에 연결합니다.
//
// 매핑:
// - comparison_complete → quote_review (current)
// - vendor_selected    → quote_shortlist (current)
// - handed_off_to_request → quote_approval (upcoming, handoff 완료)
//
// - parsed              → quote_review (current)
// - items_confirmed     → quote_shortlist (current)
// - registered_to_queue → quote_shortlist (completed), 다음 stage로
// ══════════════════════════════════════════════════════════════════════════════

export type SmartSourcingHandoffStatus =
  | "comparison_complete"
  | "vendor_selected"
  | "handed_off_to_request"
  | "parsed"
  | "items_confirmed"
  | "registered_to_queue";

export interface SmartSourcingStageMapping {
  currentStage: ChainStageKey;
  stageStatuses: Partial<Record<ChainStageKey, StageStatus>>;
  /** ProgressStrip에 표시할 권장 visibleStages */
  suggestedVisibleStages: ChainStageKey[];
}

/**
 * Smart Sourcing handoff 상태를 ProgressStrip stage로 변환
 *
 * AI 견적 분석은 sourcing phase의 초기 단계에 해당하므로
 * quote_review / quote_shortlist를 중심으로 매핑합니다.
 */
export function mapSmartSourcingToChainStage(
  handoffStatus: SmartSourcingHandoffStatus,
): SmartSourcingStageMapping {
  // sourcing → approval 초입까지만 보여줌
  const visibleStages: ChainStageKey[] = [
    "quote_review",
    "quote_shortlist",
    "quote_approval",
    "po_conversion",
  ];

  switch (handoffStatus) {
    case "comparison_complete":
    case "parsed":
      return {
        currentStage: "quote_review",
        stageStatuses: {},
        suggestedVisibleStages: visibleStages,
      };

    case "vendor_selected":
    case "items_confirmed":
      return {
        currentStage: "quote_shortlist",
        stageStatuses: {
          quote_review: "completed",
        },
        suggestedVisibleStages: visibleStages,
      };

    case "handed_off_to_request":
    case "registered_to_queue":
      return {
        currentStage: "quote_approval",
        stageStatuses: {
          quote_review: "completed",
          quote_shortlist: "completed",
        },
        suggestedVisibleStages: visibleStages,
      };
  }
}

/**
 * Smart Sourcing 컨텍스트 전용 ProgressStrip 렌더링 도우미.
 * handoff 상태만 넘기면 올바른 props를 자동 생성합니다.
 */
export function buildSmartSourcingStripProps(
  handoffStatus: SmartSourcingHandoffStatus,
): Pick<QuoteChainProgressStripProps, "currentStage" | "stageStatuses" | "visibleStages"> {
  const mapping = mapSmartSourcingToChainStage(handoffStatus);
  return {
    currentStage: mapping.currentStage,
    stageStatuses: mapping.stageStatuses,
    visibleStages: mapping.suggestedVisibleStages,
  };
}
