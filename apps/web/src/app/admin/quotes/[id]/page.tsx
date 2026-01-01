"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminSidebar } from "../../_components/admin-sidebar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Loader2,
  ArrowLeft,
  Save,
  Send,
  User,
  Calendar,
  Package,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";

interface QuoteItem {
  id: string;
  name: string | null;
  brand: string | null;
  catalogNumber: string | null;
  quantity: number;
  unitPrice: number | null;
  lineTotal: number | null;
  notes: string | null;
  // 관리자 수정용 필드
  costPrice?: number | null;  // 매입가
  adminNotes?: string | null; // 관리자 비고
}

interface Quote {
  id: string;
  title: string;
  description: string | null;
  status: string;
  totalAmount: number | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
  listItems: QuoteItem[];
  items: Array<{
    id: string;
    productId: string;
    quantity: number;
    notes: string | null;
  }>;
}

interface EditedItem {
  id: string;
  costPrice: number | null;
  unitPrice: number | null;
  adminNotes: string | null;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING: { label: "대기 중", color: "bg-yellow-100 text-yellow-800" },
  PARSED: { label: "파싱 완료", color: "bg-blue-100 text-blue-800" },
  SENT: { label: "발송됨", color: "bg-indigo-100 text-indigo-800" },
  RESPONDED: { label: "응답 완료", color: "bg-purple-100 text-purple-800" },
  COMPLETED: { label: "완료", color: "bg-green-100 text-green-800" },
  PURCHASED: { label: "구매 완료", color: "bg-emerald-100 text-emerald-800" },
  CANCELLED: { label: "취소됨", color: "bg-red-100 text-red-800" },
};

export default function AdminQuoteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const quoteId = params.id as string;

  const [editedItems, setEditedItems] = useState<Record<string, EditedItem>>({});
  const [isSaving, setIsSaving] = useState(false);

  const { data: quote, isLoading } = useQuery<Quote>({
    queryKey: ["admin-quote", quoteId],
    queryFn: async () => {
      const response = await fetch(`/api/admin/quotes/${quoteId}`);
      if (!response.ok) throw new Error("Failed to fetch quote");
      return response.json();
    },
  });

  // 품목 데이터 초기화
  useEffect(() => {
    if (quote?.listItems) {
      const initialEdits: Record<string, EditedItem> = {};
      quote.listItems.forEach((item) => {
        initialEdits[item.id] = {
          id: item.id,
          costPrice: item.costPrice || null,
          unitPrice: item.unitPrice || null,
          adminNotes: item.adminNotes || null,
        };
      });
      setEditedItems(initialEdits);
    }
  }, [quote]);

  // 품목 수정 핸들러
  const handleItemChange = (
    itemId: string,
    field: keyof EditedItem,
    value: number | string | null
  ) => {
    setEditedItems((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value,
      },
    }));
  };

  // 수익 계산 (매입가와 공급가가 둘 다 있을 때만)
  const calculateProfit = (itemId: string) => {
    const edited = editedItems[itemId];
    if (!edited?.costPrice || !edited?.unitPrice) return null;

    const profit = edited.unitPrice - edited.costPrice;
    const profitRate = ((profit / edited.costPrice) * 100).toFixed(1);

    return {
      amount: profit,
      rate: profitRate,
      isPositive: profit > 0,
    };
  };

  // 총 금액 계산
  const totalAmount = useMemo(() => {
    if (!quote?.listItems) return 0;

    return quote.listItems.reduce((sum, item) => {
      const edited = editedItems[item.id];
      const price = edited?.unitPrice ?? item.unitPrice ?? 0;
      return sum + price * item.quantity;
    }, 0);
  }, [quote, editedItems]);

  // 저장 mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const items = Object.values(editedItems).map((item) => ({
        id: item.id,
        costPrice: item.costPrice,
        unitPrice: item.unitPrice,
        adminNotes: item.adminNotes,
      }));

      const response = await fetch(`/api/admin/quotes/${quoteId}/items`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });

      if (!response.ok) throw new Error("Failed to save items");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "저장 완료",
        description: "견적 품목이 저장되었습니다.",
      });
      queryClient.invalidateQueries({ queryKey: ["admin-quote", quoteId] });
    },
    onError: () => {
      toast({
        title: "저장 실패",
        description: "견적 품목 저장에 실패했습니다.",
        variant: "destructive",
      });
    },
  });

  // 견적 확정 및 발송 mutation
  const confirmMutation = useMutation({
    mutationFn: async () => {
      // 1. 먼저 품목 저장
      const items = Object.values(editedItems).map((item) => ({
        id: item.id,
        costPrice: item.costPrice,
        unitPrice: item.unitPrice,
        adminNotes: item.adminNotes,
      }));

      const saveResponse = await fetch(`/api/admin/quotes/${quoteId}/items`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });

      if (!saveResponse.ok) throw new Error("Failed to save items");

      // 2. 상태를 COMPLETED로 변경
      const statusResponse = await fetch(`/api/quotes/${quoteId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "COMPLETED" }),
      });

      if (!statusResponse.ok) throw new Error("Failed to update status");
      return statusResponse.json();
    },
    onSuccess: () => {
      toast({
        title: "견적서 발행 완료",
        description: "고객에게 견적 완료 이메일이 발송되었습니다.",
      });
      queryClient.invalidateQueries({ queryKey: ["admin-quote", quoteId] });
      queryClient.invalidateQueries({ queryKey: ["admin-quotes"] });
    },
    onError: () => {
      toast({
        title: "발행 실패",
        description: "견적서 발행에 실패했습니다.",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen bg-slate-50">
        <AdminSidebar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="flex min-h-screen bg-slate-50">
        <AdminSidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-600">견적을 찾을 수 없습니다.</p>
            <Link href="/admin/quotes">
              <Button variant="outline" className="mt-4">
                목록으로 돌아가기
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const statusInfo = STATUS_LABELS[quote.status] || {
    label: quote.status,
    color: "bg-gray-100 text-gray-800",
  };
  const isEditable = quote.status !== "COMPLETED" && quote.status !== "CANCELLED";

  return (
    <div className="flex min-h-screen bg-slate-50">
      <AdminSidebar />

      <div className="flex-1">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/admin/quotes">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  목록
                </Button>
              </Link>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-bold text-slate-900">
                    {quote.title}
                  </h1>
                  <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
                </div>
                <p className="text-sm text-slate-500 mt-1">
                  요청번호: #{quote.id.slice(-8).toUpperCase()}
                </p>
              </div>
            </div>

            {isEditable && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  저장
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      className="bg-green-600 hover:bg-green-700"
                      disabled={confirmMutation.isPending}
                    >
                      {confirmMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4 mr-2" />
                      )}
                      견적서 발행 및 전송
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>견적서를 발행하시겠습니까?</AlertDialogTitle>
                      <AlertDialogDescription>
                        수정된 가격으로 견적서가 확정되고, 고객에게 이메일이 발송됩니다.
                        <br />
                        <strong className="text-slate-900">
                          최종 금액: ₩{totalAmount.toLocaleString()}
                        </strong>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>취소</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => confirmMutation.mutate()}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        발행하기
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Quote Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-100">
                    <User className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">고객</p>
                    <p className="font-medium">{quote.user?.name || "-"}</p>
                    <p className="text-xs text-slate-400">{quote.user?.email}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-100">
                    <Package className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">품목 수</p>
                    <p className="font-medium">{quote.listItems.length}개</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-100">
                    <TrendingUp className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">총 금액</p>
                    <p className="font-medium text-lg">
                      ₩{totalAmount.toLocaleString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-orange-100">
                    <Calendar className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">요청일</p>
                    <p className="font-medium">
                      {format(new Date(quote.createdAt), "PPP", { locale: ko })}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 완료 상태 알림 */}
          {quote.status === "COMPLETED" && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <div>
                <p className="font-medium text-green-800">견적서 발행 완료</p>
                <p className="text-sm text-green-600">
                  고객에게 견적 완료 이메일이 발송되었습니다.
                </p>
              </div>
            </div>
          )}

          {/* Editable Items Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">품목 목록</CardTitle>
              {isEditable && (
                <p className="text-sm text-slate-500">
                  매입가와 공급가를 입력하여 견적을 수정할 수 있습니다.
                </p>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="w-[50px]">No.</TableHead>
                      <TableHead>제품명</TableHead>
                      <TableHead>브랜드</TableHead>
                      <TableHead>카탈로그 번호</TableHead>
                      <TableHead className="text-center w-[80px]">수량</TableHead>
                      <TableHead className="w-[140px]">
                        매입가 (Cost)
                        <span className="block text-xs font-normal text-slate-400">
                          관리 참고용
                        </span>
                      </TableHead>
                      <TableHead className="w-[140px]">
                        공급가 (Price)
                        <span className="block text-xs font-normal text-slate-400">
                          고객 표시 가격
                        </span>
                      </TableHead>
                      <TableHead className="w-[120px]">예상 수익</TableHead>
                      <TableHead className="text-right w-[120px]">합계</TableHead>
                      <TableHead className="w-[200px]">관리자 비고</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {quote.listItems.map((item, index) => {
                      const edited = editedItems[item.id];
                      const profit = calculateProfit(item.id);
                      const lineTotal =
                        (edited?.unitPrice ?? item.unitPrice ?? 0) * item.quantity;

                      return (
                        <TableRow key={item.id}>
                          <TableCell className="text-center text-slate-500">
                            {index + 1}
                          </TableCell>
                          <TableCell className="font-medium">
                            {item.name || "-"}
                          </TableCell>
                          <TableCell className="text-slate-600">
                            {item.brand || "-"}
                          </TableCell>
                          <TableCell className="font-mono text-sm text-slate-600">
                            {item.catalogNumber || "-"}
                          </TableCell>
                          <TableCell className="text-center">
                            {item.quantity}
                          </TableCell>
                          <TableCell>
                            {isEditable ? (
                              <Input
                                type="number"
                                value={edited?.costPrice ?? ""}
                                onChange={(e) =>
                                  handleItemChange(
                                    item.id,
                                    "costPrice",
                                    e.target.value ? parseInt(e.target.value) : null
                                  )
                                }
                                placeholder="매입가"
                                className="h-8 text-sm"
                              />
                            ) : (
                              <span className="text-slate-600">
                                {edited?.costPrice
                                  ? `₩${edited.costPrice.toLocaleString()}`
                                  : "-"}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {isEditable ? (
                              <Input
                                type="number"
                                value={edited?.unitPrice ?? ""}
                                onChange={(e) =>
                                  handleItemChange(
                                    item.id,
                                    "unitPrice",
                                    e.target.value ? parseInt(e.target.value) : null
                                  )
                                }
                                placeholder="공급가"
                                className="h-8 text-sm"
                              />
                            ) : (
                              <span className="font-medium">
                                ₩{(edited?.unitPrice ?? 0).toLocaleString()}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {profit ? (
                              <div
                                className={`text-xs ${
                                  profit.isPositive
                                    ? "text-green-600"
                                    : "text-red-600"
                                }`}
                              >
                                <div className="font-medium">
                                  {profit.isPositive ? "+" : ""}
                                  ₩{profit.amount.toLocaleString()}
                                </div>
                                <div>({profit.rate}%)</div>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-xs">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            ₩{lineTotal.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            {isEditable ? (
                              <Textarea
                                value={edited?.adminNotes ?? ""}
                                onChange={(e) =>
                                  handleItemChange(
                                    item.id,
                                    "adminNotes",
                                    e.target.value || null
                                  )
                                }
                                placeholder="관리자 메모..."
                                className="h-16 text-xs resize-none"
                              />
                            ) : (
                              <span className="text-sm text-slate-600">
                                {edited?.adminNotes || "-"}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Total */}
              <div className="border-t border-slate-200 px-6 py-4 bg-slate-50">
                <div className="flex justify-end">
                  <div className="text-right">
                    <p className="text-sm text-slate-500">총 견적 금액</p>
                    <p className="text-2xl font-bold text-slate-900">
                      ₩{totalAmount.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Description */}
          {quote.description && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">요청 사항</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600 whitespace-pre-wrap">
                  {quote.description}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
