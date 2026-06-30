"use client";

/**
 * §11.230c (b)-1 #tooltip-component-enhance — 호영님 v2 dedicated Tooltip.
 *
 * 기존 shadcn 패턴 tooltip 의 a11y 약점 보강:
 *   (a) hover delay (TOOLTIP_DELAY_MS = 200ms) — 우연한 마우스 hover 노출 ↓
 *   (b) focus 시 즉시 노출 (delay 0) — 키보드 사용자 마찰 ↓
 *   (c) ESC 키 → setIsOpen(false) — keyboard dismiss 정합
 *   (d) role="tooltip" + useId 으로 tooltipId + aria-describedby chain — screen
 *       reader 가 trigger 의 hint 로 인지
 *
 * canonical API 보존 (caller drift 0):
 *   TooltipProvider / Tooltip / TooltipTrigger (asChild + cloneElement) /
 *   TooltipContent (z-50 + bg/border + arrow before:).
 */

import * as React from "react";
import { cn } from "@/lib/utils";

/** §11.230c (b)-1 #1 — hover delay (200ms). 200 미만 시 우연한 hover 노출 ↑,
 *  500 초과 시 의도적 hover 도 느림. shadcn/Radix 기본값 정합. */
const TOOLTIP_DELAY_MS = 200;

interface TooltipProviderProps {
  children: React.ReactNode;
}

interface TooltipProps {
  children: React.ReactNode;
}

interface TooltipTriggerProps {
  asChild?: boolean;
  children: React.ReactNode;
}

interface TooltipContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

interface TooltipContextValue {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  /** §11.230c (b)-1 #4 — aria-describedby chain id (trigger ↔ content). */
  tooltipId: string;
  /** §11.230c (b)-1 #1 — hover enter 시 delay 후 open (clear 가능). */
  openWithDelay: () => void;
  /** §11.230c (b)-1 #1 — leave 또는 ESC 시 즉시 close + pending timer cancel. */
  closeImmediate: () => void;
}

const TooltipContext = React.createContext<TooltipContextValue>({
  isOpen: false,
  setIsOpen: () => {},
  tooltipId: "",
  openWithDelay: () => {},
  closeImmediate: () => {},
});

const TooltipProvider = ({ children }: TooltipProviderProps) => {
  return <>{children}</>;
};

const Tooltip = ({ children }: TooltipProps) => {
  const [isOpen, setIsOpen] = React.useState(false);
  // §11.230c (b)-1 #1 — useRef 으로 timer reference 보관 (re-render survive).
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  // §11.230c (b)-1 #4 — useId 으로 tooltipId 생성. SSR-safe + 동일 page 내 unique.
  const tooltipId = React.useId();

  const openWithDelay = React.useCallback(() => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setIsOpen(true);
      timerRef.current = null;
    }, TOOLTIP_DELAY_MS);
  }, []);

  const closeImmediate = React.useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsOpen(false);
  }, []);

  // §11.230c (b)-1 #3 — ESC 키 → close. document-level listener (any focus).
  React.useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeImmediate();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [isOpen, closeImmediate]);

  // §11.230c (b)-1 cleanup — unmount 시 pending timer 차단.
  React.useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <TooltipContext.Provider
      value={{ isOpen, setIsOpen, tooltipId, openWithDelay, closeImmediate }}
    >
      <div
        className="relative"
        onMouseEnter={openWithDelay}
        onMouseLeave={closeImmediate}
      >
        {children}
      </div>
    </TooltipContext.Provider>
  );
};

const TooltipTrigger = React.forwardRef<
  HTMLButtonElement,
  TooltipTriggerProps
>(({ asChild, children, ...props }, ref) => {
  const { openWithDelay, closeImmediate, tooltipId, isOpen } =
    React.useContext(TooltipContext);
  // §11.230c (b)-1 #2 — onFocus (delay 0, 키보드 즉시 노출) + onBlur (close).
  //   §11.230c (b)-1 #4 — aria-describedby trigger 에 forward.
  const a11yProps = {
    "aria-describedby": isOpen ? tooltipId : undefined,
    onFocus: () => openWithDelay(),
    onBlur: () => closeImmediate(),
  } as Record<string, unknown>;
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      ...props,
      ...a11yProps,
      ref,
    } as any);
  }
  return (
    <button ref={ref} {...props} {...(a11yProps as object)}>
      {children}
    </button>
  );
});
TooltipTrigger.displayName = "TooltipTrigger";

const TooltipContent = React.forwardRef<HTMLDivElement, TooltipContentProps>(
  ({ className, children, ...props }, ref) => {
    const { isOpen, tooltipId } = React.useContext(TooltipContext);
    if (!isOpen) return null;
    return (
      <div
        ref={ref}
        id={tooltipId}
        role="tooltip"
        className={cn(
          // §tooltip-contrast-fix (호영님 2026-06-30): 이전 패널 배경 토큰(--app-panel-3=#FFFFFF 흰색) +
          //   text-slate-50(흰색) = 흰 글자 안 보임. 화살표(border-t-[#1a1a1e])와 동일 다크 배경으로
          //   다크 툴팁 복원 → 흰 글자 가독성 확보. 전 앱 공유 primitive 일괄 수정.
          "absolute z-50 rounded-md border border-[#1a1a1e] bg-[#1a1a1e] px-3 py-1.5 text-sm text-slate-50 shadow-md whitespace-nowrap",
          "bottom-full left-1/2 -translate-x-1/2 mb-2",
          "before:content-[''] before:absolute before:top-full before:left-1/2 before:-translate-x-1/2 before:border-4 before:border-transparent before:border-t-[#1a1a1e]",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
TooltipContent.displayName = "TooltipContent";

export { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent };
