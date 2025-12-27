import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";

// FlowSection 컴포넌트 - 중복 정의 제거
export function FlowSection() {
  return (
    <section id="flow-section" className="mt-6 md:mt-12 space-y-2 md:space-y-4 scroll-mt-14 overflow-hidden">
      <h2 className="text-sm md:text-lg font-semibold tracking-tight text-slate-900 px-1">
        3단계로 끝나는 견적·구매 준비
      </h2>
      <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-3 w-full">
        <Link href="/test/search">
          <Card className="h-full border border-slate-200 bg-white shadow-sm rounded-xl hover:shadow-md transition-shadow cursor-pointer w-full overflow-hidden">
            <CardContent className="flex items-start gap-2.5 md:gap-3 p-3 md:p-4 h-full">
              {/* 숫자 배지 */}
              <div className="mt-0.5 flex h-7 w-7 md:h-8 md:w-8 items-center justify-center rounded-full bg-blue-600 text-[10px] md:text-xs font-semibold text-white flex-shrink-0">
                1
              </div>
              {/* 텍스트 블록 */}
              <div className="space-y-1 flex-1 flex flex-col min-w-0 overflow-hidden">
                <h3 className="text-xs md:text-sm font-semibold text-slate-900 break-words">검색</h3>
                <p className="text-[11px] md:text-xs leading-relaxed text-slate-500 flex-1 break-words">
                  제품명, 타깃, 카테고리로 검색하면 후보 제품을 한 번에 확인할 수 있습니다.
                </p>
                <span className="text-[10px] md:text-xs text-blue-600 mt-2 inline-block">체험하기 →</span>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/test/compare">
          <Card className="h-full border border-slate-200 bg-white shadow-sm rounded-xl hover:shadow-md transition-shadow cursor-pointer w-full overflow-hidden">
            <CardContent className="flex items-start gap-2.5 md:gap-3 p-3 md:p-4 h-full">
              {/* 숫자 배지 */}
              <div className="mt-0.5 flex h-7 w-7 md:h-8 md:w-8 items-center justify-center rounded-full bg-blue-600 text-[10px] md:text-xs font-semibold text-white flex-shrink-0">
                2
              </div>
              {/* 텍스트 블록 */}
              <div className="space-y-1 flex-1 flex flex-col min-w-0 overflow-hidden">
                <h3 className="text-xs md:text-sm font-semibold text-slate-900 break-words">비교·선정</h3>
                <p className="text-[11px] md:text-xs leading-relaxed text-slate-500 flex-1 break-words">
                  가격·스펙을 기준으로 후보를 비교하면서 최종 품목을 고릅니다.
                </p>
                <span className="text-[10px] md:text-xs text-blue-600 mt-2 inline-block">체험하기 →</span>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/test/quote">
          <Card className="h-full border border-slate-200 bg-white shadow-sm rounded-xl hover:shadow-md transition-shadow cursor-pointer w-full overflow-hidden">
            <CardContent className="flex items-start gap-2.5 md:gap-3 p-3 md:p-4 h-full">
              {/* 숫자 배지 */}
              <div className="mt-0.5 flex h-7 w-7 md:h-8 md:w-8 items-center justify-center rounded-full bg-blue-600 text-[10px] md:text-xs font-semibold text-white flex-shrink-0">
                3
              </div>
              {/* 텍스트 블록 */}
              <div className="space-y-1 flex-1 flex flex-col min-w-0 overflow-hidden">
                <h3 className="text-xs md:text-sm font-semibold text-slate-900 break-words">견적요청 & 구매 요청 리스트 정리</h3>
                <p className="text-[11px] md:text-xs leading-relaxed text-slate-500 flex-1 break-words">
                  선정된 품목으로 견적요청용 리스트를 만들고, 회신(가격·납기)을 정리한 뒤 TSV/엑셀로 공유합니다.
                </p>
                <span className="text-[10px] md:text-xs text-blue-600 mt-2 inline-block">체험하기 →</span>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="mt-6 text-center">
        <Link
          href="/test/search"
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
        >
          실제 플로우 보기
          <span>→</span>
        </Link>
      </div>
    </section>
  );
}
