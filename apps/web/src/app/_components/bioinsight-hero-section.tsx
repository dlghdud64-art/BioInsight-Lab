import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Search, ArrowRight, GitCompare, FileText, ShoppingCart, PackageCheck,
  Warehouse, ChevronRight,
} from "lucide-react";

const PIPELINE_STEPS = [
  { icon: Search, label: "검색", sub: "시약·장비 통합 검색" },
  { icon: GitCompare, label: "비교", sub: "벤더별 스펙·가격 비교" },
  { icon: FileText, label: "견적", sub: "견적 요청·회신 관리" },
  { icon: ShoppingCart, label: "발주", sub: "승인·발주 전환" },
  { icon: PackageCheck, label: "입고", sub: "수령 확인·검수" },
  { icon: Warehouse, label: "재고", sub: "재고·운영 추적" },
];

export function BioInsightHeroSection() {
  return (
    <section className="relative w-full pt-32 md:pt-40 pb-20 md:pb-28 bg-pn border-b border-bs">
      <div className="container px-4 md:px-6 mx-auto relative z-10">
        {/* Value Proposition */}
        <div className="max-w-3xl mx-auto text-center mb-14 md:mb-20">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-400 mb-6 md:mb-8">
            Biotech Procurement Operations Platform
          </p>
          <h1 className="text-[1.625rem] sm:text-4xl md:text-[3.25rem] font-bold tracking-tight text-slate-100 leading-[1.4] md:leading-[1.4] break-keep mb-8 md:mb-10 max-w-[680px] mx-auto">
            구매 요청부터 입고·재고까지,
            <br />
            연구 구매 운영을
            <br className="hidden sm:block" />
            <span className="text-blue-400">한곳에서</span> 연결합니다
          </h1>
          <p className="text-sm md:text-lg text-slate-400 max-w-[520px] mx-auto leading-[1.7] break-keep mb-10 md:mb-12">
            시약·장비 검색, 비교, 견적, 발주, 입고, 재고 관리까지
            <br className="hidden sm:block" />
            흩어진 연구 구매 업무를 하나의 운영 흐름으로 연결하세요.
          </p>

          {/* CTAs */}
          <div className="flex items-center justify-center gap-4 mb-12 md:mb-16">
            <Link href="/test/search">
              <Button className="h-12 px-10 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm rounded-lg shadow-sm shadow-blue-600/20">
                시약·장비 검색 시작하기
                <Search className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/support">
              <Button variant="outline" className="h-12 px-8 border-bd text-slate-300 hover:text-slate-100 hover:bg-el font-medium text-sm rounded-lg">
                도입 문의하기
              </Button>
            </Link>
          </div>
        </div>

        {/* 6-Step Pipeline */}
        <div className="max-w-4xl mx-auto">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 text-center mb-4">
            End-to-End Operations Pipeline
          </p>

          {/* Desktop: horizontal */}
          <div className="hidden md:flex items-center justify-center gap-0">
            {PIPELINE_STEPS.map((step, idx) => {
              const Icon = step.icon;
              return (
                <div key={step.label} className="flex items-center">
                  <div className="flex flex-col items-center gap-1.5 px-4 py-3 rounded-md hover:bg-el transition-colors">
                    <div className="w-10 h-10 rounded-md border border-blue-500/30 bg-blue-600/15 flex items-center justify-center">
                      <Icon className="h-5 w-5 text-blue-400" strokeWidth={1.8} />
                    </div>
                    <span className="text-xs font-semibold text-slate-200">{step.label}</span>
                    <span className="text-[10px] text-slate-500 whitespace-nowrap">{step.sub}</span>
                  </div>
                  {idx < PIPELINE_STEPS.length - 1 && (
                    <ChevronRight className="h-4 w-4 text-slate-500 flex-shrink-0 mx-0.5" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Mobile: 2x3 grid */}
          <div className="md:hidden grid grid-cols-3 gap-2 px-2">
            {PIPELINE_STEPS.map((step) => {
              const Icon = step.icon;
              return (
                <div key={step.label} className="flex flex-col items-center gap-1 py-2.5 rounded-md border border-blue-500/30 bg-blue-600/15">
                  <Icon className="h-4 w-4 text-blue-400" strokeWidth={1.8} />
                  <span className="text-[11px] font-semibold text-slate-300">{step.label}</span>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </section>
  );
}
