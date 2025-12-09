"use client";

import { SearchPanel } from "../_components/search-panel";
import { useTestFlow } from "../_components/test-flow-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { PRODUCT_CATEGORIES } from "@/lib/constants";
import { PriceDisplay } from "@/components/products/price-display";
import { Loader2, ShoppingCart, GitCompare, X, Trash2 } from "lucide-react";
import Link from "next/link";
import { SearchResultItem } from "../_components/search-result-item";
import { QuoteListPreviewCard } from "../_components/quote-list-preview-card";
import { SearchAnalysisCard } from "../_components/search-analysis-card";
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
  } = useTestFlow();
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isQuoteSheetOpen, setIsQuoteSheetOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  const totalAmount = quoteItems.reduce((sum, item) => sum + (item.lineTotal || 0), 0);

  return (
    <>
      {/* 3컬럼 레이아웃 */}
      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)_260px]">
        {/* 좌측: 검색 패널 + 옵션 */}
        <div className="flex flex-col gap-4">
          <SearchPanel />
        </div>

        {/* 가운데: 검색 결과 */}
        <div className="space-y-4">
          {/* 비교 중인 제품 바 */}
          {compareIds.length > 0 && (
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GitCompare className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-900">
                      비교 중인 제품: {compareIds.length}개
                    </span>
                    <div className="flex items-center gap-1 ml-2 flex-wrap">
                      {compareIds.map((id) => {
                        const product = products.find((p) => p.id === id);
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
                            <span className="text-xs font-medium leading-snug whitespace-normal break-words">
                              {product?.name || id.substring(0, 8)}
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
                  <Link href="/compare">
                    <Button size="sm" variant="default" className="text-xs bg-blue-600 hover:bg-blue-700">
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
                  ? `${products.length}개의 제품을 찾았습니다`
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
                <div className="text-center py-12 text-sm text-slate-500">
                  검색 결과가 없습니다.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 우측: 검색어 분석 결과 + 품목 리스트 미리보기 */}
        <div className="flex flex-col gap-4">
          <SearchAnalysisCard />
          <QuoteListPreviewCard />
        </div>
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
        <div className="fixed bottom-4 left-1/2 z-40 w-full max-w-3xl -translate-x-1/2 px-4">
          <div className="flex items-center justify-between rounded-full border border-slate-200 bg-white/95 px-4 py-2 shadow-lg backdrop-blur">
            <p className="text-xs text-slate-700">
              품목 리스트 {quoteItems.length}개 · 합계 ₩{totalAmount.toLocaleString("ko-KR")}
            </p>
            <Sheet open={isQuoteSheetOpen} onOpenChange={setIsQuoteSheetOpen}>
              <SheetTrigger asChild>
                <Button size="sm" className="text-xs">
                  품목 리스트 열기
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full max-w-lg overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>품목 리스트</SheetTitle>
                  <SheetDescription>
                    현재 선택된 품목과 수량을 확인하고, 필요하면 수정을 진행할 수 있습니다.
                  </SheetDescription>
                </SheetHeader>
                <div className="mt-4">
                  <div className="space-y-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">No.</TableHead>
                          <TableHead>제품명</TableHead>
                          <TableHead className="text-right">수량</TableHead>
                          <TableHead className="text-right">단가</TableHead>
                          <TableHead className="text-right">금액</TableHead>
                          <TableHead className="w-10 text-center text-xs text-slate-400"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {quoteItems.map((item, index) => {
                          const product = products.find((p) => p.id === item.productId);
                          const vendor = product?.vendors?.[0];
                          return (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium">{index + 1}</TableCell>
                              <TableCell>
                                <div>
                                  <div className="font-medium text-sm">
                                    {product?.name || item.productName || "제품"}
                                  </div>
                                  {product?.vendors?.[0]?.vendor?.name && (
                                    <div className="text-xs text-slate-500">
                                      {product.vendors[0].vendor.name}
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">{item.quantity}</TableCell>
                              <TableCell className="text-right">
                                {vendor?.priceInKRW ? (
                                  <PriceDisplay price={vendor.priceInKRW} currency={vendor.currency || "KRW"} />
                                ) : (
                                  "-"
                                )}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {item.lineTotal ? (
                                  <PriceDisplay price={item.lineTotal} currency={vendor?.currency || "KRW"} />
                                ) : (
                                  "-"
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-slate-400 hover:text-red-500"
                                  onClick={() => setItemToDelete(item.id)}
                                  aria-label="품목 삭제"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                    <div className="flex items-center justify-between pt-4 border-t">
                      <span className="font-semibold text-slate-900">총액:</span>
                      <span className="font-bold text-lg text-slate-900">
                        ₩{totalAmount.toLocaleString("ko-KR")}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => setIsQuoteSheetOpen(false)}
                      >
                        닫기
                      </Button>
                      <Link href="/test/quote" className="flex-1">
                        <Button className="w-full bg-slate-900 hover:bg-slate-800">
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
    </>
  );
}