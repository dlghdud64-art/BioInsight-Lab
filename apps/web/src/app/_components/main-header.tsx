"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserMenu } from "@/components/auth/user-menu";
import { BioInsightLogo } from "@/components/bioinsight-logo";
import { Button } from "@/components/ui/button";
import { Menu, LayoutDashboard } from "lucide-react";
import { useSession } from "next-auth/react";

interface MainHeaderProps {
  onMenuClick?: () => void;
  pageTitle?: string;
  showMenuIcon?: boolean;
}

// UTF-8 인코딩 문제로 인한 한글 깨짐 수정
export function MainHeader({ onMenuClick, pageTitle, showMenuIcon = false }: MainHeaderProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  
  // 대시보드 경로인지 확인 (대시보드에서는 사이드바에 로고가 있으므로 헤더 로고 숨김)
  const isDashboard = pathname?.startsWith("/dashboard");

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
        <div className="flex items-center gap-4 md:gap-6 flex-shrink-0">
          {/* 데스크탑 내비게이션 메뉴 */}
          <nav className="hidden md:flex items-center gap-6">
            <Link
              href="/intro"
              className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 rounded px-2 py-1"
              aria-label="서비스 소개 페이지로 이동"
            >
              서비스 소개
            </Link>
            <Link
              href="/pricing"
              className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 rounded px-2 py-1"
              aria-label="요금 및 도입 페이지로 이동"
            >
              요금 & 도입
            </Link>
          </nav>

          {/* 모바일 전용: Get Started 버튼 (햄버거 메뉴·다크모드 제거, 최우선 배치) */}
          <div className="flex md:hidden items-center gap-2">
            {!session?.user ? (
              <Link href="/auth/signin?callbackUrl=/test/search">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-1.5 rounded-full h-8 shadow-sm">
                  Get Started
                </Button>
              </Link>
            ) : (
              <Link href="/dashboard">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-1.5 border-slate-200 rounded-full px-4 h-8 text-xs font-bold text-slate-900"
                  aria-label="대시보드로 이동"
                >
                  <LayoutDashboard className="w-4 h-4 text-blue-600" strokeWidth={2.5} />
                  대시
                </Button>
              </Link>
            )}
          </div>
          {/* 로그인(ghost) + Get Started - 비로그인 시 데스크톱에 표시, 로그인 왼쪽 / Get Started 우측 끝 */}
          {!session?.user && (
            <div className="hidden md:flex items-center gap-4 ml-auto">
              <Link href="/auth/signin">
                <Button
                  variant="ghost"
                  className="text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white font-medium px-4 h-8 md:h-9 rounded-lg transition-all"
                >
                  로그인
                </Button>
              </Link>
              <Link href="/auth/signin?callbackUrl=/test/search">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2 h-8 md:h-9 rounded-lg transition-all shadow-md whitespace-nowrap">
                  Get Started
                </Button>
              </Link>
            </div>
          )}
          {/* 대시보드 버튼 - 로그인한 사용자, 데스크톱에만 표시 (모바일은 위 모바일 전용 영역에서 처리) */}
          {session?.user && (
            <Link href="/dashboard" className="hidden md:inline-flex">
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-1.5 border-slate-200 dark:border-slate-800 rounded-full px-4 h-8 md:h-9 text-[10px] md:text-xs font-bold text-slate-900 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                aria-label="대시보드로 이동"
              >
                <LayoutDashboard className="w-4 h-4 text-blue-600 dark:text-blue-400" strokeWidth={2.5} />
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
