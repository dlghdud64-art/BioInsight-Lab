"use client";

import { useState } from "react";
import { DashboardHeader } from "@/components/dashboard/Header";
import { DashboardSidebar } from "@/app/_components/dashboard-sidebar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { BarcodeScanFab } from "@/components/layout/barcode-scan-fab";
import { OpsStoreProvider } from "@/lib/ops-console/ops-store";
import { OntologyContextLayer } from "@/components/ontology-context-layer/ontology-context-layer";
import { NotificationSonnerBridge } from "@/components/notifications/notification-sonner-bridge";
import { OrderCandidatePeekDrawer } from "@/components/orders/order-candidate-peek-drawer";
import { GovernanceDevPanel } from "@/components/dashboard/console/governance-dev-panel";
import { WorkbenchProgressOverlay } from "@/components/dashboard/overlay/workbench-progress-overlay";
import { WorkbenchFullOverlay } from "@/components/dashboard/overlay/workbench-full-overlay";
import { GovernedActionComposerBridge } from "@/components/governed-action/governed-action-composer-bridge";
import { GlobalModal } from "@/components/global-modal";
import { OperationalBriefPopupProvider } from "@/components/operational-brief/popup-context";
import { OperationalBriefPopup } from "@/components/operational-brief/popup";
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
      <OperationalBriefPopupProvider>
      {/* §11.125 — skip-link (WCAG 2.4.1 Bypass Blocks). 키보드 사용자가
          Tab 첫 stop 으로 sidebar nav 건너뛰고 main 으로 이동.
          §11.214c — focus: → focus-visible: swap. §11.214b NoSSR mount-after-
          render 시 skip-link 가 첫 focusable element 라 자동 focus → visible
          (LabAxis 텍스트 로고와 겹침). focus-visible 은 keyboard navigation
          (Tab) 시에만 활성화 — programmatic / 자동 focus 시 visible 0. */}
      <a
        href="#main-content"
        className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-3 focus-visible:left-3 focus-visible:z-[100] focus-visible:bg-blue-600 focus-visible:text-white focus-visible:px-3 focus-visible:py-2 focus-visible:rounded-md focus-visible:text-sm focus-visible:font-semibold focus-visible:shadow-lg"
      >
        본문 바로가기
      </a>

      <div className="flex h-screen overflow-hidden bg-[#F8FAFC]">
        <DashboardSidebar
          isMobileOpen={isMobileMenuOpen}
          onMobileOpenChange={setIsMobileMenuOpen}
        />

        <div className="flex flex-col flex-1 overflow-hidden lg:pl-64">
          <DashboardHeader
            onMenuClick={() => setIsMobileMenuOpen((prev) => !prev)}
          />

          {/* §11.202 — main + 운영 브리핑 rail 을 flex row 로 배치.
              rail 은 desktop 에서 main 옆 sibling 으로 폭을 차지하며 main 이 reflow.
              header sticky top-0 z-50 영역은 그대로 보존 (rail 이 header 높이 침범 0). */}
          <div className="flex flex-1 min-h-0 overflow-hidden">
            <main
              id="main-content"
              tabIndex={-1}
              className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden p-3 sm:p-4 md:p-8 pb-20 lg:pb-8"
            >
              {children}
            </main>
            {/* §11.202 — 운영 브리핑 popup (desktop = aside flex sibling, mobile = Radix Portal Sheet). */}
            <OperationalBriefPopup />
          </div>
        </div>

        <BottomNav />
        <BarcodeScanFab />
        {/* CommandPalette는 DashboardHeader 내부에 통합됨 */}
        <OntologyContextLayer />
        <NotificationSonnerBridge />
        <OrderCandidatePeekDrawer />
        <WorkbenchProgressOverlay />
        <WorkbenchFullOverlay />
        <GovernanceDevPanel />
        <GovernedActionComposerBridge />
        <GlobalModal />
      </div>
      </OperationalBriefPopupProvider>
    </OpsStoreProvider>
  );
}
