import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, Languages, Lightbulb } from "lucide-react";

// AISection 컴포넌트 - 연구/구매 워크벤치 스타일
export function AISection() {
  return (
    <section id="ai" className="py-10 md:py-14 border-b border-slate-200">
      <div className="mx-auto max-w-5xl px-4 md:px-6">
        <h2 className="text-sm md:text-lg font-semibold tracking-tight text-slate-900 mb-4 md:mb-6">
          자동화 기능
        </h2>
        <div className="grid gap-3 md:gap-4 md:grid-cols-3">
          <Card className="border border-slate-200 bg-white shadow-sm rounded-md">
            <CardContent className="flex items-start gap-2.5 md:gap-3 p-3 md:p-4">
              <div className="mt-0.5 flex h-7 w-7 md:h-8 md:w-8 items-center justify-center rounded-md bg-slate-100 flex-shrink-0">
                <Sparkles className="h-3.5 w-3.5 md:h-4 md:w-4 text-slate-600" strokeWidth={1.5} />
              </div>
              <div className="space-y-1 min-w-0 flex-1">
                <h3 className="text-xs md:text-sm font-semibold text-slate-900">자동 추출</h3>
                <p className="text-[11px] md:text-xs leading-relaxed text-slate-500">
                  검색어를 분석해 타깃, 카테고리, 실험 유형을 자동으로 추출합니다.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-slate-200 bg-white shadow-sm rounded-md">
            <CardContent className="flex items-start gap-2.5 md:gap-3 p-3 md:p-4">
              <div className="mt-0.5 flex h-7 w-7 md:h-8 md:w-8 items-center justify-center rounded-md bg-slate-100 flex-shrink-0">
                <Languages className="h-3.5 w-3.5 md:h-4 md:w-4 text-slate-600" strokeWidth={1.5} />
              </div>
              <div className="space-y-1 min-w-0 flex-1">
                <h3 className="text-xs md:text-sm font-semibold text-slate-900">자동 번역/요약</h3>
                <p className="text-[11px] md:text-xs leading-relaxed text-slate-500">
                  영문 데이터시트를 한글로 번역하고 핵심 정보를 요약합니다.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-slate-200 bg-white shadow-sm rounded-md">
            <CardContent className="flex items-start gap-2.5 md:gap-3 p-3 md:p-4">
              <div className="mt-0.5 flex h-7 w-7 md:h-8 md:w-8 items-center justify-center rounded-md bg-slate-100 flex-shrink-0">
                <Lightbulb className="h-3.5 w-3.5 md:h-4 md:w-4 text-slate-600" strokeWidth={1.5} />
              </div>
              <div className="space-y-1 min-w-0 flex-1">
                <h3 className="text-xs md:text-sm font-semibold text-slate-900">대체품 추천</h3>
                <p className="text-[11px] md:text-xs leading-relaxed text-slate-500">
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
