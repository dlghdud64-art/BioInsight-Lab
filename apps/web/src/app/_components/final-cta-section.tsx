"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function FinalCTASection() {
  return (
    <section className="py-20 md:py-24 bg-white border-t border-slate-100">
      <div className="mx-auto max-w-3xl px-4 md:px-6 text-center">
        <div className="space-y-4 mb-10">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight leading-tight">
            검색부터 견적 요청까지,<br className="hidden sm:block" />
            지금 바로 시작하세요.
          </h2>
          <p className="text-base text-slate-500 max-w-md mx-auto leading-relaxed">
            찾는 시약과 장비를 검색하고, 후보를 비교한 뒤<br className="hidden sm:block" />
            견적 요청까지 한 곳에서 이어가세요.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-5">
          <Link href="/test/search" className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto h-12 px-10 bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg font-bold text-base flex items-center justify-center gap-2 transition-all">
              시약·장비 검색 시작하기
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/support" className="w-full sm:w-auto">
            <Button variant="outline" className="w-full sm:w-auto h-12 px-8 border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400 font-semibold text-base transition-colors">
              도입 문의하기
            </Button>
          </Link>
        </div>

        <p className="text-xs text-slate-400">무료로 시작 · 신용카드 불필요 · 언제든 해지 가능</p>
      </div>
    </section>
  );
}
