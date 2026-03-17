"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function FinalCTASection() {
  return (
    <section className="py-16 md:py-24 bg-[#070a0e] border-t border-[#1a1e24]">
      <div className="mx-auto max-w-3xl px-4 md:px-6 text-center">
        <div className="space-y-4 mb-8">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#4b5563]">
            Get Started
          </p>
          <h2 className="text-lg md:text-2xl lg:text-3xl font-bold text-slate-100 tracking-tight leading-tight break-keep">
            검색 도구를 넘어서,
            <br />연구 구매 운영의 기준을 만들고 싶다면
          </h2>
          <p className="text-sm md:text-base text-[#9ca3af] max-w-lg mx-auto leading-relaxed break-keep">
            LabAxis는 시약·장비 검색부터 비교, 견적, 발주, 입고, 재고 운영까지
            반복되는 연구 구매 흐름을 하나의 운영 체계로 연결합니다.
          </p>
          <p className="text-xs text-[#6b7280]">
            연구팀·바이오팀·구매팀의 반복 구매 운영에 최적화된 플랫폼입니다.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/test/search" className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto h-11 px-10 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm flex items-center justify-center gap-2">
              시약·장비 검색 시작하기
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/support" className="w-full sm:w-auto">
            <Button variant="ghost" className="w-full sm:w-auto h-11 px-8 border border-[#1e2228] text-[#9ca3af] hover:text-slate-100 hover:border-[#2a2e35] font-medium text-sm">
              도입 문의하기
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
