"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import SearchResultList from "./SearchResultList";
import { SearchInput } from "@/components/SearchInput";
import { SearchFilters } from "@/components/search/search-filters";
import { MainHeader } from "@/app/_components/main-header";
import { PageHeader } from "@/app/_components/page-header";
import { Search, Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { PRODUCT_CATEGORIES } from "@/lib/constants";
import { cn } from "@/lib/utils";

function SearchContent() {
  const searchParams = useSearchParams();
  const q = searchParams.get("q") || "";

  // 필터 상태
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedPurities, setSelectedPurities] = useState<string[]>([]);
  const [selectedGrades, setSelectedGrades] = useState<string[]>([]);

  // TODO: 실제 데이터에서 추출
  const availableBrands = [
    "Thermo Fisher Scientific",
    "Sigma-Aldrich",
    "Corning",
    "BD Biosciences",
    "Bio-Rad",
    "Invitrogen",
    "Millipore",
    "Promega",
  ];
  const availablePurities: string[] = [];
  const availableGrades: string[] = [];

  const filterProps = {
    categories: Object.keys(PRODUCT_CATEGORIES),
    selectedCategories,
    onCategoriesChange: setSelectedCategories,
    inStockOnly,
    onInStockOnlyChange: setInStockOnly,
    brands: availableBrands,
    selectedBrands,
    onBrandsChange: setSelectedBrands,
    purities: availablePurities,
    selectedPurities,
    onPuritiesChange: setSelectedPurities,
    grades: availableGrades,
    selectedGrades,
    onGradesChange: setSelectedGrades,
  };

  return (
    <>
      {q && (
        <>
          <div className="flex items-center justify-between mb-4 md:mb-6">
            <h2 className="text-xl font-bold text-gray-900">검색 결과</h2>
            {/* 모바일 필터 버튼 */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="md:hidden">
                  <Filter className="h-4 w-4 mr-2" />
                  필터
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[300px] sm:w-[400px] bg-white">
                <SheetHeader>
                  <SheetTitle className="text-lg font-bold text-gray-900">필터</SheetTitle>
                  <SheetDescription className="text-sm text-gray-500">
                    검색 결과를 필터링하세요.
                  </SheetDescription>
                </SheetHeader>
                <div className="mt-6">
                  <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
                    <SearchFilters {...filterProps} />
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
          <div className="flex gap-8">
            {/* 데스크탑 필터 사이드바 */}
            <aside className="hidden md:block w-56 flex-shrink-0">
              <div className="sticky top-20 bg-white rounded-xl shadow-sm p-4 border border-gray-100">
                <SearchFilters {...filterProps} />
              </div>
            </aside>

            {/* 검색 결과 */}
            <div className="flex-1 min-w-0">
              <SearchResultList
                query={q}
                filters={{
                  categories: selectedCategories,
                  inStockOnly,
                  brands: selectedBrands,
                  purities: selectedPurities,
                  grades: selectedGrades,
                }}
              />
            </div>
          </div>
        </>
      )}
      {!q && <HeroSearchSection />}
    </>
  );
}

function HeroSearchSection() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    router.push(`/search?q=${encodeURIComponent(query)}`);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] w-full px-4 md:px-8">
      <div className="flex flex-col items-center justify-center w-full max-w-3xl mx-auto">
        {/* Hero 검색창 */}
        <div className="w-full mb-8">
          <form onSubmit={onSearch} className="w-full">
            <div className="relative flex items-center w-full max-w-2xl mx-auto">
              <Search className="absolute left-6 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5 md:h-6 md:w-6 z-10" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="제품명, 벤더, 시약명 검색..."
                className="w-full h-14 md:h-16 pl-14 md:pl-16 pr-32 md:pr-36 text-lg md:text-xl bg-white border-2 border-gray-200 rounded-full shadow-xl focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all duration-200 hover:shadow-2xl"
              />
              <Button
                type="submit"
                className="absolute right-2 h-10 md:h-12 px-6 md:px-8 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200"
              >
                <Search className="h-5 w-5 md:mr-2" />
                <span className="hidden md:inline">검색</span>
              </Button>
            </div>
          </form>
        </div>
        
        {/* 안내 문구 */}
        <div className="w-full max-w-4xl mt-8 text-center">
          <p className="text-base md:text-lg text-gray-500 break-keep whitespace-pre-wrap leading-relaxed mb-2">
            제품명, 벤더, 카테고리 또는 CAS 번호를 입력하여 검색할 수 있습니다.
          </p>
          <p className="text-sm md:text-base text-gray-400 break-keep whitespace-pre-wrap leading-relaxed">
            예: FBS, Trypsin, 파이펫, 원심분리기, 시약, 소모품, 장비, CAS 번호 등으로 검색할 수 있습니다.
          </p>
        </div>
      </div>
    </div>
  );
}

function SearchInputWrapper() {
  return (
    <Suspense fallback={<div className="h-10 w-full bg-slate-100 rounded-md animate-pulse" />}>
      <SearchInput />
    </Suspense>
  );
}

export default function SearchPage() {
  return (
    <div className="min-h-screen bg-gray-50/50">
      <MainHeader />
      <Suspense fallback={<div className="text-center py-8 md:py-12 text-xs md:text-sm">로딩 중...</div>}>
        <SearchPageContent />
      </Suspense>
    </div>
  );
}

function SearchPageContent() {
  const searchParams = useSearchParams();
  const q = searchParams.get("q") || "";
  const hasQuery = !!q;

  return (
    <div className={cn(
      "pt-14 container mx-auto px-3 md:px-4 lg:px-8",
      hasQuery ? "py-4 md:py-8" : ""
    )}>
      <div className="max-w-7xl mx-auto space-y-4 md:space-y-6">
        {/* 검색 결과가 있을 때만 상단 헤더와 검색창 표시 */}
        {hasQuery && (
          <>
            <PageHeader
              title="제품 검색"
              description="제품명, 벤더, 카테고리 또는 CAS 번호를 입력하여 원하는 제품을 찾아보세요."
              icon={Search}
              iconColor="text-blue-600"
            />
            
            {/* 검색 입력창 - PageHeader 아래 */}
            <div className="mb-4 md:mb-6">
              <SearchInputWrapper />
            </div>
          </>
        )}
        
        <SearchContent />
      </div>
    </div>
  );
}
