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
  Link2,
  FileText,
  BarChart3,
  Settings,
  Users,
  Store,
  Activity,
  Shield,
  Menu,
  X,
} from "lucide-react";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

const navItems: NavItem[] = [
  {
    title: "대시보드",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "견적 관리",
    href: "/quotes",
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
    icon: DollarSign,
  },
  {
    title: "조직 관리",
    href: "/dashboard/organizations",
    icon: Building2,
  },
  {
    title: "인벤토리",
    href: "/dashboard/inventory",
    icon: Package,
  },
  {
    title: "공유 링크",
    href: "/dashboard/shared-links",
    icon: Link2,
  },
  {
    title: "활동 로그",
    href: "/dashboard/activity-logs",
    icon: Activity,
  },
  {
    title: "공급사",
    href: "/dashboard/supplier",
    icon: Store,
  },
  {
    title: "설정",
    href: "/dashboard/settings/plans",
    icon: Settings,
  },
  {
    title: "Enterprise 설정",
    href: "/dashboard/settings/enterprise",
    icon: Shield,
  },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

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
    <div className="p-3 md:p-4">
      <div className="flex items-center justify-between mb-3 md:mb-4 md:hidden">
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
      <h2 className="hidden md:block text-xs md:text-sm font-semibold text-slate-900 mb-3 md:mb-4">메뉴</h2>
      <nav className="space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
          
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setIsMobileOpen(false)}
              className={cn(
                "flex items-center gap-2 md:gap-3 px-2 md:px-3 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-colors",
                isActive
                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                  : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <Icon className={cn("h-3.5 w-3.5 md:h-4 md:w-4 flex-shrink-0", isActive ? "text-blue-600" : "text-slate-500")} />
              <span className="truncate">{item.title}</span>
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
  );

  return (
    <>
      {/* 모바일 메뉴 버튼 */}
      <Button
        variant="outline"
        size="icon"
        className="fixed top-20 left-3 z-50 md:hidden mobile-menu-button h-9 w-9 shadow-md"
        onClick={() => setIsMobileOpen(true)}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* 모바일 오버레이 */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* 데스크톱 사이드바 */}
      <aside className="hidden md:block w-64 min-h-screen bg-white border-r border-slate-200 flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* 모바일 사이드바 */}
      <aside
        className={cn(
          "fixed top-0 left-0 h-full w-64 bg-white border-r border-slate-200 z-50 mobile-sidebar transition-transform duration-300 md:hidden",
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <SidebarContent />
      </aside>
    </>
  );
}

