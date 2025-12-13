"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

export function SearchInput() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") || "");

  useEffect(() => {
    setQuery(searchParams.get("q") || "");
  }, [searchParams]);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    router.push(`/search?q=${encodeURIComponent(query)}`);
  };

  return (
    <form onSubmit={onSearch} className="flex gap-2 w-full max-w-xl" role="search" aria-label="제품 검색">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4 md:h-5 md:w-5" aria-hidden="true" />
        <Input
          placeholder="제품명, 벤더, 시약명 검색..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10 md:pl-12 text-sm md:text-base h-10 md:h-11"
          aria-label="검색어 입력"
          aria-describedby="search-description"
        />
        <span id="search-description" className="sr-only">
          제품명, 벤더, 시약명을 입력하여 검색할 수 있습니다.
        </span>
      </div>
      <Button type="submit" className="flex-shrink-0 h-10 md:h-11 px-3 md:px-4" aria-label="검색 실행">
        <Search className="h-4 w-4 md:mr-2" aria-hidden="true" />
        <span className="hidden md:inline">검색</span>
      </Button>
    </form>
  );
}

