"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Inbox,
  Search,
  FileText,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BottomNavMoreSheet } from "./bottom-nav-more-sheet";
import { useOpsStoreSafe } from "@/lib/ops-console/ops-store";
import { resolveTopLevelModule } from "@/lib/ops-console/navigation-context";

const tabs = [
  { label: "오늘", href: "/dashboard", icon: LayoutDashboard, module: "today" as const },
  { label: "작업함", href: "/dashboard/inbox", icon: Inbox, module: "inbox" as const, badgeKey: "inbox" as const },
  { label: "검색", href: "/test/search", icon: Search, module: "search" as const },
  { label: "견적", href: "/dashboard/quotes", icon: FileText, module: "quotes" as const, badgeKey: "quotes" as const },
] as const;

// Modules shown in "More" sheet — used to determine if More tab should be active
const MORE_MODULES = ["purchase_orders", "receiving", "stock_risk", "settings", "admin"] as const;

export function BottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const activeModule = resolveTopLevelModule(pathname);

  // Badge counts from ops store (BottomNav is inside OpsStoreProvider via DashboardShell)
  const store = useOpsStoreSafe();
  const unifiedInboxItems = store?.unifiedInboxItems ?? [];
  const badgeCounts = useMemo(() => {
    const result: Record<string, number> = {};
    const inboxCount = unifiedInboxItems.length;
    if (inboxCount > 0) result.inbox = inboxCount;
    const quoteReview = unifiedInboxItems.filter(
      (i) => i.sourceModule === "quote" && (i.triageGroup === "needs_review" || i.triageGroup === "now"),
    ).length;
    if (quoteReview > 0) result.quotes = quoteReview;
    return result;
  }, [unifiedInboxItems]);

  const isMoreActive = (MORE_MODULES as readonly string[]).includes(activeModule);

  return (
    <>
      <nav className="fixed bottom-0 inset-x-0 z-50 border-t border-slate-800 bg-slate-900 lg:hidden safe-area-bottom">
        <div className="flex items-center justify-around h-14">
          {tabs.map((tab) => {
            const active = activeModule === tab.module;
            const badge = tab.badgeKey ? badgeCounts[tab.badgeKey] : undefined;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "relative flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors touch-manipulation",
                  active ? "text-blue-400" : "text-slate-500",
                )}
              >
                {active && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-blue-400" />
                )}
                <span className="relative">
                  <tab.icon className="h-5 w-5" />
                  {badge && badge > 0 && (
                    <span className="absolute -top-1 -right-2 min-w-[14px] h-[14px] flex items-center justify-center text-[9px] font-bold bg-blue-500 text-white rounded-full px-0.5">
                      {badge > 99 ? "99+" : badge}
                    </span>
                  )}
                </span>
                <span className="text-[10px] font-medium leading-none">{tab.label}</span>
              </Link>
            );
          })}

          {/* More */}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={cn(
              "relative flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors touch-manipulation",
              isMoreActive || moreOpen ? "text-blue-400" : "text-slate-500",
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
