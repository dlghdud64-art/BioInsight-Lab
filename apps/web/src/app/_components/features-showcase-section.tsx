"use client";

import { useState } from "react";
import { Search, ShoppingCart, BarChart3, Zap, FileText, TrendingUp } from "lucide-react";

interface Tab {
  id: string;
  title: string;
  description: string;
  features: string[];
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
}

export function FeaturesShowcaseSection() {
  const [activeTab, setActiveTab] = useState("sourcing");

  const tabs: Tab[] = [
    {
      id: "sourcing",
      title: "AI 기반 초고속 소싱",
      description: "복잡한 시약 명칭, 프로토콜 분석부터 최저가 비교까지 AI가 대신 찾아줍니다.",
      features: ["검색", "비교", "번역", "프로토콜"],
      icon: Search,
      gradient: "bg-gradient-to-br from-blue-500 to-indigo-600",
    },
    {
      id: "purchasing",
      title: "간편한 견적 및 주문",
      description: "여러 벤더의 견적서를 한 번에 요청하고, 구매 품의용 엑셀 파일을 즉시 생성하세요.",
      features: ["견적 리스트", "공유"],
      icon: ShoppingCart,
      gradient: "bg-gradient-to-br from-violet-500 to-fuchsia-600",
    },
    {
      id: "management",
      title: "자동화된 연구실 관리",
      description: "물건이 도착하면 자동으로 인벤토리에 등록됩니다. 예산 현황도 실시간으로 확인하세요.",
      features: ["대시보드", "인벤토리"],
      icon: BarChart3,
      gradient: "bg-gradient-to-br from-emerald-500 to-teal-600",
    },
  ];

  const activeTabData = tabs.find((tab) => tab.id === activeTab) || tabs[0];
  const Icon = activeTabData.icon;

  // 목업 UI 생성 함수
  const renderMockup = (tabId: string) => {
    switch (tabId) {
      case "sourcing":
        return (
          <div className="w-full h-full bg-white rounded-xl shadow-2xl p-6 space-y-4">
            {/* 검색 바 */}
            <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-4 border border-gray-200">
              <Search className="h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="시약명 또는 카탈로그 번호 검색..."
                className="flex-1 bg-transparent outline-none text-sm"
                disabled
              />
              <div className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md">
                검색
              </div>
            </div>
            
            {/* 검색 결과 카드들 */}
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <div className="h-3 bg-gray-300 rounded mb-2 w-3/4"></div>
                  <div className="h-2 bg-gray-200 rounded mb-1 w-1/2"></div>
                  <div className="h-2 bg-blue-200 rounded w-1/4 mt-2"></div>
                </div>
              ))}
            </div>

            {/* AI 분석 카드 */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-4 w-4 text-blue-600" />
                <div className="h-3 bg-blue-300 rounded w-24"></div>
              </div>
              <div className="h-2 bg-blue-200 rounded mb-1 w-full"></div>
              <div className="h-2 bg-blue-200 rounded w-3/4"></div>
            </div>
          </div>
        );

      case "purchasing":
        return (
          <div className="w-full h-full bg-white rounded-xl shadow-2xl p-6 space-y-4">
            {/* 헤더 */}
            <div className="flex items-center justify-between">
              <div className="h-6 bg-gray-300 rounded w-32"></div>
              <div className="h-8 w-24 bg-violet-600 rounded-lg"></div>
            </div>

            {/* 견적 리스트 테이블 */}
            <div className="space-y-2">
              <div className="grid grid-cols-4 gap-2 pb-2 border-b">
                <div className="h-3 bg-gray-300 rounded w-16"></div>
                <div className="h-3 bg-gray-300 rounded w-20"></div>
                <div className="h-3 bg-gray-300 rounded w-16"></div>
                <div className="h-3 bg-gray-300 rounded w-12"></div>
              </div>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="grid grid-cols-4 gap-2 py-2 border-b border-gray-100">
                  <div className="h-4 bg-gray-200 rounded w-full"></div>
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-4 bg-violet-200 rounded w-1/2"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                </div>
              ))}
            </div>

            {/* 액션 버튼들 */}
            <div className="flex gap-2 pt-2">
              <div className="flex-1 h-10 bg-gray-100 rounded-lg"></div>
              <div className="flex-1 h-10 bg-violet-600 rounded-lg"></div>
            </div>
          </div>
        );

      case "management":
        return (
          <div className="w-full h-full bg-white rounded-xl shadow-2xl p-6 space-y-4">
            {/* KPI 카드들 */}
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-lg p-4 border border-emerald-200">
                  <div className="h-3 bg-emerald-300 rounded mb-2 w-2/3"></div>
                  <div className="h-6 bg-emerald-400 rounded w-1/2 mt-2"></div>
                </div>
              ))}
            </div>

            {/* 차트 영역 */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="h-4 bg-gray-300 rounded mb-3 w-24"></div>
              <div className="h-32 bg-gradient-to-t from-emerald-200 via-teal-200 to-emerald-100 rounded"></div>
            </div>

            {/* 인벤토리 리스트 */}
            <div className="space-y-2">
              <div className="h-4 bg-gray-300 rounded w-32 mb-2"></div>
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <div className="h-10 w-10 bg-emerald-200 rounded"></div>
                  <div className="flex-1">
                    <div className="h-3 bg-gray-300 rounded mb-1 w-2/3"></div>
                    <div className="h-2 bg-gray-200 rounded w-1/2"></div>
                  </div>
                  <div className="h-6 w-16 bg-emerald-600 rounded"></div>
                </div>
              ))}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <section id="features-showcase" className="py-24 border-b border-slate-200 bg-gradient-to-b from-white to-slate-50/50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center space-y-2 mb-12">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900">주요 기능</h2>
          <p className="text-sm md:text-base text-gray-500 max-w-2xl mx-auto">
            연구실 업무 흐름에 맞춘 3가지 핵심 가치
          </p>
        </div>

        {/* 좌우 2분할 레이아웃 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-start">
          {/* 좌측: 탭 메뉴 */}
          <div className="space-y-4">
            {tabs.map((tab) => {
              const TabIcon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full text-left p-6 rounded-xl transition-all duration-300 ${
                    isActive
                      ? "bg-blue-50 border-l-4 border-blue-600 shadow-md"
                      : "bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {/* 아이콘 */}
                    <div
                      className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 ${
                        isActive ? tab.gradient : "bg-gray-100"
                      }`}
                    >
                      <TabIcon
                        className={`h-6 w-6 transition-colors ${
                          isActive ? "text-white" : "text-gray-600"
                        }`}
                      />
                    </div>

                    {/* 텍스트 */}
                    <div className="flex-1 min-w-0">
                      <h3
                        className={`text-lg md:text-xl font-bold mb-2 transition-colors ${
                          isActive ? "text-blue-900" : "text-gray-900"
                        }`}
                      >
                        {tab.title}
                      </h3>
                      <p
                        className={`text-sm md:text-base mb-3 transition-colors ${
                          isActive ? "text-blue-700" : "text-gray-600"
                        }`}
                      >
                        {tab.description}
                      </p>

                      {/* 포함 기능 태그들 */}
                      <div className="flex flex-wrap gap-2">
                        {tab.features.map((feature) => (
                          <span
                            key={feature}
                            className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                              isActive
                                ? "bg-blue-100 text-blue-700"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {feature}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* 우측: 이미지/목업 영역 */}
          <div className="lg:sticky lg:top-24">
            <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-gray-100 border border-gray-200 shadow-2xl">
              {/* Fade-in 애니메이션을 위한 컨테이너 */}
              <div
                key={activeTab}
                className="absolute inset-0 animate-fadeIn"
              >
                {renderMockup(activeTab)}
              </div>
            </div>

            {/* 하단 설명 */}
            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-start gap-3">
                <div className={`flex-shrink-0 w-10 h-10 ${activeTabData.gradient} rounded-lg flex items-center justify-center`}>
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-blue-900 mb-1">
                    {activeTabData.title}
                  </p>
                  <p className="text-xs text-blue-700">
                    {activeTabData.description}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
