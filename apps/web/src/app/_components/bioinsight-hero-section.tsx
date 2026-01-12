"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function BioInsightHeroSection() {
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
          {/* Primary Color Glow Effect (후광 효과) */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-full max-w-5xl h-[400px] md:h-[500px] lg:h-[600px] bg-blue-500/10 rounded-full blur-3xl"></div>
          </div>

          {/* 노트북 프레임 */}
          <div className="relative z-10 w-full max-w-5xl">
            {/* 노트북 상단 바 */}
            <div className="bg-gray-200 rounded-t-lg px-4 py-2 flex items-center gap-2 border-b border-gray-300">
              <div className="flex gap-1.5 px-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
              </div>
              <div className="flex-1 bg-white rounded px-3 py-1 text-xs text-gray-600 text-center border border-gray-300">
                dashboard.bioinsight.com
              </div>
            </div>

            {/* 대시보드 이미지 영역 */}
            <div className="relative bg-white rounded-b-lg overflow-hidden shadow-2xl ring-1 ring-gray-900/10 transform perspective-1000" style={{ transform: 'perspective(1000px) rotateX(2deg)' }}>
              {/* 실제 대시보드 목업 콘텐츠 */}
              <div className="w-full h-[400px] md:h-[500px] lg:h-[600px] bg-gray-50 p-4 md:p-6">
                <div className="h-full grid grid-cols-12 grid-rows-6 gap-3 md:gap-4">
                  {/* 상단 KPI 카드들 */}
                  <div className="col-span-12 md:col-span-3 bg-white rounded-lg border border-gray-200 p-3 md:p-4 shadow-sm">
                    <div className="text-xs text-gray-500 mb-1">재고 부족 알림</div>
                    <div className="text-xl md:text-2xl font-bold text-gray-900">3개</div>
                  </div>
                  <div className="col-span-12 md:col-span-3 bg-white rounded-lg border border-gray-200 p-3 md:p-4 shadow-sm">
                    <div className="text-xs text-gray-500 mb-1">진행 중인 견적</div>
                    <div className="text-xl md:text-2xl font-bold text-gray-900">5건</div>
                  </div>
                  <div className="col-span-12 md:col-span-3 bg-white rounded-lg border border-gray-200 p-3 md:p-4 shadow-sm">
                    <div className="text-xs text-gray-500 mb-1">배송 중인 물품</div>
                    <div className="text-xl md:text-2xl font-bold text-gray-900">2개</div>
                  </div>
                  <div className="col-span-12 md:col-span-3 bg-white rounded-lg border border-gray-200 p-3 md:p-4 shadow-sm">
                    <div className="text-xs text-gray-500 mb-1">이번 달 지출</div>
                    <div className="text-xl md:text-2xl font-bold text-gray-900">₩3.2M</div>
                  </div>
                  
                  {/* 차트 영역 */}
                  <div className="col-span-12 md:col-span-8 bg-white rounded-lg border border-gray-200 p-3 md:p-4 shadow-sm">
                    <div className="text-xs text-gray-500 mb-2 font-medium">지출 추이</div>
                    <div className="h-full flex items-end gap-1.5 md:gap-2">
                      {[60, 80, 45, 90, 70, 85].map((height, i) => (
                        <div
                          key={i}
                          className="flex-1 bg-gradient-to-t from-blue-500 to-blue-400 rounded-t shadow-sm"
                          style={{ height: `${height}%` }}
                        ></div>
                      ))}
                    </div>
                  </div>
                  
                  {/* 재구매 추천 리스트 */}
                  <div className="col-span-12 md:col-span-4 bg-white rounded-lg border border-gray-200 p-3 md:p-4 shadow-sm">
                    <div className="text-xs text-gray-500 mb-2 font-medium">재구매 추천</div>
                    <div className="space-y-1.5 md:space-y-2">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="bg-gray-50 rounded p-2 border border-gray-100">
                          <div className="text-xs text-gray-900 font-medium">항체 A-{i}</div>
                          <div className="text-[10px] text-gray-500">재고 부족</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 추가 카드: 예산 비중 차트 */}
                  <div className="col-span-12 md:col-span-4 bg-white rounded-lg border border-gray-200 p-3 md:p-4 shadow-sm">
                    <div className="text-xs text-gray-500 mb-2 font-medium">예산 비중</div>
                    <div className="flex items-center justify-center h-full">
                      <div className="relative w-20 h-20 md:w-24 md:h-24">
                        <div className="absolute inset-0 rounded-full border-8 border-blue-500 border-t-transparent" style={{ transform: 'rotate(45deg)' }}></div>
                        <div className="absolute inset-0 rounded-full border-8 border-purple-500 border-r-transparent border-t-transparent" style={{ transform: 'rotate(135deg)' }}></div>
                        <div className="absolute inset-0 rounded-full border-8 border-pink-500 border-b-transparent border-r-transparent border-t-transparent" style={{ transform: 'rotate(225deg)' }}></div>
                      </div>
                    </div>
                  </div>

                  {/* 추가 카드: 최근 주문 내역 */}
                  <div className="col-span-12 md:col-span-8 bg-white rounded-lg border border-gray-200 p-3 md:p-4 shadow-sm">
                    <div className="text-xs text-gray-500 mb-2 font-medium">최근 주문 내역</div>
                    <div className="space-y-1.5 md:space-y-2">
                      {[
                        { name: "Reagent A", status: "배송중", amount: "₩500K" },
                        { name: "Antibody B", status: "완료", amount: "₩1.2M" },
                        { name: "Buffer C", status: "대기", amount: "₩300K" },
                      ].map((order, i) => (
                        <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-100">
                          <div className="flex-1">
                            <div className="text-xs text-gray-900 font-medium">{order.name}</div>
                            <div className="text-[10px] text-gray-500">{order.status}</div>
                          </div>
                          <div className="text-xs font-semibold text-gray-900">{order.amount}</div>
                        </div>
                      ))}
                    </div>
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

