"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { HeroDemoFlowPanel } from "./home/hero-demo-flow-panel";

// HeroSection 컴포넌트 - 업무툴 스타일
export function HeroSection() {
  return (
    <section className="border-b border-slate-200 bg-white py-8 md:py-10">
      <div className="mx-auto max-w-6xl px-4 md:px-6 grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:items-start">
        {/* 왼쪽: 제목 / 설명 / 버튼들 */}
        <div className="space-y-2 md:space-y-3">
          <div className="space-y-1.5">
            <h1 className="text-xl md:text-2xl font-bold leading-tight tracking-tight text-slate-900">
              검색·비교·견적 요청을 한 번에
            </h1>
            <p className="text-sm leading-snug text-slate-700 max-w-lg">
              구매 준비/견적 요청 리스트를 자동으로 정리합니다.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <Link href="/test/search" className="flex-1 sm:flex-initial">
              <Button className="w-full sm:w-auto bg-indigo-500 text-white hover:bg-indigo-600 shadow-sm">
                검색 시작
              </Button>
            </Link>
            <Link href="/test/quote" className="flex-1 sm:flex-initial">
              <Button
                variant="outline"
                className="w-full sm:w-auto border-slate-300 bg-white text-slate-700 hover:bg-slate-100 hover:border-slate-400"
              >
                견적 요청 리스트
              </Button>
            </Link>
          </div>
        </div>

        {/* 오른쪽: 견적 시트 미리보기 */}
        <div className="w-full lg:max-w-lg lg:justify-self-end">
          <HeroDemoFlowPanel />
        </div>
      </div>
    </section>
  );
}
