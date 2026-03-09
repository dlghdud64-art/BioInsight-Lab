"use client";

import Link from "next/link";
import { UserMenu } from "@/components/auth/user-menu";
import { BioInsightLogo } from "@/components/bioinsight-logo";
import { Button } from "@/components/ui/button";
import { Menu, ScanLine } from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import { useToast } from "@/hooks/use-toast";
import { useQRScanner } from "@/contexts/QRScannerContext";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";

interface MainHeaderProps {
  onMenuClick?: () => void;
  pageTitle?: string;
  showMenuIcon?: boolean;
}

export function MainHeader({ onMenuClick, pageTitle, showMenuIcon = false }: MainHeaderProps) {
  const { data: session } = useSession();
  const { toast } = useToast();
  const { open: openQRScanner } = useQRScanner();

  const handleScanClick = () => {
    if (!session?.user) {
      toast({
        title: "로그인 후 이용 가능한 기능입니다.",
        description: "재고 QR 스캔은 로그인 후 사용할 수 있습니다.",
        variant: "destructive",
      });
      return;
    }
    openQRScanner();
  };

  return (
    <header className="fixed top-0 left-0 w-full z-40 bg-white/80 backdrop-blur-md border-b border-gray-100 h-14">
      <Sheet>
        <div className="w-full flex h-14 items-center justify-between px-4 md:max-w-6xl md:mx-auto">

          {/* ── LEFT: 로고 (모든 해상도) ──────────────────────────────── */}
          <Link
            href="/"
            className="flex items-center gap-2 flex-shrink-0"
          >
            <BioInsightLogo showText={true} />
          </Link>

          {/* Sheet 드로어 내용 */}
          <SheetContent side="right" className="w-full sm:max-w-xs p-0 flex flex-col">

            {session?.user ? (
              /* ── 로그인: 프로필 카드 + CTA + 기본 링크 ── */
              <div className="flex flex-col flex-1 overflow-y-auto">
                {/* 프로필 카드 */}
                <div className="px-5 pt-16 pb-5 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-base font-bold text-blue-600">
                        {session.user.name
                          ? session.user.name.charAt(0).toUpperCase()
                          : session.user.email?.charAt(0).toUpperCase() ?? "U"}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{session.user.name || "사용자"}</p>
                      <p className="text-xs text-slate-500 truncate">{session.user.email}</p>
                    </div>
                  </div>
                </div>

                {/* 대시보드 CTA */}
                <div className="px-4 pt-4 pb-2">
                  <SheetClose asChild>
                    <Link
                      href="/dashboard"
                      className="flex items-center justify-center w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl py-3 transition-colors shadow-sm"
                    >
                      내 워크스페이스 열기
                    </Link>
                  </SheetClose>
                </div>

                {/* 랜딩 기본 링크 */}
                <nav className="px-2 pt-2 pb-2 space-y-1">
                  <div className="px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">핵심 기능</div>
                  <SheetClose asChild>
                    <Link href="/test/search" className="block px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-md">AI 데이터 분석</Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <Link href="/protocol/bom" className="block px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-md">프로토콜 분석</Link>
                  </SheetClose>
                  <div className="px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">서비스</div>
                  <SheetClose asChild>
                    <Link href="/intro" className="block px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-md">서비스 소개</Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <Link href="/pricing" className="block px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-md">요금 &amp; 도입</Link>
                  </SheetClose>
                </nav>
              </div>
            ) : (
              /* ── 비로그인: Public 메뉴 ── */
              <nav className="flex-1 overflow-y-auto">
                <div className="px-2 pt-20 pb-2 space-y-1">
                  <div className="px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">핵심 기능</div>
                  <SheetClose asChild>
                    <Link href="/test/search" className="block px-3 py-2.5 text-sm font-medium text-slate-900 hover:bg-slate-50 rounded-md">AI 데이터 분석</Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <Link href="/protocol/bom" className="block px-3 py-2.5 text-sm font-medium text-slate-900 hover:bg-slate-50 rounded-md">프로토콜 분석</Link>
                  </SheetClose>
                  <div className="mt-2 px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">서비스</div>
                  <SheetClose asChild>
                    <Link href="/intro" className="block px-3 py-2.5 text-sm font-medium text-slate-900 hover:bg-slate-50 rounded-md">서비스 소개</Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <Link href="/pricing" className="block px-3 py-2.5 text-sm font-medium text-slate-900 hover:bg-slate-50 rounded-md">요금 &amp; 도입</Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <Link href="/support" className="block px-3 py-2.5 text-sm font-medium text-slate-900 hover:bg-slate-50 rounded-md">고객 지원 및 문의</Link>
                  </SheetClose>
                </div>
              </nav>
            )}

            {/* 하단 CTA */}
            <div className="mt-auto border-t border-slate-200 px-4 py-4">
              {session?.user ? (
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="w-full text-left px-3 py-3 text-sm font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors"
                >
                  로그아웃
                </button>
              ) : (
                <SheetClose asChild>
                  <Link href="/auth/signin?callbackUrl=/dashboard">
                    <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-11 rounded-lg text-sm">
                      로그인 / 시작하기
                    </Button>
                  </Link>
                </SheetClose>
              )}
            </div>
          </SheetContent>

          {/* ── RIGHT: 데스크탑 nav + 공통 버튼 + UserMenu + 모바일 QR + 햄버거 ── */}
          <div className="flex items-center gap-3 md:gap-4 flex-shrink-0">
            {/* QR 스캔 - 로그인 유저 · 모바일 전용 */}
            {session?.user && (
              <button
                type="button"
                onClick={handleScanClick}
                className="md:hidden inline-flex items-center justify-center h-8 w-8 rounded-full text-slate-500 hover:text-blue-600 hover:bg-slate-100 transition-colors"
                aria-label="재고 QR 스캔"
              >
                <ScanLine className="h-4 w-4" />
              </button>
            )}

            {/* 데스크탑 텍스트 네비게이션 - 비로그인 · md 이상만 표시 */}
            {!session?.user && (
              <nav className="hidden md:flex items-center gap-6 mr-2">
                <Link
                  href="/pricing"
                  className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors whitespace-nowrap"
                >
                  요금 &amp; 도입
                </Link>
                <Link
                  href="/auth/signin?callbackUrl=/dashboard"
                  className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors whitespace-nowrap"
                >
                  로그인
                </Link>
              </nav>
            )}

            {/* Get Started CTA - 비로그인 · PC 전용 */}
            {!session?.user && (
              <Link
                href="/auth/signin?callbackUrl=/dashboard"
                className="hidden md:inline-flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg px-5 py-2 transition-colors whitespace-nowrap shadow-sm"
              >
                Get Started
              </Link>
            )}

            {/* 프로필 메뉴 */}
            <UserMenu />

            {/* 햄버거 버튼 (모든 해상도) */}
            <SheetTrigger asChild>
              <button
                className="p-2 -mr-1 text-gray-700 hover:text-gray-900 transition-colors flex-shrink-0 touch-manipulation"
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
