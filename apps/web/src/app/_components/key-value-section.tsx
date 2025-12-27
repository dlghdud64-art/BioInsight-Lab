import { Card, CardContent } from "@/components/ui/card";
import { Search, FileSpreadsheet, Users } from "lucide-react";

// KeyValueSection 컴포넌트 - 업무툴 스타일
export function KeyValueSection() {
  return (
    <section id="features" className="py-8 md:py-10 border-b border-slate-200 bg-white scroll-mt-14">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="mb-4">
          <h2 className="text-base md:text-lg font-semibold tracking-tight text-slate-900 mb-1">
            구매 준비 도구
          </h2>
          <p className="text-sm text-slate-600">
            검색 사이트가 아니라, 구매 준비/정리 도구입니다.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <Card className="border border-slate-200 bg-white hover:border-indigo-300 hover:shadow-sm transition-all">
            <CardContent className="flex items-start gap-2.5 p-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-100 flex-shrink-0">
                <Search className="h-3.5 w-3.5 text-indigo-600" strokeWidth={1.5} />
              </div>
              <div className="space-y-0.5 min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-slate-900">
                  통합 검색
                </h3>
                <p className="text-xs leading-snug text-slate-600">
                  여러 벤더 제품을 한 번에 검색. 자동 추출로 후보를 빠르게 모읍니다.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-slate-200 bg-white hover:border-emerald-300 hover:shadow-sm transition-all">
            <CardContent className="flex items-start gap-2.5 p-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-100 flex-shrink-0">
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" strokeWidth={1.5} />
              </div>
              <div className="space-y-0.5 min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-slate-900">
                  견적 요청 리스트 자동 정리
                </h3>
                <p className="text-xs leading-snug text-slate-600">
                  후보 비교 후 리스트로 정리. 회신 가격·납기도 같은 리스트에서 비교합니다.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-slate-200 bg-white hover:border-blue-300 hover:shadow-sm transition-all">
            <CardContent className="flex items-start gap-2.5 p-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-100 flex-shrink-0">
                <Users className="h-3.5 w-3.5 text-blue-600" strokeWidth={1.5} />
              </div>
              <div className="space-y-0.5 min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-slate-900">
                  팀 협업
                </h3>
                <p className="text-xs leading-snug text-slate-600">
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
