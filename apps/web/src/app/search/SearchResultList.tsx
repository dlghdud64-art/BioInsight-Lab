"use client";

import { useEffect, useState } from "react";
import { ProductCard } from "@/components/search/product-card";
import { Search, FileText } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SearchFilters {
  categories: string[];
  inStockOnly: boolean;
  brands: string[];
  purities: string[];
  grades: string[];
}

export default function SearchResultList({
  query,
  filters,
}: {
  query: string;
  filters?: SearchFilters;
}) {
  const [results, setResults] = useState<any[]>([]);
  const [sortBy, setSortBy] = useState<string>("relevance");

  useEffect(() => {
    if (!query) return;

    const params = new URLSearchParams({ q: query });
    if (filters) {
      if (filters.categories.length > 0) {
        params.append("categories", filters.categories.join(","));
      }
      if (filters.inStockOnly) {
        params.append("inStockOnly", "true");
      }
      if (filters.brands.length > 0) {
        params.append("brands", filters.brands.join(","));
      }
      if (filters.purities.length > 0) {
        params.append("purities", filters.purities.join(","));
      }
      if (filters.grades.length > 0) {
        params.append("grades", filters.grades.join(","));
      }
    }

    fetch(`/api/search?${params}`)
      .then((res) => res.json())
      .then((data) => setResults(data));
  }, [query, filters]);

  if (!query) {
    return (
      <div className="text-center py-16 md:py-20">
        <div className="flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <Search className="h-8 w-8 text-gray-400" strokeWidth={1.5} />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">원하는 시약을 검색해보세요</h3>
          <p className="text-sm text-gray-500">제품명, 벤더, 카테고리를 검색할 수 있습니다.</p>
        </div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-16 md:py-20">
        <div className="flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <FileText className="h-8 w-8 text-gray-400" strokeWidth={1.5} />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">검색 결과가 없습니다</h3>
          <p className="text-sm text-gray-500">다른 검색어로 다시 시도해보세요.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* 헤더: 검색 결과 개수 & 정렬 */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-gray-600">
          검색 결과: <span className="font-bold text-gray-900">{results.length}</span>건
        </div>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[180px] border-gray-200 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-100">
            <SelectValue placeholder="정렬 기준" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="relevance">관련도순</SelectItem>
            <SelectItem value="price_low">가격 낮은 순</SelectItem>
            <SelectItem value="price_high">가격 높은 순</SelectItem>
            <SelectItem value="name">이름순</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 상품 카드 리스트 */}
      <div className="space-y-3">
        {results.map((p: any) => {
        // 백엔드 데이터를 ProductCard 형식으로 변환
        const productData = {
          id: p.id,
          name: p.name,
          vendor: p.vendor,
          category: p.category,
          price: p.price,
          unit: p.unit,
          description: p.description,
          catalogNumber: p.catalogNumber,
          purity: p.purity,
          grade: p.grade,
          stockStatus: p.stockStatus || (p.inStock ? "in_stock" : undefined),
          stockText: p.stockText,
          casNumber: p.casNumber,
        };

        return (
          <ProductCard
            key={p.id}
            product={productData}
          />
        );
      })}
      </div>
    </div>
  );
}

