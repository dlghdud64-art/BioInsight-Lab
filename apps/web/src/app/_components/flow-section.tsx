import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";

// FlowSection 컴포넌트 - 업무툴 스타일
export function FlowSection() {
  return (
    <section id="flow-section" className="py-8 md:py-10 border-b border-slate-200 bg-white scroll-mt-14">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="text-center mb-4">
          <h2 className="text-base md:text-lg font-semibold tracking-tight text-slate-900 mb-1">
            Step 1 검색 → Step 2 비교 → Step 3 견적 요청
          </h2>
        </div>
        <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-3 w-full">
          <Link href="/test/search">
            <Card className="h-full border border-slate-200 bg-white hover:border-indigo-400 hover:bg-indigo-50/50 transition-all cursor-pointer">
              <CardContent className="flex items-start gap-2.5 p-3 h-full">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-500 text-xs font-semibold text-white flex-shrink-0">
                  1
                </div>
                <div className="space-y-0.5 flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-slate-900">검색</h3>
                  <p className="text-xs leading-snug text-slate-600">
                    제품명, 카테고리로 후보 제품을 한 번에 검색합니다.
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/test/compare">
            <Card className="h-full border border-slate-200 bg-white hover:border-indigo-400 hover:bg-indigo-50/50 transition-all cursor-pointer">
              <CardContent className="flex items-start gap-2.5 p-3 h-full">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-500 text-xs font-semibold text-white flex-shrink-0">
                  2
                </div>
                <div className="space-y-0.5 flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-slate-900">비교</h3>
                  <p className="text-xs leading-snug text-slate-600">
                    가격·스펙 기준으로 후보를 비교해 최종 품목을 고릅니다.
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/test/quote">
            <Card className="h-full border border-slate-200 bg-white hover:border-indigo-400 hover:bg-indigo-50/50 transition-all cursor-pointer">
              <CardContent className="flex items-start gap-2.5 p-3 h-full">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-500 text-xs font-semibold text-white flex-shrink-0">
                  3
                </div>
                <div className="space-y-0.5 flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-slate-900">견적 요청</h3>
                  <p className="text-xs leading-snug text-slate-600">
                    선정 품목으로 견적 요청 리스트를 만들고 내보내기합니다.
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </section>
  );
}
