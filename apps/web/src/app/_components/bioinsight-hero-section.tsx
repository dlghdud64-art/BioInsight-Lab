"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Package, AlertTriangle, FlaskConical, Minus, Plus, ShoppingCart } from "lucide-react";

export function BioInsightHeroSection() {
  // 실시간 시약 사용 기록 데이터
  const usageLogs = [
    { time: "10:30", researcher: "김연구원", item: "Ethanol (99.5%)", amount: "50ml", avatar: "김" },
    { time: "09:15", researcher: "박박사", item: "FBS (Media)", amount: "1 bottle", avatar: "박" },
    { time: "09:00", researcher: "이조교", item: "Tips (1000uL)", amount: "1 rack", avatar: "이" },
  ];

  // 도넛 차트 데이터
  const donutData = [
    { label: "시약", value: 60, color: "#3b82f6" }, // Blue
    { label: "소모품", value: 30, color: "#06b6d4" }, // Cyan
    { label: "기자재", value: 10, color: "#6366f1" }, // Indigo
  ];

  // SVG 도넛 차트 생성 함수
  const renderDonutChart = () => {
    const size = 120;
    const radius = 50;
    const strokeWidth = 12;
    const center = size / 2;
    let currentOffset = 0;

    return (
      <svg width={size} height={size} className="transform -rotate-90">
        {donutData.map((segment, index) => {
          const circumference = 2 * Math.PI * radius;
          const strokeDasharray = (circumference * segment.value) / 100;
          const strokeDashoffset = currentOffset;
          currentOffset -= strokeDasharray;

          return (
            <circle
              key={index}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDasharray}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-500"
            />
          );
        })}
      </svg>
    );
  };

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

          {/* 대시보드 Window - Modern Window 스타일 */}
          <div className="relative z-10 w-full max-w-5xl">
            {/* Window Shell */}
            <div className="relative bg-white rounded-xl overflow-hidden shadow-2xl border border-gray-200">
              {/* Header Bar */}
              <div className="h-10 border-b bg-gray-50/50 backdrop-blur flex items-center gap-2 px-4">
                {/* 미니멀한 회색 점 컨트롤 */}
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
                  <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
                  <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
                </div>
              </div>
              {/* 실제 대시보드 목업 콘텐츠 */}
              <div className="w-full h-[400px] md:h-[500px] lg:h-[600px] bg-gradient-to-br from-gray-50 to-white p-4 md:p-6">
                <div className="h-full grid grid-cols-12 grid-rows-6 gap-3 md:gap-4">
                  {/* (A) 좌측 - 재고 현황 시각화 (도넛 차트) */}
                  <div className="col-span-12 md:col-span-5 bg-white rounded-lg border border-gray-200 p-4 md:p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="text-xs md:text-sm text-gray-700 font-medium mb-4">재고 현황</div>
                    <div className="flex items-center justify-center h-[calc(100%-2rem)]">
                      <div className="relative">
                        {/* 도넛 차트 */}
                        <div className="flex items-center justify-center">
                          {renderDonutChart()}
                        </div>
                        {/* 중앙 텍스트 */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <div className="text-2xl md:text-3xl font-bold text-gray-900">1,240</div>
                          <div className="text-xs text-gray-500 mt-1">전체 시약</div>
                        </div>
                      </div>
                    </div>
                    {/* 범례 */}
                    <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t border-gray-100">
                      {donutData.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                          <span className="text-xs text-gray-600">{item.label}</span>
                          <span className="text-xs font-semibold text-gray-900">{item.value}%</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* (B) 우측 상단 - 긴급 알림 카드 */}
                  <div className="col-span-12 md:col-span-7 bg-red-50 border border-red-100 rounded-lg p-4 md:p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">🚨</span>
                        <div>
                          <div className="text-sm md:text-base font-semibold text-red-700">에탄올 재고 부족</div>
                          <div className="text-xs text-red-600 mt-0.5">2개 남음</div>
                        </div>
                      </div>
                      <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
                    </div>
                    <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white text-xs font-medium">
                      <ShoppingCart className="h-3 w-3 mr-1.5" />
                      주문하기
                    </Button>
                  </div>

                  {/* (C) 우측 하단 - 최근 활동 타임라인 */}
                  <div className="col-span-12 md:col-span-7 bg-white rounded-lg border border-gray-200 p-4 md:p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="text-xs md:text-sm text-gray-700 font-medium mb-4">최근 활동</div>
                    <div className="space-y-3">
                      {usageLogs.map((log, idx) => (
                        <div key={idx} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg transition-colors">
                          {/* 프로필 아바타 */}
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                            {log.avatar}
                          </div>
                          {/* 내용 */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-medium text-gray-900">{log.researcher}</span>
                              <span className="text-xs text-gray-400">•</span>
                              <span className="text-xs text-gray-500">{log.time}</span>
                            </div>
                            <div className="text-xs text-gray-700">{log.item}</div>
                          </div>
                          {/* 사용량 배지 */}
                          <Badge variant="secondary" className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 flex-shrink-0">
                            ➖ {log.amount}
                          </Badge>
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

