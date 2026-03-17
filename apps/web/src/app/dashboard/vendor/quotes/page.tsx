"use client";

export const dynamic = 'force-dynamic';

import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { FileText, MessageSquare, Calendar, DollarSign, TrendingUp, History, BarChart3, Clock, Percent, Download, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

export default function VendorQuotesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedQuote, setSelectedQuote] = useState<string | null>(null);
  const [selectedResponseId, setSelectedResponseId] = useState<string | null>(null);
  const [showNegotiationHistory, setShowNegotiationHistory] = useState<string | null>(null);
  const [responseForm, setResponseForm] = useState({
    totalPrice: "",
    currency: "KRW",
    message: "",
    validUntil: "",
  });
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 벤더가 받은 견적 요청 목록 조회
  const { data: quotes, isLoading } = useQuery({
    queryKey: ["vendor-quotes"],
    queryFn: async () => {
      const response = await fetch("/api/vendor/quotes");
      if (!response.ok) throw new Error("Failed to fetch quotes");
      return response.json();
    },
    enabled: status === "authenticated",
  });

  const responseMutation = useMutation({
    mutationFn: async ({ quoteId, data }: { quoteId: string; data: any }) => {
      // 벤더 전용 응답 API 사용 (SUPPLIER 역할 + 벤더 이메일 매핑)
      const response = await fetch(`/api/vendor/quotes/${quoteId}/response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Failed to submit response");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-quotes"] });
      toast({
        title: "견적 응답 완료",
        description: "견적이 성공적으로 제출되었습니다.",
      });
      setSelectedQuote(null);
      setResponseForm({ totalPrice: "", currency: "KRW", message: "", validUntil: "" });
    },
    onError: (error: any) => {
      toast({
        title: "응답 제출 실패",
        description: error?.message || "견적 응답을 제출하는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  // 협상 (응답 업데이트)
  const negotiationMutation = useMutation({
    mutationFn: async ({ quoteId, responseId, data }: { quoteId: string; responseId: string; data: any }) => {
      const response = await fetch(`/api/quotes/${quoteId}/responses/${responseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update response");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-quotes"] });
      setSelectedResponseId(null);
      setResponseForm({ totalPrice: "", currency: "KRW", message: "", validUntil: "" });
      toast({
        title: "협상 제안 완료",
        description: "가격 협상 제안이 성공적으로 제출되었습니다.",
      });
    },
  });

  // 협상 이력 조회
  const { data: negotiationHistory } = useQuery({
    queryKey: ["negotiation-history", showNegotiationHistory],
    queryFn: async () => {
      if (!showNegotiationHistory) return null;
      const [quoteId, responseId] = showNegotiationHistory.split(":");
      const response = await fetch(`/api/quotes/${quoteId}/responses/${responseId}`);
      if (!response.ok) throw new Error("Failed to fetch negotiation history");
      return response.json();
    },
    enabled: !!showNegotiationHistory,
  });

  // 벤더 ID 조회
  const { data: vendorData } = useQuery({
    queryKey: ["vendor-info"],
    queryFn: async () => {
      const response = await fetch("/api/vendor/info");
      if (!response.ok) return null;
      return response.json();
    },
    enabled: status === "authenticated",
  });

  // 벤더 통계 조회
  const { data: stats } = useQuery({
    queryKey: ["vendor-stats"],
    queryFn: async () => {
      const response = await fetch("/api/vendor/stats");
      if (!response.ok) return null;
      return response.json();
    },
    enabled: status === "authenticated",
  });

  const handleSubmitResponse = (quoteId: string) => {
    if (!responseForm.totalPrice) {
      toast({
        title: "총 금액을 입력해주세요",
        variant: "destructive",
      });
      return;
    }

    responseMutation.mutate({
      quoteId,
      data: {
        totalPrice: parseFloat(responseForm.totalPrice),
        currency: responseForm.currency,
        message: responseForm.message,
        validUntil: responseForm.validUntil || null,
      },
    });
  };

  // CSV 업로드: 품목별 단가/수량을 읽어 총액/메시지 자동 채우기
  const handleUploadCsv = (file: File, quote: any) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const text = event.target?.result;
        if (typeof text !== "string") {
          throw new Error("파일을 읽는 중 오류가 발생했습니다.");
        }

        const lines = text
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line.length > 0);

        if (lines.length < 2) {
          throw new Error("데이터 행이 없습니다.");
        }

        const [headerLine, ...dataLines] = lines;
        const headers = headerLine
          .split(",")
          .map((h) => h.replace(/^"|"$/g, "").trim().toLowerCase());

        const idx = {
          unitPrice: headers.indexOf("unit_price"),
          currency: headers.indexOf("currency"),
          leadTime: headers.indexOf("lead_time_days"),
          moq: headers.indexOf("moq"),
          notes: headers.indexOf("notes"),
        };

        if (idx.unitPrice === -1) {
          throw new Error('CSV에 "unit_price" 컬럼이 필요합니다.');
        }

        let total = 0;
        const items = quote.items || [];

        dataLines.forEach((line, rowIndex) => {
          const cols = line
            .split(",")
            .map((c) => c.replace(/^"|"$/g, "").trim());

          const quantity = items[rowIndex]?.quantity ?? 1;
          const unitPriceRaw = cols[idx.unitPrice] || "0";
          const unitPrice = parseFloat(unitPriceRaw);

          if (!isNaN(unitPrice) && quantity > 0) {
            total += unitPrice * quantity;
          }
        });

        setResponseForm((prev) => ({
          ...prev,
          totalPrice: total > 0 ? String(Math.round(total)) : prev.totalPrice,
          currency:
            idx.currency !== -1 && dataLines.length > 0
              ? dataLines[0]
                  .split(",")
                  [idx.currency]?.replace(/^"|"$/g, "").trim() || prev.currency
              : prev.currency,
        }));

        toast({
          title: "CSV 업로드 완료",
          description: `총 ${dataLines.length}개 행을 읽고 총액을 계산했습니다.`,
        });
      } catch (error: any) {
        console.error("Failed to parse CSV:", error);
        toast({
          title: "CSV 업로드 실패",
          description: error?.message || "CSV 파일을 처리하는 중 오류가 발생했습니다.",
          variant: "destructive",
        });
      }
    };

    reader.onerror = () => {
      toast({
        title: "CSV 업로드 실패",
        description: "파일을 읽는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    };

    reader.readAsText(file, "utf-8");
  };

  // CSV 템플릿 다운로드 (품목별 단가/납기/MOQ 입력용)
  const handleDownloadCsvTemplate = (quote: any) => {
    const headers = [
      "line_number",
      "product_name",
      "unit_price",
      "currency",
      "lead_time_days",
      "moq",
      "alt_product_name",
      "alt_catalog_number",
      "notes",
    ];

    const rows = (quote.items || []).map((item: any, index: number) => [
      index + 1,
      item.product?.name || "",
      "", // unit_price
      "KRW", // 기본 통화
      "", // lead_time_days
      "", // moq
      "", // alt_product_name
      "", // alt_catalog_number
      "", // notes
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell: any) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `quote-${quote.id}-vendor-template.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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

  if (status === "unauthenticated") {
    router.push("/auth/signin?callbackUrl=/dashboard/vendor/quotes");
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">견적 요청 목록</h1>
          <p className="text-muted-foreground mt-1">
            고객으로부터 받은 견적 요청에 응답할 수 있습니다.
          </p>
        </div>

        {/* 통계 카드 */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">총 견적 요청</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalQuotes || 0}</div>
                <p className="text-xs text-muted-foreground">
                  최근 30일: {stats.recentQuotes || 0}건
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">총 응답</CardTitle>
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalResponses || 0}</div>
                <p className="text-xs text-muted-foreground">
                  최근 30일: {stats.recentResponses || 0}건
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">응답률</CardTitle>
                <Percent className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.responseRate || 0}%</div>
                <p className="text-xs text-muted-foreground">
                  평균 응답 시간: {stats.avgResponseTime || 0}시간
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">총 거래 금액</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ₩{stats.totalRevenue?.toLocaleString() || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  응답한 견적 기준
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">로딩 중...</p>
          </div>
        ) : quotes?.quotes?.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">받은 견적 요청이 없습니다.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {quotes?.quotes?.map((quote: any) => (
              <Card key={quote.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{quote.title}</CardTitle>
                      <CardDescription className="mt-1">
                        {new Date(quote.createdAt).toLocaleDateString("ko-KR")}
                      </CardDescription>
                    </div>
                    <Badge variant="outline">
                      {quote.items?.length || 0}개 품목
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {quote.description && (
                    <p className="text-sm text-muted-foreground mb-4">
                      {quote.description}
                    </p>
                  )}

                  {quote.items && quote.items.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-sm font-semibold mb-2">품목 리스트</h4>
                      <div className="border rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>품목</TableHead>
                              <TableHead>수량</TableHead>
                              <TableHead className="text-right">단가</TableHead>
                              <TableHead className="text-right">금액</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {quote.items.map((item: any) => (
                              <TableRow key={item.id}>
                                <TableCell>
                                  {item.product?.name || "제품명 없음"}
                                </TableCell>
                                <TableCell>{item.quantity}</TableCell>
                                <TableCell className="text-right">
                                  ₩{item.unitPrice?.toLocaleString() || "0"}
                                </TableCell>
                                <TableCell className="text-right">
                                  ₩{item.lineTotal?.toLocaleString() || "0"}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}

                  {/* 기존 응답 표시 */}
                  {quote.responses && quote.responses.length > 0 && (
                    <div className="mb-4 p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold">기존 견적 응답</h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowNegotiationHistory(
                            showNegotiationHistory === `${quote.id}:${quote.responses[0].id}` 
                              ? null 
                              : `${quote.id}:${quote.responses[0].id}`
                          )}
                        >
                          <History className="h-3 w-3 md:h-4 md:w-4 mr-1" />
                          협상 이력
                        </Button>
                      </div>
                      {quote.responses.map((response: any) => (
                        <div key={response.id} className="text-sm">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">
                              {response.totalPrice 
                                ? `${response.totalPrice.toLocaleString()} ${response.currency}`
                                : "가격 협의 필요"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(response.updatedAt).toLocaleDateString("ko-KR")}
                            </span>
                          </div>
                          {response.message && (
                            <p className="text-xs text-muted-foreground mt-1">{response.message}</p>
                          )}
                        </div>
                      ))}
                      {showNegotiationHistory === `${quote.id}:${quote.responses[0].id}` && negotiationHistory && (
                        <div className="mt-3 pt-3 border-t">
                          <h5 className="text-xs font-semibold mb-2">협상 이력</h5>
                          <div className="space-y-2">
                            {negotiationHistory.history?.map((entry: any, idx: number) => (
                              <div key={idx} className="text-xs">
                                <div className="flex items-center justify-between">
                                  <span>
                                    {entry.metadata?.previousPrice 
                                      ? `${entry.metadata.previousPrice.toLocaleString()} → ${entry.metadata.newPrice?.toLocaleString()} ${entry.metadata.newCurrency || "KRW"}`
                                      : "가격 변경"}
                                  </span>
                                  <span className="text-muted-foreground">
                                    {new Date(entry.createdAt).toLocaleDateString("ko-KR")}
                                  </span>
                                </div>
                              </div>
                            ))}
                            {(!negotiationHistory.history || negotiationHistory.history.length === 0) && (
                              <p className="text-xs text-muted-foreground">협상 이력이 없습니다.</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2 flex-wrap">
                    {quote.responses && quote.responses.length > 0 ? (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            onClick={() => {
                              const existingResponse = quote.responses[0];
                              setSelectedResponseId(existingResponse.id);
                              setResponseForm({
                                totalPrice: existingResponse.totalPrice?.toString() || "",
                                currency: existingResponse.currency || "KRW",
                                message: existingResponse.message || "",
                                validUntil: existingResponse.validUntil 
                                  ? new Date(existingResponse.validUntil).toISOString().split("T")[0]
                                  : "",
                              });
                            }}
                            variant="default"
                          >
                            <TrendingUp className="h-4 w-4 mr-2" />
                            가격 협상하기
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>가격 협상</DialogTitle>
                            <DialogDescription>
                              새로운 가격을 제안하여 협상을 진행하세요.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <Label>총 견적 금액</Label>
                              <div className="flex gap-2 mt-1">
                                <Input
                                  type="number"
                                  placeholder="0"
                                  value={responseForm.totalPrice}
                                  onChange={(e) =>
                                    setResponseForm({
                                      ...responseForm,
                                      totalPrice: e.target.value,
                                    })
                                  }
                                />
                                <select
                                  className="px-3 py-2 border rounded-md"
                                  value={responseForm.currency}
                                  onChange={(e) =>
                                    setResponseForm({
                                      ...responseForm,
                                      currency: e.target.value,
                                    })
                                  }
                                >
                                  <option value="KRW">KRW</option>
                                  <option value="USD">USD</option>
                                  <option value="EUR">EUR</option>
                                </select>
                              </div>
                            </div>
                            <div>
                              <Label>유효 기간</Label>
                              <Input
                                type="date"
                                value={responseForm.validUntil}
                                onChange={(e) =>
                                  setResponseForm({
                                    ...responseForm,
                                    validUntil: e.target.value,
                                  })
                                }
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label>메시지</Label>
                              <Textarea
                                placeholder="가격 협상에 대한 설명을 입력하세요..."
                                value={responseForm.message}
                                onChange={(e) =>
                                  setResponseForm({
                                    ...responseForm,
                                    message: e.target.value,
                                  })
                                }
                                rows={4}
                                className="mt-1"
                              />
                            </div>
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setSelectedResponseId(null);
                                  setResponseForm({
                                    totalPrice: "",
                                    currency: "KRW",
                                    message: "",
                                    validUntil: "",
                                  });
                                }}
                              >
                                취소
                              </Button>
                              <Button
                                onClick={() => {
                                  if (selectedResponseId) {
                                    negotiationMutation.mutate({
                                      quoteId: quote.id,
                                      responseId: selectedResponseId,
                                      data: {
                                        totalPrice: responseForm.totalPrice ? parseFloat(responseForm.totalPrice) : null,
                                        currency: responseForm.currency,
                                        message: responseForm.message,
                                        validUntil: responseForm.validUntil || null,
                                      },
                                    });
                                  }
                                }}
                                disabled={negotiationMutation.isPending}
                              >
                                {negotiationMutation.isPending ? "제출 중..." : "협상 제안"}
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    ) : (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            onClick={() => {
                              setSelectedQuote(quote.id);
                              setResponseForm({
                                totalPrice: "",
                                currency: "KRW",
                                message: "",
                                validUntil: "",
                              });
                            }}
                            variant="default"
                          >
                            <MessageSquare className="h-4 w-4 mr-2" />
                            견적 응답하기
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>견적 응답</DialogTitle>
                            <DialogDescription>
                              견적 요청에 대한 가격과 메시지를 입력하거나, CSV 템플릿을 사용해 품목별 가격을 업로드할 수 있습니다.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                              <div className="text-xs text-muted-foreground">
                                CSV 템플릿을 다운로드 후, 품목별 단가/납기/MOQ를 입력하고 다시 업로드하면 총액이 자동 계산됩니다.
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDownloadCsvTemplate(quote)}
                                >
                                  <Download className="h-3 w-3 mr-1" />
                                  템플릿 다운로드
                                </Button>
                                <div>
                                  <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".csv"
                                    className="hidden"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        handleUploadCsv(file, quote);
                                      }
                                      e.target.value = "";
                                    }}
                                  />
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => fileInputRef.current?.click()}
                                  >
                                    <Upload className="h-3 w-3 mr-1" />
                                    CSV 업로드
                                  </Button>
                                </div>
                              </div>
                            </div>
                            <div>
                              <Label>총 견적 금액</Label>
                              <div className="flex gap-2 mt-1">
                                <Input
                                  type="number"
                                  placeholder="0"
                                  value={responseForm.totalPrice}
                                  onChange={(e) =>
                                    setResponseForm({
                                      ...responseForm,
                                      totalPrice: e.target.value,
                                    })
                                  }
                                />
                                <select
                                  className="px-3 py-2 border rounded-md"
                                  value={responseForm.currency}
                                  onChange={(e) =>
                                    setResponseForm({
                                      ...responseForm,
                                      currency: e.target.value,
                                    })
                                  }
                                >
                                  <option value="KRW">KRW</option>
                                  <option value="USD">USD</option>
                                  <option value="EUR">EUR</option>
                                </select>
                              </div>
                            </div>
                            <div>
                              <Label>유효 기간</Label>
                              <Input
                                type="date"
                                value={responseForm.validUntil}
                                onChange={(e) =>
                                  setResponseForm({
                                    ...responseForm,
                                    validUntil: e.target.value,
                                  })
                                }
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label>메시지</Label>
                              <Textarea
                                placeholder="견적에 대한 추가 설명이나 조건을 입력하세요..."
                                value={responseForm.message}
                                onChange={(e) =>
                                  setResponseForm({
                                    ...responseForm,
                                    message: e.target.value,
                                  })
                                }
                                rows={4}
                                className="mt-1"
                              />
                            </div>
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setSelectedQuote(null);
                                  setResponseForm({
                                    totalPrice: "",
                                    currency: "KRW",
                                    message: "",
                                    validUntil: "",
                                  });
                                }}
                              >
                                취소
                              </Button>
                              <Button
                                onClick={() => handleSubmitResponse(quote.id)}
                                disabled={responseMutation.isPending}
                              >
                                {responseMutation.isPending ? "제출 중..." : "견적 제출"}
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}
                    <Button
                      variant="outline"
                      onClick={() => router.push(`/compare/quote/${quote.id}`)}
                    >
                      상세 보기
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

