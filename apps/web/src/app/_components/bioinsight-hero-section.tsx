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
            <div className="bg-slate-800 rounded-t-lg px-4 py-2 flex items-center gap-2">
              <div className="flex gap-1.5 px-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
              </div>
              <div className="flex-1 bg-slate-700 rounded px-3 py-1 text-xs text-slate-300 text-center">
                dashboard.bioinsight.com
              </div>
            </div>

            {/* 대시보드 이미지 영역 */}
            <div className="relative bg-slate-900 rounded-b-lg overflow-hidden shadow-2xl transform perspective-1000" style={{ transform: 'perspective(1000px) rotateX(2deg)' }}>
              {/* Placeholder 또는 실제 대시보드 이미지 */}
              <div className="w-full h-[400px] md:h-[500px] lg:h-[600px] bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 flex items-center justify-center relative">
                {/* 대시보드 목업 콘텐츠 */}
                <div className="absolute inset-4 grid grid-cols-12 grid-rows-6 gap-3">
                  {/* 상단 KPI 카드들 */}
                  <div className="col-span-12 md:col-span-3 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 p-4">
                    <div className="text-xs text-slate-400 mb-1">재고 부족 알림</div>
                    <div className="text-2xl font-bold text-white">3개</div>
                  </div>
                  <div className="col-span-12 md:col-span-3 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 p-4">
                    <div className="text-xs text-slate-400 mb-1">진행 중인 견적</div>
                    <div className="text-2xl font-bold text-white">5건</div>
                  </div>
                  <div className="col-span-12 md:col-span-3 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 p-4">
                    <div className="text-xs text-slate-400 mb-1">배송 중인 물품</div>
                    <div className="text-2xl font-bold text-white">2개</div>
                  </div>
                  <div className="col-span-12 md:col-span-3 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 p-4">
                    <div className="text-xs text-slate-400 mb-1">이번 달 지출</div>
                    <div className="text-2xl font-bold text-white">₩3.2M</div>
                  </div>
                  
                  {/* 차트 영역 */}
                  <div className="col-span-12 md:col-span-8 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 p-4">
                    <div className="text-xs text-slate-400 mb-2">지출 추이</div>
                    <div className="h-full flex items-end gap-2">
                      {[60, 80, 45, 90, 70, 85].map((height, i) => (
                        <div
                          key={i}
                          className="flex-1 bg-blue-500 rounded-t"
                          style={{ height: `${height}%` }}
                        ></div>
                      ))}
                    </div>
                  </div>
                  
                  {/* 재구매 추천 리스트 */}
                  <div className="col-span-12 md:col-span-4 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 p-4">
                    <div className="text-xs text-slate-400 mb-2">재구매 추천</div>
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="bg-white/5 rounded p-2">
                          <div className="text-xs text-white">항체 A-{i}</div>
                          <div className="text-[10px] text-slate-400">재고 부족</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                
                {/* 중앙 텍스트 (이미지가 없을 때) */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center">
                    <div className="text-white/20 text-sm font-semibold mb-2">Dashboard Screenshot Area</div>
                    <div className="text-white/10 text-xs">대시보드 이미지가 여기에 표시됩니다</div>
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

