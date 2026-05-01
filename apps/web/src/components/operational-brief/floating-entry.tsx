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
  const handleClick = onClick ?? popup.open;
  // open prop 미지정 시 popup context 의 isOpen 으로 derive (aria-expanded 동기)
  const open = openProp ?? popup.isOpen;
  const disabled = !handleClick;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={open ? "운영 브리핑 닫기" : "운영 브리핑 열기"}
      aria-expanded={open}
      aria-controls={controls}
      className={cn(
        "fixed bottom-6 right-6 z-40",
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
