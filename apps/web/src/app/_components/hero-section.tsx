"use client";

import { useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { HeroDemoFlowPanel } from "./home/hero-demo-flow-panel";

// HeroSection 컴포넌트 - 중복 정의 및 import 제거
export function HeroSection() {
  const scrollToFlow = useCallback(() => {
    if (typeof window === "undefined") return;
    
    const el = document.getElementById("flow-section");
    if (el) {
      const headerHeight = 56;
      const elementTop = el.offsetTop;
      const offsetPosition = elementTop - headerHeight;

      window.scrollTo({
        top: Math.max(0, offsetPosition),
        behavior: "smooth",
      });
      return;
    }

    // 요소가 없으면 재시도
    const scrollToElement = (attempts = 0) => {
      const element = document.getElementById("flow-section");
      if (element) {
        const headerHeight = 56;
        const elementTop = element.offsetTop;
        const offsetPosition = elementTop - headerHeight;

        window.scrollTo({
          top: Math.max(0, offsetPosition),
          behavior: "smooth",
        });
      } else if (attempts < 20) {
        setTimeout(() => scrollToElement(attempts + 1), 100);
      }
    };
    
    setTimeout(() => scrollToElement(), 50);
  }, []);

  return (
    <section className="border-b border-slate-100 bg-white py-4 md:py-10">
      {/* 히어로만 살짝 더 안으로 */}
      <div className="mx-auto max-w-5xl px-3 md:px-6 lg:px-8 grid grid-cols-1 gap-4 md:gap-10 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] md:items-start">
        {/* 왼쪽: 제목 / 설명 / 버튼들 */}
        <div className="space-y-2 md:space-y-4 md:pr-6">
          <div className="inline-flex items-center gap-1.5 md:gap-2 rounded-full border border-slate-200 bg-white px-2.5 md:px-3 py-1 text-[10px] md:text-[11px] font-medium text-slate-600">
            <span className="mr-1 md:mr-2 h-1.5 w-1.5 rounded-full bg-blue-600" />
            <span>Beta</span>
            <span className="h-3 w-px bg-slate-300" />
            <span className="hidden sm:inline">바이오 시약·장비 견적 준비 도구</span>
            <span className="sm:hidden">견적 준비 도구</span>
          </div>

          <div className="space-y-1.5 md:space-y-3">
            <h1 className="text-xl md:text-3xl lg:text-4xl font-bold leading-tight text-slate-900">
              바이오 시약·장비 검색과 비교,{" "}
              <span className="whitespace-normal md:whitespace-nowrap">한 번에 정리되는 구매 요청 리스트</span>
            </h1>
            <p className="text-[11px] md:text-sm leading-relaxed text-slate-600 max-w-xl">
              GPT로 의미 분석하여 여러 벤더 제품을 한 번에 검색·비교하고,
              <br className="hidden sm:block" />
              구매 요청 리스트를 TSV/CSV/엑셀로 자동 생성해
              <br className="hidden sm:block" />
              그룹웨어/전자결재 양식에 바로 붙여넣을 수 있습니다.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-1.5 md:gap-3">
            <Link href="/test/search" className="flex-1 sm:flex-initial">
              <Button size="sm" className="w-full sm:w-auto bg-blue-600 text-white hover:bg-blue-700 text-xs md:text-base h-9 md:h-11">
                검색/비교 시작하기
              </Button>
            </Link>
            <button
              type="button"
              onClick={scrollToFlow}
              className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md h-9 md:h-11 px-4 md:px-8 text-[11px] md:text-sm font-medium border border-slate-300 bg-background text-slate-700 hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
            >
              플로우 보기
            </button>
          </div>
        </div>

        {/* 오른쪽: 플로우 패널 */}
        <div className="w-full max-w-sm md:justify-self-end">
          <HeroDemoFlowPanel />
        </div>
      </div>
    </section>
  );
}
