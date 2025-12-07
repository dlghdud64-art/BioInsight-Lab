"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { TestBoardColumn } from "./test-board-column";
import { ProductSearchCard } from "./product-search-card";
import { ProtocolInputCard } from "./protocol-input-card";
import { QueryAnalysisCard } from "./query-analysis-card";
import { ProtocolAnalysisCard } from "./protocol-analysis-card";
import { CandidateProductsCard } from "./candidate-products-card";
import { QuoteListCard } from "./quote-list-card";
import { ShareActionsCard } from "./share-actions-card";
import { useCompareStore } from "@/lib/store/compare-store";
import { PRODUCT_CATEGORIES } from "@/lib/constants";
import type { ProductCategory } from "@/types";

export function TestBoard() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchCategory, setSearchCategory] = useState<string>("");
  const [sortBy, setSortBy] = useState<"relevance" | "price_low" | "price_high" | "lead_time">("relevance");
  const [protocolText, setProtocolText] = useState("");
  const [extractionResult, setExtractionResult] = useState<any>(null);
  const [searchTrigger, setSearchTrigger] = useState(0);
  
  const { productIds, addProduct, removeProduct } = useCompareStore();

  // 검색 결과
  const { data: searchData, isLoading: isSearchLoading } = useQuery({
    queryKey: ["search-products", searchQuery, searchCategory, sortBy, searchTrigger],
    queryFn: async () => {
      if (!searchQuery) return { products: [], total: 0 };
      const params = new URLSearchParams({
        query: searchQuery,
        ...(searchCategory && { category: searchCategory }),
        sortBy,
        limit: "10",
      });
      const response = await fetch(`/api/products/search?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to search products");
      return response.json();
    },
    enabled: !!searchQuery && searchTrigger > 0,
  });

  const handleSearch = () => {
    if (searchQuery) {
      setSearchTrigger((prev) => prev + 1);
    }
  };

  // 검색 의도 분석
  const { data: intentData } = useQuery({
    queryKey: ["search-intent", searchQuery],
    queryFn: async () => {
      if (!searchQuery) return null;
      const response = await fetch("/api/search/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery }),
      });
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!searchQuery,
  });

  // 프로토콜 필드 추출
  const extractProtocolMutation = useMutation({
    mutationFn: async (text: string) => {
      const response = await fetch("/api/protocol/extract-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!response.ok) throw new Error("Failed to extract protocol");
      return response.json();
    },
    onSuccess: (data) => {
      setExtractionResult(data);
    },
  });

  const products = searchData?.products || [];
  const intent = intentData?.intent || null;

  return (
    <section>
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-slate-700">
          핵심 기능 테스트
        </h2>
        <p className="text-xs text-slate-500">
          Step 1(입력) → Step 2(AI 처리) → Step 3(결과 & 공유) 순서로 기능을 확인해보세요.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Step 1: 입력 */}
        <TestBoardColumn
          step={1}
          title="입력"
          description="검색 키워드, 프로토콜/데이터시트 텍스트를 입력하는 단계입니다."
        >
          <ProductSearchCard
            searchQuery={searchQuery}
            category={searchCategory}
            sortBy={sortBy}
            onQueryChange={setSearchQuery}
            onCategoryChange={setSearchCategory}
            onSortByChange={setSortBy}
            onSearch={handleSearch}
          />
          <ProtocolInputCard
            protocolText={protocolText}
            isExtracting={extractProtocolMutation.isPending}
            onTextChange={setProtocolText}
            onExtract={() => {
              if (protocolText) {
                extractProtocolMutation.mutate(protocolText);
              }
            }}
          />
        </TestBoardColumn>

        {/* Step 2: AI 처리 */}
        <TestBoardColumn
          step={2}
          title="AI 처리"
          description="검색어 분류, 텍스트 분석 결과를 확인합니다."
        >
          <QueryAnalysisCard intent={intent} />
          <ProtocolAnalysisCard extractionResult={extractionResult} />
        </TestBoardColumn>

        {/* Step 3: 결과 & 공유 */}
        <TestBoardColumn
          step={3}
          title="결과 & 공유"
          description="제품 후보, 품목 리스트, 그룹웨어 공유 기능을 테스트합니다."
        >
          <CandidateProductsCard
            products={products}
            isLoading={isSearchLoading}
            selectedProductIds={productIds}
            onToggleSelect={(id) => {
              if (productIds.includes(id)) {
                removeProduct(id);
              } else {
                addProduct(id);
              }
            }}
          />
          <QuoteListCard productCount={productIds.length} />
          <ShareActionsCard productIds={productIds} />
        </TestBoardColumn>
      </div>
    </section>
  );
}

