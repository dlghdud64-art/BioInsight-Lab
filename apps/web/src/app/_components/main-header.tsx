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
import { Search, GitCompare, FileText, FlaskConical, ShoppingCart } from "lucide-react";

// UTF-8 인코딩 문제로 인한 한글 깨짐 수정
export function MainHeader() {
  const router = useRouter();

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
    <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-slate-200">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        {/* 좌측: 로고 + 섹션 네비 */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <BioInsightLogo />
          </Link>
          <nav className="hidden md:flex items-center gap-4 text-sm text-slate-600">
            <button
              type="button"
              onClick={() => scrollToId("features")}
              className="hover:text-slate-900 transition-colors"
            >
              기능 소개
            </button>
            <button
              type="button"
              onClick={() => scrollToId("flow-section")}
              className="hover:text-slate-900 transition-colors"
            >
              사용 흐름
            </button>
            <button
              type="button"
              onClick={() => scrollToId("personas")}
              className="hover:text-slate-900 transition-colors"
            >
              누가 쓰나요?
            </button>
          </nav>
        </div>

        {/* 우측: CTA/유틸 */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => scrollToId("pricing")}
            className="text-xs text-slate-600 hover:text-slate-900 transition-colors"
          >
            요금 & 도입
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                className="text-xs bg-blue-600 hover:bg-blue-700 text-white"
              >
                기능 체험
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
                  <span>품목 리스트</span>
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
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
