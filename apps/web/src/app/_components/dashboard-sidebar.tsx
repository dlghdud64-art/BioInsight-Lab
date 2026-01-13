"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
        href: "/quotes",
        icon: FileText,
      },
      {
        title: "구매 내역",
        href: "/dashboard/purchases",
        icon: ShoppingCart,
      },
      {
        title: "구매 리포트",
        href: "/reports",
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
        title: "인벤토리",
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
    title: "KPI 대시보드",
    href: "/dashboard/analytics",
    icon: BarChart3,
  },
];

interface DashboardSidebarProps {
  isMobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
}

export function DashboardSidebar({ isMobileOpen: externalIsMobileOpen, onMobileOpenChange }: DashboardSidebarProps = {}) {
  const pathname = usePathname();
  const [internalIsMobileOpen, setInternalIsMobileOpen] = useState(false);
  
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

  // 육각형 SVG 아이콘 컴포넌트
  const HexagonIcon = ({ className }: { className?: string }) => (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M12 2L20 7V17L12 22L4 17V7L12 2Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  const SidebarContent = () => (
    <div className="h-full flex flex-col justify-between">
      {/* Brand 영역 (상단 헤더) */}
      <div className="h-16 border-b border-slate-200 px-6 flex items-center">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            setIsMobileOpen(false);
          }}
        >
          <HexagonIcon className="h-6 w-6 text-blue-600 flex-shrink-0" />
          <span className="font-bold text-xl text-slate-900">BioInsight</span>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-3 md:p-4 pt-6 md:pt-6">
          {/* 모바일 헤더 */}
          <div className="flex items-center justify-between mb-6 md:hidden">
            <h2 className="text-xs font-semibold text-slate-900">메뉴</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsMobileOpen(false);
              }}
              onTouchStart={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsMobileOpen(false);
              }}
              className="h-7 w-7 touch-manipulation"
              type="button"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          {/* 데스크톱 헤더 */}
          <h2 className="hidden md:block text-xs md:text-sm font-semibold text-slate-900 mb-6">메뉴</h2>

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
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMobileOpen(false);
                  }}
                  onTouchStart={(e) => {
                    e.stopPropagation();
                  }}
                  className={cn(
                    "flex items-center gap-3 px-2 md:px-3 py-2 rounded-md text-xs md:text-sm font-medium transition-colors touch-manipulation",
                    isActive
                      ? "bg-blue-50 text-blue-600"
                      : "text-slate-700 hover:bg-gray-100 hover:text-slate-900"
                  )}
                >
                  <Icon className={cn("h-4 w-4 flex-shrink-0", isActive ? "text-blue-600" : "text-slate-500")} />
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
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsMobileOpen(false);
                      }}
                      onTouchStart={(e) => {
                        e.stopPropagation();
                      }}
                      className={cn(
                        "flex items-center gap-3 px-2 md:px-3 py-2 rounded-md text-xs md:text-sm font-medium transition-colors touch-manipulation",
                        isActive
                          ? "bg-blue-50 text-blue-600"
                          : "text-slate-700 hover:bg-gray-100 hover:text-slate-900",
                        isInventory && !isActive && "font-semibold"
                      )}
                    >
                      <Icon className={cn("h-4 w-4 flex-shrink-0", isActive ? "text-blue-600" : isInventory ? "text-blue-500" : "text-slate-500")} />
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
    </div>
  );

  return (
    <>
      {/* 모바일 오버레이 */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[45] md:hidden"
          onClick={() => setIsMobileOpen(false)}
          onTouchStart={(e) => {
            e.preventDefault();
            setIsMobileOpen(false);
          }}
        />
      )}

      {/* 데스크톱 사이드바 */}
      <aside className="hidden md:block w-64 min-w-[16rem] min-h-screen bg-white border-r border-slate-200 shrink-0 z-30">
        <SidebarContent />
      </aside>

      {/* 모바일 사이드바 */}
      <aside
        className={cn(
          "fixed top-0 left-0 h-full w-64 min-w-[16rem] bg-white border-r border-slate-200 z-[50] mobile-sidebar transition-transform duration-300 md:hidden shrink-0",
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <SidebarContent />
      </aside>
    </>
  );
}
