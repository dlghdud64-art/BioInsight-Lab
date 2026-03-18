"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/test/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <section className="relative w-full pt-28 md:pt-36 pb-16 md:pb-20 bg-[#1a1a1e] border-b border-[#333338]">
      <div className="container px-4 md:px-6 mx-auto relative z-10">
        {/* Value Proposition */}
        <div className="max-w-3xl mx-auto text-center space-y-4 mb-10 md:mb-14">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-400 mb-2">
            Biotech Procurement Operations Platform
          </p>
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold tracking-tight text-slate-100 leading-tight break-keep">
            구매 요청부터 입고까지,{" "}
            <br className="hidden sm:block" />
            <span className="text-blue-400">운영 상태를 한눈에</span>
          </h1>
          <p className="text-sm md:text-base text-slate-400 max-w-xl mx-auto leading-relaxed break-keep">
            비교 → 견적 → 발주 → 입고 → 재고까지.
            연구실 구매 운영의 전 과정을 하나의 콘솔에서 추적하고 통제합니다.
          </p>

          {/* CTAs */}
          <div className="flex items-center justify-center gap-3 pt-4">
            <Link href="/dashboard">
              <Button className="h-11 px-8 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm">
                운영 콘솔 시작하기
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/support">
              <Button variant="ghost" className="h-11 px-6 text-slate-400 hover:text-slate-100 font-medium text-sm">
                데모 요청
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
                  <div className="flex flex-col items-center gap-1.5 px-4 py-3 rounded-md hover:bg-[#222226] transition-colors">
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

        {/* Compact Search Bar */}
        <div className="max-w-md mx-auto mt-10">
          <form onSubmit={handleSearch} className="flex items-center h-10 border border-[#333338] rounded-md bg-[#222226] px-3 focus-within:ring-1 focus-within:ring-slate-500 focus-within:border-slate-400 transition-all">
            <Search className="h-4 w-4 text-slate-400 flex-shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="시약명, CAS No., 제조사 검색"
              className="flex-1 bg-transparent px-2 text-sm text-slate-100 placeholder:text-slate-400 outline-none"
            />
            <Button type="submit" variant="ghost" size="sm" className="h-7 px-3 text-xs text-slate-400 hover:text-slate-100">
              검색
            </Button>
          </form>
        </div>
      </div>
    </section>
  );
}
