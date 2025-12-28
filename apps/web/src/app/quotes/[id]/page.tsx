"use client";

export const dynamic = 'force-dynamic';

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  CheckCircle2,
  Clock,
  XCircle,
  ShoppingCart,
  Package,
  FileText,
  Inbox,
  Download,
  Save,
  GitCompare,
} from "lucide-react";
import Link from "next/link";
import { QUOTE_STATUS } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type QuoteStatus = "PENDING" | "SENT" | "RESPONDED" | "COMPLETED" | "CANCELLED";

export default function QuoteDetailPage() {
  const { data: session, status } = useSession();
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const quoteId = params.id as string;
  const [activeTab, setActiveTab] = useState("items");

  const { data: quoteData, isLoading } = useQuery({
    queryKey: ["quote", quoteId],
    queryFn: async () => {
      const response = await fetch(`/api/quotes/${quoteId}`);
      if (!response.ok) throw new Error("Failed to fetch quote");
      return response.json();
    },
    enabled: !!quoteId && status === "authenticated",
  });

  // 구매 완료 상태 업데이트
  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: QuoteStatus) => {
      const response = await fetch(`/api/quotes/${quoteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!response.ok) throw new Error("Failed to update status");
      return response.json();
    },
    onSuccess: (data, newStatus) => {
      queryClient.invalidateQueries({ queryKey: ["quote", quoteId] });
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      toast({
        title: newStatus === "COMPLETED" ? "구매 완료 처리됨" : "상태 업데이트 완료",
        description: newStatus === "COMPLETED" 
          ? "구매 내역이 자동으로 기록되었습니다."
          : "견적 상태가 업데이트되었습니다.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "업데이트 실패",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleMarkAsCompleted = () => {
    if (confirm("이 견적을 구매 완료로 표시하시겠습니까? 구매 내역이 자동으로 기록됩니다.")) {
      updateStatusMutation.mutate("COMPLETED");
    }
  };

  if (status === "loading" || isLoading) {
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
  //   router.push(`/auth/signin?callbackUrl=/quotes/${quoteId}`);
  //   return null;
  // }

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
  const quoteStatus = quote.status as QuoteStatus;
  const statusIcon = {
    PENDING: <Clock className="h-4 w-4 text-yellow-500" />,
    SENT: <CheckCircle2 className="h-4 w-4 text-blue-500" />,
    RESPONDED: <CheckCircle2 className="h-4 w-4 text-green-500" />,
    COMPLETED: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
    CANCELLED: <XCircle className="h-4 w-4 text-red-500" />,
  }[quoteStatus];

  return (
    <div className="container mx-auto px-3 md:px-4 py-4 md:py-8">
      <div className="max-w-5xl mx-auto space-y-4 md:space-y-6">
        {/* 헤더 */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 md:gap-0">
          <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
            <Link href="/quotes">
              <Button variant="ghost" size="icon" className="h-8 w-8 md:h-10 md:w-10">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg md:text-3xl font-bold truncate">{quote.title}</h1>
              <div className="flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-3 mt-2">
                <Badge
                  variant={
                    quote.status === "COMPLETED"
                      ? "default"
                      : quote.status === "RESPONDED"
                      ? "secondary"
                      : "outline"
                  }
                  className="flex items-center gap-1 text-xs md:text-sm"
                >
                  {statusIcon}
                  {QUOTE_STATUS[quoteStatus]}
                </Badge>
                <span className="text-xs md:text-sm text-muted-foreground">
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
        <Card className="p-3 md:p-6">
          <CardHeader className="px-0 pt-0 pb-3">
            <CardTitle className="text-sm md:text-lg">견적 정보</CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0 space-y-3 md:space-y-4">
            {quote.deliveryDate && (
              <div className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-xs md:text-sm">
                  <strong>납기 희망일:</strong>{" "}
                  {new Date(quote.deliveryDate).toLocaleDateString("ko-KR")}
                </span>
              </div>
            )}
            {quote.deliveryLocation && (
              <div className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-xs md:text-sm truncate">
                  <strong>납품 장소:</strong> {quote.deliveryLocation}
                </span>
              </div>
            )}
            {quote.message && (
              <div>
                <strong className="text-xs md:text-sm">요청 메시지:</strong>
                <p className="text-xs md:text-sm text-muted-foreground mt-1 whitespace-pre-wrap break-words">
                  {quote.message}
                </p>
              </div>
            )}
            {quote.messageEn && (
              <div>
                <strong className="text-xs md:text-sm">요청 메시지 (영문):</strong>
                <p className="text-xs md:text-sm text-muted-foreground mt-1 whitespace-pre-wrap break-words">
                  {quote.messageEn}
                </p>
              </div>
            )}
            {quote.specialNotes && (
              <div>
                <strong className="text-xs md:text-sm">특이사항:</strong>
                <p className="text-xs md:text-sm text-muted-foreground mt-1 whitespace-pre-wrap break-words">
                  {quote.specialNotes}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 견적 요청 품목 테이블 */}
        <Card className="p-3 md:p-6">
          <CardHeader className="px-0 pt-0 pb-3">
            <CardTitle className="text-sm md:text-lg">견적 요청 품목 ({quote.items?.length || 0}개)</CardTitle>
            <CardDescription className="text-xs md:text-sm mt-1">
              견적 요청 생성 시점의 품목 스냅샷입니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {/* 모바일: 카드 리스트 형태 */}
            <div className="md:hidden space-y-3">
              {quote.items?.map((item: any) => {
                const vendor = item.product?.vendors?.[0]?.vendor;
                return (
                  <Card key={item.id} className="p-3 border">
                    <div className="space-y-2">
                      <div className="font-medium text-sm">{item.product?.name || "제품 정보 없음"}</div>
                      <div className="text-xs text-muted-foreground space-y-1">
                        {vendor?.name && <div>벤더: {vendor.name}</div>}
                        {item.product?.spec && <div>규격: {item.product.spec}</div>}
                        <div>수량: {item.quantity}</div>
                        {item.notes && <div>비고: {item.notes}</div>}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
            {/* 데스크톱: 테이블 형태 */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 md:p-3 font-semibold text-xs md:text-sm">제품명</th>
                    <th className="text-left p-2 md:p-3 font-semibold text-xs md:text-sm">벤더</th>
                    <th className="text-left p-2 md:p-3 font-semibold text-xs md:text-sm">규격</th>
                    <th className="text-left p-2 md:p-3 font-semibold text-xs md:text-sm">수량</th>
                    <th className="text-left p-2 md:p-3 font-semibold text-xs md:text-sm">비고</th>
                  </tr>
                </thead>
                <tbody>
                  {quote.items?.map((item: any) => {
                    const vendor = item.product?.vendors?.[0]?.vendor;
                    return (
                      <tr key={item.id} className="border-b hover:bg-muted/30">
                        <td className="p-2 md:p-3 font-medium text-xs md:text-sm min-w-[120px]">
                          <div className="truncate">{item.product?.name || "제품 정보 없음"}</div>
                        </td>
                        <td className="p-2 md:p-3 text-xs md:text-sm text-muted-foreground">
                          {vendor?.name || "-"}
                        </td>
                        <td className="p-2 md:p-3 text-xs md:text-sm text-muted-foreground">
                          {item.product?.spec || "-"}
                        </td>
                        <td className="p-2 md:p-3 text-xs md:text-sm">{item.quantity}</td>
                        <td className="p-2 md:p-3 text-xs md:text-sm text-muted-foreground">
                          {item.notes || "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* 탭 구조: 회신 입력, 회신 수신함 */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="items" className="text-xs md:text-sm">
              <FileText className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              회신 입력
            </TabsTrigger>
            <TabsTrigger value="inbox" className="text-xs md:text-sm">
              <Inbox className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              회신 수신함
            </TabsTrigger>
          </TabsList>

          {/* 회신 입력 탭 */}
          <TabsContent value="items" className="mt-4 md:mt-6">
            <Card className="p-3 md:p-6">
              <CardHeader className="px-0 pt-0 pb-3">
                <CardTitle className="text-sm md:text-lg">회신 입력</CardTitle>
                <CardDescription className="text-xs md:text-sm">
                  견적서는 검토 후 수동으로 입력하세요.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-0 pb-0">
                <div className="space-y-4">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2 md:p-3 font-semibold text-xs md:text-sm">벤더명</th>
                          <th className="text-left p-2 md:p-3 font-semibold text-xs md:text-sm">품목명</th>
                          <th className="text-left p-2 md:p-3 font-semibold text-xs md:text-sm">수량</th>
                          <th className="text-left p-2 md:p-3 font-semibold text-xs md:text-sm">단가</th>
                          <th className="text-left p-2 md:p-3 font-semibold text-xs md:text-sm hidden md:table-cell">통화</th>
                          <th className="text-left p-2 md:p-3 font-semibold text-xs md:text-sm hidden md:table-cell">납기</th>
                          <th className="text-left p-2 md:p-3 font-semibold text-xs md:text-sm hidden md:table-cell">MOQ</th>
                          <th className="text-left p-2 md:p-3 font-semibold text-xs md:text-sm hidden md:table-cell">비고</th>
                        </tr>
                      </thead>
                      <tbody>
                        {quote.items?.map((item: any, index: number) => (
                          <tr key={item.id} className="border-b">
                            <td className="p-2 md:p-3">
                              <Input
                                placeholder="벤더명"
                                className="text-xs md:text-sm h-8 md:h-10"
                              />
                            </td>
                            <td className="p-2 md:p-3">
                              <div className="text-xs md:text-sm font-medium">
                                {item.product?.name || "제품 정보 없음"}
                              </div>
                            </td>
                            <td className="p-2 md:p-3">
                              <Input
                                type="number"
                                placeholder="수량"
                                defaultValue={item.quantity}
                                className="text-xs md:text-sm h-8 md:h-10 w-20"
                              />
                            </td>
                            <td className="p-2 md:p-3">
                              <Input
                                type="number"
                                placeholder="단가"
                                className="text-xs md:text-sm h-8 md:h-10 w-24"
                              />
                            </td>
                            <td className="p-2 md:p-3 hidden md:table-cell">
                              <Select defaultValue="KRW">
                                <SelectTrigger className="text-xs md:text-sm h-8 md:h-10 w-20">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="KRW">KRW</SelectItem>
                                  <SelectItem value="USD">USD</SelectItem>
                                  <SelectItem value="EUR">EUR</SelectItem>
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="p-2 md:p-3 hidden md:table-cell">
                              <Input
                                placeholder="납기"
                                className="text-xs md:text-sm h-8 md:h-10 w-24"
                              />
                            </td>
                            <td className="p-2 md:p-3 hidden md:table-cell">
                              <Input
                                type="number"
                                placeholder="MOQ"
                                className="text-xs md:text-sm h-8 md:h-10 w-20"
                              />
                            </td>
                            <td className="p-2 md:p-3 hidden md:table-cell">
                              <Textarea
                                placeholder="비고"
                                rows={1}
                                className="text-xs md:text-sm"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 pt-2">
                    <Button className="w-full sm:w-auto">
                      <Save className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                      회신 저장
                    </Button>
                    <Button variant="outline" className="w-full sm:w-auto">
                      <GitCompare className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                      비교에 반영
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 회신 수신함 탭 */}
          <TabsContent value="inbox" className="mt-4 md:mt-6">
            <Card className="p-3 md:p-6">
              <CardHeader className="px-0 pt-0 pb-3">
                <CardTitle className="text-sm md:text-lg">회신 수신함</CardTitle>
                <CardDescription className="text-xs md:text-sm">
                  첨부된 견적서는 자동 반영되지 않습니다.
                  <br />
                  검토 후 회신 입력 화면에서 정리하세요.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-0 pb-0">
                <div className="space-y-3">
                  {/* 샘플 데이터 - 실제로는 API에서 가져와야 함 */}
                  <div className="text-center py-8 text-muted-foreground text-xs md:text-sm">
                    수신된 회신이 없습니다.
                  </div>
                  {/* 향후 구현: 이메일 회신 리스트 */}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>


        {/* 액션 버튼 */}
        <div className="flex flex-col sm:flex-row gap-2">
          <Link href="/quotes" className="w-full sm:w-auto">
            <Button variant="outline" className="w-full sm:w-auto text-xs md:text-sm h-8 md:h-10">
              목록으로
            </Button>
          </Link>
          {quote.status !== "COMPLETED" && (
            <Button
              onClick={handleMarkAsCompleted}
              disabled={updateStatusMutation.isPending}
              className="bg-green-600 hover:bg-green-700 text-white w-full sm:w-auto text-xs md:text-sm h-8 md:h-10"
            >
              <Package className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              {updateStatusMutation.isPending ? "처리 중..." : "구매 완료로 표시"}
            </Button>
          )}
          {quote.status === "COMPLETED" && (
            <Badge variant="default" className="px-3 py-1.5 text-xs md:text-sm w-full sm:w-auto justify-center">
              <CheckCircle2 className="h-3 w-3 md:h-4 md:w-4 mr-1" />
              구매 완료됨
            </Badge>
          )}
          <Link href="/compare/quote" className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto text-xs md:text-sm h-8 md:h-10">
              <ShoppingCart className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">새 견적 요청</span>
              <span className="sm:hidden">새 요청</span>
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}