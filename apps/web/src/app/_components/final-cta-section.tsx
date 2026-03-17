"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function FinalCTASection() {
  return (
    <section className="py-16 md:py-20 bg-white border-t border-slate-200">
      <div className="mx-auto max-w-3xl px-4 md:px-6 text-center">
        <div className="space-y-3 mb-8">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
            Get Started
          </p>
          <h2 className="text-lg md:text-3xl font-bold text-slate-900 tracking-tight leading-tight">
            구매 운영을 체계화하세요
          </h2>
          <p className="text-sm md:text-base text-slate-500 max-w-md mx-auto leading-relaxed break-keep">
            비교·견적·발주·입고·재고까지 끊기지 않는 운영 파이프라인.
            <br />
            운영 콘솔에서 전 과정을 추적하고 통제합니다.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
          <Link href="/dashboard" className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto h-11 px-10 bg-blue-700 hover:bg-blue-800 text-white font-semibold text-sm flex items-center justify-center gap-2">
              운영 콘솔 시작하기
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/support" className="w-full sm:w-auto">
            <Button variant="outline" className="w-full sm:w-auto h-11 px-8 border-slate-300 text-slate-600 hover:bg-slate-50 font-medium text-sm">
              도입 문의
            </Button>
          </Link>
        </div>

        <p className="text-[11px] text-slate-400">
          연구실·바이오팀의 반복 구매 운영에 최적화된 플랫폼입니다.
        </p>
      </div>
    </section>
  );
}
