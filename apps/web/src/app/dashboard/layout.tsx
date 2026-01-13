"use client";

import { DashboardHeader } from "@/components/dashboard/Header";
import { DashboardSidebar } from "@/app/_components/dashboard-sidebar";
import { useState } from "react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* 왼쪽 고정: Sidebar */}
      <DashboardSidebar 
        isMobileOpen={isMobileMenuOpen} 
        onMobileOpenChange={setIsMobileMenuOpen} 
      />
      
      {/* 오른쪽 영역: Header + Main Content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* 상단 고정: Header (검색창, 프로필 포함) */}
        <DashboardHeader
          onMenuClick={() => setIsMobileMenuOpen(true)}
        />
        
        {/* 메인 콘텐츠 영역: 여기에만 페이지 내용이 들어감 */}
        <main className="flex-1 overflow-y-auto pt-16 pb-8 px-8">
          {children}
        </main>
      </div>
    </div>
  );
}

