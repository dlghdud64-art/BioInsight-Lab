"use client";

import { useState } from "react";
import { DashboardHeader } from "@/components/dashboard/Header";
import { DashboardSidebar } from "@/app/_components/dashboard-sidebar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { BarcodeScanFab } from "@/components/layout/barcode-scan-fab";
import { OpsStoreProvider } from "@/lib/ops-console/ops-store";
// OntologyCommandOverlay는 CommandPalette로 통합됨 (Header 내장)
import { NotificationSonnerBridge } from "@/components/notifications/notification-sonner-bridge";
import { OrderCandidatePeekDrawer } from "@/components/orders/order-candidate-peek-drawer";
import { GovernanceDevPanel } from "@/components/dashboard/console/governance-dev-panel";
import { WorkbenchProgressOverlay } from "@/components/dashboard/overlay/workbench-progress-overlay";
import { WorkbenchFullOverlay } from "@/components/dashboard/overlay/workbench-full-overlay";
import { useOverlayDeepLink } from "@/hooks/use-overlay-deep-link";
import { useOverlayKeyboard } from "@/hooks/use-overlay-keyboard";

/**
 * DashboardShell — baseline shell wrapper.
 *
 * OpsStoreProvider는 sidebar/bottom-nav badge 카운트 전용.
 * dashboard page 자체는 OpsStore를 사용하지 않는다.
 *
 * ⚠ 계약 작업 주의:
 * - 이 shell을 계약형 shell로 교체하지 마라
 * - 계약형 dashboard는 /contract-preview route에서 개발
 * - baseline-manifest.ts 참조
 */
export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Overlay deep-link + keyboard support
  useOverlayDeepLink();
  useOverlayKeyboard();

  return (
    <OpsStoreProvider>
      <div className="flex h-screen overflow-hidden bg-[#F8FAFC]">
        <DashboardSidebar
          isMobileOpen={isMobileMenuOpen}
          onMobileOpenChange={setIsMobileMenuOpen}
        />

        <div className="flex flex-col flex-1 overflow-hidden lg:pl-64">
          <DashboardHeader
            onMenuClick={() => setIsMobileMenuOpen((prev) => !prev)}
          />

          <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 md:p-8 pb-20 lg:pb-8">
            {children}
          </main>
        </div>

        <BottomNav />
        <BarcodeScanFab />
        {/* CommandPalette는 DashboardHeader 내부에 통합됨 */}
        <NotificationSonnerBridge />
        <OrderCandidatePeekDrawer />
        <WorkbenchProgressOverlay />
        <WorkbenchFullOverlay />
        <GovernanceDevPanel />
      </div>
    </OpsStoreProvider>
  );
}
