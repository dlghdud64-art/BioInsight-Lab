import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, FileSpreadsheet, Copy, CheckCircle2, XCircle } from "lucide-react";

export function ComparisonSection() {
  return (
    <section className="mt-20 space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          기존 방식 vs BioInsight Lab
        </h2>
        <p className="text-sm text-slate-600">
          복잡하고 시간이 걸리던 견적 준비 과정을 간단하게
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* 기존 방식 */}
        <Card className="border-2 border-red-100 bg-red-50/30">
          <CardHeader>
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-600" />
              <CardTitle className="text-lg text-slate-900">기존 방식</CardTitle>
            </div>
            <CardDescription className="text-xs text-slate-600">
              여러 단계를 거쳐 수동으로 작업
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-red-100 flex-shrink-0">
                <Search className="h-4 w-4 text-red-600" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-slate-900 mb-1">
                  시약몰/벤더 사이트 여러 곳 검색
                </h4>
                <p className="text-xs text-slate-600">
                  각 벤더 사이트를 하나씩 방문해 제품을 찾아야 합니다.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-red-100 flex-shrink-0">
                <FileSpreadsheet className="h-4 w-4 text-red-600" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-slate-900 mb-1">
                  엑셀/노션으로 수동 비교표 작성
                </h4>
                <p className="text-xs text-slate-600">
                  찾은 제품 정보를 수동으로 복사해 비교표를 만들어야 합니다.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-red-100 flex-shrink-0">
                <Copy className="h-4 w-4 text-red-600" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-slate-900 mb-1">
                  그룹웨어 결재 양식에 다시 표/텍스트 재작성
                </h4>
                <p className="text-xs text-slate-600">
                  완성된 비교표를 그룹웨어 형식에 맞춰 다시 입력해야 합니다.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* BioInsight Lab 사용 시 */}
        <Card className="border-2 border-green-200 bg-green-50/30">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <CardTitle className="text-lg text-slate-900">BioInsight Lab 사용 시</CardTitle>
            </div>
            <CardDescription className="text-xs text-slate-600">
              한 번의 검색으로 모든 과정 자동화
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-green-100 flex-shrink-0">
                <Search className="h-4 w-4 text-green-600" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-slate-900 mb-1">
                  여러 벤더 제품을 한 번에 검색·비교
                </h4>
                <p className="text-xs text-slate-600">
                  하나의 검색창에서 여러 벤더의 제품을 동시에 검색하고 비교할 수 있습니다.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-green-100 flex-shrink-0">
                <FileSpreadsheet className="h-4 w-4 text-green-600" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-slate-900 mb-1">
                  품목 리스트 자동 구성
                </h4>
                <p className="text-xs text-slate-600">
                  선택한 제품들이 자동으로 품목 리스트로 정리되어 수량과 비고만 입력하면 됩니다.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-green-100 flex-shrink-0">
                <Copy className="h-4 w-4 text-green-600" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-slate-900 mb-1">
                  그룹웨어에 붙여넣을 TSV/테이블 텍스트 자동 생성
                </h4>
                <p className="text-xs text-slate-600">
                  완성된 품목 리스트를 클릭 한 번으로 복사해 그룹웨어에 바로 붙여넣을 수 있습니다.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

