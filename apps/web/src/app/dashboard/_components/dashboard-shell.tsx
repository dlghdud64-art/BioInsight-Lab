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
      {/* §11.272e — skip-link 완전 삭제 (호영님 P0 5차 결정). §11.125 /
          §11.272a-redo / §11.272a-redo-2 / §11.272d (sr-only + focus:
          not-sr-only) 모든 hot fix 후에도 호영님 데스크탑 환경 좌상단에
          "본문 바로가기" visible 회귀. CSS hot fix 의존 한계 인정. element
          자체 제거. WCAG 2.4.1 Bypass Blocks a11y trade-off 인정 — 호영님
          visible regression 우선. 키보드 사용자는 brower 기본 Tab navigation
          만 (sidebar nav 통과 후 main 진입). 추후 a11y 강화는 별도 batch. */}

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
          {/* §11.331 — 모바일 상단 우측 햄버거 제거(호영님 2026-07-07). 하단 BottomNav
              '더보기'(동일 lg:hidden 브레이크포인트)로 네비게이션 일원화 = 진입 중복 제거.
              onMenuClick 미주입 → Header 햄버거 미렌더. 모바일 사이드 drawer 진입점 제거. */}
          <DashboardHeader />

          {/* §11.202 — main + 운영 브리핑 rail 을 flex row 로 배치.
              rail 은 desktop 에서 main 옆 sibling 으로 폭을 차지하며 main 이 reflow.
              header sticky top-0 z-50 영역은 그대로 보존 (rail 이 header 높이 침범 0). */}
          <div className="flex flex-1 min-h-0 overflow-hidden">
            <main
              id="main-content"
              tabIndex={-1}
              className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden pb-[calc(8rem_+_env(safe-area-inset-bottom))] lg:pb-8"
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
