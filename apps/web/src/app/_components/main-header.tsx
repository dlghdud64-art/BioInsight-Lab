"use client";

import Link from "next/link";
import { UserMenu } from "@/components/auth/user-menu";
import { Button } from "@/components/ui/button";
import { Menu, Search, FileText, Phone, Info, Headset, LayoutDashboard, ClipboardList, ShoppingCart, Package } from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { BioInsightLogo } from "@/components/bioinsight-logo";

interface MainHeaderProps {
  onMenuClick?: () => void;
  pageTitle?: string;
  showMenuIcon?: boolean;
}

export function MainHeader({ onMenuClick, pageTitle, showMenuIcon = false }: MainHeaderProps) {
  const { data: session } = useSession();

  return (
    <header className="fixed top-0 left-0 w-full z-40 bg-[#111114]/80 backdrop-blur-md border-b border-[#333338] h-14">
      <Sheet>
        <div className="w-full flex h-14 items-center justify-between px-4 md:max-w-6xl md:mx-auto">

          {/* ── LEFT: 로고 → 항상 홈 ── */}
          <Link href="/" className="flex items-center gap-2 flex-shrink-0">
            <BioInsightLogo showText={true} variant="dark" />
          </Link>

          {/* ── Sheet 드로어 내용 ────────────────────────── */}
          <SheetContent side="right" className="w-full sm:max-w-xs p-0 flex flex-col">

            {session?.user ? (
              /* ── 로그인: 프로필 + 제품 + 도입 + 지원 ── */
              <div className="flex flex-col flex-1 overflow-y-auto">
                {/* 프로필 카드 */}
                <div className="px-5 pt-16 pb-5 border-b border-[#333338]">
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 rounded-full bg-blue-600/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-base font-bold text-blue-400">
                        {session.user.name
                          ? session.user.name.charAt(0).toUpperCase()
                          : session.user.email?.charAt(0).toUpperCase() ?? "U"}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-100 truncate">{session.user.name || "사용자"}</p>
                      <p className="text-xs text-slate-400 truncate">{session.user.email}</p>
                    </div>
                  </div>
                </div>

                {/* ── 앱으로 이동 ── */}
                <nav className="px-4 pt-4 pb-2">
                  <div className="px-1 pb-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">앱으로 이동</div>
                  <SheetClose asChild>
                    <Link href="/dashboard" className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-slate-300 hover:bg-[#2a2a2e] rounded-lg mb-0.5 transition-colors">
                      <LayoutDashboard className="h-4 w-4 text-blue-500" />
                      대시보드
                    </Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <Link href="/dashboard/quotes" className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-slate-300 hover:bg-[#2a2a2e] rounded-lg mb-0.5 transition-colors">
                      <ClipboardList className="h-4 w-4 text-slate-500" />
                      견적 관리
                    </Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <Link href="/dashboard/purchases" className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-slate-300 hover:bg-[#2a2a2e] rounded-lg mb-0.5 transition-colors">
                      <ShoppingCart className="h-4 w-4 text-slate-500" />
                      구매 운영
                    </Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <Link href="/dashboard/inventory" className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-slate-300 hover:bg-[#2a2a2e] rounded-lg mb-0.5 transition-colors">
                      <Package className="h-4 w-4 text-slate-500" />
                      재고 관리
                    </Link>
                  </SheetClose>
                </nav>

                {/* ── 제품 ── */}
                <nav className="px-4 pb-2">
                  <div className="px-1 pb-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">제품</div>
                  <SheetClose asChild>
                    <Link href="/app/search" className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-slate-300 hover:bg-[#2a2a2e] rounded-lg mb-0.5 transition-colors">
                      <Search className="h-4 w-4 text-slate-500" />
                      AI 검색 및 견적
                    </Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <Link href="/protocol/bom" className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-slate-300 hover:bg-[#2a2a2e] rounded-lg mb-0.5 transition-colors">
                      <FileText className="h-4 w-4 text-slate-500" />
                      프로토콜 맞춤 견적
                    </Link>
                  </SheetClose>
                </nav>

                {/* ── 지원 ── */}
                <nav className="px-4 pb-2">
                  <div className="px-1 pb-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">지원</div>
                  <SheetClose asChild>
                    <Link href="/support" className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-slate-300 hover:bg-[#2a2a2e] rounded-lg transition-colors">
                      <Headset className="h-4 w-4 text-slate-500" />
                      고객 지원 및 문의
                    </Link>
                  </SheetClose>
                </nav>
              </div>
            ) : (
              /* ── 비로그인: 제품 + 도입 + 지원 ── */
              <div className="flex flex-col flex-1 overflow-y-auto">
                {/* ── 제품 ── */}
                <nav className="px-4 pt-16 pb-2">
                  <div className="px-1 pb-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">제품</div>
                  <SheetClose asChild>
                    <Link href="/intro" className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-slate-100 hover:bg-[#2a2a2e] rounded-lg mb-0.5 transition-colors">
                      <Info className="h-4 w-4 text-slate-500" />
                      제품 소개
                    </Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <Link href="/search" className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-slate-100 hover:bg-[#2a2a2e] rounded-lg mb-0.5 transition-colors">
                      <Search className="h-4 w-4 text-slate-500" />
                      AI 검색 및 견적
                    </Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <Link href="/protocol/bom" className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-slate-100 hover:bg-[#2a2a2e] rounded-lg mb-0.5 transition-colors">
                      <FileText className="h-4 w-4 text-slate-500" />
                      프로토콜 맞춤 견적
                    </Link>
                  </SheetClose>
                </nav>

                {/* ── 도입 ── */}
                <nav className="px-4 pb-2">
                  <div className="px-1 pb-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">도입</div>
                  <SheetClose asChild>
                    <Link href="/pricing" className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-slate-100 hover:bg-[#2a2a2e] rounded-lg mb-0.5 transition-colors">
                      <Phone className="h-4 w-4 text-slate-500" />
                      요금 &amp; 도입
                    </Link>
                  </SheetClose>
                </nav>

                {/* ── 지원 ── */}
                <nav className="px-4 pb-2">
                  <div className="px-1 pb-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">지원</div>
                  <SheetClose asChild>
                    <Link href="/support" className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-slate-100 hover:bg-[#2a2a2e] rounded-lg transition-colors">
                      <Headset className="h-4 w-4 text-slate-500" />
                      고객 지원 및 문의
                    </Link>
                  </SheetClose>
                </nav>
              </div>
            )}

            {/* 하단 CTA */}
            <div className="mt-auto border-t border-[#333338] px-4 py-4">
              {session?.user ? (
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="w-full text-left px-3 py-3 text-sm font-medium text-red-400 hover:bg-red-950/30 rounded-md transition-colors"
                >
                  로그아웃
                </button>
              ) : (
                <SheetClose asChild>
                  <Link href="/auth/signin?callbackUrl=/app/dashboard">
                    <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-11 rounded-lg text-sm">
                      무료로 시작하기
                    </Button>
                  </Link>
                </SheetClose>
              )}
            </div>
          </SheetContent>

          {/* ── RIGHT: 데스크탑 nav + UserMenu + 모바일 QR + 햄버거 ── */}
          <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
            {/* 데스크탑 네비게이션 */}
            <nav className="hidden md:flex items-center gap-0.5 mr-1">
              {session?.user ? (
                /* ── 로그인: [검색] [대시보드로 이동(강조)] ── */
                <>
                  <Link
                    href="/app/search"
                    className="px-3 py-1.5 text-sm font-medium text-slate-400 hover:text-slate-100 transition-colors whitespace-nowrap"
                  >
                    검색
                  </Link>
                  <Link
                    href="/app/dashboard"
                    className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg px-4 py-1.5 transition-colors whitespace-nowrap shadow-sm"
                  >
                    <LayoutDashboard className="h-3.5 w-3.5" />
                    대시보드
                  </Link>
                </>
              ) : (
                /* ── 비로그인: [서비스소개] [요금&도입] [로그인] [시작하기] ── */
                <>
                  <Link
                    href="/intro"
                    className="px-3 py-1.5 text-sm font-medium text-slate-400 hover:text-slate-100 transition-colors whitespace-nowrap"
                  >
                    서비스 소개
                  </Link>
                  <Link
                    href="/pricing"
                    className="px-3 py-1.5 text-sm font-medium text-slate-400 hover:text-slate-100 transition-colors whitespace-nowrap"
                  >
                    요금 &amp; 도입
                  </Link>
                  <Link
                    href="/search"
                    className="px-3 py-1.5 text-sm font-medium text-slate-400 hover:text-slate-100 transition-colors whitespace-nowrap"
                  >
                    검색
                  </Link>
                  <Link
                    href="/auth/signin?callbackUrl=/app/dashboard"
                    className="px-3 py-1.5 text-sm font-medium text-slate-400 hover:text-slate-100 transition-colors whitespace-nowrap"
                  >
                    로그인
                  </Link>
                  <Link
                    href="/search"
                    className="inline-flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg px-5 py-2 transition-colors whitespace-nowrap shadow-sm"
                  >
                    무료로 시작하기
                  </Link>
                </>
              )}
            </nav>

            {/* 프로필 메뉴 (데스크탑 전용) */}
            <div className="hidden md:block">
              <UserMenu />
            </div>

            {/* 햄버거 버튼 */}
            <SheetTrigger asChild>
              <button
                className="p-2 -mr-1 text-slate-300 hover:text-slate-100 transition-colors flex-shrink-0 touch-manipulation"
                aria-label="전체 메뉴 열기"
                type="button"
              >
                <Menu className="h-6 w-6" />
              </button>
            </SheetTrigger>
          </div>

        </div>
      </Sheet>
    </header>
  );
}
