import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, Languages, Lightbulb } from "lucide-react";

// AISection 컴포넌트 - 중복 정의 제거
export function AISection() {
  return (
    <section id="ai" className="mt-12 space-y-3 md:space-y-4">
      <h2 className="text-base md:text-lg font-semibold tracking-tight text-slate-900">
        GPT 기반 AI 기능
      </h2>
      <div className="grid gap-3 md:gap-4 md:grid-cols-3">
        <Card className="border border-slate-200 bg-white shadow-sm rounded-xl">
          <CardContent className="flex items-start gap-2.5 md:gap-3 p-3 md:p-4">
            <div className="mt-0.5 flex h-8 w-8 md:h-9 md:w-9 items-center justify-center rounded-full bg-slate-50 flex-shrink-0">
              <Sparkles className="h-4 w-4 md:h-5 md:w-5 text-slate-900" />
            </div>
            <div className="space-y-1 min-w-0 flex-1">
              <h3 className="text-xs md:text-sm font-semibold text-slate-900">검색 의도 분석</h3>
              <p className="text-[11px] md:text-xs leading-relaxed text-slate-500">
                사용자의 검색어를 분석해 타깃, 카테고리, 실험 유형을 자동으로 추출합니다.
                단순 키워드 매칭이 아닌 의미 기반 검색으로 정확한 결과를 제공합니다.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 bg-white shadow-sm rounded-xl">
          <CardContent className="flex items-start gap-2.5 md:gap-3 p-3 md:p-4">
            <div className="mt-0.5 flex h-8 w-8 md:h-9 md:w-9 items-center justify-center rounded-full bg-slate-50 flex-shrink-0">
              <Languages className="h-4 w-4 md:h-5 md:w-5 text-slate-900" />
            </div>
            <div className="space-y-1 min-w-0 flex-1">
              <h3 className="text-xs md:text-sm font-semibold text-slate-900">자동 번역 & 요약</h3>
              <p className="text-[11px] md:text-xs leading-relaxed text-slate-500">
                영문 데이터시트와 제품 설명을 한글로 번역하고 핵심 정보를 요약합니다.
                해외 벤더 제품도 쉽게 이해하고 비교할 수 있습니다.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 bg-white shadow-sm rounded-xl">
          <CardContent className="flex items-start gap-2.5 md:gap-3 p-3 md:p-4">
            <div className="mt-0.5 flex h-8 w-8 md:h-9 md:w-9 items-center justify-center rounded-full bg-slate-50 flex-shrink-0">
              <Lightbulb className="h-4 w-4 md:h-5 md:w-5 text-slate-900" />
            </div>
            <div className="space-y-1 min-w-0 flex-1">
              <h3 className="text-xs md:text-sm font-semibold text-slate-900">대체품 추천</h3>
              <p className="text-[11px] md:text-xs leading-relaxed text-slate-500">
                검색한 제품과 유사한 스펙의 대체품을 자동으로 추천합니다.
                재고 부족이나 가격 이슈 시 빠르게 대안을 찾을 수 있습니다.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
