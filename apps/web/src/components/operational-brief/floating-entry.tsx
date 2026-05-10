/**
 * §11.175 #operational-brief-floating-entry-and-density-up
 *
 * 우하단 fixed FAB — 모든 surface 에서 운영 브리핑 진입을 가시화.
 *
 * lock §11.142 호환:
 *   - 자체는 facts 0 노출 (단순 트리거)
 *   - 클릭 시 work object 자동 hydrate 또는 navigation → selected 상태에서만 facts 노출
 *   - chatbot / assistant / terminal UI 0
 *   - dead button 0 — onClick 미연결 시 disabled
 *
 * 디자인:
 *   - Slate-900 bg + white text (다크 고대비, 모든 배경에서 식별)
 *   - Sparkles icon + "운영 브리핑" 텍스트 라벨 명시
 *   - h-12 px-5 (touch target ≥ 44px)
 *   - z-40 (mobile bottom sheet z-50 보다 아래)
 *   - active:scale-95 피드백
 */

"use client";

import { useCallback } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOperationalBriefPopup } from "./popup-context";

interface OperationalBriefFloatingEntryProps {
  /**
   * 클릭 핸들러 (선택).
   * §11.181 부터 default = useOperationalBriefPopup().open() — popup 호출.
   * surface 별로 자체 hydrate 가 필요한 경우만 onClick 명시 (대부분 0).
   */
  onClick?: () => void;
  /** brief panel 이 열려 있는 상태 — aria-expanded 반영. */
  open?: boolean;
  /** controls element id (aria-controls). */
  controls?: string;
  /** position override (default bottom-6 right-6). */
  className?: string;
}

export function OperationalBriefFloatingEntry({
  onClick,
  open: openProp,
  controls,
  className,
}: OperationalBriefFloatingEntryProps) {
  const popup = useOperationalBriefPopup();
  // §11.181b — onClick ?? popup.open 패턴이 prod build minify 후 closure 캡처
  // stale 되는 이슈 발견. useCallback + explicit ternary 로 swap (always-fresh popup ref).
  const handleClick = useCallback(() => {
    if (onClick) {
      onClick();
      return;
    }
    popup.open();
  }, [onClick, popup]);
  // open prop 미지정 시 popup context 의 isOpen 으로 derive (aria-expanded 동기)
  const open = openProp ?? popup.isOpen;
  const disabled = false; // §11.181b — popup default 항상 가용 (NOOP fallback) 이므로 disabled 0
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      aria-label={open ? "운영 브리핑 닫기" : "운영 브리핑 열기"}
      aria-expanded={open}
      aria-controls={controls}
      className={cn(
        // #operational-brief-rail-conversion-g1 — desktop rail 모드 (2xl+) 는
        //   rail 영구 노출이라 floating entry 진입점 중복 → 2xl:hidden 으로
        //   hide. md~2xl / mobile (<md) 에서는 popup overlay 트리거 보존.
        //   Path C: xl→2xl 상향 (1280~1536px 구간 popup overlay fallback).
        "fixed bottom-6 right-6 z-40 2xl:hidden",
        "inline-flex items-center gap-2",
        "h-12 px-5 rounded-full",
        "bg-slate-900 text-white",
        "shadow-lg shadow-slate-900/30",
        "hover:bg-slate-800 active:scale-95",
        "transition-all duration-150",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2",
        className,
      )}
    >
      <Sparkles className="h-4 w-4" aria-hidden="true" />
      <span className="text-sm font-semibold tracking-wide">운영 브리핑</span>
    </button>
  );
}
