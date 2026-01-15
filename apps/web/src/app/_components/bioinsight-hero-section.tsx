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
      router.push(`/test/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const popularSearches = ["FBS", "Pipette", "Conical Tube", "Centrifuge", "DMEM", "Trypsin"];

  return (
    <section className="relative w-full pt-32 md:pt-40 pb-20 overflow-hidden bg-white border-b border-slate-200 min-h-[60vh]">
      
      {/* 배경 패턴 (Grid) */}
      <div className="absolute inset-0 opacity-30 pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: `linear-gradient(to right, rgba(0,0,0,0.02) 1px, transparent 1px),
                            linear-gradient(to bottom, rgba(0,0,0,0.02) 1px, transparent 1px)`,
          backgroundSize: '40px 40px'
        }}></div>
      </div>

      {/* 배경 데코레이션 */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[600px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-100/20 via-transparent to-transparent pointer-events-none" />

      <div className="container px-4 md:px-6 mx-auto relative z-10 mt-8 md:mt-16">
        
        {/* 1. 메인 카피 */}
        <div className="max-w-4xl mx-auto text-center space-y-6 md:space-y-8 mb-8 md:mb-12">
          <h1 className="text-3xl md:text-6xl font-extrabold tracking-tight text-slate-900 leading-tight py-2">
            전 세계 500만 개 시약/장비, <br className="hidden sm:block" />
            <span className="text-blue-600">최저가 검색부터 견적까지</span>
          </h1>
          
          <p className="text-base md:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed px-2">
            더 이상 구글링하지 마세요. <br />
            BioInsight Lab이 스펙 비교부터 최적 견적까지 한 번에 찾아드립니다.
          </p>
        </div>

        {/* 2. 중앙 대형 검색창 (구글 스타일) */}
        <div className="max-w-3xl mx-auto px-4">
          <form onSubmit={handleSearch} className="relative w-full">
            <div className="flex items-center gap-2 bg-white rounded-full border-2 border-slate-300 shadow-lg hover:shadow-xl transition-all focus-within:border-blue-500 focus-within:shadow-blue-500/20 w-full max-w-full">
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="찾으시는 시약명, CAS Number, 제조사를 입력해보세요 (예: FBS, Anti-IL6)"
                className="flex-1 h-14 md:h-16 px-4 md:px-6 text-sm md:text-base lg:text-lg border-0 rounded-full focus-visible:ring-0 focus-visible:ring-offset-0 w-full max-w-full"
              />
              <Button
                type="submit"
                size="lg"
                className="h-14 md:h-16 px-4 md:px-8 bg-blue-600 hover:bg-blue-700 text-white rounded-full mr-1 my-1 font-semibold text-sm md:text-base flex-shrink-0"
              >
                <Search className="h-4 w-4 md:h-5 md:w-5 mr-1 md:mr-2" />
                <span className="hidden sm:inline">검색</span>
              </Button>
            </div>
          </form>

          {/* 인기 검색어 칩 */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
            <span className="text-sm text-slate-500 font-medium">🔥 인기:</span>
            {popularSearches.map((term) => (
              <Badge
                key={term}
                variant="secondary"
                className="cursor-pointer hover:bg-blue-100 hover:text-blue-700 transition-colors px-3 py-1.5 text-sm font-medium"
                onClick={() => {
                  setSearchQuery(term);
                  router.push(`/test/search?q=${encodeURIComponent(term)}`);
                }}
              >
                #{term}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

