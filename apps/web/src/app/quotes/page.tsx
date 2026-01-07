"use client";

export const dynamic = 'force-dynamic';

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ShoppingCart,
  Search,
  Filter,
  Calendar,
  MapPin,
  ExternalLink,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { QUOTE_STATUS } from "@/lib/constants";
import { MainHeader } from "@/app/_components/main-header";
import { PageHeader } from "@/app/_components/page-header";
import { DashboardSidebar } from "@/app/_components/dashboard-sidebar";

type QuoteStatus = "PENDING" | "SENT" | "RESPONDED" | "COMPLETED" | "CANCELLED";

interface Quote {
  id: string;
  title: string;
  status: QuoteStatus;
  createdAt: string;
  deliveryDate?: string;
  deliveryLocation?: string;
  items: Array<{
    id: string;
    product: {
      id: string;
      name: string;
    };
    quantity: number;
  }>;
  responses?: Array<{
    id: string;
    vendor: {
      name: string;
    };
    totalPrice?: number;
    createdAt: string;
  }>;
}

export default function QuotesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");

  // 견적 목록 조회
  const { data: quotesData, isLoading } = useQuery({
    queryKey: ["quotes", statusFilter, sortBy],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (sortBy) params.append("sortBy", sortBy);
      const response = await fetch(`/api/quotes?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch quotes");
      return response.json();
    },
    enabled: status === "authenticated",
  });

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
  //   router.push("/auth/signin?callbackUrl=/quotes");
  //   return null;
  // }

  const quotes: Quote[] = quotesData?.quotes || [];

  // 검색 필터링
  const filteredQuotes = quotes.filter((quote) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      quote.title.toLowerCase().includes(query) ||
      quote.items.some((item) => item.product.name.toLowerCase().includes(query))
    );
  });

  // 상태별 아이콘
  const getStatusIcon = (status: QuoteStatus) => {
    switch (status) {
      case "PENDING":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "SENT":
        return <CheckCircle2 className="h-4 w-4 text-blue-500" />;
      case "RESPONDED":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "COMPLETED":
        return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case "CANCELLED":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/50">
      <MainHeader />
      <div className="flex">
        <DashboardSidebar />
        <div className="flex-1 overflow-auto min-w-0 pt-14">
          <div className="container mx-auto px-3 md:px-4 py-4 md:py-8">
            <div className="max-w-7xl mx-auto space-y-4 md:space-y-6">
        {/* 헤더 */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 md:gap-0">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl md:text-3xl font-bold text-gray-900">견적 요청 관리</h1>
            <p className="text-xs md:text-sm text-gray-500 mt-1">
              견적 요청과 응답을 한 곳에서 관리하세요
            </p>
          </div>
          <Link href="/compare/quote" className="w-full md:w-auto">
            <Button size="sm" className="w-full md:w-auto text-xs md:text-sm h-8 md:h-10">
              <ShoppingCart className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">새 견적 요청</span>
              <span className="sm:hidden">새 요청</span>
            </Button>
          </Link>
        </div>

        {/* 필터 및 검색 */}
        <Card className="p-3 md:p-6 bg-white rounded-2xl shadow-sm border border-gray-100">
          <CardContent className="px-0 pt-0 pb-0">
            <div className="flex flex-col md:flex-row gap-3 md:gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-2 md:left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-3.5 w-3.5 md:h-4 md:w-4" />
                  <Input
                    placeholder="견적 제목 또는 제품명으로 검색..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 md:pl-10 text-xs md:text-sm h-8 md:h-10"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[180px] text-xs md:text-sm h-8 md:h-10">
                  <Filter className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                  <SelectValue placeholder="상태 필터" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="PENDING">대기 중</SelectItem>
                  <SelectItem value="SENT">발송 완료</SelectItem>
                  <SelectItem value="RESPONDED">응답 받음</SelectItem>
                  <SelectItem value="COMPLETED">완료</SelectItem>
                  <SelectItem value="CANCELLED">취소</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-full md:w-[180px] text-xs md:text-sm h-8 md:h-10">
                  <SelectValue placeholder="정렬" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">최신순</SelectItem>
                  <SelectItem value="oldest">오래된순</SelectItem>
                  <SelectItem value="status">상태순</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* 견적 목록 */}
        {isLoading ? (
          <Card className="bg-white rounded-2xl shadow-sm border border-gray-100">
            <CardContent className="pt-6">
              <p className="text-center text-gray-500 py-8">로딩 중...</p>
            </CardContent>
          </Card>
        ) : filteredQuotes.length === 0 ? (
          <Card className="bg-white rounded-2xl shadow-sm border border-gray-100">
            <CardContent className="pt-6">
              <p className="text-center text-gray-500 py-8">
                {searchQuery || statusFilter !== "all"
                  ? "검색 결과가 없습니다"
                  : "견적 요청이 없습니다"}
              </p>
              {!searchQuery && statusFilter === "all" && (
                <div className="text-center">
                  <Link href="/search">
                    <Button>첫 견적 요청하기</Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3 md:space-y-4">
            {filteredQuotes.map((quote) => (
              <Card key={quote.id} className="hover:shadow-md transition-shadow p-3 md:p-6 bg-white rounded-2xl shadow-sm border border-gray-100">
                <CardHeader className="px-0 pt-0 pb-3">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2 md:gap-0">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-3 mb-2">
                        <CardTitle className="text-sm md:text-lg truncate">{quote.title}</CardTitle>
                        <Badge
                          variant={
                            quote.status === "COMPLETED"
                              ? "default"
                              : quote.status === "RESPONDED"
                              ? "secondary"
                              : "outline"
                          }
                          className="flex items-center gap-1 text-[10px] md:text-xs flex-shrink-0"
                        >
                          <span className="hidden md:inline">{getStatusIcon(quote.status)}</span>
                          {QUOTE_STATUS[quote.status]}
                        </Badge>
                      </div>
                      <div className="flex flex-col md:flex-row md:flex-wrap gap-2 md:gap-4 text-xs md:text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 flex-shrink-0" />
                          {new Date(quote.createdAt).toLocaleDateString("ko-KR")}
                        </span>
                        {quote.deliveryDate && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 flex-shrink-0" />
                            <span className="hidden sm:inline">납기 희망: </span>
                            {new Date(quote.deliveryDate).toLocaleDateString("ko-KR")}
                          </span>
                        )}
                        {quote.deliveryLocation && (
                          <span className="flex items-center gap-1 truncate">
                            <MapPin className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{quote.deliveryLocation}</span>
                          </span>
                        )}
                      </div>
                    </div>
                    <Link href={`/quotes/${quote.id}`} className="w-full md:w-auto">
                      <Button variant="outline" size="sm" className="w-full md:w-auto text-xs md:text-sm h-7 md:h-9">
                        <ExternalLink className="h-3 w-3 md:h-4 md:w-4 mr-1" />
                        상세보기
                      </Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent className="px-0 pb-0 space-y-2 md:space-y-3">
                  {/* 제품 목록 */}
                  <div>
                    <p className="text-xs md:text-sm font-medium mb-1.5 md:mb-2">요청 제품 ({quote.items.length}개)</p>
                    <div className="space-y-1">
                      {quote.items.slice(0, 3).map((item) => (
                        <div key={item.id} className="text-xs md:text-sm text-muted-foreground truncate">
                          • {item.product.name} × {item.quantity}
                        </div>
                      ))}
                      {quote.items.length > 3 && (
                        <div className="text-xs md:text-sm text-muted-foreground">
                          + {quote.items.length - 3}개 더
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 응답 상태 */}
                  {quote.responses && quote.responses.length > 0 && (
                    <div>
                      <p className="text-xs md:text-sm font-medium mb-1.5 md:mb-2">
                        응답 받음 ({quote.responses.length}개 공급사)
                      </p>
                      <div className="flex flex-wrap gap-1.5 md:gap-2">
                        {quote.responses.map((response) => (
                          <Badge key={response.id} variant="outline" className="text-[10px] md:text-xs">
                            {response.vendor.name}
                            {response.totalPrice && (
                              <span className="ml-1 font-semibold">
                                ₩{response.totalPrice.toLocaleString()}
                              </span>
                            )}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}