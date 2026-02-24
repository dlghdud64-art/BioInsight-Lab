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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Copy, Download, Share2, MoreVertical, Plus, Minus, Trash2, X, GitCompare, Languages, Check, ShoppingCart, Ban, CheckCircle2, Search, TrendingDown, Sparkles, ArrowRight, Settings, Target, Loader2, Thermometer, AlertTriangle, AlertCircle, FileText, UploadCloud, Calendar, MapPin } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { QuoteVersionCompare } from "./quote-version-compare";
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
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { trackEvent } from "@/lib/analytics";
import { useSession } from "next-auth/react";
import { getGuestKey } from "@/lib/guest-key";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";

interface QuotePanelProps {
  onQuoteSaved?: (quoteId: string) => void;
}

export function QuotePanel({ onQuoteSaved }: QuotePanelProps = {}) {
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
  const [groupByVendor, setGroupByVendor] = useState(false);
  const [showAdvancedOptimization, setShowAdvancedOptimization] = useState(false);
  const [optimizationConstraints, setOptimizationConstraints] = useState({
    grade: "",
    brand: "",
    maxLeadTime: "",
    budgetLimit: "",
    optimizeFor: "balanced" as "cost" | "leadTime" | "balanced",
    requireSameVendor: false,
  });
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationResult, setOptimizationResult] = useState<any>(null);

  const totalAmount = quoteItems.reduce((sum, item) => sum + (item.lineTotal || 0), 0);

  // 절감 제안 조회
  const { data: costOptimization } = useQuery({
    queryKey: ["cost-optimization", quoteItems.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice || 0,
      lineTotal: item.lineTotal || 0,
    }))],
    queryFn: async () => {
      if (quoteItems.length === 0) return null;

      const response = await fetch("/api/quotes/cost-optimization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteItems: quoteItems.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice || 0,
            lineTotal: item.lineTotal || 0,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch cost optimization");
      }

      return response.json();
    },
    enabled: quoteItems.length > 0,
  });

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
  const toggleSelectQuote = useCallback((id: string) => {
    setSelectedQuoteIds((prev) =>
      prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id]
    );
  }, []);

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

  // 테이블 행 데이터 준비 (로직을 컴포넌트 상단으로 이동)
  const tableRows = useMemo(() => {
    if (quoteItems.length === 0) return [];
    
    let globalIndex = 0;
    return Object.entries(groupedByVendor).flatMap(([vendorName, items]) => {
      const vendorTotal = items.reduce((sum, item) => sum + (item.lineTotal || 0), 0);
      const vendorItemCount = items.length;
      
      const rows: React.ReactNode[] = [];
      
      // 벤더 헤더 행 (그룹화 모드일 때만)
      if (groupByVendor && vendorName !== "전체") {
        rows.push(
          <TableRow key={`vendor-${vendorName}`} className="bg-slate-50 hover:bg-slate-100">
            <TableCell colSpan={2} className="px-3 py-2 text-xs font-semibold text-slate-700 whitespace-nowrap">
              <span className="truncate block" title={vendorName}>{vendorName}</span>
            </TableCell>
            <TableCell colSpan={7} className="px-3 py-2 text-xs text-slate-600">
              {vendorItemCount}개 품목
            </TableCell>
            <TableCell className="px-3 py-2 text-xs font-semibold text-slate-900 text-right">
              <PriceDisplay price={vendorTotal} currency="KRW" />
            </TableCell>
            <TableCell></TableCell>
          </TableRow>
        );
      }
      
      // 품목 행들
      items.forEach((item) => {
        globalIndex++;
        const product = products?.find((p: any) => p.id === item.productId);
        rows.push(
          <TableRow key={item.id} className="h-14 hover:bg-gray-50">
            <TableCell>
              <Checkbox
                checked={selectedQuoteIds.includes(item.id)}
                onCheckedChange={() => toggleSelectQuote(item.id)}
              />
            </TableCell>
            <TableCell className="text-center text-sm text-gray-700">
              {globalIndex}
            </TableCell>
            <TableCell className="text-sm text-gray-900 font-medium">
              {item.productName}
            </TableCell>
            <TableCell className="text-sm text-gray-600">
              {product?.brand || "-"}
            </TableCell>
            <TableCell className="text-sm text-gray-600 font-mono">
              {product?.catalogNumber || "-"}
            </TableCell>
            <TableCell>
              <Input
                type="number"
                min="1"
                value={item.quantity || 1}
                onChange={(e) =>
                  updateQuoteItem(item.id, {
                    quantity: parseInt(e.target.value) || 1,
                  })
                }
                className="w-20 h-9 text-sm"
              />
            </TableCell>
            <TableCell className="text-right text-sm text-gray-900 font-medium">
              <PriceDisplay
                price={item.unitPrice || 0}
                currency="KRW"
              />
            </TableCell>
            <TableCell className="text-right text-sm text-gray-900 font-semibold">
              <PriceDisplay
                price={item.lineTotal || 0}
                currency="KRW"
              />
            </TableCell>
            <TableCell className="text-sm text-gray-500">
              {item.notes || "-"}
            </TableCell>
          </TableRow>
        );
      });
      
      return rows;
    });
  }, [quoteItems, groupedByVendor, groupByVendor, products, selectedQuoteIds, toggleSelectQuote, updateQuoteItem]);

  return (
    <>
    <div className="space-y-6 pb-20 md:pb-0">
      {/* 견적 요청 섹션 */}
      <Card className="rounded-lg border border-slate-200 bg-white">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
            <div className="flex-1">
              <CardTitle className="text-sm font-semibold text-slate-900">
                견적 요청
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 mt-1">
                선택한 품목으로 벤더에 가격/납기 확인을 요청할 수 있어요.
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
            {quoteItems.length === 0 ? (
              <div className="text-center py-16 md:py-20">
                <div className="border-2 border-dashed border-slate-300 rounded-xl p-12 max-w-md mx-auto">
                  <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-6">
                    <ShoppingCart className="w-16 h-16 text-slate-300" strokeWidth={1.5} />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">견적 바구니가 비어있습니다</h3>
                  <p className="text-sm text-gray-500 max-w-md mx-auto mb-6">
                    비교할 제품을 선택하고 견적 요청 목록에 추가해주세요.
                  </p>
                  <Link href="/test/search">
                    <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white">
                      <Search className="h-5 w-5 mr-2" />
                      제품 검색하러 가기
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm bg-white">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">요청 제품 ({quoteItems.length}개)</h2>
                </div>
                
                {/* 데스크톱: 테이블 뷰 */}
                <div className="hidden md:block w-full overflow-x-auto">
                  <Table className="w-full">
                    <TableHeader>
                      <TableRow className="bg-gray-50 hover:bg-gray-50">
                        <TableHead className="text-xs font-bold text-gray-500 uppercase w-16">
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
                        <TableHead className="text-xs font-bold text-gray-500 uppercase w-16"
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
                      <TableHead className="text-xs font-bold text-gray-500 uppercase">제품명</TableHead>
                      <TableHead className="text-xs font-bold text-gray-500 uppercase">브랜드</TableHead>
                      <TableHead className="text-xs font-bold text-gray-500 uppercase">카탈로그 번호</TableHead>
                      <TableHead className="text-xs font-bold text-gray-500 uppercase w-24">수량</TableHead>
                      <TableHead className="text-xs font-bold text-gray-500 uppercase w-32 text-right">예상 단가</TableHead>
                      <TableHead className="text-xs font-bold text-gray-500 uppercase w-32 text-right">예상 금액</TableHead>
                      <TableHead className="text-xs font-bold text-gray-500 uppercase">비고</TableHead>
                      </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tableRows}
                  </TableBody>
                </Table>
                </div>

                {/* 모바일: 카드 리스트 뷰 */}
                <div className="block md:hidden p-4 space-y-4">
                  {quoteItems.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <p className="text-sm">품목이 없습니다.</p>
                    </div>
                  ) : (
                    Object.entries(groupedByVendor).flatMap(([vendorName, items]) => {
                      let globalIndex = 0;
                      return items.map((item) => {
                        globalIndex++;
                        const product = products?.find((p: any) => p.id === item.productId);
                        return (
                          <div
                            key={item.id}
                            className="border border-slate-200 rounded-xl p-4 mb-4 bg-white shadow-sm"
                          >
                            {/* Header: 체크박스 + 브랜드/Cat.No */}
                            <div className="flex items-start justify-between mb-3">
                              <Checkbox
                                checked={selectedQuoteIds.includes(item.id)}
                                onCheckedChange={() => toggleSelectQuote(item.id)}
                                className="h-5 w-5"
                              />
                              <div className="text-right text-xs text-gray-500 ml-4">
                                {product?.brand && <div>{product.brand}</div>}
                                {product?.catalogNumber && (
                                  <div className="font-mono mt-0.5">Cat. {product.catalogNumber}</div>
                                )}
                              </div>
                            </div>

                            {/* Body: 제품명 */}
                            <div className="mb-4">
                              <h3 className="font-bold text-lg break-words text-gray-900">
                                {item.productName}
                              </h3>
                            </div>

                            {/* Footer: 수량 + 합계 금액 */}
                            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                              {/* 수량 조절기 */}
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-9 w-9 rounded-lg"
                                  onClick={() => {
                                    updateQuoteItem(item.id, {
                                      quantity: Math.max(1, (item.quantity || 1) - 1),
                                    });
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
                                    updateQuoteItem(item.id, {
                                      quantity: Math.max(1, qty),
                                    });
                                  }}
                                  className="h-9 w-16 text-center text-sm font-medium p-0 border-slate-300"
                                />
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-9 w-9 rounded-lg"
                                  onClick={() => {
                                    updateQuoteItem(item.id, {
                                      quantity: (item.quantity || 1) + 1,
                                    });
                                  }}
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </div>

                              {/* 합계 금액 */}
                              <div className="text-right">
                                <div className="font-bold text-base text-blue-600 whitespace-nowrap">
                                  <PriceDisplay price={item.lineTotal || 0} currency="KRW" />
                                </div>
                                {item.unitPrice && item.unitPrice > 0 && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    단가: <PriceDisplay price={item.unitPrice} currency="KRW" />
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })
                  )}
                </div>
              </div>
            )}

            {/* 절감 제안 섹션 */}
            {quoteItems.length > 0 && costOptimization && costOptimization.optimizations.length > 0 && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-semibold text-blue-900">절감 제안</span>
                    <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
                      최대 {costOptimization.summary.totalPotentialSavings.toLocaleString("ko-KR")}원 절감 가능
                    </Badge>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => setShowAdvancedOptimization(true)}
                  >
                    <Settings className="h-3 w-3 mr-1" />
                    고급 최적화
                  </Button>
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
                            {(opt.currentPrice * opt.quantity).toLocaleString("ko-KR")}원
                          </div>
                          <div className="text-sm font-semibold text-green-600">
                            {(opt.alternativePrice * opt.quantity).toLocaleString("ko-KR")}원
                          </div>
                          <div className="text-xs font-medium text-green-700">
                            -{opt.savingsRate.toFixed(1)}% ({opt.totalSavings.toLocaleString("ko-KR")}원)
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

            {/* 데스크톱: 하단 액션 버튼 그룹 */}
            {quoteItems.length > 0 && (
              <div className="hidden md:flex flex-col sm:flex-row gap-3 justify-end items-center pt-4 border-t mt-6">
                {/* 총 예상 견적가 - 버튼 왼쪽에 배치 */}
                <div className="flex items-center gap-3 mr-auto">
                  <span className="text-sm text-gray-500">총 예상 견적가:</span>
                  <span className="text-2xl font-bold text-gray-900">
                    ₩{totalAmount.toLocaleString()}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const headers = ["No.", "제품명", "브랜드", "카탈로그 번호", "수량", "예상 단가", "예상 금액", "비고"];
                    const rows = quoteItems.map((item, index) => {
                      const product = products?.find((p: any) => p.id === item.productId);
                      return [
                        (index + 1).toString(),
                        `"${(item.productName || "").replace(/"/g, '""')}"`,
                        `"${(product?.brand || "").replace(/"/g, '""')}"`,
                        `"${(product?.catalogNumber || "").replace(/"/g, '""')}"`,
                        (item.quantity || 1).toString(),
                        (item.unitPrice || 0).toString(),
                        (item.lineTotal || 0).toString(),
                        `"${(item.notes || "").replace(/"/g, '""')}"`,
                      ];
                    });
                    const csvContent = [
                      headers.join(","),
                      ...rows.map((row) => row.join(",")),
                    ].join("\n");
                    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = `견적요청_${new Date().toISOString().split("T")[0]}.csv`;
                    link.click();
                    URL.revokeObjectURL(url);
                    toast({
                      title: "내보내기 완료",
                      description: "CSV 파일이 다운로드되었습니다.",
                    });
                  }}
                  disabled={quoteItems.length === 0}
                  className="w-full sm:w-auto"
                >
                  <Download className="h-4 w-4 mr-2" />
                  CSV 다운로드
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    if (quoteItems.length === 0) {
                      toast({
                        title: "품목이 없습니다",
                        description: "공유할 품목을 먼저 추가해주세요.",
                        variant: "destructive",
                      });
                      return;
                    }
                    try {
                      await generateShareLink("견적 요청 리스트", 30);
                      toast({
                        title: "공유 링크 생성 완료",
                        description: "공유 링크가 생성되었습니다.",
                      });
                    } catch (error: any) {
                      toast({
                        title: "공유 링크 생성 실패",
                        description: error.message || "공유 링크를 생성할 수 없습니다.",
                        variant: "destructive",
                      });
                    }
                  }}
                  disabled={quoteItems.length === 0 || isGeneratingShareLink}
                  className="w-full sm:w-auto"
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  링크 공유
                </Button>
                <Link href="/test/quote/request">
                  <Button
                    type="button"
                    disabled={quoteItems.length === 0}
                    className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-8"
                    size="lg"
                  >
                    <FileText className="h-5 w-5 mr-2" />
                    최종 견적 요청하기
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 모바일: 고정 하단 액션 바 */}
      {quoteItems.length > 0 && (
        <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 p-4 z-50 md:hidden flex flex-col gap-2 shadow-lg">
          <div className="flex items-center justify-end">
            <span className="text-sm text-gray-600 mr-2">총 견적가:</span>
            <span className="text-xl font-bold text-blue-600 whitespace-nowrap">
              ₩{totalAmount.toLocaleString("ko-KR")}
            </span>
          </div>
          <Link href="/test/quote/request" className="block">
            <Button
              type="button"
              disabled={quoteItems.length === 0}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12 font-semibold"
              size="lg"
            >
              <FileText className="h-5 w-5 mr-2" />
              최종 견적 요청하기
            </Button>
          </Link>
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
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 고급 최적화 다이얼로그 */}
      <Dialog open={showAdvancedOptimization} onOpenChange={setShowAdvancedOptimization}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              제약조건 기반 조합 최적화
            </DialogTitle>
            <DialogDescription>
              Grade, 브랜드, 납기, 예산 등 제약조건을 설정하여 최적의 제품 조합을 찾습니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="opt-grade" className="text-xs">Grade 제약조건</Label>
                <Input
                  id="opt-grade"
                  placeholder="예: HPLC grade, GMP"
                  value={optimizationConstraints.grade}
                  onChange={(e) => setOptimizationConstraints({ ...optimizationConstraints, grade: e.target.value })}
                  className="text-xs h-8"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="opt-brand" className="text-xs">브랜드 제약조건</Label>
                <Input
                  id="opt-brand"
                  placeholder="예: Sigma, Thermo"
                  value={optimizationConstraints.brand}
                  onChange={(e) => setOptimizationConstraints({ ...optimizationConstraints, brand: e.target.value })}
                  className="text-xs h-8"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="opt-leadtime" className="text-xs">최대 납기일 (일)</Label>
                <Input
                  id="opt-leadtime"
                  type="number"
                  placeholder="예: 30"
                  value={optimizationConstraints.maxLeadTime}
                  onChange={(e) => setOptimizationConstraints({ ...optimizationConstraints, maxLeadTime: e.target.value })}
                  className="text-xs h-8"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="opt-budget" className="text-xs">예산 한도 (원)</Label>
                <Input
                  id="opt-budget"
                  type="number"
                  placeholder="예: 1000000"
                  value={optimizationConstraints.budgetLimit}
                  onChange={(e) => setOptimizationConstraints({ ...optimizationConstraints, budgetLimit: e.target.value })}
                  className="text-xs h-8"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">최적화 목표</Label>
              <Select
                value={optimizationConstraints.optimizeFor}
                onValueChange={(value: "cost" | "leadTime" | "balanced") =>
                  setOptimizationConstraints({ ...optimizationConstraints, optimizeFor: value })
                }
              >
                <SelectTrigger className="text-xs h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cost">비용 최소화</SelectItem>
                  <SelectItem value="leadTime">납기 최소화</SelectItem>
                  <SelectItem value="balanced">균형 (비용+납기)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="opt-same-vendor"
                checked={optimizationConstraints.requireSameVendor}
                onCheckedChange={(checked) =>
                  setOptimizationConstraints({ ...optimizationConstraints, requireSameVendor: checked as boolean })
                }
              />
              <Label htmlFor="opt-same-vendor" className="text-xs cursor-pointer">
                동일 벤더에서 구매 필수
              </Label>
            </div>
            <Button
              className="w-full"
              onClick={async () => {
                setIsOptimizing(true);
                try {
                  const response = await fetch("/api/quotes/optimize-combination", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      items: quoteItems.map((item) => ({
                        productId: item.productId,
                        quantity: item.quantity,
                      })),
                      globalConstraints: {
                        ...(optimizationConstraints.grade && { grade: optimizationConstraints.grade }),
                        ...(optimizationConstraints.brand && { brand: optimizationConstraints.brand }),
                        ...(optimizationConstraints.maxLeadTime && {
                          maxLeadTime: parseInt(optimizationConstraints.maxLeadTime),
                        }),
                        requireSameVendor: optimizationConstraints.requireSameVendor,
                      },
                      ...(optimizationConstraints.budgetLimit && {
                        budgetLimit: parseInt(optimizationConstraints.budgetLimit),
                      }),
                      optimizeFor: optimizationConstraints.optimizeFor,
                    }),
                  });

                  if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || "최적화 실패");
                  }

                  const result = await response.json();
                  setOptimizationResult(result);
                  toast({
                    title: "최적화 완료",
                    description: result.allConstraintsSatisfied
                      ? `${result.totalSavings.toLocaleString("ko-KR")} 절감 가능`
                      : "일부 제약조건을 만족하지 못했습니다.",
                  });
                } catch (error: any) {
                  toast({
                    title: "최적화 실패",
                    description: error.message || "최적화 중 오류가 발생했습니다.",
                    variant: "destructive",
                  });
                } finally {
                  setIsOptimizing(false);
                }
              }}
              disabled={isOptimizing || quoteItems.length === 0}
            >
              {isOptimizing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  최적화 중...
                </>
              ) : (
                <>
                  <Target className="h-4 w-4 mr-2" />
                  최적 조합 찾기
                </>
              )}
            </Button>

            {/* 최적화 결과 */}
            {optimizationResult && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-green-900">최적화 결과</div>
                    <div className="text-xs text-green-700">
                      총 비용: {optimizationResult.totalCost.toLocaleString("ko-KR")}원
                      {optimizationResult.totalSavings > 0 && (
                        <span className="ml-2">
                          (절감: {optimizationResult.totalSavings.toLocaleString("ko-KR")}원)
                        </span>
                      )}
                    </div>
                    {optimizationResult.averageLeadTime && (
                      <div className="text-xs text-green-700">
                        평균 납기: {optimizationResult.averageLeadTime.toFixed(1)}일
                      </div>
                    )}
                  </div>
                  {optimizationResult.allConstraintsSatisfied ? (
                    <Badge variant="default" className="bg-green-600">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      제약조건 충족
                    </Badge>
                  ) : (
                    <Badge variant="destructive">
                      <Ban className="h-3 w-3 mr-1" />
                      제약조건 미충족
                    </Badge>
                  )}
                </div>
                {optimizationResult.constraintViolations.length > 0 && (
                  <div className="text-xs text-red-600 space-y-1">
                    {optimizationResult.constraintViolations.map((violation: string, idx: number) => (
                      <div key={idx}>• {violation}</div>
                    ))}
                  </div>
                )}
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {optimizationResult.items.map((item: any, idx: number) => (
                    <div key={idx} className="p-2 bg-white rounded border border-green-100">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-slate-900">
                            {item.originalProductName}
                          </div>
                          {item.selectedProductId !== item.originalProductId && (
                            <div className="flex items-center gap-1 mt-1">
                              <ArrowRight className="h-3 w-3 text-slate-400" />
                              <span className="text-xs text-slate-600">{item.selectedProductName}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-slate-500">{item.selectedVendorName}</span>
                            {item.leadTime && (
                              <Badge variant="outline" className="text-[10px]">
                                납기 {item.leadTime}일
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold text-green-600">
{item.totalPrice.toLocaleString("ko-KR")}원
                          </div>
                          {item.selectedProductId !== item.originalProductId && (
                            <div className="text-xs text-slate-500">
                              유사도 {Math.round(item.similarity * 100)}%
                            </div>
                          )}
                        </div>
                      </div>
                      {item.selectedProductId !== item.originalProductId && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full mt-2 text-xs h-7"
                          onClick={() => {
                            const quoteItem = quoteItems.find((i) => i.productId === item.originalProductId);
                            if (quoteItem) {
                              updateQuoteItem(quoteItem.id, {
                                productId: item.selectedProductId,
                                productName: item.selectedProductName,
                                vendorName: item.selectedVendorName,
                                unitPrice: item.unitPrice,
                                lineTotal: item.totalPrice,
                              });
                              toast({
                                title: "제품 교체 완료",
                                description: `${item.originalProductName} → ${item.selectedProductName}`,
                              });
                              setShowAdvancedOptimization(false);
                            }
                          }}
                        >
                          <Check className="h-3 w-3 mr-1" />
                          이 조합 적용
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdvancedOptimization(false)}>
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </>
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

  const totalAmount = quoteItems.reduce((sum, item) => sum + (item.lineTotal || 0), 0);

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
      await generateShareLink(shareTitle || "견적 요청 리스트", expiresInDays);
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
      item.unitPrice ? `${item.unitPrice.toLocaleString("ko-KR")}` : "",
      item.lineTotal ? `${item.lineTotal.toLocaleString("ko-KR")}` : "",
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
      
      // Analytics: list_export_tsv 이벤트 추적
      trackEvent("list_export_tsv", {
        item_count: quoteItems.length,
        total_amount: totalAmount,
      });
      
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

    // Analytics: list_export_tsv 이벤트 추적
    trackEvent("list_export_tsv", {
      item_count: quoteItems.length,
      total_amount: totalAmount,
    });

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
      item.unitPrice ? `"${item.unitPrice.toLocaleString("ko-KR")}"` : '""',
      item.lineTotal ? `"${item.lineTotal.toLocaleString("ko-KR")}"` : '""',
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

    // Analytics: list_export_csv 이벤트 추적
    trackEvent("list_export_csv", {
      item_count: quoteItems.length,
      total_amount: totalAmount,
    });

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
                이 링크를 공유하면 다른 사람이 견적 요청 리스트를 볼 수 있습니다.
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
                  견적 요청 리스트를 공유할 수 있는 링크를 생성합니다.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="share-title">제목 (선택사항)</Label>
                  <Input
                    id="share-title"
                    value={shareTitle}
                    onChange={(e) => setShareTitle(e.target.value)}
                    placeholder="견적 요청 리스트"
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

interface QuoteRequestPanelProps {
  vendorNotes?: Record<string, string>;
  onVendorNoteChange?: (vendorId: string, note: string) => void;
}

export function QuoteRequestPanel({ 
  vendorNotes = {},
  onVendorNoteChange
}: QuoteRequestPanelProps = {}) {
  const { quoteItems, products } = useTestFlow();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const quoteId = searchParams.get("quoteId");
  
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryDateOption, setDeliveryDateOption] = useState<"asap" | "custom" | "none">("none");
  const [deliveryLocation, setDeliveryLocation] = useState<"none" | "saved" | "custom">("none");
  const [deliveryLocationCustom, setDeliveryLocationCustom] = useState("");
  const [savedDeliveryAddress, setSavedDeliveryAddress] = useState<string>("");
  const [specialNotes, setSpecialNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // 저장 상태 관리
  const [saveStatus, setSaveStatus] = useState<"unsaved" | "saving" | "saved" | "temp_saved">("unsaved");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [guestKey, setGuestKey] = useState<string>("");
  
  // 공유 상태 관리
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [isShareEnabled, setIsShareEnabled] = useState(false);
  const [expiresInDays, setExpiresInDays] = useState<number>(30);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [shareLinkInfo, setShareLinkInfo] = useState<{ publicId: string; expiresAt?: string; isActive: boolean } | null>(null);
  const [copied, setCopied] = useState(false);
  const [isCreatingShareLink, setIsCreatingShareLink] = useState(false);

  // guestKey 초기화
  useEffect(() => {
    setGuestKey(getGuestKey());
  }, []);

  // URL에 quoteId가 있으면 기존 견적 요청 리스트 불러오기
  const { data: existingQuoteList, isLoading: isLoadingQuoteList } = useQuery({
    queryKey: ["quote-list", quoteId],
    queryFn: async () => {
      if (!quoteId) return null;
      const response = await fetch(`/api/quote-lists/${quoteId}`, {
        headers: {
          "x-guest-key": guestKey,
        },
      });
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error("견적 요청 리스트를 불러올 수 없습니다.");
      }
      return response.json();
    },
    enabled: !!quoteId && !!guestKey,
  });

  // 기존 견적 요청 리스트 데이터로 폼 채우기
  useEffect(() => {
    if (existingQuoteList) {
      if (existingQuoteList.title) setTitle(existingQuoteList.title);
      if (existingQuoteList.message) setMessage(existingQuoteList.message);
      if (existingQuoteList.updatedAt) {
        setLastSavedAt(new Date(existingQuoteList.updatedAt));
        setSaveStatus(session?.user ? "saved" : "temp_saved");
      }
    }
  }, [existingQuoteList, session]);

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
        const suggestedMessage = `안녕하세요.\n\n아래 품목 ${productCount}건에 대한 견적을 요청드립니다.\n\n품목 수: ${productCount}개\n예상 금액: ${totalAmount.toLocaleString("ko-KR")}\n\n빠른 견적 부탁드립니다.\n감사합니다.`;
        setMessage(suggestedMessage);
      } else {
        // 여러 벤더인 경우 - 첫 번째 벤더의 메시지를 기본으로 사용하되, 각 벤더별로 맞춘 메시지 생성
        const firstVendorItems = Array.from(vendorGroups.values())[0];
        const productCount = firstVendorItems.length;
        const totalAmount = firstVendorItems.reduce((sum, item) => sum + (item.lineTotal || 0), 0);
        const suggestedMessage = `안녕하세요.\n\n아래 품목 ${productCount}건에 대한 견적을 요청드립니다.\n\n품목 수: ${productCount}개\n예상 금액: ${totalAmount.toLocaleString("ko-KR")}\n\n빠른 견적 부탁드립니다.\n감사합니다.`;
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

  // 저장 함수 (임시 저장 또는 저장)
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!guestKey) {
        throw new Error("guestKey가 없습니다.");
      }

      const items = quoteItems.map((item) => ({
        productId: item.productId || undefined,
        name: item.productName || "제품명 없음",
        vendor: item.vendorName || undefined,
        brand: undefined,
        catalogNumber: undefined,
        unitPrice: item.unitPrice || undefined,
        quantity: item.quantity || 1,
        lineTotal: item.lineTotal || undefined,
        notes: item.notes || undefined,
        snapshot: undefined,
      }));

      const url = quoteId ? `/api/quote-lists/${quoteId}` : "/api/quote-lists";
      const method = quoteId ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "x-guest-key": guestKey,
        },
        body: JSON.stringify({
          title: title || "견적 요청서",
          message: message || "",
          ...(quoteId ? {} : { items }),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "저장에 실패했습니다.");
      }

      const result = await response.json();
      
      // quoteId가 없었으면 URL에 추가
      if (!quoteId && result.id) {
        router.replace(`/test/quote/request?quoteId=${result.id}`, { scroll: false });
      }

      // items 업데이트 (quoteId가 있을 때)
      if (quoteId && items.length > 0) {
        const itemsResponse = await fetch(`/api/quote-lists/${quoteId}/items`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "x-guest-key": guestKey,
          },
          body: JSON.stringify({ items }),
        });

        if (!itemsResponse.ok) {
          throw new Error("품목 저장에 실패했습니다.");
        }
      }

      return result;
    },
    onSuccess: (data) => {
      setSaveStatus(session?.user ? "saved" : "temp_saved");
      setLastSavedAt(new Date());
      queryClient.invalidateQueries({ queryKey: ["quote-list", quoteId || data.id] });
      toast({
        title: session?.user ? "저장 완료" : "임시 저장 완료",
        description: session?.user 
          ? "견적 요청 리스트가 저장되었습니다."
          : "견적 요청 리스트가 임시 저장되었습니다.",
      });
    },
    onError: (error: Error) => {
      setSaveStatus("unsaved");
      toast({
        title: "저장 실패",
        description: error.message || "저장 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  const handleSave = async () => {
    setSaveStatus("saving");
    saveMutation.mutate();
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
      // 벤더별 메시지 준비
      const vendorMessages: Record<string, string> = {};
      const vendorGroupsForSubmit = new Map<string, typeof quoteItems>();
      quoteItems.forEach((item) => {
        const vendorId = item.vendorId || "unknown";
        if (!vendorGroupsForSubmit.has(vendorId)) {
          vendorGroupsForSubmit.set(vendorId, []);
        }
        vendorGroupsForSubmit.get(vendorId)!.push(item);
      });

      // 각 벤더별로 공통 메시지와 개별 메시지 합치기
      vendorGroupsForSubmit.forEach((items, vendorId) => {
        const globalMessage = message || "";
        const vendorNote = vendorNotes[vendorId] || "";
        if (vendorNote) {
          vendorMessages[vendorId] = globalMessage 
            ? `${globalMessage}\n\n[개별요청]: ${vendorNote}`
            : `[개별요청]: ${vendorNote}`;
        } else {
          vendorMessages[vendorId] = globalMessage;
        }
      });

      const response = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title || "견적 요청",
          message: message || "", // 공통 메시지 (백엔드 호환성)
          vendorMessages: Object.keys(vendorMessages).length > 0 ? vendorMessages : undefined, // 벤더별 메시지
          guestKey: !session?.user ? guestKey : undefined, // 게스트 사용자 인증
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

  // 저장 상태 텍스트 생성
  const getSaveStatusText = () => {
    if (saveStatus === "saving") return "저장중...";
    if (saveStatus === "saved") {
      if (lastSavedAt) {
        const timeAgo = formatDistanceToNow(lastSavedAt, { addSuffix: true, locale: ko });
        return `저장됨 • ${timeAgo}`;
      }
      return "저장됨";
    }
    if (saveStatus === "temp_saved") {
      if (lastSavedAt) {
        const timeAgo = formatDistanceToNow(lastSavedAt, { addSuffix: true, locale: ko });
        return `임시저장됨 • ${timeAgo}`;
      }
      return "임시저장됨";
    }
    return "저장 안됨";
  };

  if (isLoadingQuoteList) {
    return (
      <Card className="rounded-lg border border-slate-200 bg-white">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
          <span className="ml-2 text-xs text-slate-500">견적 요청 리스트 불러오는 중...</span>
        </CardContent>
      </Card>
    );
  }

  // 공유 링크 생성/업데이트
  const handleShareToggle = async (enabled: boolean) => {
    setIsShareEnabled(enabled);
    
    if (!enabled) {
      // 공유 비활성화
      if (shareLinkInfo?.publicId) {
        try {
          const response = await fetch(`/api/shared-lists/${shareLinkInfo.publicId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isActive: false }),
          });
          if (response.ok) {
            setShareLinkInfo((prev) => prev ? { ...prev, isActive: false } : null);
            toast({
              title: "공유 비활성화",
              description: "공유 링크가 비활성화되었습니다.",
            });
          }
        } catch (error) {
          // Failed to deactivate share link
        }
      }
      return;
    }

    // 공유 활성화 - 로그인 확인
    if (!session?.user) {
      toast({
        title: "로그인 필요",
        description: "공유 링크를 생성하려면 로그인이 필요합니다.",
        variant: "destructive",
      });
      setIsShareEnabled(false);
      return;
    }

    // 공유 활성화 - quoteId가 없으면 먼저 저장 필요
    if (!quoteId) {
      toast({
        title: "저장 필요",
        description: "공유 링크를 생성하려면 먼저 저장해주세요.",
        variant: "destructive",
      });
      setIsShareEnabled(false);
      return;
    }

    // 공유 링크 생성
    setIsCreatingShareLink(true);
    try {
      // quote-lists의 ID를 Quote ID로 사용 (나중에 quote-lists용 공유 링크 API 추가 필요)
      const response = await fetch("/api/shared-lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteId: quoteId,
          title: title || "견적 요청서",
          description: message || undefined,
          expiresInDays: expiresInDays || 30,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "공유 링크 생성에 실패했습니다.");
      }

      const data = await response.json();
      const shareUrl = `${window.location.origin}/shared-list/${data.publicId}`;
      setShareLink(shareUrl);
      setShareLinkInfo({
        publicId: data.publicId,
        expiresAt: expiresInDays > 0 ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString() : undefined,
        isActive: true,
      });
      
      toast({
        title: "공유 링크 생성 완료",
        description: expiresInDays > 0 
          ? `공유 링크가 생성되었습니다. ${expiresInDays}일 후 만료됩니다.`
          : "공유 링크가 생성되었습니다. (만료 없음)",
      });
    } catch (error: any) {
      setIsShareEnabled(false);
      toast({
        title: "공유 링크 생성 실패",
        description: error.message || "공유 링크를 생성할 수 없습니다.",
        variant: "destructive",
      });
    } finally {
      setIsCreatingShareLink(false);
    }
  };

  // 링크 복사
  const handleCopyLink = async () => {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink);
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

  return (
    <div className="space-y-4">
      {/* 상단 헤더 */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-lg font-semibold text-slate-900">견적 요청 작성</h2>
            {quoteId && (
              <Badge variant="secondary" className="text-xs">
                기존 리스트 불러옴
              </Badge>
            )}
          </div>
          <p className="text-sm text-slate-500">
            {(() => {
              const vendorCount = new Set(quoteItems.map(item => item.vendorId)).size;
              if (vendorCount > 1) {
                return `${vendorCount}개 벤더에 개별 견적 요청`;
              }
              return "벤더에게 견적을 요청하세요";
            })()}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* 저장 상태 표시 */}
          <div className="text-xs text-slate-500 whitespace-nowrap">
            {getSaveStatusText()}
          </div>
          {/* 공유 버튼 */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsShareDialogOpen(true)}
            className="text-xs h-8"
          >
            <Share2 className="h-3 w-3 mr-1" />
            공유
          </Button>
        </div>
      </div>

      <form id="quote-request-form" onSubmit={handleSubmit} className="space-y-4">
        {/* Section 1: 기본 정보 */}
        <Card className="bg-white p-4 md:p-6 rounded-lg border border-slate-200 shadow-sm">
          <CardHeader className="px-0 pt-0 pb-3">
            <CardTitle className="text-base font-semibold">기본 정보</CardTitle>
          </CardHeader>
          <CardContent className="px-0 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="quote-title" className="text-sm font-medium">
                제목 *
              </Label>
              <Input
                id="quote-title"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  // 제목 변경 시 저장 상태를 unsaved로 변경
                  if (saveStatus !== "saving") {
                    setSaveStatus("unsaved");
                  }
                }}
                placeholder="견적 요청 제목"
                required
                className="text-sm"
                disabled={!quoteId && isLoadingQuoteList}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="quote-message" className="text-sm font-medium">
                📦 배송 및 공통 요청사항 (모든 벤더에게 전송됨)
              </Label>
              <Textarea
                id="quote-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="예: 점심시간(12-1시) 배송 제외, 102호로 배송 부탁드립니다."
                className="text-sm min-h-[100px]"
              />
            </div>
          </CardContent>
        </Card>

        {/* Section 2: 배송 및 일정 (Grid로 압축) */}
        <Card className="bg-white p-4 md:p-6 rounded-lg border border-slate-200 shadow-sm">
          <CardHeader className="px-0 pt-0 pb-3">
            <CardTitle className="text-base font-semibold">배송 및 일정</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="delivery-date" className="text-sm font-medium flex items-center gap-1">
                  <Calendar className="w-4 h-4 text-slate-500" />
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
                <Label htmlFor="delivery-location" className="text-sm font-medium flex items-center gap-1">
                  <MapPin className="w-4 h-4 text-slate-500" />
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
          </CardContent>
        </Card>

        {/* Section: 파일 첨부 */}
        <Card className="bg-white p-4 md:p-6 rounded-lg border border-slate-200 shadow-sm">
          <CardHeader className="px-0 pt-0 pb-3">
            <CardTitle className="text-base font-semibold flex items-center justify-between">
              첨부 파일
              <span className="text-xs text-muted-foreground font-normal">선택사항</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <div
              role="button"
              tabIndex={0}
              onClick={() => document.getElementById("quote-file-upload")?.click()}
              onKeyDown={(e) => e.key === "Enter" && document.getElementById("quote-file-upload")?.click()}
              className="border-2 border-dashed border-slate-200 rounded-lg bg-slate-50 p-8 flex flex-col items-center justify-center text-center hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <input
                id="quote-file-upload"
                type="file"
                multiple
                accept=".pdf,.xlsx,.xls,.doc,.docx"
                className="sr-only"
                aria-label="파일 첨부"
              />
              <UploadCloud className="h-8 w-8 text-slate-400 mb-3" />
              <p className="text-sm font-medium text-slate-700">
                클릭하거나 파일을 이곳으로 드래그하세요
              </p>
              <p className="text-xs text-slate-500 mt-1">
                PDF, Excel, Word 지원 (최대 10MB)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Section 3: 추가 요청 */}
        <Card className="bg-white p-4 md:p-6 rounded-lg border border-slate-200 shadow-sm">
          <CardHeader className="px-0 pt-0 pb-3">
            <CardTitle className="text-base font-semibold">추가 요청</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <div className="space-y-2">
              <Label htmlFor="special-notes" className="text-sm font-medium">
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
          </CardContent>
        </Card>

        {/* 저장 버튼 (모바일에서만 표시) */}
        <div className="lg:hidden space-y-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleSave}
            disabled={saveMutation.isPending || !guestKey}
            className="w-full"
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                저장 중...
              </>
            ) : session?.user ? (
              "저장"
            ) : (
              "임시 저장"
            )}
          </Button>
          <Button
            type="submit"
            className="w-full bg-slate-900 text-white hover:bg-slate-800"
            disabled={isSubmitting || quoteItems.length === 0}
          >
            {isSubmitting ? "전송 중..." : "견적 요청하기"}
          </Button>
        </div>
      </form>

      {/* 공유 모달 */}
      <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>공유 설정</DialogTitle>
            <DialogDescription>
              견적 요청 리스트를 공유할 수 있는 링크를 생성합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* 공유 on/off 토글 */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="share-toggle" className="text-sm font-medium">
                  공유 활성화
                </Label>
                <p className="text-xs text-slate-500">
                  공유 링크를 생성하여 다른 사람과 공유할 수 있습니다.
                </p>
              </div>
              <Switch
                id="share-toggle"
                checked={isShareEnabled}
                onCheckedChange={handleShareToggle}
                disabled={isCreatingShareLink || !quoteId || !session?.user}
              />
            </div>

            {!session?.user && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs text-amber-800">
                  공유 링크를 생성하려면 로그인이 필요합니다.
                </p>
              </div>
            )}
            {session?.user && !quoteId && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs text-amber-800">
                  공유 링크를 생성하려면 먼저 견적 요청 리스트를 저장해주세요.
                </p>
              </div>
            )}

            {/* 만료기간 선택 */}
            {isShareEnabled && quoteId && (
              <div className="space-y-2">
                <Label htmlFor="expires-in-days" className="text-sm font-medium">
                  만료 기간
                </Label>
                <Select
                  value={expiresInDays.toString()}
                  onValueChange={(value) => setExpiresInDays(parseInt(value) || 0)}
                  disabled={isCreatingShareLink}
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
            )}

            {/* 공유 링크 표시 */}
            {shareLink && shareLinkInfo?.isActive && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">공유 링크</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={shareLink}
                    readOnly
                    className="flex-1 text-xs font-mono bg-slate-50"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyLink}
                    className="h-9"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {shareLinkInfo.expiresAt && (
                  <p className="text-xs text-slate-500">
                    만료일: {new Date(shareLinkInfo.expiresAt).toLocaleDateString("ko-KR")}
                  </p>
                )}
              </div>
            )}

            {isCreatingShareLink && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                <span className="ml-2 text-xs text-slate-500">공유 링크 생성 중...</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsShareDialogOpen(false)}
            >
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface QuoteItemsSummaryPanelProps {
  vendorNotes?: Record<string, string>;
  onVendorNoteChange?: (vendorId: string, note: string) => void;
}

export function QuoteItemsSummaryPanel({ 
  vendorNotes = {},
  onVendorNoteChange
}: QuoteItemsSummaryPanelProps = {}) {
  const { quoteItems, products } = useTestFlow();
  const { data: session } = useSession();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
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
      <Card className="rounded-lg border border-slate-200 bg-white">
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
    <div className="sticky top-24 h-fit">
      <Card className="rounded-lg border-2 border-blue-100 bg-white shadow-md shadow-[0_4px_14px_0_rgba(147,197,253,0.2)]">
        <CardHeader className="border-b border-slate-200 bg-slate-50/50">
          <CardTitle className="text-base font-semibold text-slate-900">견적 요약</CardTitle>
          <CardDescription className="text-xs text-slate-500">
            요청할 품목 {quoteItems.length}개
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="space-y-4 p-6">
            {/* 벤더별 품목 리스트 */}
            <div className="max-h-[400px] overflow-y-auto space-y-4">
              {Array.from(vendorGroups.entries()).map(([vendorId, { vendorName, items }], vendorIndex) => {
                const vendorTotal = items.reduce((sum, item) => sum + (item.lineTotal || 0), 0);
                return (
                  <div key={vendorId} className="space-y-3">
                    {vendorGroups.size > 1 && (
                      <div className="flex items-center gap-2 pb-2 border-b-2 border-blue-200">
                        <span className="text-sm font-bold text-slate-900 whitespace-nowrap truncate" title={vendorName}>
                          {vendorIndex + 1}. {vendorName}
                        </span>
                        <Badge variant="outline" className="text-xs bg-blue-50">
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
                            className="flex items-start justify-between gap-2 p-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-slate-900 truncate">
                                {vendorGroups.size === 1 ? `${itemIndex + 1}. ` : ""}{product?.name || item.productName || "제품"}
                              </div>
                              <div className="text-xs text-slate-500 mt-1">
                                수량: {item.quantity} ×{" "}
                                <PriceDisplay
                                  price={item.unitPrice || 0}
                                  currency="KRW"
                                />
                              </div>
                            </div>
                            <div className="text-sm font-bold text-slate-900 whitespace-nowrap">
                              <PriceDisplay
                                price={item.lineTotal || 0}
                                currency="KRW"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {/* 벤더별 개별 메시지 입력창 */}
                    {vendorGroups.size > 1 && onVendorNoteChange && (
                      <div className="mt-3 pt-3 border-t border-slate-200">
                        <Label htmlFor={`vendor-note-${vendorId}`} className="text-xs font-medium text-slate-700 mb-1 block">
                          이 벤더에게만 보낼 메시지
                        </Label>
                        <Textarea
                          id={`vendor-note-${vendorId}`}
                          value={vendorNotes[vendorId] || ""}
                          onChange={(e) => onVendorNoteChange(vendorId, e.target.value)}
                          placeholder="예: 특정 Lot 번호 요청, 유통기한 확인 등 이 벤더에게만 보낼 메시지"
                          className="bg-gray-50 border rounded p-2 text-sm w-full min-h-[60px]"
                        />
                      </div>
                    )}
                    {vendorGroups.size > 1 && (
                      <div className="flex items-center justify-between pt-2 border-t border-slate-200 bg-slate-50/50 p-2 rounded">
                        <span className="text-sm font-semibold text-slate-700">{vendorName} 소계</span>
                        <span className="text-sm font-bold text-slate-900">
                          ₩{vendorTotal.toLocaleString("ko-KR")}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          
          {/* 총계 및 액션 */}
          <div className="border-t-2 border-slate-200 bg-slate-50/50 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-base font-semibold text-slate-700">총 예상 금액</span>
              <span className="text-3xl font-bold text-blue-600">
                ₩{totalAmount.toLocaleString("ko-KR")}
              </span>
            </div>
            
            {vendorGroups.size > 1 && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs font-medium text-blue-900">
                      효율적인 처리를 위해 {vendorGroups.size}개의 견적서로 나뉘어 발송됩니다.
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {/* 액션 버튼 */}
            <div className="space-y-2">
              <Button
                type="button"
                onClick={() => {
                  const form = document.getElementById('quote-request-form') as HTMLFormElement;
                  if (form) {
                    setIsSubmitting(true);
                    form.requestSubmit();
                    // form 제출 후 상태 리셋은 form의 onsubmit에서 처리됨
                    setTimeout(() => setIsSubmitting(false), 3000);
                  }
                }}
                className="w-full h-14 text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all"
                disabled={isSubmitting || quoteItems.length === 0}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    전송 중...
                  </>
                ) : (
                  <>
                    <FileText className="h-5 w-5 mr-2" />
                    견적 요청하기
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}