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
import { PriceDisplay } from "@/components/products/price-display";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Copy, Download, Share2, MoreVertical, Plus, Trash2, X, GitCompare, Languages, Check, ShoppingCart } from "lucide-react";
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
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export function QuotePanel() {
  const {
    quoteItems,
    updateQuoteItem,
    removeQuoteItem,
    shareLink,
    isGeneratingShareLink,
    generateShareLink,
  } = useTestFlow();
  const { toast } = useToast();
  const [selectedQuoteIds, setSelectedQuoteIds] = useState<string[]>([]);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  const totalAmount = quoteItems.reduce((sum, item) => sum + (item.lineTotal || 0), 0);

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
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold text-slate-900">
                구매 요청 품목
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 mt-1">
                그룹웨어/전자결재에 올릴 최종 품목과 수량을 확인하는 화면입니다.
              </CardDescription>
            </div>
            <Button variant="secondary" size="sm" className="text-xs" disabled>
              <Plus className="h-3 w-3 mr-1" />
              품목 추가
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          {quoteItems.length > 0 ? (
            <div className="space-y-4">
              {/* 선택 액션바 */}
              {selectedQuoteIds.length > 0 && (
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

              {/* 테이블 */}
              <div className="overflow-x-auto -mx-4 px-4">
                <div className="inline-block min-w-full align-middle">
                  <Table className="min-w-[900px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12 text-xs">
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
                        </TableHead>
                        <TableHead className="w-16 text-xs whitespace-nowrap">No.</TableHead>
                        <TableHead className="min-w-[200px] text-xs whitespace-nowrap">제품명</TableHead>
                        <TableHead className="min-w-[120px] text-xs whitespace-nowrap">벤더</TableHead>
                        <TableHead className="min-w-[100px] text-right text-xs whitespace-nowrap">단가</TableHead>
                        <TableHead className="min-w-[80px] text-right text-xs whitespace-nowrap">수량</TableHead>
                        <TableHead className="min-w-[120px] text-right text-xs whitespace-nowrap">금액</TableHead>
                        <TableHead className="min-w-[100px] text-center text-xs whitespace-nowrap">비교</TableHead>
                        <TableHead className="w-10 text-center text-xs text-slate-400"></TableHead>
                        <TableHead className="w-12 text-xs"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {quoteItems.map((item, index) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedQuoteIds.includes(item.id)}
                              onCheckedChange={() => toggleSelectQuote(item.id)}
                            />
                          </TableCell>
                          <TableCell className="font-medium text-xs whitespace-nowrap">
                            {index + 1}
                          </TableCell>
                          <TableCell className="text-xs min-w-[200px]">
                            <div className="max-w-[200px] truncate" title={item.productName}>
                              {item.productName}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs min-w-[120px] whitespace-nowrap">
                            {item.vendorName}
                          </TableCell>
                          <TableCell className="text-right text-xs whitespace-nowrap min-w-[100px]">
                            <PriceDisplay
                              amount={item.unitPrice || 0}
                              currency={item.currency || "KRW"}
                            />
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap min-w-[80px]">
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
                          <TableCell className="text-right font-medium text-xs whitespace-nowrap min-w-[120px]">
                            <PriceDisplay
                              amount={item.lineTotal || 0}
                              currency={item.currency || "KRW"}
                            />
                          </TableCell>
                          <TableCell className="text-center min-w-[100px]">
                            <Link href="/compare">
                              <Button variant="ghost" size="sm" className="h-7 text-xs">
                                <GitCompare className="h-3 w-3 mr-1" />
                                비교
                              </Button>
                            </Link>
                          </TableCell>
                          <TableCell className="text-center">
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
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* 총합 */}
              <div className="flex justify-end pt-2 border-t">
                <div className="text-right">
                  <div className="text-xs text-slate-500">총합</div>
                  <div className="text-lg font-bold text-slate-900">
                    ₩{totalAmount.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* 견적 요청 버튼 */}
              <div className="flex justify-end pt-2">
                <Link href="/test/quote/request">
                  <Button className="bg-slate-900 text-white hover:bg-slate-800 text-xs h-8">
                    <Plus className="h-3 w-3 mr-2" />
                    견적 요청하기
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 border border-dashed border-slate-300 rounded-lg">
              <p className="text-sm text-slate-600 mb-2">아직 추가된 품목이 없습니다.</p>
              <p className="text-xs text-slate-500">
                Step 1에서 제품을 검색하고 '품목에 추가'를 눌러 리스트를 만들어 보세요.
              </p>
            </div>
          )}
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