"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { UserMenu } from "@/components/auth/user-menu";
import { BioInsightLogo } from "@/components/bioinsight-logo";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, GitCompare, FileText, FlaskConical, ShoppingCart, Menu, LayoutDashboard } from "lucide-react";
import { useSession } from "next-auth/react";

interface MainHeaderProps {
  onMenuClick?: () => void;
  pageTitle?: string;
  showMenuIcon?: boolean;
}

// UTF-8 인코딩 문제로 인한 한글 깨짐 수정
export function MainHeader({ onMenuClick, pageTitle, showMenuIcon = false }: MainHeaderProps) {
  const router = useRouter();
  const { data: session } = useSession();

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
    <header className="fixed top-0 left-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-gray-100 h-14">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        {/* 좌측: 메뉴 아이콘 (모바일) 또는 로고 */}
        <div className="flex items-center gap-3 md:gap-6 min-w-0">
          {showMenuIcon && onMenuClick ? (
            <button
              onClick={onMenuClick}
              className="md:hidden p-2 -ml-2 text-gray-700 hover:text-gray-900 transition-colors"
              aria-label="메뉴 열기"
            >
              <Menu className="h-5 w-5" />
            </button>
          ) : null}
          {pageTitle ? (
            <h1 className="text-base md:text-lg font-semibold text-gray-900 truncate md:hidden">
              {pageTitle}
            </h1>
          ) : (
            <Link href="/" className="flex items-center gap-1.5 md:gap-2 flex-shrink-0">
              <BioInsightLogo />
            </Link>
          )}
          {pageTitle && (
            <Link href="/" className="hidden md:flex items-center gap-1.5 md:gap-2 flex-shrink-0">
              <BioInsightLogo />
            </Link>
          )}
        </div>

        {/* 우측: CTA/유틸 */}
        <div className="flex items-center gap-1.5 md:gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={() => scrollToId("pricing")}
            className="hidden sm:inline-block text-[10px] md:text-xs text-slate-600 hover:text-slate-900 transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 rounded px-2 py-1"
            aria-label="요금 및 도입 섹션으로 이동"
          >
            요금 & 도입
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                className="text-[10px] md:text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-2 md:px-3 h-8 md:h-9"
                aria-label="기능 체험 메뉴 열기"
                aria-haspopup="true"
              >
                <span className="hidden sm:inline">기능 체험</span>
                <span className="sm:hidden">체험</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
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
              <DropdownMenuItem asChild>
                <Link href="/protocol/bom" className="flex items-center gap-2">
                  <FlaskConical className="h-4 w-4" />
                  <span>프로토콜 분석</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/search" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <span>일반 검색</span>
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
