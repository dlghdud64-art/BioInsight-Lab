"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Inbox,
  Search,
  FileText,
  ClipboardList,
  Package,
  AlertTriangle,
  Settings,
  Activity,
  ShieldCheck,
  Home,
  X,
} from "lucide-react";
import { useOpsStore } from "@/lib/ops-console/ops-store";
import {
  resolveTopLevelModule,
  type TopLevelModule,
} from "@/lib/ops-console/navigation-context";

// ---------------------------------------------------------------------------
// Primary nav items
// ---------------------------------------------------------------------------

interface NavItem {
  module: TopLevelModule;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeKey?: "inbox" | "quotes" | "receiving" | "stock_risk";
}

const PRIMARY_NAV: NavItem[] = [
  { module: "today", label: "오늘", href: "/dashboard", icon: LayoutDashboard },
  { module: "inbox", label: "작업함", href: "/dashboard/inbox", icon: Inbox, badgeKey: "inbox" },
  { module: "search", label: "검색", href: "/test/search", icon: Search },
  { module: "quotes", label: "견적", href: "/dashboard/quotes", icon: FileText, badgeKey: "quotes" },
  { module: "purchase_orders", label: "발주", href: "/dashboard/purchase-orders", icon: ClipboardList },
  { module: "receiving", label: "입고", href: "/dashboard/receiving", icon: Package, badgeKey: "receiving" },
  { module: "stock_risk", label: "재고 위험", href: "/dashboard/stock-risk", icon: AlertTriangle, badgeKey: "stock_risk" },
];

const SETTINGS_NAV: NavItem = {
  module: "settings",
  label: "설정",
  href: "/dashboard/settings",
  icon: Settings,
};

const ADMIN_NAV: NavItem[] = [
  { module: "admin", label: "활동 로그", href: "/dashboard/activity-logs", icon: Activity },
  { module: "admin", label: "감사 증적", href: "/dashboard/audit", icon: ShieldCheck },
];

// ---------------------------------------------------------------------------
// Badge severity → color
// ---------------------------------------------------------------------------

function badgeClasses(severity: "normal" | "warning" | "critical"): string {
  switch (severity) {
    case "critical":
      return "bg-red-500/20 text-red-400 ring-1 ring-red-500/30";
    case "warning":
      return "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30";
    default:
      return "bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/30";
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface DashboardSidebarProps {
  isMobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
}

export function DashboardSidebar({
  isMobileOpen: externalIsMobileOpen,
  onMobileOpenChange,
}: DashboardSidebarProps = {}) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [internalIsMobileOpen, setInternalIsMobileOpen] = useState(false);

  const userRole = (session?.user?.role as string) || "";
  const isAdminOrOwner = userRole === "ADMIN" || userRole === "OWNER";

  const isMobileOpen =
    externalIsMobileOpen !== undefined ? externalIsMobileOpen : internalIsMobileOpen;
  const setIsMobileOpen = (open: boolean) => {
    if (onMobileOpenChange) {
      onMobileOpenChange(open);
    } else {
      setInternalIsMobileOpen(open);
    }
  };

  // Close on route change
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  // Close on outside click (mobile)
  useEffect(() => {
    if (isMobileOpen) {
      const handleClickOutside = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (!target.closest(".mobile-sidebar") && !target.closest(".mobile-menu-button")) {
          setIsMobileOpen(false);
        }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isMobileOpen]);

  // Active module from pathname
  const activeModule = resolveTopLevelModule(pathname);

  // ---------------------------------------------------------------------------
  // Badge counts from ops store
  // ---------------------------------------------------------------------------

  let badges: Record<string, { count: number; severity: "normal" | "warning" | "critical" }> = {};

  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { unifiedInboxItems } = useOpsStore();

    // eslint-disable-next-line react-hooks/rules-of-hooks
    badges = useMemo(() => {
      const result: Record<string, { count: number; severity: "normal" | "warning" | "critical" }> = {};

      // inbox: total items
      const inboxCount = unifiedInboxItems.length;
      if (inboxCount > 0) {
        const hasOverdue = unifiedInboxItems.some((i) => i.dueState.isOverdue);
        const hasBlocked = unifiedInboxItems.some((i) => !!i.blockedReason);
        result.inbox = {
          count: inboxCount,
          severity: hasOverdue ? "critical" : hasBlocked ? "warning" : "normal",
        };
      }

      // quotes: items where sourceModule='quote' and triageGroup is needs_review or now
      const quoteReview = unifiedInboxItems.filter(
        (i) =>
          i.sourceModule === "quote" &&
          (i.triageGroup === "needs_review" || i.triageGroup === "now"),
      );
      if (quoteReview.length > 0) {
        result.quotes = { count: quoteReview.length, severity: "normal" };
      }

      // receiving: items where sourceModule='receiving' and blockedReason exists
      const receivingBlocked = unifiedInboxItems.filter(
        (i) => i.sourceModule === "receiving" && !!i.blockedReason,
      );
      if (receivingBlocked.length > 0) {
        result.receiving = { count: receivingBlocked.length, severity: "warning" };
      }

      // stock_risk: items where sourceModule='stock_risk' and priority='p0'
      const stockCritical = unifiedInboxItems.filter(
        (i) => i.sourceModule === "stock_risk" && i.priority === "p0",
      );
      if (stockCritical.length > 0) {
        result.stock_risk = { count: stockCritical.length, severity: "critical" };
      }

      return result;
    }, [unifiedInboxItems]);
  } catch {
    // OpsStoreProvider not mounted — badges stay empty
  }

  // ---------------------------------------------------------------------------
  // Sidebar content
  // ---------------------------------------------------------------------------

  const SidebarContent = () => (
    <div className="h-full flex flex-col bg-slate-900">
      {/* Logo — desktop */}
      <div className="h-14 hidden lg:flex items-center px-5 border-b border-slate-800 flex-shrink-0">
        <Link
          href="/dashboard"
          className="text-lg font-bold tracking-tight text-slate-100 hover:opacity-80 transition-opacity"
        >
          LabAxis
        </Link>
      </div>

      {/* Scrollable nav */}
      <div className="flex-1 overflow-y-auto px-3 pt-14 lg:pt-5 pb-4">
        {/* Mobile header */}
        <div className="flex items-center justify-between mb-4 lg:hidden">
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            메뉴
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMobileOpen(false)}
            className="h-7 w-7 text-slate-400"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Primary nav */}
        <nav className="space-y-0.5">
          {PRIMARY_NAV.map((item) => {
            const Icon = item.icon;
            const isActive = activeModule === item.module;
            const badge = item.badgeKey ? badges[item.badgeKey] : undefined;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-slate-800 text-white border-l-2 border-l-blue-500 pl-[10px]"
                    : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-300",
                )}
              >
                <Icon className={cn("h-4 w-4 flex-shrink-0", isActive ? "text-blue-400" : "")} />
                <span className="truncate">{item.label}</span>
                {badge && badge.count > 0 && (
                  <span
                    className={cn(
                      "ml-auto text-[10px] font-semibold tabular-nums min-w-[20px] text-center px-1.5 py-0.5 rounded-full",
                      badgeClasses(badge.severity),
                    )}
                  >
                    {badge.count}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Separator + Settings */}
        <div className="mt-6 pt-4 border-t border-slate-800">
          <nav className="space-y-0.5">
            {(() => {
              const Icon = SETTINGS_NAV.icon;
              const isActive = activeModule === SETTINGS_NAV.module;
              return (
                <Link
                  href={SETTINGS_NAV.href}
                  onClick={() => setIsMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-slate-800 text-white border-l-2 border-l-blue-500 pl-[10px]"
                      : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-300",
                  )}
                >
                  <Icon className={cn("h-4 w-4 flex-shrink-0", isActive ? "text-blue-400" : "")} />
                  <span className="truncate">{SETTINGS_NAV.label}</span>
                </Link>
              );
            })()}
          </nav>
        </div>

        {/* Admin section */}
        {isAdminOrOwner && (
          <div className="mt-4 pt-4 border-t border-slate-800">
            <p className="mb-2 px-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
              시스템 관리
            </p>
            <nav className="space-y-0.5">
              {ADMIN_NAV.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href || pathname?.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                      isActive
                        ? "bg-slate-800 text-white border-l-2 border-l-blue-500 pl-[10px]"
                        : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-300",
                    )}
                  >
                    <Icon className={cn("h-4 w-4 flex-shrink-0", isActive ? "text-blue-400" : "")} />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
      </div>

      {/* Bottom: service home link */}
      <div className="mt-auto p-3 border-t border-slate-800 flex-shrink-0">
        <Link
          href="/"
          onClick={() => setIsMobileOpen(false)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-500 hover:text-slate-400 hover:bg-slate-800/30 transition-colors"
        >
          <Home className="h-3.5 w-3.5" />
          <span>서비스 홈으로</span>
        </Link>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar (lg+) */}
      <aside className="hidden lg:flex lg:flex-col fixed inset-y-0 left-0 w-64 bg-slate-900 border-r border-slate-800 z-30">
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Mobile slide-in sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 h-full w-64 min-w-[16rem] bg-slate-900 border-r border-slate-800 z-50 mobile-sidebar transition-transform duration-300 shrink-0 lg:hidden",
          isMobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <SidebarContent />
      </aside>
    </>
  );
}
