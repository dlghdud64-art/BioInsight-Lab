"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, FlaskConical } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

// CAS 번호 형식 감지: 00-00-0 또는 000-00-0 형식
const CAS_PATTERN = /^\d{2,7}-\d{2}-\d$/;

export function SearchInput() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [isCasMode, setIsCasMode] = useState(false);

  useEffect(() => {
    setQuery(searchParams.get("q") || "");
  }, [searchParams]);

  useEffect(() => {
    // CAS 번호 형식 감지
    const trimmedQuery = query.trim();
    setIsCasMode(CAS_PATTERN.test(trimmedQuery));
  }, [query]);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    router.push(`/search?q=${encodeURIComponent(query)}`);
  };

  return (
    <form onSubmit={onSearch} className="flex gap-2 w-full max-w-xl" role="search" aria-label="제품 검색">
      <div className="relative flex-1">
        {isCasMode ? (
          <FlaskConical className="absolute left-3 top-1/2 transform -translate-y-1/2 text-blue-600 h-4 w-4 md:h-5 md:w-5" aria-hidden="true" />
        ) : (
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4 md:h-5 md:w-5" aria-hidden="true" />
        )}
        <Input
          placeholder={isCasMode ? "CAS 번호로 검색 중..." : "제품명, 벤더, 시약명 검색..."}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={`pl-10 md:pl-12 text-sm md:text-base h-10 md:h-11 bg-gray-50 border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all ${isCasMode ? "border-blue-300 focus:border-blue-500" : ""}`}
          aria-label="검색어 입력"
          aria-describedby="search-description"
        />
        {isCasMode && (
          <Badge
            variant="secondary"
            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs bg-blue-50 text-blue-700 border-blue-200"
          >
            CAS 검색
          </Badge>
        )}
        <span id="search-description" className="sr-only">
          제품명, 벤더, 시약명 또는 CAS 번호를 입력하여 검색할 수 있습니다.
        </span>
      </div>
      <Button 
        type="submit" 
        className="flex-shrink-0 h-10 md:h-11 px-4 md:px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105" 
        aria-label="검색 실행"
      >
        <Search className="h-4 w-4 md:mr-2" aria-hidden="true" />
        <span className="hidden md:inline">검색</span>
      </Button>
    </form>
  );
}

