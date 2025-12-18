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
import { Loader2, ShoppingCart, GitCompare, X, Trash2, Plus, Minus, Search } from "lucide-react";
import Link from "next/link";
import { SearchResultItem } from "../_components/search-result-item";
import { PageHeader } from "@/app/_components/page-header";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  } = useTestFlow();
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isQuoteSheetOpen, setIsQuoteSheetOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  const totalAmount = quoteItems.reduce((sum, item) => sum + (item.lineTotal || 0), 0);

  return (
    <>
      <div className="container mx-auto px-4 py-3 md:py-6">
        <PageHeader
          title="바이오 시약·장비 검색과 비교, 한 번에 정리되는 견적 요청 리스트"
          description={
            <div className="space-y-1 hidden md:block">
              <p>제품명, 벤더, 카테고리를 검색하고 GPT가 관련 제품을 추천해 줍니다.</p>
              <p>검색 결과에서 필요한 제품을 선택하면, 견적 요청 리스트가 자동으로 정리됩니다.</p>
            </div>
          }
          icon={Search}
          iconColor="text-blue-600"
          badge={
            <div className="inline-flex items-center gap-2 px-2 md:px-3 py-1 md:py-1.5 rounded-lg bg-blue-50 border border-blue-200">
              <Badge variant="outline" className="text-[10px] bg-blue-100 border-blue-300 text-blue-700 px-1.5 py-0">
                기능 체험
              </Badge>
              <span className="text-[10px] text-blue-700 font-medium whitespace-nowrap hidden sm:inline">
                지금은 Beta - 무료로 모든 기능을 체험해 보세요
              </span>
            </div>
          }
        />
      </div>
      
      {/* 2컬럼 레이아웃 */}
      <div className="container mx-auto px-4 py-4 md:py-6">
        <div className="flex flex-col gap-4 md:grid md:gap-6 md:grid-cols-[260px_1fr]">
        {/* 좌측: 검색 패널 + 옵션 */}
        <aside className="order-1 md:order-none">
          <div className="flex flex-col gap-4">
            <SearchPanel />
          </div>
        </aside>

        {/* 가운데: 검색 결과 */}
        <section className="order-3 md:order-none space-y-4 max-w-3xl mx-auto w-full">
          {/* 비교 중인 제품 바 */}
          {compareIds.length > 0 && (
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="py-2 sm:py-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <GitCompare className="h-4 w-4 text-blue-600 flex-shrink-0" />
                    <span className="text-xs sm:text-sm font-medium text-blue-900">
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
                        const displayName = product?.name || product?.brand || `제품 ${id}`;
                        return (
                          <Badge
                            key={id}
                            variant="secondary"
                            className="text-[10px] pr-1 cursor-pointer hover:bg-slate-300 transition-colors"
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
                              className="ml-1 hover:bg-slate-400 rounded-full p-0.5"
                              aria-label="제거"
                            >
                              <X className="h-2.5 w-2.5" />
                            </button>
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                  <Link href="/test/compare" className="w-full sm:w-auto">
                    <Button size="sm" variant="default" className="w-full sm:w-auto text-xs bg-blue-600 hover:bg-blue-700">
                      비교 보기 →
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 검색 결과 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-slate-800">
                검색 결과
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                {products.length > 0
                  ? `${products.length}개의 제품을 찾았습니다. 비교하거나 리스트에 담을 수 있습니다.`
                  : hasSearched
                  ? "검색 결과가 없습니다"
                  : "검색어를 입력하고 검색을 실행해주세요"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isSearchLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                </div>
              ) : products.length > 0 ? (
                <div className="space-y-3">
                  {products.map((product) => {
                    const isInCompare = compareIds.includes(product.id);

                    return (
                      <SearchResultItem
                        key={product.id}
                        product={product}
                        isInCompare={isInCompare}
                        onToggleCompare={() => toggleCompare(product.id)}
                        onAddToQuote={() => addProductToQuote(product)}
                        onClick={() => {
                          setSelectedProduct(product);
                          setIsDetailOpen(true);
                        }}
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center py-12 text-sm text-slate-500">
                  {!hasSearched ? (
                    <p>검색어를 입력하고 <span className="mx-1 font-medium">"검색 실행"</span>을 눌러보세요.</p>
                  ) : (
                    <>
                      <p className="font-medium">검색 결과가 없습니다.</p>
                      <p className="mt-1 text-xs text-slate-400">
                        검색어를 조금 더 넓게 입력하거나, 제품명 대신 키워드(타겟, 플랫폼 등)로 시도해 보세요.
                      </p>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
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
              <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
                <SheetHeader className="pb-4">
                  <SheetTitle className="text-base">견적 요청 리스트</SheetTitle>
                  <SheetDescription className="text-xs">
                    현재 선택된 품목과 수량을 확인하고, 필요하면 수정을 진행할 수 있습니다.
                  </SheetDescription>
                </SheetHeader>
                <div className="mt-2">
                  <div className="space-y-4">
                    <div className="max-h-[65vh] overflow-y-auto border rounded-lg">
                      <Table>
                        <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
                          <TableRow>
                            <TableHead className="w-10 text-xs py-2">No.</TableHead>
                            <TableHead className="text-xs py-2 min-w-[200px]">제품명</TableHead>
                            <TableHead className="text-right text-xs py-2 w-24">수량</TableHead>
                            <TableHead className="text-right text-xs py-2 w-24">단가</TableHead>
                            <TableHead className="text-right text-xs py-2 w-28">금액</TableHead>
                            <TableHead className="w-10 text-center text-xs py-2"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                        {quoteItems.map((item, index) => {
                          const product = products.find((p) => p.id === item.productId);
                          const vendor = product?.vendors?.[0];
                          return (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium text-xs py-3">{index + 1}</TableCell>
                              <TableCell className="py-3">
                                <div className="space-y-1">
                                  <div className="font-medium text-xs leading-snug">
                                    {product?.name || item.productName || "제품"}
                                  </div>
                                  {product?.vendors?.[0]?.vendor?.name && (
                                    <div className="text-[10px] text-slate-500">
                                      {product.vendors[0].vendor.name}
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-right py-3">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5"
                                    onClick={() => updateQuoteItem(item.id, { quantity: Math.max(1, (item.quantity || 1) - 1) })}
                                    disabled={(item.quantity || 1) <= 1}
                                  >
                                    <Minus className="h-2.5 w-2.5" />
                                  </Button>
                                  <Input
                                    type="number"
                                    min="1"
                                    value={item.quantity || 1}
                                    onChange={(e) => {
                                      const qty = parseInt(e.target.value) || 1;
                                      updateQuoteItem(item.id, { quantity: Math.max(1, qty) });
                                    }}
                                    className="h-6 w-12 text-center text-[10px] p-0"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5"
                                    onClick={() => updateQuoteItem(item.id, { quantity: (item.quantity || 1) + 1 })}
                                  >
                                    <Plus className="h-2.5 w-2.5" />
                                  </Button>
                                </div>
                              </TableCell>
                              <TableCell className="text-right text-xs py-3">
                                {vendor?.priceInKRW ? (
                                  <PriceDisplay price={vendor.priceInKRW} currency={vendor.currency || "KRW"} />
                                ) : (
                                  "-"
                                )}
                              </TableCell>
                              <TableCell className="text-right font-medium text-xs py-3">
                                {item.lineTotal ? (
                                  <PriceDisplay price={item.lineTotal} currency={vendor?.currency || "KRW"} />
                                ) : (
                                  "-"
                                )}
                              </TableCell>
                              <TableCell className="text-center py-3">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-slate-400 hover:text-red-500"
                                  onClick={() => setItemToDelete(item.id)}
                                  aria-label="품목 삭제"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t">
                      <span className="font-semibold text-sm text-slate-900">총액:</span>
                      <span className="font-bold text-base text-slate-900">
                        ₩{totalAmount.toLocaleString("ko-KR")}
                      </span>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={() => setIsQuoteSheetOpen(false)}
                      >
                        닫기
                      </Button>
                      <Link href="/test/quote" className="flex-1">
                        <Button size="sm" className="w-full bg-slate-900 hover:bg-slate-800 text-xs">
                          견적 보기 →
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
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

      {/* 하단 설명 */}
      <div className="container mx-auto px-4 py-4 md:py-6">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs text-slate-500 text-center px-2">
            정리된 견적 요청 리스트는 TSV/엑셀 파일로 내려받아 이메일로 공유하거나,
            필요하면 사내 그룹웨어·전자결재 양식에 붙여넣어 사용할 수 있습니다.
          </p>
        </div>
      </div>
    </>
  );
}