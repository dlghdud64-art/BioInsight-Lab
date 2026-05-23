"use client";

import { useState } from "react";
import { DashboardHeader } from "@/components/dashboard/Header";
import { DashboardSidebar } from "@/app/_components/dashboard-sidebar";
import { BottomNav } from "@/components/layout/bottom-nav";
// §11.271 — BarcodeScanFab 은 DashboardHeader 모바일 inline 으로 이동 (운영 브리핑 FAB
// 좌표 충돌 해소). 본 shell 에서 mount 제거 + import 제거 (dead import 차단).
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
          §11.272a-redo-2 — focus-visible → focus swap (호영님 P0 3차 회귀
          보고). iOS Safari 가 :focus-visible pseudo 를 mount 직후 첫 focusable
          element 에 임의 적용 → 모바일 항상 visible 회귀. 호영님 spec 정답
          (sr-only + focus:not-sr-only) 채택. desktop Tab focus 시에만 노출,
          모바일 touch/mouse 시 focus 발동 안 함 → 완전 hidden. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:bg-blue-600 focus:text-white focus:px-3 focus:py-2 focus:rounded-md focus:text-sm focus:font-semibold focus:shadow-lg"
      >
        본문 바로가기
      </a>

      {/* §11.283b #dashboard-shell-bg-white-unified — 호영님 P0 spec: "배경색이
          너무 회색톤이여서 흰색톤으로 통일". 기존 bg-[#F8FAFC] (slate-50 톤)
          → bg-white. application-wide dashboard surface (대시보드 / 견적 / 구매
          / 재고 / 설정 등) 흰색 통일. visual cleanliness ↑. */}
      <div className="flex h-screen overflow-hidden bg-white">
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
        {/* §11.271 — BarcodeScanFab mount 제거. 모바일 trigger 는 DashboardHeader 의
            검색 button 옆에 inline 으로 이동 (운영 브리핑 FAB 좌표 충돌 해소). overlay
            (scanner modal) + store + handler 는 component 안에 그대로 보존. */}
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
