"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminSidebar } from "../_components/admin-sidebar";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Eye,
  ShoppingCart,
  Loader2,
  TrendingUp,
} from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Quote {
  id: string;
  title: string;
  status: string;
  totalAmount: number | null;
  createdAt: string;
  user: {
    name: string | null;
    email: string | null;
  } | null;
  _count: {
    listItems: number;
    items: number;
  };
  items?: Array<{
    id: string;
    name: string | null;
    brand: string | null;
    catalogNumber: string | null;
    quantity: number;
    unitPrice: number | null;
    lineTotal: number | null;
    notes: string | null;
  }>;
}

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  PENDING: { label: "대기 중", variant: "secondary" },
  PARSED: { label: "파싱 완료", variant: "outline" },
  SENT: { label: "발송됨", variant: "default" },
  RESPONDED: { label: "응답 완료", variant: "default" },
  COMPLETED: { label: "완료", variant: "default" },
  PURCHASED: { label: "구매 완료", variant: "default" },
  CANCELLED: { label: "취소됨", variant: "destructive" },
};

const HIGH_VALUE_THRESHOLD = 5000000; // 500만원

export default function AdminQuotesPage() {
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-quotes"],
    queryFn: async () => {
      const response = await fetch(`/api/admin/quotes?limit=100`);
      if (!response.ok) throw new Error("Failed to fetch quotes");
      return response.json();
    },
  });

  // 선택된 견적 상세 조회
  const { data: quoteDetail } = useQuery({
    queryKey: ["admin-quote-detail", selectedQuoteId],
    queryFn: async () => {
      if (!selectedQuoteId) return null;
      const response = await fetch(`/api/admin/quotes/${selectedQuoteId}`);
      if (!response.ok) throw new Error("Failed to fetch quote detail");
      const data = await response.json();
      // API가 quote 객체를 직접 반환하거나 { quote } 형태로 반환할 수 있음
      return data.quote || data;
    },
    enabled: !!selectedQuoteId,
  });

  // 주문으로 전환 mutation (관리자용 - 다른 사용자의 견적도 주문 가능)
  const convertToOrderMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      // 관리자용 주문 생성 API 사용
      const response = await fetch("/api/admin/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to convert to order");
      }

      return response.json();
    },
    onSuccess: (data, quoteId) => {
      queryClient.invalidateQueries({ queryKey: ["admin-quotes"] });
      setShowConvertDialog(false);
      setSelectedQuoteId(null);
      toast({
        title: "주문 생성 완료",
        description: "견적이 주문으로 전환되었습니다.",
      });
      // 주문 상세 페이지로 이동
      router.push(`/admin/orders/${data.order.id}`);
    },
    onError: (error: Error) => {
      toast({
        title: "주문 생성 실패",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const quotes: Quote[] = data?.quotes || [];

  const columns: ColumnDef<Quote>[] = [
    {
      accessorKey: "id",
      header: "견적번호",
      cell: ({ row }) => {
        const id = row.getValue("id") as string;
        return (
          <span className="font-mono text-xs text-slate-600">
            #{id.slice(-8).toUpperCase()}
          </span>
        );
      },
    },
    {
      accessorKey: "user",
      header: "요청자",
      cell: ({ row }) => {
        const user = row.getValue("user") as Quote["user"];
        return (
          <div>
            <div className="text-sm font-medium">
              {user?.name || "이름 없음"}
            </div>
            <div className="text-xs text-slate-500">
              {user?.email || "-"}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "totalAmount",
      header: "총액",
      cell: ({ row }) => {
        const amount = row.getValue("totalAmount") as number | null;
        const isHighValue = amount && amount >= HIGH_VALUE_THRESHOLD;
        return (
          <div className={`text-right font-semibold ${isHighValue ? "text-blue-600" : "text-slate-900"}`}>
            {amount ? `₩${amount.toLocaleString()}` : "-"}
            {isHighValue && (
              <TrendingUp className="inline-block ml-1 h-3 w-3 text-blue-600" />
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "createdAt",
      header: "생성일",
      cell: ({ row }) => {
        const date = row.getValue("createdAt") as string;
        return (
          <span className="text-sm text-slate-600">
            {format(new Date(date), "yyyy.MM.dd", { locale: ko })}
          </span>
        );
      },
    },
    {
      accessorKey: "status",
      header: "상태",
      cell: ({ row }) => {
        const status = row.getValue("status") as string;
        const statusInfo = STATUS_LABELS[status] || {
          label: status,
          variant: "secondary" as const,
        };
        return (
          <Badge variant={statusInfo.variant}>
            {statusInfo.label}
          </Badge>
        );
      },
    },
    {
      id: "actions",
      header: "액션",
      cell: ({ row }) => {
        const quote = row.original;
        const isHighValue = quote.totalAmount && quote.totalAmount >= HIGH_VALUE_THRESHOLD;
        const isWaiting = quote.status === "PENDING" || quote.status === "PARSED";
        const canConvert = quote.status === "COMPLETED";

        return (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedQuoteId(quote.id)}
            >
              <Eye className="h-4 w-4 mr-1" />
              상세 보기
            </Button>
            {canConvert && (
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  setSelectedQuoteId(quote.id);
                  setShowConvertDialog(true);
                }}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <ShoppingCart className="h-4 w-4 mr-1" />
                주문 생성
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  const selectedQuote = quotes.find((q) => q.id === selectedQuoteId);
  const quoteDetailData = quoteDetail || selectedQuote;

  return (
    <div className="flex min-h-screen bg-slate-50">
      <AdminSidebar />

      <div className="flex-1">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-6 py-4">
          <h1 className="text-xl font-bold text-slate-900">Sales Pipeline Dashboard</h1>
          <p className="text-sm text-slate-600 mt-1">
            견적 요청을 검토하고 주문으로 전환하세요
          </p>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm">
            {isLoading ? (
              <div className="p-8 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            ) : (
              <DataTable
                columns={columns}
                data={quotes}
                searchKey="title"
                searchPlaceholder="제목, 고객명 검색..."
              />
            )}
          </div>
        </div>

        {/* 견적 상세 Sheet */}
        <Sheet open={!!selectedQuoteId && !showConvertDialog} onOpenChange={(open) => !open && setSelectedQuoteId(null)}>
          <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
            <SheetHeader>
              <SheetTitle>견적 상세</SheetTitle>
              <SheetDescription>
                견적 정보를 확인하고 주문으로 전환할 수 있습니다.
              </SheetDescription>
            </SheetHeader>

            {quoteDetailData && (
              <div className="mt-6 space-y-6">
                {/* 기본 정보 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">기본 정보</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <span className="text-sm font-medium text-slate-600">견적번호:</span>
                      <span className="ml-2 font-mono text-sm">
                        #{quoteDetailData.id.slice(-8).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-slate-600">제목:</span>
                      <span className="ml-2">{quoteDetailData.title}</span>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-slate-600">요청자:</span>
                      <span className="ml-2">
                        {quoteDetailData.user?.name || "이름 없음"} ({quoteDetailData.user?.email || "-"})
                      </span>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-slate-600">상태:</span>
                      <Badge
                        variant={STATUS_LABELS[quoteDetailData.status]?.variant || "secondary"}
                        className="ml-2"
                      >
                        {STATUS_LABELS[quoteDetailData.status]?.label || quoteDetailData.status}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-slate-600">총액:</span>
                      <span className="ml-2 font-semibold text-lg">
                        {quoteDetailData.totalAmount
                          ? `₩${quoteDetailData.totalAmount.toLocaleString()}`
                          : "-"}
                      </span>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-slate-600">생성일:</span>
                      <span className="ml-2">
                        {format(new Date(quoteDetailData.createdAt), "yyyy년 MM월 dd일 HH:mm", {
                          locale: ko,
                        })}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* 품목 리스트 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">견적 품목</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {quoteDetailData.items && quoteDetailData.items.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>품명</TableHead>
                            <TableHead>브랜드</TableHead>
                            <TableHead className="text-right">수량</TableHead>
                            <TableHead className="text-right">단가</TableHead>
                            <TableHead className="text-right">금액</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {quoteDetailData.items.map((item: any) => (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium">
                                {item.name || "품명 없음"}
                              </TableCell>
                              <TableCell>{item.brand || "-"}</TableCell>
                              <TableCell className="text-right">{item.quantity}</TableCell>
                              <TableCell className="text-right">
                                {item.unitPrice
                                  ? `₩${item.unitPrice.toLocaleString()}`
                                  : "-"}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {item.lineTotal
                                  ? `₩${item.lineTotal.toLocaleString()}`
                                  : "-"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="text-sm text-slate-500">품목이 없습니다.</p>
                    )}
                  </CardContent>
                </Card>

                {/* 액션 버튼 */}
                {quoteDetailData.status === "COMPLETED" && (
                  <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button
                      onClick={() => setShowConvertDialog(true)}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      주문으로 전환
                    </Button>
                  </div>
                )}
              </div>
            )}
          </SheetContent>
        </Sheet>

        {/* 주문 전환 확인 Dialog */}
        <Dialog open={showConvertDialog} onOpenChange={setShowConvertDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>주문으로 전환</DialogTitle>
              <DialogDescription>
                이 견적을 실제 주문 건으로 생성하시겠습니까?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowConvertDialog(false)}
                disabled={convertToOrderMutation.isPending}
              >
                취소
              </Button>
              <Button
                onClick={() => {
                  if (selectedQuoteId) {
                    convertToOrderMutation.mutate(selectedQuoteId);
                  }
                }}
                disabled={convertToOrderMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {convertToOrderMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    처리 중...
                  </>
                ) : (
                  "확인"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
