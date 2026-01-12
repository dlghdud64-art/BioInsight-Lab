"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, TrendingUp, Package, AlertTriangle, Wallet } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, CartesianGrid } from "recharts";

export function BioInsightHeroSection() {
  // 애니메이션을 위한 상태
  const [isAnimated, setIsAnimated] = useState(false);
  const [countedAmount, setCountedAmount] = useState(0);

  // 페이지 로드 시 애니메이션 시작
  useEffect(() => {
    setIsAnimated(true);
    
    // 숫자 카운트업 애니메이션
    const targetAmount = 3240000;
    const duration = 2000; // 2초
    const steps = 60;
    const increment = targetAmount / steps;
    let current = 0;
    
    const timer = setInterval(() => {
      current += increment;
      if (current >= targetAmount) {
        setCountedAmount(targetAmount);
        clearInterval(timer);
      } else {
        setCountedAmount(Math.floor(current));
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, []);

  // 월별 시약 구매 추이 데이터
  const monthlyData = [
    { month: "1월", amount: 2400000 },
    { month: "2월", amount: 2800000 },
    { month: "3월", amount: 2100000 },
    { month: "4월", amount: 3200000 },
    { month: "5월", amount: 2900000 },
    { month: "6월", amount: 3240000 },
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

          {/* 노트북 프레임 */}
          <div className="relative z-10 w-full max-w-5xl">
            {/* Mac OS Window Style - 상단 바 강화 */}
            <div className="bg-gradient-to-b from-gray-100 to-gray-200 rounded-t-lg px-4 py-2.5 flex items-center gap-3 border-b-2 border-gray-300 shadow-sm">
              {/* 트래픽 라이트 버튼 */}
              <div className="flex gap-1.5 px-2">
                <div className="w-3.5 h-3.5 rounded-full bg-red-500 shadow-inner"></div>
                <div className="w-3.5 h-3.5 rounded-full bg-yellow-500 shadow-inner"></div>
                <div className="w-3.5 h-3.5 rounded-full bg-green-500 shadow-inner"></div>
              </div>
              <div className="flex-1 bg-white rounded-md px-4 py-1.5 text-xs text-gray-600 text-center border border-gray-300 shadow-inner">
                dashboard.bioinsight.com
              </div>
            </div>

            {/* 대시보드 이미지 영역 - Shadow 강화 */}
            <div className="relative bg-white rounded-b-lg overflow-hidden shadow-2xl shadow-blue-500/10 ring-1 ring-gray-900/10 transform perspective-1000" style={{ transform: 'perspective(1000px) rotateX(2deg)' }}>
              {/* 실제 대시보드 목업 콘텐츠 */}
              <div className="w-full h-[400px] md:h-[500px] lg:h-[600px] bg-gradient-to-br from-gray-50 to-white p-4 md:p-6">
                <div className="h-full grid grid-cols-12 grid-rows-6 gap-3 md:gap-4">
                  {/* (A) 상단 KPI 카드 4개 */}
                  {/* 1. 이번 달 지출 */}
                  <div className="col-span-12 md:col-span-3 bg-white rounded-lg border border-gray-200 p-3 md:p-4 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-xs text-gray-500">이번 달 지출</div>
                      <TrendingUp className="h-3 w-3 md:h-4 md:w-4 text-blue-600" />
                    </div>
                    <div className="text-lg md:text-xl font-bold text-gray-900 mb-1">
                      ₩{countedAmount.toLocaleString("ko-KR")}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] md:text-xs text-green-600">
                      <TrendingUp className="h-3 w-3" />
                      <span>전월 대비 +12%</span>
                    </div>
                  </div>

                  {/* 2. 진행 중인 주문 */}
                  <div className="col-span-12 md:col-span-3 bg-white rounded-lg border border-gray-200 p-3 md:p-4 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-xs text-gray-500">진행 중인 주문</div>
                      <Package className="h-3 w-3 md:h-4 md:w-4 text-gray-400" />
                    </div>
                    <div className="text-lg md:text-xl font-bold text-gray-900 mb-1">5건</div>
                    <div className="text-[10px] md:text-xs text-gray-500">배송 중 2건</div>
                  </div>

                  {/* 3. 재고 경고 */}
                  <div className="col-span-12 md:col-span-3 bg-white rounded-lg border border-red-200 p-3 md:p-4 shadow-sm hover:shadow-md transition-shadow bg-red-50/30">
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-xs text-gray-500">재고 경고</div>
                      <AlertTriangle className="h-3 w-3 md:h-4 md:w-4 text-red-600" />
                    </div>
                    <div className="text-lg md:text-xl font-bold text-red-600 mb-1">3개 품목</div>
                    <div className="text-[10px] md:text-xs text-red-500">재고 부족 알림</div>
                  </div>

                  {/* 4. 남은 예산 */}
                  <div className="col-span-12 md:col-span-3 bg-white rounded-lg border border-gray-200 p-3 md:p-4 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-xs text-gray-500">남은 예산</div>
                      <Wallet className="h-3 w-3 md:h-4 md:w-4 text-gray-400" />
                    </div>
                    <div className="text-lg md:text-xl font-bold text-gray-900">₩12,500,000</div>
                    <div className="text-[10px] md:text-xs text-gray-500">이번 달 예산</div>
                  </div>
                  
                  {/* (B) 메인 차트 - 월별 시약 구매 추이 Area Chart */}
                  <div className="col-span-12 md:col-span-8 bg-white rounded-lg border border-gray-200 p-3 md:p-4 shadow-sm hover:shadow-md transition-shadow">
                    <div className="text-xs md:text-sm text-gray-700 font-medium mb-3">월별 시약 구매 추이</div>
                    <div className="h-[calc(100%-2rem)]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={monthlyData}
                          margin={{ top: 5, right: 5, left: 0, bottom: 0 }}
                        >
                          <defs>
                            <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis 
                            dataKey="month" 
                            tick={{ fontSize: 10, fill: '#6b7280' }}
                            stroke="#e5e7eb"
                          />
                          <YAxis 
                            tick={{ fontSize: 10, fill: '#6b7280' }}
                            stroke="#e5e7eb"
                            tickFormatter={(value) => `₩${(value / 1000000).toFixed(1)}M`}
                          />
                          <Area
                            type="monotone"
                            dataKey="amount"
                            stroke="#3b82f6"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#colorAmount)"
                            animationDuration={isAnimated ? 1500 : 0}
                            animationBegin={0}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  
                  {/* (C) 우측 패널 - 최근 도착 물품 */}
                  <div className="col-span-12 md:col-span-4 bg-white rounded-lg border border-gray-200 p-3 md:p-4 shadow-sm hover:shadow-md transition-shadow">
                    <div className="text-xs md:text-sm text-gray-700 font-medium mb-3">최근 도착 물품</div>
                    <div className="space-y-2">
                      <div className="flex items-start gap-2 p-2 bg-green-50 rounded border border-green-200">
                        <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 flex-shrink-0"></div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-gray-900">DMEM Media (500ml)</div>
                          <div className="text-[10px] text-gray-500 mt-0.5">10분 전</div>
                        </div>
                        <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded">도착</span>
                      </div>
                      <div className="flex items-start gap-2 p-2 bg-blue-50 rounded border border-blue-200">
                        <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0 animate-pulse"></div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-gray-900">Trypsin-EDTA</div>
                          <div className="text-[10px] text-gray-500 mt-0.5">도착 예정</div>
                        </div>
                        <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">배송중</span>
                      </div>
                      <div className="flex items-start gap-2 p-2 bg-gray-50 rounded border border-gray-200">
                        <div className="w-2 h-2 rounded-full bg-gray-400 mt-1.5 flex-shrink-0"></div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-gray-900">PBS Buffer (1L)</div>
                          <div className="text-[10px] text-gray-500 mt-0.5">1시간 전</div>
                        </div>
                        <span className="text-[10px] bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">도착</span>
                      </div>
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

