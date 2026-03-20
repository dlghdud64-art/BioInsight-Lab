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
import { Loader2, ShoppingCart, GitCompare, X, Trash2, Plus, Minus, Search, FileText, Package, SlidersHorizontal, Clock, Upload, CheckCircle2, AlertTriangle, XCircle, Edit3 } from "lucide-react";
import Link from "next/link";
import { SearchResultItem } from "../_components/search-result-item";
import { SourcingResultRow } from "../_components/sourcing-result-row";
import { SourcingContextRail } from "../_components/sourcing-context-rail";
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
    setSearchQuery,
    runSearch,
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
  const [railProduct, setRailProduct] = useState<any>(null);
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
    <div className="min-h-screen bg-pg mt-0 md:mt-8">
      
      <div className="container mx-auto px-4 pb-4 md:pb-6">
        {/* 검색창 — 화면 최상단 핵심 요소 */}
        <StickySearchBar />

        {/* 모바일 필터 바 — 검색창 직하 요약형 */}
        <Sheet open={isMobileFilterOpen} onOpenChange={setIsMobileFilterOpen}>
          <div className="md:hidden flex items-center gap-1.5 px-1 py-1.5 overflow-x-auto border-b border-bd">
            <SheetTrigger asChild>
              <button className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border border-bs text-slate-400 hover:bg-el transition-colors shrink-0">
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
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 shrink-0 bg-el">
                {PRODUCT_CATEGORIES[searchCategory as keyof typeof PRODUCT_CATEGORIES] || searchCategory}
              </Badge>
            )}
            {searchBrand && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 shrink-0 max-w-[100px] truncate bg-el">
                {searchBrand}
              </Badge>
            )}
            {sortBy !== "relevance" && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 shrink-0 bg-el">
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

        {/* 워크벤치 레이아웃 — 좌측 필터 + 중앙 결과 + 우측 rail */}
        <div className={`flex flex-col gap-4 ${hasSearched ? "md:grid md:gap-4 md:grid-cols-[220px_1fr]" : ""} ${hasSearched && railProduct ? "lg:grid-cols-[220px_1fr_340px]" : ""}`}>
        {/* 좌측: 검색 패널 (데스크탑 + 검색 후만) */}
        {hasSearched && (
        <aside className="hidden md:block">
          <div className="flex flex-col gap-4 sticky top-4">
            <SearchPanel />
          </div>
        </aside>
        )}

        {/* 중앙: 검색 결과 리스트 */}
        <section className="space-y-3 w-full min-w-0">
          {/* 비교 트레이 — compact strip */}
          {compareIds.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-bd bg-el">
              <GitCompare className="h-3.5 w-3.5 text-blue-400 shrink-0" />
              <span className="text-xs font-medium text-slate-300 shrink-0">
                비교 {compareIds.length}건
              </span>
              <div className="flex items-center gap-1 flex-1 overflow-x-auto min-w-0">
                {compareIds.map((id) => {
                  let product = products.find((p: any) => p.id === id);
                  if (!product) {
                    const quoteItem = quoteItems.find((item: any) => item.productId === id);
                    if (quoteItem) {
                      product = { id: quoteItem.productId, name: quoteItem.productName, brand: quoteItem.brand };
                    }
                  }
                  const storedName = getStoredName(id);
                  const displayName = product?.name || product?.brand || storedName || "비교 대상";
                  return (
                    <Badge
                      key={id}
                      variant="secondary"
                      className="text-[10px] pr-1 cursor-pointer hover:bg-st transition-colors shrink-0 bg-pn"
                      onClick={(e: React.MouseEvent) => { e.stopPropagation(); toggleCompare(id); }}
                    >
                      <span className="max-w-[80px] truncate">{displayName}</span>
                      <X className="h-2.5 w-2.5 ml-1 opacity-60" />
                    </Badge>
                  );
                })}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-1.5 text-[10px] text-slate-500 hover:text-red-400"
                  onClick={() => clearCompare()}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
                <Link href="/test/compare">
                  <Button size="sm" className="h-6 px-2.5 text-[10px] bg-blue-600 hover:bg-blue-500 text-white">
                    비교 보기 →
                  </Button>
                </Link>
              </div>
            </div>
          )}

          {/* 검색 결과 헤더 */}
          {products.length > 0 && (
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-slate-100">소싱 후보</h2>
                <span className="text-xs text-slate-500">{products.length}건</span>
              </div>
              {session?.user && searchQuery && (
                <div className="flex items-center gap-1.5">
                  <Link href={`/dashboard/inventory?q=${encodeURIComponent(searchQuery)}`}>
                    <button className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded border border-bd bg-el text-slate-400 hover:bg-st transition-colors">
                      <TrendingDown className="h-3 w-3" />
                      재고 확인
                    </button>
                  </Link>
                  <Link href="/test/quote">
                    <button className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded border border-blue-600/30 bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 transition-colors">
                      <FileText className="h-3 w-3" />
                      견적 요청
                    </button>
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* AI 인사이트 — compact */}
          {hasSearched && searchQuery && products.length > 0 && (
            <AIInsightCard
              query={searchQuery}
              productCount={products.length}
              isLoading={analysisLoading}
              queryAnalysis={queryAnalysis}
            />
          )}

          {/* 결과 리스트 */}
          {isSearchLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400 mb-2" />
              <p className="text-xs text-slate-400">검색 중...</p>
            </div>
          ) : products.length > 0 ? (
            <div className="space-y-1">
              {products.map((product: any) => {
                const isInCompare = compareIds.includes(product.id);
                return (
                  <SourcingResultRow
                    key={product.id}
                    product={product}
                    isInCompare={isInCompare}
                    isSelected={railProduct?.id === product.id}
                    compareSessionCount={compareStatuses[product.id]?.activeCount}
                    onToggleCompare={() => toggleCompare(product.id, { name: product.name, brand: product.brand })}
                    onAddToQuote={() => handleProtectedAction(() => addProductToQuote(product))}
                    onSelect={() => handleProtectedAction(() => setRailProduct(product))}
                  />
                );
              })}
            </div>
          ) : hasSearched ? (
            <div className="flex flex-col items-center text-center rounded-lg border border-dashed border-bd bg-el px-6 py-8">
              <Package className="h-7 w-7 text-slate-500 mb-2" strokeWidth={1.5} />
              <p className="text-sm text-slate-300 mb-1">검색 결과가 없습니다</p>
              <p className="text-xs text-slate-500 mb-3">다른 키워드로 검색해보세요</p>
              <div className="flex items-center gap-1.5 flex-wrap justify-center mb-4">
                {["Trypsin", "FBS", "DMEM", "Tris-HCl", "67-66-3"].map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => { setSearchQuery(term); runSearch(); }}
                    className="text-xs px-2.5 py-1 rounded-md bg-pn border border-bd text-slate-400 hover:bg-st hover:text-slate-300 active:scale-95 transition-all cursor-pointer"
                  >
                    {term}
                  </button>
                ))}
              </div>
              <Link href="/protocol/bom" className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors">
                <FileText className="h-3.5 w-3.5" />
                텍스트 붙여넣기로 BOM 등록하기
              </Link>
            </div>
          ) : null}
        </section>

        {/* 우측: Context Rail — 제품 선택 시 데스크탑만 */}
        {hasSearched && railProduct && (
          <aside className="hidden lg:block">
            <div className="sticky top-4 bg-pn border border-bd rounded-lg overflow-hidden max-h-[calc(100vh-8rem)]">
              <SourcingContextRail
                product={railProduct}
                isInCompare={compareIds.includes(railProduct.id)}
                onToggleCompare={() => toggleCompare(railProduct.id, { name: railProduct.name, brand: railProduct.brand })}
                onAddToQuote={() => handleProtectedAction(() => addProductToQuote(railProduct))}
                onClose={() => setRailProduct(null)}
                searchQuery={searchQuery}
              />
            </div>
          </aside>
        )}
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
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-0 rounded-full border border-bs bg-pn/95 px-3 sm:px-4 py-2 shadow-lg backdrop-blur">
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
                <div className="flex items-center gap-2 pb-4 mb-4 border-b border-bd px-6 pt-4">
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
                          className="relative bg-pn border border-bd rounded-xl p-4 hover:shadow-md transition-all duration-200"
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
                                className="h-9 w-16 text-center text-sm font-medium p-0 border-bs transition-all focus:ring-2 focus:ring-blue-500"
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
                  <div className="border-t border-bd bg-pn px-6 py-4 space-y-3 sticky bottom-0">
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
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [inputMode, setInputMode] = useState<"search" | "excel" | "protocol">("search");
  const [excelUploaded, setExcelUploaded] = useState(false);
  const [protocolUploaded, setProtocolUploaded] = useState(false);

  useEffect(() => {
    setLocalQuery(searchQuery);
  }, [searchQuery]);

  // 최근 검색 로드
  useEffect(() => {
    try {
      const stored = localStorage.getItem("bioinsight-recent-searches");
      if (stored) setRecentSearches(JSON.parse(stored));
    } catch {}
  }, []);

  const saveRecentSearch = (term: string) => {
    const updated = [term, ...recentSearches.filter((s) => s !== term)].slice(0, 5);
    setRecentSearches(updated);
    try {
      localStorage.setItem("bioinsight-recent-searches", JSON.stringify(updated));
    } catch {}
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (localQuery.trim()) {
      setSearchQuery(localQuery);
      saveRecentSearch(localQuery.trim());
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
    saveRecentSearch(term);
    runSearch();
  };

  const recognizedFields = [
    "시약명",
    "CAS No.",
    "제조사",
    "카탈로그 번호",
    "Lot No.",
  ];

  const exampleQueries = [
    "Trypsin",
    "Fetal Bovine Serum",
    "A1234567",
    "Tris-HCl",
    "67-66-3",
  ];

  const modeTabs: { key: "search" | "excel" | "protocol"; label: string }[] = [
    { key: "search", label: "직접 검색" },
    { key: "excel", label: "엑셀 업로드 해석" },
    { key: "protocol", label: "프로토콜 업로드 해석" },
  ];

  return (
    <div className="w-full pt-4 pb-2 md:pt-6 md:pb-4 sticky top-0 z-10">
      {/* Search workbench panel */}
      <div className="bg-el border border-bd rounded-xl p-5 md:p-8 max-w-3xl mx-auto">
        {/* 입력 모드 스위처 */}
        <div className="bg-el rounded-lg p-1 flex gap-1 mb-4">
          {modeTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setInputMode(tab.key)}
              className={`flex-1 text-xs sm:text-sm font-medium px-3 py-2 rounded-md transition-colors ${
                inputMode === tab.key
                  ? "bg-pn text-slate-100"
                  : "text-slate-400 hover:text-slate-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 직접 검색 모드 */}
        {inputMode === "search" && (
          <>
            {/* Helper text */}
            <p className="text-xs text-slate-500 mb-3 hidden md:block">
              제품명, 제조사, 카탈로그 번호 기준으로 검색하고 비교 리스트에 담을 수 있습니다.
            </p>
            {/* Command search bar */}
            <form onSubmit={handleSubmit} className="w-full">
              <div className="flex items-center bg-pn border border-bs rounded-lg focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all shadow-sm">
                <div className="pl-4 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-slate-300" />
                </div>
                <Input
                  type="text"
                  value={localQuery}
                  onChange={handleChange}
                  placeholder="시약명 / CAS No. / 제조사 / 카탈로그 번호로 검색"
                  className="flex-1 h-14 px-4 text-[15px] md:text-base border-0 rounded-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-slate-500"
                />
                <Button
                  type="submit"
                  className="h-10 px-6 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold shrink-0 transition-colors mr-2"
                  disabled={!localQuery.trim()}
                >
                  <Search className="h-4 w-4 md:mr-2" />
                  <span className="hidden md:inline">검색 시작</span>
                </Button>
              </div>
            </form>

            {/* 검색 하단 컨텍스트 영역 — 검색 전에만 표시 */}
            {!hasSearched && (
              <div className="mt-4 space-y-3">
                {/* 인식 가능 필드 뱃지 */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] text-slate-500 shrink-0 mr-0.5">인식 필드</span>
                  {recognizedFields.map((field) => (
                    <span
                      key={field}
                      className="bg-st text-slate-400 rounded-md px-2 py-0.5 text-xs"
                    >
                      {field}
                    </span>
                  ))}
                </div>

                {/* 빠른 예시 쿼리 */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] text-slate-500 shrink-0 mr-0.5">예시</span>
                  {exampleQueries.map((term) => (
                    <button
                      key={term}
                      type="button"
                      onClick={() => handleChipClick(term)}
                      className="text-xs px-2 py-0.5 rounded-md bg-pn border border-bd text-slate-400 hover:bg-el hover:text-slate-300 active:scale-95 transition-all cursor-pointer"
                    >
                      {term}
                    </button>
                  ))}
                </div>

                {/* 최근 검색 */}
                {recentSearches.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Clock className="h-3 w-3 text-slate-500 shrink-0" />
                    <span className="text-[11px] text-slate-500 shrink-0 mr-0.5">최근</span>
                    {recentSearches.map((term) => (
                      <button
                        key={term}
                        type="button"
                        onClick={() => handleChipClick(term)}
                        className="text-xs px-2 py-0.5 rounded-md text-slate-400 hover:bg-el hover:text-slate-300 active:scale-95 transition-all cursor-pointer"
                      >
                        {term}
                      </button>
                    ))}
                  </div>
                )}

                {/* 운영 흐름 연결 */}
                <div className="flex items-center gap-2 pt-2 border-t border-bd mt-1">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider shrink-0">바로가기</span>
                  <Link href="/dashboard/inventory" className="text-xs text-slate-400 hover:text-slate-200 transition-colors">재고 현황 확인</Link>
                  <span className="text-slate-600">·</span>
                  <Link href="/test/compare" className="text-xs text-slate-400 hover:text-slate-200 transition-colors">비교 리스트 보기</Link>
                  <span className="text-slate-600">·</span>
                  <Link href="/test/quote" className="text-xs text-slate-400 hover:text-slate-200 transition-colors">견적 요청으로 이동</Link>
                </div>
              </div>
            )}
          </>
        )}

        {/* 엑셀 업로드 해석 모드 */}
        {inputMode === "excel" && (
          <div className="space-y-4">
            {!excelUploaded ? (
              <>
                <div
                  className="bg-el border-2 border-dashed border-bd rounded-xl p-8 text-center cursor-pointer hover:border-blue-500/40 transition-colors"
                  onClick={() => setExcelUploaded(true)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); setExcelUploaded(true); }}
                >
                  <Upload className="h-8 w-8 text-slate-400 mx-auto mb-3" />
                  <p className="text-sm font-medium text-slate-200 mb-1">발주표 또는 재고표를 업로드하세요</p>
                  <p className="text-xs text-slate-400 mb-3">Excel/CSV 파일에서 품목명, 제조사, 카탈로그 번호, 수량을 자동으로 추출합니다.</p>
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <Badge variant="secondary" className="text-[10px] bg-st text-slate-400">.xlsx</Badge>
                    <Badge variant="secondary" className="text-[10px] bg-st text-slate-400">.csv</Badge>
                  </div>
                  <Button type="button" className="bg-blue-600 hover:bg-blue-500 text-white text-sm">
                    파일 선택
                  </Button>
                </div>
                <p className="text-[11px] text-slate-500 text-center">
                  AI가 컬럼을 자동 인식하고, 후보 제품을 매칭합니다. 승인 전 자동 구매는 발생하지 않습니다.
                </p>
              </>
            ) : (
              <ExcelUploadResult onReset={() => setExcelUploaded(false)} />
            )}
          </div>
        )}

        {/* 프로토콜 업로드 해석 모드 */}
        {inputMode === "protocol" && (
          <div className="space-y-4">
            {!protocolUploaded ? (
              <>
                <div
                  className="bg-el border-2 border-dashed border-bd rounded-xl p-8 text-center cursor-pointer hover:border-blue-500/40 transition-colors"
                  onClick={() => setProtocolUploaded(true)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); setProtocolUploaded(true); }}
                >
                  <FileText className="h-8 w-8 text-slate-400 mx-auto mb-3" />
                  <p className="text-sm font-medium text-slate-200 mb-1">실험 프로토콜 문서를 업로드하세요</p>
                  <p className="text-xs text-slate-400 mb-3">PDF/DOCX에서 필요 시약과 소모품을 자동 추출하고, 기존 재고와 비교합니다.</p>
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <Badge variant="secondary" className="text-[10px] bg-st text-slate-400">.pdf</Badge>
                    <Badge variant="secondary" className="text-[10px] bg-st text-slate-400">.docx</Badge>
                  </div>
                  <Button type="button" className="bg-blue-600 hover:bg-blue-500 text-white text-sm">
                    파일 선택
                  </Button>
                </div>
                <p className="text-[11px] text-slate-500 text-center">
                  추출 결과를 검토한 뒤 부족 품목만 견적 요청할 수 있습니다.
                </p>
              </>
            ) : (
              <ProtocolUploadResult onReset={() => setProtocolUploaded(false)} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* 엑셀 업로드 결과 (mock) */
function ExcelUploadResult({ onReset }: { onReset: () => void }) {
  const mockData = [
    { id: 1, raw: "PBS buffer 1X, 500ml", extracted: "PBS Buffer 1X 500mL", candidate: "Gibco PBS pH 7.4", confidence: "high" as const, status: "확정 가능" },
    { id: 2, raw: "FBS 소혈청 500ml", extracted: "Fetal Bovine Serum 500mL", candidate: "Gibco FBS (16000-044)", confidence: "medium" as const, status: "검토 필요" },
    { id: 3, raw: "트립신 0.25%", extracted: "Trypsin-EDTA 0.25%", candidate: "Gibco Trypsin-EDTA", confidence: "high" as const, status: "확정 가능" },
  ];

  const confidenceBadge = (c: "high" | "medium" | "low") => {
    if (c === "high") return <Badge className="bg-emerald-600/15 text-emerald-400 border-0 text-[10px]"><CheckCircle2 className="h-3 w-3 mr-1" />확정 가능</Badge>;
    if (c === "medium") return <Badge className="bg-amber-600/15 text-amber-400 border-0 text-[10px]"><AlertTriangle className="h-3 w-3 mr-1" />검토 필요</Badge>;
    return <Badge className="bg-red-600/15 text-red-400 border-0 text-[10px]"><XCircle className="h-3 w-3 mr-1" />매칭 실패</Badge>;
  };

  return (
    <div className="space-y-3">
      {/* 요약 */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-300">
          <span className="font-semibold text-slate-100">3건</span> 추출됨 · <span className="text-emerald-400">2건</span> 확정 가능 · <span className="text-amber-400">1건</span> 검토 필요
        </p>
        <button onClick={onReset} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">다시 업로드</button>
      </div>

      {/* 테이블 */}
      <div className="border border-bd rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-sh text-slate-400 border-b border-bd">
                <th className="text-left px-3 py-2 font-medium">원문</th>
                <th className="text-left px-3 py-2 font-medium">추출값</th>
                <th className="text-left px-3 py-2 font-medium">추천 후보</th>
                <th className="text-left px-3 py-2 font-medium">상태</th>
                <th className="text-left px-3 py-2 font-medium w-10"></th>
              </tr>
            </thead>
            <tbody>
              {mockData.map((row) => (
                <tr key={row.id} className="border-b border-bd last:border-0 hover:bg-sh/50 transition-colors">
                  <td className="px-3 py-2.5 text-slate-400 max-w-[140px] truncate">{row.raw}</td>
                  <td className="px-3 py-2.5 text-slate-200 font-medium">{row.extracted}</td>
                  <td className="px-3 py-2.5 text-slate-300">{row.candidate}</td>
                  <td className="px-3 py-2.5">{confidenceBadge(row.confidence)}</td>
                  <td className="px-3 py-2.5">
                    <button className="text-slate-500 hover:text-slate-300 transition-colors" title="수정">
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 하단 CTA */}
      <Button className="w-full bg-blue-600 hover:bg-blue-500 text-white text-sm">
        승인된 항목을 비교 리스트에 담기
      </Button>
    </div>
  );
}

/* 프로토콜 업로드 결과 (mock) */
function ProtocolUploadResult({ onReset }: { onReset: () => void }) {
  const mockData = [
    { id: 1, item: "PBS Buffer 1X", needed: "2L", stock: "5L", status: "보유" as const },
    { id: 2, item: "Fetal Bovine Serum", needed: "500mL", stock: "500mL", status: "보유" as const },
    { id: 3, item: "Trypsin-EDTA 0.25%", needed: "200mL", stock: "100mL", status: "부족" as const },
    { id: 4, item: "DMEM High Glucose", needed: "1L", stock: "1L", status: "보유" as const },
    { id: 5, item: "Collagenase Type IV", needed: "100mg", stock: "-", status: "미등록" as const },
  ];

  const statusBadge = (s: "보유" | "부족" | "미등록") => {
    if (s === "보유") return <Badge className="bg-emerald-600/15 text-emerald-400 border-0 text-[10px]">보유</Badge>;
    if (s === "부족") return <Badge className="bg-amber-600/15 text-amber-400 border-0 text-[10px]">부족</Badge>;
    return <Badge className="bg-red-600/15 text-red-400 border-0 text-[10px]">미등록</Badge>;
  };

  return (
    <div className="space-y-3">
      {/* 요약 */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-300">
          <span className="font-semibold text-slate-100">5건</span> 추출됨 · <span className="text-emerald-400">3건</span> 재고 보유 · <span className="text-amber-400">2건</span> 부족
        </p>
        <button onClick={onReset} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">다시 업로드</button>
      </div>

      {/* 테이블 */}
      <div className="border border-bd rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-sh text-slate-400 border-b border-bd">
                <th className="text-left px-3 py-2 font-medium">추출 품목</th>
                <th className="text-left px-3 py-2 font-medium">필요량</th>
                <th className="text-left px-3 py-2 font-medium">현재 재고</th>
                <th className="text-left px-3 py-2 font-medium">상태</th>
                <th className="text-left px-3 py-2 font-medium">액션</th>
              </tr>
            </thead>
            <tbody>
              {mockData.map((row) => (
                <tr key={row.id} className="border-b border-bd last:border-0 hover:bg-sh/50 transition-colors">
                  <td className="px-3 py-2.5 text-slate-200 font-medium">{row.item}</td>
                  <td className="px-3 py-2.5 text-slate-300">{row.needed}</td>
                  <td className="px-3 py-2.5 text-slate-400">{row.stock}</td>
                  <td className="px-3 py-2.5">{statusBadge(row.status)}</td>
                  <td className="px-3 py-2.5">
                    {(row.status === "부족" || row.status === "미등록") && (
                      <button className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors whitespace-nowrap">
                        견적 요청 추가
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 하단 CTA */}
      <Button className="w-full bg-blue-600 hover:bg-blue-500 text-white text-sm">
        부족 품목을 견적 요청에 담기
      </Button>
    </div>
  );
}