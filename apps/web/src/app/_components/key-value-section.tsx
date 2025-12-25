import { Card, CardContent } from "@/components/ui/card";
import { Search, FileSpreadsheet, Users } from "lucide-react";

// KeyValueSection 컴포넌트 - 연구/구매 워크벤치 스타일
export function KeyValueSection() {
  return (
    <section id="features" className="py-10 md:py-14 border-b border-slate-200 scroll-mt-14">
      <div className="mx-auto max-w-5xl px-4 md:px-6">
        <div className="space-y-2 md:space-y-3 mb-6">
          <h2 className="text-sm md:text-lg font-semibold tracking-tight text-slate-900 leading-relaxed">
            시약·장비 검색부터 견적 요청까지 이어지는 구매 준비 도구
          </h2>
          <p className="text-[11px] md:text-sm text-slate-500 border-l-2 border-slate-200 pl-3 py-1">
            검색 사이트가 아니라, <span className="font-medium text-slate-700">구매 준비/정리 도구</span>입니다.
          </p>
        </div>
        <div className="grid gap-3 md:gap-4 md:grid-cols-3">
          <Card className="border border-slate-200 bg-white shadow-sm rounded-md">
            <CardContent className="flex items-start gap-2.5 md:gap-3 p-3 md:p-4">
              <div className="mt-0.5 flex h-7 w-7 md:h-8 md:w-8 items-center justify-center rounded-md bg-slate-100 flex-shrink-0">
                <Search className="h-3.5 w-3.5 md:h-4 md:w-4 text-slate-600" strokeWidth={1.5} />
              </div>
              <div className="space-y-1 min-w-0 flex-1">
                <h3 className="text-xs md:text-sm font-semibold text-slate-900">
                  통합 검색
                </h3>
                <p className="text-[11px] md:text-xs leading-relaxed text-slate-500">
                  여러 벤더 제품을 한 번에 검색. 자동 추출로 후보를 빠르게 모읍니다.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-slate-200 bg-white shadow-sm rounded-md">
            <CardContent className="flex items-start gap-2.5 md:gap-3 p-3 md:p-4">
              <div className="mt-0.5 flex h-7 w-7 md:h-8 md:w-8 items-center justify-center rounded-md bg-slate-100 flex-shrink-0">
                <FileSpreadsheet className="h-3.5 w-3.5 md:h-4 md:w-4 text-slate-600" strokeWidth={1.5} />
              </div>
              <div className="space-y-1 min-w-0 flex-1">
                <h3 className="text-xs md:text-sm font-semibold text-slate-900">
                  견적 요청 리스트 자동 정리
                </h3>
                <p className="text-[11px] md:text-xs leading-relaxed text-slate-500">
                  후보 비교 후 리스트로 정리. 회신 가격·납기도 같은 리스트에서 비교합니다.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-slate-200 bg-white shadow-sm rounded-md">
            <CardContent className="flex items-start gap-2.5 md:gap-3 p-3 md:p-4">
              <div className="mt-0.5 flex h-7 w-7 md:h-8 md:w-8 items-center justify-center rounded-md bg-slate-100 flex-shrink-0">
                <Users className="h-3.5 w-3.5 md:h-4 md:w-4 text-slate-600" strokeWidth={1.5} />
              </div>
              <div className="space-y-1 min-w-0 flex-1">
                <h3 className="text-xs md:text-sm font-semibold text-slate-900">
                  팀 협업
                </h3>
                <p className="text-[11px] md:text-xs leading-relaxed text-slate-500">
                  연구–QC–구매가 하나의 리스트로 협업. 버전 분산 문제를 줄입니다.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
