"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { HeroDemoFlowPanel } from "./home/hero-demo-flow-panel";
import { ArrowRight } from "lucide-react";

// HeroSection 컴포넌트 - 업무툴 스타일
export function HeroSection() {
  return (
    <section className="border-b border-slate-200 bg-gradient-to-b from-white via-slate-50/30 to-white py-8 md:py-16 lg:py-20">
      <div className="mx-auto max-w-6xl px-4 md:px-6 grid grid-cols-1 gap-4 md:gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:items-center">
        {/* 왼쪽: 제목 / 설명 / 버튼들 */}
        <div className="space-y-3 md:space-y-5">
          <div className="space-y-2.5 md:space-y-3">
            <h1 className="text-2xl md:text-4xl lg:text-5xl font-bold leading-tight tracking-tight text-slate-900">
              검색·비교·견적 요청을
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-emerald-600">
                한 번에
              </span>
            </h1>
            <p className="text-base md:text-lg lg:text-xl leading-relaxed text-slate-700 max-w-xl">
              구매 준비와 견적 요청 리스트를 <span className="font-semibold text-slate-900">자동으로 정리</span>하여{" "}
              <span className="font-semibold text-emerald-700 whitespace-nowrap">90% 시간을 절약</span>하세요.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 md:gap-3">
            <Link href="/test/search" className="flex-1 sm:flex-initial">
              <Button className="w-full sm:w-auto bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg hover:shadow-xl transition-all text-sm md:text-base px-5 md:px-6 py-5 md:py-6 h-auto min-h-[44px]">
                검색 시작하기
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/test/quote" className="flex-1 sm:flex-initial">
              <Button
                variant="outline"
                className="w-full sm:w-auto border-2 border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-400 text-sm md:text-base px-5 md:px-6 py-5 md:py-6 h-auto min-h-[44px]"
              >
                견적 요청 리스트
              </Button>
            </Link>
          </div>

          {/* Trust indicators */}
          <div className="flex items-center gap-4 md:gap-6 pt-1 md:pt-2 text-xs md:text-sm text-slate-500">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              <span>무료 체험</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              <span>즉시 시작</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-purple-500"></div>
              <span>회원가입 불필요</span>
            </div>
          </div>
        </div>

        {/* 오른쪽: 견적 시트 미리보기 */}
        <div className="w-full lg:max-w-lg lg:justify-self-end mt-4 md:mt-8 lg:mt-0">
          <HeroDemoFlowPanel />
        </div>
      </div>
    </section>
  );
}
