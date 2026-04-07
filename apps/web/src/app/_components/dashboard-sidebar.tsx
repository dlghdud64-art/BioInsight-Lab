"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { BioInsightLogo } from "@/components/bioinsight-logo";
import {
  LayoutDashboard,
  ShoppingCart,
  Building2,
  Package,
  FileText,
  BarChart3,
  Settings,
  Activity,
  Shield,
  ShieldCheck,
  X,
  CreditCard,
  PieChart,
  Home,
  Sparkles,
} from "lucide-react";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  badge?: string;
}

// ── 아이콘 박스 컨테이너 ──────────────────────────────────
// B2B SaaS 트렌드: 아이콘 뒤 부드러운 사각형 배경으로 시인성 강화
function IconBox({ icon: Icon, isActive, tint }: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  isActive: boolean;
  tint: { active: string; inactive: string };
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0 transition-colors duration-150",
        isActive
          ? "bg-blue-100"
          : "bg-slate-100 group-hover/nav:bg-slate-200/80"
      )}
    >
      <Icon
        className={cn("h-[18px] w-[18px]", isActive ? tint.active : tint.inactive)}
        strokeWidth={2.25}
      />
    </span>
  );
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
        title: "스마트 소싱",
        href: "/dashboard/smart-sourcing",
        icon: Sparkles,
        badge: "AI",
      },
      {
        title: "견적 관리",
        href: "/dashboard/quotes",
        icon: FileText,
      },
      {
        title: "구매 운영",
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
        title: "설정",
        href: "/dashboard/settings",
        icon: Settings,
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
    icon: LayoutDashboard,
  },
  {
    title: "지출 분석",
    href: "/dashboard/analytics",
    icon: PieChart,
  },
];

// 사이드바 아이콘 색상 매핑 (active = 선명 tint, inactive = 부드러운 muted)
const ICON_TINT: Record<string, { active: string; inactive: string }> = {
  "/dashboard":              { active: "text-blue-600",    inactive: "text-slate-400" },
  "/dashboard/analytics":    { active: "text-indigo-600",  inactive: "text-slate-400" },
  "/dashboard/smart-sourcing":{ active: "text-violet-600",  inactive: "text-slate-400" },
  "/dashboard/quotes":       { active: "text-blue-600",    inactive: "text-slate-400" },
  "/dashboard/purchases":    { active: "text-blue-600",    inactive: "text-slate-400" },
  "/dashboard/reports":      { active: "text-blue-600",    inactive: "text-slate-400" },
  "/dashboard/budget":       { active: "text-blue-600",    inactive: "text-slate-400" },
  "/dashboard/inventory":    { active: "text-teal-600",    inactive: "text-slate-400" },
  "/dashboard/organizations":{ active: "text-indigo-600",  inactive: "text-slate-400" },
  "/dashboard/safety":       { active: "text-orange-500",  inactive: "text-slate-400" },
  "/dashboard/settings":     { active: "text-slate-600",   inactive: "text-slate-400" },
  "/dashboard/activity-logs":{ active: "text-slate-600",   inactive: "text-slate-400" },
  "/dashboard/audit":        { active: "text-slate-600",   inactive: "text-slate-400" },
};

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
      <div className="h-16 hidden lg:flex items-center px-4 border-b border-slate-200 flex-shrink-0">
        <Link
          href="/"
          className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity relative z-50 w-full"
        >
          <span className="text-xl font-bold tracking-tight text-slate-900">LabAxis</span>
        </Link>
      </div>

      {/* 메뉴 영역 (스크롤 가능) */}
      <div className="flex-1 overflow-y-auto p-3 md:p-4 pt-16 lg:pt-8">
        {/* 모바일/태블릿 헤더 */}
        <div className="flex items-center justify-between mb-6 lg:hidden">
          <h2 className="text-xs font-semibold text-slate-900">메뉴</h2>
            <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMobileOpen(false)}
            className="h-7 w-7 text-slate-500"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        {/* 데스크톱 헤더 */}
        <h2 className="hidden lg:block text-xs lg:text-sm font-semibold text-slate-900 mb-6">메뉴</h2>

        {/* 대시보드 링크 (상단) */}
        <div className="mb-6">
          <nav className="space-y-0.5">
            {dashboardLinks.map((item) => {
              const isActive = item.href === "/dashboard" ? pathname === "/dashboard" : (pathname === item.href || pathname?.startsWith(item.href + "/"));
              const tint = ICON_TINT[item.href] || { active: "text-blue-600", inactive: "text-slate-400" };

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileOpen(false)}
                  className={cn(
                    "group/nav flex items-center gap-2.5 px-2 md:px-2.5 py-1.5 rounded-lg text-xs md:text-sm font-medium transition-colors",
                    isActive
                      ? "text-blue-700 font-semibold bg-blue-50/80"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  )}
                >
                  <IconBox icon={item.icon} isActive={isActive} tint={tint} />
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
              <h3 className="text-xs font-bold uppercase tracking-wider mb-2 px-2 md:px-3 mt-6 first:mt-0" style={{ color: "#64748B" }}>
                {group.label}
              </h3>
              <nav className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = item.href === "/dashboard" ? pathname === "/dashboard" : (pathname === item.href || pathname?.startsWith(item.href + "/"));
                  const tint = ICON_TINT[item.href] || { active: "text-blue-600", inactive: "text-slate-500" };

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsMobileOpen(false)}
                      className={cn(
                        "group/nav flex items-center gap-2.5 px-2 md:px-2.5 py-1.5 rounded-lg text-xs md:text-sm font-medium transition-colors",
                        isActive
                          ? "text-blue-700 font-semibold bg-blue-50/80"
                          : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                      )}
                    >
                      <IconBox icon={item.icon} isActive={isActive} tint={tint} />
                      <span className="truncate whitespace-nowrap">{item.title}</span>
                      {item.badge && (
                        <span className="ml-auto text-[10px] md:text-xs px-1.5 md:px-2 py-0.5 rounded" style={{ backgroundColor: "rgba(37,99,235,0.08)", color: "#2563EB" }}>
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
          <div className="mt-8 pt-6 border-t border-slate-200">
            <p className="mb-2 px-2 md:px-3 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#64748B" }}>
              시스템 관리
            </p>
            <nav className="space-y-0.5">
              {adminMenuItems.map((item) => {
                const isActive = item.href === "/dashboard" ? pathname === "/dashboard" : (pathname === item.href || pathname?.startsWith(item.href + "/"));
                const tint = ICON_TINT[item.href] || { active: "text-slate-700", inactive: "text-slate-400" };
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMobileOpen(false)}
                    className={cn(
                      "group/nav flex items-center gap-2.5 px-2 md:px-2.5 py-1.5 rounded-lg text-xs md:text-sm font-medium transition-colors",
                      isActive
                        ? "text-blue-700 font-semibold bg-blue-50/80"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                    )}
                  >
                    <IconBox icon={item.icon} isActive={isActive} tint={tint} />
                    <span className="truncate whitespace-nowrap">{item.title}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        )}

        {/* 웹사이트 기본 링크 (서비스 소개 / 요금제 / 고객 지원) */}
        <div className="mt-8 pt-6 border-t border-slate-200">
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
                className="flex items-center px-2 md:px-3 py-2 rounded-md text-xs md:text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              >
                <span className="truncate whitespace-nowrap">{item.title}</span>
              </Link>
            ))}
          </nav>
        </div>
      </div>

      {/* 하단 고정 영역 (서비스 홈으로) - 브랜드 컬러 강조 */}
      <div className="mt-auto p-4 border-t border-slate-200 flex-shrink-0">
        <Link
          href="/"
          onClick={() => setIsMobileOpen(false)}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-300 group"
          style={{ backgroundColor: "rgba(37,99,235,0.04)", borderColor: "rgba(37,99,235,0.15)" }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(37,99,235,0.08)"; e.currentTarget.style.borderColor = "rgba(37,99,235,0.3)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "rgba(37,99,235,0.04)"; e.currentTarget.style.borderColor = "rgba(37,99,235,0.15)"; }}
        >
          <Home className="h-4 w-4 text-slate-500 group-hover:text-blue-600 transition-colors" />
          <span className="text-xs font-bold tracking-wider text-slate-500 group-hover:text-blue-600 truncate whitespace-nowrap">
            서비스 홈으로
          </span>
        </Link>
      </div>
    </div>
  );

  return (
    <>
      {/* ── 데스크탑 고정 사이드바 (lg 이상) ── */}
      <aside className="hidden lg:flex lg:flex-col fixed inset-y-0 left-0 w-64 bg-white border-r border-slate-200 z-30">
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
          "fixed top-0 left-0 h-full w-64 min-w-[16rem] bg-white border-r border-slate-200 z-50 mobile-sidebar transition-transform duration-300 shrink-0 lg:hidden",
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <SidebarContent />
      </aside>
    </>
  );
}
