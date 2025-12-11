"use client";

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
import { FileText, MessageSquare, Calendar, DollarSign } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function VendorQuotesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedQuote, setSelectedQuote] = useState<string | null>(null);
  const [responseForm, setResponseForm] = useState({
    totalPrice: "",
    currency: "KRW",
    message: "",
    validUntil: "",
  });

  // 벤더가 받은 견적 요청 목록 조회
  // TODO: 실제로는 벤더 ID로 필터링해야 함
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
      const response = await fetch(`/api/quotes/${quoteId}/responses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to submit response");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-quotes"] });
      setSelectedQuote(null);
      setResponseForm({ totalPrice: "", currency: "KRW", message: "", validUntil: "" });
    },
  });

  const handleSubmitResponse = (quoteId: string) => {
    // TODO: 실제 벤더 ID를 가져와야 함
    const vendorId = "temp-vendor-id"; // 임시

    responseMutation.mutate({
      quoteId,
      data: {
        vendorId,
        totalPrice: responseForm.totalPrice ? parseFloat(responseForm.totalPrice) : null,
        currency: responseForm.currency,
        message: responseForm.message,
        validUntil: responseForm.validUntil || null,
      },
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

  // 개발 단계: 로그인 체크 제거
  // if (status === "unauthenticated") {
  //   router.push("/auth/signin?callbackUrl=/dashboard/vendor/quotes");
  //   return null;
  // }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">견적 요청 목록</h1>
          <p className="text-muted-foreground mt-1">
            고객으로부터 받은 견적 요청에 응답할 수 있습니다.
          </p>
        </div>

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

                  <div className="flex items-center gap-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          onClick={() => setSelectedQuote(quote.id)}
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
                            견적 요청에 대한 가격과 메시지를 입력하세요.
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

