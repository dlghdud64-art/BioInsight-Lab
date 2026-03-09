"use client";

import Link from "next/link";
import { UserMenu } from "@/components/auth/user-menu";
import { BioInsightLogo } from "@/components/bioinsight-logo";
import { Button } from "@/components/ui/button";
import { Menu, ScanLine, Search, FileText, Phone, Info, Headset, LayoutDashboard } from "lucide-react";
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

          {/* ── LEFT: 로고 (로그인 → 대시보드, 비로그인 → 홈) ── */}
          <Link href={session?.user ? "/dashboard" : "/"} className="flex items-center gap-2 flex-shrink-0">
            <BioInsightLogo showText={true} />
          </Link>

          {/* ── Sheet 드로어 내용 ────────────────────────── */}
          <SheetContent side="right" className="w-full sm:max-w-xs p-0 flex flex-col">

            {session?.user ? (
              /* ── 로그인: 프로필 + 제품 + 도입 + 지원 ── */
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

                {/* ── 운영 허브 ── */}
                <nav className="px-4 pt-4 pb-2">
                  <div className="px-1 pb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">운영 허브</div>
                  <SheetClose asChild>
                    <Link href="/dashboard" className="flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-50 rounded-lg mb-0.5 transition-colors">
                      <LayoutDashboard className="h-4 w-4 text-blue-500" />
                      대시보드
                    </Link>
                  </SheetClose>
                </nav>

                {/* ── 제품 ── */}
                <nav className="px-4 pb-2">
                  <div className="px-1 pb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">제품</div>
                  <SheetClose asChild>
                    <Link href="/test/search" className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg mb-0.5 transition-colors">
                      <Search className="h-4 w-4 text-slate-400" />
                      AI 검색 및 견적
                    </Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <Link href="/protocol/bom" className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg mb-0.5 transition-colors">
                      <FileText className="h-4 w-4 text-slate-400" />
                      프로토콜 맞춤 견적
                    </Link>
                  </SheetClose>
                </nav>

                {/* ── 도입 ── */}
                <nav className="px-4 pb-2">
                  <div className="px-1 pb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">도입</div>
                  <SheetClose asChild>
                    <Link href="/pricing" className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg mb-0.5 transition-colors">
                      <Phone className="h-4 w-4 text-slate-400" />
                      요금 &amp; 도입
                    </Link>
                  </SheetClose>
                </nav>

                {/* ── 지원 ── */}
                <nav className="px-4 pb-2">
                  <div className="px-1 pb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">지원</div>
                  <SheetClose asChild>
                    <Link href="/support" className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg transition-colors">
                      <Headset className="h-4 w-4 text-slate-400" />
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
                  <div className="px-1 pb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">제품</div>
                  <SheetClose asChild>
                    <Link href="/intro" className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-slate-900 hover:bg-slate-50 rounded-lg mb-0.5 transition-colors">
                      <Info className="h-4 w-4 text-slate-400" />
                      제품 소개
                    </Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <Link href="/test/search" className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-slate-900 hover:bg-slate-50 rounded-lg mb-0.5 transition-colors">
                      <Search className="h-4 w-4 text-slate-400" />
                      AI 검색 및 견적
                    </Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <Link href="/protocol/bom" className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-slate-900 hover:bg-slate-50 rounded-lg mb-0.5 transition-colors">
                      <FileText className="h-4 w-4 text-slate-400" />
                      프로토콜 맞춤 견적
                    </Link>
                  </SheetClose>
                </nav>

                {/* ── 도입 ── */}
                <nav className="px-4 pb-2">
                  <div className="px-1 pb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">도입</div>
                  <SheetClose asChild>
                    <Link href="/pricing" className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-slate-900 hover:bg-slate-50 rounded-lg mb-0.5 transition-colors">
                      <Phone className="h-4 w-4 text-slate-400" />
                      요금 &amp; 도입
                    </Link>
                  </SheetClose>
                </nav>

                {/* ── 지원 ── */}
                <nav className="px-4 pb-2">
                  <div className="px-1 pb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">지원</div>
                  <SheetClose asChild>
                    <Link href="/support" className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-slate-900 hover:bg-slate-50 rounded-lg transition-colors">
                      <Headset className="h-4 w-4 text-slate-400" />
                      고객 지원 및 문의
                    </Link>
                  </SheetClose>
                </nav>
              </div>
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
                      무료로 시작하기
                    </Button>
                  </Link>
                </SheetClose>
              )}
            </div>
          </SheetContent>

          {/* ── RIGHT: 데스크탑 nav + UserMenu + 모바일 QR + 햄버거 ── */}
          <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
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

            {/* 데스크탑 네비게이션 */}
            <nav className="hidden md:flex items-center gap-0.5 mr-1">
              {session?.user ? (
                /* ── 로그인: [대시보드] [검색 시작하기(강조)] ── */
                <>
                  <Link
                    href="/dashboard"
                    className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5"
                  >
                    <LayoutDashboard className="h-3.5 w-3.5" />
                    대시보드
                  </Link>
                  <Link
                    href="/test/search"
                    className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg px-4 py-1.5 transition-colors whitespace-nowrap shadow-sm"
                  >
                    <Search className="h-3.5 w-3.5" />
                    검색 시작하기
                  </Link>
                </>
              ) : (
                /* ── 비로그인: [요금&도입] [로그인] [시작하기] ── */
                <>
                  <Link
                    href="/pricing"
                    className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors whitespace-nowrap"
                  >
                    요금 &amp; 도입
                  </Link>
                  <Link
                    href="/auth/signin?callbackUrl=/dashboard"
                    className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors whitespace-nowrap"
                  >
                    로그인
                  </Link>
                  <Link
                    href="/auth/signin?callbackUrl=/dashboard"
                    className="inline-flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg px-5 py-2 transition-colors whitespace-nowrap shadow-sm"
                  >
                    무료로 시작하기
                  </Link>
                </>
              )}
            </nav>

            {/* 프로필 메뉴 */}
            <UserMenu />

            {/* 햄버거 버튼 */}
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
