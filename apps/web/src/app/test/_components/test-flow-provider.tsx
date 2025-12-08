"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompareStore } from "@/lib/store/compare-store";

interface TestFlowContextType {
  // 검색 상태
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchCategory: string;
  setSearchCategory: (category: string) => void;
  sortBy: "relevance" | "price_low" | "price_high" | "lead_time";
  setSortBy: (sort: "relevance" | "price_low" | "price_high" | "lead_time") => void;
  products: any[];
  isSearchLoading: boolean;
  queryAnalysis: any;
  
  // 프로토콜 분석
  protocolText: string;
  setProtocolText: (text: string) => void;
  protocolAnalysis: any;
  isExtracting: boolean;
  
  // 비교/품목 리스트
  compareIds: string[];
  quoteItems: any[];
  
  // 공유
  shareLink: string | null;
  isGeneratingShareLink: boolean;
  
  // GPT 분석 상태
  gptEnabled: boolean;
  setGptEnabled: (enabled: boolean) => void;
  hasSearched: boolean;
  analysisLoading: boolean;
  analysisError: string | null;
  
  // 액션
  runSearch: () => void;
  toggleCompare: (productId: string) => void;
  clearCompare: () => void;
  addProductToQuote: (product: any) => void;
  updateQuoteItem: (itemId: string, updates: any) => void;
  removeQuoteItem: (itemId: string) => void;
  runProtocolAnalysis: () => void;
  generateShareLink: (title?: string, expiresInDays?: number) => Promise<void>;
}

const TestFlowContext = createContext<TestFlowContextType | undefined>(undefined);

export function TestFlowProvider({ children }: { children: ReactNode }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchCategory, setSearchCategory] = useState<string>("");
  const [sortBy, setSortBy] = useState<"relevance" | "price_low" | "price_high" | "lead_time">("relevance");
  const [protocolText, setProtocolText] = useState("");
  const [searchTrigger, setSearchTrigger] = useState(0);
  const [quoteItems, setQuoteItems] = useState<any[]>([]);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [gptEnabled, setGptEnabled] = useState(true);
  const [hasSearched, setHasSearched] = useState(false);
  
  const { productIds, addProduct, removeProduct, clearProducts } = useCompareStore();
  const queryClient = useQueryClient();

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

  // 검색 의도 분석 (GPT 분석)
  const { 
    data: intentData, 
    isLoading: analysisLoading,
    error: analysisError 
  } = useQuery({
    queryKey: ["search-intent", searchQuery, searchTrigger],
    queryFn: async () => {
      if (!searchQuery) return null;
      const response = await fetch("/api/search/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "분석에 실패했습니다." }));
        throw new Error(error.error || "분석에 실패했습니다.");
      }
      return response.json();
    },
    enabled: !!searchQuery && gptEnabled && searchTrigger > 0,
    retry: false,
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
  });

  const runSearch = () => {
    if (searchQuery) {
      setHasSearched(true);
      setSearchTrigger((prev) => prev + 1);
    }
  };

  const toggleCompare = (productId: string) => {
    if (productIds.includes(productId)) {
      removeProduct(productId);
    } else {
      addProduct(productId);
    }
  };

  const clearCompare = () => {
    clearProducts();
  };

  const addProductToQuote = (product: any) => {
    const existingIndex = quoteItems.findIndex((item) => item.productId === product.id);
    if (existingIndex >= 0) {
      // 이미 있으면 수량 증가
      setQuoteItems((prev) =>
        prev.map((item, idx) =>
          idx === existingIndex
            ? { ...item, quantity: (item.quantity || 1) + 1 }
            : item
        )
      );
    } else {
      // 새로 추가
      const vendor = product.vendors?.[0];
      const unitPrice = vendor?.priceInKRW || 0;
      setQuoteItems((prev) => [
        ...prev,
        {
          id: `item-${Date.now()}-${prev.length}`,
          productId: product.id,
          productName: product.name,
          vendorName: vendor?.vendor?.name || product.brand || "",
          unitPrice,
          currency: vendor?.currency || "KRW",
          quantity: 1,
          lineTotal: unitPrice,
          notes: "",
        },
      ]);
    }
  };

  const updateQuoteItem = (itemId: string, updates: any) => {
    setQuoteItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              ...updates,
              lineTotal: (updates.quantity || item.quantity) * (updates.unitPrice || item.unitPrice),
            }
          : item
      )
    );
  };

  const removeQuoteItem = (itemId: string) => {
    setQuoteItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  const runProtocolAnalysis = () => {
    if (protocolText) {
      extractProtocolMutation.mutate(protocolText);
    }
  };

  const generateShareLinkMutation = useMutation({
    mutationFn: async (params: { title: string; expiresInDays?: number }) => {
      const { title, expiresInDays } = params;
      // 먼저 QuoteList 생성
      const quoteResponse = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title || "품목 리스트",
          items: quoteItems.map((item, index) => ({
            productId: item.productId,
            lineNumber: index + 1,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            currency: item.currency,
            lineTotal: item.lineTotal,
            notes: item.notes,
          })),
        }),
      });

      if (!quoteResponse.ok) {
        const error = await quoteResponse.json();
        throw new Error(error.error || "Failed to create quote list");
      }
      const quote = await quoteResponse.json();

      // 공유 링크 생성
      const shareResponse = await fetch("/api/shared-lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteId: quote.id,
          title: title || quote.title,
          expiresInDays: expiresInDays || 30, // 기본값 30일
        }),
      });

      if (!shareResponse.ok) throw new Error("Failed to create share link");
      return shareResponse.json();
    },
    onSuccess: (data) => {
      const shareUrl = `${window.location.origin}/share/${data.publicId}`;
      setShareLink(shareUrl);
    },
  });

  const generateShareLink = async (title?: string, expiresInDays?: number) => {
    if (quoteItems.length === 0) {
      throw new Error("품목 리스트가 비어있습니다.");
    }
    // expiresInDays를 mutation에 전달하기 위해 임시로 title에 포함
    // 실제로는 mutation 함수를 수정해야 함
    await generateShareLinkMutation.mutateAsync({
      title: title || "품목 리스트",
      expiresInDays: expiresInDays || 30,
    });
  };

  const products = searchData?.products || [];
  const queryAnalysis = intentData?.intent || null;
  const protocolAnalysis = extractProtocolMutation.data;

  return (
    <TestFlowContext.Provider
      value={{
        searchQuery,
        setSearchQuery,
        searchCategory,
        setSearchCategory,
        sortBy,
        setSortBy,
        products,
        isSearchLoading,
        queryAnalysis,
        protocolText,
        setProtocolText,
        protocolAnalysis,
        isExtracting: extractProtocolMutation.isPending,
        compareIds: productIds, // useCompareStore의 productIds 사용
        quoteItems,
        shareLink,
        isGeneratingShareLink: generateShareLinkMutation.isPending,
        gptEnabled,
        setGptEnabled,
        hasSearched,
        analysisLoading,
        analysisError: analysisError ? (analysisError as Error).message : null,
        runSearch,
        toggleCompare,
        clearCompare,
        addProductToQuote,
        updateQuoteItem,
        removeQuoteItem,
        runProtocolAnalysis,
        generateShareLink,
      }}
    >
      {children}
    </TestFlowContext.Provider>
  );
}

// useTestFlow hook export
export function useTestFlow() {
  const context = useContext(TestFlowContext);
  if (!context) {
    throw new Error("useTestFlow must be used within TestFlowProvider");
  }
  return context;
}