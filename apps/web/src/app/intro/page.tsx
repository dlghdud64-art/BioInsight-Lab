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
        {/* 1. Hero Section - Premium & Professional */}
        <section className="relative py-24 md:py-32 bg-gradient-to-b from-blue-50/80 via-white to-white overflow-hidden">
          {/* 실험실 대시보드 패턴 배경 */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 opacity-[0.03]" style={{
              backgroundImage: `linear-gradient(to right, rgba(0,0,0,0.04) 1px, transparent 1px),
                                linear-gradient(to bottom, rgba(0,0,0,0.04) 1px, transparent 1px)`,
              backgroundSize: '32px 32px'
            }}></div>
            {/* 대시보드 실루엣 - 차트/그리드 느낌 */}
            <div className="absolute bottom-0 left-0 right-0 h-1/3 opacity-[0.02]" style={{
              backgroundImage: `repeating-linear-gradient(90deg, transparent, transparent 60px, rgba(59,130,246,0.3) 60px, rgba(59,130,246,0.3) 62px),
                                repeating-linear-gradient(0deg, transparent, transparent 40px, rgba(59,130,246,0.2) 40px, rgba(59,130,246,0.2) 42px)`,
              backgroundSize: '120px 80px'
            }}></div>
          </div>
          
          <div className="relative mx-auto max-w-4xl px-4 md:px-6 text-center">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 mb-6 leading-tight">
              연구실 관리의 새로운 표준
            </h1>
            <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
              연구실 재고 관리와 구매 프로세스를 한 곳에서 통합 관리하세요.
              <br />
              복잡한 엑셀과 수기 기록은 이제 그만, AI 기반 스마트 솔루션으로 연구에만 집중하세요.
            </p>
          </div>
        </section>

        {/* 2. 핵심 기능 시각화 - 직군별 페인포인트 & 해결책 1:1 매칭 */}
        <section className="py-16 md:py-24 bg-white">
          <div className="mx-auto max-w-6xl px-4 md:px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
                누가 쓰나요?
              </h2>
              <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                연구실부터 기업까지, 직군별 페인포인트를 해결합니다
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 items-stretch">
              {/* R&D 연구자 */}
              <Card className="relative bg-white border border-slate-200 shadow-sm rounded-xl hover:shadow-md transition-shadow overflow-hidden h-full">
                <div className="absolute top-8 right-8 w-12 h-12 rounded-xl flex items-center justify-center bg-amber-50 text-amber-500">
                  <Zap size={24} strokeWidth={2.5} />
                </div>
                <CardHeader className="pb-2 pt-12">
                  <CardTitle className="text-xl font-bold text-slate-900 pr-14">
                    R&D 연구자
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">페인포인트</p>
                    <p className="text-sm text-slate-700">시약 검색·스펙 비교에 매번 20분 이상 소요</p>
                  </div>
                  <div className="p-3 rounded-lg bg-blue-50 border border-blue-100">
                    <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">해결책</p>
                    <p className="text-sm font-medium text-blue-900">AI 통합 검색으로 1초 만에 500만 개 제품 비교</p>
                  </div>
                </CardContent>
              </Card>

              {/* QC/QA 매니저 */}
              <Card className="relative bg-white border border-slate-200 shadow-sm rounded-xl hover:shadow-md transition-shadow overflow-hidden h-full">
                <div className="absolute top-8 right-8 w-12 h-12 rounded-xl flex items-center justify-center bg-emerald-50 text-emerald-500">
                  <ShieldCheck size={24} strokeWidth={2.5} />
                </div>
                <CardHeader className="pb-2 pt-12">
                  <CardTitle className="text-xl font-bold text-slate-900 pr-14">
                    QC/QA 매니저
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">페인포인트</p>
                    <p className="text-sm text-slate-700">Lot No.·유효기간 수기 관리, GMP 감사 대비 부담</p>
                  </div>
                  <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-100">
                    <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-1">해결책</p>
                    <p className="text-sm font-medium text-emerald-900">배치 추적·유효기간 자동 알림, CFR 21 Part 11 준수</p>
                  </div>
                </CardContent>
              </Card>

              {/* 구매 담당자 */}
              <Card className="relative bg-white border border-slate-200 shadow-sm rounded-xl hover:shadow-md transition-shadow overflow-hidden h-full">
                <div className="absolute top-8 right-8 w-12 h-12 rounded-xl flex items-center justify-center bg-indigo-50 text-indigo-500">
                  <Layers size={24} strokeWidth={2.5} />
                </div>
                <CardHeader className="pb-2 pt-12">
                  <CardTitle className="text-xl font-bold text-slate-900 pr-14">
                    구매 담당자
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">페인포인트</p>
                    <p className="text-sm text-slate-700">벤더별 견적 수집·정리·비교에 45분 이상 소요</p>
                  </div>
                  <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-100">
                    <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-1">해결책</p>
                    <p className="text-sm font-medium text-indigo-900">통합 견적 요청·가격 비교표 자동 생성, ~5분 완료</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* 3. Feature Grid - 아이콘 박스 형태 */}
        <section className="py-16 md:py-24 bg-slate-50">
          <div className="mx-auto max-w-7xl px-4 md:px-6">
            <div className="text-center mb-12 md:mb-16">
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-slate-900 mb-4">
                연구에만 집중하세요
              </h2>
              <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto">
                복잡한 재고 관리는 우리가 알아서 처리합니다
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
              {/* 자동화 */}
              <Card className="bg-white border border-slate-200 shadow-sm rounded-xl hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mb-4 shadow-lg">
                    <Zap className="h-7 w-7 text-white" />
                  </div>
                  <CardTitle className="text-xl md:text-2xl font-bold text-slate-900 mb-1">
                    자동화
                  </CardTitle>
                  <CardDescription className="text-base md:text-lg font-semibold text-slate-700">
                    배송 완료와 동시에 인벤토리 등록
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm md:text-base text-slate-600 leading-relaxed">
                    주문 내역이 자동으로 인벤토리에 반영되어 수동 입력이 필요 없습니다.
                  </p>
                </CardContent>
              </Card>

              {/* 중복 구매 방지 */}
              <Card className="bg-white border border-slate-200 shadow-sm rounded-xl hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center mb-4 shadow-lg">
                    <Users className="h-7 w-7 text-white" />
                  </div>
                  <CardTitle className="text-xl md:text-2xl font-bold text-slate-900 mb-1">
                    중복 구매 방지
                    <span className="text-xs md:text-sm font-normal text-slate-500 ml-2">
                      (Inventory Sharing)
                    </span>
                  </CardTitle>
                  <CardDescription className="text-base md:text-lg font-semibold text-slate-700">
                    옆 실험대에 있는데 또 주문하셨나요?
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm md:text-base text-slate-600 leading-relaxed">
                    연구실 전체 재고를 통합 검색하세요. 불필요한 지출을 막고, 급할 땐 동료의 시약을 바로 찾을 수 있습니다.
                  </p>
                </CardContent>
              </Card>

              {/* AI 예측 */}
              <Card className="bg-white border border-slate-200 shadow-sm rounded-xl hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center mb-4 shadow-lg">
                    <Brain className="h-7 w-7 text-white" />
                  </div>
                  <CardTitle className="text-xl md:text-2xl font-bold text-slate-900 mb-1">
                    AI 예측
                  </CardTitle>
                  <CardDescription className="text-base md:text-lg font-semibold text-slate-700">
                    떨어질 때를 미리 알려주는 스마트 알림
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm md:text-base text-slate-600 leading-relaxed">
                    과거 주문 패턴을 분석하여 재구매 시점을 예측하고 알림을 보내드립니다.
                  </p>
                </CardContent>
              </Card>
            </div>
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
