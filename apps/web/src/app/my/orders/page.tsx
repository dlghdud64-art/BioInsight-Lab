"use client";

export const dynamic = 'force-dynamic';

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MainHeader } from "@/app/_components/main-header";
import { PageHeader } from "@/app/_components/page-header";
import { DashboardSidebar } from "@/app/_components/dashboard-sidebar";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Package,
  Calendar,
  Clock,
  CheckCircle2,
  Truck,
  XCircle,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { OrderStatus } from "@prisma/client";

const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  ORDERED: "접수대기",
  CONFIRMED: "확인됨",
  SHIPPING: "배송중",
  DELIVERED: "배송완료",
  CANCELLED: "취소됨",
};

const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  ORDERED: "bg-yellow-100 text-yellow-800 border-yellow-300",
  CONFIRMED: "bg-blue-100 text-blue-800 border-blue-300",
  SHIPPING: "bg-purple-100 text-purple-800 border-purple-300",
  DELIVERED: "bg-green-100 text-green-800 border-green-300",
  CANCELLED: "bg-red-100 text-red-800 border-red-300",
};

const ORDER_STATUS_ICONS: Record<OrderStatus, React.ReactNode> = {
  ORDERED: <Clock className="h-3 w-3" />,
  CONFIRMED: <CheckCircle2 className="h-3 w-3" />,
  SHIPPING: <Truck className="h-3 w-3" />,
  DELIVERED: <CheckCircle2 className="h-3 w-3" />,
  CANCELLED: <XCircle className="h-3 w-3" />,
};

export default function MyOrdersPage() {
  const { data: session, status } = useSession();
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data: ordersData, isLoading } = useQuery({
    queryKey: ["my-orders", page],
    queryFn: async () => {
      const response = await fetch(`/api/orders?page=${page}&limit=${limit}`);
      if (!response.ok) throw new Error("Failed to fetch orders");
      return response.json();
    },
    enabled: status === "authenticated",
  });

  const orders = ordersData?.orders || [];
  const total = ordersData?.total || 0;
  const totalPages = ordersData?.totalPages || 0;

  if (status === "loading" || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <MainHeader />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <p className="text-muted-foreground">로딩 중...</p>
          </div>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="min-h-screen bg-gray-50">
        <MainHeader />
        <div className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground py-8">
                로그인이 필요합니다
              </p>
              <div className="text-center">
                <Link href="/auth/signin">
                  <Button>로그인하기</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <MainHeader />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* 헤더 */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">주문 내역</h1>
              <p className="text-muted-foreground mt-1">
                요청하신 주문의 상태를 확인하실 수 있습니다
              </p>
            </div>
            <Link href="/quotes">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                견적 목록으로
              </Button>
            </Link>
          </div>

          {/* 주문 목록 */}
          <Card>
            <CardHeader>
              <CardTitle>주문 목록</CardTitle>
              <CardDescription>
                총 {total}개의 주문이 있습니다
              </CardDescription>
            </CardHeader>
            <CardContent>
              {orders.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">주문 내역이 없습니다</p>
                  <Link href="/quotes" className="mt-4 inline-block">
                    <Button variant="outline" className="mt-4">
                      견적 요청하기
                    </Button>
                  </Link>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>주문번호</TableHead>
                          <TableHead>견적 제목</TableHead>
                          <TableHead>주문 금액</TableHead>
                          <TableHead>상태</TableHead>
                          <TableHead>희망 배송일</TableHead>
                          <TableHead>주문일</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orders.map((order: any) => (
                          <TableRow key={order.id}>
                            <TableCell className="font-medium">
                              {order.orderNumber}
                            </TableCell>
                            <TableCell>
                              <Link
                                href={`/quotes/${order.quoteId}`}
                                className="text-blue-600 hover:underline"
                              >
                                {order.quote?.title || "견적 없음"}
                              </Link>
                            </TableCell>
                            <TableCell>
                              ₩{order.totalAmount.toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <Badge
                                className={ORDER_STATUS_COLORS[order.status]}
                                variant="outline"
                              >
                                <span className="flex items-center gap-1">
                                  {ORDER_STATUS_ICONS[order.status]}
                                  {ORDER_STATUS_LABELS[order.status]}
                                </span>
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {order.expectedDelivery ? (
                                <div className="flex items-center gap-1 text-sm">
                                  <Calendar className="h-3 w-3 text-muted-foreground" />
                                  {new Date(
                                    order.expectedDelivery
                                  ).toLocaleDateString("ko-KR")}
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm">
                                  미정
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              {new Date(order.createdAt).toLocaleDateString(
                                "ko-KR",
                                {
                                  year: "numeric",
                                  month: "long",
                                  day: "numeric",
                                }
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* 페이지네이션 */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4">
                      <p className="text-sm text-muted-foreground">
                        페이지 {page} / {totalPages}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          disabled={page === 1}
                        >
                          이전
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setPage((p) => Math.min(totalPages, p + 1))
                          }
                          disabled={page === totalPages}
                        >
                          다음
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

