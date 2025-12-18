"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import SearchResultList from "./SearchResultList";
import { SearchInput } from "@/components/SearchInput";
import { MainHeader } from "@/app/_components/main-header";
import { PageHeader } from "@/app/_components/page-header";
import { Search } from "lucide-react";

function SearchContent() {
  const searchParams = useSearchParams();
  const q = searchParams.get("q") || "";

  return (
    <>
      {q && (
        <>
          <h2 className="text-sm md:text-lg font-semibold mb-3 md:mb-4">검색 결과</h2>
          <SearchResultList query={q} />
        </>
      )}
      {!q && (
        <div className="text-center py-8 md:py-12 text-slate-500">
          <p className="mb-2 text-xs md:text-sm">검색어를 입력하세요.</p>
          <p className="text-[10px] md:text-sm px-2">예: PBS, FBS, Trypsin, 피펫, 원심분리기, 시약, 소모품, 장비</p>
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
    <div className="min-h-screen bg-slate-50">
      <MainHeader />
      <div className="container mx-auto px-3 md:px-4 py-4 md:py-8">
        <div className="max-w-7xl mx-auto space-y-4 md:space-y-6">
          <PageHeader
            title="제품 검색"
            description="제품명, 벤더, 카테고리를 입력하여 원하는 제품을 찾아보세요."
            icon={Search}
            iconColor="text-blue-600"
          />
          
          {/* 모바일에서 sticky 검색 입력 */}
          <div className="mb-4 md:mb-6 sticky top-16 md:static z-10 bg-slate-50 pb-2 md:pb-0">
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
