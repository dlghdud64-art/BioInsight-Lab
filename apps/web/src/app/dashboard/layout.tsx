"use client";

import { useState } from "react";
import { DashboardHeader } from "@/components/dashboard/Header";
import { DashboardSidebar } from "@/app/_components/dashboard-sidebar";
import { BottomNav } from "@/components/layout/bottom-nav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-[#09090b]">
      {/* 왼쪽 고정: Sidebar */}
      <DashboardSidebar
        isMobileOpen={isMobileMenuOpen}
        onMobileOpenChange={setIsMobileMenuOpen}
      />

      {/* 오른쪽 영역: Header + Main Content (데스크탑은 사이드바 너비만큼 왼쪽 여백) */}
      <div className="flex flex-col flex-1 overflow-hidden lg:pl-64">
        {/* 상단 고정: Header (검색창, 프로필 포함) */}
        <DashboardHeader
          onMenuClick={() => setIsMobileMenuOpen((prev) => !prev)}
        />

        {/* 메인 콘텐츠 영역 */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-8 pb-20 lg:pb-8">
          {children}
        </main>
      </div>

      {/* 모바일 하단 네비게이션 */}
      <BottomNav />
    </div>
  );
}
