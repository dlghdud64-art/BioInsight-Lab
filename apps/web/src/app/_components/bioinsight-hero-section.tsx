"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2 } from "lucide-react";

export function BioInsightHeroSection() {
  return (
    <section className="relative w-full pt-20 pb-32 overflow-hidden bg-slate-50 border-b border-slate-200">
      
      {/* 배경 데코레이션 */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[600px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-100/40 via-transparent to-transparent pointer-events-none" />

      <div className="container px-4 md:px-6 mx-auto relative z-10">
        
        {/* 1. 텍스트 및 CTA 영역 */}
        <div className="max-w-4xl mx-auto text-center space-y-8 mb-16">
          <div className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-sm font-medium text-blue-800 mb-2">
            <span className="flex h-2 w-2 rounded-full bg-blue-600 mr-2"></span>
            New: AI 재고 예측 업데이트
          </div>
          
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl xl:text-6xl leading-[1.1]">
            연구실 재고 관리의 <br className="hidden sm:block" />
            <span className="text-blue-600">새로운 기준을 경험하세요</span>
          </h1>
          
          <p className="text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
            복잡한 엑셀과 수기 기록은 이제 그만. <br />
            시약, 장비, 소모품까지 모든 자산을 가장 스마트하게 관리해줍니다.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <Button asChild size="lg" className="h-12 px-8 bg-blue-600 hover:bg-blue-700 text-base font-bold shadow-lg shadow-blue-900/20 transition-all hover:-translate-y-0.5">
              <Link href="/auth/signin">
                무료로 시작하기
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 px-8 border-2 border-slate-300 text-base font-bold hover:bg-slate-100 transition-all hover:-translate-y-0.5">
              <Link href="/pricing">
                도입 문의하기
              </Link>
            </Button>
          </div>

          {/* 신뢰도 요소 */}
          <div className="flex flex-wrap items-center justify-center gap-6 pt-4 text-sm text-slate-600">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span>1,200+ 연구실 사용 중</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span>평균 30% 비용 절감</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span>2주 무료 체험</span>
            </div>
          </div>
        </div>

        {/* 2. 대시보드 이미지 영역 (브라우저 목업) */}
        <div className="max-w-7xl mx-auto">
          <div className="relative rounded-xl shadow-2xl border border-slate-200 overflow-hidden bg-white">
            {/* 브라우저 윈도우 헤더 */}
            <div className="h-12 bg-slate-100 border-b border-slate-200 flex items-center px-4 gap-2">
              {/* 트래픽 라이트 */}
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                <div className="w-3 h-3 rounded-full bg-green-400"></div>
              </div>
              {/* 주소 바 */}
              <div className="flex-1 max-w-md mx-auto bg-white rounded-md px-4 py-1.5 text-xs text-slate-500 border border-slate-300">
                dashboard.bioinsight.com
              </div>
            </div>
            
            {/* 대시보드 콘텐츠 영역 */}
            <div className="aspect-video bg-gradient-to-br from-slate-50 to-white p-8 flex items-center justify-center">
              <div className="w-full h-full bg-white rounded-lg border border-slate-200 shadow-sm p-6">
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                    <div className="text-xs text-blue-600 font-medium mb-1">전체 재고</div>
                    <div className="text-2xl font-bold text-slate-900">1,240</div>
                  </div>
                  <div className="bg-red-50 rounded-lg p-4 border border-red-100">
                    <div className="text-xs text-red-600 font-medium mb-1">재고 부족</div>
                    <div className="text-2xl font-bold text-red-600">3 품목</div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4 border border-green-100">
                    <div className="text-xs text-green-600 font-medium mb-1">배송 중</div>
                    <div className="text-2xl font-bold text-slate-900">5 건</div>
                  </div>
                </div>
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <div className="text-sm font-semibold text-slate-900 mb-3">최근 시약 사용 이력</div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-600 py-2 border-b border-slate-200">
                      <span>김연구원 • Ethanol 99.5%</span>
                      <span>50ml 사용 • 10분 전</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-600 py-2 border-b border-slate-200">
                      <span>박박사 • FBS (Gibco)</span>
                      <span>1 bottle • 1시간 전</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-600 py-2">
                      <span>이조교 • Tips (1000uL)</span>
                      <span>2 rack • 3시간 전</span>
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

