"use client";

import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompareStore } from "@/lib/store/compare-store";
import { useToast } from "@/hooks/use-toast";
import { PRODUCT_CATEGORIES } from "@/lib/constants";
import { trackEvent } from "@/lib/analytics";

interface TestFlowContextType {
  // 검색 상태
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchCategory: string;
  setSearchCategory: (category: string) => void;
  searchBrand: string;
  setSearchBrand: (brand: string) => void;
  sortBy: "relevance" | "price_low" | "price_high" | "lead_time";
  setSortBy: (sort: "relevance" | "price_low" | "price_high" | "lead_time") => void;
  // 필터 상태
  minPrice: number | undefined;
  setMinPrice: (price: number | undefined) => void;
  maxPrice: number | undefined;
  setMaxPrice: (price: number | undefined) => void;
  stockStatus: string | undefined;
  setStockStatus: (status: string | undefined) => void;
  leadTime: string | undefined;
  setLeadTime: (time: string | undefined) => void;
  grade: string | undefined;
  setGrade: (grade: string | undefined) => void;
  products: any[];
  isSearchLoading: boolean;
  queryAnalysis: any;
  
  // 프로토콜 분석
  protocolText: string;
  setProtocolText: (text: string) => void;
  protocolAnalysis: any;
  isExtracting: boolean;
  
  // 비교/견적 요청 리스트
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
  const [searchBrand, setSearchBrand] = useState<string>("");
  const [sortBy, setSortBy] = useState<"relevance" | "price_low" | "price_high" | "lead_time">("relevance");
  const [minPrice, setMinPrice] = useState<number | undefined>(undefined);
  const [maxPrice, setMaxPrice] = useState<number | undefined>(undefined);
  const [stockStatus, setStockStatus] = useState<string | undefined>(undefined);
  const [leadTime, setLeadTime] = useState<string | undefined>(undefined);
  const [grade, setGrade] = useState<string | undefined>(undefined);
  const [protocolText, setProtocolText] = useState("");
  const [searchTrigger, setSearchTrigger] = useState(0);
  const [quoteItems, setQuoteItems] = useState<any[]>([]);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [gptEnabled, setGptEnabled] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  
  const { productIds, addProduct, removeProduct, clearProducts } = useCompareStore();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // 검색 결과
  const { data: searchData, isLoading: isSearchLoading, error: searchError } = useQuery({
    queryKey: ["search-products", searchQuery, searchCategory, searchBrand, sortBy, minPrice, maxPrice, stockStatus, leadTime, grade, searchTrigger],
    queryFn: async () => {
      if (!searchQuery) return { products: [], total: 0 };
      const params = new URLSearchParams({
        query: searchQuery,
        ...(searchCategory && { category: searchCategory }),
        ...(searchBrand && { brand: searchBrand }),
        sortBy,
        ...(minPrice !== undefined && { minPrice: minPrice.toString() }),
        ...(maxPrice !== undefined && { maxPrice: maxPrice.toString() }),
        ...(stockStatus && { stockStatus }),
        ...(leadTime && { leadTime }),
        ...(grade && { grade }),
        limit: "10",
      });
      const response = await fetch(`/api/products/search?${params.toString()}`);
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "검색에 실패했습니다." }));
        throw new Error(error.error || "검색에 실패했습니다.");
      }
      return response.json();
    },
    enabled: !!searchQuery && searchTrigger > 0,
    retry: false,
  });

  // 검색 에러 토스트 표시
  useEffect(() => {
    if (searchError && hasSearched) {
      toast({
        title: "검색 실패",
        description: (searchError as Error).message || "제품 검색 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  }, [searchError, hasSearched, toast]);

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
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "프로토콜 분석에 실패했습니다." }));
        throw new Error(error.error || "프로토콜 분석에 실패했습니다.");
      }
      return response.json();
    },
    onError: (error: Error) => {
      toast({
        title: "프로토콜 분석 실패",
        description: error.message || "프로토콜 분석 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
    onSuccess: (data: any) => {
      // Analytics: protocol_extract_run 성공 시 추출된 항목 수 추적
      const extractedItemCount = data?.reagents?.length || data?.items?.length || 0;
      trackEvent("protocol_extract_run", {
        extracted_item_count: extractedItemCount,
        has_target: !!data?.target,
        has_experiment_type: !!data?.experimentType,
      });
      
      toast({
        title: "분석 완료",
        description: "프로토콜에서 시약 정보를 성공적으로 추출했습니다.",
      });
      
      // 프로토콜 분석 결과를 검색 필터에 자동 반영
      if (data) {
        // 타깃이 있으면 검색어에 추가
        if (data.target) {
          const currentQuery = searchQuery.trim();
          const targetQuery = data.target;
          // 검색어에 타깃이 없으면 추가
          if (!currentQuery.toLowerCase().includes(targetQuery.toLowerCase())) {
            setSearchQuery(currentQuery ? `${currentQuery} ${targetQuery}` : targetQuery);
          }
        }
        
        // 실험 유형이 있으면 검색어에 추가
        if (data.experimentType) {
          const currentQuery = searchQuery.trim();
          const experimentQuery = data.experimentType;
          if (!currentQuery.toLowerCase().includes(experimentQuery.toLowerCase())) {
            setSearchQuery(currentQuery ? `${currentQuery} ${experimentQuery}` : experimentQuery);
          }
        }
        
        // 카테고리가 있으면 필터에 반영
        if (data.category) {
          // 카테고리 매핑 (예: "ELISA" -> "REAGENT", "Western Blot" -> "REAGENT" 등)
          const categoryMap: Record<string, string> = {
            "ELISA": "REAGENT",
            "Western Blot": "REAGENT",
            "PCR": "REAGENT",
            "Cell Culture": "REAGENT",
            "시약": "REAGENT",
            "소모품": "TOOL",
            "장비": "EQUIPMENT",
          };
          
          const mappedCategory = categoryMap[data.category] || data.category;
          if (mappedCategory && Object.keys(PRODUCT_CATEGORIES).includes(mappedCategory)) {
            setSearchCategory(mappedCategory);
          }
        }
        
        // 추출된 시약이 있으면 검색어에 첫 번째 시약 추가
        if (data.reagents && data.reagents.length > 0) {
          const firstReagent = data.reagents[0].name;
          const currentQuery = searchQuery.trim();
          if (!currentQuery.toLowerCase().includes(firstReagent.toLowerCase())) {
            setSearchQuery(currentQuery ? `${currentQuery} ${firstReagent}` : firstReagent);
          }
        }
        
        // 자동으로 검색 실행
        setTimeout(() => {
          runSearch();
        }, 500);
      }
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

  const addProductToQuote = (product: any, vendorId?: string) => {
    // vendorId가 지정되지 않으면 첫 번째 벤더 사용
    const selectedVendor = vendorId 
      ? product.vendors?.find((v: any) => v.vendor?.id === vendorId)
      : product.vendors?.[0];
    
    if (!selectedVendor) {
      console.warn("No vendor found for product", product.id);
      return;
    }

    const existingIndex = quoteItems.findIndex(
      (item) => item.productId === product.id && item.vendorId === selectedVendor.vendor?.id
    );
    
    if (existingIndex >= 0) {
      // 같은 제품, 같은 벤더가 이미 있으면 수량 증가
      setQuoteItems((prev) =>
        prev.map((item, idx) =>
          idx === existingIndex
            ? { ...item, quantity: (item.quantity || 1) + 1, lineTotal: item.unitPrice * ((item.quantity || 1) + 1) }
            : item
        )
      );
    } else {
      // 새로 추가
      const unitPrice = selectedVendor?.priceInKRW || 0;
      setQuoteItems((prev) => [
        ...prev,
        {
          id: `item-${Date.now()}-${prev.length}`,
          productId: product.id,
          productName: product.name,
          vendorId: selectedVendor.vendor?.id || "",
          vendorName: selectedVendor?.vendor?.name || product.brand || "",
          unitPrice,
          currency: selectedVendor?.currency || "KRW",
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
      // Analytics: protocol_extract_run 이벤트 추적
      trackEvent("protocol_extract_run", {
        text_length: protocolText.length,
      });
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
          title: title || "견적 요청 리스트",
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
        const error = await quoteResponse.json().catch(() => ({ error: "견적 요청 리스트 생성에 실패했습니다." }));
        throw new Error(error.error || "견적 요청 리스트 생성에 실패했습니다.");
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

      if (!shareResponse.ok) {
        const error = await shareResponse.json().catch(() => ({ error: "공유 링크 생성에 실패했습니다." }));
        throw new Error(error.error || "공유 링크 생성에 실패했습니다.");
      }
      return shareResponse.json();
    },
    onSuccess: (data) => {
      const shareUrl = `${window.location.origin}/share/${data.publicId}`;
      setShareLink(shareUrl);
      // publicId와 만료일 정보도 함께 저장 (향후 비활성화 기능을 위해)
      return { shareUrl, publicId: data.publicId, expiresAt: data.expiresAt };
    },
    onError: (error: Error) => {
      toast({
        title: "공유 링크 생성 실패",
        description: error.message || "공유 링크 생성 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  const generateShareLink = async (title?: string, expiresInDays?: number) => {
    if (quoteItems.length === 0) {
      throw new Error("견적 요청 리스트가 비어있습니다.");
    }
    // expiresInDays를 mutation에 전달하기 위해 임시로 title에 포함
    // 실제로는 mutation 함수를 수정해야 함
    const result = await generateShareLinkMutation.mutateAsync({
      title: title || "품목 리스트",
      expiresInDays: expiresInDays || 30,
    });
    return result;
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
        searchBrand,
        setSearchBrand,
        sortBy,
        setSortBy,
        minPrice,
        setMinPrice,
        maxPrice,
        setMaxPrice,
        stockStatus,
        setStockStatus,
        leadTime,
        setLeadTime,
        grade,
        setGrade,
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