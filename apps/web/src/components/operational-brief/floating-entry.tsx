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

import { useCallback, useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOperationalBriefPopup } from "./popup-context";

/**
 * §11.272d #fab-bottom-sheet-overlap-hide — 호영님 P0 3차 보고.
 *
 * Radix Dialog / Sheet / DropdownMenu 가 mount 되면 body 에 자동
 * `data-scroll-locked` attribute 추가 (또는 style.overflow="hidden").
 * FAB 가 fixed bottom + sheet 도 fixed bottom 이라 z-index 충돌 시 sheet 의
 * primary CTA (e.g. "회신 검토 시작 →") 위에 FAB 가 떠서 가림.
 *
 * Fix: MutationObserver 로 body 의 `data-scroll-locked` attribute 또는
 * style.overflow="hidden" watch → 한 가지라도 true 시 FAB hidden.
 * 모든 Radix sheet/dialog 통합 (운영 브리핑 popup + 견적 detail sheet +
 * 재고 detail sheet 등 카테고리 무관).
 */
function useBodyScrollLocked(): boolean {
  const [locked, setLocked] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => {
      const hasAttr = document.body.hasAttribute("data-scroll-locked");
      const overflowHidden = document.body.style.overflow === "hidden";
      setLocked(hasAttr || overflowHidden);
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-scroll-locked", "style"],
    });
    return () => observer.disconnect();
  }, []);
  return locked;
}

/**
 * §11.272e #fab-cta-overlap-hide-on-scroll — 호영님 P0 모바일 라이브 4장.
 *
 * FAB(fixed bottom-right)가 스크롤 콘텐츠의 CTA(예: "견적 요청 발송")를 상시
 * 덮어 tap 불가 → dead button 화. 패딩만으론 중간 카드 CTA 가림 미해결.
 * Fix: 스크롤 컨테이너(#main-content) 아래로 스크롤 시 FAB 를 translate +
 * pointer-events-none 으로 비키게(탭이 CTA 로 통과), 위로/최상단 시 복귀.
 * #main-content 부재(비-shell surface) 시 no-op (항상 노출).
 */
function useHideOnScrollDown(): boolean {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const scroller = document.getElementById("main-content");
    if (!scroller) return;
    let last = scroller.scrollTop;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const cur = scroller.scrollTop;
        if (cur < 24) setHidden(false);
        else if (cur - last > 8) setHidden(true);
        else if (last - cur > 8) setHidden(false);
        last = cur;
      });
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return hidden;
}

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
  // §11.272d — Sheet/Dialog open (body scroll lock) 시 FAB hidden
  const bodyScrollLocked = useBodyScrollLocked();
  // §11.272e — 아래로 스크롤 시 FAB 가 CTA 비키도록 hide(탭 통과)
  const hiddenOnScroll = useHideOnScrollDown();
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
  // §11.272d — body scroll lock (Radix Sheet/Dialog/Popup open) 시 FAB hidden
  // 견적 detail sheet / 재고 detail sheet / 운영 브리핑 popup 모두 통합 hidden
  if (bodyScrollLocked) return null;
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      aria-label={open ? "운영 브리핑 닫기" : "운영 브리핑 열기"}
      aria-expanded={open}
      aria-controls={controls}
      className={cn(
        // #operational-brief-rail-conversion-g2 — G1 의 viewport hide 분기 revert.
        //   모든 viewport 에서 button toggle (button click → popup open).
        // §11.252c — 모바일 (<lg) FAB 하단 72px+ 강제 (BottomNav h-14 = 56px +
        //   16px 안전 마진). 데스크탑 (≥lg) 은 BottomNav 없어서 기존 bottom-6
        //   유지. 가로 마진도 모바일 right-4 + 데스크탑 right-6 분기.
        // §11.272e — safe-area-inset 반영(노치폰 BottomNav 위 정렬).
        "fixed bottom-[calc(72px_+_env(safe-area-inset-bottom))] right-4 lg:bottom-6 lg:right-6 z-40",
        "inline-flex items-center gap-2",
        "h-12 px-5 rounded-full",
        "bg-slate-900 text-white",
        "shadow-lg shadow-slate-900/30",
        "hover:bg-slate-800 active:scale-95",
        "transition-all duration-150",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2",
        // §11.272e — 아래로 스크롤 시 CTA 비키기(탭 통과). 위로/최상단 복귀.
        hiddenOnScroll && "translate-y-24 opacity-0 pointer-events-none",
        className,
      )}
    >
      <Sparkles className="h-4 w-4" aria-hidden="true" />
      <span className="text-sm font-semibold tracking-wide">운영 브리핑</span>
    </button>
  );
}
