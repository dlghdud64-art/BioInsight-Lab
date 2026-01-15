"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useCallback } from "react";
import { UserMenu } from "@/components/auth/user-menu";
import { BioInsightLogo } from "@/components/bioinsight-logo";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { Search, GitCompare, FileText, FlaskConical, ShoppingCart, Menu, LayoutDashboard, Package, Shield } from "lucide-react";
import { useSession } from "next-auth/react";

interface MainHeaderProps {
  onMenuClick?: () => void;
  pageTitle?: string;
  showMenuIcon?: boolean;
}

// UTF-8 인코딩 문제로 인한 한글 깨짐 수정
export function MainHeader({ onMenuClick, pageTitle, showMenuIcon = false }: MainHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  
  // 대시보드 경로인지 확인 (대시보드에서는 사이드바에 로고가 있으므로 헤더 로고 숨김)
  const isDashboard = pathname?.startsWith("/dashboard");

  const scrollToId = useCallback((id: string) => {
    if (typeof window === "undefined") return;
    
    // 즉시 시도
    const element = document.getElementById(id);
    if (element) {
      const headerHeight = 56;
      const elementTop = element.offsetTop;
      const offsetPosition = elementTop - headerHeight;

      window.scrollTo({
        top: Math.max(0, offsetPosition),
        behavior: "smooth",
      });
      return;
    }

    // 요소가 없으면 잠시 후 재시도
    const scrollToElement = (attempts = 0) => {
      const el = document.getElementById(id);
      if (el) {
        const headerHeight = 56;
        const elementTop = el.offsetTop;
        const offsetPosition = elementTop - headerHeight;

        window.scrollTo({
          top: Math.max(0, offsetPosition),
          behavior: "smooth",
        });
      } else if (attempts < 20) {
        setTimeout(() => scrollToElement(attempts + 1), 100);
      }
    };
    
    // 약간의 지연 후 재시도 (DOM이 완전히 렌더링될 때까지)
    setTimeout(() => scrollToElement(), 50);
  }, []);

  return (
    <header className="fixed top-0 left-0 w-full z-[60] bg-white/80 backdrop-blur-md border-b border-gray-100 h-14">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        {/* 좌측: 메뉴 아이콘 (모바일) 또는 로고 */}
        <div className="flex items-center gap-2 md:gap-6 min-w-0 flex-1 overflow-hidden">
          {showMenuIcon && onMenuClick ? (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onMenuClick();
              }}
              onTouchStart={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onMenuClick();
              }}
              className="md:hidden p-2 -ml-2 text-gray-700 hover:text-gray-900 transition-colors flex-shrink-0 z-[70] relative touch-manipulation"
              aria-label="메뉴 열기"
              type="button"
            >
              <Menu className="h-5 w-5" />
            </button>
          ) : null}
          
          {/* 로고 - 랜딩 페이지에서는 항상 표시, 대시보드에서는 모바일에서만 표시 (데스크탑에서는 사이드바에 로고가 있으므로 숨김) */}
          <Link 
            href="/" 
            className={`${isDashboard ? "md:hidden" : ""} flex items-center gap-1.5 md:gap-2 flex-shrink-0 mr-4 md:mr-6 z-10 relative`}
          >
            <BioInsightLogo showText={true} />
          </Link>
          
          {/* 페이지 타이틀 - 모바일에서만 표시, truncate로 말줄임표 처리, flex-1로 남은 공간 차지 */}
          {pageTitle ? (
            <h1 className="text-sm md:text-lg font-semibold text-gray-900 truncate md:hidden flex-1 min-w-0 relative z-10">
              {pageTitle}
            </h1>
          ) : null}
        </div>

        {/* 우측: CTA/유틸 */}
        <div className="flex items-center gap-4 md:gap-3 flex-shrink-0">
          {/* 데스크탑 메뉴 */}
          <Link
            href="/intro"
            className="hidden md:inline-block text-[10px] md:text-xs text-slate-600 hover:text-slate-900 transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 rounded px-2 py-1"
            aria-label="서비스 소개 페이지로 이동"
          >
            서비스 소개
          </Link>
          <Link
            href="/pricing"
            className="hidden md:inline-block text-[10px] md:text-xs text-slate-600 hover:text-slate-900 transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 rounded px-2 py-1"
            aria-label="요금 및 도입 페이지로 이동"
          >
            요금 & 도입
          </Link>

          {/* 모바일 햄버거 메뉴 */}
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden h-9 w-9"
                aria-label="메뉴 열기"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] sm:w-[350px]">
              <div className="flex flex-col h-full pt-28">
                {/* 1. 네비게이션 링크 그룹 */}
                <div className="flex flex-col space-y-2">
                  <SheetClose asChild>
                    <Link
                      href="/intro"
                      className="text-base font-medium text-slate-700 hover:text-blue-600 hover:bg-slate-50 px-4 py-3 rounded-lg transition-colors"
                    >
                      서비스 소개
                    </Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <Link
                      href="/pricing"
                      className="text-base font-medium text-slate-700 hover:text-blue-600 hover:bg-slate-50 px-4 py-3 rounded-lg transition-colors"
                    >
                      요금 & 도입
                    </Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <Link
                      href="/#features"
                      className="text-base font-medium text-slate-700 hover:text-blue-600 hover:bg-slate-50 px-4 py-3 rounded-lg transition-colors"
                      onClick={(e) => {
                        e.preventDefault();
                        scrollToId("features");
                      }}
                    >
                      기능 살펴보기
                    </Link>
                  </SheetClose>
                </div>

                {/* 구분선 */}
                <div className="my-6 border-t border-slate-100" />

                {/* 2. 하단 액션 그룹 */}
                <div className="flex flex-col space-y-3 mt-auto pb-10">
                  {!session?.user ? (
                    <>
                      <SheetClose asChild>
                        <Link
                          href="/login"
                          className="text-sm font-medium text-slate-500 hover:text-slate-900 px-4 py-2 transition-colors"
                        >
                          로그인
                        </Link>
                      </SheetClose>
                      <SheetClose asChild>
                        <Button
                          asChild
                          className="w-full h-10 bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          <Link href="/test/search">무료 체험 시작하기</Link>
                        </Button>
                      </SheetClose>
                    </>
                  ) : (
                    <SheetClose asChild>
                      <Link
                        href="/dashboard"
                        className="text-base font-medium text-slate-700 hover:text-blue-600 hover:bg-slate-50 px-4 py-3 rounded-lg transition-colors"
                      >
                        대시보드
                      </Link>
                    </SheetClose>
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>
          {/* 체험 버튼 - 로그인 상태일 때 모바일에서 숨김 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                className={`${session?.user ? "hidden md:block" : ""} text-[10px] md:text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-2 md:px-3 h-8 md:h-9`}
                aria-label="기능 체험 메뉴 열기"
                aria-haspopup="true"
              >
                <span className="hidden sm:inline">기능 체험</span>
                <span className="sm:hidden">체험</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {/* Group 1: 구매 도구 */}
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground px-2 py-1.5">
                구매 도구
              </DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <Link href="/test/search" className="flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  <span>검색/AI 분석</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/compare" className="flex items-center gap-2">
                  <GitCompare className="h-4 w-4" />
                  <span>제품 비교</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/test/quote" className="flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  <span>견적 요청</span>
                </Link>
              </DropdownMenuItem>
              
              <DropdownMenuSeparator />
              
              {/* Group 2: 관리 도구 */}
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground px-2 py-1.5">
                관리 도구
              </DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <Link href="/dashboard/inventory" className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  <span>재고 관리</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/dashboard/safety" className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  <span>안전 관리</span>
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {/* 대시보드 버튼 - 로그인한 사용자에게만 표시 */}
          {session?.user && (
            <Link href="/dashboard">
              <Button
                size="sm"
                className="text-[10px] md:text-xs bg-gray-100 text-gray-900 hover:bg-gray-200 px-2 md:px-3 h-8 md:h-9"
                aria-label="대시보드로 이동"
              >
                <LayoutDashboard className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-1.5" />
                <span className="hidden sm:inline">대시보드</span>
                <span className="sm:hidden">대시</span>
              </Button>
            </Link>
          )}
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
