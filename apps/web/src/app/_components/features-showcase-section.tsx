"use client";

import Link from "next/link";
import { Search, GitCompare, ShoppingCart, FlaskConical, BarChart3, Languages, ArrowRight } from "lucide-react";

export function FeaturesShowcaseSection() {
  // Bento Grid: 메인 카드(세로형), 서브 카드들(2x2), 대시보드(와이드형)
  const mainFeature = {
    title: "검색/AI 분석",
    description: "GPT 기반 검색어 분석으로 관련 제품을 자동으로 찾아줍니다.",
    href: "/test/search",
    icon: Search,
    gradient: "bg-gradient-to-br from-blue-500 to-indigo-600",
    linkColor: "text-blue-600 hover:text-blue-700",
  };

  const subFeatures = [
    {
      title: "제품 비교",
      description: "여러 제품을 한 번에 비교하고 최적의 선택을 도와줍니다.",
      href: "/compare",
      icon: GitCompare,
      gradient: "bg-gradient-to-br from-emerald-400 to-teal-600",
      linkColor: "text-emerald-600 hover:text-emerald-700",
    },
    {
      title: "견적 요청 리스트",
      description: "선택한 제품을 견적 요청 리스트로 정리하고, TSV/엑셀·공유 링크로 전달합니다.",
      href: "/test/quote",
      icon: ShoppingCart,
      gradient: "bg-gradient-to-br from-violet-500 to-fuchsia-600",
      linkColor: "text-violet-600 hover:text-violet-700",
    },
    {
      title: "프로토콜 분석",
      description: "실험 프로토콜 텍스트에서 필요한 시약을 자동으로 추출합니다.",
      href: "/protocol/bom",
      icon: FlaskConical,
      gradient: "bg-gradient-to-br from-purple-500 to-pink-600",
      linkColor: "text-purple-600 hover:text-purple-700",
    },
    {
      title: "자동 번역 & 요약",
      description: "영문 데이터시트와 제품 설명을 한글로 번역하고 핵심 정보를 요약합니다.",
      href: "/search",
      icon: Languages,
      gradient: "bg-gradient-to-br from-amber-500 to-orange-600",
      linkColor: "text-amber-600 hover:text-amber-700",
    },
  ];

  const dashboardFeature = {
    title: "대시보드",
    description: "구매 내역, 예산, 인벤토리를 한눈에 관리합니다.",
    href: "/dashboard",
    icon: BarChart3,
    gradient: "bg-gradient-to-br from-slate-600 to-slate-800",
    linkColor: "text-slate-600 hover:text-slate-700",
  };

  // 카드 컴포넌트 렌더링 함수
  const renderCard = (feature: typeof mainFeature, className: string = "") => {
    const Icon = feature.icon;
    return (
      <Link 
        href={feature.href}
        className={`group ${className}`}
      >
        <div className="bg-white border border-gray-200 rounded-xl p-8 flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 hover:shadow-xl cursor-pointer">
          {/* 아이콘 */}
          <div className="mb-6">
            <div className={`w-16 h-16 ${feature.gradient} rounded-2xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-105`}>
              <Icon className="h-8 w-8 text-white" strokeWidth={2.5} />
            </div>
          </div>

          {/* 텍스트 */}
          <div className="flex-1 flex flex-col justify-between">
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-gray-800 transition-colors">
                {feature.title}
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed mb-4">
                {feature.description}
              </p>
            </div>
            
            {/* 액션 버튼 */}
            <div className={`inline-flex items-center gap-2 ${feature.linkColor} font-medium group-hover:gap-3 transition-all`}>
              <span>Explore</span>
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>
      </Link>
    );
  };

  return (
    <section id="features-showcase" className="py-24 border-b border-slate-200 bg-gradient-to-b from-white to-slate-50/50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center space-y-2 mb-12">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900">주요 기능</h2>
          <p className="text-sm md:text-base text-gray-500 max-w-2xl mx-auto">
            각 기능을 클릭하여 바로 시작하세요
          </p>
        </div>
        
        {/* Bento Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* (A) 메인 카드 - 세로형 */}
          <div className="md:col-span-1 md:row-span-2">
            {renderCard(mainFeature)}
          </div>

          {/* (B) 서브 카드들 - 2x2 그리드 */}
          <div className="md:col-span-2 grid grid-cols-2 gap-6">
            {subFeatures.map((feature) => (
              <div key={feature.href} className="aspect-[4/3]">
                {renderCard(feature)}
              </div>
            ))}
          </div>

          {/* (C) 대시보드 카드 - 와이드형 */}
          <div className="md:col-span-3 aspect-[21/9]">
            {renderCard(dashboardFeature)}
          </div>
        </div>
      </div>
    </section>
  );
}
