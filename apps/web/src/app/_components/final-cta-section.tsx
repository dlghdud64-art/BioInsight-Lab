"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function FinalCTASection() {
  return (
    <section className="py-16 md:py-20 border-t border-slate-800/40" style={{ backgroundColor: "#040810" }}>
      <div className="mx-auto max-w-2xl px-4 md:px-6 text-center">
        <div className="space-y-3 mb-8">
          <h2 className="text-lg md:text-2xl font-bold text-slate-200 tracking-tight leading-tight">
            구매 운영을 체계화하세요
          </h2>
          <p className="text-xs md:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
            비교·견적·발주·입고·재고까지 끊기지 않는 운영 파이프라인.
            <br />
            운영 콘솔에서 전 과정을 추적하고 통제합니다.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
          <Link href="/dashboard" className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto h-10 px-8 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm flex items-center justify-center gap-2">
              운영 콘솔 시작하기
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
          <Link href="/support" className="w-full sm:w-auto">
            <Button variant="outline" className="w-full sm:w-auto h-10 px-6 border-slate-800 text-slate-500 hover:text-slate-300 hover:border-slate-700 font-medium text-sm">
              도입 문의
            </Button>
          </Link>
        </div>

        <p className="text-[10px] text-slate-600">
          연구실·바이오팀의 반복 구매 운영에 최적화된 플랫폼입니다.
        </p>
      </div>
    </section>
  );
}
