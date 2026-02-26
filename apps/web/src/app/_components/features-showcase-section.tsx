"use client";

import { useState, useRef, useEffect } from "react";
import { Search, ShoppingCart, BarChart3, Zap, FileText, TrendingUp, CheckCircle2, AlertTriangle, Package, ArrowRight, ChevronLeft, ChevronRight, Tag, Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
  
  // --- Mobile Carousel Logic ---
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      // 약간의 오차 범위(5px)를 두어 끝 감지
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 5);
    }
  };

  useEffect(() => {
    checkScroll();
    // 리사이즈 이벤트 리스너 추가
    const handleResize = () => {
      setTimeout(checkScroll, 100);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = scrollRef.current.clientWidth * 0.8; // 화면 너비의 80%만큼 이동
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
      // 스크롤 완료 후 상태 업데이트
      setTimeout(checkScroll, 300);
    }
  };
  // ---------------------------

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
      features: ["대시보드", "재고 관리"],
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
          <div className="w-full h-full bg-white rounded-xl shadow-md border border-gray-100 p-4 md:p-6 space-y-4 max-w-full overflow-hidden">
            {/* 검색 바 */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 bg-gray-50 rounded-lg p-3 sm:p-4 border border-gray-200">
              <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                <Search className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400 flex-shrink-0" />
                <input
                  type="text"
                  value="Sigma-Aldrich Acetone 500ml"
                  className="flex-1 bg-transparent outline-none text-xs sm:text-sm text-gray-900 font-medium truncate min-w-0"
                  readOnly
                />
              </div>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium flex-shrink-0 w-full sm:w-auto">
                검색
              </Button>
            </div>
            
            {/* 검색 결과 리스트 */}
            <div className="space-y-3">
              {/* 리스트 아이템 1: 추천 */}
              <div className="bg-white rounded-lg p-4 border border-gray-100 shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className="bg-green-500 text-white text-xs px-2 py-0.5">추천</Badge>
                      <span className="text-sm font-semibold text-gray-900">Sigma-Aldrich</span>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">순도 99.9%</p>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-base font-bold text-gray-900">₩45,000</span>
                      <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 text-[10px] px-1.5 py-0.5 inline-flex items-center gap-1">
                      <Tag className="h-2.5 w-2.5" />
                      최저가
                    </Badge>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-green-600 font-medium">
                      <Zap className="h-3 w-3" />
                      <span>익일 도착 보장</span>
                    </div>
                  </div>
                  <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                </div>
              </div>

              {/* 리스트 아이템 2: 대체 */}
              <div className="bg-white rounded-lg p-4 border border-gray-100 shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className="bg-blue-500 text-white text-xs px-2 py-0.5">대체</Badge>
                      <span className="text-sm font-semibold text-gray-900">TCI Chemicals</span>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">순도 99.5%</p>
                    <div className="flex items-center gap-3">
                      <span className="text-base font-bold text-gray-900">₩42,000</span>
                      <span className="text-xs text-gray-500">해외 배송 2주</span>
                    </div>
                  </div>
                  <Package className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                </div>
              </div>
            </div>
          </div>
        );

      case "purchasing":
        return (
          <div className="w-full h-full bg-white rounded-xl shadow-md border border-gray-100 p-6 space-y-4">
            {/* 견적 비교 테이블 */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              {/* 테이블 헤더 */}
              <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-3 bg-gray-50 px-4 py-3 border-b border-gray-200">
                <div className="text-xs font-semibold text-gray-900">품목명</div>
                <div className="text-xs font-semibold text-gray-900 text-center">벤더 A</div>
                <div className="text-xs font-semibold text-gray-900 text-center">벤더 B</div>
                <div className="text-xs font-semibold text-gray-900 text-center">선택</div>
              </div>

              {/* 테이블 행 */}
              <div className="divide-y divide-gray-100">
                <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                  <div>
                    <div className="text-sm font-medium text-gray-900">FBS (500ml)</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-semibold text-gray-900">₩150,000</div>
                  </div>
                  <div className="text-center">
                    <div className="flex flex-col items-center gap-1">
                      <div className="text-sm font-semibold text-blue-600">₩135,000</div>
                      <Badge className="bg-green-500 text-white text-[10px] px-1.5 py-0.5">Best</Badge>
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      <span className="text-xs text-green-600 ml-1">선택됨</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 하단 액션 버튼 */}
            <div className="pt-3 border-t border-gray-200">
              <Button className="w-full bg-green-600 hover:bg-green-700 text-white text-sm font-medium py-2.5">
                엑셀로 내려받기
              </Button>
            </div>
          </div>
        );

      case "management":
        return (
          <div className="w-full h-full bg-white rounded-2xl shadow-2xl border border-slate-100 p-8">
            {/* 알림 센터 제목 */}
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-slate-400 flex items-center gap-2">
              <Bell className="h-4 w-4 text-slate-500" />
              실시간 알림 센터
            </h3>
            </div>

            {/* 알림 센터 카드 */}
            <div className="bg-white rounded-xl overflow-hidden">
              {/* 알림 헤더 */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                    <h3 className="text-sm font-semibold text-gray-900">알림 센터</h3>
                    <Badge className="bg-red-500 text-white text-[10px] px-1.5 py-0.5">3</Badge>
                  </div>
                  <span className="text-xs text-gray-500">모두 읽기</span>
                </div>
              </div>

              {/* 알림 리스트 */}
              <div className="divide-y divide-gray-100">
                {/* 알림 1: 긴급 재고 부족 */}
                <div className="px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-1">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className="bg-red-100 text-red-700 text-[10px] px-1.5 py-0.5">긴급</Badge>
                        <span className="text-xs font-semibold text-gray-900">재고 부족 알림</span>
                      </div>
                      <p className="text-xs text-gray-700 leading-relaxed mb-1.5">
                        FBS (Fetal Bovine Serum) 수량이 1개 남았습니다. 자동 주문을 진행할까요?
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[10px] text-gray-500">10분 전</span>
                        <Button size="sm" className="h-6 text-[10px] px-2 bg-blue-600 hover:bg-blue-700 text-white">
                          주문하기
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 알림 2: 견적서 도착 */}
                <div className="px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-1">
                      <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5">견적</Badge>
                        <span className="text-xs font-semibold text-gray-900">요청하신 견적서 도착</span>
                      </div>
                      <p className="text-xs text-gray-700 leading-relaxed mb-1.5">
                        Thermo Fisher 외 2개 벤더의 견적서가 도착했습니다. 최저가를 확인하세요.
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[10px] text-gray-500">1시간 전</span>
                        <Button size="sm" className="h-6 text-[10px] px-2 bg-blue-600 hover:bg-blue-700 text-white">
                          확인하기
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 알림 3: 입고 완료 */}
                <div className="px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-1">
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className="bg-green-100 text-green-700 text-[10px] px-1.5 py-0.5">입고</Badge>
                        <span className="text-xs font-semibold text-gray-900">물품 수령 확인</span>
                      </div>
                      <p className="text-xs text-gray-700 leading-relaxed mb-1.5">
                        50ml Conical Tube (500/case) 입고 처리가 완료되었습니다.
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[10px] text-gray-500">어제</span>
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <section id="features-showcase" className="py-24 pb-32 border-b border-slate-200 bg-gradient-to-b from-white to-slate-50/50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center space-y-2 mb-12">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900">주요 기능</h2>
          <p className="text-sm md:text-base text-gray-500 max-w-2xl mx-auto">
            연구실 업무 흐름에 맞춘 3가지 핵심 가치
          </p>
        </div>

        {/* 모바일: 세로 스택, 데스크탑: 좌우 2분할 레이아웃 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 items-start">
          {/* 좌측: 탭 메뉴 (모바일에서는 숨김) */}
          <div className="hidden md:block space-y-4">
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

          {/* 모바일: 가로 스크롤 Carousel with Navigation */}
          <div className="md:hidden relative group">
            {/* Left Navigation Button */}
            <Button
              variant="outline"
              size="icon"
              className={`absolute left-2 top-1/2 -translate-y-1/2 z-10 rounded-full bg-white/80 shadow-sm backdrop-blur-sm transition-opacity hover:bg-white/90 ${
                !canScrollLeft ? 'opacity-0 pointer-events-none' : 'opacity-100'
              }`}
              onClick={() => scroll('left')}
              disabled={!canScrollLeft}
              aria-label="이전 카드"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {/* Scroll Container */}
            <div
              ref={scrollRef}
              onScroll={checkScroll}
              className="flex overflow-x-auto snap-x snap-mandatory gap-4 px-4 py-4 scrollbar-hide -mx-4"
            >
              {tabs.map((tab) => {
                const TabIcon = tab.icon;
                return (
                  <div
                    key={tab.id}
                    className="flex-shrink-0 min-w-[80vw] max-w-[300px] snap-center bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
                  >
                    <div className="p-4 space-y-3">
                      {/* 헤더 영역 (아이콘 + 제목) */}
                      <div className="flex items-center gap-2">
                        <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${tab.gradient}`}>
                          <TabIcon className="h-5 w-5 text-white" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 leading-tight">{tab.title}</h3>
                      </div>
                      
                      {/* 설명 글 */}
                      <p className="text-sm text-slate-600 break-keep leading-snug">
                        {tab.description}
                      </p>
                      
                      {/* 기능 태그 */}
                      <div className="flex flex-wrap gap-2">
                        {tab.features.map((feature) => (
                          <span
                            key={feature}
                            className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700"
                          >
                            {feature}
                          </span>
                        ))}
                      </div>
                    </div>
                    
                    {/* 이미지 영역 (높이 제한) */}
                    <div className="relative w-full h-32 bg-gray-100 border-t border-gray-200 max-w-full overflow-hidden">
                      <div className="w-full h-full p-2 overflow-auto">
                        {renderMockup(tab.id)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right Navigation Button */}
            <Button
              variant="outline"
              size="icon"
              className={`absolute right-2 top-1/2 -translate-y-1/2 z-10 rounded-full bg-white/80 shadow-sm backdrop-blur-sm transition-opacity hover:bg-white/90 ${
                !canScrollRight ? 'opacity-0 pointer-events-none' : 'opacity-100'
              }`}
              onClick={() => scroll('right')}
              disabled={!canScrollRight}
              aria-label="다음 카드"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* 데스크탑: 우측 이미지/목업 영역 */}
          <div className="hidden md:block lg:sticky lg:top-24">
            <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-gray-100 border border-gray-200 shadow-2xl max-w-full">
              {/* Fade-in 애니메이션을 위한 컨테이너 */}
              <div
                key={activeTab}
                className="absolute inset-0 animate-fadeIn max-w-full overflow-hidden"
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
