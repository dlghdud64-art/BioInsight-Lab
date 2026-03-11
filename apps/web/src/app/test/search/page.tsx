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
import { Loader2, ShoppingCart, GitCompare, X, Trash2, Plus, Minus, Search, FileText, Package, Flame } from "lucide-react";
import Link from "next/link";
import { SearchResultItem } from "../_components/search-result-item";
import { PageHeader } from "@/app/_components/page-header";
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
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
  } = useTestFlow();
  const { data: session } = useSession();
  const router = useRouter();
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isQuoteSheetOpen, setIsQuoteSheetOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [sheetSide, setSheetSide] = useState<"bottom" | "right">("bottom");
  const [isLoginPromptOpen, setIsLoginPromptOpen] = useState(false);

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
    <div className="min-h-screen bg-gray-50/50 mt-8">
      
      {/* 2컬럼 레이아웃 */}
      <div className="container mx-auto px-4 pb-4 md:pb-6">
        <div className="flex flex-col gap-4 md:grid md:gap-8 md:grid-cols-[260px_1fr]">
        {/* 좌측: 검색 패널 + 옵션 */}
        <aside className="order-1 md:order-none">
          <div className="flex flex-col gap-4">
            <SearchPanel />
          </div>
        </aside>

        {/* 가운데: 검색 결과 */}
        <section className="order-3 md:order-none space-y-4 max-w-4xl mx-auto w-full pt-16">
          {/* 상단 고정 검색창 */}
          <StickySearchBar />
          
          {/* 비교 중인 제품 바 */}
          {compareIds.length > 0 && (
            <Card className="border border-slate-200 bg-white">
              <CardContent className="py-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <GitCompare className="h-4 w-4 text-indigo-600 flex-shrink-0" />
                    <span className="text-sm font-medium text-slate-900">
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
                        // 내부 slug/key가 UI에 노출되지 않도록 안전한 fallback 사용
                        const displayName = product?.name || product?.brand || "비교 대상";
                        return (
                          <Badge
                            key={id}
                            variant="secondary"
                            className="text-xs pr-1 cursor-pointer hover:bg-slate-200 transition-colors"
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
                              className="ml-1 hover:bg-slate-300 rounded-full p-0.5"
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
                      className="text-xs text-slate-500 hover:text-red-600 hover:bg-red-50"
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
                  <h2 className="text-xl font-bold text-gray-900">검색 결과</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {products.length}개 제품 · 비교 후 견적 리스트에 담을 수 있습니다.
                  </p>
                </div>
              </div>
            )}

            {isSearchLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400 mb-3" />
                <p className="text-sm text-slate-600">검색 중...</p>
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
                    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                      <div className="flex items-center gap-2 mb-2.5">
                        <ClipboardList className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
                        <span className="text-xs font-semibold text-slate-600">재고 운영 연결</span>
                        <span className="text-[10px] text-slate-400">— 검색 품목을 운영 흐름과 연결하세요</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Link href={`/dashboard/inventory?q=${encodeURIComponent(searchQuery)}`}>
                          <button className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition-colors">
                            <TrendingDown className="h-3 w-3 text-slate-500" />
                            재고 현황 확인
                          </button>
                        </Link>
                        <Link href="/test/quote">
                          <button className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors">
                            <FileText className="h-3 w-3" />
                            견적 요청하기
                          </button>
                        </Link>
                        <Link href="/dashboard">
                          <button className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors">
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
                        onToggleCompare={() => toggleCompare(product.id)}
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
              <div className="flex h-full flex-col items-center justify-center py-16 md:py-20 w-full max-w-3xl mx-auto px-4">
                  {!hasSearched ? (
                    <div className="hidden md:flex flex-col items-center text-center">
                      <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-5">
                        <Search className="h-8 w-8 text-slate-400" strokeWidth={1.5} />
                      </div>
                      <h3 className="text-lg font-semibold text-slate-800 mb-2">시약·장비를 검색해 비교를 시작하세요</h3>
                      <p className="text-sm text-slate-500 leading-relaxed max-w-sm mb-6">
                        제품명, CAS No., 제조사로 검색하면 비교·견적 요청까지 이어갈 수 있습니다.
                      </p>
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span className="px-2 py-1 rounded bg-slate-100">검색 → 비교</span>
                        <span>→</span>
                        <span className="px-2 py-1 rounded bg-slate-100">견적 요청</span>
                        <span>→</span>
                        <span className="px-2 py-1 rounded bg-slate-100">재고 등록</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-center">
                      <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                        <Package className="h-7 w-7 text-slate-400" strokeWidth={1.5} />
                      </div>
                      <h3 className="text-base font-semibold text-slate-800 mb-1">검색 결과를 찾지 못했습니다</h3>
                      <p className="text-sm text-slate-500 mb-5 max-w-xs leading-relaxed break-keep">
                        검색어를 더 구체적으로 입력하거나 제조사 기준으로 다시 시도해 보세요.
                      </p>
                      <div className="flex flex-col gap-2 w-full max-w-xs text-left">
                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">다음 방법을 시도해 보세요</p>
                        <div className="space-y-1.5 text-xs text-slate-600">
                          <div className="flex items-start gap-2"><span className="mt-0.5 text-slate-400">·</span> 유사 품목명 또는 카테고리 키워드로 재검색</div>
                          <div className="flex items-start gap-2"><span className="mt-0.5 text-slate-400">·</span> 제조사명 단독으로 검색 (예: Thermo Fisher)</div>
                          <div className="flex items-start gap-2"><span className="mt-0.5 text-slate-400">·</span> CAS No. 또는 카탈로그 번호 직접 입력</div>
                        </div>
                      </div>
                      {session?.user && (
                        <div className="mt-5 flex items-center gap-2">
                          <Link href="/dashboard/inventory">
                            <button className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors">
                              <LayoutDashboard className="h-3 w-3" />
                              재고 관리 이동
                            </button>
                          </Link>
                        </div>
                      )}
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
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-0 rounded-full border border-slate-200 bg-white/95 px-3 sm:px-4 py-2 shadow-lg backdrop-blur">
            <p className="text-[10px] sm:text-xs text-slate-700 text-center sm:text-left">
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
                <div className="flex items-center gap-2 pb-4 mb-4 border-b border-slate-100 px-6 pt-4">
                  <h2 className="text-lg font-bold tracking-tight text-slate-900">선택된 품목</h2>
                  <Badge variant="secondary" className="bg-blue-100 text-blue-700 rounded-full px-2.5">
                    {quoteItems.length}건
                  </Badge>
                </div>

                {/* 스크롤 가능한 아이템 리스트 */}
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                  {quoteItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Package className="h-12 w-12 text-slate-300 mb-4" />
                      <p className="text-sm font-medium text-slate-900 mb-1">리스트가 비어있습니다</p>
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
                          className="relative bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md transition-all duration-200"
                        >
                          {/* 삭제 버튼 - 우측 상단 */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-3 right-3 h-6 w-6 text-slate-400 hover:text-red-500 hover:bg-red-50"
                            onClick={() => setItemToDelete(item.id)}
                            aria-label="품목 삭제"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>

                          {/* 제품 정보 - 좌측 */}
                          <div className="pr-8 mb-3">
                            <div className="font-semibold text-sm text-slate-900 leading-snug mb-1">
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
                                className="h-9 w-9 rounded-lg transition-all hover:scale-110 active:scale-95 flex-shrink-0"
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
                                className="h-9 w-16 text-center text-sm font-medium p-0 border-slate-300 transition-all focus:ring-2 focus:ring-blue-500"
                                onClick={(e) => e.stopPropagation()}
                              />
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-9 w-9 rounded-lg transition-all hover:scale-110 active:scale-95 flex-shrink-0"
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
                  <div className="border-t bg-white px-6 py-4 space-y-3 sticky bottom-0">
                    {/* 총액 */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Total</span>
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

      {/* 하단 설명 */}
      <div className="container mx-auto px-4 py-4 md:py-6">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs text-slate-500 text-center px-2 hidden sm:block">
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
  const router = useRouter();

  // 좌측 사이드바의 searchQuery와 동기화
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
    // 좌측 사이드바의 searchQuery도 즉시 업데이트
    setSearchQuery(value);
  };

  const popularSearches = ["FBS", "Pipette", "Conical Tube", "Centrifuge", "DMEM", "Trypsin"];

  return (
    <div className="w-full p-6 border-b bg-white/95 backdrop-blur sticky top-0 z-10 shadow-sm">
      <form onSubmit={handleSubmit} className="w-full max-w-3xl mx-auto">
        <div className="flex items-center gap-2 bg-white rounded-full border-2 border-slate-300 shadow-lg hover:shadow-xl transition-all focus-within:border-blue-500 focus-within:shadow-blue-500/20">
          <Input
            type="text"
            value={localQuery}
            onChange={handleChange}
            placeholder="시약명, CAS No., 제조사 검색"
            className="flex-1 h-10 md:h-14 px-4 md:px-6 text-base md:text-lg border-0 rounded-full focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          <Button
            type="submit"
            size="lg"
            className="h-8 md:h-12 px-4 md:px-8 bg-blue-600 hover:bg-blue-700 text-white rounded-full mr-1 my-1 font-semibold text-sm md:text-base"
            disabled={!localQuery.trim()}
          >
            <Search className="h-5 w-5 mr-2" />
            검색
          </Button>
        </div>
        {/* 헬퍼 텍스트 */}
        <p className="mt-2 text-center text-xs text-slate-400 max-w-2xl mx-auto hidden sm:block">
          검색 결과를 비교 후보에 담고, 견적 요청까지 이어갈 수 있습니다.
        </p>
      </form>

      {/* 추천 키워드 칩 */}
      {!hasSearched && (
        <div className="flex flex-wrap items-center justify-center gap-2 mt-6 max-w-3xl mx-auto">
          <span className="text-sm text-slate-500 font-medium flex items-center gap-1">
            <Flame className="h-4 w-4 text-slate-500" />
            추천:
          </span>
          {popularSearches.map((term) => (
            <Badge
              key={term}
              variant="secondary"
              className="cursor-pointer hover:bg-blue-100 hover:text-blue-700 transition-colors px-3 py-1.5 text-sm font-medium"
              onClick={() => {
                setLocalQuery(term);
                setSearchQuery(term);
                runSearch();
              }}
            >
              #{term}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}