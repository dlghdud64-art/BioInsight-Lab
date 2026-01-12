"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Package, AlertTriangle, FlaskConical, Minus, Plus } from "lucide-react";

export function BioInsightHeroSection() {
  // 실시간 시약 사용 기록 데이터
  const usageLogs = [
    { time: "10:30", researcher: "김연구원", item: "Ethanol (99.5%)", amount: "50ml" },
    { time: "09:15", researcher: "박박사", item: "FBS (Media)", amount: "1 bottle" },
    { time: "09:00", researcher: "이조교", item: "Tips (1000uL)", amount: "1 rack" },
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
          {/* Primary Color Glow Effect (후광 효과) */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-full max-w-5xl h-[400px] md:h-[500px] lg:h-[600px] bg-blue-500/10 rounded-full blur-3xl"></div>
          </div>

          {/* 대시보드 카드 - 프레임 없이 순수한 카드 형태 */}
          <div className="relative z-10 w-full max-w-5xl">
            {/* 대시보드 이미지 영역 - 공중에 떠 있는 스마트 보드 스타일 */}
            <div className="relative bg-white rounded-2xl overflow-hidden shadow-2xl shadow-blue-500/10 ring-1 ring-gray-900/10">
              {/* 실제 대시보드 목업 콘텐츠 */}
              <div className="w-full h-[400px] md:h-[500px] lg:h-[600px] bg-gradient-to-br from-gray-50 to-white p-4 md:p-6">
                <div className="h-full grid grid-cols-12 grid-rows-6 gap-3 md:gap-4">
                  {/* (A) 상단 KPI 카드 3개 - 실물 데이터 */}
                  {/* 1. 총 보유 시약 */}
                  <div className="col-span-12 md:col-span-4 bg-white rounded-lg border border-gray-200 p-3 md:p-4 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-xs text-gray-500">📦 총 보유 시약</div>
                      <Package className="h-3 w-3 md:h-4 md:w-4 text-blue-600" />
                    </div>
                    <div className="text-lg md:text-xl font-bold text-gray-900 mb-1">1,240 개</div>
                    <div className="text-[10px] md:text-xs text-gray-500">정상 관리 중</div>
                  </div>

                  {/* 2. 재고 부족 알림 */}
                  <div className="col-span-12 md:col-span-4 bg-white rounded-lg border border-red-200 p-3 md:p-4 shadow-sm hover:shadow-md transition-shadow bg-red-50/30">
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-xs text-gray-500">🚨 재고 부족 알림</div>
                      <AlertTriangle className="h-3 w-3 md:h-4 md:w-4 text-red-600" />
                    </div>
                    <div className="text-lg md:text-xl font-bold text-red-600 mb-1">3 품목</div>
                    <div className="text-[10px] md:text-xs text-red-500">긴급 주문 필요</div>
                  </div>

                  {/* 3. 오늘 예정 실험 */}
                  <div className="col-span-12 md:col-span-4 bg-white rounded-lg border border-gray-200 p-3 md:p-4 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-xs text-gray-500">🧪 오늘 예정 실험</div>
                      <FlaskConical className="h-3 w-3 md:h-4 md:w-4 text-purple-600" />
                    </div>
                    <div className="text-lg md:text-xl font-bold text-gray-900 mb-1">2 건</div>
                    <div className="text-[10px] md:text-xs text-gray-500">내 할 일</div>
                  </div>
                  
                  {/* (B) 메인 콘텐츠 - 실시간 시약 사용 기록 테이블 */}
                  <div className="col-span-12 md:col-span-8 bg-white rounded-lg border border-gray-200 p-3 md:p-4 shadow-sm hover:shadow-md transition-shadow">
                    <div className="text-xs md:text-sm text-gray-700 font-medium mb-3">실시간 시약 사용 기록</div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs md:text-sm">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="text-left py-2 px-2 text-gray-500 font-medium">시간</th>
                            <th className="text-left py-2 px-2 text-gray-500 font-medium">연구원</th>
                            <th className="text-left py-2 px-2 text-gray-500 font-medium">사용 품목</th>
                            <th className="text-right py-2 px-2 text-gray-500 font-medium">사용량</th>
                          </tr>
                        </thead>
                        <tbody>
                          {usageLogs.map((log, idx) => (
                            <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                              <td className="py-2.5 px-2 text-gray-900 font-medium">{log.time}</td>
                              <td className="py-2.5 px-2 text-gray-900">{log.researcher}</td>
                              <td className="py-2.5 px-2 text-gray-900">{log.item}</td>
                              <td className="py-2.5 px-2 text-right text-gray-900 font-semibold">
                                ➖ {log.amount}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  
                  {/* (C) 우측 패널 - 퀵 버튼 */}
                  <div className="col-span-12 md:col-span-4 bg-white rounded-lg border border-gray-200 p-3 md:p-4 shadow-sm hover:shadow-md transition-shadow">
                    <div className="text-xs md:text-sm text-gray-700 font-medium mb-3">빠른 작업</div>
                    <div className="space-y-3">
                      <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 h-auto">
                        <Minus className="h-4 w-4 mr-2" />
                        사용 등록
                      </Button>
                      <Button variant="outline" className="w-full border-gray-300 text-gray-700 hover:bg-gray-50 font-medium py-3 h-auto">
                        <Plus className="h-4 w-4 mr-2" />
                        재고 입고
                      </Button>
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

