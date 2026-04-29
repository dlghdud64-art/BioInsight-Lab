"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Settings,
  Database,
  Activity,
  Shield,
  FileText,
  ShoppingCart,
  LogOut,
  Menu,
  X,
} from "lucide-react";

/**
 * §11.121 #admin-sidebar-mobile-drawer
 *
 * Desktop (md+): inline w-56 sidebar 항상 노출.
 * Mobile (< md): hidden by default + 우측 상단 fixed hamburger toggle →
 *   drawer 형태로 슬라이드 인 + backdrop overlay (탭 시 close).
 *
 * pathname 변경 시 drawer 자동 close — 운영자 메뉴 클릭 후 즉시 콘텐츠 노출.
 *
 * z-index layering:
 *   - hamburger trigger: z-30 (콘텐츠 위)
 *   - backdrop: z-40
 *   - drawer panel: z-50
 */

const ADMIN_MENU_ITEMS = [
  { title: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { title: "Quotes", href: "/admin/quotes", icon: FileText },
  { title: "Orders", href: "/admin/orders", icon: ShoppingCart },
  { title: "Users", href: "/admin/users", icon: Users },
  { title: "Organizations", href: "/admin/organizations", icon: Database },
  { title: "Activity Logs", href: "/admin/activity", icon: Activity },
  { title: "Settings", href: "/admin/settings", icon: Settings },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  // §11.122 — focus management refs
  const triggerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // pathname 변경 시 mobile drawer 자동 close
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // body scroll lock when drawer open (mobile)
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  // §11.122 — Esc key → close + focus trap (Tab 순환)
  useEffect(() => {
    if (!mobileOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileOpen(false);
        return;
      }
      if (e.key === "Tab" && drawerRef.current) {
        const focusable = drawerRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [mobileOpen]);

  // §11.122 — drawer open 시 close button 으로 initial focus,
  // close 시 hamburger trigger 로 focus 복귀
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (mobileOpen) {
      // 다음 frame 에서 focus (transition 후 안정화)
      const timer = setTimeout(() => {
        closeButtonRef.current?.focus();
      }, 50);
      wasOpenRef.current = true;
      return () => clearTimeout(timer);
    }
    if (wasOpenRef.current) {
      // open → close 전이 시 trigger button 으로 focus 복귀
      triggerRef.current?.focus();
      wasOpenRef.current = false;
    }
  }, [mobileOpen]);

  return (
    <>
      {/* Mobile hamburger trigger (md 미만에서만 노출) */}
      <button
        ref={triggerRef}
        type="button"
        className="md:hidden fixed top-3 left-3 z-30 inline-flex items-center justify-center h-9 w-9 rounded-lg bg-white border border-slate-200 shadow-sm text-slate-700 hover:bg-slate-50"
        onClick={() => setMobileOpen(true)}
        aria-label="관리자 메뉴 열기"
        aria-expanded={mobileOpen}
        aria-controls="admin-sidebar-drawer"
      >
        <Menu className="h-4 w-4" />
      </button>

      {/* Mobile backdrop (drawer open 시) */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar:
          - desktop (md+): inline w-56 (항상 노출)
          - mobile (< md): fixed drawer (mobileOpen 시 슬라이드 인) */}
      <aside
        ref={drawerRef}
        id="admin-sidebar-drawer"
        role="dialog"
        aria-modal={mobileOpen ? "true" : undefined}
        aria-label="관리자 메뉴"
        className={cn(
          "bg-slate-900 text-white flex flex-col w-56",
          // desktop: inline relative + 항상 노출
          "md:relative md:translate-x-0 md:min-h-screen",
          // mobile: fixed drawer
          "fixed inset-y-0 left-0 z-50 transform transition-transform duration-200 md:transition-none",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
      >
        {/* 헤더 */}
        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-400" />
            <div>
              <h2 className="font-bold text-sm">LabAxis</h2>
              <span className="text-[10px] text-blue-400 font-medium">Admin</span>
            </div>
          </div>
          {/* mobile close button */}
          <button
            ref={closeButtonRef}
            type="button"
            className="md:hidden inline-flex items-center justify-center h-7 w-7 rounded text-slate-400 hover:bg-slate-800 hover:text-white"
            onClick={() => setMobileOpen(false)}
            aria-label="메뉴 닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 네비게이션 */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {ADMIN_MENU_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-blue-600 text-white"
                    : "text-slate-400 hover:bg-slate-800 hover:text-white",
                )}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                {item.title}
              </Link>
            );
          })}
        </nav>

        {/* 하단 */}
        <div className="p-3 border-t border-slate-700">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Link>
        </div>
      </aside>
    </>
  );
}
