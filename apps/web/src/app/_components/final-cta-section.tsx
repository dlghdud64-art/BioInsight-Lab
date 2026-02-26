import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

// FinalCTASection 컴포넌트 - 업무툴 스타일
export function FinalCTASection() {
  return (
    <section className="py-8 md:py-10 bg-slate-50">
      <div className="mx-auto max-w-3xl px-4 md:px-6">
        <div className="rounded-lg border-2 border-blue-200 bg-white p-4 text-center shadow-sm">
          <h2 className="text-base font-semibold mb-1.5 text-slate-900 tracking-tight">
            지금 바로 시작하기
          </h2>
          <p className="text-sm text-slate-600 mb-3 max-w-md mx-auto">
            검색/비교를 시작하고 견적 요청 리스트를 만들어보세요.
          </p>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2">
            <Link href="/test/search" className="w-full sm:w-auto">
              <Button className="w-full sm:w-auto bg-blue-600 text-white hover:bg-blue-700 shadow-sm flex items-center justify-center gap-2">
                Get Started
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Button variant="outline" className="w-full sm:w-auto border-slate-300 text-slate-700 hover:bg-slate-100 hover:border-slate-400">
              팀에 공유
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
