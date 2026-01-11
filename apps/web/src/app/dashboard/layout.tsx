"use client";

import { MainHeader } from "@/app/_components/main-header";
import { DashboardSidebar } from "@/app/_components/dashboard-sidebar";
import { useState } from "react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50">
      <MainHeader
        onMenuClick={() => setIsMobileMenuOpen(true)}
      />
      <div className="flex overflow-x-hidden w-full">
        <DashboardSidebar 
          isMobileOpen={isMobileMenuOpen} 
          onMobileOpenChange={setIsMobileMenuOpen} 
        />
        <main className="flex-1 overflow-x-hidden overflow-y-auto min-w-0 max-w-full pt-20">
          {children}
        </main>
      </div>
    </div>
  );
}

