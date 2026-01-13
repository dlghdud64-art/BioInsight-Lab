"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";

export function BioInsightHeroSection() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const popularSearches = ["FBS", "Pipette", "Conical Tube", "Centrifuge", "DMEM", "Trypsin"];

  return (
    <section className="relative w-full pt-20 pb-32 overflow-hidden bg-white border-b border-slate-200">
      
      {/* 배경 데코레이션 */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[600px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-100/30 via-transparent to-transparent pointer-events-none" />

      <div className="container px-4 md:px-6 mx-auto relative z-10">
        
        {/* 1. 메인 카피 */}
        <div className="max-w-4xl mx-auto text-center space-y-6 mb-12">
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl xl:text-6xl leading-[1.1]">
            전 세계 500만 개 시약/장비, <br className="hidden sm:block" />
            <span className="text-blue-600">최저가 검색부터 견적까지</span>
          </h1>
          
          <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
            더 이상 구글링하지 마세요. <br />
            BioInsight AI가 스펙 비교부터 최적 견적까지 한 번에 찾아드립니다.
          </p>
        </div>

        {/* 2. 중앙 대형 검색창 (구글 스타일) */}
        <div className="max-w-3xl mx-auto mb-8">
          <form onSubmit={handleSearch} className="relative">
            <div className="flex items-center gap-2 bg-white rounded-full border-2 border-slate-300 shadow-lg hover:shadow-xl transition-shadow focus-within:border-blue-500 focus-within:shadow-blue-500/20">
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="찾으시는 시약명, CAS Number, 제조사를 입력해보세요 (예: FBS, Anti-IL6)"
                className="flex-1 h-14 px-6 text-base md:text-lg border-0 rounded-full focus-visible:ring-0 focus-visible:ring-offset-0"
              />
              <Button
                type="submit"
                size="lg"
                className="h-14 px-8 bg-blue-600 hover:bg-blue-700 text-white rounded-full mr-1 my-1 font-semibold"
              >
                <Search className="h-5 w-5 mr-2" />
                검색
              </Button>
            </div>
          </form>

          {/* 인기 검색어 태그 */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
            <span className="text-sm text-slate-500 mr-2">인기 검색어:</span>
            {popularSearches.map((term) => (
              <Badge
                key={term}
                variant="secondary"
                className="cursor-pointer hover:bg-blue-100 hover:text-blue-700 transition-colors px-3 py-1 text-sm font-normal"
                onClick={() => {
                  setSearchQuery(term);
                  router.push(`/search?q=${encodeURIComponent(term)}`);
                }}
              >
                #{term}
              </Badge>
            ))}
          </div>
        </div>

        {/* 3. 검색 결과 화면 미리보기 (브라우저 목업) */}
        <div className="max-w-7xl mx-auto mt-16">
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
                search.bioinsight.com
              </div>
            </div>
            
            {/* 검색 결과 콘텐츠 영역 */}
            <div className="aspect-video bg-gradient-to-br from-slate-50 to-white p-8">
              <div className="w-full h-full bg-white rounded-lg border border-slate-200 shadow-sm p-6 overflow-hidden">
                {/* 검색 결과 헤더 */}
                <div className="mb-4 pb-4 border-b border-slate-200">
                  <div className="text-sm text-slate-600 mb-2">
                    "FBS" 검색 결과 <span className="font-semibold text-slate-900">1,247개</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="secondary" className="text-xs">전체</Badge>
                    <Badge variant="outline" className="text-xs">시약</Badge>
                    <Badge variant="outline" className="text-xs">소모품</Badge>
                  </div>
                </div>

                {/* 검색 결과 리스트 */}
                <div className="space-y-3 max-h-[calc(100%-80px)] overflow-y-auto">
                  {/* 결과 아이템 1 */}
                  <div className="p-3 border border-slate-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-slate-900 mb-1">FBS (Fetal Bovine Serum) - Gibco</h3>
                        <p className="text-xs text-slate-600 mb-2">Catalog: 16000-044 | CAS: N/A</p>
                        <div className="flex items-center gap-4 text-xs">
                          <span className="text-blue-600 font-semibold">₩450,000</span>
                          <span className="text-slate-500">최저가</span>
                          <span className="text-green-600">✓ 재고 있음</span>
                        </div>
                      </div>
                      <Badge className="bg-blue-100 text-blue-700 text-xs">추천</Badge>
                    </div>
                  </div>

                  {/* 결과 아이템 2 */}
                  <div className="p-3 border border-slate-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-slate-900 mb-1">FBS - Sigma-Aldrich</h3>
                        <p className="text-xs text-slate-600 mb-2">Catalog: F2442 | CAS: N/A</p>
                        <div className="flex items-center gap-4 text-xs">
                          <span className="text-slate-900 font-semibold">₩480,000</span>
                          <span className="text-slate-500">+6.7%</span>
                          <span className="text-green-600">✓ 재고 있음</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 결과 아이템 3 */}
                  <div className="p-3 border border-slate-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-slate-900 mb-1">FBS Premium - HyClone</h3>
                        <p className="text-xs text-slate-600 mb-2">Catalog: SH30396.03 | CAS: N/A</p>
                        <div className="flex items-center gap-4 text-xs">
                          <span className="text-slate-900 font-semibold">₩520,000</span>
                          <span className="text-slate-500">+15.6%</span>
                          <span className="text-orange-600">⚠ 배송 2주</span>
                        </div>
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

