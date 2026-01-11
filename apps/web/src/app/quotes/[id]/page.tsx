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
  Share2,
  MessageSquare,
  Copy,
  Pencil,
  Check,
  X,
  Send,
  CreditCard,
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
    const shareText = `🧪 [BioInsight] ${quote.title || `${monthName} ${weekNum}주차 시약 구매 요청`}

${itemLines}

💰 총 예상 금액: ${totalAmount > 0 ? `${totalAmount.toLocaleString()}원` : "미정"}
🔗 리스트 보러가기: ${shareUrl}`;

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

  // 사용자의 팀 역할 확인 (첫 번째 팀 기준)
  const userTeam = teamsData?.teams?.[0];
  const userTeamRole = userTeam?.role;
  const isMemberOnly = userTeamRole === "MEMBER";
  const canCheckout = !isMemberOnly || !userTeam; // 팀이 없거나 ADMIN/OWNER인 경우

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
                  {quoteStatus === "PENDING" && <Clock className="h-4 w-4 text-yellow-500" />}
                  {quoteStatus === "SENT" && <CheckCircle2 className="h-4 w-4 text-blue-500" />}
                  {quoteStatus === "RESPONDED" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                  {quoteStatus === "COMPLETED" && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                  {quoteStatus === "CANCELLED" && <XCircle className="h-4 w-4 text-red-500" />}
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
                const isEditing = editingNoteId === item.id;
                return (
                  <Card key={item.id} className="p-3 border">
                    <div className="space-y-2">
                      <div className="font-medium text-sm">{item.product?.name || item.name || "제품 정보 없음"}</div>
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
                  <tr className="border-b">
                    <th className="text-left p-2 md:p-3 font-semibold text-xs md:text-sm">제품명</th>
                    <th className="text-left p-2 md:p-3 font-semibold text-xs md:text-sm">벤더</th>
                    <th className="text-left p-2 md:p-3 font-semibold text-xs md:text-sm">규격</th>
                    <th className="text-left p-2 md:p-3 font-semibold text-xs md:text-sm">수량</th>
                    <th className="text-left p-2 md:p-3 font-semibold text-xs md:text-sm min-w-[200px]">메모</th>
                  </tr>
                </thead>
                <tbody>
                  {quote.items?.map((item: any) => {
                    const vendor = item.product?.vendors?.[0]?.vendor;
                    const isEditing = editingNoteId === item.id;
                    return (
                      <tr key={item.id} className="border-b hover:bg-muted/30">
                        <td className="p-2 md:p-3 font-medium text-xs md:text-sm min-w-[120px]">
                          <div className="truncate">{item.product?.name || item.name || "제품 정보 없음"}</div>
                        </td>
                        <td className="p-2 md:p-3 text-xs md:text-sm text-muted-foreground">
                          {vendor?.name || item.product?.brand || "-"}
                        </td>
                        <td className="p-2 md:p-3 text-xs md:text-sm text-muted-foreground">
                          {item.product?.spec || "-"}
                        </td>
                        <td className="p-2 md:p-3 text-xs md:text-sm">{item.quantity}</td>
                        <td className="p-2 md:p-3 text-xs md:text-sm">
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
          {/* PDF 다운로드 버튼 (향후 구현) */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full sm:w-auto text-xs md:text-sm h-8 md:h-10"
                  disabled
                >
                  <Download className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                  PDF 다운로드
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>PDF 다운로드 기능은 곧 제공됩니다</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {/* 주문 요청하기 버튼 - COMPLETED 상태일 때만 표시 */}
          {quote.status === "COMPLETED" && !quote.order && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Dialog open={showOrderDialog} onOpenChange={setShowOrderDialog}>
                    <DialogTrigger asChild>
                      <Button
                        className="w-full sm:w-auto text-xs md:text-sm h-8 md:h-10 bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        <ShoppingCart className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
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
                                <p className="text-xs text-red-600 mt-1">
                                  ⚠️ 예산이 부족합니다
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
          {quote.status === "COMPLETED" && !quote.order && canCheckout && (
            <>
              {/* 기존 결제하기 버튼은 유지 (하위 호환성) */}
              <Button
                onClick={() => createOrderMutation.mutate({})}
                disabled={createOrderMutation.isPending}
                variant="outline"
                className="w-full sm:w-auto text-xs md:text-sm h-8 md:h-10"
              >
                <CreditCard className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                {createOrderMutation.isPending ? "처리 중..." : "결제하기"}
              </Button>
            </>
          )}
          {quote.status === "COMPLETED" && !quote.order && !canCheckout && (
            <>
              <Dialog open={showRequestDialog} onOpenChange={setShowRequestDialog}>
                  <DialogTrigger asChild>
                    <Button
                      variant="secondary"
                      className="w-full sm:w-auto text-xs md:text-sm h-8 md:h-10"
                    >
                      <Send className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
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