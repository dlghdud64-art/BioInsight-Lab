import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, Languages, Lightbulb } from "lucide-react";

// AISection 컴포넌트 - 연구/구매 워크벤치 스타일
export function AISection() {
  return (
    <section id="ai" className="py-8 md:py-10 border-b border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <h2 className="text-base md:text-lg font-semibold tracking-tight text-slate-900 mb-3">
          자동화 기능
        </h2>
        <div className="grid gap-3 md:grid-cols-3">
          <Card className="border border-slate-200 bg-white rounded-lg hover:border-purple-300 hover:shadow-sm transition-all">
            <CardContent className="flex items-start gap-2.5 p-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-purple-100 flex-shrink-0">
                <Sparkles className="h-3.5 w-3.5 text-purple-600" strokeWidth={1.5} />
              </div>
              <div className="space-y-0.5 min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-slate-900">자동 추출</h3>
                <p className="text-xs leading-snug text-slate-600">
                  검색어를 분석해 타깃, 카테고리, 실험 유형을 자동으로 추출합니다.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-slate-200 bg-white rounded-lg hover:border-blue-300 hover:shadow-sm transition-all">
            <CardContent className="flex items-start gap-2.5 p-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-100 flex-shrink-0">
                <Languages className="h-3.5 w-3.5 text-blue-600" strokeWidth={1.5} />
              </div>
              <div className="space-y-0.5 min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-slate-900">자동 번역/요약</h3>
                <p className="text-xs leading-snug text-slate-600">
                  영문 데이터시트를 한글로 번역하고 핵심 정보를 요약합니다.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-slate-200 bg-white rounded-lg hover:border-amber-300 hover:shadow-sm transition-all">
            <CardContent className="flex items-start gap-2.5 p-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-100 flex-shrink-0">
                <Lightbulb className="h-3.5 w-3.5 text-amber-600" strokeWidth={1.5} />
              </div>
              <div className="space-y-0.5 min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-slate-900">대체품 추천</h3>
                <p className="text-xs leading-snug text-slate-600">
                  유사 스펙의 대체품을 자동으로 추천합니다.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
