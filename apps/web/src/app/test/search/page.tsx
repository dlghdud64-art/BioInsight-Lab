"use client";

import { SearchPanel } from "../_components/search-panel";
import { useTestFlow } from "../_components/test-flow-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { PRODUCT_CATEGORIES } from "@/lib/constants";
import { PriceDisplay } from "@/components/products/price-display";
import { Loader2, ShoppingCart, GitCompare, X, Trash2, Plus, Minus, Search, FileText, Package, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { SearchResultItem } from "../_components/search-result-item";
import { PageHeader } from "@/app/_components/page-header";
import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { LayoutDashboard, ClipboardList, TrendingDown } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft } from "lucide-react";
import { AIInsightCard } from "@/components/ai-insight-card";
import { useCompareStore } from "@/lib/store/compare-store";

export default function SearchPage() {
  const {
    products,
    isSearchLoading,
    compareIds,
    toggleCompare,
    addProductToQuote,
    quoteItems,
    queryAnalysis,
    clearCompare,
    removeQuoteItem,
    updateQuoteItem,
    hasSearched,
    analysisLoading,
    searchQuery,
    searchCategory,
    searchBrand,
    sortBy,
    minPrice,
    maxPrice,
    grade,
  } = useTestFlow();
  const { getDisplayName: getStoredName } = useCompareStore();
  const { data: session } = useSession();
  const router = useRouter();
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isQuoteSheetOpen, setIsQuoteSheetOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [sheetSide, setSheetSide] = useState<"bottom" | "right">("bottom");
  const [isLoginPromptOpen, setIsLoginPromptOpen] = useState(false);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

  // Batch-fetch compare status for visible products
  const productIds = useMemo(() => products.map((p: any) => p.id), [products]);
  const { data: compareStatusData } = useQuery<{ statuses: Record<string, { activeCount: number }> }>({
    queryKey: ["compare-status", productIds],
    queryFn: async () => {
      const res = await fetch(`/api/products/compare-status?productIds=${productIds.join(",")}`);
      if (!res.ok) return { statuses: {} };
      return res.json();
    },
    enabled: productIds.length > 0 && !!session?.user,
    staleTime: 30_000,
  });
  const compareStatuses = compareStatusData?.statuses ?? {};

  const activeFilterCount = [searchCategory, searchBrand, grade].filter(Boolean).length
    + (sortBy !== "relevance" ? 1 : 0)
    + (minPrice !== undefined ? 1 : 0)
    + (maxPrice !== undefined ? 1 : 0);

  const callbackUrl = searchQuery ? `/test/search?q=${encodeURIComponent(searchQuery)}` : "/test/search";

  const handleProtectedAction = (action: () => void) => {
    if (!session?.user) {
      setIsLoginPromptOpen(true);
      return;
    }
    action();
  };

  const handleLoginRedirect = () => {
    setIsLoginPromptOpen(false);
    router.push(`/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  };

  const totalAmount = quoteItems.reduce((sum, item) => sum + (item.lineTotal || 0), 0);

  // 모바일/데스크톱 분기
  useEffect(() => {
    const handleResize = () => {
      setSheetSide(window.innerWidth >= 768 ? "right" : "bottom");
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 mt-0 md:mt-8">
      
      <div className="container mx-auto px-4 pb-4 md:pb-6">
        {/* 검색창 — 화면 최상단 핵심 요소 */}
        <StickySearchBar />

        {/* 모바일 필터 바 — 검색창 직하 요약형 */}
        <Sheet open={isMobileFilterOpen} onOpenChange={setIsMobileFilterOpen}>
          <div className="md:hidden flex items-center gap-1.5 px-1 py-1.5 overflow-x-auto border-b border-slate-800">
            <SheetTrigger asChild>
              <button className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border border-slate-700 text-slate-400 hover:bg-slate-800 transition-colors shrink-0">
                <SlidersHorizontal className="h-3 w-3" />
                필터
                {activeFilterCount > 0 && (
                  <span className="flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-blue-600 px-1 text-[9px] text-white font-medium">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </SheetTrigger>
            {searchCategory && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 shrink-0 bg-slate-800">
                {PRODUCT_CATEGORIES[searchCategory as keyof typeof PRODUCT_CATEGORIES] || searchCategory}
              </Badge>
            )}
            {searchBrand && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 shrink-0 max-w-[100px] truncate bg-slate-800">
                {searchBrand}
              </Badge>
            )}
            {sortBy !== "relevance" && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 shrink-0 bg-slate-800">
                {sortBy === "price_low" ? "가격↑" : sortBy === "price_high" ? "가격↓" : "납기순"}
              </Badge>
            )}
            {activeFilterCount === 0 && !hasSearched && (
              <span className="text-[10px] text-slate-400">제조사 · 카테고리 · 등급</span>
            )}
          </div>
          <SheetContent side="bottom" className="h-[75vh] overflow-y-auto">
            <div className="pt-2">
              <SearchPanel />
            </div>
          </SheetContent>
        </Sheet>

        {/* 2컬럼 레이아웃 — 좌측 필터는 검색 후에만 노출 */}
        <div className={`flex flex-col gap-4 ${hasSearched ? "md:grid md:gap-8 md:grid-cols-[260px_1fr]" : ""}`}>
        {/* 좌측: 검색 패널 (데스크탑 + 검색 후만) */}
        {hasSearched && (
        <aside className="hidden md:block">
          <div className="flex flex-col gap-4">
            <SearchPanel />
          </div>
        </aside>
        )}

        {/* 검색 결과 */}
        <section className="space-y-4 max-w-4xl mx-auto w-full">
          {/* 비교 중인 제품 바 */}
          {compareIds.length > 0 && (
            <Card className="border border-slate-800 bg-slate-900">
              <CardContent className="py-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <GitCompare className="h-4 w-4 text-indigo-600 flex-shrink-0" />
                    <span className="text-sm font-medium text-slate-100">
                      비교 중인 제품: {compareIds.length}개
                    </span>
                    <div className="flex items-center gap-1 flex-wrap">
                      {compareIds.map((id) => {
                        // products 배열에서 찾기
                        let product = products.find((p) => p.id === id);
                        // products에서 못 찾으면 quoteItems에서 찾기
                        if (!product) {
                          const quoteItem = quoteItems.find((item) => item.productId === id);
                          if (quoteItem) {
                            product = {
                              id: quoteItem.productId,
                              name: quoteItem.productName,
                              brand: quoteItem.brand,
                            };
                          }
                        }
                        // store에 저장된 메타 정보를 fallback으로 사용
                        const storedName = getStoredName(id);
                        const displayName = product?.name || product?.brand || storedName || "비교 대상";
                        return (
                          <Badge
                            key={id}
                            variant="secondary"
                            className="text-xs pr-1 cursor-pointer hover:bg-slate-700 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleCompare(id);
                            }}
                          >
                            <span className="text-xs font-medium leading-snug whitespace-nowrap max-w-[120px] truncate block" title={displayName}>
                              {displayName}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleCompare(id);
                              }}
                              className="ml-1 hover:bg-slate-600 rounded-full p-0.5"
                              aria-label="제거"
                            >
                              <X className="h-2.5 w-2.5" />
                            </button>
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs text-slate-500 hover:text-red-400 hover:bg-red-600/10"
                      onClick={() => clearCompare()}
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      전체 비우기
                    </Button>
                    <Link href="/test/compare" className="flex-1 sm:flex-none">
                      <Button size="sm" variant="default" className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700">
                        비교 보기 →
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 검색 결과 */}
          <div className="space-y-4">
            {/* 헤더: 검색 결과 개수 */}
            {products.length > 0 && (
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-100">검색 결과</h2>
                  <p className="text-sm text-slate-400 mt-1">
                    {products.length}개 제품 · 비교 후 견적 리스트에 담을 수 있습니다.
                  </p>
                </div>
              </div>
            )}

            {isSearchLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400 mb-3" />
                <p className="text-sm text-slate-400">검색 중...</p>
              </div>
            ) : products.length > 0 ? (
              <div className="space-y-3">
                  {/* AI 인사이트 카드 */}
                  {hasSearched && searchQuery && (
                    <AIInsightCard
                      query={searchQuery}
                      productCount={products.length}
                      isLoading={analysisLoading}
                      queryAnalysis={queryAnalysis}
                    />
                  )}

                  {/* 재고 운영 인사이트 — 로그인 사용자 + 검색 결과 존재 시 보조 레이어 */}
                  {session?.user && hasSearched && searchQuery && (
                    <div className="rounded-lg border border-slate-800 bg-slate-900 px-4 py-3">
                      <div className="flex items-center gap-2 mb-2.5">
                        <ClipboardList className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
                        <span className="text-xs font-semibold text-slate-400">재고 운영 연결</span>
                        <span className="text-[10px] text-slate-400">— 검색 품목을 운영 흐름과 연결하세요</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Link href={`/dashboard/inventory?q=${encodeURIComponent(searchQuery)}`}>
                          <button className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:border-slate-600 transition-colors">
                            <TrendingDown className="h-3 w-3 text-slate-500" />
                            재고 현황 확인
                          </button>
                        </Link>
                        <Link href="/test/quote">
                          <button className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-blue-500/30 bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 transition-colors">
                            <FileText className="h-3 w-3" />
                            견적 요청하기
                          </button>
                        </Link>
                        <Link href="/dashboard">
                          <button className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700 transition-colors">
                            <LayoutDashboard className="h-3 w-3 text-slate-500" />
                            운영 허브
                          </button>
                        </Link>
                      </div>
                    </div>
                  )}

                  {products.map((product) => {
                    const isInCompare = compareIds.includes(product.id);

                    return (
                      <SearchResultItem
                        key={product.id}
                        product={product}
                        isInCompare={isInCompare}
                        compareSessionCount={compareStatuses[product.id]?.activeCount}
                        onToggleCompare={() => toggleCompare(product.id, { name: product.name, brand: product.brand })}
                        onAddToQuote={() => handleProtectedAction(() => addProductToQuote(product))}
                        onClick={() => handleProtectedAction(() => {
                          setSelectedProduct(product);
                          setIsDetailOpen(true);
                        })}
                      />
                    );
                  })}
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center py-6 md:py-16 w-full max-w-3xl mx-auto px-4">
                  {!hasSearched ? (
                    <div className="hidden" />
                  ) : (
                    <div className="flex flex-col items-center text-center">
                      <Package className="h-8 w-8 text-slate-300 mb-3" strokeWidth={1.5} />
                      <p className="text-sm text-slate-400 mb-1">일치하는 제품이 없습니다.</p>
                      <p className="text-xs text-slate-400">품목명·제조사·CAS No.를 다시 확인해 보세요.</p>
                    </div>
                  )}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* 제품 상세 다이얼로그 */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedProduct && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedProduct.name}</DialogTitle>
                <DialogDescription>
                  {selectedProduct.vendors?.[0]?.vendor?.name || "벤더 정보 없음"}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Link href={`/products/${selectedProduct.id}`}>
                    <Button variant="outline" size="sm" className="text-xs">
                      상세 페이지 보기 →
                    </Button>
                  </Link>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* 미니 품목 바 (하단 고정) */}
      {quoteItems.length > 0 && (
        <div className="fixed bottom-4 left-1/2 z-40 w-full max-w-3xl -translate-x-1/2 px-2 sm:px-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-0 rounded-full border border-slate-700 bg-slate-900/95 px-3 sm:px-4 py-2 shadow-lg backdrop-blur">
            <p className="text-[10px] sm:text-xs text-slate-300 text-center sm:text-left">
              견적 요청 리스트 {quoteItems.length}개 · 합계 ₩{totalAmount.toLocaleString("ko-KR")}
            </p>
            <Sheet open={isQuoteSheetOpen} onOpenChange={setIsQuoteSheetOpen}>
              <SheetTrigger asChild>
                <Button size="sm" className="text-[10px] sm:text-xs w-full sm:w-auto">
                  견적 요청 리스트 열기({quoteItems.length})
                </Button>
              </SheetTrigger>
              <SheetContent 
                side={sheetSide}
                className={`w-full ${sheetSide === "right" ? "sm:max-w-lg lg:max-w-xl" : ""} flex flex-col p-0 ${sheetSide === "bottom" ? "h-[90vh]" : ""}`}
              >
                {/* 헤더: 타이틀 + 품목 개수 뱃지 */}
                <div className="flex items-center gap-2 pb-4 mb-4 border-b border-slate-800 px-6 pt-4">
                  <h2 className="text-lg font-bold tracking-tight text-slate-100">선택된 품목</h2>
                  <Badge variant="secondary" className="bg-blue-600/10 text-blue-400 rounded-full px-2.5">
                    {quoteItems.length}건
                  </Badge>
                </div>

                {/* 스크롤 가능한 아이템 리스트 */}
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                  {quoteItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Package className="h-12 w-12 text-slate-300 mb-4" />
                      <p className="text-sm font-medium text-slate-100 mb-1">리스트가 비어있습니다</p>
                      <p className="text-xs text-slate-500">
                        제품을 검색하고 "리스트에 담기"를 눌러보세요.
                      </p>
                    </div>
                  ) : (
                    quoteItems.map((item) => {
                      const product = products.find((p) => p.id === item.productId);
                      const vendor = product?.vendors?.[0];
                      const unitPrice = vendor?.priceInKRW || 0;
                      const lineTotal = item.lineTotal || 0;

                      return (
                        <div
                          key={item.id}
                          className="relative bg-slate-900 border border-slate-800 rounded-xl p-4 hover:shadow-md transition-all duration-200"
                        >
                          {/* 삭제 버튼 - 우측 상단 */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-3 right-3 h-6 w-6 text-slate-400 hover:text-red-400 hover:bg-red-600/10"
                            onClick={() => setItemToDelete(item.id)}
                            aria-label="품목 삭제"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>

                          {/* 제품 정보 - 좌측 */}
                          <div className="pr-8 mb-3">
                            <div className="font-semibold text-sm text-slate-100 leading-snug mb-1">
                              {product?.name || item.productName || "제품"}
                            </div>
                            {product?.vendors?.[0]?.vendor?.name && (
                              <div className="text-xs text-slate-500">
                                {product.vendors[0].vendor.name}
                              </div>
                            )}
                          </div>

                          {/* 수량 조절 및 가격 - 우측 하단 */}
                          <div className="flex items-center justify-between">
                            {/* 수량 조절기 */}
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-9 w-9 rounded-lg transition-colors flex-shrink-0"
                                onClick={() => {
                                  updateQuoteItem(item.id, { quantity: Math.max(1, (item.quantity || 1) - 1) });
                                }}
                                disabled={(item.quantity || 1) <= 1}
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                              <Input
                                type="number"
                                min="1"
                                value={item.quantity || 1}
                                onChange={(e) => {
                                  const qty = parseInt(e.target.value) || 1;
                                  updateQuoteItem(item.id, { quantity: Math.max(1, qty) });
                                }}
                                className="h-9 w-16 text-center text-sm font-medium p-0 border-slate-700 transition-all focus:ring-2 focus:ring-blue-500"
                                onClick={(e) => e.stopPropagation()}
                              />
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-9 w-9 rounded-lg transition-colors flex-shrink-0"
                                onClick={() => {
                                  updateQuoteItem(item.id, { quantity: (item.quantity || 1) + 1 });
                                }}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>

                            {/* 가격 정보 */}
                            <div className="text-right flex-shrink-0">
                              {unitPrice > 0 && (
                                <div className="text-xs text-slate-500 mb-1 whitespace-nowrap">
                                  단가: <PriceDisplay price={unitPrice} currency="KRW" />
                                </div>
                              )}
                              <div className="font-bold text-base text-blue-600 transition-all duration-200 whitespace-nowrap">
                                {lineTotal > 0 ? (
                                  <PriceDisplay price={lineTotal} currency="KRW" />
                                ) : (
                                  <span className="text-slate-400">-</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* 하단 고정 푸터 */}
                {quoteItems.length > 0 && (
                  <div className="border-t border-slate-800 bg-slate-900 px-6 py-4 space-y-3 sticky bottom-0">
                    {/* 총액 */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-400">Total</span>
                      <span className="text-xl font-bold text-blue-600 transition-all duration-200 whitespace-nowrap">
                        ₩{totalAmount.toLocaleString("ko-KR")}
                      </span>
                    </div>

                    {/* 견적서 작성 버튼 */}
                    <Link href="/test/quote" className="block">
                      <Button 
                        size="lg" 
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                        onClick={() => setIsQuoteSheetOpen(false)}
                      >
                        견적서 작성하러 가기 →
                      </Button>
                    </Link>
                  </div>
                )}
              </SheetContent>
            </Sheet>
          </div>
        </div>
      )}
      </div>

      {/* 삭제 확인 다이얼로그 */}
      <AlertDialog open={itemToDelete !== null} onOpenChange={(open) => !open && setItemToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>품목 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              이 품목을 리스트에서 삭제하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (itemToDelete) {
                  removeQuoteItem(itemToDelete);
                  setItemToDelete(null);
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 로그인 유도 모달 */}
      <Dialog open={isLoginPromptOpen} onOpenChange={setIsLoginPromptOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>로그인이 필요합니다</DialogTitle>
            <DialogDescription>
              상세보기와 견적 담기 기능을 이용하려면 로그인해 주세요.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 pt-2">
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700"
              onClick={handleLoginRedirect}
            >
              로그인하기
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setIsLoginPromptOpen(false)}
            >
              취소
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 하단 설명 — 데스크탑만 */}
      <div className="hidden md:block container mx-auto px-4 py-6">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs text-slate-500 text-center px-2">
            견적 리스트는 엑셀/TSV로 다운로드하여 이메일 공유나 전자결재에 활용할 수 있습니다.
          </p>
        </div>
      </div>
    </div>
  );
}

function StickySearchBar() {
  const { searchQuery, setSearchQuery, runSearch, hasSearched } = useTestFlow();
  const [localQuery, setLocalQuery] = useState(searchQuery);

  useEffect(() => {
    setLocalQuery(searchQuery);
  }, [searchQuery]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (localQuery.trim()) {
      setSearchQuery(localQuery);
      runSearch();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalQuery(value);
    setSearchQuery(value);
  };

  const handleChipClick = (term: string) => {
    setSearchQuery(term);
    setLocalQuery(term);
    runSearch();
  };

  return (
    <div className="w-full px-2 pt-3 pb-2 md:py-5 md:px-0 border-b border-slate-800 bg-slate-900 sticky top-0 z-10">
      <form onSubmit={handleSubmit} className="w-full max-w-3xl mx-auto">
        <div className="flex items-center border border-slate-700 rounded-lg bg-slate-800 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
          <div className="pl-3 md:pl-4 flex items-center pointer-events-none">
            <Search className="h-4 w-4 md:h-5 md:w-5 text-slate-400" />
          </div>
          <Input
            type="text"
            value={localQuery}
            onChange={handleChange}
            placeholder="시약명 / CAS No. / 제조사 / 카탈로그 번호"
            className="flex-1 h-12 px-3 md:px-4 text-sm md:text-[15px] border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-slate-400"
          />
          <Button
            type="submit"
            className="h-10 px-4 md:px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-semibold shrink-0 transition-colors mr-1"
            disabled={!localQuery.trim()}
          >
            <Search className="h-4 w-4 md:mr-1.5" />
            <span className="hidden md:inline">검색</span>
          </Button>
        </div>
      </form>

      {/* 검색 전: 안내 1줄 + 예시 칩 1줄 */}
      {!hasSearched && (
        <div className="max-w-3xl mx-auto mt-2 px-1 space-y-1.5">
          <p className="text-[10px] text-slate-400">
            시약명, CAS No., 제조사, 카탈로그 번호로 검색
          </p>
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[10px] font-medium text-slate-400 shrink-0 mr-0.5">예시</span>
            {["Tris-HCl", "Thermo Fisher", "A1234567", "67-66-3"].map((term) => (
              <button
                key={term}
                type="button"
                onClick={() => handleChipClick(term)}
                className="text-[10px] px-1.5 py-0.5 rounded-full border border-slate-700 bg-slate-800 text-slate-400 font-medium hover:border-blue-400 hover:bg-blue-600/10 hover:text-blue-400 active:scale-95 transition-all cursor-pointer"
              >
                {term}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}