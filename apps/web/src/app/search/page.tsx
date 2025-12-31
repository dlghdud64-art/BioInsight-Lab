"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import SearchResultList from "./SearchResultList";
import { SearchInput } from "@/components/SearchInput";
import { SearchFilters } from "@/components/search/search-filters";
import { MainHeader } from "@/app/_components/main-header";
import { PageHeader } from "@/app/_components/page-header";
import { SearchStepNav } from "./_components/search-step-nav";
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
      {!q && (
        <div className="text-center py-16 md:py-20">
          <div className="flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <Search className="h-8 w-8 text-gray-400" strokeWidth={1.5} />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">원하는 시약을 검색해보세요</h3>
            <p className="text-sm text-gray-500 mb-4 max-w-md">
              제품명, 벤더, 카테고리 또는 CAS 번호를 입력하여 검색할 수 있습니다.
            </p>
            <div className="text-xs text-gray-400 space-y-1">
              <p>예: PBS, FBS, Trypsin, 피펫, 원심분리기, 시약, 소모품, 장비</p>
              <p>CAS 번호 형식(예: 67-64-1)으로도 검색할 수 있습니다.</p>
            </div>
          </div>
        </div>
      )}
    </>
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
      <SearchStepNav />
      <div className="container mx-auto px-3 md:px-4 lg:px-8 py-4 md:py-8">
        <div className="max-w-7xl mx-auto space-y-4 md:space-y-6">
          <PageHeader
            title="제품 검색"
            description="제품명, 벤더, 카테고리 또는 CAS 번호를 입력하여 원하는 제품을 찾아보세요."
            icon={Search}
            iconColor="text-blue-600"
          />
          
          {/* 모바일에서 sticky 검색 입력 */}
          <div className="mb-4 md:mb-6 sticky top-16 md:static z-10 bg-transparent pb-2 md:pb-0">
            <SearchInputWrapper />
          </div>
          
          <Suspense fallback={<div className="text-center py-8 md:py-12 text-xs md:text-sm">로딩 중...</div>}>
            <SearchContent />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
