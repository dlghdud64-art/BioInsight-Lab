"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Users } from "lucide-react";

export function FinalCTASection() {
  return (
    <section className="py-16 md:py-20 bg-slate-50">
      <div className="mx-auto max-w-4xl px-4 md:px-6">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-3 tracking-tight">
            검색부터 견적 요청까지, 지금 바로 시작하세요.
          </h2>
          <p className="text-sm md:text-base text-slate-600 max-w-xl mx-auto">
            찾는 시약과 장비를 검색하고, 후보를 비교한 뒤<br className="hidden sm:block" />
            견적 요청까지 한 곳에서 이어가세요.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/test/search" className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto h-12 px-8 bg-blue-600 text-white hover:bg-blue-700 shadow-sm flex items-center justify-center gap-2 font-semibold text-base">
              시약·장비 검색 시작하기
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/intro" className="w-full sm:w-auto">
            <Button variant="outline" className="w-full sm:w-auto h-12 px-8 border-slate-300 text-slate-700 hover:bg-slate-100 hover:border-slate-400 flex items-center justify-center gap-2 font-semibold text-base">
              <Users className="h-4 w-4" />
              도입 문의하기
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
