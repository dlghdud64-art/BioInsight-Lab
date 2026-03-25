"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCompareStore } from "@/lib/store/compare-store";
import { useQuery } from "@tanstack/react-query";
import { Textarea } from "@/components/ui/textarea";
import { ShoppingCart, Languages, Copy, Check, FileText, Download, Share2, Search, X, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Disclaimer } from "@/components/legal/disclaimer";
import { SearchStepNav } from "../../search/_components/search-step-nav";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { exportQuoteAsCSV } from "@/lib/export/quote-export";
import { QuoteAiAssistantPanel } from "@/components/ai/quote-ai-assistant-panel";
import { useQuoteAiPanel, type RecommendedVendor } from "@/hooks/use-quote-ai-panel";

export default function QuotePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const { productIds } = useCompareStore();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [specialNotes, setSpecialNotes] = useState("");
  const [englishText, setEnglishText] = useState<string | null>(null);
  const [englishSubject, setEnglishSubject] = useState<string | null>(null);
  const [isGeneratingEnglish, setIsGeneratingEnglish] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);

  // AI 보조 패널
  const aiPanel = useQuoteAiPanel();

  const { data, isLoading } = useQuery({
    queryKey: ["compare", productIds],
    queryFn: async () => {
      if (productIds.length === 0) return { products: [] };
      const response = await fetch("/api/products/compare", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ productIds }),
      });
      if (!response.ok) throw new Error("Failed to fetch products");
      return response.json();
    },
    enabled: productIds.length > 0,
  });

  const products = data?.products || [];

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreatingRFQ, setIsCreatingRFQ] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});

  // CSV 다운로드 핸들러
  const handleExportCSV = () => {
    if (products.length === 0) {
      toast({
        title: "품목이 없습니다",
        description: "내보낼 품목을 먼저 추가해주세요.",
        variant: "destructive",
      });
      return;
    }

    const exportData = {
      title: title || `견적 요청 - ${products.length}개 품목`,
      description: message || "",
      status: "PENDING" as const,
      currency: "KRW",
      totalAmount: calculateTotal(),
      items: products.map((product: any) => {
        const qty = quantities[product.id] || 1;
        const minPrice = product.vendors?.reduce(
          (min: number, v: any) => (v.priceInKRW && (!min || v.priceInKRW < min) ? v.priceInKRW : min),
          null
        ) || 0;
        return {
          id: product.id,
          lineNumber: null,
          name: product.name,
          brand: product.brand || null,
          catalogNumber: product.catalogNumber || null,
          unit: product.unit || null,
          quantity: qty,
          unitPrice: minPrice || null,
          lineTotal: minPrice * qty || null,
          currency: "KRW",
          notes: itemNotes[product.id] || null,
        };
      }),
      createdAt: new Date().toISOString(),
    };

    exportQuoteAsCSV(exportData);
    toast({
      title: "내보내기 완료",
      description: "CSV 파일이 다운로드되었습니다.",
    });
  };

  // 총 예상 견적가 계산
  const calculateTotal = () => {
    return products.reduce((sum: number, product: any) => {
      const qty = quantities[product.id] || 1;
      const minPrice = product.vendors?.reduce(
        (min: number, v: any) => (v.priceInKRW && (!min || v.priceInKRW < min) ? v.priceInKRW : min),
        null
      ) || 0;
      return sum + (minPrice * qty);
    }, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/quotes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: title || `제품 견적 요청 (${products.length}개)`,
          message,
          deliveryDate: deliveryDate || undefined,
          deliveryLocation,
          specialNotes,
          productIds: productIds,
          quantities,
          notes: itemNotes,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "견적 요청에 실패했습니다.");
      }

      const data = await response.json();
      // 성공 시 견적서 상세 페이지로 이동
      router.push(`/quotes/${data.quote.id}`);
    } catch (error: any) {
      alert(error.message || "견적 요청 중 오류가 발생했습니다.");
      console.error("Error submitting quote:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateEnglish = async () => {
    if (products.length === 0) {
      toast({
        title: "제품이 없습니다",
        description: "견적을 요청할 제품을 먼저 선택해주세요.",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingEnglish(true);
    try {
      const items = products.map((product: any) => ({
        productId: product.id,
        quantity: quantities[product.id] || 1,
        notes: itemNotes[product.id] || "",
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

  const handleCreateRFQ = async () => {
    if (products.length === 0) {
      toast({
        title: "품목이 없습니다",
        description: "견적 요청을 생성할 품목을 먼저 선택해주세요.",
        variant: "destructive",
      });
      return;
    }

    setIsCreatingRFQ(true);
    try {
      const response = await fetch("/api/quotes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: title || `견적 요청 - ${products.length}개 품목`,
          message: message || "견적 요청드립니다.",
          deliveryDate: deliveryDate || undefined,
          deliveryLocation,
          specialNotes,
          productIds: productIds,
          quantities,
          notes: itemNotes,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "견적 요청 생성에 실패했습니다.");
      }

      const data = await response.json();
      toast({
        title: "견적 요청 생성 완료",
        description: "견적 요청이 생성되었습니다.",
      });
      // 견적 요청 상세 페이지로 이동
      router.push(`/quotes/${data.quote.id}`);
    } catch (error: any) {
      toast({
        title: "견적 요청 생성 실패",
        description: error.message || "견적 요청 생성 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsCreatingRFQ(false);
    }
  };

  const handleShareLink = async () => {
    // TODO: 공유 링크 생성 로직 구현
    toast({
      title: "준비 중",
      description: "공유 링크 기능은 곧 제공될 예정입니다.",
    });
  };

  if (status === "loading") {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <p className="text-muted-foreground">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (productIds.length === 0) {
    return (
      <>
        <SearchStepNav />
        <div className="pt-[calc(3.5rem+4rem)] md:pt-[calc(3.5rem+5rem)] container mx-auto px-3 md:px-4 py-4 md:py-8">
          <div className="max-w-3xl mx-auto">
            {/* 헤더 */}
            <div className="mb-6">
              <h1 className="text-2xl md:text-3xl font-bold text-slate-100">견적 요청</h1>
              <p className="text-sm text-slate-400 mt-1">선택한 품목으로 벤더에 가격/납기 확인을 요청할 수 있어요.</p>
            </div>

            {/* Empty state — elevated workspace placeholder */}
            <div className="rounded-xl border border-bd bg-el p-6 md:p-8">
              {/* 견적 항목 슬롯 영역 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                {[1, 2, 3].map((slot) => (
                  <div
                    key={slot}
                    className="rounded-lg border border-dashed border-bd bg-pn px-4 py-8 flex flex-col items-center text-center transition-colors hover:border-slate-600"
                  >
                    <div className="w-9 h-9 rounded-lg bg-el border border-bd flex items-center justify-center mb-2">
                      <ShoppingCart className="h-4 w-4 text-slate-500" />
                    </div>
                    <span className="text-xs text-slate-500 font-medium">품목 {slot}</span>
                  </div>
                ))}
              </div>

              {/* 액션 유도 안내 */}
              <div className="flex flex-col items-center text-center pt-2 pb-2">
                <div className="w-12 h-12 rounded-xl bg-pn border border-bd flex items-center justify-center mb-4">
                  <FileText className="h-6 w-6 text-slate-500" strokeWidth={1.5} />
                </div>
                <h2 className="text-lg font-semibold text-slate-100 mb-1.5">품목을 추가하고 견적을 요청하세요</h2>
                <p className="text-sm text-slate-400 mb-1 max-w-md leading-relaxed">
                  제품을 검색 · 비교한 뒤 견적 바구니에 담으면 벤더에게 가격/납기를 요청할 수 있습니다.
                </p>
                <p className="text-xs text-slate-500 mb-6 max-w-md">
                  CSV 다운로드, 영문 견적서 자동 생성도 지원합니다.
                </p>
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <Link href="/app/compare">
                    <Button size="lg" variant="outline" className="border-bd text-slate-300 hover:bg-el px-6">
                      <ShoppingCart className="h-5 w-5 mr-2" />
                      비교에서 품목 추가
                    </Button>
                  </Link>
                  <Link href="/app/search">
                    <Button size="lg" className="bg-blue-600 hover:bg-blue-500 text-white px-6">
                      <Search className="h-5 w-5 mr-2" />
                      검색에서 시작하기
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  const totalAmount = calculateTotal();

  return (
    <>
      <SearchStepNav />
      <div className="pt-[calc(3.5rem+4rem)] md:pt-[calc(3.5rem+5rem)] container mx-auto px-3 md:px-4 py-4 md:py-8">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* 헤더 영역 */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-2xl md:text-3xl font-bold text-slate-100">견적 요청</h1>
              <p className="text-sm text-slate-400 mt-1">
                선택한 품목으로 벤더에 가격/납기 확인을 요청할 수 있어요.
              </p>
            </div>
            {products.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 text-sm gap-1.5 border-blue-700 text-blue-400 hover:bg-blue-600/10"
                onClick={() => {
                  const panelItems = products.map((product: any) => ({
                    productId: product.id,
                    productName: product.name || product.nameEn || "품목",
                    brand: product.brand,
                    catalogNumber: product.catalogNumber,
                    quantity: quantities[product.id] || 1,
                    unit: "ea",
                    estimatedPrice: product.vendors?.[0]?.priceInKRW,
                  }));

                  const vendorMap = new Map<string, RecommendedVendor>();
                  products.forEach((product: any) => {
                    product.vendors?.forEach((pv: any) => {
                      if (pv.vendor && !vendorMap.has(pv.vendor.name)) {
                        vendorMap.set(pv.vendor.name, {
                          vendorId: pv.vendor.id,
                          vendorName: pv.vendor.name,
                          reason: `${product.name} 등 공급 가능`,
                          recentPrice: pv.priceInKRW,
                          leadTimeDays: pv.leadTime,
                          moq: pv.minOrderQty,
                          contactAvailable: !!pv.vendor.email,
                          email: pv.vendor.email,
                        });
                      }
                    });
                  });

                  aiPanel.preparePanel(panelItems, {
                    vendors: Array.from(vendorMap.values()).slice(0, 5),
                    deliveryDate: deliveryDate || undefined,
                    deliveryLocation: deliveryLocation || undefined,
                  });
                }}
              >
                <Sparkles className="h-4 w-4" />
                견적 요청 초안 만들기
              </Button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <Disclaimer type="rfq" />
            
            {/* 요청 정보 카드 */}
            <Card className="p-4 md:p-6">
              <CardHeader className="px-0 pt-0 pb-4">
                <CardTitle className="text-lg font-semibold">요청 정보</CardTitle>
                <CardDescription className="text-sm">
                  견적을 요청할 제품 정보를 확인하고 요청 내용을 작성해주세요
                </CardDescription>
              </CardHeader>
              <CardContent className="px-0 pb-0 space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">견적 제목</label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="예: PCR 시약 견적 요청"
                    required
                    className="h-10"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">요청 내용</label>
                  <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="기본 요청 사항을 작성해주세요"
                    rows={4}
                    className="text-sm"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">납기 희망일</label>
                    <Input
                      type="date"
                      value={deliveryDate}
                      onChange={(e) => setDeliveryDate(e.target.value)}
                      className="h-10"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">납품 장소</label>
                    <Input
                      value={deliveryLocation}
                      onChange={(e) => setDeliveryLocation(e.target.value)}
                      placeholder="예: 서울대학교 생명과학관 101호"
                      className="h-10"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">특이사항</label>
                  <Textarea
                    value={specialNotes}
                    onChange={(e) => setSpecialNotes(e.target.value)}
                    placeholder="특별한 요구사항이나 주의사항을 작성해주세요"
                    rows={3}
                    className="text-sm"
                  />
                </div>

                <div className="pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleGenerateEnglish}
                    disabled={isGeneratingEnglish || products.length === 0}
                    className="w-full"
                  >
                    <Languages className="h-4 w-4 mr-2" />
                    {isGeneratingEnglish ? "생성 중..." : "영문 견적 요청 텍스트 생성"}
                  </Button>
                </div>

                {englishText && (
                  <div className="mt-4 p-4 bg-pn rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold">생성된 영문 텍스트</h4>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleCopyEnglish}
                      >
                        {copied ? (
                          <>
                            <Check className="h-3 w-3 mr-1" />
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
                    {englishSubject && (
                      <div className="text-xs text-muted-foreground">
                        <strong>Subject:</strong> {englishSubject}
                      </div>
                    )}
                    <div className="text-sm whitespace-pre-wrap border rounded p-3 bg-pn max-h-96 overflow-y-auto">
                      {englishText}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 제품 테이블 */}
            <div className="border border-bd rounded-xl overflow-hidden shadow-none bg-pn">
              <div className="bg-pn px-6 py-4 border-b border-bd">
                <h2 className="text-lg font-semibold text-slate-100">요청 제품 ({products.length}개)</h2>
              </div>
              
              {isLoading ? (
                <div className="p-8 text-center text-slate-400">로딩 중...</div>
              ) : products.length === 0 ? (
                <div className="p-8 text-center text-slate-400">제품이 없습니다.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-pn hover:bg-pn">
                      <TableHead className="text-xs font-bold text-slate-400 uppercase w-16">No.</TableHead>
                      <TableHead className="text-xs font-bold text-slate-400 uppercase">제품명</TableHead>
                      <TableHead className="text-xs font-bold text-slate-400 uppercase">브랜드</TableHead>
                      <TableHead className="text-xs font-bold text-slate-400 uppercase">카탈로그 번호</TableHead>
                      <TableHead className="text-xs font-bold text-slate-400 uppercase w-24">수량</TableHead>
                      <TableHead className="text-xs font-bold text-slate-400 uppercase w-32 text-right">예상 단가</TableHead>
                      <TableHead className="text-xs font-bold text-slate-400 uppercase w-32 text-right">예상 금액</TableHead>
                      <TableHead className="text-xs font-bold text-slate-400 uppercase">비고</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((product: any, index: number) => {
                      const qty = quantities[product.id] || 1;
                      const minPrice = product.vendors?.reduce(
                        (min: number, v: any) => (v.priceInKRW && (!min || v.priceInKRW < min) ? v.priceInKRW : min),
                        null
                      ) || 0;
                      const lineTotal = minPrice * qty;
                      
                      return (
                        <TableRow key={product.id} className="h-14 hover:bg-el">
                          <TableCell className="font-medium text-slate-100">{index + 1}</TableCell>
                          <TableCell className="font-medium text-slate-100">{product.name}</TableCell>
                          <TableCell className="text-slate-400">{product.brand || "-"}</TableCell>
                          <TableCell className="text-slate-400">{product.catalogNumber || "-"}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="1"
                              value={qty}
                              onChange={(e) =>
                                setQuantities({
                                  ...quantities,
                                  [product.id]: parseInt(e.target.value) || 1,
                                })
                              }
                              className="w-20 h-8"
                            />
                          </TableCell>
                          <TableCell className="text-right font-medium text-slate-100">
                            {minPrice > 0 ? `₩${minPrice.toLocaleString()}` : "-"}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-slate-100">
                            {lineTotal > 0 ? `₩${lineTotal.toLocaleString()}` : "-"}
                          </TableCell>
                          <TableCell>
                            <Textarea
                              value={itemNotes[product.id] || ""}
                              onChange={(e) =>
                                setItemNotes({
                                  ...itemNotes,
                                  [product.id]: e.target.value,
                                })
                              }
                              placeholder="특별 요구사항"
                              rows={1}
                              className="text-sm min-h-[32px]"
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>

            {/* 하단 액션 버튼 그룹 */}
            {products.length > 0 && (
              <div className="flex flex-col sm:flex-row gap-3 justify-end items-center pt-4 border-t border-bd">
                {/* 총 예상 견적가 - 버튼 왼쪽에 배치 */}
                <div className="flex items-center gap-3 mr-auto">
                  <span className="text-sm text-slate-400">총 예상 견적가:</span>
                  <span className="text-2xl font-bold text-slate-100">
                    ₩{totalAmount.toLocaleString()}
                  </span>
                </div>
              <Button
                type="button"
                variant="outline"
                onClick={handleExportCSV}
                disabled={products.length === 0}
                className="w-full sm:w-auto"
              >
                <Download className="h-4 w-4 mr-2" />
                CSV 다운로드
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleShareLink}
                disabled={products.length === 0}
                className="w-full sm:w-auto"
              >
                <Share2 className="h-4 w-4 mr-2" />
                링크 공유
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || products.length === 0}
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-8"
                size="lg"
              >
                <FileText className="h-5 w-5 mr-2" />
                {isSubmitting ? "처리 중..." : "견적서 발행하기"}
              </Button>
              </div>
            )}
          </form>
        </div>
      </div>

      {/* AI 보조 패널 */}
      <QuoteAiAssistantPanel
        open={aiPanel.isOpen}
        onOpenChange={aiPanel.setIsOpen}
        state={aiPanel.panelState}
        data={aiPanel.panelData}
        actionId={aiPanel.actionId}
        onRegenerate={aiPanel.regenerate}
        onApprove={async (actionId, payload) => {
          try {
            const res = await fetch(`/api/ai-actions/${actionId}/approve`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ payload }),
            });
            if (!res.ok) throw new Error("승인 실패");
            const result = await res.json();
            aiPanel.setIsOpen(false);
            toast({
              title: "견적 요청이 생성되었습니다",
              description: `견적 ID: ${result.result?.quoteId || "생성 완료"}`,
            });
            router.push("/dashboard/quotes");
          } catch (err) {
            toast({
              title: "견적 생성 실패",
              description: "다시 시도해 주세요.",
              variant: "destructive",
            });
          }
        }}
        onFixIssue={(field) => {
          aiPanel.setIsOpen(false);
          // 해당 필드로 포커스 이동
          const fieldMap: Record<string, string> = {
            "희망 납기": "deliveryDate",
            "납품 위치": "deliveryLocation",
          };
          const inputName = fieldMap[field];
          if (inputName) {
            const el = document.querySelector(`[name="${inputName}"], input[placeholder*="${field}"]`) as HTMLInputElement;
            el?.focus();
            el?.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }}
        isGenerating={aiPanel.isGenerating}
        error={aiPanel.error}
      />
    </>
  );
}
