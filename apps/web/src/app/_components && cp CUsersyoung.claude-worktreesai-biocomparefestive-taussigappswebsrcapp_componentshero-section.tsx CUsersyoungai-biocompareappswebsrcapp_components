import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";

// FlowSection 컴포넌트 - 연구/구매 워크벤치 스타일
export function FlowSection() {
  return (
    <section id="flow-section" className="py-10 md:py-14 border-b border-slate-200 scroll-mt-14 overflow-hidden">
      <div className="mx-auto max-w-5xl px-4 md:px-6">
        <h2 className="text-sm md:text-lg font-semibold tracking-tight text-slate-900 mb-4 md:mb-6">
          3단계로 끝나는 견적 준비
        </h2>
        <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-3 w-full">
          <Link href="/test/search">
            <Card className="h-full border border-slate-200 bg-white shadow-sm rounded-md hover:border-indigo-200 transition-colors cursor-pointer w-full overflow-hidden">
              <CardContent className="flex items-start gap-2.5 md:gap-3 p-3 md:p-4 h-full">
                <div className="mt-0.5 flex h-6 w-6 md:h-7 md:w-7 items-center justify-center rounded-md bg-indigo-600 text-[10px] md:text-xs font-semibold text-white flex-shrink-0">
                  1
                </div>
                <div className="space-y-1 flex-1 flex flex-col min-w-0 overflow-hidden">
                  <h3 className="text-xs md:text-sm font-semibold text-slate-900 break-words">검색</h3>
                  <p className="text-[11px] md:text-xs leading-relaxed text-slate-500 flex-1 break-words">
                    제품명, 카테고리로 후보 제품을 한 번에 검색합니다.
                  </p>
                  <span className="text-[10px] md:text-xs text-indigo-600 mt-2 inline-block">체험하기 →</span>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/test/compare">
            <Card className="h-full border border-slate-200 bg-white shadow-sm rounded-md hover:border-indigo-200 transition-colors cursor-pointer w-full overflow-hidden">
              <CardContent className="flex items-start gap-2.5 md:gap-3 p-3 md:p-4 h-full">
                <div className="mt-0.5 flex h-6 w-6 md:h-7 md:w-7 items-center justify-center rounded-md bg-indigo-600 text-[10px] md:text-xs font-semibold text-white flex-shrink-0">
                  2
                </div>
                <div className="space-y-1 flex-1 flex flex-col min-w-0 overflow-hidden">
                  <h3 className="text-xs md:text-sm font-semibold text-slate-900 break-words">비교·선정</h3>
                  <p className="text-[11px] md:text-xs leading-relaxed text-slate-500 flex-1 break-words">
                    가격·스펙 기준으로 후보를 비교해 최종 품목을 고릅니다.
                  </p>
                  <span className="text-[10px] md:text-xs text-indigo-600 mt-2 inline-block">체험하기 →</span>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/test/quote">
            <Card className="h-full border border-slate-200 bg-white shadow-sm rounded-md hover:border-indigo-200 transition-colors cursor-pointer w-full overflow-hidden">
              <CardContent className="flex items-start gap-2.5 md:gap-3 p-3 md:p-4 h-full">
                <div className="mt-0.5 flex h-6 w-6 md:h-7 md:w-7 items-center justify-center rounded-md bg-indigo-600 text-[10px] md:text-xs font-semibold text-white flex-shrink-0">
                  3
                </div>
                <div className="space-y-1 flex-1 flex flex-col min-w-0 overflow-hidden">
                  <h3 className="text-xs md:text-sm font-semibold text-slate-900 break-words">견적 요청</h3>
                  <p className="text-[11px] md:text-xs leading-relaxed text-slate-500 flex-1 break-words">
                    선정 품목으로 견적 요청 리스트를 만들고 내보내기합니다.
                  </p>
                  <span className="text-[10px] md:text-xs text-indigo-600 mt-2 inline-block">체험하기 →</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </section>
  );
}
