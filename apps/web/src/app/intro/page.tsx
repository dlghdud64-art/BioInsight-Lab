import { MainLayout } from "../_components/main-layout";
import { MainHeader } from "../_components/main-header";
import { MainFooter } from "../_components/main-footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, ShieldCheck, Layers, Brain, Users } from "lucide-react";
import dynamic from "next/dynamic";

// Lazy load sections for better initial page load
const ComparisonSection = dynamic(() => import("../_components/comparison-section").then((mod) => ({ default: mod.ComparisonSection })), {
  loading: () => <div className="h-96 w-full bg-slate-50" />,
});
const SecuritySection = dynamic(() => import("../_components/security-section").then((mod) => ({ default: mod.SecuritySection })), {
  loading: () => <div className="h-64 w-full bg-slate-50" />,
});
const FinalCTASection = dynamic(() => import("../_components/final-cta-section").then((mod) => ({ default: mod.FinalCTASection })), {
  loading: () => <div className="h-64 w-full bg-slate-50" />,
});

export default function IntroPage() {
  return (
    <MainLayout>
      <MainHeader />
      {/* 전체 레이아웃 컨테이너 */}
      <div className="w-full">
        {/* 1. Hero Section */}
        <section className="relative py-10 md:py-32 bg-gradient-to-b from-blue-50/80 via-white to-white overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 opacity-[0.03]" style={{
              backgroundImage: `linear-gradient(to right, rgba(0,0,0,0.04) 1px, transparent 1px),
                                linear-gradient(to bottom, rgba(0,0,0,0.04) 1px, transparent 1px)`,
              backgroundSize: '32px 32px'
            }}></div>
            <div className="absolute bottom-0 left-0 right-0 h-1/3 opacity-[0.02]" style={{
              backgroundImage: `repeating-linear-gradient(90deg, transparent, transparent 60px, rgba(59,130,246,0.3) 60px, rgba(59,130,246,0.3) 62px),
                                repeating-linear-gradient(0deg, transparent, transparent 40px, rgba(59,130,246,0.2) 40px, rgba(59,130,246,0.2) 42px)`,
              backgroundSize: '120px 80px'
            }}></div>
          </div>

          <div className="relative mx-auto max-w-4xl px-4 md:px-6 text-center">
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 mb-3 md:mb-6 leading-snug md:leading-tight break-keep">
              연구실 관리의 새로운 표준
            </h1>
            <p className="text-sm md:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed break-keep">
              연구실 재고 관리와 구매 프로세스를 한 곳에서 통합 관리하세요.
              <br className="hidden md:block" />
              복잡한 엑셀과 수기 기록은 이제 그만, AI 기반 스마트 솔루션으로 연구에만 집중하세요.
            </p>
          </div>
        </section>

        {/* 2. 직군별 고민 & 해결책 */}
        <section className="py-8 md:py-24 bg-white">
          <div className="mx-auto max-w-6xl px-4 md:px-6">
            <div className="text-center mb-5 md:mb-12">
              <h2 className="text-2xl md:text-4xl font-bold text-slate-900 mb-1.5 md:mb-4 break-keep">
                누가 쓰나요?
              </h2>
              <p className="text-sm md:text-lg text-slate-600 max-w-2xl mx-auto break-keep">
                연구실부터 기업까지, 직군별 고민을 해결합니다
              </p>
            </div>

            {/* 모바일: 가로 스와이프, 데스크탑: 3열 그리드 */}
            <div className="flex overflow-x-auto snap-x snap-mandatory gap-3 pb-5 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0 md:grid md:grid-cols-3 md:gap-8 md:overflow-visible md:pb-0 md:items-stretch">
              {/* R&D 연구자 */}
              <Card className="flex flex-col bg-white border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.04)] rounded-xl hover:shadow-md transition-shadow overflow-hidden p-4 md:p-6 min-w-[80vw] snap-center shrink-0 md:min-w-0 md:shrink md:h-full">
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <CardHeader className="p-0 pb-2">
                      <CardTitle className="text-base md:text-xl font-bold text-slate-900 break-keep">R&D 연구자</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 pt-3 space-y-2.5">
                      <div className="p-2.5 md:p-3 rounded-lg bg-slate-50 border border-slate-100">
                        <p className="text-[10px] md:text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">기존의 불편함</p>
                        <p className="text-xs md:text-sm text-slate-700 break-keep">시약 검색·스펙 비교에 매번 20분 이상 소요</p>
                      </div>
                      <div className="p-2.5 md:p-3 rounded-lg bg-blue-50 border border-blue-100">
                        <p className="text-[10px] md:text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">이렇게 바뀝니다</p>
                        <p className="text-xs md:text-sm font-medium text-blue-900 break-keep">AI 통합 검색으로 1초 만에 500만 개 제품 비교</p>
                      </div>
                    </CardContent>
                  </div>
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-amber-50 text-amber-500">
                    <Zap size={20} strokeWidth={2.5} />
                  </div>
                </div>
              </Card>

              {/* QC/QA 매니저 */}
              <Card className="flex flex-col bg-white border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.04)] rounded-xl hover:shadow-md transition-shadow overflow-hidden p-4 md:p-6 min-w-[80vw] snap-center shrink-0 md:min-w-0 md:shrink md:h-full">
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <CardHeader className="p-0 pb-2">
                      <CardTitle className="text-base md:text-xl font-bold text-slate-900 break-keep">QC/QA 매니저</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 pt-3 space-y-2.5">
                      <div className="p-2.5 md:p-3 rounded-lg bg-slate-50 border border-slate-100">
                        <p className="text-[10px] md:text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">기존의 불편함</p>
                        <p className="text-xs md:text-sm text-slate-700 break-keep">Lot No.·유효기간 수기 관리, GMP 감사 대비 부담</p>
                      </div>
                      <div className="p-2.5 md:p-3 rounded-lg bg-emerald-50 border border-emerald-100">
                        <p className="text-[10px] md:text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-1">이렇게 바뀝니다</p>
                        <p className="text-xs md:text-sm font-medium text-emerald-900 break-keep">배치 추적·유효기간 자동 알림, CFR 21 Part 11 준수</p>
                      </div>
                    </CardContent>
                  </div>
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-emerald-50 text-emerald-500">
                    <ShieldCheck size={20} strokeWidth={2.5} />
                  </div>
                </div>
              </Card>

              {/* 구매 담당자 */}
              <Card className="flex flex-col bg-white border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.04)] rounded-xl hover:shadow-md transition-shadow overflow-hidden p-4 md:p-6 min-w-[80vw] snap-center shrink-0 md:min-w-0 md:shrink md:h-full">
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <CardHeader className="p-0 pb-2">
                      <CardTitle className="text-base md:text-xl font-bold text-slate-900 break-keep">구매 담당자</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 pt-3 space-y-2.5">
                      <div className="p-2.5 md:p-3 rounded-lg bg-slate-50 border border-slate-100">
                        <p className="text-[10px] md:text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">기존의 불편함</p>
                        <p className="text-xs md:text-sm text-slate-700 break-keep">벤더별 견적 수집·정리·비교에 45분 이상 소요</p>
                      </div>
                      <div className="p-2.5 md:p-3 rounded-lg bg-indigo-50 border border-indigo-100">
                        <p className="text-[10px] md:text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-1">이렇게 바뀝니다</p>
                        <p className="text-xs md:text-sm font-medium text-indigo-900 break-keep">통합 견적 요청·가격 비교표 자동 생성, ~5분 완료</p>
                      </div>
                    </CardContent>
                  </div>
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-indigo-50 text-indigo-500">
                    <Layers size={20} strokeWidth={2.5} />
                  </div>
                </div>
              </Card>
            </div>
            <p className="md:hidden text-center text-xs text-slate-400 mt-2">← 좌우로 밀어보세요 →</p>
          </div>
        </section>

        {/* 3. Feature Grid */}
        <section className="py-8 md:py-24 bg-slate-50">
          <div className="mx-auto max-w-7xl px-4 md:px-6">
            <div className="text-center mb-5 md:mb-16">
              <h2 className="text-2xl md:text-4xl lg:text-5xl font-bold text-slate-900 mb-1.5 md:mb-4 break-keep">
                연구에만 집중하세요
              </h2>
              <p className="text-sm md:text-xl text-slate-600 max-w-2xl mx-auto break-keep">
                복잡한 재고 관리는 우리가 알아서 처리합니다
              </p>
            </div>

            {/* 모바일: 가로 스와이프(row카드), 데스크탑: 3열 그리드 */}
            <div className="flex overflow-x-auto snap-x snap-mandatory gap-3 pb-5 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0 md:grid md:grid-cols-3 md:gap-8 md:overflow-visible md:pb-0">
              {/* AI 분석 */}
              <Card className="bg-white border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.04)] rounded-xl hover:shadow-md transition-shadow p-4 md:p-6 min-w-[75vw] snap-center shrink-0 md:min-w-0 md:shrink">
                <div className="flex flex-row items-start gap-3 md:flex-col md:gap-0">
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center shrink-0 md:mb-5">
                    <Brain className="h-5 w-5 md:h-6 md:w-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardHeader className="p-0">
                      <CardTitle className="text-base md:text-xl font-bold text-slate-900 mb-0.5 break-keep">AI 분석</CardTitle>
                      <CardDescription className="text-xs md:text-base font-semibold text-slate-700 break-keep">
                        스펙 비교부터 최적 제품 추천까지
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0 pt-1.5 md:pt-4">
                      <p className="text-xs md:text-sm text-slate-600 leading-relaxed break-keep">
                        시약·장비 스펙을 AI가 자동 비교하고, 연구 목적에 맞는 최적 제품을 추천합니다.
                      </p>
                    </CardContent>
                  </div>
                </div>
              </Card>

              {/* 프로토콜 분석 */}
              <Card className="bg-white border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.04)] rounded-xl hover:shadow-md transition-shadow p-4 md:p-6 min-w-[75vw] snap-center shrink-0 md:min-w-0 md:shrink">
                <div className="flex flex-row items-start gap-3 md:flex-col md:gap-0">
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center shrink-0 md:mb-5">
                    <Zap className="h-5 w-5 md:h-6 md:w-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardHeader className="p-0">
                      <CardTitle className="text-base md:text-xl font-bold text-slate-900 mb-0.5 break-keep">프로토콜 분석</CardTitle>
                      <CardDescription className="text-xs md:text-base font-semibold text-slate-700 break-keep">
                        실험 프로토콜 → 시약 리스트 자동 생성
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0 pt-1.5 md:pt-4">
                      <p className="text-xs md:text-sm text-slate-600 leading-relaxed break-keep">
                        프로토콜 문서를 붙여넣으면 필요한 시약을 자동으로 추출하고 재고와 매칭합니다.
                      </p>
                    </CardContent>
                  </div>
                </div>
              </Card>

              {/* 자동화 */}
              <Card className="bg-white border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.04)] rounded-xl hover:shadow-md transition-shadow p-4 md:p-6 min-w-[75vw] snap-center shrink-0 md:min-w-0 md:shrink">
                <div className="flex flex-row items-start gap-3 md:flex-col md:gap-0">
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shrink-0 md:mb-5">
                    <Layers className="h-5 w-5 md:h-6 md:w-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardHeader className="p-0">
                      <CardTitle className="text-base md:text-xl font-bold text-slate-900 mb-0.5 break-keep">자동화</CardTitle>
                      <CardDescription className="text-xs md:text-base font-semibold text-slate-700 break-keep">
                        배송 완료와 동시에 인벤토리 등록
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0 pt-1.5 md:pt-4">
                      <p className="text-xs md:text-sm text-slate-600 leading-relaxed break-keep">
                        주문 내역이 자동으로 인벤토리에 반영되어 수동 입력이 필요 없습니다.
                      </p>
                    </CardContent>
                  </div>
                </div>
              </Card>

              {/* 중복 구매 방지 */}
              <Card className="bg-white border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.04)] rounded-xl hover:shadow-md transition-shadow p-4 md:p-6 min-w-[75vw] snap-center shrink-0 md:min-w-0 md:shrink">
                <div className="flex flex-row items-start gap-3 md:flex-col md:gap-0">
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shrink-0 md:mb-5">
                    <Users className="h-5 w-5 md:h-6 md:w-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardHeader className="p-0">
                      <CardTitle className="text-base md:text-xl font-bold text-slate-900 mb-0.5 break-keep">중복 구매 방지</CardTitle>
                      <CardDescription className="text-xs md:text-base font-semibold text-slate-700 break-keep">
                        옆 실험대에 있는데 또 주문하셨나요?
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0 pt-1.5 md:pt-4">
                      <p className="text-xs md:text-sm text-slate-600 leading-relaxed break-keep">
                        연구실 전체 재고를 통합 검색하세요. 불필요한 지출을 막고, 급할 땐 동료의 시약을 바로 찾을 수 있습니다.
                      </p>
                    </CardContent>
                  </div>
                </div>
              </Card>

              {/* AI 예측 */}
              <Card className="bg-white border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.04)] rounded-xl hover:shadow-md transition-shadow p-4 md:p-6 min-w-[75vw] snap-center shrink-0 md:min-w-0 md:shrink">
                <div className="flex flex-row items-start gap-3 md:flex-col md:gap-0">
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shrink-0 md:mb-5">
                    <Brain className="h-5 w-5 md:h-6 md:w-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardHeader className="p-0">
                      <CardTitle className="text-base md:text-xl font-bold text-slate-900 mb-0.5 break-keep">AI 예측</CardTitle>
                      <CardDescription className="text-xs md:text-base font-semibold text-slate-700 break-keep">
                        떨어질 때를 미리 알려주는 스마트 알림
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0 pt-1.5 md:pt-4">
                      <p className="text-xs md:text-sm text-slate-600 leading-relaxed break-keep">
                        과거 주문 패턴을 분석하여 재구매 시점을 예측하고 알림을 보내드립니다.
                      </p>
                    </CardContent>
                  </div>
                </div>
              </Card>
            </div>
            <p className="md:hidden text-center text-xs text-slate-400 mt-2">← 좌우로 밀어보세요 →</p>
          </div>
        </section>

        {/* 4. ComparisonTable: "작업 방식 비교" */}
        <div className="mx-auto w-full max-w-6xl px-4 md:px-6">
          <ComparisonSection />
        </div>

        {/* 5. SecuritySection: "강력한 보안" */}
        <div className="mx-auto w-full max-w-6xl px-4 md:px-6">
          <SecuritySection />
        </div>

        {/* 6. CTASection: "지금 시작하기" */}
        <FinalCTASection />
      </div>
      <MainFooter />
    </MainLayout>
  );
}
