import { Card, CardContent } from "@/components/ui/card";
import { Search, FileSpreadsheet, Users } from "lucide-react";

// UTF-8 인코딩 문제로 인한 한글 깨짐 수정
export function KeyValueSection() {
  return (
    <section id="features" className="mt-6 md:mt-12 space-y-2 md:space-y-4 scroll-mt-14">
      <div className="space-y-2 md:space-y-3">
        <h2 className="text-sm md:text-lg font-semibold tracking-tight text-slate-900 leading-relaxed">
          연구·QC 현장의 시약·장비를 한 번에 검색·비교하고, 견적요청/구매요청까지 이어지는 구매 준비 도구입니다.
        </h2>
        <p className="text-[11px] md:text-sm text-slate-600 italic border-l-2 border-blue-200 pl-3 py-1.5 bg-blue-50/30 rounded-r">
          💡 이 서비스는 검색 사이트가 아니라, <span className="font-semibold text-slate-900">연구실/조직의 시약·장비 구매 준비/정리 도구</span>입니다.
        </p>
      </div>
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
                담아둔 후보를 비교해 견적요청에 필요한 품목 리스트로 정리합니다. 회신받은 가격·납기 정보도 같은 리스트에서 비교할 수 있게 구성합니다.
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
                연구–QC–구매가 하나의 품목 리스트로 협업합니다. 견적요청 → 회신 정리 → 구매요청 흐름에서 "버전이 갈라지는 문제"를 줄입니다.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
