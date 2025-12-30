"use client";

import { useEffect, useState } from "react";
import { ProductCard } from "@/components/search/product-card";
import { Search, FileText } from "lucide-react";

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
      <div className="text-center py-12 text-slate-500">
        <Search className="h-12 w-12 mx-auto text-slate-300 mb-3" />
        <p className="text-sm font-medium text-slate-900 mb-1">검색어를 입력하세요</p>
        <p className="text-xs text-slate-500">제품명, 벤더, 카테고리를 검색할 수 있습니다.</p>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <FileText className="h-12 w-12 mx-auto text-slate-300 mb-3" />
        <p className="text-sm font-medium text-slate-900 mb-1">검색 결과가 없습니다</p>
        <p className="text-xs text-slate-500">다른 검색어로 다시 시도해보세요.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 md:space-y-4">
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
  );
}

