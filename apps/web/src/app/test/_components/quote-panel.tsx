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

export function SharePanel() {
  const {
    shareLink,
    isGeneratingShareLink,
    generateShareLink,
    quoteItems,
  } = useTestFlow();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [shareTitle, setShareTitle] = useState("");
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [expiresInDays, setExpiresInDays] = useState<number>(30);

  const handleCopyTable = async () => {
    if (quoteItems.length === 0) {
      toast({
        title: "품목이 없습니다",
        description: "복사할 품목을 먼저 추가해주세요.",
        variant: "destructive",
      });
      return;
    }

    const headers = [
      "Line No.",
      "제품명",
      "벤더",
      "단가",
      "통화",
      "수량",
      "금액",
      "비고",
    ];

    const rows = quoteItems.map((item, index) => [
      (index + 1).toString(),
      item.productName || "",
      item.vendorName || "",
      (item.unitPrice || 0).toLocaleString(),
      item.currency || "KRW",
      (item.quantity || 1).toString(),
      (item.lineTotal || 0).toLocaleString(),
      item.notes || "",
    ]);

    const tsv = [headers, ...rows].map((row) => row.join("\t")).join("\n");

    try {
      await navigator.clipboard.writeText(tsv);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "복사 완료",
        description: "품목 리스트가 클립보드에 복사되었습니다.",
      });
    } catch (error) {
      toast({
        title: "복사 실패",
        description: "클립보드 복사에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleDownloadCSV = () => {
    if (quoteItems.length === 0) {
      toast({
        title: "품목이 없습니다",
        description: "다운로드할 품목을 먼저 추가해주세요.",
        variant: "destructive",
      });
      return;
    }

    const headers = [
      "Line No.",
      "제품명",
      "벤더",
      "단가",
      "통화",
      "수량",
      "금액",
      "비고",
    ];

    const rows = quoteItems.map((item, index) => [
      (index + 1).toString(),
      `"${item.productName || ""}"`,
      `"${item.vendorName || ""}"`,
      (item.unitPrice || 0).toLocaleString(),
      item.currency || "KRW",
      (item.quantity || 1).toString(),
      (item.lineTotal || 0).toLocaleString(),
      `"${item.notes || ""}"`,
    ]);

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `품목리스트-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "다운로드 완료",
      description: "CSV 파일이 다운로드되었습니다.",
    });
  };

  const handleGenerateShareLink = async () => {
    try {
      await generateShareLink(shareTitle || "품목 리스트", expiresInDays);
      setIsShareDialogOpen(false);
      toast({
        title: "공유 링크 생성 완료",
        description: "구매담당자에게 공유할 수 있는 링크가 생성되었습니다.",
      });
    } catch (error: any) {
      toast({
        title: "공유 링크 생성 실패",
        description: error.message || "알 수 없는 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleCopyLink = async () => {
    if (shareLink) {
      try {
        await navigator.clipboard.writeText(shareLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast({
          title: "링크 복사 완료",
          description: "공유 링크가 클립보드에 복사되었습니다.",
        });
      } catch (error) {
        toast({
          title: "복사 실패",
          description: "링크 복사에 실패했습니다.",
          variant: "destructive",
        });
      }
    }
  };

  const isEmpty = quoteItems.length === 0;

  return (
    <Card className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-sm font-semibold text-slate-900">
          구매 요청서 내보내기
        </CardTitle>
        <CardDescription className="text-xs text-slate-500 mt-1">
          표 복사, 파일 다운로드, 구매 담당자에게 전달할 보기 링크를 생성해서 전자결재/구매요청에 활용할 수 있습니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        {/* 표 복사 */}
        <div className="flex items-center justify-between py-3 border-b border-slate-200 last:border-0">
          <div className="flex-1">
            <div className="text-sm font-medium text-slate-900">전자결재 양식용 표 데이터 복사</div>
            <div className="text-xs text-slate-500 mt-0.5">
              그룹웨어 전자결재 양식의 표/텍스트 영역에 바로 붙여넣을 수 있는 탭(탭 문자) 구분 텍스트로 복사합니다.
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyTable}
            disabled={isEmpty}
            className="ml-4 text-xs h-8"
          >
            {copied ? (
              <>
                <X className="h-3 w-3 mr-1" />
                복사됨
              </>
            ) : (
              <>
                <Copy className="h-3 w-3 mr-1" />
                복사
              </>
            )}
          </Button>
        </div>

        {/* 엑셀 다운로드 */}
        <div className="flex items-center justify-between py-3 border-b border-slate-200 last:border-0">
          <div className="flex-1">
            <div className="text-sm font-medium text-slate-900">엑셀/CSV 다운로드</div>
            <div className="text-xs text-slate-500 mt-0.5">
              구매요청 문서에 첨부하거나 다른 내부 시스템으로 가져갈 수 있는 파일 형식으로 다운로드합니다.
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadCSV}
            disabled={isEmpty}
            className="ml-4 text-xs h-8"
          >
            <Download className="h-3 w-3 mr-1" />
            다운로드
          </Button>
        </div>

        {/* 공유 링크 */}
        <div className="py-3">
          <div className="flex-1 mb-2">
            <div className="text-sm font-medium text-slate-900">구매담당자용 보기 링크</div>
            <div className="text-xs text-slate-500 mt-0.5">
              사내 구매 담당자가 브라우저에서 품목 리스트를 확인할 수 있는 읽기 전용 링크입니다. 벤더에게 전달하는 용도가 아니라, 내부 결재/커뮤니케이션용 링크입니다.
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Input
              value={shareLink || ""}
              readOnly
              placeholder="아직 생성된 링크가 없습니다. '링크 생성'을 눌러 구매 담당자용 보기 링크를 만들 수 있습니다."
              className="flex-1 text-xs h-8"
            />
            {shareLink ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyLink}
                className="text-xs h-8"
              >
                {copied ? (
                  <>
                    <X className="h-3 w-3 mr-1" />
                    복사됨
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3 mr-1" />
                    복사
                  </>
                )}
              </Button>
            ) : (
              <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="default"
                    size="sm"
                    disabled={isEmpty || isGeneratingShareLink}
                    className="text-xs h-8 bg-slate-900 hover:bg-slate-800"
                  >
                    <Share2 className="h-3 w-3 mr-1" />
                    링크 생성
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>공유 링크 생성</DialogTitle>
                    <DialogDescription>
                      구매담당자용 보기 링크를 생성합니다. 만료일을 설정할 수 있습니다.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="share-title">링크 제목</Label>
                      <Input
                        id="share-title"
                        value={shareTitle}
                        onChange={(e) => setShareTitle(e.target.value)}
                        placeholder="예: 2024년 1분기 구매 요청"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="expires-in-days">만료일 설정</Label>
                      <Select
                        value={expiresInDays.toString()}
                        onValueChange={(v) => setExpiresInDays(parseInt(v))}
                      >
                        <SelectTrigger className="mt-1">
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
                      <p className="text-xs text-muted-foreground mt-1">
                        만료일이 지나면 링크가 자동으로 비활성화됩니다.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setIsShareDialogOpen(false)}
                        className="flex-1"
                      >
                        취소
                      </Button>
                      <Button
                        onClick={handleGenerateShareLink}
                        disabled={isGeneratingShareLink}
                        className="flex-1 bg-slate-900 hover:bg-slate-800"
                      >
                        {isGeneratingShareLink ? (
                          <>
                            <Share2 className="h-3 w-3 mr-1 animate-spin" />
                            생성 중...
                          </>
                        ) : (
                          <>
                            <Share2 className="h-3 w-3 mr-1" />
                            링크 생성
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {isEmpty && (
          <div className="pt-2 border-t">
            <p className="text-xs text-slate-500 text-center">
              먼저 위에서 구매 요청 품목을 추가해 주세요.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// 구매 요청 품목 요약 패널
export function QuoteItemsSummaryPanel() {
  const { quoteItems } = useTestFlow();
  
  const totalAmount = quoteItems.reduce((sum, item) => sum + (item.lineTotal || 0), 0);

  return (
    <Card className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-sm font-semibold text-slate-900">
              구매 요청 품목
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 mt-1">
              이번 견적 요청에 포함될 품목과 금액입니다.
            </CardDescription>
          </div>
          <Link href="/test/quote">
            <Button variant="secondary" size="sm" className="text-xs h-7">
              품목 편집
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        {quoteItems.length > 0 ? (
          <div className="space-y-3">
            {/* 품목 리스트 */}
            <div className="max-h-72 overflow-y-auto space-y-2">
              {quoteItems.map((item, idx) => {
                const unitPrice = item.unitPrice || 0;
                const quantity = item.quantity || 1;
                const lineTotal = item.lineTotal || unitPrice * quantity;

                return (
                  <div
                    key={item.id}
                    className="flex items-start justify-between rounded-md border border-slate-200 bg-white px-3 py-2"
                  >
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="text-xs font-semibold text-slate-900">
                        {idx + 1}. {item.productName}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {item.vendorName || "벤더 없음"} · {quantity}개 ×{" "}
                        {unitPrice > 0
                          ? `₩${unitPrice.toLocaleString("ko-KR")}`
                          : "가격 문의"}{" "}
                        = ₩{lineTotal.toLocaleString("ko-KR")}
                      </div>
                    </div>
                    <div className="ml-3 text-xs font-semibold text-slate-900 whitespace-nowrap">
                      ₩{lineTotal.toLocaleString("ko-KR")}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 총합 요약 */}
            <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3">
              <div className="text-[11px] text-slate-500">
                총 {quoteItems.length}개 품목
              </div>
              <div className="text-xs font-semibold text-slate-900">
                총합 ₩{totalAmount.toLocaleString("ko-KR")}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-xs text-slate-600 mb-1">
              아직 추가된 품목이 없습니다.
            </p>
            <p className="text-[11px] text-slate-500">
              Step 3에서 제품을 선택하고 '품목에 추가'를 눌러 주세요.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// QuoteRequestPanel은 그대로 유지
export function QuoteRequestPanel() {
  const { quoteItems } = useTestFlow();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [specialNotes, setSpecialNotes] = useState("");
  const [englishText, setEnglishText] = useState<string | null>(null);
  const [englishSubject, setEnglishSubject] = useState<string | null>(null);
  const [isGeneratingEnglish, setIsGeneratingEnglish] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [pendingValues, setPendingValues] = useState<{
    title: string;
    message: string;
    deliveryDate: string;
    deliveryLocation: string;
    specialNotes: string;
  } | null>(null);

  // 총합 계산
  const totalAmount = quoteItems.reduce((sum, item) => sum + (item.lineTotal || 0), 0);

  // 폼 유효성 검사
  const validateForm = (): boolean => {
    if (quoteItems.length === 0) {
      toast({
        title: "품목이 없습니다",
        description: "견적을 요청할 품목을 먼저 추가해주세요.",
        variant: "destructive",
      });
      return false;
    }
    if (!title.trim()) {
      toast({
        title: "견적 제목을 입력해주세요",
        description: "견적 제목은 필수 항목입니다.",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  // 확인 모달 열기 (폼 검증 후)
  const handleConfirmClick = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    // 폼 값을 pendingValues에 저장
    setPendingValues({
      title: title || `제품 견적 요청 (${quoteItems.length}개)`,
      message,
      deliveryDate,
      deliveryLocation,
      specialNotes,
    });

    // 모달 열기
    setIsConfirmDialogOpen(true);
  };

  // 최종 견적 요청 (모달에서 호출)
  const handleFinalSubmit = async () => {
    if (!pendingValues || quoteItems.length === 0) {
      return;
    }

    setIsSubmitting(true);

    try {
      const items = quoteItems.map((item, index) => ({
        productId: item.productId,
        lineNumber: index + 1,
        quantity: item.quantity || 1,
        unitPrice: item.unitPrice || 0,
        currency: item.currency || "KRW",
        lineTotal: item.lineTotal || 0,
        notes: item.notes || "",
      }));

      const response = await fetch("/api/quotes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: pendingValues.title,
          message: pendingValues.message,
          deliveryDate: pendingValues.deliveryDate || undefined,
          deliveryLocation: pendingValues.deliveryLocation,
          specialNotes: pendingValues.specialNotes,
          items,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "견적 요청에 실패했습니다.");
      }

      const data = await response.json();
      
      // 모달 닫기
      setIsConfirmDialogOpen(false);
      
      toast({
        title: "견적 요청 완료",
        description: "견적 요청이 성공적으로 전송되었습니다.",
      });
      
      // 폼 초기화
      setTitle("");
      setMessage("");
      setDeliveryDate("");
      setDeliveryLocation("");
      setSpecialNotes("");
      setEnglishText(null);
      setEnglishSubject(null);
      setPendingValues(null);
      
      // 품목 리스트 페이지로 이동
      window.location.href = "/test/quote";
    } catch (error: any) {
      toast({
        title: "견적 요청 실패",
        description: error.message || "견적 요청 중 오류가 발생했습니다.",
        variant: "destructive",
      });
      console.error("Error submitting quote:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateEnglish = async () => {
    if (quoteItems.length === 0) {
      toast({
        title: "품목이 없습니다",
        description: "견적을 요청할 품목을 먼저 추가해주세요.",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingEnglish(true);
    try {
      const items = quoteItems.map((item, index) => ({
        productId: item.productId,
        lineNumber: index + 1,
        quantity: item.quantity || 1,
        unitPrice: item.unitPrice || 0,
        currency: item.currency || "KRW",
        lineTotal: item.lineTotal || 0,
        notes: item.notes || "",
      }));

      const response = await fetch("/api/quotes/generate-english", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          message,
          deliveryDate,
          deliveryLocation,
          specialNotes,
          items,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "영문 텍스트 생성에 실패했습니다.");
      }

      const data = await response.json();
      setEnglishText(data.englishText);
      setEnglishSubject(data.subject);
      toast({
        title: "생성 완료",
        description: "영문 견적 요청 텍스트가 생성되었습니다.",
      });
    } catch (error: any) {
      toast({
        title: "생성 실패",
        description: error.message || "영문 텍스트 생성 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingEnglish(false);
    }
  };

  const handleCopyEnglish = async () => {
    if (!englishText) return;

    const fullText = englishSubject
      ? `Subject: ${englishSubject}\n\n${englishText}`
      : englishText;

    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "복사 완료",
        description: "영문 텍스트가 클립보드에 복사되었습니다.",
      });
    } catch (error) {
      toast({
        title: "복사 실패",
        description: "텍스트 복사에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold text-slate-800">
          견적 요청
        </CardTitle>
        <CardDescription className="text-xs text-slate-500">
          품목 리스트를 기반으로 견적을 요청합니다.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleConfirmClick} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="quote-title" className="text-xs font-medium">
              견적 제목
            </label>
            <Input
              id="quote-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: PCR 시약 견적 요청"
              className="text-xs h-8"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="quote-message" className="text-xs font-medium">
              요청 내용
            </label>
            <Textarea
              id="quote-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="기본 요청 사항을 작성해주세요"
              rows={3}
              className="text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="delivery-date" className="text-xs font-medium">
                납기 희망일
              </label>
              <Input
                id="delivery-date"
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="text-xs h-8"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="delivery-location" className="text-xs font-medium">
                납품 장소
              </label>
              <Input
                id="delivery-location"
                value={deliveryLocation}
                onChange={(e) => setDeliveryLocation(e.target.value)}
                placeholder="예: 서울대학교 생명과학관 101호"
                className="text-xs h-8"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="special-notes" className="text-xs font-medium">
              특이사항
            </label>
            <Textarea
              id="special-notes"
              value={specialNotes}
              onChange={(e) => setSpecialNotes(e.target.value)}
              placeholder="특별한 요구사항이나 주의사항을 작성해주세요"
              rows={2}
              className="text-xs"
            />
          </div>

          <div className="pt-2 border-t space-y-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleGenerateEnglish}
              disabled={isGeneratingEnglish || quoteItems.length === 0}
              className="w-full text-xs h-8"
            >
              {isGeneratingEnglish ? "생성 중..." : "영문 견적 요청 텍스트 생성"}
            </Button>

            {englishText && (
              <div className="p-3 bg-slate-50 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold">생성된 영문 텍스트</h4>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleCopyEnglish}
                    className="h-6 text-xs"
                  >
                    {copied ? "복사됨" : "복사"}
                  </Button>
                </div>
                {englishSubject && (
                  <div className="text-xs text-slate-500">
                    <strong>Subject:</strong> {englishSubject}
                  </div>
                )}
                <div className="text-xs whitespace-pre-wrap border rounded p-2 bg-white max-h-48 overflow-y-auto">
                  {englishText}
                </div>
              </div>
            )}
          </div>

          <div className="pt-2 border-t">
            <Button
              type="button"
              onClick={handleConfirmClick}
              disabled={isSubmitting || quoteItems.length === 0}
              className="w-full bg-slate-900 text-white hover:bg-slate-800 text-xs h-8"
            >
              견적 요청 내용 확인
            </Button>
          </div>
        </form>

        {/* 확인 모달 */}
        <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-slate-900">
                견적 요청 내용 확인
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-1">
                아래 내용으로 견적 요청을 전송합니다. 한 번 더 확인해 주세요.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* 폼 요약 */}
              <div className="space-y-3">
                <div className="grid grid-cols-[80px,1fr] gap-2 text-xs">
                  <div className="text-slate-500">견적 제목</div>
                  <div className="text-slate-900 font-medium">{pendingValues?.title || "-"}</div>
                </div>

                <div className="grid grid-cols-[80px,1fr] gap-2 text-xs">
                  <div className="text-slate-500">요청 내용</div>
                  <div className="text-slate-900">
                    {pendingValues?.message
                      ? pendingValues.message.length > 100
                        ? `${pendingValues.message.substring(0, 100)}…`
                        : pendingValues.message
                      : "-"}
                  </div>
                </div>

                <div className="grid grid-cols-[80px,1fr] gap-2 text-xs">
                  <div className="text-slate-500">납기 희망일</div>
                  <div className="text-slate-900">
                    {pendingValues?.deliveryDate
                      ? new Date(pendingValues.deliveryDate).toLocaleDateString("ko-KR")
                      : "-"}
                  </div>
                </div>

                <div className="grid grid-cols-[80px,1fr] gap-2 text-xs">
                  <div className="text-slate-500">납품 장소</div>
                  <div className="text-slate-900">{pendingValues?.deliveryLocation || "-"}</div>
                </div>

                {pendingValues?.specialNotes && (
                  <div className="grid grid-cols-[80px,1fr] gap-2 text-xs">
                    <div className="text-slate-500">특이사항</div>
                    <div className="text-slate-900">
                      {pendingValues.specialNotes.length > 100
                        ? `${pendingValues.specialNotes.substring(0, 100)}…`
                        : pendingValues.specialNotes}
                    </div>
                  </div>
                )}
              </div>

              {/* 요청 품목 요약 */}
              <div className="pt-3 border-t">
                <div className="mb-2">
                  <div className="text-xs font-semibold text-slate-700 mb-1">요청 품목 요약</div>
                  <div className="text-[11px] text-slate-500">
                    이번 견적 요청에 포함될 품목과 수량입니다.
                  </div>
                </div>

                {quoteItems.length > 0 ? (
                  <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-xs font-semibold text-slate-700">요청 품목</div>
                      <div className="text-[11px] text-slate-500">
                        총 {quoteItems.length}개 · 합계 ₩{totalAmount.toLocaleString("ko-KR")}
                      </div>
                    </div>

                    <div className="max-h-48 overflow-y-auto rounded-md bg-white">
                      <Table>
                        <TableHeader>
                          <TableRow className="h-8">
                            <TableHead className="w-12 text-[10px] px-2">No.</TableHead>
                            <TableHead className="text-[10px] px-2">제품명</TableHead>
                            <TableHead className="text-[10px] px-2">벤더</TableHead>
                            <TableHead className="w-16 text-right text-[10px] px-2">수량</TableHead>
                            <TableHead className="w-24 text-right text-[10px] px-2">금액</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {quoteItems.map((item, index) => (
                            <TableRow key={item.id} className="h-8">
                              <TableCell className="text-[11px] px-2 font-medium">
                                {index + 1}
                              </TableCell>
                              <TableCell className="text-[11px] px-2">
                                <div className="max-w-[150px] truncate" title={item.productName}>
                                  {item.productName}
                                </div>
                              </TableCell>
                              <TableCell className="text-[11px] px-2">
                                <div className="max-w-[100px] truncate" title={item.vendorName}>
                                  {item.vendorName}
                                </div>
                              </TableCell>
                              <TableCell className="text-right text-[11px] px-2">
                                {item.quantity || 1}
                              </TableCell>
                              <TableCell className="text-right text-[11px] px-2 font-medium">
                                ₩{(item.lineTotal || 0).toLocaleString("ko-KR")}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
                    <p className="text-xs text-slate-500">
                      아직 추가된 품목이 없습니다. Step 3에서 먼저 품목을 추가해 주세요.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="secondary"
                onClick={() => setIsConfirmDialogOpen(false)}
                disabled={isSubmitting}
                className="text-xs"
              >
                수정하기
              </Button>
              <Button
                onClick={handleFinalSubmit}
                disabled={isSubmitting || quoteItems.length === 0}
                className="text-xs bg-slate-900 hover:bg-slate-800"
              >
                {isSubmitting ? "처리 중..." : "최종 견적 요청"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

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

export function SharePanel() {
  const {
    shareLink,
    isGeneratingShareLink,
    generateShareLink,
    quoteItems,
  } = useTestFlow();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [shareTitle, setShareTitle] = useState("");
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [expiresInDays, setExpiresInDays] = useState<number>(30);

  const handleCopyTable = async () => {
    if (quoteItems.length === 0) {
      toast({
        title: "품목이 없습니다",
        description: "복사할 품목을 먼저 추가해주세요.",
        variant: "destructive",
      });
      return;
    }

    const headers = [
      "Line No.",
      "제품명",
      "벤더",
      "단가",
      "통화",
      "수량",
      "금액",
      "비고",
    ];

    const rows = quoteItems.map((item, index) => [
      (index + 1).toString(),
      item.productName || "",
      item.vendorName || "",
      (item.unitPrice || 0).toLocaleString(),
      item.currency || "KRW",
      (item.quantity || 1).toString(),
      (item.lineTotal || 0).toLocaleString(),
      item.notes || "",
    ]);

    const tsv = [headers, ...rows].map((row) => row.join("\t")).join("\n");

    try {
      await navigator.clipboard.writeText(tsv);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "복사 완료",
        description: "품목 리스트가 클립보드에 복사되었습니다.",
      });
    } catch (error) {
      toast({
        title: "복사 실패",
        description: "클립보드 복사에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleDownloadCSV = () => {
    if (quoteItems.length === 0) {
      toast({
        title: "품목이 없습니다",
        description: "다운로드할 품목을 먼저 추가해주세요.",
        variant: "destructive",
      });
      return;
    }

    const headers = [
      "Line No.",
      "제품명",
      "벤더",
      "단가",
      "통화",
      "수량",
      "금액",
      "비고",
    ];

    const rows = quoteItems.map((item, index) => [
      (index + 1).toString(),
      `"${item.productName || ""}"`,
      `"${item.vendorName || ""}"`,
      (item.unitPrice || 0).toLocaleString(),
      item.currency || "KRW",
      (item.quantity || 1).toString(),
      (item.lineTotal || 0).toLocaleString(),
      `"${item.notes || ""}"`,
    ]);

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `품목리스트-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "다운로드 완료",
      description: "CSV 파일이 다운로드되었습니다.",
    });
  };

  const handleGenerateShareLink = async () => {
    try {
      await generateShareLink(shareTitle || "품목 리스트", expiresInDays);
      setIsShareDialogOpen(false);
      toast({
        title: "공유 링크 생성 완료",
        description: "구매담당자에게 공유할 수 있는 링크가 생성되었습니다.",
      });
    } catch (error: any) {
      toast({
        title: "공유 링크 생성 실패",
        description: error.message || "알 수 없는 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleCopyLink = async () => {
    if (shareLink) {
      try {
        await navigator.clipboard.writeText(shareLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast({
          title: "링크 복사 완료",
          description: "공유 링크가 클립보드에 복사되었습니다.",
        });
      } catch (error) {
        toast({
          title: "복사 실패",
          description: "링크 복사에 실패했습니다.",
          variant: "destructive",
        });
      }
    }
  };

  const isEmpty = quoteItems.length === 0;

  return (
    <Card className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-sm font-semibold text-slate-900">
          구매 요청서 내보내기
        </CardTitle>
        <CardDescription className="text-xs text-slate-500 mt-1">
          표 복사, 파일 다운로드, 구매 담당자에게 전달할 보기 링크를 생성해서 전자결재/구매요청에 활용할 수 있습니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        {/* 표 복사 */}
        <div className="flex items-center justify-between py-3 border-b border-slate-200 last:border-0">
          <div className="flex-1">
            <div className="text-sm font-medium text-slate-900">전자결재 양식용 표 데이터 복사</div>
            <div className="text-xs text-slate-500 mt-0.5">
              그룹웨어 전자결재 양식의 표/텍스트 영역에 바로 붙여넣을 수 있는 탭(탭 문자) 구분 텍스트로 복사합니다.
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyTable}
            disabled={isEmpty}
            className="ml-4 text-xs h-8"
          >
            {copied ? (
              <>
                <X className="h-3 w-3 mr-1" />
                복사됨
              </>
            ) : (
              <>
                <Copy className="h-3 w-3 mr-1" />
                복사
              </>
            )}
          </Button>
        </div>

        {/* 엑셀 다운로드 */}
        <div className="flex items-center justify-between py-3 border-b border-slate-200 last:border-0">
          <div className="flex-1">
            <div className="text-sm font-medium text-slate-900">엑셀/CSV 다운로드</div>
            <div className="text-xs text-slate-500 mt-0.5">
              구매요청 문서에 첨부하거나 다른 내부 시스템으로 가져갈 수 있는 파일 형식으로 다운로드합니다.
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadCSV}
            disabled={isEmpty}
            className="ml-4 text-xs h-8"
          >
            <Download className="h-3 w-3 mr-1" />
            다운로드
          </Button>
        </div>

        {/* 공유 링크 */}
        <div className="py-3">
          <div className="flex-1 mb-2">
            <div className="text-sm font-medium text-slate-900">구매담당자용 보기 링크</div>
            <div className="text-xs text-slate-500 mt-0.5">
              사내 구매 담당자가 브라우저에서 품목 리스트를 확인할 수 있는 읽기 전용 링크입니다. 벤더에게 전달하는 용도가 아니라, 내부 결재/커뮤니케이션용 링크입니다.
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Input
              value={shareLink || ""}
              readOnly
              placeholder="아직 생성된 링크가 없습니다. '링크 생성'을 눌러 구매 담당자용 보기 링크를 만들 수 있습니다."
              className="flex-1 text-xs h-8"
            />
            {shareLink ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyLink}
                className="text-xs h-8"
              >
                {copied ? (
                  <>
                    <X className="h-3 w-3 mr-1" />
                    복사됨
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3 mr-1" />
                    복사
                  </>
                )}
              </Button>
            ) : (
              <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="default"
                    size="sm"
                    disabled={isEmpty || isGeneratingShareLink}
                    className="text-xs h-8 bg-slate-900 hover:bg-slate-800"
                  >
                    <Share2 className="h-3 w-3 mr-1" />
                    링크 생성
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>공유 링크 생성</DialogTitle>
                    <DialogDescription>
                      구매담당자용 보기 링크를 생성합니다. 만료일을 설정할 수 있습니다.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="share-title">링크 제목</Label>
                      <Input
                        id="share-title"
                        value={shareTitle}
                        onChange={(e) => setShareTitle(e.target.value)}
                        placeholder="예: 2024년 1분기 구매 요청"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="expires-in-days">만료일 설정</Label>
                      <Select
                        value={expiresInDays.toString()}
                        onValueChange={(v) => setExpiresInDays(parseInt(v))}
                      >
                        <SelectTrigger className="mt-1">
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
                      <p className="text-xs text-muted-foreground mt-1">
                        만료일이 지나면 링크가 자동으로 비활성화됩니다.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setIsShareDialogOpen(false)}
                        className="flex-1"
                      >
                        취소
                      </Button>
                      <Button
                        onClick={handleGenerateShareLink}
                        disabled={isGeneratingShareLink}
                        className="flex-1 bg-slate-900 hover:bg-slate-800"
                      >
                        {isGeneratingShareLink ? (
                          <>
                            <Share2 className="h-3 w-3 mr-1 animate-spin" />
                            생성 중...
                          </>
                        ) : (
                          <>
                            <Share2 className="h-3 w-3 mr-1" />
                            링크 생성
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {isEmpty && (
          <div className="pt-2 border-t">
            <p className="text-xs text-slate-500 text-center">
              먼저 위에서 구매 요청 품목을 추가해 주세요.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// 구매 요청 품목 요약 패널
export function QuoteItemsSummaryPanel() {
  const { quoteItems } = useTestFlow();
  
  const totalAmount = quoteItems.reduce((sum, item) => sum + (item.lineTotal || 0), 0);

  return (
    <Card className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-sm font-semibold text-slate-900">
              구매 요청 품목
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 mt-1">
              이번 견적 요청에 포함될 품목과 금액입니다.
            </CardDescription>
          </div>
          <Link href="/test/quote">
            <Button variant="secondary" size="sm" className="text-xs h-7">
              품목 편집
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        {quoteItems.length > 0 ? (
          <div className="space-y-3">
            {/* 품목 리스트 */}
            <div className="max-h-72 overflow-y-auto space-y-2">
              {quoteItems.map((item, idx) => {
                const unitPrice = item.unitPrice || 0;
                const quantity = item.quantity || 1;
                const lineTotal = item.lineTotal || unitPrice * quantity;

                return (
                  <div
                    key={item.id}
                    className="flex items-start justify-between rounded-md border border-slate-200 bg-white px-3 py-2"
                  >
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="text-xs font-semibold text-slate-900">
                        {idx + 1}. {item.productName}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {item.vendorName || "벤더 없음"} · {quantity}개 ×{" "}
                        {unitPrice > 0
                          ? `₩${unitPrice.toLocaleString("ko-KR")}`
                          : "가격 문의"}{" "}
                        = ₩{lineTotal.toLocaleString("ko-KR")}
                      </div>
                    </div>
                    <div className="ml-3 text-xs font-semibold text-slate-900 whitespace-nowrap">
                      ₩{lineTotal.toLocaleString("ko-KR")}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 총합 요약 */}
            <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3">
              <div className="text-[11px] text-slate-500">
                총 {quoteItems.length}개 품목
              </div>
              <div className="text-xs font-semibold text-slate-900">
                총합 ₩{totalAmount.toLocaleString("ko-KR")}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-xs text-slate-600 mb-1">
              아직 추가된 품목이 없습니다.
            </p>
            <p className="text-[11px] text-slate-500">
              Step 3에서 제품을 선택하고 '품목에 추가'를 눌러 주세요.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// QuoteRequestPanel은 그대로 유지
export function QuoteRequestPanel() {
  const { quoteItems } = useTestFlow();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [specialNotes, setSpecialNotes] = useState("");
  const [englishText, setEnglishText] = useState<string | null>(null);
  const [englishSubject, setEnglishSubject] = useState<string | null>(null);
  const [isGeneratingEnglish, setIsGeneratingEnglish] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [pendingValues, setPendingValues] = useState<{
    title: string;
    message: string;
    deliveryDate: string;
    deliveryLocation: string;
    specialNotes: string;
  } | null>(null);

  // 총합 계산
  const totalAmount = quoteItems.reduce((sum, item) => sum + (item.lineTotal || 0), 0);

  // 폼 유효성 검사
  const validateForm = (): boolean => {
    if (quoteItems.length === 0) {
      toast({
        title: "품목이 없습니다",
        description: "견적을 요청할 품목을 먼저 추가해주세요.",
        variant: "destructive",
      });
      return false;
    }
    if (!title.trim()) {
      toast({
        title: "견적 제목을 입력해주세요",
        description: "견적 제목은 필수 항목입니다.",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  // 확인 모달 열기 (폼 검증 후)
  const handleConfirmClick = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    // 폼 값을 pendingValues에 저장
    setPendingValues({
      title: title || `제품 견적 요청 (${quoteItems.length}개)`,
      message,
      deliveryDate,
      deliveryLocation,
      specialNotes,
    });

    // 모달 열기
    setIsConfirmDialogOpen(true);
  };

  // 최종 견적 요청 (모달에서 호출)
  const handleFinalSubmit = async () => {
    if (!pendingValues || quoteItems.length === 0) {
      return;
    }

    setIsSubmitting(true);

    try {
      const items = quoteItems.map((item, index) => ({
        productId: item.productId,
        lineNumber: index + 1,
        quantity: item.quantity || 1,
        unitPrice: item.unitPrice || 0,
        currency: item.currency || "KRW",
        lineTotal: item.lineTotal || 0,
        notes: item.notes || "",
      }));

      const response = await fetch("/api/quotes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: pendingValues.title,
          message: pendingValues.message,
          deliveryDate: pendingValues.deliveryDate || undefined,
          deliveryLocation: pendingValues.deliveryLocation,
          specialNotes: pendingValues.specialNotes,
          items,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "견적 요청에 실패했습니다.");
      }

      const data = await response.json();
      
      // 모달 닫기
      setIsConfirmDialogOpen(false);
      
      toast({
        title: "견적 요청 완료",
        description: "견적 요청이 성공적으로 전송되었습니다.",
      });
      
      // 폼 초기화
      setTitle("");
      setMessage("");
      setDeliveryDate("");
      setDeliveryLocation("");
      setSpecialNotes("");
      setEnglishText(null);
      setEnglishSubject(null);
      setPendingValues(null);
      
      // 품목 리스트 페이지로 이동
      window.location.href = "/test/quote";
    } catch (error: any) {
      toast({
        title: "견적 요청 실패",
        description: error.message || "견적 요청 중 오류가 발생했습니다.",
        variant: "destructive",
      });
      console.error("Error submitting quote:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateEnglish = async () => {
    if (quoteItems.length === 0) {
      toast({
        title: "품목이 없습니다",
        description: "견적을 요청할 품목을 먼저 추가해주세요.",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingEnglish(true);
    try {
      const items = quoteItems.map((item, index) => ({
        productId: item.productId,
        lineNumber: index + 1,
        quantity: item.quantity || 1,
        unitPrice: item.unitPrice || 0,
        currency: item.currency || "KRW",
        lineTotal: item.lineTotal || 0,
        notes: item.notes || "",
      }));

      const response = await fetch("/api/quotes/generate-english", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          message,
          deliveryDate,
          deliveryLocation,
          specialNotes,
          items,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "영문 텍스트 생성에 실패했습니다.");
      }

      const data = await response.json();
      setEnglishText(data.englishText);
      setEnglishSubject(data.subject);
      toast({
        title: "생성 완료",
        description: "영문 견적 요청 텍스트가 생성되었습니다.",
      });
    } catch (error: any) {
      toast({
        title: "생성 실패",
        description: error.message || "영문 텍스트 생성 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingEnglish(false);
    }
  };

  const handleCopyEnglish = async () => {
    if (!englishText) return;

    const fullText = englishSubject
      ? `Subject: ${englishSubject}\n\n${englishText}`
      : englishText;

    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "복사 완료",
        description: "영문 텍스트가 클립보드에 복사되었습니다.",
      });
    } catch (error) {
      toast({
        title: "복사 실패",
        description: "텍스트 복사에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold text-slate-800">
          견적 요청
        </CardTitle>
        <CardDescription className="text-xs text-slate-500">
          품목 리스트를 기반으로 견적을 요청합니다.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleConfirmClick} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="quote-title" className="text-xs font-medium">
              견적 제목
            </label>
            <Input
              id="quote-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: PCR 시약 견적 요청"
              className="text-xs h-8"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="quote-message" className="text-xs font-medium">
              요청 내용
            </label>
            <Textarea
              id="quote-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="기본 요청 사항을 작성해주세요"
              rows={3}
              className="text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="delivery-date" className="text-xs font-medium">
                납기 희망일
              </label>
              <Input
                id="delivery-date"
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="text-xs h-8"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="delivery-location" className="text-xs font-medium">
                납품 장소
              </label>
              <Input
                id="delivery-location"
                value={deliveryLocation}
                onChange={(e) => setDeliveryLocation(e.target.value)}
                placeholder="예: 서울대학교 생명과학관 101호"
                className="text-xs h-8"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="special-notes" className="text-xs font-medium">
              특이사항
            </label>
            <Textarea
              id="special-notes"
              value={specialNotes}
              onChange={(e) => setSpecialNotes(e.target.value)}
              placeholder="특별한 요구사항이나 주의사항을 작성해주세요"
              rows={2}
              className="text-xs"
            />
          </div>

          <div className="pt-2 border-t space-y-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleGenerateEnglish}
              disabled={isGeneratingEnglish || quoteItems.length === 0}
              className="w-full text-xs h-8"
            >
              {isGeneratingEnglish ? "생성 중..." : "영문 견적 요청 텍스트 생성"}
            </Button>

            {englishText && (
              <div className="p-3 bg-slate-50 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold">생성된 영문 텍스트</h4>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleCopyEnglish}
                    className="h-6 text-xs"
                  >
                    {copied ? "복사됨" : "복사"}
                  </Button>
                </div>
                {englishSubject && (
                  <div className="text-xs text-slate-500">
                    <strong>Subject:</strong> {englishSubject}
                  </div>
                )}
                <div className="text-xs whitespace-pre-wrap border rounded p-2 bg-white max-h-48 overflow-y-auto">
                  {englishText}
                </div>
              </div>
            )}
          </div>

          <div className="pt-2 border-t">
            <Button
              type="button"
              onClick={handleConfirmClick}
              disabled={isSubmitting || quoteItems.length === 0}
              className="w-full bg-slate-900 text-white hover:bg-slate-800 text-xs h-8"
            >
              견적 요청 내용 확인
            </Button>
          </div>
        </form>

        {/* 확인 모달 */}
        <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-slate-900">
                견적 요청 내용 확인
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-1">
                아래 내용으로 견적 요청을 전송합니다. 한 번 더 확인해 주세요.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* 폼 요약 */}
              <div className="space-y-3">
                <div className="grid grid-cols-[80px,1fr] gap-2 text-xs">
                  <div className="text-slate-500">견적 제목</div>
                  <div className="text-slate-900 font-medium">{pendingValues?.title || "-"}</div>
                </div>

                <div className="grid grid-cols-[80px,1fr] gap-2 text-xs">
                  <div className="text-slate-500">요청 내용</div>
                  <div className="text-slate-900">
                    {pendingValues?.message
                      ? pendingValues.message.length > 100
                        ? `${pendingValues.message.substring(0, 100)}…`
                        : pendingValues.message
                      : "-"}
                  </div>
                </div>

                <div className="grid grid-cols-[80px,1fr] gap-2 text-xs">
                  <div className="text-slate-500">납기 희망일</div>
                  <div className="text-slate-900">
                    {pendingValues?.deliveryDate
                      ? new Date(pendingValues.deliveryDate).toLocaleDateString("ko-KR")
                      : "-"}
                  </div>
                </div>

                <div className="grid grid-cols-[80px,1fr] gap-2 text-xs">
                  <div className="text-slate-500">납품 장소</div>
                  <div className="text-slate-900">{pendingValues?.deliveryLocation || "-"}</div>
                </div>

                {pendingValues?.specialNotes && (
                  <div className="grid grid-cols-[80px,1fr] gap-2 text-xs">
                    <div className="text-slate-500">특이사항</div>
                    <div className="text-slate-900">
                      {pendingValues.specialNotes.length > 100
                        ? `${pendingValues.specialNotes.substring(0, 100)}…`
                        : pendingValues.specialNotes}
                    </div>
                  </div>
                )}
              </div>

              {/* 요청 품목 요약 */}
              <div className="pt-3 border-t">
                <div className="mb-2">
                  <div className="text-xs font-semibold text-slate-700 mb-1">요청 품목 요약</div>
                  <div className="text-[11px] text-slate-500">
                    이번 견적 요청에 포함될 품목과 수량입니다.
                  </div>
                </div>

                {quoteItems.length > 0 ? (
                  <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-xs font-semibold text-slate-700">요청 품목</div>
                      <div className="text-[11px] text-slate-500">
                        총 {quoteItems.length}개 · 합계 ₩{totalAmount.toLocaleString("ko-KR")}
                      </div>
                    </div>

                    <div className="max-h-48 overflow-y-auto rounded-md bg-white">
                      <Table>
                        <TableHeader>
                          <TableRow className="h-8">
                            <TableHead className="w-12 text-[10px] px-2">No.</TableHead>
                            <TableHead className="text-[10px] px-2">제품명</TableHead>
                            <TableHead className="text-[10px] px-2">벤더</TableHead>
                            <TableHead className="w-16 text-right text-[10px] px-2">수량</TableHead>
                            <TableHead className="w-24 text-right text-[10px] px-2">금액</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {quoteItems.map((item, index) => (
                            <TableRow key={item.id} className="h-8">
                              <TableCell className="text-[11px] px-2 font-medium">
                                {index + 1}
                              </TableCell>
                              <TableCell className="text-[11px] px-2">
                                <div className="max-w-[150px] truncate" title={item.productName}>
                                  {item.productName}
                                </div>
                              </TableCell>
                              <TableCell className="text-[11px] px-2">
                                <div className="max-w-[100px] truncate" title={item.vendorName}>
                                  {item.vendorName}
                                </div>
                              </TableCell>
                              <TableCell className="text-right text-[11px] px-2">
                                {item.quantity || 1}
                              </TableCell>
                              <TableCell className="text-right text-[11px] px-2 font-medium">
                                ₩{(item.lineTotal || 0).toLocaleString("ko-KR")}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
                    <p className="text-xs text-slate-500">
                      아직 추가된 품목이 없습니다. Step 3에서 먼저 품목을 추가해 주세요.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="secondary"
                onClick={() => setIsConfirmDialogOpen(false)}
                disabled={isSubmitting}
                className="text-xs"
              >
                수정하기
              </Button>
              <Button
                onClick={handleFinalSubmit}
                disabled={isSubmitting || quoteItems.length === 0}
                className="text-xs bg-slate-900 hover:bg-slate-800"
              >
                {isSubmitting ? "처리 중..." : "최종 견적 요청"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

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

export function SharePanel() {
  const {
    shareLink,
    isGeneratingShareLink,
    generateShareLink,
    quoteItems,
  } = useTestFlow();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [shareTitle, setShareTitle] = useState("");
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [expiresInDays, setExpiresInDays] = useState<number>(30);

  const handleCopyTable = async () => {
    if (quoteItems.length === 0) {
      toast({
        title: "품목이 없습니다",
        description: "복사할 품목을 먼저 추가해주세요.",
        variant: "destructive",
      });
      return;
    }

    const headers = [
      "Line No.",
      "제품명",
      "벤더",
      "단가",
      "통화",
      "수량",
      "금액",
      "비고",
    ];

    const rows = quoteItems.map((item, index) => [
      (index + 1).toString(),
      item.productName || "",
      item.vendorName || "",
      (item.unitPrice || 0).toLocaleString(),
      item.currency || "KRW",
      (item.quantity || 1).toString(),
      (item.lineTotal || 0).toLocaleString(),
      item.notes || "",
    ]);

    const tsv = [headers, ...rows].map((row) => row.join("\t")).join("\n");

    try {
      await navigator.clipboard.writeText(tsv);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "복사 완료",
        description: "품목 리스트가 클립보드에 복사되었습니다.",
      });
    } catch (error) {
      toast({
        title: "복사 실패",
        description: "클립보드 복사에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleDownloadCSV = () => {
    if (quoteItems.length === 0) {
      toast({
        title: "품목이 없습니다",
        description: "다운로드할 품목을 먼저 추가해주세요.",
        variant: "destructive",
      });
      return;
    }

    const headers = [
      "Line No.",
      "제품명",
      "벤더",
      "단가",
      "통화",
      "수량",
      "금액",
      "비고",
    ];

    const rows = quoteItems.map((item, index) => [
      (index + 1).toString(),
      `"${item.productName || ""}"`,
      `"${item.vendorName || ""}"`,
      (item.unitPrice || 0).toLocaleString(),
      item.currency || "KRW",
      (item.quantity || 1).toString(),
      (item.lineTotal || 0).toLocaleString(),
      `"${item.notes || ""}"`,
    ]);

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `품목리스트-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "다운로드 완료",
      description: "CSV 파일이 다운로드되었습니다.",
    });
  };

  const handleGenerateShareLink = async () => {
    try {
      await generateShareLink(shareTitle || "품목 리스트", expiresInDays);
      setIsShareDialogOpen(false);
      toast({
        title: "공유 링크 생성 완료",
        description: "구매담당자에게 공유할 수 있는 링크가 생성되었습니다.",
      });
    } catch (error: any) {
      toast({
        title: "공유 링크 생성 실패",
        description: error.message || "알 수 없는 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleCopyLink = async () => {
    if (shareLink) {
      try {
        await navigator.clipboard.writeText(shareLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast({
          title: "링크 복사 완료",
          description: "공유 링크가 클립보드에 복사되었습니다.",
        });
      } catch (error) {
        toast({
          title: "복사 실패",
          description: "링크 복사에 실패했습니다.",
          variant: "destructive",
        });
      }
    }
  };

  const isEmpty = quoteItems.length === 0;

  return (
    <Card className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-sm font-semibold text-slate-900">
          구매 요청서 내보내기
        </CardTitle>
        <CardDescription className="text-xs text-slate-500 mt-1">
          표 복사, 파일 다운로드, 구매 담당자에게 전달할 보기 링크를 생성해서 전자결재/구매요청에 활용할 수 있습니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        {/* 표 복사 */}
        <div className="flex items-center justify-between py-3 border-b border-slate-200 last:border-0">
          <div className="flex-1">
            <div className="text-sm font-medium text-slate-900">전자결재 양식용 표 데이터 복사</div>
            <div className="text-xs text-slate-500 mt-0.5">
              그룹웨어 전자결재 양식의 표/텍스트 영역에 바로 붙여넣을 수 있는 탭(탭 문자) 구분 텍스트로 복사합니다.
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyTable}
            disabled={isEmpty}
            className="ml-4 text-xs h-8"
          >
            {copied ? (
              <>
                <X className="h-3 w-3 mr-1" />
                복사됨
              </>
            ) : (
              <>
                <Copy className="h-3 w-3 mr-1" />
                복사
              </>
            )}
          </Button>
        </div>

        {/* 엑셀 다운로드 */}
        <div className="flex items-center justify-between py-3 border-b border-slate-200 last:border-0">
          <div className="flex-1">
            <div className="text-sm font-medium text-slate-900">엑셀/CSV 다운로드</div>
            <div className="text-xs text-slate-500 mt-0.5">
              구매요청 문서에 첨부하거나 다른 내부 시스템으로 가져갈 수 있는 파일 형식으로 다운로드합니다.
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadCSV}
            disabled={isEmpty}
            className="ml-4 text-xs h-8"
          >
            <Download className="h-3 w-3 mr-1" />
            다운로드
          </Button>
        </div>

        {/* 공유 링크 */}
        <div className="py-3">
          <div className="flex-1 mb-2">
            <div className="text-sm font-medium text-slate-900">구매담당자용 보기 링크</div>
            <div className="text-xs text-slate-500 mt-0.5">
              사내 구매 담당자가 브라우저에서 품목 리스트를 확인할 수 있는 읽기 전용 링크입니다. 벤더에게 전달하는 용도가 아니라, 내부 결재/커뮤니케이션용 링크입니다.
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Input
              value={shareLink || ""}
              readOnly
              placeholder="아직 생성된 링크가 없습니다. '링크 생성'을 눌러 구매 담당자용 보기 링크를 만들 수 있습니다."
              className="flex-1 text-xs h-8"
            />
            {shareLink ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyLink}
                className="text-xs h-8"
              >
                {copied ? (
                  <>
                    <X className="h-3 w-3 mr-1" />
                    복사됨
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3 mr-1" />
                    복사
                  </>
                )}
              </Button>
            ) : (
              <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="default"
                    size="sm"
                    disabled={isEmpty || isGeneratingShareLink}
                    className="text-xs h-8 bg-slate-900 hover:bg-slate-800"
                  >
                    <Share2 className="h-3 w-3 mr-1" />
                    링크 생성
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>공유 링크 생성</DialogTitle>
                    <DialogDescription>
                      구매담당자용 보기 링크를 생성합니다. 만료일을 설정할 수 있습니다.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="share-title">링크 제목</Label>
                      <Input
                        id="share-title"
                        value={shareTitle}
                        onChange={(e) => setShareTitle(e.target.value)}
                        placeholder="예: 2024년 1분기 구매 요청"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="expires-in-days">만료일 설정</Label>
                      <Select
                        value={expiresInDays.toString()}
                        onValueChange={(v) => setExpiresInDays(parseInt(v))}
                      >
                        <SelectTrigger className="mt-1">
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
                      <p className="text-xs text-muted-foreground mt-1">
                        만료일이 지나면 링크가 자동으로 비활성화됩니다.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setIsShareDialogOpen(false)}
                        className="flex-1"
                      >
                        취소
                      </Button>
                      <Button
                        onClick={handleGenerateShareLink}
                        disabled={isGeneratingShareLink}
                        className="flex-1 bg-slate-900 hover:bg-slate-800"
                      >
                        {isGeneratingShareLink ? (
                          <>
                            <Share2 className="h-3 w-3 mr-1 animate-spin" />
                            생성 중...
                          </>
                        ) : (
                          <>
                            <Share2 className="h-3 w-3 mr-1" />
                            링크 생성
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {isEmpty && (
          <div className="pt-2 border-t">
            <p className="text-xs text-slate-500 text-center">
              먼저 위에서 구매 요청 품목을 추가해 주세요.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// 구매 요청 품목 요약 패널
export function QuoteItemsSummaryPanel() {
  const { quoteItems } = useTestFlow();
  
  const totalAmount = quoteItems.reduce((sum, item) => sum + (item.lineTotal || 0), 0);

  return (
    <Card className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-sm font-semibold text-slate-900">
              구매 요청 품목
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 mt-1">
              이번 견적 요청에 포함될 품목과 금액입니다.
            </CardDescription>
          </div>
          <Link href="/test/quote">
            <Button variant="secondary" size="sm" className="text-xs h-7">
              품목 편집
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        {quoteItems.length > 0 ? (
          <div className="space-y-3">
            {/* 품목 리스트 */}
            <div className="max-h-72 overflow-y-auto space-y-2">
              {quoteItems.map((item, idx) => {
                const unitPrice = item.unitPrice || 0;
                const quantity = item.quantity || 1;
                const lineTotal = item.lineTotal || unitPrice * quantity;

                return (
                  <div
                    key={item.id}
                    className="flex items-start justify-between rounded-md border border-slate-200 bg-white px-3 py-2"
                  >
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="text-xs font-semibold text-slate-900">
                        {idx + 1}. {item.productName}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {item.vendorName || "벤더 없음"} · {quantity}개 ×{" "}
                        {unitPrice > 0
                          ? `₩${unitPrice.toLocaleString("ko-KR")}`
                          : "가격 문의"}{" "}
                        = ₩{lineTotal.toLocaleString("ko-KR")}
                      </div>
                    </div>
                    <div className="ml-3 text-xs font-semibold text-slate-900 whitespace-nowrap">
                      ₩{lineTotal.toLocaleString("ko-KR")}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 총합 요약 */}
            <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3">
              <div className="text-[11px] text-slate-500">
                총 {quoteItems.length}개 품목
              </div>
              <div className="text-xs font-semibold text-slate-900">
                총합 ₩{totalAmount.toLocaleString("ko-KR")}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-xs text-slate-600 mb-1">
              아직 추가된 품목이 없습니다.
            </p>
            <p className="text-[11px] text-slate-500">
              Step 3에서 제품을 선택하고 '품목에 추가'를 눌러 주세요.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// QuoteRequestPanel은 그대로 유지
export function QuoteRequestPanel() {
  const { quoteItems } = useTestFlow();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [specialNotes, setSpecialNotes] = useState("");
  const [englishText, setEnglishText] = useState<string | null>(null);
  const [englishSubject, setEnglishSubject] = useState<string | null>(null);
  const [isGeneratingEnglish, setIsGeneratingEnglish] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [pendingValues, setPendingValues] = useState<{
    title: string;
    message: string;
    deliveryDate: string;
    deliveryLocation: string;
    specialNotes: string;
  } | null>(null);

  // 총합 계산
  const totalAmount = quoteItems.reduce((sum, item) => sum + (item.lineTotal || 0), 0);

  // 폼 유효성 검사
  const validateForm = (): boolean => {
    if (quoteItems.length === 0) {
      toast({
        title: "품목이 없습니다",
        description: "견적을 요청할 품목을 먼저 추가해주세요.",
        variant: "destructive",
      });
      return false;
    }
    if (!title.trim()) {
      toast({
        title: "견적 제목을 입력해주세요",
        description: "견적 제목은 필수 항목입니다.",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  // 확인 모달 열기 (폼 검증 후)
  const handleConfirmClick = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    // 폼 값을 pendingValues에 저장
    setPendingValues({
      title: title || `제품 견적 요청 (${quoteItems.length}개)`,
      message,
      deliveryDate,
      deliveryLocation,
      specialNotes,
    });

    // 모달 열기
    setIsConfirmDialogOpen(true);
  };

  // 최종 견적 요청 (모달에서 호출)
  const handleFinalSubmit = async () => {
    if (!pendingValues || quoteItems.length === 0) {
      return;
    }

    setIsSubmitting(true);

    try {
      const items = quoteItems.map((item, index) => ({
        productId: item.productId,
        lineNumber: index + 1,
        quantity: item.quantity || 1,
        unitPrice: item.unitPrice || 0,
        currency: item.currency || "KRW",
        lineTotal: item.lineTotal || 0,
        notes: item.notes || "",
      }));

      const response = await fetch("/api/quotes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: pendingValues.title,
          message: pendingValues.message,
          deliveryDate: pendingValues.deliveryDate || undefined,
          deliveryLocation: pendingValues.deliveryLocation,
          specialNotes: pendingValues.specialNotes,
          items,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "견적 요청에 실패했습니다.");
      }

      const data = await response.json();
      
      // 모달 닫기
      setIsConfirmDialogOpen(false);
      
      toast({
        title: "견적 요청 완료",
        description: "견적 요청이 성공적으로 전송되었습니다.",
      });
      
      // 폼 초기화
      setTitle("");
      setMessage("");
      setDeliveryDate("");
      setDeliveryLocation("");
      setSpecialNotes("");
      setEnglishText(null);
      setEnglishSubject(null);
      setPendingValues(null);
      
      // 품목 리스트 페이지로 이동
      window.location.href = "/test/quote";
    } catch (error: any) {
      toast({
        title: "견적 요청 실패",
        description: error.message || "견적 요청 중 오류가 발생했습니다.",
        variant: "destructive",
      });
      console.error("Error submitting quote:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateEnglish = async () => {
    if (quoteItems.length === 0) {
      toast({
        title: "품목이 없습니다",
        description: "견적을 요청할 품목을 먼저 추가해주세요.",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingEnglish(true);
    try {
      const items = quoteItems.map((item, index) => ({
        productId: item.productId,
        lineNumber: index + 1,
        quantity: item.quantity || 1,
        unitPrice: item.unitPrice || 0,
        currency: item.currency || "KRW",
        lineTotal: item.lineTotal || 0,
        notes: item.notes || "",
      }));

      const response = await fetch("/api/quotes/generate-english", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          message,
          deliveryDate,
          deliveryLocation,
          specialNotes,
          items,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "영문 텍스트 생성에 실패했습니다.");
      }

      const data = await response.json();
      setEnglishText(data.englishText);
      setEnglishSubject(data.subject);
      toast({
        title: "생성 완료",
        description: "영문 견적 요청 텍스트가 생성되었습니다.",
      });
    } catch (error: any) {
      toast({
        title: "생성 실패",
        description: error.message || "영문 텍스트 생성 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingEnglish(false);
    }
  };

  const handleCopyEnglish = async () => {
    if (!englishText) return;

    const fullText = englishSubject
      ? `Subject: ${englishSubject}\n\n${englishText}`
      : englishText;

    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "복사 완료",
        description: "영문 텍스트가 클립보드에 복사되었습니다.",
      });
    } catch (error) {
      toast({
        title: "복사 실패",
        description: "텍스트 복사에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold text-slate-800">
          견적 요청
        </CardTitle>
        <CardDescription className="text-xs text-slate-500">
          품목 리스트를 기반으로 견적을 요청합니다.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleConfirmClick} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="quote-title" className="text-xs font-medium">
              견적 제목
            </label>
            <Input
              id="quote-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: PCR 시약 견적 요청"
              className="text-xs h-8"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="quote-message" className="text-xs font-medium">
              요청 내용
            </label>
            <Textarea
              id="quote-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="기본 요청 사항을 작성해주세요"
              rows={3}
              className="text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="delivery-date" className="text-xs font-medium">
                납기 희망일
              </label>
              <Input
                id="delivery-date"
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="text-xs h-8"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="delivery-location" className="text-xs font-medium">
                납품 장소
              </label>
              <Input
                id="delivery-location"
                value={deliveryLocation}
                onChange={(e) => setDeliveryLocation(e.target.value)}
                placeholder="예: 서울대학교 생명과학관 101호"
                className="text-xs h-8"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="special-notes" className="text-xs font-medium">
              특이사항
            </label>
            <Textarea
              id="special-notes"
              value={specialNotes}
              onChange={(e) => setSpecialNotes(e.target.value)}
              placeholder="특별한 요구사항이나 주의사항을 작성해주세요"
              rows={2}
              className="text-xs"
            />
          </div>

          <div className="pt-2 border-t space-y-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleGenerateEnglish}
              disabled={isGeneratingEnglish || quoteItems.length === 0}
              className="w-full text-xs h-8"
            >
              {isGeneratingEnglish ? "생성 중..." : "영문 견적 요청 텍스트 생성"}
            </Button>

            {englishText && (
              <div className="p-3 bg-slate-50 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold">생성된 영문 텍스트</h4>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleCopyEnglish}
                    className="h-6 text-xs"
                  >
                    {copied ? "복사됨" : "복사"}
                  </Button>
                </div>
                {englishSubject && (
                  <div className="text-xs text-slate-500">
                    <strong>Subject:</strong> {englishSubject}
                  </div>
                )}
                <div className="text-xs whitespace-pre-wrap border rounded p-2 bg-white max-h-48 overflow-y-auto">
                  {englishText}
                </div>
              </div>
            )}
          </div>

          <div className="pt-2 border-t">
            <Button
              type="button"
              onClick={handleConfirmClick}
              disabled={isSubmitting || quoteItems.length === 0}
              className="w-full bg-slate-900 text-white hover:bg-slate-800 text-xs h-8"
            >
              견적 요청 내용 확인
            </Button>
          </div>
        </form>

        {/* 확인 모달 */}
        <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-slate-900">
                견적 요청 내용 확인
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-1">
                아래 내용으로 견적 요청을 전송합니다. 한 번 더 확인해 주세요.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* 폼 요약 */}
              <div className="space-y-3">
                <div className="grid grid-cols-[80px,1fr] gap-2 text-xs">
                  <div className="text-slate-500">견적 제목</div>
                  <div className="text-slate-900 font-medium">{pendingValues?.title || "-"}</div>
                </div>

                <div className="grid grid-cols-[80px,1fr] gap-2 text-xs">
                  <div className="text-slate-500">요청 내용</div>
                  <div className="text-slate-900">
                    {pendingValues?.message
                      ? pendingValues.message.length > 100
                        ? `${pendingValues.message.substring(0, 100)}…`
                        : pendingValues.message
                      : "-"}
                  </div>
                </div>

                <div className="grid grid-cols-[80px,1fr] gap-2 text-xs">
                  <div className="text-slate-500">납기 희망일</div>
                  <div className="text-slate-900">
                    {pendingValues?.deliveryDate
                      ? new Date(pendingValues.deliveryDate).toLocaleDateString("ko-KR")
                      : "-"}
                  </div>
                </div>

                <div className="grid grid-cols-[80px,1fr] gap-2 text-xs">
                  <div className="text-slate-500">납품 장소</div>
                  <div className="text-slate-900">{pendingValues?.deliveryLocation || "-"}</div>
                </div>

                {pendingValues?.specialNotes && (
                  <div className="grid grid-cols-[80px,1fr] gap-2 text-xs">
                    <div className="text-slate-500">특이사항</div>
                    <div className="text-slate-900">
                      {pendingValues.specialNotes.length > 100
                        ? `${pendingValues.specialNotes.substring(0, 100)}…`
                        : pendingValues.specialNotes}
                    </div>
                  </div>
                )}
              </div>

              {/* 요청 품목 요약 */}
              <div className="pt-3 border-t">
                <div className="mb-2">
                  <div className="text-xs font-semibold text-slate-700 mb-1">요청 품목 요약</div>
                  <div className="text-[11px] text-slate-500">
                    이번 견적 요청에 포함될 품목과 수량입니다.
                  </div>
                </div>

                {quoteItems.length > 0 ? (
                  <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-xs font-semibold text-slate-700">요청 품목</div>
                      <div className="text-[11px] text-slate-500">
                        총 {quoteItems.length}개 · 합계 ₩{totalAmount.toLocaleString("ko-KR")}
                      </div>
                    </div>

                    <div className="max-h-48 overflow-y-auto rounded-md bg-white">
                      <Table>
                        <TableHeader>
                          <TableRow className="h-8">
                            <TableHead className="w-12 text-[10px] px-2">No.</TableHead>
                            <TableHead className="text-[10px] px-2">제품명</TableHead>
                            <TableHead className="text-[10px] px-2">벤더</TableHead>
                            <TableHead className="w-16 text-right text-[10px] px-2">수량</TableHead>
                            <TableHead className="w-24 text-right text-[10px] px-2">금액</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {quoteItems.map((item, index) => (
                            <TableRow key={item.id} className="h-8">
                              <TableCell className="text-[11px] px-2 font-medium">
                                {index + 1}
                              </TableCell>
                              <TableCell className="text-[11px] px-2">
                                <div className="max-w-[150px] truncate" title={item.productName}>
                                  {item.productName}
                                </div>
                              </TableCell>
                              <TableCell className="text-[11px] px-2">
                                <div className="max-w-[100px] truncate" title={item.vendorName}>
                                  {item.vendorName}
                                </div>
                              </TableCell>
                              <TableCell className="text-right text-[11px] px-2">
                                {item.quantity || 1}
                              </TableCell>
                              <TableCell className="text-right text-[11px] px-2 font-medium">
                                ₩{(item.lineTotal || 0).toLocaleString("ko-KR")}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
                    <p className="text-xs text-slate-500">
                      아직 추가된 품목이 없습니다. Step 3에서 먼저 품목을 추가해 주세요.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="secondary"
                onClick={() => setIsConfirmDialogOpen(false)}
                disabled={isSubmitting}
                className="text-xs"
              >
                수정하기
              </Button>
              <Button
                onClick={handleFinalSubmit}
                disabled={isSubmitting || quoteItems.length === 0}
                className="text-xs bg-slate-900 hover:bg-slate-800"
              >
                {isSubmitting ? "처리 중..." : "최종 견적 요청"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
