"use client";

/**
 * §11.217 Phase 3 — BatchActionBar (initial 도입)
 * §11.228 #quote-management-v2-phase-c1 — 호영님 v2 #20 일괄 처리 강화
 * §11.240 #quote-batch-selection-p0 — 호영님 P0 dropdown + 상태 혼재 가드레일
 *
 * 견적 관리 surface 의 PENDING quote 들을 batch 로 선택했을 때 노출되는 sticky
 * action bar. selectedCount > 0 시에만 render.
 *
 * canonical truth lock:
 *   - selectedCount === 0 시 null return (conditional render).
 *   - dispatchable / hardBlock / reminderEligible 분리 라벨
 *     ("발송 가능 M건 · 회신 대기 K건 · 보류 L건").
 *   - "검토 시작" primary CTA — dispatchable === 0 || reviewDisabled (호영님
 *     §11.240 가드레일: 응답 없는 quote 포함 시 disabled) → disabled + tooltip.
 *   - "리마인더" CTA — reminderEligible === 0 시 disabled + tooltip.
 *   - "상태 변경" CTA — selectedCount > 0 시 항상 활성 (status enum 전환은
 *     server PATCH 가 validate).
 *   - "선택 해제" utility CTA — onClearSelection.
 *   - §11.240 — "N건 선택됨" 텍스트 클릭 시 dropdown 으로 선택된 quote list
 *     노출 + 개별 X 버튼 (onRemoveOne) 으로 individual 해제.
 *   - getQuoteDispatchPreflight (canonical) 결과를 page-level 에서 합산 후 props
 *     로 전달 — 본 component 는 truth 변형 0.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertTriangle, X, Send, Bell, RefreshCw, Clock, ChevronDown, ChevronUp } from "lucide-react";

/** §11.240 — dropdown row 표시용 minimal Quote shape (canonical Quote 의 subset).
 *   items 는 직접 name 또는 nested product.name 둘 다 지원 (canonical Quote schema 정합). */
interface BatchActionBarQuote {
  id: string;
  title: string | null;
  status: string;
  items?: ReadonlyArray<{
    readonly name?: string | null;
    readonly product?: { readonly name?: string | null } | null;
  }>;
  responses?: ReadonlyArray<unknown>;
}

interface BatchActionBarProps {
  selectedCount: number;
  dispatchableCount: number;
  hardBlockCount: number;
  /** §11.228 — responseCount === 0 quote 수 (리마인더 대상). */
  reminderEligibleCount: number;
  /** §11.240 — dropdown list 용 selected quote 목록. */
  selectedQuotes: BatchActionBarQuote[];
  /** §11.240 — 상태 혼재 가드레일: 응답 없는 quote 포함 시 검토 시작 disabled. */
  reviewDisabled: boolean;
  /** §11.240 — dropdown 안 individual X 클릭 시 toggleQuoteSelection(id) 호출. */
  onRemoveOne: (id: string) => void;
  onReviewStart: () => void;
  /** §11.228 — 리마인더 sheet 열기. */
  onReminderStart: () => void;
  /** §11.228 — 상태 변경 sheet 열기. */
  onStatusChangeStart: () => void;
  onClearSelection: () => void;
}

export function BatchActionBar({
  selectedCount,
  dispatchableCount,
  hardBlockCount,
  reminderEligibleCount,
  selectedQuotes,
  reviewDisabled: reviewDisabledByMixedState,
  onRemoveOne,
  onReviewStart,
  onReminderStart,
  onStatusChangeStart,
  onClearSelection,
}: BatchActionBarProps) {
  // §11.240 — dropdown 토글 state.
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // §11.217 Phase 3 — selectedCount === 0 시 sticky bar 0 (no-op render).
  if (selectedCount === 0) {
    return null;
  }

  // §11.240 — 검토 시작 disabled = (a) 발송 가능 0 OR (b) 응답 없는 quote 포함 (호영님 가드레일).
  //   기존 dispatchableCount === 0 disabled + 호영님 spec 의 응답 혼재 가드레일 OR 처리.
  const reviewDisabled = dispatchableCount === 0 || reviewDisabledByMixedState;
  const reviewTooltip = reviewDisabled
    ? reviewDisabledByMixedState
      ? "응답을 받지 못한 견적이 포함되어 있습니다. 응답을 모두 수신한 후 검토 시작이 가능합니다."
      : "발송 가능한 견적이 없습니다. 공급사 이메일을 먼저 확인해 주세요."
    : `${dispatchableCount}건 견적 검토 시작`;

  // §11.228 — 리마인더 CTA 분기
  const reminderDisabled = reminderEligibleCount === 0;
  const reminderTooltip = reminderDisabled
    ? "리마인더 대상이 없습니다. 회신을 받지 못한 견적이 없습니다."
    : `${reminderEligibleCount}건에 리마인더 발송`;

  return (
    <div
      data-testid="batch-action-bar"
      className="sticky top-2 z-30 rounded-xl border border-violet-200 bg-violet-50/95 backdrop-blur-sm shadow-sm px-3 sm:px-4 py-2.5 flex items-center gap-2 sm:gap-3 flex-wrap"
    >
      {/* 선택 카운트 + 분리 라벨 + §11.240 dropdown */}
      <div className="flex items-center gap-2 min-w-0 flex-1 relative">
        <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-violet-600 text-white text-xs font-bold shrink-0">
          {selectedCount}
        </span>
        <div className="flex flex-col min-w-0">
          {/* §11.240 — selected 텍스트 클릭 → dropdown 토글 */}
          <button
            type="button"
            onClick={() => setDropdownOpen((o) => !o)}
            aria-expanded={dropdownOpen}
            aria-label={`선택된 견적 ${selectedCount}건 목록 ${dropdownOpen ? "닫기" : "열기"}`}
            className="text-xs sm:text-sm font-semibold text-violet-900 inline-flex items-center gap-1 hover:underline cursor-pointer"
          >
            견적 {selectedCount}건 선택됨
            {dropdownOpen ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
          <span className="text-[11px] text-violet-700/80 flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
              발송 가능 {dispatchableCount}건
            </span>
            {reminderEligibleCount > 0 && (
              <>
                <span className="text-violet-300">·</span>
                <span className="inline-flex items-center gap-1 text-blue-700">
                  <Clock className="h-3 w-3" />
                  회신 대기 {reminderEligibleCount}건
                </span>
              </>
            )}
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

        {/* §11.240 — dropdown panel: 선택된 quote list + 개별 X */}
        {dropdownOpen && (
          <div
            data-testid="batch-selection-dropdown"
            className="absolute top-full left-0 mt-1 w-[360px] max-w-[90vw] z-40 bg-white border border-violet-200 rounded-lg shadow-lg max-h-[300px] overflow-y-auto"
          >
            <div className="sticky top-0 px-3 py-2 border-b border-violet-100 bg-violet-50/80 text-[11px] font-semibold text-violet-700 uppercase tracking-wide">
              선택된 견적 ({selectedCount}건)
            </div>
            <ul className="divide-y divide-violet-50">
              {selectedQuotes.map((quote) => {
                // §11.240 — items[0].name (legacy) 또는 items[0].product.name (canonical) fallback chain
                const firstItem = quote.items?.[0];
                const itemName =
                  firstItem?.product?.name?.trim() ||
                  firstItem?.name?.trim() ||
                  quote.title?.trim() ||
                  "이름 없음";
                const more = (quote.items?.length ?? 0) > 1 ? ` 외 ${(quote.items?.length ?? 0) - 1}건` : "";
                return (
                  <li
                    key={quote.id}
                    className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-violet-50/40"
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-medium text-slate-900 truncate" title={itemName}>
                        {itemName}{more}
                      </span>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wide">
                        {quote.status}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveOne(quote.id)}
                      aria-label={`${itemName} 선택 해제`}
                      className="shrink-0 inline-flex items-center justify-center h-6 w-6 rounded hover:bg-violet-100 text-violet-600 hover:text-violet-800"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
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
        {/* §11.228 — 상태 변경 CTA */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onStatusChangeStart}
          className="h-8 text-xs border-violet-300 text-violet-800 hover:bg-violet-100"
          aria-label="선택 견적 상태 변경"
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1" />
          상태 변경
        </Button>
        {/* §11.228 — 리마인더 CTA */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onReminderStart}
          disabled={reminderDisabled}
          title={reminderTooltip}
          className="h-8 text-xs border-blue-300 text-blue-800 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="선택 견적 리마인더 발송"
        >
          <Bell className="h-3.5 w-3.5 mr-1" />
          리마인더
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
