import { Card, CardContent } from "@/components/ui/card";
import { Search, FileSpreadsheet, Users } from "lucide-react";

// UTF-8 인코딩 문제로 인한 한글 깨짐 수정
export function KeyValueSection() {
  return (
    <section id="features" className="mt-12 space-y-3 md:space-y-4 scroll-mt-14">
      <h2 className="text-base md:text-lg font-semibold tracking-tight text-slate-900 leading-relaxed">
        연구·QC 현장의 시약·장비를 한 번에 검색·비교하고,
        구매 요청에 쓸 품목 리스트까지 정리할 수 있는 구매 준비 도구입니다.
      </h2>
      <div className="grid gap-3 md:gap-4 md:grid-cols-3">
        <Card className="border border-slate-200 bg-white shadow-sm rounded-xl">
          <CardContent className="flex items-start gap-2.5 md:gap-3 p-3 md:p-4">
            {/* 아이콘 */}
            <div className="mt-0.5 flex h-8 w-8 md:h-9 md:w-9 items-center justify-center rounded-full bg-slate-50 flex-shrink-0">
              <Search className="h-4 w-4 md:h-5 md:w-5 text-slate-900" />
            </div>
            {/* 텍스트 블록 */}
            <div className="space-y-1 min-w-0 flex-1">
              <h3 className="text-xs md:text-sm font-semibold text-slate-900">
                검색 한 번으로 후보를 한 번에 모으기
              </h3>
              <p className="text-[11px] md:text-xs leading-relaxed text-slate-500">
                GPT가 검색어를 이해해서 제품명, 벤더, 카테고리를 한 번에 검색합니다. 여러 업체 사이트를 일일이 열지 않고도 후보를 한 번에 모을 수 있습니다.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 bg-white shadow-sm rounded-xl">
          <CardContent className="flex items-start gap-2.5 md:gap-3 p-3 md:p-4">
            {/* 아이콘 */}
            <div className="mt-0.5 flex h-8 w-8 md:h-9 md:w-9 items-center justify-center rounded-full bg-slate-50 flex-shrink-0">
              <FileSpreadsheet className="h-4 w-4 md:h-5 md:w-5 text-slate-900" />
            </div>
            {/* 텍스트 블록 */}
            <div className="space-y-1 min-w-0 flex-1">
              <h3 className="text-xs md:text-sm font-semibold text-slate-900">
                품목 리스트 자동 정리
              </h3>
              <p className="text-[11px] md:text-xs leading-relaxed text-slate-500">
                담아둔 후보 제품을 비교하고 불필요한 항목은 빼고, 실제로 구매에 쓸 품목 리스트만 남깁니다. 견적 요청·구매 요청서 작성 시 그대로 활용할 수 있습니다.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 bg-white shadow-sm rounded-xl">
          <CardContent className="flex items-start gap-2.5 md:gap-3 p-3 md:p-4">
            {/* 아이콘 */}
            <div className="mt-0.5 flex h-8 w-8 md:h-9 md:w-9 items-center justify-center rounded-full bg-slate-50 flex-shrink-0">
              <Users className="h-4 w-4 md:h-5 md:w-5 text-slate-900" />
            </div>
            {/* 텍스트 블록 */}
            <div className="space-y-1 min-w-0 flex-1">
              <h3 className="text-xs md:text-sm font-semibold text-slate-900">
                연구·QC·구매 모두에게 유용한 도구
              </h3>
              <p className="text-[11px] md:text-xs leading-relaxed text-slate-500">
                연구자, QC 담당자, 구매 담당자가 같은 리스트를 공유하면서 소통할 수 있습니다. 반복되는 검색·정리 작업을 줄이고, 협업에 집중할 수 있습니다.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
