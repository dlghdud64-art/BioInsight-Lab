"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Package, AlertTriangle, Truck } from "lucide-react";

export function BioInsightHeroSection() {
  // 최근 시약 사용 이력 데이터
  const usageLogs = [
    { researcher: "김연구원", item: "Ethanol 99.5%", amount: "50ml 사용", time: "10분 전" },
    { researcher: "박박사", item: "FBS (Gibco)", amount: "1 bottle", time: "1시간 전" },
    { researcher: "이조교", item: "Tips (1000uL)", amount: "2 rack", time: "3시간 전" },
  ];

  return (
    <section className="relative border-b border-slate-200 bg-gradient-to-b from-white via-blue-50/30 to-white pt-28 pb-12 md:pt-32 md:pb-16 lg:pt-36 lg:pb-20 overflow-hidden">
      {/* 배경 장식 요소 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-10 w-72 h-72 bg-blue-100/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 left-10 w-96 h-96 bg-indigo-100/20 rounded-full blur-3xl"></div>
      </div>

      <div className="relative mx-auto max-w-7xl px-4 md:px-6">
        {/* 텍스트 콘텐츠 - 가운데 정렬 */}
        <div className="text-center space-y-6 md:space-y-8 mb-12 md:mb-16">
          <div className="space-y-4 md:space-y-6">
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold leading-tight tracking-tight text-slate-900">
              엑셀 없는 연구실,
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                BioInsight
              </span>
            </h1>
            <p className="text-base md:text-lg lg:text-xl leading-relaxed text-slate-700 max-w-3xl mx-auto">
              구매부터 재고 관리, 정산까지. 클릭 한 번으로 끝내세요.
            </p>
          </div>

          {/* 버튼 그룹 - 가운데 정렬 */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/auth/signin">
              <Button 
                size="lg"
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transition-all text-base md:text-lg px-8 md:px-10 py-6 md:py-7 h-auto min-h-[56px] font-semibold"
              >
                무료로 시작하기
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>

          {/* Trust indicators */}
          <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6 pt-2 text-sm text-slate-600">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              <span>무료 체험</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              <span>즉시 시작</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
              <span>회원가입 간편</span>
            </div>
          </div>
        </div>

        {/* 대시보드 이미지 - 노트북 프레임 안에 */}
        <div className="relative flex items-center justify-center">
          {/* Blue Glow Effect (깊이감 부여) */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-full max-w-5xl h-[400px] md:h-[500px] lg:h-[600px] bg-blue-500/20 rounded-full blur-3xl"></div>
          </div>

          {/* 대시보드 Window - Standard Grid UI */}
          <div className="relative z-10 w-full max-w-5xl">
            {/* Window Shell */}
            <div className="bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
              {/* Header Bar */}
              <div className="h-10 bg-gray-50 border-b flex items-center px-4 gap-2">
                {/* 미니멀한 회색 원 컨트롤 */}
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 bg-gray-200 rounded-full"></div>
                  <div className="w-2 h-2 bg-gray-200 rounded-full"></div>
                  <div className="w-2 h-2 bg-gray-200 rounded-full"></div>
                </div>
              </div>
              
              {/* 콘텐츠 영역 - flex-col 레이아웃 */}
              <div className="flex flex-col">
                {/* Row 1: KPI Cards */}
                <div className="grid grid-cols-3 gap-4 p-6 border-b">
                  {/* Card 1: 전체 재고 */}
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">📦</span>
                      <div className="text-xs text-gray-500 truncate">전체 재고</div>
                    </div>
                    <div className="text-xl font-bold text-gray-900 truncate">1,240</div>
                  </div>

                  {/* Card 2: 재고 부족 */}
                  <div className="bg-gray-50 rounded-lg p-4 border border-red-200">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">🚨</span>
                      <div className="text-xs text-gray-500 truncate">재고 부족</div>
                    </div>
                    <div className="text-xl font-bold text-red-600 truncate">3 품목</div>
                  </div>

                  {/* Card 3: 배송 중 */}
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Truck className="h-4 w-4 text-gray-600" />
                      <div className="text-xs text-gray-500 truncate">배송 중</div>
                    </div>
                    <div className="text-xl font-bold text-gray-900 truncate">5 건</div>
                  </div>
                </div>

                {/* Row 2: Main Table */}
                <div className="p-6">
                  <div className="text-sm font-bold text-gray-900 mb-4 truncate">최근 시약 사용 이력</div>
                  <div className="w-full border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 border-b border-gray-200">연구원</th>
                          <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 border-b border-gray-200">품목</th>
                          <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 border-b border-gray-200">사용량</th>
                          <th className="text-right py-3 px-4 text-xs font-semibold text-gray-700 border-b border-gray-200">시간</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usageLogs.map((log, idx) => (
                          <tr key={idx} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors">
                            <td className="py-3 px-4 text-sm text-gray-900 truncate">{log.researcher}</td>
                            <td className="py-3 px-4 text-sm text-gray-900 truncate">{log.item}</td>
                            <td className="py-3 px-4 text-sm text-gray-900 truncate">{log.amount}</td>
                            <td className="py-3 px-4 text-sm text-gray-500 text-right truncate">{log.time}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

