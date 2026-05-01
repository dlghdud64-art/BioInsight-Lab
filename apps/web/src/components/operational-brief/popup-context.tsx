/**
 * §11.181 #operational-brief-popup-self-contained
 *
 * 운영 브리핑 popup의 open/close state를 surface 별로 분리하지 않고
 * 한 곳(dashboard layout)에서 관리하는 React Context.
 *
 * 사용:
 *   - <OperationalBriefPopupProvider> 으로 감싸고
 *   - useOperationalBriefPopup() → { open, close, isOpen }
 *
 * lock §11.142 호환:
 *   - context 자체는 facts 0 노출 (단순 open/close + selectedItemId state).
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
}

const OperationalBriefPopupContext =
  createContext<OperationalBriefPopupContextValue | null>(null);

interface ProviderProps {
  children: ReactNode;
}

export function OperationalBriefPopupProvider({ children }: ProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => {
    setIsOpen(false);
    // popup close 시 selection 도 reset — 다음 open 은 priority list 부터
    setSelectedItemId(null);
  }, []);

  const value = useMemo<OperationalBriefPopupContextValue>(
    () => ({ isOpen, open, close, selectedItemId, setSelectedItemId }),
    [isOpen, open, close, selectedItemId],
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
};

export function useOperationalBriefPopup(): OperationalBriefPopupContextValue {
  return useContext(OperationalBriefPopupContext) ?? NOOP_VALUE;
}
