import Link from "next/link";
import { Button } from "@/components/ui/button";

// FinalCTASection 컴포넌트 - 중복 정의 제거
export function FinalCTASection() {
  return (
    <section className="mt-12 py-8 md:py-12">
      <div className="rounded-xl border border-slate-200 bg-white p-5 md:p-8 text-center shadow-sm">
        <h2 className="text-xl md:text-2xl font-bold mb-2 md:mb-3 text-slate-900">
          지금 바로 시작해보세요
        </h2>
        <p className="text-xs md:text-sm text-slate-600 mb-4 md:mb-6 max-w-md mx-auto leading-relaxed">
          지금 바로 검색/비교를 시작하고, 구매 준비 리스트를 만들어보세요.
          팀에 공유하거나 바로 도입을 검토해보세요.
        </p>
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-center gap-2.5 md:gap-3">
          <Link href="/test/search" className="w-full sm:w-auto">
            <Button size="lg" className="w-full sm:w-auto rounded-full bg-blue-600 text-white hover:bg-blue-700 text-sm md:text-base h-11 md:h-12">
              검색/비교 시작하기
            </Button>
          </Link>
          <Button size="lg" variant="outline" className="w-full sm:w-auto rounded-full border-slate-300 text-slate-700 hover:bg-slate-50 text-sm md:text-base h-11 md:h-12">
            팀에 공유하기
          </Button>
        </div>
      </div>
    </section>
  );
}
