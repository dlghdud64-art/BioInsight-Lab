import { MainLayout } from "../_components/main-layout";
import { MainHeader } from "../_components/main-header";
import { MainFooter } from "../_components/main-footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FlaskConical, ClipboardCheck, ShoppingCart, Zap, Brain, Package, Users } from "lucide-react";
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
        {/* 1. Hero Section - Clean & Professional */}
        <section className="relative py-24 md:py-32 bg-gradient-to-b from-blue-50 to-white overflow-hidden">
          {/* 격자 무늬 배경 */}
          <div className="absolute inset-0 opacity-20 pointer-events-none">
            <div className="absolute inset-0" style={{
              backgroundImage: `linear-gradient(to right, rgba(0,0,0,0.02) 1px, transparent 1px),
                                linear-gradient(to bottom, rgba(0,0,0,0.02) 1px, transparent 1px)`,
              backgroundSize: '40px 40px'
            }}></div>
          </div>
          
          <div className="relative mx-auto max-w-4xl px-4 md:px-6 text-center">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 mb-6 leading-tight">
              연구실 관리의 새로운 표준
            </h1>
            <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
              연구실 재고 관리와 구매 프로세스를 한 곳에서 통합 관리하세요.
              <br />
              복잡한 엑셀과 수기 기록은 이제 그만, AI 기반 스마트 솔루션으로 연구에만 집중하세요.
            </p>
          </div>
        </section>

        {/* 2. User Persona - 3열 카드 그리드 */}
        <section className="py-16 md:py-24 bg-white">
          <div className="mx-auto max-w-6xl px-4 md:px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
                누가 쓰나요?
              </h2>
              <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                연구실부터 기업까지, 다양한 역할에 맞춘 솔루션
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
              {/* R&D 연구자 */}
              <Card className="bg-white border border-slate-200 shadow-sm rounded-xl hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center mb-4">
                    <FlaskConical className="h-6 w-6 text-purple-600" />
                  </div>
                  <CardTitle className="text-xl font-bold text-slate-900 mb-2">
                    R&D 연구자
                  </CardTitle>
                  <CardDescription className="text-base font-semibold text-slate-700">
                    실험 설계에만 집중하세요
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600 leading-relaxed mb-3">
                    시약 검색과 재고 파악은 AI가 1초 만에 끝냅니다.
                  </p>
                  <ul className="space-y-2 text-sm text-slate-600">
                    <li className="flex items-start gap-2">
                      <span className="text-purple-600 mt-1">•</span>
                      <span>프로토콜에서 시약 자동 추출</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-purple-600 mt-1">•</span>
                      <span>스펙 중심 제품 비교</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-purple-600 mt-1">•</span>
                      <span>영문 데이터시트 한글 번역</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              {/* QC/QA 매니저 */}
              <Card className="bg-white border border-slate-200 shadow-sm rounded-xl hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center mb-4">
                    <ClipboardCheck className="h-6 w-6 text-emerald-600" />
                  </div>
                  <CardTitle className="text-xl font-bold text-slate-900 mb-2">
                    QC/QA 매니저
                  </CardTitle>
                  <CardDescription className="text-base font-semibold text-slate-700">
                    바이오·의료기기 제조를 위한 엄격한 자재 관리
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600 leading-relaxed mb-3">
                    Lot No. 추적부터 유효기간 관리까지, GMP/ISO 감사를 완벽하게 대비하세요.
                  </p>
                  <ul className="space-y-2 text-sm text-slate-600">
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-600 mt-1">•</span>
                      <span>Lot No. 및 배치 추적 관리</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-600 mt-1">•</span>
                      <span>GMP/ISO 규격 준수 검증</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-600 mt-1">•</span>
                      <span>유효기간 자동 알림 및 관리</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              {/* 구매 담당자 */}
              <Card className="bg-white border border-slate-200 shadow-sm rounded-xl hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center mb-4">
                    <ShoppingCart className="h-6 w-6 text-indigo-600" />
                  </div>
                  <CardTitle className="text-xl font-bold text-slate-900 mb-2">
                    구매 담당자
                  </CardTitle>
                  <CardDescription className="text-base font-semibold text-slate-700">
                    투명한 예산 집행
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600 leading-relaxed mb-3">
                    견적 요청부터 결제 품의까지, 복잡한 구매 프로세스를 원클릭으로 해결합니다.
                  </p>
                  <ul className="space-y-2 text-sm text-slate-600">
                    <li className="flex items-start gap-2">
                      <span className="text-indigo-600 mt-1">•</span>
                      <span>견적 요청 리스트 통합</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-indigo-600 mt-1">•</span>
                      <span>벤더별 가격·납기 비교</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-indigo-600 mt-1">•</span>
                      <span>구매 리포트 자동 생성</span>
                    </li>
                  </ul>
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
