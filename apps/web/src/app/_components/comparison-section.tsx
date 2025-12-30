import { Clock, X, CheckCircle2, ArrowRight, Zap, TrendingDown } from "lucide-react";

export function ComparisonSection() {
  return (
    <section className="py-6 md:py-12 lg:py-16 border-b border-slate-200 bg-gradient-to-b from-white via-slate-50/50 to-white">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        {/* 헤더 */}
        <div className="text-center mb-6 md:mb-12 lg:mb-16">
          <h2 className="text-xl md:text-3xl lg:text-4xl font-bold tracking-tight text-slate-900 mb-2 md:mb-4">
            작업 방식 비교
          </h2>
          <p className="text-xs md:text-base lg:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            수동 작업에서 자동화로 전환하여 시간을 절약하고 효율성을 극대화하세요
          </p>
        </div>

        {/* 메인 비교 카드 */}
        <div className="grid grid-cols-2 gap-2 md:gap-6 lg:gap-8 mb-4 md:mb-8">
          {/* Before: 기존 방식 */}
          <div className="relative">
            <div className="absolute -top-2 left-2 md:-top-3 md:left-4 z-10">
              <span className="inline-flex flex-col items-start gap-0.5 px-1.5 py-0.5 md:gap-1 md:px-3 md:py-1 bg-slate-100 border border-slate-300 rounded-full">
                <span className="inline-flex items-center gap-1 text-[10px] md:text-xs font-semibold text-slate-700">
                  <Clock className="h-2.5 w-2.5 md:h-3 md:w-3" />
                  <span>기존 방식</span>
                </span>
              </span>
            </div>
            <div className="border-2 border-slate-200 bg-white rounded-xl md:rounded-2xl p-2 md:p-6 lg:p-8 shadow-lg h-full pt-4 md:pt-6 lg:pt-8">
              <div className="space-y-1.5 md:space-y-4">
                {[
                  { 
                    title: "벤더 사이트 개별 검색", 
                    detail: "~20분 · 10+개 사이트 방문",
                    icon: X
                  },
                  { 
                    title: "엑셀/노션에 수동 정리", 
                    detail: "~15분 · 복붙 반복",
                    icon: X
                  },
                  { 
                    title: "메일 첨부 문서 작성", 
                    detail: "~10분 · 형식 맞추기",
                    icon: X
                  },
                  { 
                    title: "버전 관리 어려움", 
                    detail: "파일 분산 · 이메일 체인",
                    icon: X
                  },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-start gap-1.5 md:gap-4 p-1.5 md:p-4 rounded-lg md:rounded-xl bg-slate-50/50 border border-slate-200">
                    <div className="flex-shrink-0 mt-0.5">
                      <div className="w-3.5 h-3.5 md:w-6 md:h-6 rounded-full bg-slate-300 flex items-center justify-center">
                        <item.icon className="h-2.5 w-2.5 md:h-4 md:w-4 text-slate-600" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] md:text-base font-semibold text-slate-900 mb-0.5 md:mb-1.5 leading-tight md:leading-snug">{item.title}</p>
                      <p className="text-[9px] md:text-sm text-slate-600 leading-tight md:leading-relaxed">{item.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* 총 시간 */}
              <div className="mt-3 md:mt-8 pt-2 md:pt-6 border-t-2 border-slate-300">
                <div className="flex items-baseline justify-between">
                  <span className="text-[9px] md:text-sm font-semibold text-slate-600 uppercase tracking-wide">총 소요시간</span>
                  <div className="text-right">
                    <span className="text-base md:text-3xl font-bold text-slate-900">~45분</span>
                    <span className="text-[9px] md:text-base text-slate-600 ml-0.5 md:ml-1.5">/건</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* After: BioInsight Lab */}
          <div className="relative">
            <div className="absolute -top-2 right-2 md:-top-3 md:left-4 z-10">
              <span className="inline-flex flex-col items-start gap-0.5 px-1.5 py-0.5 md:gap-1 md:px-3 md:py-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-full shadow-md">
                <span className="inline-flex items-center gap-1 text-[10px] md:text-xs font-semibold">
                  <Zap className="h-2.5 w-2.5 md:h-3 md:w-3" />
                  <span>자동화</span>
                </span>
                <span className="text-[8px] md:text-[9px] font-normal opacity-90 leading-tight">BioInsight Lab</span>
              </span>
            </div>
            <div className="border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 via-teal-50 to-emerald-50 rounded-xl md:rounded-2xl p-2 md:p-6 lg:p-8 shadow-xl h-full relative overflow-hidden pt-4 md:pt-6 lg:pt-8">
              {/* 배경 장식 */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-200/20 rounded-full blur-3xl -mr-16 -mt-16"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-teal-200/20 rounded-full blur-2xl -ml-12 -mb-12"></div>
              
              <div className="relative space-y-1.5 md:space-y-4">
                {[
                  { 
                    title: "통합 검색으로 한 번에 여러 벤더 검색", 
                    detail: "~2분 · 자동 크롤링",
                    icon: CheckCircle2
                  },
                  { 
                    title: "스펙·가격 자동 정렬 비교표", 
                    detail: "즉시 · AI 분석",
                    icon: CheckCircle2
                  },
                  { 
                    title: "견적 요청 리스트 자동 생성", 
                    detail: "1분 · 클릭 한 번",
                    icon: CheckCircle2
                  },
                  { 
                    title: "공유링크/TSV/엑셀 즉시 내보내기", 
                    detail: "실시간 협업 · 버전 관리",
                    icon: CheckCircle2
                  },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-start gap-1.5 md:gap-4 p-1.5 md:p-4 rounded-lg md:rounded-xl bg-white/70 backdrop-blur-sm border border-emerald-300/60 shadow-sm">
                    <div className="flex-shrink-0 mt-0.5">
                      <div className="w-3.5 h-3.5 md:w-6 md:h-6 rounded-full bg-emerald-600 flex items-center justify-center shadow-md">
                        <item.icon className="h-2.5 w-2.5 md:h-4 md:w-4 text-white" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] md:text-base font-semibold text-slate-900 mb-0.5 md:mb-1.5 leading-tight md:leading-snug">{item.title}</p>
                      <p className="text-[9px] md:text-sm text-emerald-700 font-medium leading-tight md:leading-relaxed">{item.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* 총 시간 + 절약 효과 */}
              <div className="mt-3 md:mt-8 pt-2 md:pt-6 border-t-2 border-emerald-300/60 relative">
                <div className="flex items-baseline justify-between mb-1.5 md:mb-3">
                  <span className="text-[9px] md:text-sm font-semibold text-emerald-800 uppercase tracking-wide">총 소요시간</span>
                  <div className="text-right">
                    <span className="text-base md:text-3xl font-bold text-emerald-700">~5분</span>
                    <span className="text-[9px] md:text-base text-emerald-600 ml-0.5 md:ml-1.5">/건</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 md:gap-2.5 pt-1.5 md:pt-3 border-t border-emerald-300/40">
                  <TrendingDown className="h-3 w-3 md:h-5 md:w-5 text-emerald-600" />
                  <span className="text-[10px] md:text-base font-bold text-emerald-700">90% 시간 절약</span>
                  <span className="text-[9px] md:text-sm text-emerald-600 ml-auto font-medium">40분 절감</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 중앙 화살표 (모바일에서는 숨김) */}
        <div className="hidden lg:flex items-center justify-center mt-8 mb-12">
          <div className="flex items-center gap-2.5 px-5 py-3 bg-white border-2 border-slate-200 rounded-full shadow-md">
            <ArrowRight className="h-5 w-5 text-slate-400" />
            <span className="text-sm font-semibold text-slate-600">자동화로 전환</span>
          </div>
        </div>

        {/* 핵심 메트릭 요약 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-5 max-w-4xl mx-auto mt-3 md:mt-4">
          {[
            { label: "시간 절약", value: "90%", color: "emerald" },
            { label: "작업 단축", value: "40분", color: "emerald" },
            { label: "사이트 방문", value: "10+ → 1", color: "blue" },
            { label: "수동 작업", value: "0회", color: "purple" },
          ].map((metric, idx) => (
            <div key={idx} className="text-center p-2 md:p-5 bg-white rounded-lg md:rounded-xl border-2 border-slate-200 shadow-md">
              <div className={`text-base md:text-3xl lg:text-4xl font-bold mb-0.5 md:mb-2 ${
                metric.color === "emerald" ? "text-emerald-600" :
                metric.color === "blue" ? "text-blue-600" :
                "text-purple-600"
              }`}>
                {metric.value}
              </div>
              <div className="text-[9px] md:text-sm text-slate-700 font-semibold">{metric.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

