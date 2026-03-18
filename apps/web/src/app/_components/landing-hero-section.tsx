"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Search, ArrowRight, GitCompare, FileText, ShoppingCart, PackageCheck, Warehouse,
} from "lucide-react";

export function LandingHeroSection() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/test/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <section className="relative w-full pt-28 md:pt-36 pb-14 md:pb-20 bg-sh border-b border-bd">
      <div className="container px-4 md:px-6 mx-auto relative z-10">
        <div className="max-w-3xl mx-auto text-center">
          {/* Eyebrow */}
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-400 mb-5">
            연구 구매 운영 플랫폼
          </p>

          {/* Headline */}
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-[2.75rem] font-bold tracking-tight text-slate-100 leading-[1.3] break-keep mb-6 md:mb-8">
            시약·장비 구매 운영을
            <br />
            <span className="text-blue-400">하나의 흐름</span>으로 연결합니다
          </h1>

          {/* Sub */}
          <p className="text-sm md:text-base text-[#9ca3af] max-w-xl mx-auto leading-relaxed break-keep mb-8 md:mb-10">
            검색, 비교, 견적, 발주, 입고, 재고 운영까지 — 분절된 연구 구매 업무를
            하나의 플랫폼에서 이어지는 운영 체계로 정리하세요.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
            <Link href="/test/search">
              <Button className="h-11 px-8 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm">
                시약·장비 검색 시작하기
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/support">
              <Button variant="ghost" className="h-11 px-6 text-[#9ca3af] hover:text-slate-100 font-medium text-sm border border-bd hover:border-[#2a2e35]">
                도입 문의하기
              </Button>
            </Link>
          </div>

          {/* Compact Search */}
          <form onSubmit={handleSearch} className="flex items-center h-10 max-w-md mx-auto border border-bd rounded-md bg-pg px-3 focus-within:ring-1 focus-within:ring-blue-600/40 focus-within:border-blue-600/40 transition-all mt-0">
            <Search className="h-4 w-4 text-[#4b5563] flex-shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="시약명, CAS No., 제조사 검색"
              className="flex-1 bg-transparent px-2 text-sm text-slate-100 placeholder:text-[#4b5563] outline-none"
            />
            <Button type="submit" variant="ghost" size="sm" className="h-7 px-3 text-xs text-[#6b7280] hover:text-slate-100">
              검색
            </Button>
          </form>
        </div>

        {/* Pipeline strip */}
        <div className="mt-14 md:mt-16">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#4b5563] text-center mb-4">
            End-to-End Operations Pipeline
          </p>

          {/* Desktop */}
          <div className="hidden md:flex items-center justify-center gap-0">
            {[
              { icon: Search, label: "검색", sub: "시약·장비 통합 검색" },
              { icon: GitCompare, label: "비교", sub: "벤더별 스펙·가격 비교" },
              { icon: FileText, label: "견적", sub: "견적 요청·회신 관리" },
              { icon: ShoppingCart, label: "발주", sub: "승인·발주 전환" },
              { icon: PackageCheck, label: "입고", sub: "수령 확인·검수" },
              { icon: Warehouse, label: "재고", sub: "재고·운영 추적" },
            ].map((step, idx) => {
              const Icon = step.icon;
              return (
                <div key={step.label} className="flex items-center">
                  <div className="flex flex-col items-center gap-1.5 px-4 py-3 rounded-md hover:bg-pg transition-colors">
                    <div className="w-10 h-10 rounded-md flex items-center justify-center">
                      <Icon className="h-5 w-5 text-[#9ca3af]" strokeWidth={1.8} />
                    </div>
                    <span className="text-xs font-semibold text-slate-200">{step.label}</span>
                    <span className="text-[10px] text-[#4b5563] whitespace-nowrap">{step.sub}</span>
                  </div>
                  {idx < 5 && (
                    <div className="w-6 h-px bg-[#242429] flex-shrink-0" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Mobile: 2x3 */}
          <div className="md:hidden grid grid-cols-3 gap-2 px-2">
            {[
              { icon: Search, label: "검색" },
              { icon: GitCompare, label: "비교" },
              { icon: FileText, label: "견적" },
              { icon: ShoppingCart, label: "발주" },
              { icon: PackageCheck, label: "입고" },
              { icon: Warehouse, label: "재고" },
            ].map((step) => {
              const Icon = step.icon;
              return (
                <div key={step.label} className="flex flex-col items-center gap-1 py-2.5 rounded-md border border-bd bg-pg">
                  <Icon className="h-4 w-4 text-[#9ca3af]" strokeWidth={1.8} />
                  <span className="text-[11px] font-semibold text-slate-300">{step.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* "제품 흐름 자세히 보기" link */}
        <div className="mt-6 text-center">
          <Link href="/intro" className="text-xs text-[#6b7280] hover:text-blue-400 transition-colors">
            제품 흐름 자세히 보기 →
          </Link>
        </div>
      </div>
    </section>
  );
}
