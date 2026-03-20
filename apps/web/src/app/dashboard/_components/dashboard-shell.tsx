"use client";

import { useState } from "react";
import { DashboardHeader } from "@/components/dashboard/Header";
import { DashboardSidebar } from "@/app/_components/dashboard-sidebar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { OpsStoreProvider } from "@/lib/ops-console/ops-store";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <OpsStoreProvider>
      <div className="flex h-screen overflow-hidden bg-sh">
        <DashboardSidebar
          isMobileOpen={isMobileMenuOpen}
          onMobileOpenChange={setIsMobileMenuOpen}
        />

        <div className="flex flex-col flex-1 overflow-hidden lg:pl-64">
          <DashboardHeader
            onMenuClick={() => setIsMobileMenuOpen((prev) => !prev)}
          />

          <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-8 pb-20 lg:pb-8">
            {children}
          </main>
        </div>

        <BottomNav />
      </div>
    </OpsStoreProvider>
  );
}
