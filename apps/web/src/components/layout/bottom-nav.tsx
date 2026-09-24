"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Truck,
  Package,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useInventoryAlertCount } from "@/hooks/use-inventory-alert-count";
import { BottomNavMoreSheet } from "./bottom-nav-more-sheet";

const tabs = [
  { label: "대시보드", href: "/dashboard", icon: LayoutDashboard, exact: true },
  { label: "견적", href: "/dashboard/quotes", icon: FileText, exact: false },
  // §purchases-ui-removed (2026-09-24 · 호영님 판정) — 구매 운영 화면 삭제. 플래그로 스왑하던 자리를 입고로 **고정**한다.
  { label: "입고", href: "/dashboard/receiving", icon: Truck, exact: false },
  { label: "재고", href: "/dashboard/inventory", icon: Package, exact: false },
] as const;


export function BottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  // §bottom-nav-badge P3 — 재고 탭 뱃지. canonical 훅(공유 isReorderNeeded 파생 count
  // 라우트) 만 경유 — seed/ops-store·heavy stats fetch 금지(F8). 로딩·에러 = null = 미렌더.
  const { count } = useInventoryAlertCount();

  // §purchases-ui-removed (2026-09-24 · 호영님 판정) — 스왑 분기 제거. 탭 목록이 곧 렌더 목록이다.
  const visibleTabs = tabs;

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
      <nav
        className="fixed bottom-0 inset-x-0 z-50 border-t border-bd bg-sh lg:hidden safe-area-bottom"
        aria-label="모바일 하단 메뉴"
      >
        <div className="flex items-center justify-around h-14">
          {visibleTabs.map((tab) => {
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
                <span className="relative">
                  <tab.icon className="h-5 w-5" />
                  {/* §11.311-6 — 재고 탭 red 뱃지(아이콘 우상단). 0건·로딩·에러 미렌더(가짜 카운트 0). */}
                  {tab.href === "/dashboard/inventory" &&
                    count != null &&
                    count > 0 && (
                      <span
                        aria-label={`재고 경고 ${count}건`}
                        className="absolute -top-1 -right-2 min-w-[15px] h-[15px] px-0.5 rounded-full bg-red-500 text-white text-[9.5px] font-bold leading-none flex items-center justify-center"
                      >
                        {count > 99 ? "99+" : count}
                      </span>
                    )}
                </span>
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
