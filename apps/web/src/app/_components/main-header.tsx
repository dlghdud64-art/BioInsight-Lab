"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserMenu } from "@/components/auth/user-menu";
import { BioInsightLogo } from "@/components/bioinsight-logo";
import { Button } from "@/components/ui/button";
import { Menu, LayoutDashboard, ScanLine } from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import { useToast } from "@/hooks/use-toast";
import { useQRScanner } from "@/contexts/QRScannerContext";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";

interface MainHeaderProps {
  onMenuClick?: () => void;
  pageTitle?: string;
  showMenuIcon?: boolean;
}

export function MainHeader({ onMenuClick, pageTitle, showMenuIcon = false }: MainHeaderProps) {
  const pathname = usePathname();
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

  const isDashboard = pathname?.startsWith("/dashboard");

  return (
    <header className="fixed top-0 left-0 w-full z-[60] bg-white/80 backdrop-blur-md border-b border-gray-100 h-14">
      <Sheet>
        <div className="w-full flex h-14 items-center justify-between px-4 md:max-w-6xl md:mx-auto">

          {/* ── LEFT: 로고 (모바일 최좌측) ──────────────────────────────── */}
          <Link
            href="/"
            className={`flex items-center gap-2 flex-shrink-0 ${isDashboard ? "md:hidden" : ""}`}
          >
            <BioInsightLogo showText={true} />
          </Link>

          {/* Sheet 드로어 내용 */}
          <SheetContent side="left" className="md:hidden w-full sm:max-w-xs p-0 flex flex-col">
            <SheetHeader className="px-6 py-7 border-b-2 border-slate-100 bg-slate-50">
              <SheetTitle className="flex items-center gap-4 text-xl font-bold text-slate-900">
                <BioInsightLogo showText={true} />
              </SheetTitle>
              <SheetDescription className="mt-2 text-xs text-slate-500">
                {session?.user
                  ? "자주 사용하는 메뉴로 바로 이동하세요."
                  : "BioInsight Lab에 오신 것을 환영합니다."}
              </SheetDescription>
            </SheetHeader>

            {session?.user ? (
              /* ── 로그인: Private 메뉴 ── */
              <nav className="flex-1 overflow-y-auto">
                <div className="px-2 pt-6 pb-2 space-y-1">
                  <SheetClose asChild>
                    <Link href="/dashboard" className="block px-3 py-4 text-base font-medium text-slate-900 hover:bg-slate-50 rounded-md">
                      대시보드
                    </Link>
                  </SheetClose>

                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="purchases">
                      <AccordionTrigger className="px-3 text-base font-semibold text-slate-900">구매 및 예산</AccordionTrigger>
                      <AccordionContent className="px-3">
                        <div className="flex flex-col">
                          <SheetClose asChild><Link href="/dashboard/purchases" className="py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-md px-2">구매 내역</Link></SheetClose>
                          <SheetClose asChild><Link href="/dashboard/reports" className="py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-md px-2">구매 리포트</Link></SheetClose>
                          <SheetClose asChild><Link href="/dashboard/budget" className="py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-md px-2">예산 관리</Link></SheetClose>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="inventory">
                      <AccordionTrigger className="px-3 text-base font-semibold text-slate-900">재고 및 견적</AccordionTrigger>
                      <AccordionContent className="px-3">
                        <div className="flex flex-col">
                          <SheetClose asChild><Link href="/dashboard/inventory" className="py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-md px-2">재고 관리</Link></SheetClose>
                          <SheetClose asChild><Link href="/dashboard/quotes" className="py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-md px-2">견적 요청 관리</Link></SheetClose>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="system">
                      <AccordionTrigger className="px-3 text-base font-semibold text-slate-900">시스템 관리</AccordionTrigger>
                      <AccordionContent className="px-3">
                        <div className="flex flex-col">
                          <SheetClose asChild><Link href="/dashboard/organizations" className="py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-md px-2">조직 관리</Link></SheetClose>
                          <SheetClose asChild><Link href="/dashboard/settings" className="py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-md px-2">설정</Link></SheetClose>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="help">
                      <AccordionTrigger className="px-3 text-base font-semibold text-slate-900">도움말 &amp; 지원</AccordionTrigger>
                      <AccordionContent className="px-3">
                        <div className="flex flex-col">
                          <SheetClose asChild><Link href="/help" className="py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-md px-2">도움말 센터</Link></SheetClose>
                          <SheetClose asChild><Link href="/changelog" className="py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-md px-2">업데이트 로그</Link></SheetClose>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>
              </nav>
            ) : (
              /* ── 비로그인: Public 메뉴 ── */
              <nav className="flex-1 overflow-y-auto">
                <div className="px-2 pt-6 pb-2 space-y-1">
                  <SheetClose asChild>
                    <Link href="/" className="block px-3 py-4 text-base font-medium text-slate-900 hover:bg-slate-50 rounded-md">서비스 소개</Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <Link href="/pricing" className="block px-3 py-4 text-base font-medium text-slate-900 hover:bg-slate-50 rounded-md">요금 &amp; 도입</Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <Link href="/support" className="block px-3 py-4 text-base font-medium text-slate-900 hover:bg-slate-50 rounded-md">고객 지원 및 문의</Link>
                  </SheetClose>
                </div>
              </nav>
            )}

            {/* 하단 CTA */}
            <div className="border-t border-slate-200 px-4 py-4">
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

          {/* ── RIGHT: 데스크탑 nav + 공통 버튼 + UserMenu + 모바일 햄버거 ── */}
          <div className="flex items-center gap-3 md:gap-6 flex-shrink-0">
            {/* 데스크탑 내비게이션 */}
            <nav className="hidden md:flex items-center gap-6">
              <Link href="/intro" className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors whitespace-nowrap rounded px-2 py-1">
                서비스 소개
              </Link>
              <Link href="/pricing" className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors whitespace-nowrap rounded px-2 py-1">
                요금 &amp; 도입
              </Link>
            </nav>

            {/* Get Started - 비로그인 · 데스크탑 */}
            {!session?.user && (
              <Link href="/auth/signin?callbackUrl=/test/search" className="hidden md:inline-flex">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 h-9 rounded-lg shadow-md whitespace-nowrap">
                  Get Started
                </Button>
              </Link>
            )}

            {/* 대시보드 버튼 - 로그인 · 데스크탑 */}
            {session?.user && (
              <Link href="/dashboard" className="hidden md:inline-flex">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-1.5 border-slate-200 rounded-full px-4 h-9 text-xs font-bold text-slate-900 hover:bg-slate-50"
                  aria-label="대시보드로 이동"
                >
                  <LayoutDashboard className="w-4 h-4 text-blue-600" strokeWidth={2.5} />
                  대시보드
                </Button>
              </Link>
            )}

            {/* QR 스캔 - 데스크탑 */}
            <button
              type="button"
              onClick={handleScanClick}
              className="hidden md:inline-flex items-center justify-center h-8 w-8 rounded-full text-slate-500 hover:text-blue-600 hover:bg-slate-100 transition-colors"
              aria-label="재고 QR 스캔"
            >
              <ScanLine className="h-4 w-4" />
            </button>

            {/* 프로필 메뉴 */}
            <UserMenu />

            {/* 모바일 햄버거 (최우측 끝) */}
            <SheetTrigger asChild>
              <button
                className="md:hidden p-2 -mr-1 text-gray-700 hover:text-gray-900 transition-colors flex-shrink-0 touch-manipulation"
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
