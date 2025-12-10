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
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

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
                          <TableHead className="w-12 text-center text-xs whitespace-nowrap">삭제</TableHead>
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
                              price={item.unitPrice || 0}
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
                              price={item.lineTotal || 0}
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
  const [copied, setCopied] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [localShareLink, setLocalShareLink] = useState<string | null>(providerShareLink || null);

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
      await generateShareLink(shareTitle || "품목 리스트", 30);
      setIsShareDialogOpen(false);
      // generateShareLink가 성공하면 providerShareLink가 업데이트되므로
      // 잠시 후 localShareLink도 업데이트
      setTimeout(() => {
        setLocalShareLink(providerShareLink);
      }, 100);
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

  return (
    <Card className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="text-sm font-semibold text-slate-900">공유</CardTitle>
        <CardDescription className="text-xs text-slate-500">
          품목 리스트를 공유 링크로 공유하세요
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
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setLocalShareLink(null);
                setShareTitle("");
              }}
              className="w-full text-xs"
            >
              새 링크 생성
            </Button>
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
                <div className="text-xs text-slate-500">
                  공유 링크는 30일 후 자동으로 만료됩니다.
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
  const [deliveryDateOption, setDeliveryDateOption] = useState<"asap" | "custom" | "">("");
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [deliveryLocationCustom, setDeliveryLocationCustom] = useState("");
  const [specialNotes, setSpecialNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 기본 납품 장소 목록 (나중에 사용자 설정에서 가져올 수 있음)
  const defaultLocations = [
    "본관 1층 창고",
    "연구동 3층 실험실",
    "본관 2층 보관실",
    "연구동 지하 창고",
  ];

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

  // 메시지 자동 생성
  useEffect(() => {
    if (quoteItems.length > 0 && !message) {
      const productCount = quoteItems.length;
      const totalAmount = quoteItems.reduce((sum, item) => sum + (item.lineTotal || 0), 0);
      const suggestedMessage = `안녕하세요.\n\n아래 품목 ${productCount}건에 대한 견적을 요청드립니다.\n\n품목 수: ${productCount}개\n예상 금액: ₩${totalAmount.toLocaleString("ko-KR")}\n\n빠른 견적 부탁드립니다.\n감사합니다.`;
      setMessage(suggestedMessage);
    }
  }, [quoteItems, message]);

  // 납기 희망일 옵션 변경 핸들러
  const handleDeliveryDateOptionChange = (option: "asap" | "custom" | "") => {
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
          message: message || "",
          productIds: quoteItems.map((item) => item.productId),
          quantities: Object.fromEntries(
            quoteItems.map((item) => [item.productId, item.quantity])
          ),
          notes: Object.fromEntries(
            quoteItems.map((item) => [item.productId, item.notes || ""])
          ),
          deliveryDate: deliveryDate || undefined,
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="delivery-date" className="text-xs font-medium">
                납기 희망일
              </Label>
              <Select
                value={deliveryDateOption}
                onValueChange={(value: "asap" | "custom" | "") => handleDeliveryDateOptionChange(value)}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asap">최대한 빨리 (1주일 이내)</SelectItem>
                  <SelectItem value="custom">직접 입력</SelectItem>
                  <SelectItem value="">선택 안함</SelectItem>
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
                onValueChange={(value) => {
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
                  {defaultLocations.map((location) => (
                    <SelectItem key={location} value={location}>
                      {location}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">직접 입력</SelectItem>
                </SelectContent>
              </Select>
              {deliveryLocation === "custom" && (
                <Input
                  id="delivery-location-custom"
                  value={deliveryLocationCustom}
                  onChange={(e) => setDeliveryLocationCustom(e.target.value)}
                  placeholder="납품 장소를 입력하세요"
                  className="text-sm mt-2"
                />
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
          요청할 품목 {quoteItems.length}개
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="max-h-[400px] overflow-y-auto space-y-2">
            {quoteItems.map((item, index) => {
              const product = products.find((p) => p.id === item.productId);
              return (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-2 p-2 rounded-lg border border-slate-100 bg-slate-50"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-slate-900 truncate">
                      {index + 1}. {product?.name || item.productName || "제품"}
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
          <div className="pt-3 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-900">총액</span>
              <span className="text-lg font-bold text-slate-900">
                ₩{totalAmount.toLocaleString("ko-KR")}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}