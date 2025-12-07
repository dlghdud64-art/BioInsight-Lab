"use client";

import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  CheckCircle2,
  Clock,
  XCircle,
  ShoppingCart,
} from "lucide-react";
import Link from "next/link";
import { QUOTE_STATUS } from "@/lib/constants";

type QuoteStatus = "PENDING" | "SENT" | "RESPONDED" | "COMPLETED" | "CANCELLED";

export default function QuoteDetailPage() {
  const { data: session, status } = useSession();
  const params = useParams();
  const router = useRouter();
  const quoteId = params.id as string;

  const { data: quoteData, isLoading } = useQuery({
    queryKey: ["quote", quoteId],
    queryFn: async () => {
      const response = await fetch(`/api/quotes/${quoteId}`);
      if (!response.ok) throw new Error("Failed to fetch quote");
      return response.json();
    },
    enabled: !!quoteId && status === "authenticated",
  });

  if (status === "loading" || isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <p className="text-muted-foreground">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    router.push(`/auth/signin?callbackUrl=/quotes/${quoteId}`);
    return null;
  }

  if (!quoteData?.quote) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground py-8">견적을 찾을 수 없습니다</p>
            <div className="text-center">
              <Link href="/quotes">
                <Button variant="outline">견적 목록으로 돌아가기</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const quote = quoteData.quote;
  const statusIcon = {
    PENDING: <Clock className="h-4 w-4 text-yellow-500" />,
    SENT: <CheckCircle2 className="h-4 w-4 text-blue-500" />,
    RESPONDED: <CheckCircle2 className="h-4 w-4 text-green-500" />,
    COMPLETED: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
    CANCELLED: <XCircle className="h-4 w-4 text-red-500" />,
  }[quote.status];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/quotes">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold">{quote.title}</h1>
              <div className="flex items-center gap-3 mt-2">
                <Badge
                  variant={
                    quote.status === "COMPLETED"
                      ? "default"
                      : quote.status === "RESPONDED"
                      ? "secondary"
                      : "outline"
                  }
                  className="flex items-center gap-1"
                >
                  {statusIcon}
                  {QUOTE_STATUS[quote.status]}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {new Date(quote.createdAt).toLocaleDateString("ko-KR", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 기본 정보 */}
        <Card>
          <CardHeader>
            <CardTitle>견적 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {quote.deliveryDate && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  <strong>납기 희망일:</strong>{" "}
                  {new Date(quote.deliveryDate).toLocaleDateString("ko-KR")}
                </span>
              </div>
            )}
            {quote.deliveryLocation && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  <strong>납품 장소:</strong> {quote.deliveryLocation}
                </span>
              </div>
            )}
            {quote.message && (
              <div>
                <strong className="text-sm">요청 메시지:</strong>
                <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                  {quote.message}
                </p>
              </div>
            )}
            {quote.messageEn && (
              <div>
                <strong className="text-sm">요청 메시지 (영문):</strong>
                <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                  {quote.messageEn}
                </p>
              </div>
            )}
            {quote.specialNotes && (
              <div>
                <strong className="text-sm">특이사항:</strong>
                <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                  {quote.specialNotes}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 요청 제품 목록 */}
        <Card>
          <CardHeader>
            <CardTitle>요청 제품 ({quote.items?.length || 0}개)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-semibold">제품명</th>
                    <th className="text-left p-3 font-semibold">수량</th>
                    <th className="text-left p-3 font-semibold">비고</th>
                    <th className="text-left p-3 font-semibold">상세</th>
                  </tr>
                </thead>
                <tbody>
                  {quote.items?.map((item: any) => (
                    <tr key={item.id} className="border-b hover:bg-muted/30">
                      <td className="p-3 font-medium">
                        {item.product?.name || "제품 정보 없음"}
                      </td>
                      <td className="p-3">{item.quantity}</td>
                      <td className="p-3 text-muted-foreground">
                        {item.notes || "-"}
                      </td>
                      <td className="p-3">
                        {item.product?.id && (
                          <Link href={`/products/${item.product.id}`}>
                            <Button variant="ghost" size="sm">
                              상세보기
                            </Button>
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* 응답 목록 */}
        {quote.responses && quote.responses.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>공급사 응답 ({quote.responses.length}개)</CardTitle>
              <CardDescription>
                공급사로부터 받은 견적 응답입니다
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {quote.responses.map((response: any) => (
                  <Card key={response.id} className="border-l-4 border-l-blue-500">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">
                          {response.vendor?.name || "공급사 정보 없음"}
                        </CardTitle>
                        <Badge variant="outline">
                          {new Date(response.createdAt).toLocaleDateString("ko-KR")}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {response.totalPrice && (
                        <div>
                          <strong className="text-lg text-green-600">
                            ₩{response.totalPrice.toLocaleString()}
                          </strong>
                          {response.currency && response.currency !== "KRW" && (
                            <span className="text-sm text-muted-foreground ml-2">
                              ({response.currency})
                            </span>
                          )}
                        </div>
                      )}
                      {response.validUntil && (
                        <div className="text-sm text-muted-foreground">
                          <strong>유효기간:</strong>{" "}
                          {new Date(response.validUntil).toLocaleDateString("ko-KR")}
                        </div>
                      )}
                      {response.message && (
                        <div>
                          <strong className="text-sm">응답 메시지:</strong>
                          <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                            {response.message}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 액션 버튼 */}
        <div className="flex gap-2">
          <Link href="/quotes">
            <Button variant="outline">목록으로</Button>
          </Link>
          <Link href="/compare/quote">
            <Button>
              <ShoppingCart className="h-4 w-4 mr-2" />
              새 견적 요청
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

