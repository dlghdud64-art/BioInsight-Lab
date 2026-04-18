"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface QRScannerContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const QRScannerContext = createContext<QRScannerContextValue | null>(null);

export function QRScannerProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((v) => !v), []);

  return (
    <QRScannerContext.Provider value={{ isOpen, open, close, toggle }}>
      {children}
    </QRScannerContext.Provider>
  );
}

export function useQRScanner() {
  const ctx = useContext(QRScannerContext);
  if (!ctx) throw new Error("useQRScanner must be used within QRScannerProvider");
  return ctx;
}
