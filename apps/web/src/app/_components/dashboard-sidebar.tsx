"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { BioInsightLogo } from "@/components/bioinsight-logo";
import {
  LayoutDashboard,
  ShoppingCart,
  DollarSign,
  Building2,
  Package,
  FileText,
  BarChart3,
  Settings,
  Users,
  Activity,
  Shield,
  Menu,
  X,
  Receipt,
  CreditCard,
  PieChart,
  Lock,
  House,
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
        icon: FileText,
      },
      {
        title: "구매 내역",
        href: "/dashboard/purchases",
        icon: ShoppingCart,
      },
      {
        title: "구매 리포트",
        href: "/dashboard/reports",
        icon: BarChart3,
      },
      {
        title: "예산 관리",
        href: "/dashboard/budget",
        icon: CreditCard,
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
        icon: Building2,
      },
      {
        title: "안전 관리",
        href: "/dashboard/safety",
        icon: Shield,
      },
    ],
  },
  {
    label: "시스템 (SYSTEM)",
    items: [
      {
        title: "활동 로그",
        href: "/dashboard/activity-logs",
        icon: Activity,
      },
      {
        title: "감사 증적",
        href: "/dashboard/audit",
        icon: Lock,
      },
      {
        title: "설정",
        href: "/dashboard/settings",
        icon: Settings,
      },
    ],
  },
];

// 대시보드 링크 (상단에 별도 배치)
const dashboardLinks = [
  {
    title: "대시보드",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "지출 분석",
    href: "/dashboard/analytics",
    icon: PieChart,
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

  const userRole = session?.user?.role as string | undefined;
  const canAccessAudit = userRole === "ADMIN" || (userRole as string)?.toLowerCase() === "manager";

  const filteredSidebarGroups = useMemo(
    () =>
      sidebarGroups
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => {
            if (item.href === "/dashboard/audit") {
              return canAccessAudit;
            }
            return true;
          }),
        }))
        .filter((group) => group.items.length > 0),
    [canAccessAudit]
  );
  
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
      {/* 사이드바 헤더 (로고) */}
      <div className="h-16 flex items-center px-6 border-b border-slate-200 flex-shrink-0">
        <Link 
          href="/" 
          className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity relative z-50 w-full"
        >
          <BioInsightLogo showText={true} className="h-6" />
        </Link>
      </div>

      {/* 메뉴 영역 (스크롤 가능) */}
      <div className="flex-1 overflow-y-auto p-3 md:p-4 pt-8 md:pt-8">
        {/* 모바일/태블릿 헤더 */}
        <div className="flex items-center justify-between mb-6 lg:hidden">
          <h2 className="text-xs font-semibold text-slate-900">메뉴</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMobileOpen(false)}
            className="h-7 w-7"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        {/* 데스크톱 헤더 */}
        <h2 className="hidden lg:block text-xs lg:text-sm font-semibold text-slate-900 mb-6">메뉴</h2>

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
                    "flex items-center gap-3 px-2 md:px-3 py-2 rounded-md text-xs md:text-sm font-medium transition-colors",
                    isActive
                      ? "bg-blue-50 text-blue-600"
                      : "text-slate-700 hover:bg-gray-100 hover:text-slate-900"
                  )}
                >
                  <Icon className={cn("h-5 w-5 flex-shrink-0", isActive ? "text-blue-600" : "text-slate-500")} />
                  <span className="truncate whitespace-nowrap">{item.title}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* 메뉴 그룹 */}
        <div className="space-y-6">
          {filteredSidebarGroups.map((group, groupIndex) => (
            <div key={groupIndex}>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-2 md:px-3 mt-6 first:mt-0">
                {group.label}
              </h3>
              <nav className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
                  // 인벤토리는 핵심 메뉴이므로 강조
                  const isInventory = item.href === "/dashboard/inventory";

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsMobileOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-2 md:px-3 py-2 rounded-md text-xs md:text-sm font-medium transition-colors",
                        isActive
                          ? "bg-blue-50 text-blue-600"
                          : "text-slate-700 hover:bg-gray-100 hover:text-slate-900",
                        isInventory && !isActive && "font-semibold"
                      )}
                    >
                      <Icon className={cn("h-5 w-5 flex-shrink-0", isActive ? "text-blue-600" : isInventory ? "text-blue-500" : "text-slate-500")} />
                      <span className="truncate whitespace-nowrap">{item.title}</span>
                      {item.badge && (
                        <span className="ml-auto text-[10px] md:text-xs bg-blue-100 text-blue-700 px-1.5 md:px-2 py-0.5 rounded">
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
      </div>

      {/* 하단 고정 영역 (서비스 홈으로) */}
      <div className="px-3 md:px-4 py-3 md:py-4 border-t border-slate-200 flex-shrink-0 mt-auto">
        <Link 
          href="/" 
          onClick={() => setIsMobileOpen(false)}
          className="flex items-center gap-3 rounded-lg px-2 md:px-3 py-2 text-xs md:text-sm font-medium text-slate-500 transition-all hover:text-blue-600 hover:bg-blue-50"
        >
          <House className="h-5 w-5 flex-shrink-0" />
          <span className="truncate whitespace-nowrap">서비스 홈으로</span>
        </Link>
      </div>
    </div>
  );

  return (
    <>
      {/* 모바일/태블릿 오버레이 */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* 데스크톱 사이드바 (lg 이상에서만 표시) */}
      <aside className="hidden lg:block w-64 min-w-[16rem] min-h-screen bg-white border-r border-slate-200 shrink-0 z-30">
        <SidebarContent />
      </aside>

      {/* 모바일/태블릿 사이드바 (Sheet 형태) */}
      <aside
        className={cn(
          "fixed top-0 left-0 h-full w-64 min-w-[16rem] bg-white border-r border-slate-200 z-50 mobile-sidebar transition-transform duration-300 lg:hidden shrink-0",
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <SidebarContent />
      </aside>
    </>
  );
}
