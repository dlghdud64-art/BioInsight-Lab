"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  ShoppingCart,
  Package,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BottomNavMoreSheet } from "./bottom-nav-more-sheet";

const tabs = [
  { label: "대시보드", href: "/dashboard", icon: LayoutDashboard, exact: true },
  { label: "견적", href: "/dashboard/quotes", icon: FileText, exact: false },
  { label: "구매", href: "/dashboard/purchases", icon: ShoppingCart, exact: false },
  { label: "재고", href: "/dashboard/inventory", icon: Package, exact: false },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const isActive = (href: string, exact: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  // "더보기" 시트에 포함된 경로들 — 더보기 탭 활성화 판단용
  const moreHrefs = [
    "/dashboard/reports",
    "/dashboard/budget",
    "/dashboard/analytics",
    "/dashboard/organizations",
    "/dashboard/safety",
    "/dashboard/settings",
    "/dashboard/activity-logs",
    "/dashboard/audit",
  ];
  const isMoreActive = moreHrefs.some((h) => pathname.startsWith(h));

  return (
    <>
      <nav className="fixed bottom-0 inset-x-0 z-50 border-t border-bd bg-sh lg:hidden safe-area-bottom">
        <div className="flex items-center justify-around h-14">
          {tabs.map((tab) => {
            const active = isActive(tab.href, tab.exact);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "relative flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors touch-manipulation",
                  active ? "text-blue-400" : "text-slate-500"
                )}
              >
                {active && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-blue-400" />
                )}
                <tab.icon className="h-5 w-5" />
                <span className="text-[10px] font-medium leading-none">{tab.label}</span>
              </Link>
            );
          })}

          {/* 더보기 */}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={cn(
              "relative flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors touch-manipulation",
              isMoreActive || moreOpen
                ? "text-blue-400"
                : "text-slate-500"
            )}
          >
            {isMoreActive && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-blue-400" />
            )}
            <MoreHorizontal className="h-5 w-5" />
            <span className="text-[10px] font-medium leading-none">더보기</span>
          </button>
        </div>
      </nav>

      <BottomNavMoreSheet open={moreOpen} onOpenChange={setMoreOpen} />
    </>
  );
}
