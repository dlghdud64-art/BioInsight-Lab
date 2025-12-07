"use client";

import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FileText, TrendingUp, Calendar, MapPin, User, Mail, DollarSign, Crown } from "lucide-react";
import { useState } from "react";
import { QUOTE_STATUS, PRODUCT_CATEGORIES } from "@/lib/constants";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function SupplierDashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();

  // 견적 요청 목록 조회
  const { data, isLoading } = useQuery({
    queryKey: ["vendor-quotes"],
    queryFn: async () => {
      const response = await fetch("/api/vendor/quotes");
      if (!response.ok) throw new Error("Failed to fetch quotes");
      return response.json();
    },
    enabled: status === "authenticated",
  });

  const quotes = data?.quotes || [];
  const stats = data?.stats || {
    totalQuotes: 0,
    thisMonthQuotes: 0,
    totalResponses: 0,
    responseRate: 0,
    successRate: 0,
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
    router.push("/auth/signin?callbackUrl=/dashboard/supplier");
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">공급사 대시보드</h1>
          <div className="flex gap-2">
            <Link href="/dashboard/vendor/billing">
              <Button variant="outline" className="gap-2">
                <DollarSign className="h-4 w-4" />
                과금 관리
              </Button>
            </Link>
            {data?.vendor && (
              <Link href="/dashboard/vendor/premium">
                <Button variant={data.vendor.isPremium ? "default" : "outline"} className="gap-2">
                  <Crown className="h-4 w-4" />
                  {data.vendor.isPremium ? "프리미엄 관리" : "프리미엄 업그레이드"}
                </Button>
              </Link>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">견적 요청 수</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.thisMonthQuotes}</div>
              <p className="text-sm text-muted-foreground mt-1">이번 달</p>
              <p className="text-xs text-muted-foreground mt-1">
                전체: {stats.totalQuotes}개
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">응답률</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.responseRate}%</div>
              <p className="text-sm text-muted-foreground mt-1">전체 요청 대비</p>
              <p className="text-xs text-muted-foreground mt-1">
                응답: {stats.totalResponses}개
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">수주 성공률</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.successRate}%</div>
              <p className="text-sm text-muted-foreground mt-1">응답 대비</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>들어온 견적 요청</CardTitle>
            <CardDescription>
              견적 요청 리스트를 확인하고 응답하세요
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-center text-muted-foreground py-8">로딩 중...</p>
            ) : quotes.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                들어온 견적 요청이 없습니다
              </p>
            ) : (
              <div className="space-y-4">
                {quotes.map((quote: any) => (
                  <QuoteCard key={quote.id} quote={quote} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function QuoteCard({ quote }: { quote: any }) {
  const [isResponding, setIsResponding] = useState(false);
  const [showResponseForm, setShowResponseForm] = useState(false);
  const [totalPrice, setTotalPrice] = useState("");
  const [message, setMessage] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const queryClient = useQueryClient();

  const existingResponse = quote.responses?.[0];

  const responseMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch(`/api/vendor/quotes/${quote.id}/response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to submit response");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-quotes"] });
      setShowResponseForm(false);
      setTotalPrice("");
      setMessage("");
      setValidUntil("");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    responseMutation.mutate({
      totalPrice,
      message,
      validUntil: validUntil || undefined,
    });
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">{quote.title}</CardTitle>
            <CardDescription className="mt-1">
              {new Date(quote.createdAt).toLocaleDateString("ko-KR")}
            </CardDescription>
          </div>
          <span
            className={`px-2 py-1 rounded text-xs font-medium ${
              quote.status === "COMPLETED"
                ? "bg-green-100 text-green-800"
                : quote.status === "RESPONDED"
                ? "bg-blue-100 text-blue-800"
                : "bg-yellow-100 text-yellow-800"
            }`}
          >
            {QUOTE_STATUS[quote.status as keyof typeof QUOTE_STATUS]}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {quote.user && (
          <div className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4 text-muted-foreground" />
            <span>{quote.user.name || "사용자"}</span>
            {quote.user.email && (
              <>
                <Mail className="h-4 w-4 text-muted-foreground ml-2" />
                <span className="text-muted-foreground">{quote.user.email}</span>
              </>
            )}
          </div>
        )}

        {quote.message && (
          <div>
            <p className="text-sm font-medium mb-1">요청 내용:</p>
            <p className="text-sm text-muted-foreground">{quote.message}</p>
          </div>
        )}

        <div className="space-y-2 text-sm">
          {quote.deliveryDate && (
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>납기 희망일: {new Date(quote.deliveryDate).toLocaleDateString("ko-KR")}</span>
            </div>
          )}
          {quote.deliveryLocation && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span>납품 장소: {quote.deliveryLocation}</span>
            </div>
          )}
        </div>

        <div>
          <p className="text-sm font-medium mb-2">요청 제품:</p>
          <div className="space-y-2">
            {quote.items?.map((item: any) => {
              const vendorProduct = item.product.vendors?.[0];
              return (
                <div key={item.id} className="p-2 bg-muted rounded text-sm">
                  <div className="font-medium">{item.product.name}</div>
                  <div className="text-muted-foreground">
                    수량: {item.quantity}개
                    {vendorProduct?.priceInKRW && (
                      <span className="ml-2">
                        (기본 가격: ₩{vendorProduct.priceInKRW.toLocaleString()})
                      </span>
                    )}
                  </div>
                  {item.notes && (
                    <div className="text-muted-foreground text-xs mt-1">
                      비고: {item.notes}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {existingResponse ? (
          <div className="p-3 bg-green-50 rounded border border-green-200">
            <p className="text-sm font-medium text-green-800 mb-2">견적 응답 완료</p>
            {existingResponse.totalPrice && (
              <p className="text-lg font-bold text-green-900">
                ₩{existingResponse.totalPrice.toLocaleString()}
              </p>
            )}
            {existingResponse.message && (
              <p className="text-sm text-green-700 mt-2">{existingResponse.message}</p>
            )}
            {existingResponse.validUntil && (
              <p className="text-xs text-green-600 mt-1">
                유효기간: {new Date(existingResponse.validUntil).toLocaleDateString("ko-KR")}
              </p>
            )}
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={() => setShowResponseForm(true)}
            >
              수정하기
            </Button>
          </div>
        ) : (
          <Button onClick={() => setShowResponseForm(true)}>견적 응답하기</Button>
        )}

        {showResponseForm && (
          <form onSubmit={handleSubmit} className="p-4 border rounded-lg space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">총 가격 (KRW)</label>
              <Input
                type="number"
                value={totalPrice}
                onChange={(e) => setTotalPrice(e.target.value)}
                placeholder="예: 1000000"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">메시지</label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="견적에 대한 추가 설명을 작성해주세요"
                rows={3}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">견적 유효기간</label>
              <Input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowResponseForm(false);
                  setTotalPrice("");
                  setMessage("");
                  setValidUntil("");
                }}
              >
                취소
              </Button>
              <Button type="submit" disabled={responseMutation.isPending}>
                {responseMutation.isPending ? "제출 중..." : "견적 제출"}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

