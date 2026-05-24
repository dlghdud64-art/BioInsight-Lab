"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
// §11.298b Radix DropdownMenu* import 제거 — §11.295 프로필 패턴 정합
// plain button + useState + 조건부 backdrop + role="menu".
import { User, LogOut, Settings, CreditCard, HelpCircle, LayoutDashboard, ClipboardList, ShoppingCart, Package } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { USER_ROLES } from "@/lib/constants";
import { resetWorkbenchSessionOnLogout, invalidateWorkbenchQueryCache } from "@/lib/auth/workbench-session-reset";
import { useQueryClient } from "@tanstack/react-query";

export function UserMenu() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();

  // 로딩 상태는 최대 2초까지만 표시
  const [showLoading, setShowLoading] = useState(true);
  // §11.298b user-menu plain dropdown state.
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  
  useEffect(() => {
    if (status !== "loading") {
      setShowLoading(false);
    } else {
      // 2초 후에도 로딩 중이면 로딩 표시를 숨김
      const timer = setTimeout(() => {
        setShowLoading(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  if (status === "loading" && showLoading) {
    return <Button variant="ghost" disabled className="text-xs">로딩 중...</Button>;
  }

  // 비로그인 시 null - MainHeader에서 [로그인] [Get Started] 버튼을 별도 렌더링
  if (!session?.user) {
    return null;
  }

  return (
    <div className="relative">
      <Button
        variant="ghost"
        className="flex items-center gap-2"
        aria-label="사용자 메뉴"
        aria-expanded={isUserMenuOpen}
        aria-haspopup="menu"
        onClick={() => setIsUserMenuOpen((v) => !v)}
      >
        <User className="h-4 w-4 pointer-events-none" />
        {/* 사용자 이름 - 모바일에서 숨김 (Avatar만 표시) */}
        <span className="hidden md:inline">{session.user.name || session.user.email}</span>
      </Button>
      {isUserMenuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsUserMenuOpen(false)} aria-hidden="true" />
          <div role="menu" aria-label="사용자 메뉴" className="absolute right-0 top-full mt-2 w-56 rounded-md border border-slate-200 bg-white shadow-lg z-50 py-1">
            <button
              type="button"
              role="menuitem"
              onClick={() => { router.push("/dashboard/settings"); setIsUserMenuOpen(false); }}
              className="w-full px-3 py-2 text-left cursor-pointer hover:bg-slate-100"
            >
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">{session.user.name || "사용자"}</p>
                <p className="text-xs text-muted-foreground">{session.user.email}</p>
                {session.user.role && (
                  <p className="text-xs text-muted-foreground">
                    {USER_ROLES[session.user.role as keyof typeof USER_ROLES]}
                  </p>
                )}
              </div>
            </button>
            <div className="h-px bg-slate-100 my-1" />
            <Link href="/dashboard" role="menuitem" onClick={() => setIsUserMenuOpen(false)} className="flex items-center px-3 py-2 text-sm hover:bg-slate-100">
              <LayoutDashboard className="mr-2 h-4 w-4" />
              대시보드
            </Link>
            <Link href="/dashboard/quotes" role="menuitem" onClick={() => setIsUserMenuOpen(false)} className="flex items-center px-3 py-2 text-sm hover:bg-slate-100">
              <ClipboardList className="mr-2 h-4 w-4" />
              견적 관리
            </Link>
            <Link href="/dashboard/purchases" role="menuitem" onClick={() => setIsUserMenuOpen(false)} className="flex items-center px-3 py-2 text-sm hover:bg-slate-100">
              <ShoppingCart className="mr-2 h-4 w-4" />
              구매 운영
            </Link>
            <Link href="/dashboard/inventory" role="menuitem" onClick={() => setIsUserMenuOpen(false)} className="flex items-center px-3 py-2 text-sm hover:bg-slate-100">
              <Package className="mr-2 h-4 w-4" />
              재고 관리
            </Link>
            <div className="h-px bg-slate-100 my-1" />
            <Link href="/dashboard/settings" role="menuitem" onClick={() => setIsUserMenuOpen(false)} className="flex items-center px-3 py-2 text-sm hover:bg-slate-100">
              <Settings className="mr-2 h-4 w-4" />
              설정
            </Link>
            <Link href="/dashboard/settings?tab=billing" role="menuitem" onClick={() => setIsUserMenuOpen(false)} className="flex items-center px-3 py-2 text-sm hover:bg-slate-100">
              <CreditCard className="mr-2 h-4 w-4" />
              청구 및 구독
            </Link>
            <a href="mailto:support@labaxis.io" role="menuitem" onClick={() => setIsUserMenuOpen(false)} className="flex items-center px-3 py-2 text-sm hover:bg-slate-100">
              <HelpCircle className="mr-2 h-4 w-4" />
              고객센터
            </a>
            <div className="h-px bg-slate-100 my-1" />
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setIsUserMenuOpen(false);
                resetWorkbenchSessionOnLogout();
                invalidateWorkbenchQueryCache(queryClient);
                signOut({ callbackUrl: "/" });
              }}
              className="w-full flex items-center px-3 py-2 text-sm text-left hover:bg-slate-100"
            >
              <LogOut className="mr-2 h-4 w-4" />
              로그아웃
            </button>
          </div>
        </>
      )}
    </div>
  );
}
   