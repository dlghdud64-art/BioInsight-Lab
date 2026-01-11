"use client";

import Link from "next/link";
import { Search, GitCompare, ShoppingCart, FlaskConical, BarChart3, Languages, ArrowRight } from "lucide-react";

export function FeaturesShowcaseSection() {
  // Bento Grid: 큰 박스(2x2), 작은 박스(1x1) 조합
  const features = [
    {
      title: "검색/AI 분석",
      description: "GPT 기반 검색어 분석으로 관련 제품을 자동으로 찾아줍니다.",
      href: "/test/search",
      icon: Search,
      gradient: "bg-gradient-to-br from-blue-500 to-indigo-600",
      linkColor: "text-blue-600 hover:text-blue-700",
      size: "large", // 2x2
    },
    {
      title: "제품 비교",
      description: "여러 제품을 한 번에 비교하고 최적의 선택을 도와줍니다.",
      href: "/compare",
      icon: GitCompare,
      gradient: "bg-gradient-to-br from-emerald-400 to-teal-600",
      linkColor: "text-emerald-600 hover:text-emerald-700",
      size: "small", // 1x1
    },
    {
      title: "견적 요청 리스트 & 내보내기",
      description: "선택한 제품을 견적 요청 리스트로 정리하고, TSV/엑셀·공유 링크로 전달합니다.",
      href: "/test/quote",
      icon: ShoppingCart,
      gradient: "bg-gradient-to-br from-violet-500 to-fuchsia-600",
      linkColor: "text-violet-600 hover:text-violet-700",
      size: "small", // 1x1
    },
    {
      title: "프로토콜 분석",
      description: "실험 프로토콜 텍스트에서 필요한 시약을 자동으로 추출합니다.",
      href: "/protocol/bom",
      icon: FlaskConical,
      gradient: "bg-gradient-to-br from-purple-500 to-pink-600",
      linkColor: "text-purple-600 hover:text-purple-700",
      size: "small", // 1x1
    },
    {
      title: "자동 번역 & 요약",
      description: "영문 데이터시트와 제품 설명을 한글로 번역하고 핵심 정보를 요약해 해외 벤더 제품 비교를 쉽게 합니다.",
      href: "/search",
      icon: Languages,
      gradient: "bg-gradient-to-br from-amber-500 to-orange-600",
      linkColor: "text-amber-600 hover:text-amber-700",
      size: "small", // 1x1
    },
    {
      title: "대시보드",
      description: "구매 내역, 예산, 인벤토리를 한눈에 관리합니다.",
      href: "/dashboard",
      icon: BarChart3,
      gradient: "bg-gradient-to-br from-slate-600 to-slate-800",
      linkColor: "text-slate-600 hover:text-slate-700",
      size: "large", // 2x2
    },
  ];

  return (
    <section id="features-showcase" className="py-6 md:py-10 border-b border-slate-200 bg-gradient-to-b from-white to-slate-50/50">
      <div className="mx-auto max-w-7xl px-3 md:px-6">
        <div className="text-center space-y-1 mb-6 md:mb-8">
          <h2 className="text-xl md:text-2xl lg:text-3xl font-bold tracking-tight text-gray-900">주요 기능</h2>
          <p className="text-xs md:text-sm text-gray-500 max-w-2xl mx-auto">
            각 기능을 클릭하여 바로 시작하세요
          </p>
        </div>
        
        {/* Bento Grid Layout */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 auto-rows-fr">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            const isLarge = feature.size === "large";
            const colSpan = isLarge ? "md:col-span-2" : "md:col-span-1";
            const rowSpan = isLarge ? "md:row-span-2" : "md:row-span-1";
            
            return (
              <Link 
                key={feature.href} 
                href={feature.href}
                className={`group ${colSpan} ${rowSpan}`}
              >
                <div className="bg-white border border-gray-100 rounded-xl p-4 md:p-6 h-full flex flex-col transition-all duration-300 hover:-translate-y-1 hover:shadow-xl cursor-pointer">
                  {/* 아이콘 컨테이너 */}
                  <div className={`mb-3 ${isLarge ? "md:mb-6" : ""}`}>
                    <div className={`w-10 h-10 md:w-12 md:h-12 ${isLarge ? "lg:w-16 lg:h-16" : ""} ${feature.gradient} rounded-xl md:rounded-2xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-105`}>
                      <Icon className={`h-5 w-5 md:h-6 md:w-6 ${isLarge ? "lg:h-8 lg:w-8" : ""} text-white`} strokeWidth={2.5} />
                    </div>
                  </div>

                  {/* 카드 본체 */}
                  <div className="flex-1 flex flex-col">
                    <h3 className={`font-bold text-gray-900 mb-1.5 md:mb-2 group-hover:text-gray-800 transition-colors ${
                      isLarge ? "text-base md:text-xl lg:text-2xl" : "text-sm md:text-base"
                    }`}>
                      {feature.title}
                    </h3>
                    <p className={`text-gray-500 leading-relaxed mb-3 md:mb-4 flex-1 ${
                      isLarge ? "text-xs md:text-sm lg:text-base" : "text-xs md:text-sm"
                    }`}>
                      {feature.description}
                    </p>
                    
                    {/* 텍스트 링크 액션 */}
                    <div className={`inline-flex items-center gap-1.5 ${feature.linkColor} font-medium ${
                      isLarge ? "text-sm md:text-base" : "text-xs md:text-sm"
                    } group-hover:gap-2 transition-all`}>
                      <span>Explore</span>
                      <ArrowRight className={`h-3 w-3 md:h-4 md:w-4 group-hover:translate-x-0.5 transition-transform`} />
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
