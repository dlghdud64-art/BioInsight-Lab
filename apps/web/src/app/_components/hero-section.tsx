"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { HeroDemoFlowPanel } from "./home/hero-demo-flow-panel";

// HeroSection 컴포넌트 - 연구/구매 워크벤치 스타일
export function HeroSection() {
  return (
    <section className="border-b border-slate-200 bg-slate-50 py-6 md:py-12">
      <div className="mx-auto max-w-6xl px-4 md:px-6 lg:px-8 grid grid-cols-1 gap-6 md:gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:items-start">
        {/* 왼쪽: 제목 / 설명 / 버튼들 */}
        <div className="space-y-3 md:space-y-5">
          <div className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[10px] md:text-xs font-medium text-slate-600">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-600" />
            <span>Beta</span>
            <span className="h-3 w-px bg-slate-200" />
            <span className="hidden sm:inline">바이오 시약·장비 견적 준비 도구</span>
            <span className="sm:hidden">견적 준비 도구</span>
          </div>

          <div className="space-y-2 md:space-y-3">
            <h1 className="text-xl md:text-2xl lg:text-3xl font-bold leading-tight tracking-tight text-slate-900">
              검색 · 비교 · 견적 요청
              <br />
              <span className="text-slate-600">한 번에 정리</span>
            </h1>
            <p className="text-xs md:text-sm leading-relaxed text-slate-600 max-w-md">
              후보 제품을 모으고, 스펙·가격으로 비교해 추립니다.
              <br className="hidden sm:block" />
              견적 요청 리스트를 만들고 공유 링크/TSV·엑셀로 전달합니다.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 md:gap-3">
            <Link href="/test/search" className="flex-1 sm:flex-initial">
              <Button size="sm" className="w-full sm:w-auto bg-indigo-600 text-white hover:bg-indigo-700 text-xs md:text-sm h-9 md:h-10 rounded-md">
                검색 시작
              </Button>
            </Link>
            <Link href="/quotes" className="flex-1 sm:flex-initial">
              <Button
                size="sm"
                variant="outline"
                className="w-full sm:w-auto text-xs md:text-sm h-9 md:h-10 border-slate-300 bg-white text-slate-700 hover:bg-slate-50 rounded-md"
              >
                견적 요청 보기
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
