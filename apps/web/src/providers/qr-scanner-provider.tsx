"use client";

import { QRScannerProvider } from "@/contexts/QRScannerContext";
import { GlobalQRScannerModal } from "@/components/inventory/GlobalQRScannerModal";

export function QRScannerProviderWrapper({ children }: { children: React.ReactNode }) {
  return (
    <QRScannerProvider>
      {children}
      <GlobalQRScannerModal />
    </QRScannerProvider>
  );
}
