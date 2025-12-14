"use client";

import { useTestFlow } from "./test-flow-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { PriceDisplay } from "@/components/products/price-display";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Copy, Download, Share2, MoreVertical, Plus, Trash2, X, GitCompare, Languages, Check, ShoppingCart, Ban, CheckCircle2, Search, TrendingDown, Sparkles, ArrowRight } from "lucide-react";
import { useCompareStore } from "@/lib/store/compare-store";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import Link from "next/link";
import React, { useState, useEffect, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

export function QuotePanel() {
  const {
    quoteItems,
    updateQuoteItem,
    removeQuoteItem,
    shareLink,
    isGeneratingShareLink,
    generateShareLink,
    products,
  } = useTestFlow();
  const { toast } = useToast();
  const { addProduct, hasProduct } = useCompareStore();
  const [selectedQuoteIds, setSelectedQuoteIds] = useState<string[]>([]);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [groupByVendor, setGroupByVendor] = useState(true);

  const totalAmount = quoteItems.reduce((sum, item) => sum + (item.lineTotal || 0), 0);

  // 벤더별 그룹화
  const groupedByVendor = useMemo(() => {
    if (!groupByVendor) {
      return { "전체": quoteItems };
    }

    const groups: Record<string, typeof quoteItems> = {};
    quoteItems.forEach((item) => {
      const vendorName = item.vendorName || "벤더 미지정";
      if (!groups[vendorName]) {
        groups[vendorName] = [];
      }
      groups[vendorName].push(item);
    });

    // 벤더별 합계 기준으로 정렬 (합계가 큰 순서)
    const sortedGroups = Object.entries(groups).sort(([, itemsA], [, itemsB]) => {
      const sumA = itemsA.reduce((sum, item) => sum + (item.lineTotal || 0), 0);
      const sumB = itemsB.reduce((sum, item) => sum + (item.lineTotal || 0), 0);
      return sumB - sumA;
    });

    return Object.fromEntries(sortedGroups);
  }, [quoteItems, groupByVendor]);

  // 선택 관련 함수들
  const toggleSelectQuote = (id: string) => {
    setSelectedQuoteIds((prev) =>
      prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id]
    );
  };

  const selectAllQuotes = () => {
    setSelectedQuoteIds(quoteItems.map((item) => item.id));
  };

  const clearSelectedQuotes = () => {
    setSelectedQuoteIds([]);
  };

  const deleteSelectedQuotes = () => {
    if (selectedQuoteIds.length === 0) return;

    const count = selectedQuoteIds.length;
    if (window.confirm(`${count}개 품목을 삭제하시겠습니까?`)) {
      selectedQuoteIds.forEach((id) => removeQuoteItem(id));
      setSelectedQuoteIds([]);
      toast({
        title: "삭제 완료",
        description: `${count}개 품목이 삭제되었습니다.`,
      });
    }
  };

  const handleDeleteItem = (id: string) => {
    setItemToDelete(id);
  };

  const confirmDelete = () => {
    if (itemToDelete) {
      removeQuoteItem(itemToDelete);
      toast({
        title: "삭제 완료",
        description: "품목이 삭제되었습니다.",
      });
      setItemToDelete(null);
    }
  };

  // 체크박스 상태 계산
  const allSelected = quoteItems.length > 0 && selectedQuoteIds.length === quoteItems.length;
  const someSelected = selectedQuoteIds.length > 0 && selectedQuoteIds.length < quoteItems.length;

  return (
    <div className="space-y-6">
      {/* 구매 요청 품목 섹션 */}
      <Card className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
            <div className="flex-1">
              <CardTitle className="text-sm font-semibold text-slate-900">
                구매 요청 품목
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 mt-1">
                그룹웨어/전자결재에 올릴 최종 품목과 수량을 확인하는 화면입니다.
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-600">벤더별 그룹화</span>
                <button
                  type="button"
                  onClick={() => setGroupByVendor(!groupByVendor)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 ${
                    groupByVendor ? "bg-slate-900" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      groupByVendor ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
                <span className="text-xs text-slate-500">
                  {groupByVendor ? "켜짐" : "꺼짐"}
                </span>
              </div>
              <Button variant="secondary" size="sm" className="text-xs w-full sm:w-auto" disabled>
                <Plus className="h-3 w-3 mr-1" />
                품목 추가
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="space-y-4">
            {/* 선택 액션바 */}
            {selectedQuoteIds.length > 0 && quoteItems.length > 0 && (
              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                <span>선택된 {selectedQuoteIds.length}개 품목</span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearSelectedQuotes}
                    className="h-7 text-xs"
                  >
                    선택 해제
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={deleteSelectedQuotes}
                    className="h-7 text-xs"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    선택 삭제
                  </Button>
                </div>
              </div>
            )}

            {/* 테이블 - 항상 헤더 표시 */}
            <div className="w-full overflow-x-auto -mx-4 sm:mx-0">
              <div className="inline-block min-w-full align-middle px-4 sm:px-0">
                <Table className="w-full table-auto quote-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12 text-xs">
                        {quoteItems.length > 0 && (
                          <Checkbox
                            checked={allSelected || someSelected}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                selectAllQuotes();
                              } else {
                                clearSelectedQuotes();
                              }
                            }}
                            className={someSelected && !allSelected ? "opacity-50" : ""}
                          />
                        )}
                      </TableHead>
                      <TableHead 
                        className="px-1 py-2 text-xs font-medium text-slate-500 text-center whitespace-nowrap no-column-header"
                        style={{
                          display: 'table-cell',
                          writingMode: 'horizontal-tb',
                          textOrientation: 'mixed',
                          visibility: 'visible',
                          direction: 'ltr',
                          unicodeBidi: 'normal',
                          transform: 'none',
                          width: '36px',
                          minWidth: '36px',
                          maxWidth: '36px',
                          padding: '8px 4px'
                        }}
                      >
                        <span style={{ display: 'inline-block', writingMode: 'horizontal-tb', textOrientation: 'mixed', whiteSpace: 'nowrap' }}>No.</span>
                      </TableHead>
                      <TableHead 
                        className="text-xs font-medium text-slate-500 text-left whitespace-nowrap product-name-header"
                        style={{
                          width: '180px',
                          minWidth: '180px',
                          maxWidth: '180px'
                        }}
                      >
                        제품명
                      </TableHead>
                      <TableHead 
                        className="text-xs font-medium text-slate-500 text-left whitespace-nowrap"
                        style={{ width: '100px', minWidth: '100px', maxWidth: '100px' }}
                      >
                        벤더
                      </TableHead>
                      <TableHead 
                        className="text-xs font-medium text-slate-500 text-right whitespace-nowrap"
                        style={{ width: '100px', minWidth: '100px', maxWidth: '100px' }}
                      >
                        단가
                      </TableHead>
                      <TableHead 
                        className="text-xs font-medium text-slate-500 text-center whitespace-nowrap"
                        style={{ width: '80px', minWidth: '80px', maxWidth: '80px' }}
                      >
                        수량
                      </TableHead>
                      <TableHead 
                        className="text-xs font-medium text-slate-500 text-right whitespace-nowrap"
                        style={{ width: '100px', minWidth: '100px', maxWidth: '100px' }}
                      >
                        금액
                      </TableHead>
                      <TableHead 
                        className="text-xs font-medium text-slate-500 text-center whitespace-nowrap"
                        style={{ width: '80px', minWidth: '80px', maxWidth: '80px' }}
                      >
                        비교
                      </TableHead>
                      <TableHead 
                        className="text-xs font-medium text-slate-500 text-center whitespace-nowrap"
                        style={{ width: '80px', minWidth: '80px', maxWidth: '80px' }}
                      >
                        구매 완료
                      </TableHead>
                      <TableHead 
                        className="text-xs font-medium text-slate-500 text-center whitespace-nowrap"
                        style={{ width: '60px', minWidth: '60px', maxWidth: '60px' }}
                      >
                        삭제
                      </TableHead>
                      <TableHead className="w-12 text-xs"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {quoteItems.length > 0 ? (
                      (() => {
                        let globalIndex = 0;
                        return Object.entries(groupedByVendor).map(([vendorName, items]) => {
                          const vendorTotal = items.reduce((sum, item) => sum + (item.lineTotal || 0), 0);
                          const vendorItemCount = items.length;
                          
                          return (
                            <React.Fragment key={vendorName}>
                              {/* 벤더 헤더 행 (그룹화 모드일 때만) */}
                              {groupByVendor && vendorName !== "전체" && (
                                <TableRow className="bg-slate-50 hover:bg-slate-100">
                                  <TableCell colSpan={2} className="px-3 py-2 text-xs font-semibold text-slate-700">
                                    {vendorName}
                                  </TableCell>
                                  <TableCell colSpan={5} className="px-3 py-2 text-xs text-slate-600">
                                    {vendorItemCount}개 품목
                                  </TableCell>
                                  <TableCell className="px-3 py-2 text-xs font-semibold text-slate-900 text-right">
                                    <PriceDisplay price={vendorTotal} currency="KRW" />
                                  </TableCell>
                                  <TableCell colSpan={2}></TableCell>
                                </TableRow>
                              )}
                              {/* 품목 행들 */}
                              {items.map((item) => {
                                globalIndex++;
                                return (
                                  <TableRow key={item.id}>
                                    <TableCell>
                                      <Checkbox
                                        checked={selectedQuoteIds.includes(item.id)}
                                        onCheckedChange={() => toggleSelectQuote(item.id)}
                                      />
                                    </TableCell>
                                    <TableCell 
                                      className="px-1 py-2 text-xs text-slate-700 text-center whitespace-nowrap no-column-cell"
                                      style={{
                                        display: 'table-cell',
                                        writingMode: 'horizontal-tb',
                                        textOrientation: 'mixed',
                                        visibility: 'visible',
                                        direction: 'ltr',
                                        unicodeBidi: 'normal',
                                        transform: 'none',
                                        width: '36px',
                                        minWidth: '36px',
                                        maxWidth: '36px',
                                        padding: '8px 4px'
                                      }}
                                    >
                                      <span style={{ display: 'inline-block', writingMode: 'horizontal-tb', textOrientation: 'mixed', whiteSpace: 'nowrap' }}>{globalIndex}</span>
                                    </TableCell>
                          <TableCell 
                            className="px-2 py-2 text-xs text-slate-700 text-left product-name-cell"
                            title={item.productName}
                            style={{
                              width: '180px',
                              minWidth: '180px',
                              maxWidth: '180px'
                            }}
                          >
                            {item.productName}
                          </TableCell>
                          <TableCell 
                            className="px-2 py-2 text-xs text-slate-700 text-left whitespace-nowrap"
                            style={{ width: '120px', minWidth: '120px', maxWidth: '120px' }}
                          >
                            {(() => {
                              const product = products?.find((p: any) => p.id === item.productId);
                              const vendors = product?.vendors || [];
                              
                              if (vendors.length <= 1) {
                                return <span>{item.vendorName}</span>;
                              }
                              
                              return (
                                <Select
                                  value={item.vendorId || ""}
                                  onValueChange={(vendorId) => {
                                    const selectedVendor = vendors.find((v: any) => v.vendor?.id === vendorId);
                                    if (selectedVendor) {
                                      updateQuoteItem(item.id, {
                                        vendorId: selectedVendor.vendor?.id || "",
                                        vendorName: selectedVendor.vendor?.name || "",
                                        unitPrice: selectedVendor.priceInKRW || 0,
                                        currency: selectedVendor.currency || "KRW",
                                        lineTotal: (selectedVendor.priceInKRW || 0) * (item.quantity || 1),
                                      });
                                    }
                                  }}
                                >
                                  <SelectTrigger className="h-7 text-xs w-full">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {vendors.map((v: any) => (
                                      <SelectItem key={v.vendor?.id} value={v.vendor?.id || ""}>
                                        {v.vendor?.name || ""}
                                        {v.priceInKRW && ` (₩${v.priceInKRW.toLocaleString()})`}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              );
                            })()}
                          </TableCell>
                          <TableCell 
                            className="px-2 py-2 text-xs text-slate-700 text-right whitespace-nowrap"
                            style={{ width: '100px', minWidth: '100px', maxWidth: '100px' }}
                          >
                            <PriceDisplay
                              price={item.unitPrice || 0}
                              currency={item.currency || "KRW"}
                            />
                          </TableCell>
                          <TableCell 
                            className="px-2 py-2 text-center"
                            style={{ width: '80px', minWidth: '80px', maxWidth: '80px' }}
                          >
                            <Input
                              type="number"
                              min="1"
                              value={item.quantity || 1}
                              onChange={(e) =>
                                updateQuoteItem(item.id, {
                                  quantity: parseInt(e.target.value) || 1,
                                })
                              }
                              className="w-20 h-7 text-xs"
                            />
                          </TableCell>
                          <TableCell 
                            className="px-2 py-2 text-xs text-slate-700 text-right whitespace-nowrap"
                            style={{ width: '100px', minWidth: '100px', maxWidth: '100px' }}
                          >
                            <PriceDisplay
                              price={item.lineTotal || 0}
                              currency={item.currency || "KRW"}
                            />
                          </TableCell>
                          <TableCell 
                            className="px-2 py-2 text-center"
                            style={{ width: '80px', minWidth: '80px', maxWidth: '80px' }}
                          >
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-7 text-xs"
                              onClick={() => {
                                if (hasProduct(item.productId)) {
                                  toast({
                                    title: "이미 추가됨",
                                    description: "이 제품은 이미 비교 목록에 있습니다.",
                                  });
                                } else {
                                  addProduct(item.productId);
                                  toast({
                                    title: "추가 완료",
                                    description: "비교 목록에 추가되었습니다.",
                                  });
                                }
                              }}
                            >
                              <GitCompare className="h-3 w-3 mr-1" />
                              비교
                            </Button>
                          </TableCell>
                          <TableCell 
                            className="px-2 py-2 text-center"
                            style={{ width: '80px', minWidth: '80px', maxWidth: '80px' }}
                          >
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`h-7 text-xs ${item.isPurchased ? 'text-green-600 hover:text-green-700' : 'text-slate-400 hover:text-green-600'}`}
                              onClick={() => updateQuoteItem(item.id, { isPurchased: !item.isPurchased })}
                              title={item.isPurchased ? "구매 완료 취소" : "구매 완료 표시"}
                            >
                              <CheckCircle2 className={`h-4 w-4 ${item.isPurchased ? 'fill-green-600 text-green-600' : ''}`} />
                            </Button>
                          </TableCell>
                          <TableCell 
                            className="px-2 py-2 text-center"
                            style={{ width: '60px', minWidth: '60px', maxWidth: '60px' }}
                          >
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-slate-400 hover:text-red-500"
                              onClick={() => handleDeleteItem(item.id)}
                              aria-label="품목 삭제"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => handleDeleteItem(item.id)}
                                  className="text-destructive"
                                >
                                  <Trash2 className="h-3 w-3 mr-2" />
                                  품목 삭제
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                                );
                              })}
                            </React.Fragment>
                          );
                        });
                      })()
                    ) : (
                      // 빈 상태 플레이스홀더 행
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-12">
                          <div className="flex flex-col items-center gap-3">
                            <ShoppingCart className="h-12 w-12 text-slate-300" />
                            <div className="space-y-1">
                              <p className="text-sm font-medium text-slate-600">
                                검색 결과에서 제품을 선택하여 품목을 추가하세요
                              </p>
                              <p className="text-xs text-slate-500">
                                Step 1에서 제품을 검색하고 '품목에 추가'를 눌러 리스트를 만들어 보세요.
                              </p>
                            </div>
                            <Link href="/test/search">
                              <Button variant="outline" size="sm" className="text-xs mt-2">
                                <Plus className="h-3 w-3 mr-1" />
                                검색으로 이동
                              </Button>
                            </Link>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* 절감 제안 섹션 */}
            {quoteItems.length > 0 && costOptimization && costOptimization.optimizations.length > 0 && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-semibold text-blue-900">절감 제안</span>
                  <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
                    최대 {costOptimization.summary.totalPotentialSavings.toLocaleString("ko-KR")}원 절감 가능
                  </Badge>
                </div>
                <div className="space-y-2">
                  {costOptimization.optimizations.slice(0, 3).map((opt: any, idx: number) => (
                    <div key={idx} className="p-2 bg-white rounded border border-blue-100">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-slate-900 line-clamp-1">
                            {opt.currentProductName}
                          </div>
                          <div className="flex items-center gap-1 mt-1">
                            <ArrowRight className="h-3 w-3 text-slate-400" />
                            <span className="text-xs text-slate-600 line-clamp-1">
                              {opt.alternativeProductName}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-[10px]">
                              유사도 {Math.round(opt.similarity * 100)}%
                            </Badge>
                            {opt.similarityReasons && opt.similarityReasons.length > 0 && (
                              <span className="text-[10px] text-slate-500">
                                {opt.similarityReasons[0]}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-slate-500 line-through">
                            ₩{(opt.currentPrice * opt.quantity).toLocaleString("ko-KR")}
                          </div>
                          <div className="text-sm font-semibold text-green-600">
                            ₩{(opt.alternativePrice * opt.quantity).toLocaleString("ko-KR")}
                          </div>
                          <div className="text-xs font-medium text-green-700">
                            -{opt.savingsRate.toFixed(1)}% (₩{opt.totalSavings.toLocaleString("ko-KR")})
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full mt-2 text-xs h-7"
                        onClick={() => {
                          // 제품 교체
                          const item = quoteItems.find((i) => i.productId === opt.currentProductId);
                          if (item) {
                            updateQuoteItem(item.id, {
                              productId: opt.alternativeProductId,
                              productName: opt.alternativeProductName,
                              vendorName: opt.alternativeVendorName,
                              selectedVendorId: undefined, // 새 제품의 벤더를 찾아야 함
                              unitPrice: opt.alternativePrice,
                              lineTotal: opt.alternativePrice * opt.quantity,
                            });
                            toast({
                              title: "제품 교체 완료",
                              description: `${opt.currentProductName} → ${opt.alternativeProductName}`,
                            });
                          }
                        }}
                      >
                        <TrendingDown className="h-3 w-3 mr-1" />
                        이 제품으로 교체
                      </Button>
                    </div>
                  ))}
                </div>
                {costOptimization.optimizations.length > 3 && (
                  <div className="text-xs text-center text-slate-500 pt-1">
                    외 {costOptimization.optimizations.length - 3}개 제안 더 보기
                  </div>
                )}
              </div>
            )}

            {/* 총합 - 품목이 있을 때만 표시 */}
            {quoteItems.length > 0 && (
              <div className="flex justify-end pt-2 border-t">
                <div className="text-right">
                  <div className="text-xs text-slate-500">총합</div>
                  <div className="text-lg font-bold text-slate-900">
                    ₩{totalAmount.toLocaleString()}
                  </div>
                  {costOptimization && costOptimization.summary.totalPotentialSavings > 0 && (
                    <div className="text-xs text-green-600 mt-1">
                      절감 가능: ₩{costOptimization.summary.totalPotentialSavings.toLocaleString("ko-KR")}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 견적 요청 버튼 - 품목이 있을 때만 표시 */}
            {quoteItems.length > 0 && (
              <div className="flex justify-end pt-2">
                <Link href="/test/quote/request">
                  <Button className="bg-slate-900 text-white hover:bg-slate-800 text-xs h-8">
                    <Plus className="h-3 w-3 mr-2" />
                    견적 요청하기
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

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
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// 공유 패널
export function SharePanel() {
  const {
    quoteItems,
    shareLink: providerShareLink,
    isGeneratingShareLink,
    generateShareLink,
  } = useTestFlow();
  const { toast } = useToast();
  const [shareTitle, setShareTitle] = useState("");
  const [expiresInDays, setExpiresInDays] = useState<number>(30);
  const [copied, setCopied] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [localShareLink, setLocalShareLink] = useState<string | null>(providerShareLink || null);
  const [shareLinkInfo, setShareLinkInfo] = useState<{ publicId: string; expiresAt?: string; isActive: boolean } | null>(null);

  // providerShareLink가 변경되면 localShareLink 업데이트
  useEffect(() => {
    if (providerShareLink) {
      setLocalShareLink(providerShareLink);
    }
  }, [providerShareLink]);

  const handleGenerateShareLink = async () => {
    if (quoteItems.length === 0) {
      toast({
        title: "품목이 없습니다",
        description: "공유할 품목을 먼저 추가해주세요.",
        variant: "destructive",
      });
      return;
    }

    try {
      await generateShareLink(shareTitle || "품목 리스트", expiresInDays);
      setIsShareDialogOpen(false);
      // generateShareLink가 성공하면 providerShareLink가 업데이트되므로
      // 잠시 후 localShareLink도 업데이트
      setTimeout(() => {
        setLocalShareLink(providerShareLink);
        // 링크에서 publicId 추출
        if (providerShareLink) {
          const publicId = providerShareLink.split("/share/")[1];
          if (publicId) {
            setShareLinkInfo({ publicId, expiresAt: expiresInDays > 0 ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString() : undefined, isActive: true });
          }
        }
      }, 100);
      toast({
        title: "공유 링크 생성 완료",
        description: expiresInDays > 0 
          ? `공유 링크가 생성되었습니다. ${expiresInDays}일 후 만료됩니다.`
          : "공유 링크가 생성되었습니다. (만료 없음)",
      });
    } catch (error: any) {
      toast({
        title: "공유 링크 생성 실패",
        description: error.message || "공유 링크를 생성할 수 없습니다.",
        variant: "destructive",
      });
    }
  };

  const handleDeactivateLink = async () => {
    if (!shareLinkInfo?.publicId) return;
    
    try {
      const response = await fetch(`/api/shared-lists/${shareLinkInfo.publicId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false }),
      });

      if (!response.ok) {
        throw new Error("링크 비활성화에 실패했습니다.");
      }

      setShareLinkInfo((prev) => prev ? { ...prev, isActive: false } : null);
      toast({
        title: "링크 비활성화 완료",
        description: "공유 링크가 비활성화되었습니다.",
      });
    } catch (error: any) {
      toast({
        title: "비활성화 실패",
        description: error.message || "링크를 비활성화할 수 없습니다.",
        variant: "destructive",
      });
    }
  };

  const handleCopyLink = async () => {
    const linkToCopy = localShareLink || providerShareLink;
    if (!linkToCopy) return;
    try {
      await navigator.clipboard.writeText(linkToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "복사 완료",
        description: "공유 링크가 클립보드에 복사되었습니다.",
      });
    } catch (error) {
      toast({
        title: "복사 실패",
        description: "링크를 복사할 수 없습니다.",
        variant: "destructive",
      });
    }
  };

  // TSV 내용 생성 (공통 함수)
  const generateTSVContent = () => {
    const headers = ["No.", "제품명", "벤더", "수량", "단가", "금액", "비고"];
    const rows = quoteItems.map((item, index) => [
      (index + 1).toString(),
      item.productName || "",
      item.vendorName || "",
      (item.quantity || 1).toString(),
      item.unitPrice ? `₩${item.unitPrice.toLocaleString("ko-KR")}` : "",
      item.lineTotal ? `₩${item.lineTotal.toLocaleString("ko-KR")}` : "",
      item.notes || "",
    ]);

    return [
      headers.join("\t"),
      ...rows.map((row) => row.join("\t")),
    ].join("\n");
  };

  // TSV 클립보드 복사
  const handleCopyTSV = async () => {
    if (quoteItems.length === 0) {
      toast({
        title: "품목이 없습니다",
        description: "복사할 품목을 먼저 추가해주세요.",
        variant: "destructive",
      });
      return;
    }

    try {
      const tsvContent = generateTSVContent();
      await navigator.clipboard.writeText(tsvContent);
      toast({
        title: "복사 완료",
        description: "TSV 형식이 클립보드에 복사되었습니다. 엑셀/그룹웨어에 붙여넣을 수 있습니다.",
      });
    } catch (error) {
      toast({
        title: "복사 실패",
        description: "클립보드에 복사할 수 없습니다.",
        variant: "destructive",
      });
    }
  };

  // TSV 형식으로 내보내기
  const handleExportTSV = () => {
    if (quoteItems.length === 0) {
      toast({
        title: "품목이 없습니다",
        description: "내보낼 품목을 먼저 추가해주세요.",
        variant: "destructive",
      });
      return;
    }

    const tsvContent = generateTSVContent();
    const blob = new Blob(["\uFEFF" + tsvContent], { type: "text/tab-separated-values;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `품목리스트_${new Date().toISOString().split("T")[0]}.tsv`;
    link.click();
    URL.revokeObjectURL(url);

    toast({
      title: "내보내기 완료",
      description: "TSV 파일이 다운로드되었습니다.",
    });
  };

  // CSV 형식으로 내보내기
  const handleExportCSV = () => {
    if (quoteItems.length === 0) {
      toast({
        title: "품목이 없습니다",
        description: "내보낼 품목을 먼저 추가해주세요.",
        variant: "destructive",
      });
      return;
    }

    const headers = ["No.", "제품명", "벤더", "수량", "단가", "금액", "비고"];
    const rows = quoteItems.map((item, index) => [
      (index + 1).toString(),
      `"${(item.productName || "").replace(/"/g, '""')}"`,
      `"${(item.vendorName || "").replace(/"/g, '""')}"`,
      (item.quantity || 1).toString(),
      item.unitPrice ? `"₩${item.unitPrice.toLocaleString("ko-KR")}"` : '""',
      item.lineTotal ? `"₩${item.lineTotal.toLocaleString("ko-KR")}"` : '""',
      `"${(item.notes || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `품목리스트_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast({
      title: "내보내기 완료",
      description: "CSV 파일이 다운로드되었습니다.",
    });
  };

  return (
    <Card className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="text-sm font-semibold text-slate-900">공유</CardTitle>
        <CardDescription className="text-xs text-slate-500">
          견적/구매 요청용으로 바로 공유·첨부할 수 있는 리스트 형식으로 정리해서 내보낼 수 있습니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {(localShareLink || providerShareLink) ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <Label className="text-xs font-medium text-slate-700 mb-2 block">
                공유 링크
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  value={localShareLink || providerShareLink || ""}
                  readOnly
                  className="flex-1 text-xs font-mono bg-white"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyLink}
                  className="h-8"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                이 링크를 공유하면 다른 사람이 품목 리스트를 볼 수 있습니다.
                {shareLinkInfo?.expiresAt && (
                  <span className="block mt-1">
                    만료일: {new Date(shareLinkInfo.expiresAt).toLocaleDateString("ko-KR")}
                  </span>
                )}
              </p>
            </div>
            <div className="flex gap-2">
              {shareLinkInfo?.isActive && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDeactivateLink}
                  className="flex-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Ban className="h-3 w-3 mr-1" />
                  링크 비활성화
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setLocalShareLink(null);
                  setShareTitle("");
                  setShareLinkInfo(null);
                  setExpiresInDays(30);
                }}
                className="flex-1 text-xs"
              >
                새 링크 생성
              </Button>
            </div>
          </div>
        ) : (
          <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
            <DialogTrigger asChild>
              <Button
                className="w-full bg-slate-900 text-white hover:bg-slate-800"
                disabled={quoteItems.length === 0 || isGeneratingShareLink}
              >
                <Share2 className="h-4 w-4 mr-2" />
                {isGeneratingShareLink ? "생성 중..." : "공유 링크 생성"}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>공유 링크 생성</DialogTitle>
                <DialogDescription>
                  품목 리스트를 공유할 수 있는 링크를 생성합니다.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="share-title">제목 (선택사항)</Label>
                  <Input
                    id="share-title"
                    value={shareTitle}
                    onChange={(e) => setShareTitle(e.target.value)}
                    placeholder="품목 리스트"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expires-in-days">만료 기간</Label>
                  <Select
                    value={expiresInDays.toString()}
                    onValueChange={(value) => setExpiresInDays(parseInt(value) || 0)}
                  >
                    <SelectTrigger id="expires-in-days">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">7일</SelectItem>
                      <SelectItem value="14">14일</SelectItem>
                      <SelectItem value="30">30일 (기본)</SelectItem>
                      <SelectItem value="60">60일</SelectItem>
                      <SelectItem value="90">90일</SelectItem>
                      <SelectItem value="0">만료 없음</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500">
                    {expiresInDays > 0 
                      ? `링크는 ${expiresInDays}일 후 자동으로 만료됩니다.`
                      : "링크는 만료되지 않습니다. 수동으로 비활성화할 수 있습니다."}
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsShareDialogOpen(false)}
                >
                  취소
                </Button>
                <Button
                  onClick={handleGenerateShareLink}
                  disabled={isGeneratingShareLink}
                >
                  생성
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* 내보내기 버튼 */}
        <div className="pt-4 border-t border-slate-200">
          <Label className="text-xs font-medium text-slate-700 mb-3 block">
            파일 내보내기
          </Label>
          <div className="space-y-2">
            <Button
              variant="default"
              size="sm"
              onClick={handleCopyTSV}
              disabled={quoteItems.length === 0}
              className="w-full text-xs bg-slate-900 hover:bg-slate-800"
            >
              <Copy className="h-3 w-3 mr-2" />
              TSV 복사 (그룹웨어 붙여넣기)
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportTSV}
                disabled={quoteItems.length === 0}
                className="w-full text-xs"
              >
                <Download className="h-3 w-3 mr-2" />
                TSV 다운로드
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCSV}
                disabled={quoteItems.length === 0}
                className="w-full text-xs"
              >
                <Download className="h-3 w-3 mr-2" />
                CSV 다운로드
              </Button>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            <strong>TSV 복사</strong>를 클릭하면 엑셀/그룹웨어에 바로 붙여넣을 수 있습니다. TSV는 엑셀에서 바로 열 수 있고, CSV는 범용적으로 사용할 수 있습니다.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function QuoteRequestPanel() {
  const { quoteItems, products } = useTestFlow();
  const { toast } = useToast();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryDateOption, setDeliveryDateOption] = useState<"asap" | "custom" | "none">("none");
  const [deliveryLocation, setDeliveryLocation] = useState<"none" | "saved" | "custom">("none");
  const [deliveryLocationCustom, setDeliveryLocationCustom] = useState("");
  const [savedDeliveryAddress, setSavedDeliveryAddress] = useState<string>("");
  const [specialNotes, setSpecialNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 저장된 납품 주소 불러오기 (localStorage에서)
  useEffect(() => {
    const saved = localStorage.getItem("deliveryAddress");
    if (saved) {
      setSavedDeliveryAddress(saved);
    }
  }, []);

  // 납품 주소 저장
  const handleSaveDeliveryAddress = () => {
    if (deliveryLocationCustom.trim()) {
      localStorage.setItem("deliveryAddress", deliveryLocationCustom.trim());
      setSavedDeliveryAddress(deliveryLocationCustom.trim());
      setDeliveryLocation("saved");
      toast({
        title: "주소가 저장되었습니다",
        description: "다음 견적 요청 시 저장된 주소를 사용할 수 있습니다.",
      });
    }
  };

  // 제목 자동 생성 (품목명 기반)
  useEffect(() => {
    if (quoteItems.length > 0 && !title) {
      const productNames = quoteItems
        .map((item) => {
          // products 배열에서 찾기
          const product = products?.find((p) => p.id === item.productId);
          // productName이 있으면 사용, 없으면 products에서 가져오기
          return item.productName || product?.name || product?.brand || null;
        })
        .filter((name): name is string => Boolean(name))
        .slice(0, 3); // 최대 3개만
      
      if (productNames.length > 0) {
        const suggestedTitle = productNames.length === 1
          ? `${productNames[0]} 견적 요청`
          : `${productNames[0]} 외 ${quoteItems.length - 1}건 견적 요청`;
        setTitle(suggestedTitle);
      } else {
        // 제품명을 찾을 수 없으면 기본 제목 사용
        setTitle(`품목 ${quoteItems.length}건 견적 요청`);
      }
    }
  }, [quoteItems, products, title]);

  // 벤더별로 그룹화
  const vendorGroups = useMemo(() => {
    const groups = new Map<string, typeof quoteItems>();
    quoteItems.forEach((item) => {
      const vendorId = item.vendorId || "unknown";
      if (!groups.has(vendorId)) {
        groups.set(vendorId, []);
      }
      groups.get(vendorId)!.push(item);
    });
    return groups;
  }, [quoteItems]);

  // 메시지 자동 생성 (벤더별로 분리)
  useEffect(() => {
    if (quoteItems.length > 0 && !message) {
      // 벤더가 하나면 하나의 메시지
      if (vendorGroups.size === 1) {
        const items = Array.from(vendorGroups.values())[0];
        const productCount = items.length;
        const totalAmount = items.reduce((sum, item) => sum + (item.lineTotal || 0), 0);
        const suggestedMessage = `안녕하세요.\n\n아래 품목 ${productCount}건에 대한 견적을 요청드립니다.\n\n품목 수: ${productCount}개\n예상 금액: ₩${totalAmount.toLocaleString("ko-KR")}\n\n빠른 견적 부탁드립니다.\n감사합니다.`;
        setMessage(suggestedMessage);
      } else {
        // 여러 벤더인 경우 - 첫 번째 벤더의 메시지를 기본으로 사용하되, 각 벤더별로 맞춘 메시지 생성
        const firstVendorItems = Array.from(vendorGroups.values())[0];
        const productCount = firstVendorItems.length;
        const totalAmount = firstVendorItems.reduce((sum, item) => sum + (item.lineTotal || 0), 0);
        const suggestedMessage = `안녕하세요.\n\n아래 품목 ${productCount}건에 대한 견적을 요청드립니다.\n\n품목 수: ${productCount}개\n예상 금액: ₩${totalAmount.toLocaleString("ko-KR")}\n\n빠른 견적 부탁드립니다.\n감사합니다.`;
        setMessage(suggestedMessage);
      }
    }
  }, [quoteItems, message, vendorGroups]);

  // 납기 희망일 옵션 변경 핸들러
  const handleDeliveryDateOptionChange = (option: "asap" | "custom" | "none") => {
    setDeliveryDateOption(option);
    if (option === "asap") {
      // 최대한 빨리 = 오늘로부터 7일 후
      const date = new Date();
      date.setDate(date.getDate() + 7);
      setDeliveryDate(date.toISOString().split("T")[0]);
    } else if (option === "custom") {
      setDeliveryDate("");
    } else {
      setDeliveryDate("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (quoteItems.length === 0) {
      toast({
        title: "품목이 없습니다",
        description: "견적을 요청할 품목을 먼저 추가해주세요.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title || "견적 요청",
          message: message || "", // 기본 메시지 (각 벤더별로 맞춰서 사용)
          // 벤더별로 그룹화하여 각 벤더에게 별도 견적 요청
          items: quoteItems.map((item) => ({
            productId: item.productId,
            vendorId: item.vendorId,
            quantity: item.quantity || 1,
            notes: item.notes || "",
          })),
          deliveryDate: deliveryDateOption === "none" ? undefined : (deliveryDate || undefined),
          deliveryLocation: deliveryLocation === "custom" ? deliveryLocationCustom : (deliveryLocation || undefined),
          specialNotes: specialNotes || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "견적 요청에 실패했습니다.");
      }

      const quote = await response.json();
      toast({
        title: "견적 요청 완료",
        description: "견적 요청이 성공적으로 전송되었습니다.",
      });
      
      // 견적 상세 페이지로 이동
      router.push(`/quotes/${quote.id}`);
    } catch (error: any) {
      toast({
        title: "견적 요청 실패",
        description: error.message || "견적 요청을 처리할 수 없습니다.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="text-sm font-semibold text-slate-900">견적 요청</CardTitle>
        <CardDescription className="text-xs text-slate-500">
          벤더에게 견적을 요청하세요
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="quote-title" className="text-xs font-medium">
              제목 *
            </Label>
            <Input
              id="quote-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="견적 요청 제목"
              required
              className="text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="quote-message" className="text-xs font-medium">
              메시지
            </Label>
            <Textarea
              id="quote-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="벤더에게 전달할 메시지"
              className="text-sm min-h-[100px]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="delivery-date" className="text-xs font-medium">
                납기 희망일
              </Label>
              <Select
                value={deliveryDateOption}
                onValueChange={(value: "asap" | "custom" | "none") => handleDeliveryDateOptionChange(value)}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asap">최대한 빨리 (1주일 이내)</SelectItem>
                  <SelectItem value="custom">직접 입력</SelectItem>
                  <SelectItem value="none">선택 안함</SelectItem>
                </SelectContent>
              </Select>
              {deliveryDateOption === "custom" && (
                <Input
                  id="delivery-date"
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className="text-sm mt-2"
                />
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="delivery-location" className="text-xs font-medium">
                납품 장소
              </Label>
              <Select
                value={deliveryLocation}
                onValueChange={(value: "none" | "saved" | "custom") => {
                  setDeliveryLocation(value);
                  if (value !== "custom") {
                    setDeliveryLocationCustom("");
                  }
                }}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="납품 장소 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">선택 안함</SelectItem>
                  {savedDeliveryAddress && (
                    <SelectItem value="saved">저장된 주소: {savedDeliveryAddress}</SelectItem>
                  )}
                  <SelectItem value="custom">직접 입력</SelectItem>
                </SelectContent>
              </Select>
              {deliveryLocation === "custom" && (
                <div className="space-y-2 mt-2">
                  <Input
                    id="delivery-location-custom"
                    value={deliveryLocationCustom}
                    onChange={(e) => setDeliveryLocationCustom(e.target.value)}
                    placeholder="납품 장소를 입력하세요"
                    className="text-sm"
                  />
                  {deliveryLocationCustom.trim() && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleSaveDeliveryAddress}
                      className="text-xs w-full"
                    >
                      주소 저장하기
                    </Button>
                  )}
                </div>
              )}
              {deliveryLocation === "saved" && savedDeliveryAddress && (
                <div className="text-xs text-slate-500 mt-1 p-2 bg-slate-50 rounded border border-slate-200">
                  {savedDeliveryAddress}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="special-notes" className="text-xs font-medium">
              특이사항
            </Label>
            <Textarea
              id="special-notes"
              value={specialNotes}
              onChange={(e) => setSpecialNotes(e.target.value)}
              placeholder="특이사항이나 추가 요청사항"
              className="text-sm min-h-[80px]"
            />
          </div>

          <Button
            type="submit"
            className="w-full bg-slate-900 text-white hover:bg-slate-800"
            disabled={isSubmitting || quoteItems.length === 0}
          >
            {isSubmitting ? "전송 중..." : "견적 요청하기"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function QuoteItemsSummaryPanel() {
  const { quoteItems, products } = useTestFlow();
  
  // 벤더별로 그룹화
  const vendorGroups = useMemo(() => {
    const groups = new Map<string, { vendorName: string; items: typeof quoteItems }>();
    quoteItems.forEach((item) => {
      const vendorId = item.vendorId || "unknown";
      const vendorName = item.vendorName || "알 수 없음";
      if (!groups.has(vendorId)) {
        groups.set(vendorId, { vendorName, items: [] });
      }
      groups.get(vendorId)!.items.push(item);
    });
    return groups;
  }, [quoteItems]);

  const totalAmount = quoteItems.reduce((sum, item) => sum + (item.lineTotal || 0), 0);

  if (quoteItems.length === 0) {
    return (
      <Card className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-slate-900">품목 요약</CardTitle>
          <CardDescription className="text-xs text-slate-500">
            요청한 품목을 확인하세요
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-slate-500 text-center py-8">
            품목이 없습니다.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="text-sm font-semibold text-slate-900">품목 요약</CardTitle>
        <CardDescription className="text-xs text-slate-500">
          요청할 품목 {quoteItems.length}개 {vendorGroups.size > 1 && `(벤더 ${vendorGroups.size}개)`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="max-h-[400px] overflow-y-auto space-y-4">
            {Array.from(vendorGroups.entries()).map(([vendorId, { vendorName, items }], vendorIndex) => {
              const vendorTotal = items.reduce((sum, item) => sum + (item.lineTotal || 0), 0);
              return (
                <div key={vendorId} className="space-y-2">
                  {vendorGroups.size > 1 && (
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                      <span className="text-xs font-semibold text-slate-700">
                        {vendorIndex + 1}. {vendorName}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {items.length}개 품목
                      </Badge>
                    </div>
                  )}
                  <div className="space-y-2">
                    {items.map((item, itemIndex) => {
                      const product = products?.find((p) => p.id === item.productId);
                      return (
                        <div
                          key={item.id}
                          className="flex items-start justify-between gap-2 p-2 rounded-lg border border-slate-100 bg-slate-50"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-slate-900 truncate">
                              {vendorGroups.size === 1 ? `${itemIndex + 1}. ` : ""}{product?.name || item.productName || "제품"}
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                              수량: {item.quantity} ×{" "}
                              <PriceDisplay
                                price={item.unitPrice || 0}
                                currency={item.currency || "KRW"}
                              />
                            </div>
                          </div>
                          <div className="text-xs font-semibold text-slate-900 whitespace-nowrap">
                            <PriceDisplay
                              price={item.lineTotal || 0}
                              currency={item.currency || "KRW"}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {vendorGroups.size > 1 && (
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <span className="text-xs font-medium text-slate-600">{vendorName} 소계</span>
                      <span className="text-xs font-semibold text-slate-900">
                        ₩{vendorTotal.toLocaleString("ko-KR")}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="pt-3 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-900">총액</span>
              <span className="text-lg font-bold text-slate-900">
                ₩{totalAmount.toLocaleString("ko-KR")}
              </span>
            </div>
            {vendorGroups.size > 1 && (
              <p className="text-xs text-slate-500 mt-2">
                각 벤더별로 별도 견적이 요청됩니다.
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}