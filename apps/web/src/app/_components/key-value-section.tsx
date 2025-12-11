import { Card, CardContent } from "@/components/ui/card";
import { Search, FileSpreadsheet, Users } from "lucide-react";

// UTF-8 인코딩 문제로 인한 한글 깨짐 수정
export function KeyValueSection() {
  return (
    <section id="features" className="mt-12 space-y-4">
      <h2 className="text-lg font-semibold tracking-tight text-slate-900">
        연구·QC 현장의 시약·장비를 한 번에 검색·비교하고, 사내 그룹웨어에 붙여넣을 수 있는 구매 준비 도구입니다.
      </h2>
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border border-slate-200 bg-white shadow-sm rounded-xl">
          <CardContent className="flex items-start gap-3 p-4">
            {/* 아이콘 */}
            <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-slate-50 flex-shrink-0">
              <Search className="h-5 w-5 text-slate-900" />
            </div>
            {/* 텍스트 블록 */}
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-slate-900">
                검색으로 후보를 한 번에 모으기
              </h3>
              <p className="text-xs leading-relaxed text-slate-500">
                GPT가 검색어를 이해해서 유사 제품들을 자동으로 정리해줍니다.
                여러 벤더의 제품을 한 번에 조회하고 후보를 모을 수 있습니다.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 bg-white shadow-sm rounded-xl">
          <CardContent className="flex items-start gap-3 p-4">
            {/* 아이콘 */}
            <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-slate-50 flex-shrink-0">
              <FileSpreadsheet className="h-5 w-5 text-slate-900" />
            </div>
            {/* 텍스트 블록 */}
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-slate-900">
                품목 리스트 자동 정리
              </h3>
              <p className="text-xs leading-relaxed text-slate-500">
                선택한 제품들을 품목 리스트로 자동 정리합니다.
                수량, 비고만 입력하면 구매 요청용 리스트가 완성됩니다.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 bg-white shadow-sm rounded-xl">
          <CardContent className="flex items-start gap-3 p-4">
            {/* 아이콘 */}
            <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-slate-50 flex-shrink-0">
              <Users className="h-5 w-5 text-slate-900" />
            </div>
            {/* 텍스트 블록 */}
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-slate-900">
                연구·QC·생산·구매 모두에게 유용한 도구
              </h3>
              <p className="text-xs leading-relaxed text-slate-500">
                연구실, QC 실무자, 구매 담당자 모두 같은 리스트를 기반으로 협업할 수 있습니다.
                역할에 맞는 필터를 골라서 필요한 정보만 보여줍니다.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
