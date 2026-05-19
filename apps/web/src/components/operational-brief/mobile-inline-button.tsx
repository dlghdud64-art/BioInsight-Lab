/**
 * §11.258-sweep-2 #operational-brief-mobile-inline-button — 호영님 §11.257 spec
 *   "방안 1 위치 분리" 적용. §11.258-sweep 으로 모바일 floating ✨ render 0
 *   해소 후 5 surface (inventory / purchase-orders / purchases / quotes /
 *   work-queue-console) 모바일 진입 동선 부재 risk 해결.
 *
 * 위치 분리:
 *   - BarcodeScanFab (⇄ 스캔) — 우측 하단 (right-4) 유지.
 *   - MobileBriefInlineButton (✨ 운영 브리핑) — 좌측 하단 (left-4) 신규.
 *   - 두 floating 좌표 분리 → 겹침 0.
 *
 * canonical truth lock:
 *   - useOperationalBriefPopup (popup-context) hook reuse.
 *   - controls="operational-brief-popup" 정합 (§11.181 일관).
 *   - 모바일 한정 (lg:hidden) — 데스크탑 OperationalBriefFloatingEntry 보존.
 *   - dashboard 의 §11.257 inline link 패턴은 별도 (헤더 영역, 본 컴포넌트 사용 0).
 */

"use client";

import { useCallback } from "react";
import { Sparkles } from "lucide-react";
import { useOperationalBriefPopup } from "./popup-context";
import { cn } from "@/lib/utils";

interface MobileBriefInlineButtonProps {
  /** className override (default 좌측 하단 floating). */
  className?: string;
}

export function MobileBriefInlineButton({ className }: MobileBriefInlineButtonProps) {
  const popup = useOperationalBriefPopup();
  const handleClick = useCallback(() => {
    popup.open();
  }, [popup]);
  const isOpen = popup.isOpen;

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={isOpen ? "운영 브리핑 닫기" : "운영 브리핑 열기"}
      aria-expanded={isOpen}
      aria-controls="operational-brief-popup"
      className={cn(
        // §11.258-sweep-2 — 좌측 하단 (BarcodeScanFab right-4 와 분리).
        // BottomNav h-14 (56px) + 16px 마진 = bottom-[72px] 정합 (§11.252c/d).
        "lg:hidden fixed bottom-[72px] left-4 z-40",
        "inline-flex items-center gap-2",
        "h-12 px-5 rounded-full",
        "bg-slate-900 text-white",
        "shadow-lg shadow-slate-900/30",
        "hover:bg-slate-800 active:scale-95",
        "transition-all duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2",
        className,
      )}
    >
      <Sparkles className="h-4 w-4" aria-hidden="true" />
      <span className="text-sm font-semibold tracking-wide">운영 브리핑</span>
    </button>
  );
}
