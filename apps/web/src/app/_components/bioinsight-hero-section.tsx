"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Search, ArrowRight, GitCompare, FileText, ShoppingCart, PackageCheck,
  Warehouse, AlertTriangle, Clock, RefreshCw,
} from "lucide-react";

/* ── Hero 우측: 운영 패널 조합 (decorative card가 아닌 실제 운영 화면 축약) ── */
function OpsVisual() {
  return (
    <div className="hidden lg:flex flex-col gap-2.5 w-full max-w-sm">
      {/* 검색 결과 축약 */}
      <div className="bg-[#121619] border border-[#1e2228] rounded-md p-3">
        <p className="text-[10px] font-medium uppercase tracking-wider text-[#6b7280] mb-2">검색 결과</p>
        <div className="space-y-1.5">
          {["FBS (Fetal Bovine Serum)", "DMEM High Glucose"].map((item) => (
            <div key={item} className="flex items-center justify-between">
              <span className="text-xs text-slate-300">{item}</span>
              <span className="text-[10px] text-[#6b7280]">3 vendors</span>
            </div>
          ))}
        </div>
      </div>

      {/* 비교 판단 축약 */}
      <div className="bg-[#121619] border border-[#1e2228] rounded-md p-3">
        <p className="text-[10px] font-medium uppercase tracking-wider text-[#6b7280] mb-2">비교 판단</p>
        <div className="flex items-center gap-2">
          <GitCompare className="h-3.5 w-3.5 text-blue-400" />
          <span className="text-xs text-slate-300">FBS 3종 비교 완료</span>
          <span className="text-[10px] text-emerald-400 ml-auto">판정 완료</span>
        </div>
      </div>

      {/* 재주문 제안 */}
      <div className="bg-[#121619] border border-[#1e2228] rounded-md p-3">
        <p className="text-[10px] font-medium uppercase tracking-wider text-[#6b7280] mb-2">재주문 제안</p>
        <div className="flex items-center gap-2">
          <RefreshCw className="h-3.5 w-3.5 text-amber-400" />
          <span className="text-xs text-slate-300">DPBS 안전재고 미달</span>
          <span className="text-[10px] text-amber-400 ml-auto">발주 권장</span>
        </div>
      </div>

      {/* Lot-Expiry 리스크 */}
      <div className="bg-[#121619] border border-[#1e2228] rounded-md p-3">
        <p className="text-[10px] font-medium uppercase tracking-wider text-[#6b7280] mb-2">Lot·유효기한 리스크</p>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
            <span className="text-xs text-slate-300">Trypsin Lot#2024-A</span>
            <span className="text-[10px] text-red-400 ml-auto">D-7</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-xs text-slate-300">DMEM Lot#2024-B</span>
            <span className="text-[10px] text-amber-400 ml-auto">D-21</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LabAxisHeroSection() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/test/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <section className="relative w-full pt-28 md:pt-36 pb-16 md:pb-20 bg-[#070a0e] border-b border-[#1a1e24]">
      <div className="container px-4 md:px-6 mx-auto relative z-10">
        <div className="flex items-start gap-12 lg:gap-16">
          {/* 좌측: Value proposition */}
          <div className="flex-1 space-y-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-400">
              Biotech Procurement Operations Platform
            </p>
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-[2.75rem] font-bold tracking-tight text-slate-100 leading-[1.2] break-keep">
              검색부터 비교, 견적, 발주,
              <br />입고, 재고 운영까지
              <br /><span className="text-blue-400">하나의 축에서 관리합니다</span>
            </h1>
            <p className="text-sm md:text-base text-[#9ca3af] max-w-lg leading-relaxed break-keep">
              LabAxis는 연구팀의 반복 구매와 재고 운영을 하나의 흐름으로 연결합니다.
              시약·장비 검색, 대체품 비교, 견적 요청, 구매 추적, 입고 등록, lot·유효기간 관리까지
              분절된 업무를 하나의 운영 체계로 정리하세요.
            </p>

            {/* CTAs */}
            <div className="flex items-center gap-3 pt-2">
              <Link href="/test/search">
                <Button className="h-11 px-8 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm">
                  시약·장비 검색 시작하기
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/support">
                <Button variant="ghost" className="h-11 px-6 text-[#9ca3af] hover:text-slate-100 font-medium text-sm border border-[#1e2228] hover:border-[#2a2e35]">
                  도입 문의하기
                </Button>
              </Link>
            </div>

            {/* Compact Search */}
            <form onSubmit={handleSearch} className="flex items-center h-10 max-w-md border border-[#1e2228] rounded-md bg-[#121619] px-3 focus-within:ring-1 focus-within:ring-blue-600/40 focus-within:border-blue-600/40 transition-all mt-4">
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

          {/* 우측: 운영 패널 조합 */}
          <OpsVisual />
        </div>

        {/* 하단 6-step 파이프라인 (모바일: 2x3, 데스크탑: horizontal) */}
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
                  <div className="flex flex-col items-center gap-1.5 px-4 py-3 rounded-md hover:bg-[#121619] transition-colors">
                    <div className="w-10 h-10 rounded-md border border-[#1e2228] bg-[#121619] flex items-center justify-center">
                      <Icon className="h-5 w-5 text-[#9ca3af]" strokeWidth={1.8} />
                    </div>
                    <span className="text-xs font-semibold text-slate-200">{step.label}</span>
                    <span className="text-[10px] text-[#4b5563] whitespace-nowrap">{step.sub}</span>
                  </div>
                  {idx < 5 && (
                    <div className="w-6 h-px bg-[#1e2228] flex-shrink-0" />
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
                <div key={step.label} className="flex flex-col items-center gap-1 py-2.5 rounded-md border border-[#1e2228] bg-[#121619]">
                  <Icon className="h-4 w-4 text-[#9ca3af]" strokeWidth={1.8} />
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
