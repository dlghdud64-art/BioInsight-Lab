/**
 * §11.181 #operational-brief-popup-self-contained
 *
 * 운영 브리핑 popup의 open/close state를 surface 별로 분리하지 않고
 * 한 곳(dashboard layout)에서 관리하는 React Context.
 *
 * §11.195 추가: minimize/restore 흐름.
 *   - isMinimized 가 true 면 popup 은 우측 edge 의 dock chip 으로 collapse
 *     (full sheet 미렌더, state 보존). 호영님이 다른 작업을 하는 동안
 *     popup 을 가리지 않고 진행 상태만 유지.
 *   - close() 는 fully unmount (state reset). minimize 는 가시 영역만 축소.
 *
 * 사용:
 *   - <OperationalBriefPopupProvider> 으로 감싸고
 *   - useOperationalBriefPopup() → { open, close, isOpen, isMinimized,
 *     toggleMinimize, ... }
 *
 * lock §11.142 호환:
 *   - context 자체는 facts 0 노출 (단순 open/close + minimize + selectedItemId state).
 *   - popup 내부에서 work object selected 시만 facts 노출.
 */

"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

interface OperationalBriefPopupContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  /** popup 내부에서 선택한 work object id (priority list → brief detail stack 전환 트리거). */
  selectedItemId: string | null;
  setSelectedItemId: (id: string | null) => void;
  /** §11.195 — popup 이 dock chip 으로 축소된 상태 여부. */
  isMinimized: boolean;
  /** §11.195 — minimize ↔ restore toggle. */
  toggleMinimize: () => void;
}

const OperationalBriefPopupContext =
  createContext<OperationalBriefPopupContextValue | null>(null);

interface ProviderProps {
  children: ReactNode;
}

export function OperationalBriefPopupProvider({ children }: ProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  // §11.195 — minimize state (default = false, full sheet 노출)
  const [isMinimized, setIsMinimized] = useState(false);

  const open = useCallback(() => {
    setIsOpen(true);
    // 다시 open 시 expanded 부터 (이전 minimize 잔존 state 차단)
    setIsMinimized(false);
  }, []);
  const close = useCallback(() => {
    setIsOpen(false);
    // popup close 시 selection + minimize 모두 reset — 다음 open 은
    // expanded category grid 부터 (canonical entry point).
    setSelectedItemId(null);
    setIsMinimized(false);
  }, []);
  const toggleMinimize = useCallback(() => {
    setIsMinimized((m) => !m);
  }, []);

  const value = useMemo<OperationalBriefPopupContextValue>(
    () => ({
      isOpen,
      open,
      close,
      selectedItemId,
      setSelectedItemId,
      isMinimized,
      toggleMinimize,
    }),
    [isOpen, open, close, selectedItemId, isMinimized, toggleMinimize],
  );

  return (
    <OperationalBriefPopupContext.Provider value={value}>
      {children}
    </OperationalBriefPopupContext.Provider>
  );
}

/**
 * Provider 가 mount 되지 않은 surface 에서 호출 시 noop fallback.
 * FloatingEntry 가 dashboard 외부 surface 에서 mount 되어도 안전.
 */
const NOOP_VALUE: OperationalBriefPopupContextValue = {
  isOpen: false,
  open: () => {
    // dev 환경에서만 콘솔 알림 — Provider 미mount 시 silent 무시.
    if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn(
        "[operational-brief-popup] Provider 가 mount 되지 않은 위치에서 open() 호출됨 — noop",
      );
    }
  },
  close: () => {},
  selectedItemId: null,
  setSelectedItemId: () => {},
  isMinimized: false,
  toggleMinimize: () => {},
};

export function useOperationalBriefPopup(): OperationalBriefPopupContextValue {
  return useContext(OperationalBriefPopupContext) ?? NOOP_VALUE;
}
