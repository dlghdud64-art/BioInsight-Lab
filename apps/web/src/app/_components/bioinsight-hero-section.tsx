"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, FileSpreadsheet, LayoutDashboard, Sparkles } from "lucide-react";
import { useState, useEffect } from "react";

export function BioInsightHeroSection() {
  const [isAnimated, setIsAnimated] = useState(false);

  useEffect(() => {
    setIsAnimated(true);
  }, []);

  return (
    <section className="relative border-b border-slate-200 bg-gradient-to-b from-white via-blue-50/30 to-white pt-28 pb-8 md:pt-32 md:pb-12 lg:pt-36 lg:pb-16 overflow-hidden">
      {/* 배경 장식 요소 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-10 w-72 h-72 bg-blue-100/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 left-10 w-96 h-96 bg-indigo-100/20 rounded-full blur-3xl"></div>
      </div>

      <div className="relative mx-auto max-w-7xl px-4 md:px-6">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-center lg:gap-12">
          {/* 왼쪽: 텍스트 콘텐츠 */}
          <div className="space-y-6 md:space-y-8 text-center lg:text-left">
            <div className="space-y-4 md:space-y-6">
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold leading-tight tracking-tight text-slate-900">
                구매가 곧 관리가 됩니다.
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                  (Buying is Managing)
                </span>
              </h1>
              <p className="text-base md:text-lg leading-relaxed text-slate-700 max-w-2xl mx-auto lg:mx-0">
                주문 내역 기반 자동 인벤토리 등록부터, AI 재구매 예측까지.
                <br />
                <span className="font-semibold text-slate-900">연구에만 집중하세요.</span>
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
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
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 md:gap-6 pt-2 text-sm text-slate-600">
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

          {/* 오른쪽: 엑셀→대시보드 변환 애니메이션 */}
          <div className="relative w-full h-[400px] md:h-[500px] lg:h-[600px] flex items-center justify-center">
            <div className="relative w-full max-w-lg">
              {/* 엑셀 파일 */}
              <div
                className={`absolute inset-0 transition-all duration-1000 ${
                  isAnimated ? "opacity-0 translate-x-[-20px] scale-95" : "opacity-100 translate-x-0 scale-100"
                }`}
              >
                <div className="bg-white rounded-lg shadow-2xl border-2 border-slate-200 p-6 transform">
                  <div className="flex items-center gap-3 mb-4">
                    <FileSpreadsheet className="h-8 w-8 text-green-600" />
                    <div>
                      <div className="font-semibold text-slate-900">재고관리.xlsx</div>
                      <div className="text-xs text-slate-500">마지막 수정: 2시간 전</div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="grid grid-cols-4 gap-2 text-xs">
                      <div className="font-semibold bg-slate-100 p-2 rounded">제품명</div>
                      <div className="font-semibold bg-slate-100 p-2 rounded">수량</div>
                      <div className="font-semibold bg-slate-100 p-2 rounded">위치</div>
                      <div className="font-semibold bg-slate-100 p-2 rounded">비고</div>
                    </div>
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="grid grid-cols-4 gap-2 text-xs">
                        <div className="p-2 border border-slate-200 rounded">항체 A-{i}</div>
                        <div className="p-2 border border-slate-200 rounded">10</div>
                        <div className="p-2 border border-slate-200 rounded">냉장고</div>
                        <div className="p-2 border border-slate-200 rounded">...</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 화살표 */}
              <div
                className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 transition-all duration-1000 delay-500 ${
                  isAnimated ? "opacity-100 scale-100" : "opacity-0 scale-0"
                }`}
              >
                <ArrowRight className="h-12 w-12 text-blue-600" />
              </div>

              {/* 대시보드 */}
              <div
                className={`absolute inset-0 transition-all duration-1000 delay-700 ${
                  isAnimated ? "opacity-100 translate-x-0 scale-100" : "opacity-0 translate-x-[20px] scale-95"
                }`}
              >
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg shadow-2xl border-2 border-blue-200 p-6 transform">
                  <div className="flex items-center gap-3 mb-4">
                    <LayoutDashboard className="h-8 w-8 text-blue-600" />
                    <div>
                      <div className="font-semibold text-slate-900">스마트 인벤토리</div>
                      <div className="text-xs text-slate-500 flex items-center gap-1">
                        <Sparkles className="h-3 w-3" />
                        자동 업데이트
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="bg-white rounded-lg p-4 shadow-sm">
                      <div className="text-xs text-slate-500 mb-2">현재 재고</div>
                      <div className="text-2xl font-bold text-blue-600">45개 품목</div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white rounded-lg p-3 shadow-sm">
                        <div className="text-xs text-slate-500 mb-1">재구매 추천</div>
                        <div className="text-lg font-semibold text-emerald-600">3개</div>
                      </div>
                      <div className="bg-white rounded-lg p-3 shadow-sm">
                        <div className="text-xs text-slate-500 mb-1">팀 공유</div>
                        <div className="text-lg font-semibold text-indigo-600">12개</div>
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

