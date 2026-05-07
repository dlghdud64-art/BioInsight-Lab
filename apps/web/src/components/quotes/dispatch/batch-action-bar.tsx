"use client";

/**
 * §11.217 Phase 3 — BatchActionBar
 *
 * 견적 관리 surface 의 PENDING quote 들을 batch 로 선택했을 때 노출되는 sticky
 * action bar. selectedCount > 0 시에만 render.
 *
 * canonical truth lock:
 *   - selectedCount === 0 시 null return (conditional render).
 *   - dispatchable / hardBlock 분리 라벨 ("선택 N건 — 발송 가능 M건 / 보류 K건").
 *   - "검토 시작" primary CTA — dispatchable === 0 시 disabled + tooltip.
 *   - "선택 해제" secondary CTA — onClearSelection.
 *   - getQuoteDispatchPreflight (canonical) 결과를 page-level 에서 합산 후 props
 *     로 전달 — 본 component 는 truth 변형 0.
 */

import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertTriangle, X, Send } from "lucide-react";

interface BatchActionBarProps {
  selectedCount: number;
  dispatchableCount: number;
  hardBlockCount: number;
  onReviewStart: () => void;
  onClearSelection: () => void;
}

export function BatchActionBar({
  selectedCount,
  dispatchableCount,
  hardBlockCount,
  onReviewStart,
  onClearSelection,
}: BatchActionBarProps) {
  // §11.217 Phase 3 — selectedCount === 0 시 sticky bar 0 (no-op render).
  if (selectedCount === 0) {
    return null;
  }

  const reviewDisabled = dispatchableCount === 0;
  const reviewTooltip = reviewDisabled
    ? "발송 가능한 견적이 없습니다. 공급사 이메일을 먼저 확인해 주세요."
    : `${dispatchableCount}건 견적 검토 시작`;

  return (
    <div
      data-testid="batch-action-bar"
      className="sticky top-2 z-30 rounded-xl border border-violet-200 bg-violet-50/95 backdrop-blur-sm shadow-sm px-3 sm:px-4 py-2.5 flex items-center gap-2 sm:gap-3 flex-wrap"
    >
      {/* 선택 카운트 + 분리 라벨 */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-violet-600 text-white text-xs font-bold shrink-0">
          {selectedCount}
        </span>
        <div className="flex flex-col min-w-0">
          <span className="text-xs sm:text-sm font-semibold text-violet-900">
            견적 {selectedCount}건 선택됨
          </span>
          <span className="text-[11px] text-violet-700/80 flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
              발송 가능 {dispatchableCount}건
            </span>
            {hardBlockCount > 0 && (
              <>
                <span className="text-violet-300">·</span>
                <span className="inline-flex items-center gap-1 text-amber-700">
                  <AlertTriangle className="h-3 w-3" />
                  보류 {hardBlockCount}건
                </span>
              </>
            )}
          </span>
        </div>
      </div>

      {/* CTA */}
      <div className="flex items-center gap-1.5 shrink-0">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClearSelection}
          className="h-8 text-xs text-violet-700 hover:bg-violet-100"
          aria-label="선택 해제"
        >
          <X className="h-3.5 w-3.5 mr-1" />
          선택 해제
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={onReviewStart}
          disabled={reviewDisabled}
          title={reviewTooltip}
          className="h-8 text-xs bg-violet-600 hover:bg-violet-700 text-white disabled:bg-violet-200 disabled:text-violet-400"
        >
          <Send className="h-3.5 w-3.5 mr-1" />
          검토 시작
        </Button>
      </div>
    </div>
  );
}
