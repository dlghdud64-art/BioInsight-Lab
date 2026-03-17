"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LabAxisLogo } from "@/components/bioinsight-logo";
import {
  LayoutGrid,
  TrendingUp,
  ShoppingCart,
  Users,
  Package,
  ClipboardList,
  BarChartBig,
  SlidersHorizontal,
  Activity,
  ShieldAlert,
  ShieldCheck,
  X,
  Wallet,
  ArrowLeft,
} from "lucide-react";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

interface SidebarGroup {
  label: string;
  items: NavItem[];
}

// 메뉴 그룹 정의
const sidebarGroups: SidebarGroup[] = [
  {
    label: "구매 및 예산 (PURCHASE)",
    items: [
      {
        title: "견적 관리",
        href: "/dashboard/quotes",
        icon: ClipboardList,
      },
      {
        title: "구매 운영",
        href: "/dashboard/purchases",
        icon: ShoppingCart,
      },
      {
        title: "구매 리포트",
        href: "/dashboard/reports",
        icon: BarChartBig,
      },
      {
        title: "예산 관리",
        href: "/dashboard/budget",
        icon: Wallet,
      },
    ],
  },
  {
    label: "랩 운영 (LAB MANAGEMENT)",
    items: [
      {
        title: "재고 관리",
        href: "/dashboard/inventory",
        icon: Package,
      },
      {
        title: "조직 관리",
        href: "/dashboard/organizations",
        icon: Users,
      },
      {
        title: "안전 관리",
        href: "/dashboard/safety",
        icon: ShieldAlert,
      },
    ],
  },
  {
    label: "시스템 (SYSTEM)",
    items: [
      {
        title: "설정",
        href: "/dashboard/settings",
        icon: SlidersHorizontal,
      },
    ],
  },
];

// 관리자 전용 메뉴 (role === ADMIN || OWNER 시에만 표시)
const adminMenuItems: NavItem[] = [
  { title: "활동 로그", href: "/dashboard/activity-logs", icon: Activity },
  { title: "감사 증적 (Audit Trail)", href: "/dashboard/audit", icon: ShieldCheck },
];

// 대시보드 링크 (상단에 별도 배치)
const dashboardLinks = [
  {
    title: "대시보드",
    href: "/dashboard",
    icon: LayoutGrid,
  },
  {
    title: "지출 분석",
    href: "/dashboard/analytics",
    icon: TrendingUp,
  },
];

interface DashboardSidebarProps {
  isMobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
}

export function DashboardSidebar({ isMobileOpen: externalIsMobileOpen, onMobileOpenChange }: DashboardSidebarProps = {}) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [internalIsMobileOpen, setInternalIsMobileOpen] = useState(false);

  const userRole = (session?.user?.role as string) || "";
  const isAdminOrOwner = userRole === "ADMIN" || userRole === "OWNER";
  
  // 외부에서 제어하는 경우와 내부에서 제어하는 경우를 모두 지원
  const isMobileOpen = externalIsMobileOpen !== undefined ? externalIsMobileOpen : internalIsMobileOpen;
  const setIsMobileOpen = (open: boolean) => {
    if (onMobileOpenChange) {
      onMobileOpenChange(open);
    } else {
      setInternalIsMobileOpen(open);
    }
  };

  // 모바일에서 링크 클릭 시 사이드바 닫기
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  // 모바일에서 외부 클릭 시 사이드바 닫기
  useEffect(() => {
    if (isMobileOpen) {
      const handleClickOutside = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (!target.closest('.mobile-sidebar') && !target.closest('.mobile-menu-button')) {
          setIsMobileOpen(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isMobileOpen]);

  const SidebarContent = () => (
    <div className="h-full flex flex-col">
      {/* 사이드바 헤더 (로고) - 데스크탑 전용 */}
      <div className="h-16 hidden lg:flex items-center px-4 border-b border-[#1a1e24] flex-shrink-0">
        <Link
          href="/"
          className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity relative z-50 w-full"
        >
          <LabAxisLogo showText={true} size="md" />
        </Link>
      </div>

      {/* 메뉴 영역 (스크롤 가능) */}
      <div className="flex-1 overflow-y-auto p-3 md:p-4 pt-16 lg:pt-8">
        {/* 모바일/태블릿 헤더 */}
        <div className="flex items-center justify-between mb-4 lg:hidden">
          <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">내비게이션</span>
            <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMobileOpen(false)}
            className="h-7 w-7 text-slate-500 hover:text-slate-300"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* 대시보드 링크 (상단) */}
        <div className="mb-6">
          <nav className="space-y-1">
            {dashboardLinks.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-2 md:px-3 py-2 rounded text-xs md:text-sm font-medium transition-colors",
                    isActive
                      ? "bg-blue-600/10 text-slate-100 border-l-2 border-l-blue-500"
                      : "text-slate-400 hover:bg-[#181c22] hover:text-slate-200"
                  )}
                >
                  <Icon className={cn("h-4 w-4 flex-shrink-0", isActive ? "text-blue-400" : "text-slate-500")} />
                  <span className="truncate whitespace-nowrap">{item.title}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* 메뉴 그룹 */}
        <div className="space-y-6">
          {sidebarGroups.map((group, groupIndex) => (
            <div key={groupIndex}>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-2 md:px-3 mt-6 first:mt-0">
                {group.label}
              </h3>
              <nav className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsMobileOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-2 md:px-3 py-2 rounded text-xs md:text-sm font-medium transition-colors",
                        isActive
                          ? "bg-blue-600/10 text-slate-100 border-l-2 border-l-blue-500"
                          : "text-slate-400 hover:bg-[#181c22] hover:text-slate-200"
                      )}
                    >
                      <Icon className={cn("h-4 w-4 flex-shrink-0", isActive ? "text-blue-400" : "text-slate-500")} />
                      <span className="truncate whitespace-nowrap">{item.title}</span>
                      {item.badge && (
                        <span className="ml-auto text-[10px] md:text-xs bg-[#1a1e24] text-slate-400 px-1.5 py-0.5 rounded">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>

        {/* 관리자 전용 메뉴 (시스템 관리) */}
        {isAdminOrOwner && (
          <div className="mt-8 pt-6 border-t border-[#1a1e24]">
            <p className="mb-2 px-2 md:px-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              시스템 관리
            </p>
            <nav className="space-y-1">
              {adminMenuItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-2 md:px-3 py-2 rounded text-xs md:text-sm font-medium transition-colors",
                      isActive
                        ? "bg-blue-600/10 text-slate-100 border-l-2 border-l-blue-500"
                        : "text-slate-400 hover:bg-[#181c22] hover:text-slate-200"
                    )}
                  >
                    <Icon className={cn("h-4 w-4 flex-shrink-0", isActive ? "text-blue-400" : "text-slate-500")} />
                    <span className="truncate whitespace-nowrap">{item.title}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        )}

        {/* 웹사이트 기본 링크 (서비스 소개 / 요금제 / 고객 지원) */}
        <div className="mt-8 pt-6 border-t border-[#1a1e24]">
          <p className="mb-2 px-2 md:px-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
            LabAxis
          </p>
          <nav className="space-y-1">
            {[
              { title: "서비스 소개", href: "/intro" },
              { title: "요금 & 도입", href: "/pricing" },
              { title: "고객 지원 및 문의", href: "/support" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsMobileOpen(false)}
                className="flex items-center px-2 md:px-3 py-2 rounded-md text-xs md:text-sm font-medium text-slate-400 hover:bg-[#181c22] hover:text-white transition-colors"
              >
                <span className="truncate whitespace-nowrap">{item.title}</span>
              </Link>
            ))}
          </nav>
        </div>
      </div>

      {/* 하단 고정 영역 */}
      <div className="mt-auto p-4 border-t border-[#1a1e24] flex-shrink-0">
        <Link
          href="/"
          onClick={() => setIsMobileOpen(false)}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded text-slate-500 hover:text-slate-300 hover:bg-[#181c22] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-xs font-medium truncate whitespace-nowrap">
            서비스 홈
          </span>
        </Link>
      </div>
    </div>
  );

  return (
    <>
      {/* ── 데스크탑 고정 사이드바 (lg 이상) ── */}
      <aside className="hidden lg:flex lg:flex-col fixed inset-y-0 left-0 w-64 bg-[#070a0e] border-r border-[#1a1e24] z-30">
        <SidebarContent />
      </aside>

      {/* ── 모바일/태블릿 오버레이 + 슬라이드 사이드바 (lg 미만) ── */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}
      <aside
        className={cn(
          "fixed top-0 left-0 h-full w-64 min-w-[16rem] bg-[#070a0e] border-r border-[#1a1e24] z-50 mobile-sidebar transition-transform duration-300 shrink-0 lg:hidden",
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <SidebarContent />
      </aside>
    </>
  );
}
