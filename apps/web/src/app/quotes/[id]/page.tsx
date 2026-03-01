"use client";

export const dynamic = 'force-dynamic';

import React, { useState } from "react";
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
  User,
  Building2,
  Calendar,
  MapPin,
  DollarSign,
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
  Share2,
  MessageSquare,
  Pencil,
  Check,
  X,
  Send,
  CreditCard,
  AlertTriangle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { QUOTE_STATUS } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type QuoteStatus = "PENDING" | "SENT" | "RESPONDED" | "COMPLETED" | "CANCELLED";

export default function QuoteDetailPage() {
  const { data: session, status } = useSession();
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const quoteId = params.id as string;
  const [activeTab, setActiveTab] = useState("items");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [copied, setCopied] = useState(false);
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [requestMessage, setRequestMessage] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [showOrderDialog, setShowOrderDialog] = useState(false);
  const [orderForm, setOrderForm] = useState({
    expectedDelivery: "",
    paymentMethod: "",
    budgetId: "",
    notes: "",
  });

  // 견적서 조회
  const { data: quoteData, isLoading } = useQuery({
    queryKey: ["quote", quoteId],
    queryFn: async () => {
      const response = await fetch(`/api/quotes/${quoteId}`);
      if (!response.ok) throw new Error("Failed to fetch quote");
      return response.json();
    },
    enabled: !!quoteId && status === "authenticated",
  });

  // 사용자 예산 목록 조회
  const { data: budgetsData } = useQuery<{ budgets: any[] }>({
    queryKey: ["user-budgets"],
    queryFn: async () => {
      const response = await fetch("/api/user-budgets");
      if (!response.ok) throw new Error("Failed to fetch budgets");
      return response.json();
    },
    enabled: status === "authenticated",
  });

  const budgets = budgetsData?.budgets || [];
  const selectedBudget = budgets.find((b) => b.id === orderForm.budgetId);
  const quoteTotal = quoteData?.quote?.totalAmount || 0;
  const expectedRemaining = selectedBudget 
    ? selectedBudget.remainingAmount - quoteTotal 
    : null;

  // 사용자 팀 목록 조회
  const { data: teamsData } = useQuery({
    queryKey: ["user-teams"],
    queryFn: async () => {
      const response = await fetch("/api/team");
      if (!response.ok) throw new Error("Failed to fetch teams");
      return response.json();
    },
    enabled: status === "authenticated",
  });

  // 구매 요청 mutation
  const purchaseRequestMutation = useMutation({
    mutationFn: async ({ teamId, message }: { teamId: string; message: string }) => {
      const quote = quoteData?.quote;
      if (!quote) throw new Error("Quote not found");

      const items = quote.items?.map((item: any) => ({
        productId: item.productId,
        name: item.name,
        brand: item.brand,
        catalogNumber: item.catalogNumber,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
      })) || [];

      const response = await fetch("/api/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          title: quote.title || "구매 요청",
          message,
          items,
          quoteId: quote.id,
          totalAmount: quote.totalAmount,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create purchase request");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      setShowRequestDialog(false);
      setRequestMessage("");
      toast({
        title: "구매 요청이 전송되었습니다",
        description: "관리자의 승인을 기다려주세요.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "구매 요청 실패",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // 주문 생성 mutation
  const createOrderMutation = useMutation({
    mutationFn: async (orderData: {
      expectedDelivery?: string;
      paymentMethod?: string;
      budgetId?: string;
      notes?: string;
    }) => {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteId,
          expectedDelivery: orderData.expectedDelivery || undefined,
          budgetId: orderData.budgetId || undefined,
          notes: orderData.notes || (orderData.paymentMethod 
            ? `결제 방식: ${orderData.paymentMethod}${orderData.notes ? `\n\n전달 사항:\n${orderData.notes}` : ""}`
            : orderData.notes || undefined),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || error.message || "Failed to create order");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quote", quoteId] });
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      setShowOrderDialog(false);
      setOrderForm({
        expectedDelivery: "",
        paymentMethod: "",
        budgetId: "",
        notes: "",
      });
      toast({
        title: "주문이 접수되었습니다",
        description: "마이페이지 > 주문 내역에서 확인하세요",
      });
      // 주문 내역 페이지로 이동하지 않고 현재 페이지에 머무름
    },
    onError: (error: Error) => {
      toast({
        title: "주문 생성 실패",
        description: error.message,
        variant: "destructive",
      });
    },
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
    onSuccess: (_data, newStatus) => {
      queryClient.invalidateQueries({ queryKey: ["quote", quoteId] });
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      if (newStatus === "COMPLETED") {
        queryClient.invalidateQueries({ queryKey: ["purchases"] });
        queryClient.invalidateQueries({ queryKey: ["purchase-summary"] });
        queryClient.invalidateQueries({ queryKey: ["purchases-list"] });
      }
      router.refresh();
      if (newStatus === "COMPLETED") {
        toast({
          title: "구매 완료 처리됨",
          description: "구매 내역이 자동으로 기록되었습니다.",
        });
      } else if (newStatus === "CANCELLED") {
        toast({
          title: "견적이 취소되었습니다",
          description: "견적 요청이 취소 상태로 변경되었습니다.",
        });
      } else {
        toast({
          title: "상태 업데이트 완료",
          description: "견적 상태가 업데이트되었습니다.",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "업데이트 실패",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // 아이템 메모 업데이트 mutation
  const updateNoteMutation = useMutation({
    mutationFn: async ({ itemId, notes }: { itemId: string; notes: string }) => {
      const response = await fetch(`/api/quote-items/${itemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      if (!response.ok) throw new Error("Failed to update note");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quote", quoteId] });
      setEditingNoteId(null);
      setNoteText("");
      toast({
        title: "메모 저장됨",
        description: "메모가 성공적으로 저장되었습니다.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "메모 저장 실패",
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

  const handleCancelQuote = () => {
    if (confirm("정말 이 견적 요청을 취소하시겠습니까?")) {
      updateStatusMutation.mutate("CANCELLED");
    }
  };

  // 메모 편집 시작
  const handleStartEditNote = (itemId: string, currentNote: string) => {
    setEditingNoteId(itemId);
    setNoteText(currentNote || "");
  };

  // 메모 저장
  const handleSaveNote = (itemId: string) => {
    updateNoteMutation.mutate({ itemId, notes: noteText });
  };

  // 메모 취소
  const handleCancelNote = () => {
    setEditingNoteId(null);
    setNoteText("");
  };

  // 스마트 공유 - 카카오톡/슬랙 형식으로 복사
  const handleSmartShare = async () => {
    if (!quoteData?.quote) return;

    const quote = quoteData.quote;
    const items = quote.items || [];

    // 날짜 포맷
    const today = new Date();
    const weekNum = Math.ceil(today.getDate() / 7);
    const monthName = today.toLocaleDateString("ko-KR", { month: "long" });

    // 아이템 목록 생성
    const itemLines = items.map((item: any, index: number) => {
      const vendor = item.product?.vendors?.[0]?.vendor;
      const unitPrice = item.unitPrice || 0;
      const lineTotal = unitPrice * item.quantity;

      let line = `${index + 1}. ${item.product?.name || item.name || "제품명 없음"}`;
      if (vendor?.name || item.product?.brand) {
        line += ` (${vendor?.name || item.product?.brand})`;
      }
      line += `\n   - 수량: ${item.quantity}개`;
      if (unitPrice > 0) {
        line += ` | 가격: ${lineTotal.toLocaleString()}원`;
      }
      if (item.notes) {
        line += `\n   - 💬 메모: ${item.notes}`;
      }
      return line;
    }).join("\n\n");

    // 총액 계산
    const totalAmount = items.reduce((sum: number, item: any) => {
      const unitPrice = item.unitPrice || 0;
      return sum + (unitPrice * item.quantity);
    }, 0);

    // 공유 URL
    const shareUrl = `${window.location.origin}/quotes/${quote.id}`;

    // 최종 텍스트 조합
    const shareText = `[BioInsight] ${quote.title || `${monthName} ${weekNum}주차 시약 구매 요청`}

${itemLines}

총 예상 금액: ${totalAmount > 0 ? `${totalAmount.toLocaleString()}원` : "미정"}
리스트 보러가기: ${shareUrl}`;

    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "클립보드에 복사됨!",
        description: "카카오톡이나 슬랙에 붙여넣기 하세요.",
      });
    } catch (error) {
      toast({
        title: "복사 실패",
        description: "클립보드 접근에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  if (status === "loading" || isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <p className="text-muted-foreground">로딩 중...</p>
          </div>
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
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <div className="container mx-auto px-4 py-8">
          <Card className="bg-white rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
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
      </div>
    );
  }

  const quote = quoteData.quote;
  const quoteStatus = quote.status as QuoteStatus;

  // 사용자의 팀 역할 확인 (첫 번째 팀 기준)
  const userTeam = teamsData?.teams?.[0];
  const userTeamRole = userTeam?.role;
  const isMemberOnly = userTeamRole === "MEMBER";
  const canCheckout = !isMemberOnly || !userTeam; // 팀이 없거나 ADMIN/OWNER인 경우

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="container mx-auto px-3 md:px-4 py-4 md:py-8">
        <div className="max-w-5xl mx-auto space-y-6 md:space-y-8">
        {/* 헤더 */}
        <Card className="bg-white rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm p-6 md:p-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 md:gap-0">
          <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
            <Link href="/quotes">
              <Button variant="ghost" size="icon" className="h-9 w-9 md:h-10 md:w-10">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-xl md:text-3xl font-bold truncate">{quote.title}</h1>
                <Badge
                  variant={
                    quote.status === "COMPLETED"
                      ? "default"
                      : quote.status === "RESPONDED"
                      ? "secondary"
                      : "outline"
                  }
                  className={cn(
                    "flex items-center gap-1.5 text-sm font-semibold px-3 py-1",
                    quoteStatus === "PENDING" && "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-400",
                    quoteStatus === "SENT" && "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/50 dark:text-blue-400",
                    quoteStatus === "RESPONDED" && "bg-green-100 text-green-800 border-green-300 dark:bg-green-950/50 dark:text-green-400",
                    quoteStatus === "COMPLETED" && "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-400",
                    quoteStatus === "CANCELLED" && "bg-red-100 text-red-800 border-red-300 dark:bg-red-950/50 dark:text-red-400"
                  )}
                >
                  {quoteStatus === "PENDING" && <Clock className="h-4 w-4" />}
                  {quoteStatus === "SENT" && <CheckCircle2 className="h-4 w-4" />}
                  {quoteStatus === "RESPONDED" && <CheckCircle2 className="h-4 w-4" />}
                  {quoteStatus === "COMPLETED" && <CheckCircle2 className="h-4 w-4" />}
                  {quoteStatus === "CANCELLED" && <XCircle className="h-4 w-4" />}
                  {QUOTE_STATUS[quoteStatus]}
                </Badge>
              </div>
              <span className="text-sm text-muted-foreground mt-2 block">
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
          {/* 스마트 공유 버튼 */}
          <Button
            onClick={handleSmartShare}
            variant="outline"
            className="w-full md:w-auto text-xs md:text-sm h-8 md:h-10"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2 text-green-600" />
                복사됨!
              </>
            ) : (
              <>
                <Share2 className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                공유하기
              </>
            )}
          </Button>
        </div>
        </Card>

        {/* 견적 정보 (Summary Card) */}
        <Card className="bg-white rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm p-8">
          <CardHeader className="px-0 pt-0 pb-6">
            <CardTitle className="text-lg md:text-xl font-semibold">견적 정보</CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6 md:gap-8">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-2">
                  <User className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                </div>
                <div className="space-y-0.5 min-w-0">
                  <p className="text-sm text-slate-500 dark:text-slate-400">요청자</p>
                  <p className="text-base font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {quote.user?.name || quote.user?.email || "-"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-2">
                  <Building2 className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                </div>
                <div className="space-y-0.5 min-w-0">
                  <p className="text-sm text-slate-500 dark:text-slate-400">조직</p>
                  <p className="text-base font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {quote.organization?.name || "-"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-2">
                  <Calendar className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                </div>
                <div className="space-y-0.5 min-w-0">
                  <p className="text-sm text-slate-500 dark:text-slate-400">생성일</p>
                  <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    {quote.createdAt
                      ? new Date(quote.createdAt).toLocaleDateString("ko-KR", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })
                      : "-"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-2">
                  <Calendar className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                </div>
                <div className="space-y-0.5 min-w-0">
                  <p className="text-sm text-slate-500 dark:text-slate-400">납기 희망일</p>
                  <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    {quote.deliveryDate
                      ? new Date(quote.deliveryDate).toLocaleDateString("ko-KR")
                      : quote.validUntil
                      ? new Date(quote.validUntil).toLocaleDateString("ko-KR")
                      : "-"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-2">
                  <MapPin className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                </div>
                <div className="space-y-0.5 min-w-0">
                  <p className="text-sm text-slate-500 dark:text-slate-400">납품 장소</p>
                  <p className="text-base font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {quote.deliveryLocation || "-"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-2">
                  <DollarSign className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                </div>
                <div className="space-y-0.5 min-w-0">
                  <p className="text-sm text-slate-500 dark:text-slate-400">총 예상 금액</p>
                  <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    {quote.totalAmount != null
                      ? `${quote.totalAmount.toLocaleString()} ${quote.currency || "KRW"}`
                      : "-"}
                  </p>
                </div>
              </div>
            </div>
            {(quote.description || quote.message) && (
              <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">요청 메시지</p>
                <blockquote className="rounded-lg bg-slate-50 dark:bg-slate-900/50 border-l-4 border-slate-200 dark:border-slate-700 pl-4 pr-4 py-3 text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words">
                  {quote.description || quote.message || "-"}
                </blockquote>
              </div>
            )}
            {quote.specialNotes && (
              <div className="mt-6">
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">특이사항</p>
                <blockquote className="rounded-lg bg-slate-50 dark:bg-slate-900/50 border-l-4 border-slate-200 dark:border-slate-700 pl-4 pr-4 py-3 text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words">
                  {quote.specialNotes}
                </blockquote>
              </div>
            )}
            {quote.messageEn && (
              <div className="mt-6">
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">요청 메시지 (영문)</p>
                <blockquote className="rounded-lg bg-slate-50 dark:bg-slate-900/50 border-l-4 border-slate-200 dark:border-slate-700 pl-4 pr-4 py-3 text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words">
                  {quote.messageEn}
                </blockquote>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 견적 요청 품목 테이블 */}
        <Card className="bg-white rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm p-8">
          <CardHeader className="px-0 pt-0 pb-4">
            <CardTitle className="text-base md:text-lg font-semibold">견적 요청 품목 ({quote.items?.length || 0}개)</CardTitle>
            <CardDescription className="text-xs md:text-sm mt-1">
              견적 요청 생성 시점의 품목 스냅샷입니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {/* 모바일: 카드 리스트 형태 */}
            <div className="md:hidden space-y-3">
              {quote.items?.map((item: any) => {
                const vendor = item.product?.vendors?.[0]?.vendor;
                const isEditing = editingNoteId === item.id;
                return (
                  <Card key={item.id} className="p-4 border border-slate-200 dark:border-slate-700">
                    <div className="space-y-2">
                      <div className="font-semibold text-base text-slate-900 dark:text-slate-100">{item.product?.name || item.name || "제품 정보 없음"}</div>
                      <div className="text-xs text-muted-foreground space-y-1">
                        {(vendor?.name || item.product?.brand) && <div>벤더: {vendor?.name || item.product?.brand}</div>}
                        {item.product?.spec && <div>규격: {item.product.spec}</div>}
                        <div>수량: {item.quantity}</div>
                      </div>
                      {/* 메모 영역 */}
                      <div className="pt-2 border-t">
                        {isEditing ? (
                          <div className="space-y-2">
                            <Textarea
                              value={noteText}
                              onChange={(e) => setNoteText(e.target.value)}
                              placeholder="메모를 입력하세요..."
                              className="text-xs min-h-[60px]"
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleSaveNote(item.id)}
                                disabled={updateNoteMutation.isPending}
                                className="h-7 text-xs"
                              >
                                <Check className="h-3 w-3 mr-1" />
                                저장
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={handleCancelNote}
                                className="h-7 text-xs"
                              >
                                취소
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div
                            onClick={() => handleStartEditNote(item.id, item.notes || "")}
                            className="flex items-start gap-2 cursor-pointer hover:bg-muted/50 rounded p-1 -m-1"
                          >
                            <MessageSquare className="h-3 w-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                            <span className="text-xs text-muted-foreground">
                              {item.notes || "메모 추가..."}
                            </span>
                          </div>
                        )}
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
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left py-3 px-4 font-bold text-sm text-slate-700 dark:text-slate-300">제품명</th>
                    <th className="text-left py-3 px-4 font-bold text-sm text-slate-700 dark:text-slate-300">벤더</th>
                    <th className="text-left py-3 px-4 font-bold text-sm text-slate-700 dark:text-slate-300">규격</th>
                    <th className="text-left py-3 px-4 font-bold text-sm text-slate-700 dark:text-slate-300">수량</th>
                    <th className="text-left py-3 px-4 font-bold text-sm text-slate-700 dark:text-slate-300 min-w-[200px]">메모</th>
                  </tr>
                </thead>
                <tbody>
                  {quote.items?.map((item: any) => {
                    const vendor = item.product?.vendors?.[0]?.vendor;
                    const isEditing = editingNoteId === item.id;
                    return (
                      <tr key={item.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                        <td className="py-3 px-4 min-w-[180px]">
                          <div className="font-semibold text-base text-slate-900 dark:text-slate-100 truncate">{item.product?.name || item.name || "제품 정보 없음"}</div>
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">
                          {vendor?.name || item.product?.brand || "-"}
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">
                          {item.product?.spec || "-"}
                        </td>
                        <td className="py-3 px-4 text-sm font-medium">{item.quantity}</td>
                        <td className="py-3 px-4 text-sm">
                          {isEditing ? (
                            <div className="flex items-center gap-2">
                              <Input
                                value={noteText}
                                onChange={(e) => setNoteText(e.target.value)}
                                placeholder="메모 입력..."
                                className="h-8 text-xs flex-1"
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleSaveNote(item.id);
                                  if (e.key === "Escape") handleCancelNote();
                                }}
                                autoFocus
                              />
                              <Button
                                size="sm"
                                onClick={() => handleSaveNote(item.id)}
                                disabled={updateNoteMutation.isPending}
                                className="h-8 w-8 p-0"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={handleCancelNote}
                                className="h-8 w-8 p-0"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <div
                              onClick={() => handleStartEditNote(item.id, item.notes || "")}
                              className="flex items-center gap-2 cursor-pointer hover:bg-muted rounded px-2 py-1 -mx-2 -my-1 group"
                            >
                              {item.notes ? (
                                <>
                                  <MessageSquare className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                                  <span className="text-muted-foreground">{item.notes}</span>
                                  <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                </>
                              ) : (
                                <>
                                  <MessageSquare className="h-3.5 w-3.5 text-muted-foreground/50 flex-shrink-0" />
                                  <span className="text-muted-foreground/50 italic">메모 추가...</span>
                                </>
                              )}
                            </div>
                          )}
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
          <TabsList className="grid w-full grid-cols-2 gap-1">
            <TabsTrigger value="items" className="text-xs md:text-sm whitespace-nowrap">
              <FileText className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2 flex-shrink-0" />
              <span className="hidden sm:inline">회신 입력</span>
              <span className="sm:hidden">입력</span>
            </TabsTrigger>
            <TabsTrigger value="inbox" className="text-xs md:text-sm whitespace-nowrap">
              <Inbox className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2 flex-shrink-0" />
              <span className="hidden sm:inline">회신 수신함</span>
              <span className="sm:hidden">수신함</span>
            </TabsTrigger>
          </TabsList>

          {/* 회신 입력 탭 */}
          <TabsContent value="items" className="mt-6 md:mt-8">
            <Card className="bg-white rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm p-8">
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
                        <tr className="border-b border-slate-200 dark:border-slate-700">
                          <th className="text-left py-3 px-4 font-bold text-sm text-slate-700 dark:text-slate-300">벤더명</th>
                          <th className="text-left py-3 px-4 font-bold text-sm text-slate-700 dark:text-slate-300">품목명</th>
                          <th className="text-left py-3 px-4 font-bold text-sm text-slate-700 dark:text-slate-300">수량</th>
                          <th className="text-left py-3 px-4 font-bold text-sm text-slate-700 dark:text-slate-300">단가</th>
                          <th className="text-left py-3 px-4 font-bold text-sm text-slate-700 dark:text-slate-300 hidden md:table-cell">통화</th>
                          <th className="text-left py-3 px-4 font-bold text-sm text-slate-700 dark:text-slate-300 hidden md:table-cell">납기</th>
                          <th className="text-left py-3 px-4 font-bold text-sm text-slate-700 dark:text-slate-300 hidden md:table-cell">MOQ</th>
                          <th className="text-left py-3 px-4 font-bold text-sm text-slate-700 dark:text-slate-300 hidden md:table-cell">비고</th>
                        </tr>
                      </thead>
                      <tbody>
                        {quote.items?.map((item: any, index: number) => (
                          <tr key={item.id} className="border-b">
                            <td className="p-2 md:p-3">
                              <Input
                                placeholder="벤더명"
                                className="text-xs md:text-sm h-8 md:h-10 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                                className="text-xs md:text-sm h-8 md:h-10 w-20 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              />
                            </td>
                            <td className="p-2 md:p-3">
                              <Input
                                type="number"
                                placeholder="단가"
                                className="text-xs md:text-sm h-8 md:h-10 w-24 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              />
                            </td>
                            <td className="p-2 md:p-3 hidden md:table-cell">
                              <Select defaultValue="KRW">
                                <SelectTrigger className="text-xs md:text-sm h-8 md:h-10 w-20 rounded-md focus:ring-2 focus:ring-blue-500">
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
                                className="text-xs md:text-sm h-8 md:h-10 w-24 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              />
                            </td>
                            <td className="p-2 md:p-3 hidden md:table-cell">
                              <Input
                                type="number"
                                placeholder="MOQ"
                                className="text-xs md:text-sm h-8 md:h-10 w-20 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              />
                            </td>
                            <td className="p-2 md:p-3 hidden md:table-cell">
                              <Textarea
                                placeholder="비고"
                                rows={1}
                                className="text-xs md:text-sm rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 pt-4">
                    <Button className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transition-all">
                      <Save className="h-4 w-4 mr-2 shrink-0" />
                      회신 저장
                    </Button>
                    <Button variant="outline" className="w-full sm:w-auto">
                      <GitCompare className="h-4 w-4 mr-2 shrink-0" />
                      비교에 반영
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 회신 수신함 탭 */}
          <TabsContent value="inbox" className="mt-6 md:mt-8">
            <Card className="bg-white rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm p-8">
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


        {/* 하단 액션 버튼 그룹 (Floating Action Bar) */}
        <Card className="bg-white rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm p-6 md:p-8">
          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 md:gap-4">
            {/* Primary: 구매 완료로 표시 - 가장 눈에 띄게 */}
            {quote.status !== "COMPLETED" && (
              <Button
                onClick={handleMarkAsCompleted}
                disabled={updateStatusMutation.isPending}
                className="order-first w-full sm:w-auto text-sm md:text-base h-10 md:h-11 bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transition-all font-semibold"
              >
                <Package className="h-4 w-4 mr-2 shrink-0" />
                {updateStatusMutation.isPending ? "처리 중..." : "구매 완료로 표시"}
              </Button>
            )}
            {/* Outline: 목록, PDF, 견적 취소 */}
            <Link href="/quotes" className="w-full sm:w-auto order-2 sm:order-2">
              <Button variant="outline" className="w-full sm:w-auto text-sm h-10 md:h-11">
                <ArrowLeft className="h-4 w-4 mr-2 shrink-0" />
                목록으로
              </Button>
            </Link>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto text-sm h-10 md:h-11 order-3"
                    disabled
                  >
                    <Download className="h-4 w-4 mr-2 shrink-0" />
                    PDF 다운로드
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>PDF 다운로드 기능은 곧 제공됩니다</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {quote.status === "PENDING" && (
              <Button
                type="button"
                variant="outline"
                onClick={handleCancelQuote}
                disabled={updateStatusMutation.isPending}
                className="w-full sm:w-auto text-sm h-10 md:h-11 text-red-600 border-red-300 hover:bg-red-50 hover:border-red-400 dark:text-red-400 dark:border-red-700 dark:hover:bg-red-950/30 order-4"
              >
                <XCircle className="h-4 w-4 mr-2 shrink-0" />
                {updateStatusMutation.isPending && updateStatusMutation.variables === "CANCELLED"
                  ? "처리 중..."
                  : "견적 취소"}
              </Button>
            )}
          {/* 주문 요청하기 버튼 - COMPLETED 상태일 때만 표시 */}
          {quote.status === "COMPLETED" && !quote.order && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Dialog open={showOrderDialog} onOpenChange={setShowOrderDialog}>
                    <DialogTrigger asChild>
                      <Button
                        className="w-full sm:w-auto text-sm h-10 md:h-11 bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transition-all font-semibold"
                      >
                        <ShoppingCart className="h-4 w-4 mr-2 shrink-0" />
                        주문 요청하기
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>이 견적서대로 주문을 접수하시겠습니까?</DialogTitle>
                        <DialogDescription>
                          주문 정보를 입력하고 접수해주세요
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="expectedDelivery">희망 배송일</Label>
                          <Input
                            id="expectedDelivery"
                            type="date"
                            value={orderForm.expectedDelivery}
                            onChange={(e) =>
                              setOrderForm({ ...orderForm, expectedDelivery: e.target.value })
                            }
                            min={new Date().toISOString().split("T")[0]}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="budgetId">
                            결제할 과제를 선택하세요 <span className="text-red-500">*</span>
                          </Label>
                          <Select
                            value={orderForm.budgetId}
                            onValueChange={(value) =>
                              setOrderForm({ ...orderForm, budgetId: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="과제를 선택하세요" />
                            </SelectTrigger>
                            <SelectContent>
                              {budgets.map((budget) => (
                                <SelectItem key={budget.id} value={budget.id}>
                                  {budget.name} (잔액: ₩ {budget.remainingAmount.toLocaleString()})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {selectedBudget && (
                            <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">현재 잔액:</span>
                                <span className="font-semibold">
                                  ₩ {selectedBudget.remainingAmount.toLocaleString()}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-sm mt-1">
                                <span className="text-muted-foreground">주문 금액:</span>
                                <span className="font-semibold text-red-600">
                                  - ₩ {quoteTotal.toLocaleString()}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-sm mt-2 pt-2 border-t border-blue-200 dark:border-blue-800">
                                <span className="font-medium">예상 잔액:</span>
                                <span className={cn(
                                  "font-bold text-lg",
                                  expectedRemaining !== null && expectedRemaining < 0
                                    ? "text-red-600"
                                    : "text-green-600"
                                )}>
                                  ₩ {expectedRemaining !== null ? expectedRemaining.toLocaleString() : "0"}
                                </span>
                              </div>
                              {expectedRemaining !== null && expectedRemaining < 0 && (
                                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3" />
                                  예산이 부족합니다
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="paymentMethod">
                            결제 방식 <span className="text-muted-foreground text-xs">(선택)</span>
                          </Label>
                          <Select
                            value={orderForm.paymentMethod}
                            onValueChange={(value) =>
                              setOrderForm({ ...orderForm, paymentMethod: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="결제 방식을 선택하세요" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="research_card">연구비 카드</SelectItem>
                              <SelectItem value="tax_invoice">세금계산서</SelectItem>
                              <SelectItem value="bank_transfer">계좌이체</SelectItem>
                              <SelectItem value="credit_card">신용카드</SelectItem>
                              <SelectItem value="other">기타</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="orderNotes">전달 사항 <span className="text-muted-foreground text-xs">(선택)</span></Label>
                          <Textarea
                            id="orderNotes"
                            placeholder="추가로 전달할 사항이 있으시면 입력하세요"
                            value={orderForm.notes}
                            onChange={(e) =>
                              setOrderForm({ ...orderForm, notes: e.target.value })
                            }
                            rows={4}
                          />
                        </div>
                        <div className="flex gap-2 pt-2">
                          <Button
                            variant="outline"
                            onClick={() => {
                              setShowOrderDialog(false);
                              setOrderForm({
                                expectedDelivery: "",
                                paymentMethod: "",
                                budgetId: "",
                                notes: "",
                              });
                            }}
                            className="flex-1"
                          >
                            취소
                          </Button>
                          <Button
                            onClick={() => {
                              if (!orderForm.budgetId) {
                                toast({
                                  title: "과제를 선택해주세요",
                                  description: "결제할 과제를 선택해야 합니다",
                                  variant: "destructive",
                                });
                                return;
                              }
                              createOrderMutation.mutate({
                                expectedDelivery: orderForm.expectedDelivery || undefined,
                                paymentMethod: orderForm.paymentMethod || undefined,
                                budgetId: orderForm.budgetId,
                                notes: orderForm.notes || undefined,
                              });
                            }}
                            disabled={createOrderMutation.isPending || !orderForm.budgetId}
                            className="flex-1 bg-blue-600 hover:bg-blue-700"
                          >
                            {createOrderMutation.isPending ? "처리 중..." : "주문 접수"}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </TooltipTrigger>
                <TooltipContent>
                  <p>내부 결재(승인)가 완료되었다면, 클릭 한 번으로 발주하세요.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {quote.status === "COMPLETED" && !quote.order && canCheckout && (
            <>
              {/* 기존 결제하기 버튼은 유지 (하위 호환성) */}
              <Button
                onClick={() => createOrderMutation.mutate({})}
                disabled={createOrderMutation.isPending}
                variant="outline"
                className="w-full sm:w-auto text-sm h-10 md:h-11"
              >
                <CreditCard className="h-4 w-4 mr-2 shrink-0" />
                {createOrderMutation.isPending ? "처리 중..." : "결제하기"}
              </Button>
            </>
          )}
          {quote.status === "COMPLETED" && !quote.order && !canCheckout && (
            <>
              <Dialog open={showRequestDialog} onOpenChange={setShowRequestDialog}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full sm:w-auto text-sm h-10 md:h-11"
                    >
                      <Send className="h-4 w-4 mr-2 shrink-0" />
                      구매 요청 보내기
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>구매 요청 보내기</DialogTitle>
                      <DialogDescription>
                        관리자에게 구매 승인을 요청합니다.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="team">팀 선택</Label>
                        <Select
                          value={selectedTeamId || ""}
                          onValueChange={setSelectedTeamId}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="팀을 선택하세요" />
                          </SelectTrigger>
                          <SelectContent>
                            {teamsData?.teams?.map((team: any) => (
                              <SelectItem key={team.id} value={team.id}>
                                {team.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="message">요청 메모 (선택)</Label>
                        <Textarea
                          id="message"
                          placeholder="예: 실험 A에 필요함, 긴급 주문 요청 등"
                          value={requestMessage}
                          onChange={(e) => setRequestMessage(e.target.value)}
                          rows={3}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() => setShowRequestDialog(false)}
                          className="flex-1"
                        >
                          취소
                        </Button>
                        <Button
                          onClick={() => {
                            if (!selectedTeamId) {
                              toast({
                                title: "팀을 선택해주세요",
                                variant: "destructive",
                              });
                              return;
                            }
                            purchaseRequestMutation.mutate({
                              teamId: selectedTeamId,
                              message: requestMessage,
                            });
                          }}
                          disabled={purchaseRequestMutation.isPending || !selectedTeamId}
                          className="flex-1"
                        >
                          {purchaseRequestMutation.isPending ? "전송 중..." : "요청 보내기"}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
            </>
          )}
          {quote.status === "COMPLETED" && quote.order && (
            <Badge variant="default" className="px-3 py-1.5 text-xs md:text-sm w-full sm:w-auto justify-center">
              <CheckCircle2 className="h-3 w-3 md:h-4 md:w-4 mr-1" />
              구매 완료됨
            </Badge>
          )}
          <Link href="/compare/quote" className="w-full sm:w-auto">
            <Button variant="outline" className="w-full sm:w-auto text-sm h-10 md:h-11">
              <ShoppingCart className="h-4 w-4 mr-2 shrink-0" />
              <span className="hidden sm:inline">새 견적 요청</span>
              <span className="sm:hidden">새 요청</span>
            </Button>
          </Link>
          </div>
        </Card>
        </div>
      </div>
    </div>
  );
}