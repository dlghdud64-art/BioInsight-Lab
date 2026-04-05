"use client";

import { useState } from "react";
import { DashboardHeader } from "@/components/dashboard/Header";
import { DashboardSidebar } from "@/app/_components/dashboard-sidebar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { OpsStoreProvider } from "@/lib/ops-console/ops-store";

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
      </div>
    </OpsStoreProvider>
  );
}
