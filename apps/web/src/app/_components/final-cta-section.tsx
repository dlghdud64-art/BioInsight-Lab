import Link from "next/link";
import { Button } from "@/components/ui/button";

// FinalCTASection 컴포넌트 - 연구/구매 워크벤치 스타일
export function FinalCTASection() {
  return (
    <section className="py-10 md:py-14 bg-slate-50">
      <div className="mx-auto max-w-3xl px-4 md:px-6">
        <div className="rounded-md border border-slate-200 bg-white p-5 md:p-8 text-center shadow-sm">
          <h2 className="text-base md:text-xl font-semibold mb-2 md:mb-3 text-slate-900 tracking-tight">
            지금 바로 시작하기
          </h2>
          <p className="text-xs md:text-sm text-slate-500 mb-4 md:mb-6 max-w-md mx-auto leading-relaxed">
            검색/비교를 시작하고 견적 요청 리스트를 만들어보세요.
          </p>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2 md:gap-3">
            <Link href="/test/search" className="w-full sm:w-auto">
              <Button size="sm" className="w-full sm:w-auto rounded-md bg-indigo-600 text-white hover:bg-indigo-700 text-xs md:text-sm h-9 md:h-10">
                검색 시작
              </Button>
            </Link>
            <Button size="sm" variant="outline" className="w-full sm:w-auto rounded-md border-slate-300 text-slate-600 hover:bg-slate-50 text-xs md:text-sm h-9 md:h-10">
              팀에 공유
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
