"use client";

export const dynamic = 'force-dynamic';

import React, { useState, useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Home,
  Building2,
  CheckCircle2,
  Clock,
  XCircle,
  ShoppingCart,
  Package,
  FileText,
  Save,
  GitCompare,
  Share2,
  MessageSquare,
  Pencil,
  Check,
  X,
  Send,
  AlertTriangle,
  TrendingDown,
  Truck,
  User,
  CalendarClock,
  ArrowRight,
  RefreshCw,
  ShieldX,
  FileQuestion,
  WifiOff,
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
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ActivityTimeline } from "@/components/ai/activity-timeline";
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

/* ── 유틸리티 ── */
/** Quote ID 유효성 검증: cuid (기본) 또는 uuid 모두 허용 */
const isValidQuoteId = (id: string) =>
  /^c[a-z0-9]{20,30}$/i.test(id) || // cuid (Prisma default)
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id); // uuid fallback

/** 블록별 에러 로깅 (userId, orgId, status, navigation, refetch 포함) */
function logBlockError(
  blockName: string,
  quoteId: string,
  error: unknown,
  extra?: Record<string, unknown>,
) {
  console.error(`[QuoteDetail:${blockName}]`, {
    quoteId,
    blockName,
    error: error instanceof Error ? error.message : String(error),
    responseStatus: extra?.responseStatus ?? null,
    userId: extra?.userId ?? null,
    orgId: extra?.orgId ?? null,
    isNavigation: typeof window !== "undefined" ? (document.visibilityState !== "visible" || (performance?.navigation?.type === 1)) : false,
    refetchCount: extra?.refetchCount ?? 0,
    timestamp: new Date().toISOString(),
    ...extra,
  });
}

/** null-safe 금액 포맷 */
const safeLocaleAmount = (val: number | null | undefined): string =>
  (val ?? 0).toLocaleString("ko-KR");

/* ── 에러 UI 컴포넌트 ── */

function FullPageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#111114]">
      <div className="container mx-auto px-4 py-8">{children}</div>
    </div>
  );
}

function NotFoundUI({ message }: { message?: string }) {
  return (
    <FullPageShell>
      <Card>
        <CardContent className="pt-6 text-center">
          <FileQuestion className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-muted-foreground py-4">{message || "삭제되었거나 찾을 수 없는 견적입니다."}</p>
          <Link href="/dashboard/quotes"><Button variant="outline">견적 목록으로 돌아가기</Button></Link>
        </CardContent>
      </Card>
    </FullPageShell>
  );
}

function ForbiddenUI() {
  return (
    <FullPageShell>
      <Card>
        <CardContent className="pt-6 text-center">
          <ShieldX className="h-10 w-10 text-red-300 mx-auto mb-3" />
          <p className="text-muted-foreground py-4">이 견적을 볼 권한이 없습니다.</p>
          <Link href="/dashboard/quotes"><Button variant="outline">견적 목록으로 돌아가기</Button></Link>
        </CardContent>
      </Card>
    </FullPageShell>
  );
}

function NetworkErrorUI({ onRetry }: { onRetry: () => void }) {
  return (
    <FullPageShell>
      <Card>
        <CardContent className="pt-6 text-center">
          <WifiOff className="h-10 w-10 text-amber-400 mx-auto mb-3" />
          <p className="text-muted-foreground py-4">일시적으로 견적 정보를 불러오지 못했습니다.</p>
          <div className="flex items-center justify-center gap-3">
            <Link href="/dashboard/quotes"><Button variant="outline">견적 목록</Button></Link>
            <Button onClick={onRetry} variant="default" className="gap-1.5">
              <RefreshCw className="h-4 w-4" />다시 시도
            </Button>
          </div>
        </CardContent>
      </Card>
    </FullPageShell>
  );
}

function SectionErrorFallback({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 py-6 text-center">
      <AlertTriangle className="h-5 w-5 text-amber-500" />
      <p className="text-sm text-slate-500">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="text-xs gap-1.5">
          <RefreshCw className="h-3 w-3" />다시 시도
        </Button>
      )}
    </div>
  );
}

export default function QuoteDetailPage() {
  const { data: session, status } = useSession();
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const quoteId = params.id as string;

  const [activeTab, setActiveTab] = useState("received");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [copied, setCopied] = useState(false);
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [requestMessage, setRequestMessage] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [showOrderDialog, setShowOrderDialog] = useState(false);
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false);
  const [purchaseBudgetId, setPurchaseBudgetId] = useState("");
  const [purchaseVendorRequestId, setPurchaseVendorRequestId] = useState("");
  const [orderForm, setOrderForm] = useState({
    expectedDelivery: "",
    paymentMethod: "",
    budgetId: "",
    notes: "",
  });
  const [itemsExpanded, setItemsExpanded] = useState(false);
  const [messageExpanded, setMessageExpanded] = useState(false);

  // 구매 완료 시 추가 필드
  const [expectedArrivalDate, setExpectedArrivalDate] = useState("");
  const [autoInventory, setAutoInventory] = useState(false);

  // 벤더 입력 확장 필드 (관리자 전용)
  const [vendorResponseStatus, setVendorResponseStatus] = useState("대기");
  const [vendorLastContact, setVendorLastContact] = useState("");
  const [vendorManager, setVendorManager] = useState("");
  const [vendorHasSubstitute, setVendorHasSubstitute] = useState(false);

  // 회신 입력 상태
  const [replyVendorName, setReplyVendorName] = useState("");
  const [replyItems, setReplyItems] = useState<Record<string, {
    unitPrice: string; currency: string; leadTimeDays: string; moq: string; notes: string;
  }>>({});

  // ── quoteId 검증 ────────────────────────────────────────────────
  const isQuoteIdValid = !!quoteId && isValidQuoteId(quoteId);

  // ── 쿼리: 메인 견적 (전체 페이지 에러 분기의 근거) ──────────────
  const quoteQuery = useQuery({
    queryKey: ["quote", quoteId],
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/quotes/${quoteId}`, { signal });
      if (!res.ok) {
        const statusCode = res.status;
        const body = await res.json().catch(() => ({}));
        logBlockError("quote", quoteId, body.error || statusCode, { userId: session?.user?.id, responseStatus: statusCode });
        if (statusCode === 404) throw new Error("NOT_FOUND");
        if (statusCode === 403) throw new Error("FORBIDDEN");
        if (statusCode === 401) throw new Error("UNAUTHORIZED");
        throw new Error(`FETCH_ERROR:${statusCode}`);
      }
      return res.json();
    },
    enabled: isQuoteIdValid && status === "authenticated",
    retry: (failureCount, error) => {
      const msg = (error as Error).message;
      if (["NOT_FOUND", "FORBIDDEN", "UNAUTHORIZED"].includes(msg)) return false;
      return failureCount < 2;
    },
  });
  const { data: quoteData, isLoading, isError, error: quoteError } = quoteQuery;

  // ── 쿼리: 예산 (실패해도 구매 탭만 제한) ─────────────────────
  const budgetsQuery = useQuery<{ budgets: any[] }>({
    queryKey: ["user-budgets"],
    queryFn: async ({ signal }) => {
      const res = await fetch("/api/user-budgets", { signal });
      if (!res.ok) {
        logBlockError("budgets", quoteId, `BUDGET_FETCH_ERROR:${res.status}`, { userId: session?.user?.id, responseStatus: res.status });
        throw new Error(`BUDGET_FETCH_ERROR:${res.status}`);
      }
      return res.json();
    },
    enabled: status === "authenticated",
    retry: 1,
  });
  const budgetsData = budgetsQuery.data;

  // ── 쿼리: 벤더 요청 (실패해도 해당 탭만 fallback) ────────────
  const vendorQuery = useQuery<{ vendorRequests: any[] }>({
    queryKey: ["vendor-requests", quoteId],
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/quotes/${quoteId}/vendor-requests`, { signal });
      if (!res.ok) {
        logBlockError("vendor-requests", quoteId, `VENDOR_FETCH_ERROR:${res.status}`, { userId: session?.user?.id, responseStatus: res.status });
        throw new Error(`VENDOR_FETCH_ERROR:${res.status}`);
      }
      return res.json();
    },
    enabled: isQuoteIdValid && !!quoteData?.quote && status === "authenticated",
    retry: 1,
  });
  const vendorRequestsData = vendorQuery.data;
  const refetchVendorRequests = vendorQuery.refetch;

  // ── 쿼리: 팀 (실패해도 승인 요청만 제한) ─────────────────────
  const teamsQuery = useQuery({
    queryKey: ["user-teams"],
    queryFn: async ({ signal }) => {
      const res = await fetch("/api/team", { signal });
      if (!res.ok) {
        logBlockError("teams", quoteId, `TEAM_FETCH_ERROR:${res.status}`, { userId: session?.user?.id, responseStatus: res.status });
        throw new Error(`TEAM_FETCH_ERROR:${res.status}`);
      }
      return res.json();
    },
    enabled: status === "authenticated",
    retry: 1,
  });
  const teamsData = teamsQuery.data;

  // ── 파생 값 ──────────────────────────────────────────────────────
  const budgets = budgetsData?.budgets || [];
  const selectedBudget = budgets.find((b: any) => b.id === orderForm.budgetId);
  const quoteItems = quoteData?.quote?.items || [];
  const computedTotal = (quoteItems as any[]).reduce((sum: number, item: any) => {
    const line = item.lineTotal
      ? Math.round(item.lineTotal)
      : item.unitPrice
      ? Math.round(item.unitPrice) * (item.quantity || 1)
      : 0;
    return sum + line;
  }, 0);
  const quoteTotal = computedTotal || quoteData?.quote?.totalAmount || 0;
  const expectedRemaining = selectedBudget ? (selectedBudget.remainingAmount ?? 0) - quoteTotal : null;

  const vendorRequests = vendorRequestsData?.vendorRequests || [];
  const respondedVendors = vendorRequests.filter((vr: any) => vr.status === "RESPONDED");

  const computeVendorReplyTotal = (vrId: string): number => {
    const vr = respondedVendors.find((v: any) => v.id === vrId);
    if (!vr) return quoteTotal;
    const total = (quoteItems as any[]).reduce((sum: number, item: any) => {
      const ri = (vr as any).responseItems?.find((r: any) => r.quoteItemId === item.id);
      return sum + Math.round(Number(ri?.unitPrice ?? 0)) * (item.quantity ?? 1);
    }, 0);
    return total > 0 ? total : quoteTotal;
  };
  const effectiveVrId = purchaseVendorRequestId || (respondedVendors.length === 1 ? (respondedVendors[0] as any)?.id : "");
  const purchaseTotal = effectiveVrId ? computeVendorReplyTotal(effectiveVrId) : quoteTotal;

  // ── Mutations ─────────────────────────────────────────────────────
  const saveVendorReplyMutation = useMutation({
    mutationFn: async () => {
      const quote = quoteData?.quote;
      if (!quote) throw new Error("Quote not found");
      if (!replyVendorName.trim()) throw new Error("벤더명을 입력하세요.");
      const items = quote.items?.map((item: any) => {
        const ri = replyItems[item.id] || {};
        const rawPrice = ri.unitPrice?.trim() ?? "";
        const unitPrice = rawPrice === "" ? 0 : parseFloat(rawPrice);
        return {
          quoteItemId: item.id,
          unitPrice: isNaN(unitPrice) ? 0 : unitPrice,
          currency: ri.currency?.trim() || "KRW",
          leadTimeDays: ri.leadTimeDays ? parseInt(ri.leadTimeDays) : undefined,
          moq: ri.moq ? parseInt(ri.moq) : undefined,
          notes: ri.notes?.trim() || undefined,
        };
      }) || [];
      const res = await fetch(`/api/quotes/${quoteId}/vendor-replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendorName: replyVendorName.trim(), items }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "저장 실패");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-requests", quoteId] });
      setReplyVendorName("");
      setReplyItems({});
      toast({ title: "견적이 저장되었습니다.", description: "비교/추천 탭에서 확인하세요." });
    },
    onError: (error: Error) => {
      toast({ title: "저장 실패", description: error.message, variant: "destructive" });
    },
  });

  const updateReplyItem = (itemId: string, field: string, value: string) => {
    setReplyItems((prev) => ({ ...prev, [itemId]: { ...prev[itemId], [field]: value } }));
  };

  const purchaseRequestMutation = useMutation({
    mutationFn: async ({ teamId, message }: { teamId: string; message: string }) => {
      const quote = quoteData?.quote;
      if (!quote) throw new Error("Quote not found");
      const items = quote.items?.map((item: any) => ({
        productId: item.productId, name: item.name, brand: item.brand,
        catalogNumber: item.catalogNumber, quantity: item.quantity,
        unitPrice: item.unitPrice, lineTotal: item.lineTotal,
      })) || [];
      const res = await fetch("/api/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, title: quote.title || "구매 요청", message, items, quoteId: quote.id, totalAmount: quote.totalAmount }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create purchase request");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      setShowRequestDialog(false);
      setRequestMessage("");
      toast({ title: "승인 요청이 전송되었습니다", description: "관리자의 승인을 기다려주세요." });
    },
    onError: (error: Error) => {
      toast({ title: "승인 요청 실패", description: error.message, variant: "destructive" });
    },
  });

  const createOrderMutation = useMutation({
    mutationFn: async (orderData: { expectedDelivery?: string; paymentMethod?: string; budgetId?: string; notes?: string }) => {
      const res = await fetch("/api/orders", {
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
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || error.message || "Failed to create order");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quote", quoteId] });
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      setShowOrderDialog(false);
      setOrderForm({ expectedDelivery: "", paymentMethod: "", budgetId: "", notes: "" });
      toast({ title: "주문이 접수되었습니다", description: "마이페이지 > 주문 내역에서 확인하세요" });
    },
    onError: (error: Error) => {
      toast({ title: "주문 생성 실패", description: error.message, variant: "destructive" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ status, budgetId, vendorRequestId }: { status: QuoteStatus; budgetId?: string; vendorRequestId?: string }) => {
      const res = await fetch(`/api/quotes/${quoteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, ...(budgetId ? { budgetId } : {}), ...(vendorRequestId ? { vendorRequestId } : {}) }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update status");
      }
      return res.json();
    },
    onSuccess: (data: { quote?: { status?: string } }, variables) => {
      if (data?.quote?.status) {
        queryClient.setQueryData(["quote", quoteId], (prev: unknown) => {
          const p = prev as { quote?: Record<string, unknown> } | undefined;
          if (!p?.quote || typeof p.quote !== "object") return prev;
          return { quote: { ...p.quote, status: data.quote!.status } };
        });
      }
      queryClient.invalidateQueries({ queryKey: ["quote", quoteId] });
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      if (variables.status === "COMPLETED") {
        queryClient.invalidateQueries({ queryKey: ["purchases"] });
        queryClient.invalidateQueries({ queryKey: ["purchase-summary"] });
        queryClient.invalidateQueries({ queryKey: ["purchases-list"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
        queryClient.invalidateQueries({ queryKey: ["user-budgets"] });
      }
      router.refresh();
      if (variables.status === "COMPLETED") {
        toast({ title: "구매 완료 처리됨", description: "구매 내역 및 예산이 자동으로 기록되었습니다." });
      } else if (variables.status === "CANCELLED") {
        toast({ title: "요청이 취소되었습니다", description: "견적 요청이 취소 상태로 변경되었습니다." });
      } else {
        toast({ title: "상태 업데이트 완료", description: "견적 상태가 업데이트되었습니다." });
      }
    },
    onError: (error: Error) => {
      toast({ title: "업데이트 실패", description: error.message, variant: "destructive" });
    },
  });

  const updateNoteMutation = useMutation({
    mutationFn: async ({ itemId, notes }: { itemId: string; notes: string }) => {
      const res = await fetch(`/api/quote-items/${itemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      if (!res.ok) throw new Error("Failed to update note");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quote", quoteId] });
      setEditingNoteId(null);
      setNoteText("");
      toast({ title: "메모 저장됨" });
    },
    onError: (error: Error) => {
      toast({ title: "메모 저장 실패", description: error.message, variant: "destructive" });
    },
  });

  // ── 핸들러 ────────────────────────────────────────────────────────
  const handleMarkAsCompleted = () => {
    setPurchaseBudgetId("");
    setPurchaseVendorRequestId(respondedVendors.length === 1 ? (respondedVendors[0] as any).id : "");
    setExpectedArrivalDate("");
    setAutoInventory(false);
    setShowPurchaseDialog(true);
  };

  const handleCancelQuote = () => {
    if (confirm("정말 이 견적 요청을 취소하시겠습니까?")) {
      updateStatusMutation.mutate({ status: "CANCELLED" });
    }
  };

  const handleStartEditNote = (itemId: string, currentNote: string) => {
    setEditingNoteId(itemId);
    setNoteText(currentNote || "");
  };
  const handleSaveNote = (itemId: string) => updateNoteMutation.mutate({ itemId, notes: noteText });
  const handleCancelNote = () => { setEditingNoteId(null); setNoteText(""); };

  const handleSmartShare = async () => {
    if (!quoteData?.quote) return;
    const quote = quoteData.quote;
    const items = quote.items || [];
    const today = new Date();
    const weekNum = Math.ceil(today.getDate() / 7);
    const monthName = today.toLocaleDateString("ko-KR", { month: "long" });
    const itemLines = items.map((item: any, index: number) => {
      const vendor = item.product?.vendors?.[0]?.vendor;
      const unitPrice = item.unitPrice || 0;
      let line = `${index + 1}. ${item.product?.name || item.name || "제품명 없음"}`;
      if (vendor?.name || item.product?.brand) line += ` (${vendor?.name || item.product?.brand})`;
      line += `\n   - 수량: ${item.quantity}개`;
      if (unitPrice > 0) line += ` | 가격: ${(unitPrice * item.quantity).toLocaleString()}원`;
      if (item.notes) line += `\n   - 메모: ${item.notes}`;
      return line;
    }).join("\n\n");
    const totalAmount = items.reduce((sum: number, item: any) => sum + (item.unitPrice || 0) * item.quantity, 0);
    const shareUrl = `${window.location.origin}/quotes/${quote.id}`;
    const shareText = `[LabAxis] ${quote.title || `${monthName} ${weekNum}주차 시약 구매 요청`}\n\n${itemLines}\n\n총 예상 금액: ${totalAmount > 0 ? `${totalAmount.toLocaleString()}원` : "미정"}\n리스트 보러가기: ${shareUrl}`;
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "클립보드에 복사됨!", description: "카카오톡이나 슬랙에 붙여넣기 하세요." });
    } catch {
      toast({ title: "복사 실패", description: "클립보드 접근에 실패했습니다.", variant: "destructive" });
    }
  };

  // ── 로딩/에러 ────────────────────────────────────────────────────

  // 1. quoteId 형식 검증 (cuid/uuid가 아니면 즉시 not found)
  if (!quoteId || !isQuoteIdValid) {
    return <NotFoundUI message="견적을 찾을 수 없습니다. 견적 목록에서 다시 시도해 주세요." />;
  }

  // 2. 세션 로딩 / 메인 견적 로딩 중
  if (status === "loading" || isLoading) {
    return (
      <FullPageShell>
        <div className="text-center py-12">
          <p className="text-muted-foreground">로딩 중...</p>
        </div>
      </FullPageShell>
    );
  }

  // 3. 메인 견적 에러 → 에러 타입별 분리 UI
  if (isError) {
    const errorMsg = (quoteError as Error)?.message || "";
    if (errorMsg === "NOT_FOUND") return <NotFoundUI />;
    if (errorMsg === "FORBIDDEN") return <ForbiddenUI />;
    if (errorMsg === "UNAUTHORIZED") {
      router.replace("/login");
      return null;
    }
    // 네트워크/기타 에러 → 재시도 가능
    return <NetworkErrorUI onRetry={() => quoteQuery.refetch()} />;
  }

  // 4. 데이터는 왔는데 quote가 null (API가 200이지만 빈 응답)
  if (!quoteData?.quote) {
    return <NotFoundUI />;
  }

  const quote = quoteData.quote;
  const quoteStatus = quote.status as QuoteStatus;
  const userTeam = teamsData?.teams?.[0];
  const isMemberOnly = userTeam?.role === "MEMBER";
  const isAdmin = !isMemberOnly || !userTeam;

  // 운영 상태 구성
  const statusConfig: Record<QuoteStatus, { label: string; cls: string; icon: React.ReactNode }> = {
    PENDING:   { label: "접수",        cls: "bg-amber-100 text-amber-800 border-amber-300",     icon: <Clock className="h-3.5 w-3.5" /> },
    SENT:      { label: "발송 완료",   cls: "bg-blue-100 text-blue-800 border-blue-300",         icon: <Send className="h-3.5 w-3.5" /> },
    RESPONDED: { label: "비교 가능",   cls: "bg-green-100 text-green-800 border-green-300",      icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
    COMPLETED: { label: "구매 완료",   cls: "bg-emerald-100 text-emerald-800 border-emerald-300", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
    CANCELLED: { label: "취소됨",      cls: "bg-red-100 text-red-800 border-red-300",             icon: <XCircle className="h-3.5 w-3.5" /> },
  };
  const sc = statusConfig[quoteStatus] ?? statusConfig.PENDING;

  // 다음 액션 주체 / 긴급도
  const getNextAction = (): { actor: string; label: string } => {
    switch (quoteStatus) {
      case "PENDING": return { actor: "관리자", label: "견적 발송 필요" };
      case "SENT": return { actor: "벤더", label: "벤더 회신 대기" };
      case "RESPONDED": return { actor: isAdmin ? "관리자" : "회원사", label: isAdmin ? "비교 검토 필요" : "승인 결정 필요" };
      case "COMPLETED": return { actor: "—", label: "처리 완료" };
      case "CANCELLED": return { actor: "—", label: "취소됨" };
      default: return { actor: "—", label: "—" };
    }
  };
  const nextAction = getNextAction();

  const getUrgency = (): { label: string; cls: string } => {
    const deadline = quote.deliveryDate || quote.validUntil;
    if (!deadline) return { label: "일반", cls: "bg-[#222226] text-slate-600" };
    const daysLeft = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
    if (daysLeft <= 3) return { label: "긴급", cls: "bg-red-100 text-red-700" };
    if (daysLeft <= 7) return { label: "주의", cls: "bg-amber-100 text-amber-700" };
    return { label: "일반", cls: "bg-[#222226] text-slate-600" };
  };
  const urgency = getUrgency();

  // 회신 현황 집계
  const respondedCount = respondedVendors.length;
  const pendingCount = vendorRequests.length - respondedCount;
  const needsApproval = quoteStatus === "RESPONDED";
  const canConvert = respondedCount >= 1 && quoteStatus !== "CANCELLED" && quoteStatus !== "COMPLETED";

  // 최저가 벤더 (비교/추천 탭용)
  const cheapestVendor = useMemo(() => {
    if (respondedCount === 0) return null;
    if (respondedCount === 1) return { name: (respondedVendors[0] as any)?.vendorName || "벤더", total: computeVendorReplyTotal((respondedVendors[0] as any)?.id) };
    const totals = respondedVendors.map((vr: any) => ({
      name: vr.vendorName || vr.vendorEmail || "벤더",
      total: (quoteItems as any[]).reduce((sum: number, item: any) => {
        const ri = vr.responseItems?.find((r: any) => r.quoteItemId === item.id);
        return sum + Math.round(Number(ri?.unitPrice ?? 0)) * (item.quantity ?? 1);
      }, 0),
    }));
    return totals.filter((t) => t.total > 0).sort((a, b) => a.total - b.total)[0] || null;
  }, [respondedVendors, quoteItems]);

  // 회원사는 기본 탭을 비교/추천으로
  const defaultTab = isAdmin ? "received" : "compare";
  if (!isAdmin && activeTab === "received") {
    // 회원사가 수신 견적 탭에 접근 시 비교/추천으로 리다이렉트 (한 번만)
  }

  // ── JSX ──────────────────────────────────────────────────────────
  return (
    <>
      <div className="min-h-screen bg-[#111114]">
        <div className="container mx-auto px-3 md:px-4 py-4 md:py-8">
          <div className="max-w-5xl mx-auto flex flex-col gap-4 sm:gap-5">

            {/* ── 1. 헤더 카드 ── */}
            <Card className="bg-[#1a1a1e] rounded-xl border border-gray-100 shadow-sm px-4 py-4 md:px-8 md:py-5">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                <div className="flex flex-col gap-2 flex-1 min-w-0">
                  {/* 브레드크럼 */}
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                    <Link href="/dashboard" className="inline-flex items-center gap-1 hover:text-slate-700 transition-colors">
                      <Home className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Home</span>
                    </Link>
                    <span>/</span>
                    <Link href="/dashboard/quotes" className="hover:text-slate-700 transition-colors whitespace-nowrap">견적 운영</Link>
                    <span>/</span>
                    <span className="text-slate-500 truncate max-w-[140px] sm:max-w-xs">{quote.title || "견적 상세"}</span>
                  </div>

                  {/* 제목 + 상태 */}
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href="/quotes">
                      <Button variant="ghost" className="h-8 w-8 p-0 text-slate-500 hover:text-slate-100 hover:bg-[#222226] rounded-md">
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                    </Link>
                    <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-100 truncate">{quote.title}</h1>
                    <Badge variant="outline" className={cn("flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border", sc.cls)}>
                      {sc.icon}
                      {sc.label}
                    </Badge>
                  </div>

                  <span className="text-xs text-muted-foreground ml-9">
                    {new Date(quote.createdAt).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>

                {/* 공유 버튼 */}
                <Button onClick={handleSmartShare} variant="outline" size="sm" className="shrink-0 text-xs h-8">
                  {copied ? <><Check className="h-3.5 w-3.5 mr-1.5 text-green-600" />복사됨!</> : <><Share2 className="h-3.5 w-3.5 mr-1.5" />공유하기</>}
                </Button>
              </div>
            </Card>

            {/* ── 1-0.5 비교 분석 출처 배너 ── */}
            {quote.comparisonId && (
              <Link href={`/compare?sessionId=${quote.comparisonId}`}>
                <div className="flex items-center gap-2 px-4 py-2.5 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors cursor-pointer">
                  <GitCompare className="h-4 w-4 text-purple-600 shrink-0" />
                  <span className="text-xs font-medium text-purple-700">비교 분석에서 생성된 견적</span>
                  <ChevronRight className="h-3.5 w-3.5 text-purple-400 ml-auto" />
                </div>
              </Link>
            )}

            {/* ── 1-1. 운영 상태 스트립 ── */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#1a1a1e] rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex flex-col gap-0.5">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">현재 단계</span>
                <span className="text-sm font-bold text-slate-800">{sc.label}</span>
              </div>
              <div className="bg-[#1a1a1e] rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex flex-col gap-0.5">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">다음 액션</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-blue-600">{nextAction.actor}</span>
                  <ArrowRight className="h-3 w-3 text-slate-300" />
                  <span className="text-xs text-slate-600">{nextAction.label}</span>
                </div>
              </div>
              <div className="bg-[#1a1a1e] rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex flex-col gap-0.5">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">긴급도</span>
                <Badge variant="outline" className={cn("text-[10px] px-2 py-0.5 w-fit font-semibold", urgency.cls)}>{urgency.label}</Badge>
              </div>
            </div>

            {/* ── 2. 운영 KPI 스트립 ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-[#1a1a1e] rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex flex-col gap-0.5">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">수신 견적</span>
                <span className={cn("text-xl font-bold", respondedCount > 0 ? "text-emerald-600" : "text-slate-400")}>
                  {respondedCount}<span className="text-sm font-medium text-slate-500 ml-1">건</span>
                </span>
              </div>
              <div className="bg-[#1a1a1e] rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex flex-col gap-0.5">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">미응답 벤더</span>
                <span className={cn("text-xl font-bold", pendingCount > 0 ? "text-amber-500" : "text-slate-400")}>
                  {pendingCount}<span className="text-sm font-medium text-slate-500 ml-1">건</span>
                </span>
              </div>
              <div className="bg-[#1a1a1e] rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex flex-col gap-0.5">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">승인 필요</span>
                {needsApproval ? (
                  <Badge variant="outline" className="text-xs px-2 py-0.5 w-fit font-semibold bg-blue-50 text-blue-700 border-blue-200">예</Badge>
                ) : (
                  <span className="text-sm font-medium text-slate-400">—</span>
                )}
              </div>
              <div className="bg-[#1a1a1e] rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex flex-col gap-0.5">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">구매 전환</span>
                {canConvert ? (
                  <Badge variant="outline" className="text-xs px-2 py-0.5 w-fit font-semibold bg-emerald-50 text-emerald-700 border-emerald-200">가능</Badge>
                ) : (
                  <span className="text-sm font-medium text-slate-400">불가</span>
                )}
              </div>
            </div>

            {/* ── 3. 견적 정보 (컴팩트 + 접힘) ── */}
            <Card className="bg-[#1a1a1e] rounded-xl border border-gray-100 shadow-sm px-4 py-4 md:px-6 md:py-5">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3">
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">요청자</p>
                  <p className="text-sm font-semibold text-slate-800 truncate">{quote.user?.name || quote.user?.email || "-"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">조직</p>
                  <p className="text-sm font-semibold text-slate-800 truncate">{quote.organization?.name || "-"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">납기 희망일</p>
                  <p className="text-sm font-semibold text-slate-800">
                    {quote.deliveryDate
                      ? new Date(quote.deliveryDate).toLocaleDateString("ko-KR")
                      : quote.validUntil
                      ? new Date(quote.validUntil).toLocaleDateString("ko-KR")
                      : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">납품 장소</p>
                  <p className="text-sm font-semibold text-slate-800 truncate">{quote.deliveryLocation || "-"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">총 예상 금액</p>
                  <p className="text-sm font-semibold text-slate-800">
                    {quote.totalAmount != null ? `${quote.totalAmount.toLocaleString()} ${quote.currency || "KRW"}` : "-"}
                  </p>
                </div>
              </div>

              {/* 요청 메시지 (접힘) */}
              {(quote.description || quote.message) && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setMessageExpanded(!messageExpanded)}
                    className="flex items-center gap-1.5 text-xs text-slate-500 font-medium hover:text-slate-800 transition-colors"
                  >
                    {messageExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    요청 메시지 {messageExpanded ? "접기" : "펼치기"}
                  </button>
                  {messageExpanded && (
                    <blockquote className="mt-2 rounded-lg bg-blue-50/50 border-l-4 border-blue-200 pl-4 pr-4 py-3 text-sm text-slate-700 whitespace-pre-wrap break-words leading-relaxed">
                      {quote.description || quote.message}
                    </blockquote>
                  )}
                </div>
              )}
            </Card>

            {/* ── 4. 3탭 구조: 수신 견적 / 비교·추천 / 구매 처리 ── */}
            <Tabs value={isAdmin ? activeTab : (activeTab === "received" ? "compare" : activeTab)} onValueChange={setActiveTab} className="w-full">
              <div className="bg-[#1a1a1e] rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <TabsList className="flex bg-[#111114]/80 border-b border-[#2a2a2e] gap-0 rounded-none p-0 h-auto w-full justify-start">
                  {/* 수신 견적 탭 - 관리자 전용 */}
                  {isAdmin && (
                    <TabsTrigger
                      value="received"
                      className="flex items-center gap-1.5 rounded-none bg-transparent border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:bg-[#1a1a1e] data-[state=active]:shadow-none px-5 py-3 text-xs md:text-sm text-slate-500 whitespace-nowrap font-medium"
                    >
                      <FileText className="h-3.5 w-3.5 flex-shrink-0" />
                      수신 견적
                      {respondedCount > 0 && (
                        <span className="ml-1 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold bg-blue-600 text-white rounded-full">{respondedCount}</span>
                      )}
                    </TabsTrigger>
                  )}
                  <TabsTrigger
                    value="compare"
                    className="flex items-center gap-1.5 rounded-none bg-transparent border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:bg-[#1a1a1e] data-[state=active]:shadow-none px-5 py-3 text-xs md:text-sm text-slate-500 whitespace-nowrap font-medium"
                  >
                    <GitCompare className="h-3.5 w-3.5 flex-shrink-0" />
                    비교/추천
                  </TabsTrigger>
                  <TabsTrigger
                    value="purchase"
                    className="flex items-center gap-1.5 rounded-none bg-transparent border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:bg-[#1a1a1e] data-[state=active]:shadow-none px-5 py-3 text-xs md:text-sm text-slate-500 whitespace-nowrap font-medium"
                  >
                    <ShoppingCart className="h-3.5 w-3.5 flex-shrink-0" />
                    구매 처리
                  </TabsTrigger>
                </TabsList>

                {/* ── 탭1: 수신 견적 (관리자 전용) ── */}
                {isAdmin && (
                  <TabsContent value="received" className="p-4 sm:p-6 space-y-6 m-0">
                    {vendorQuery.isError ? (
                      <SectionErrorFallback message="벤더 정보를 불러오지 못했습니다." onRetry={() => vendorQuery.refetch()} />
                    ) : vendorQuery.isLoading ? (
                      <div className="text-center py-8 text-sm text-muted-foreground">벤더 정보 로딩 중...</div>
                    ) : (
                    <>
                    {/* 벤더 가격 회신 입력 */}
                    <div>
                      <h3 className="text-sm font-bold text-slate-800 mb-1">벤더 견적 입력</h3>
                      <p className="text-xs text-slate-500 mb-4">벤더명을 입력하고 각 품목의 단가를 기록하세요. 저장 후 비교/추천 탭에 자동 반영됩니다.</p>

                      {/* 벤더 기본 입력 */}
                      <div className="flex items-center gap-3 mb-3 p-3 bg-[#111114] rounded-lg border border-[#2a2a2e]">
                        <Building2 className="h-4 w-4 text-slate-400 shrink-0" />
                        <Label className="text-sm font-semibold whitespace-nowrap">벤더명 *</Label>
                        <Input
                          placeholder="예: 한국바이오, Sigma-Aldrich Korea..."
                          value={replyVendorName}
                          onChange={(e) => setReplyVendorName(e.target.value)}
                          className="max-w-xs text-sm h-9 rounded-md"
                        />
                      </div>

                      {/* 벤더 확장 필드 (관리자 전용) */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4 p-3 bg-[#111114]/50 rounded-lg border border-slate-100">
                        <div className="space-y-1">
                          <Label className="text-[11px] text-slate-500">응답 상태</Label>
                          <Select value={vendorResponseStatus} onValueChange={setVendorResponseStatus}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="대기">대기</SelectItem>
                              <SelectItem value="회신 완료">회신 완료</SelectItem>
                              <SelectItem value="거절">거절</SelectItem>
                              <SelectItem value="무응답">무응답</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] text-slate-500">마지막 연락일</Label>
                          <Input type="date" value={vendorLastContact} onChange={(e) => setVendorLastContact(e.target.value)} className="h-8 text-xs" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] text-slate-500">담당자</Label>
                          <Input placeholder="담당자명" value={vendorManager} onChange={(e) => setVendorManager(e.target.value)} className="h-8 text-xs" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] text-slate-500">대체품 여부</Label>
                          <label className="flex items-center gap-2 h-8 px-2 border rounded-md bg-[#1a1a1e] text-xs cursor-pointer">
                            <input type="checkbox" checked={vendorHasSubstitute} onChange={(e) => setVendorHasSubstitute(e.target.checked)} className="rounded" />
                            대체품 있음
                          </label>
                        </div>
                      </div>

                      {/* 품목별 단가 테이블 */}
                      <div className="overflow-x-auto rounded-lg border border-[#2a2a2e]">
                        <table className="w-full text-sm">
                          <thead className="bg-[#111114]">
                            <tr className="border-b border-[#2a2a2e]">
                              <th className="text-left py-2.5 px-3 font-semibold text-xs text-slate-600">품목명</th>
                              <th className="text-left py-2.5 px-3 font-semibold text-xs text-slate-600">수량</th>
                              <th className="text-left py-2.5 px-3 font-semibold text-xs text-slate-600">단가 *</th>
                              <th className="text-left py-2.5 px-3 font-semibold text-xs text-slate-600 hidden md:table-cell">통화</th>
                              <th className="text-left py-2.5 px-3 font-semibold text-xs text-slate-600 hidden md:table-cell">납기(일)</th>
                              <th className="text-left py-2.5 px-3 font-semibold text-xs text-slate-600 hidden md:table-cell">MOQ</th>
                              <th className="text-left py-2.5 px-3 font-semibold text-xs text-slate-600 hidden lg:table-cell">비고</th>
                            </tr>
                          </thead>
                          <tbody>
                            {quote.items?.map((item: any) => {
                              const ri = replyItems[item.id] || {};
                              return (
                                <tr key={item.id} className="border-b border-slate-100 hover:bg-[#111114]/50">
                                  <td className="p-2 md:p-3">
                                    <div className="text-xs md:text-sm font-medium text-slate-800">{item.name || item.product?.name || "제품 정보 없음"}</div>
                                    {item.catalogNumber && <div className="text-[10px] text-slate-400">{item.catalogNumber}</div>}
                                  </td>
                                  <td className="p-2 md:p-3">
                                    <span className="text-xs text-slate-500">{item.quantity} {item.unit || ""}</span>
                                  </td>
                                  <td className="p-2 md:p-3">
                                    <Input
                                      type="text" inputMode="numeric" placeholder="단가"
                                      value={ri.unitPrice ? Number(ri.unitPrice).toLocaleString("ko-KR") : ""}
                                      onChange={(e) => { const raw = e.target.value.replace(/\D/g, ""); updateReplyItem(item.id, "unitPrice", raw); }}
                                      className="text-xs md:text-sm h-8 w-28 rounded-md"
                                    />
                                  </td>
                                  <td className="p-2 md:p-3 hidden md:table-cell">
                                    <Select value={ri.currency || "KRW"} onValueChange={(v) => updateReplyItem(item.id, "currency", v)}>
                                      <SelectTrigger className="text-xs h-8 w-20 rounded-md"><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="KRW">KRW</SelectItem>
                                        <SelectItem value="USD">USD</SelectItem>
                                        <SelectItem value="EUR">EUR</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </td>
                                  <td className="p-2 md:p-3 hidden md:table-cell">
                                    <Input type="number" placeholder="일수" value={ri.leadTimeDays || ""} onChange={(e) => updateReplyItem(item.id, "leadTimeDays", e.target.value)} className="text-xs h-8 w-20 rounded-md" />
                                  </td>
                                  <td className="p-2 md:p-3 hidden md:table-cell">
                                    <Input type="number" placeholder="MOQ" value={ri.moq || ""} onChange={(e) => updateReplyItem(item.id, "moq", e.target.value)} className="text-xs h-8 w-20 rounded-md" />
                                  </td>
                                  <td className="p-2 md:p-3 hidden lg:table-cell">
                                    <Input placeholder="비고" value={ri.notes || ""} onChange={(e) => updateReplyItem(item.id, "notes", e.target.value)} className="text-xs h-8 w-32 rounded-md" />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    </>
                    )}
                  </TabsContent>
                )}

                {/* ── 탭2: 비교/추천 ── */}
                <TabsContent value="compare" className="p-4 sm:p-6 space-y-6 m-0">
                  {vendorQuery.isError ? (
                    <SectionErrorFallback message="벤더 비교 정보를 불러오지 못했습니다." onRetry={() => vendorQuery.refetch()} />
                  ) : vendorQuery.isLoading ? (
                    <div className="text-center py-8 text-sm text-muted-foreground">비교 정보 로딩 중...</div>
                  ) : respondedVendors.length > 0 ? (
                    <>
                      {/* 추천 벤더 요약 */}
                      {cheapestVendor && respondedCount > 1 && (
                        <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                          <div>
                            <p className="text-sm font-bold text-emerald-800">추천: {cheapestVendor.name}</p>
                            <p className="text-xs text-emerald-600">최저 총액 {cheapestVendor.total.toLocaleString()} KRW</p>
                          </div>
                        </div>
                      )}

                      {/* 벤더 가격 비교 테이블 */}
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <GitCompare className="h-4 w-4 text-blue-600" />
                          <h3 className="text-sm font-bold text-slate-800">벤더 가격 비교</h3>
                          <span className="text-xs text-slate-500">{respondedVendors.length}개 벤더 · 최저가 강조</span>
                          {isAdmin && <button onClick={() => refetchVendorRequests()} className="ml-auto text-xs text-blue-600 hover:underline">새로고침</button>}
                        </div>

                        <div className="overflow-x-auto rounded-lg border border-[#2a2a2e]">
                          <table className="w-full text-xs">
                            <thead className="bg-[#111114]">
                              <tr className="border-b border-[#2a2a2e]">
                                <th className="text-left py-2.5 px-3 font-semibold text-slate-600">품목</th>
                                {respondedVendors.map((vr: any) => (
                                  <th key={vr.id} className="text-center py-2.5 px-3 font-semibold text-slate-600 min-w-[130px]">
                                    {vr.vendorName || vr.vendorEmail || "벤더"}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {quote.items?.map((item: any) => {
                                const prices = respondedVendors.map((vr: any) => {
                                  const ri = vr.responseItems?.find((r: any) => r.quoteItemId === item.id);
                                  return ri?.unitPrice ?? null;
                                });
                                const validPrices = prices.filter((p: number | null) => p !== null && p > 0) as number[];
                                const minPrice = validPrices.length > 0 ? Math.min(...validPrices) : null;
                                const maxPrice = validPrices.length > 1 ? Math.max(...validPrices) : null;
                                return (
                                  <tr key={item.id} className="border-b border-slate-100 hover:bg-[#111114]/50">
                                    <td className="py-3 px-3">
                                      <div className="font-medium text-slate-800">{item.name || item.product?.name}</div>
                                      {item.catalogNumber && <div className="text-[10px] text-slate-400">{item.catalogNumber}</div>}
                                    </td>
                                    {respondedVendors.map((vr: any) => {
                                      const ri = vr.responseItems?.find((r: any) => r.quoteItemId === item.id);
                                      const price = ri?.unitPrice ?? null;
                                      const isLowest = price !== null && price > 0 && price === minPrice && validPrices.length > 1;
                                      const savingVsMax = isLowest && maxPrice ? maxPrice - (price as number) : null;
                                      return (
                                        <td key={vr.id} className="py-3 px-3 text-center">
                                          {price !== null ? (
                                            <div className={cn("inline-flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg", isLowest ? "bg-emerald-50 border border-emerald-200" : "")}>
                                              <span className={cn("font-bold text-sm", isLowest ? "text-emerald-700" : "text-slate-700")}>
                                                {price > 0 ? price.toLocaleString() : "—"}
                                                <span className="text-[10px] font-normal ml-0.5">{ri?.currency || "KRW"}</span>
                                              </span>
                                              {isLowest && <span className="text-[9px] font-bold text-emerald-600 uppercase">최저가</span>}
                                              {isLowest && savingVsMax && (
                                                <span className="text-[9px] text-emerald-600">-{savingVsMax.toLocaleString()} 절약</span>
                                              )}
                                              {ri?.leadTimeDays && (
                                                <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                                                  <Truck className="h-2.5 w-2.5" />{ri.leadTimeDays}일
                                                </span>
                                              )}
                                              {ri?.moq && ri.moq > 1 && <span className="text-[9px] text-slate-400">MOQ {ri.moq}</span>}
                                            </div>
                                          ) : (
                                            <span className="text-slate-300">—</span>
                                          )}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                );
                              })}

                              {/* 합계 행 */}
                              <tr className="border-t-2 border-[#2a2a2e] bg-[#111114]">
                                <td className="py-3 px-3 font-bold text-sm text-slate-700">총 합계</td>
                                {respondedVendors.map((vr: any) => {
                                  const total = quote.items?.reduce((sum: number, item: any) => {
                                    const ri = vr.responseItems?.find((r: any) => r.quoteItemId === item.id);
                                    return sum + (ri?.unitPrice ?? 0) * (item.quantity ?? 1);
                                  }, 0) ?? 0;
                                  const allTotals = respondedVendors.map((v: any) =>
                                    quote.items?.reduce((s: number, it: any) => {
                                      const r = v.responseItems?.find((ri: any) => ri.quoteItemId === it.id);
                                      return s + (r?.unitPrice ?? 0) * (it.quantity ?? 1);
                                    }, 0) ?? 0
                                  );
                                  const positives = (allTotals as number[]).filter((t) => t > 0);
                                  const minTotal = positives.length > 0 ? Math.min(...positives) : 0;
                                  const maxTotal = positives.length > 1 ? Math.max(...positives) : 0;
                                  const isLowestTotal = total > 0 && total === minTotal && positives.length > 1;
                                  const saving = isLowestTotal && maxTotal > minTotal ? maxTotal - minTotal : null;
                                  return (
                                    <td key={vr.id} className="py-3 px-3 text-center">
                                      <div className={cn("inline-flex flex-col items-center gap-0.5", isLowestTotal ? "text-emerald-700" : "text-slate-700")}>
                                        <span className="font-bold text-sm">{total > 0 ? `${total.toLocaleString()} KRW` : "—"}</span>
                                        {isLowestTotal && saving && (
                                          <span className="text-[10px] font-semibold text-emerald-600 flex items-center gap-0.5">
                                            <TrendingDown className="h-3 w-3" />최저가 · {saving.toLocaleString()}원 절약
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                  );
                                })}
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground text-sm border border-dashed border-[#2a2a2e] rounded-lg bg-[#111114]">
                      <GitCompare className="h-8 w-8 text-slate-300 mx-auto mb-3" />
                      <p className="font-medium text-slate-600 mb-1">수신된 견적이 없습니다</p>
                      <p className="text-xs text-slate-400">벤더 회신이 도착하면 자동으로 비교 테이블이 생성됩니다.</p>
                    </div>
                  )}
                </TabsContent>

                {/* ── 탭3: 구매 처리 ── */}
                <TabsContent value="purchase" className="p-4 sm:p-6 space-y-5 m-0">
                  {quoteStatus === "COMPLETED" && quote.order ? (
                    <div className="text-center py-10">
                      <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
                      <p className="text-sm font-bold text-slate-800 mb-1">구매 처리가 완료되었습니다</p>
                      <p className="text-xs text-slate-500">주문 내역에서 상세 정보를 확인할 수 있습니다.</p>
                    </div>
                  ) : quoteStatus === "CANCELLED" ? (
                    <div className="text-center py-10">
                      <XCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
                      <p className="text-sm font-bold text-slate-800 mb-1">취소된 견적입니다</p>
                      <p className="text-xs text-slate-500">구매 처리를 진행할 수 없습니다.</p>
                    </div>
                  ) : respondedVendors.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground text-sm border border-dashed border-[#2a2a2e] rounded-lg bg-[#111114]">
                      <ShoppingCart className="h-8 w-8 text-slate-300 mx-auto mb-3" />
                      <p className="font-medium text-slate-600 mb-1">구매 처리 준비 중</p>
                      <p className="text-xs text-slate-400">벤더 회신이 1건 이상 있어야 구매 처리가 가능합니다.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-slate-800">구매 진행 처리</h3>

                      {/* 벤더 선택 (다중 회신 시) */}
                      {respondedVendors.length > 1 && (
                        <div className="space-y-2">
                          <Label>구매할 벤더 선택 <span className="text-red-500">*</span></Label>
                          <Select value={purchaseVendorRequestId} onValueChange={setPurchaseVendorRequestId}>
                            <SelectTrigger><SelectValue placeholder="벤더를 선택하세요" /></SelectTrigger>
                            <SelectContent>{respondedVendors.map((vr: any) => (<SelectItem key={vr.id} value={vr.id}>{vr.vendorName || vr.vendorEmail || "벤더"}</SelectItem>))}</SelectContent>
                          </Select>
                        </div>
                      )}

                      {/* 결제 금액 */}
                      {purchaseTotal > 0 && (
                        <div className="flex items-center justify-between p-3 bg-[#111114] rounded-lg border border-[#2a2a2e] text-sm">
                          <span className="text-muted-foreground font-medium">결제 금액</span>
                          <span className="font-bold text-slate-100">₩{purchaseTotal.toLocaleString("ko-KR")}</span>
                        </div>
                      )}

                      {/* 결제 예산 */}
                      {budgetsQuery.isError ? (
                        <SectionErrorFallback message="예산 정보를 불러오지 못했습니다." onRetry={() => budgetsQuery.refetch()} />
                      ) : (
                        <>
                          <div className="space-y-2">
                            <Label>결제 예산 <span className="text-red-500">*</span></Label>
                            <Select value={purchaseBudgetId} onValueChange={setPurchaseBudgetId}>
                              <SelectTrigger><SelectValue placeholder="예산을 선택하세요" /></SelectTrigger>
                              <SelectContent>
                                {budgets.length === 0 ? (
                                  <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                                    등록된 활성 예산이 없습니다.<br /><span className="text-xs">예산 관리 페이지에서 먼저 등록해주세요.</span>
                                  </div>
                                ) : (
                                  budgets.map((b: any) => (
                                    <SelectItem key={b.id} value={b.id}>{b.name} — 잔액 ₩{b?.remainingAmount?.toLocaleString("ko-KR") ?? "—"}</SelectItem>
                                  ))
                                )}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* 예산 미리보기 */}
                          {(() => {
                            const selBudget = budgets.find((b: any) => b.id === purchaseBudgetId);
                            if (!selBudget) return null;
                            const afterAmount = (selBudget.remainingAmount ?? 0) - purchaseTotal;
                            return (
                              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 space-y-1.5">
                                <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">현재 잔액</span><span className="font-semibold">₩{(selBudget.remainingAmount ?? 0).toLocaleString("ko-KR")}</span></div>
                                <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">차감 금액</span><span className="font-semibold text-red-600">- ₩{purchaseTotal.toLocaleString("ko-KR")}</span></div>
                                <div className="flex items-center justify-between text-sm pt-1.5 border-t border-blue-200">
                                  <span className="font-medium">차감 후 잔액</span>
                                  <span className={cn("font-bold text-base", afterAmount < 0 ? "text-red-600" : "text-emerald-600")}>₩{afterAmount.toLocaleString("ko-KR")}</span>
                                </div>
                                {afterAmount < 0 && <p className="text-xs text-red-600 flex items-center gap-1 pt-0.5"><AlertTriangle className="h-3 w-3 shrink-0" />예산 잔액이 부족합니다.</p>}
                              </div>
                            );
                          })()}
                        </>
                      )}

                      {/* 입고 예정일 */}
                      <div className="space-y-2">
                        <Label>입고 예정일 <span className="text-slate-400 text-xs">(선택)</span></Label>
                        <Input type="date" value={expectedArrivalDate} onChange={(e) => setExpectedArrivalDate(e.target.value)} min={new Date().toISOString().split("T")[0]} />
                      </div>

                      {/* 재고 반영 옵션 */}
                      <label className="flex items-center gap-2 p-3 bg-[#111114] rounded-lg border border-[#2a2a2e] cursor-pointer">
                        <input type="checkbox" checked={autoInventory} onChange={(e) => setAutoInventory(e.target.checked)} className="rounded" />
                        <div>
                          <span className="text-sm font-medium text-slate-800">입고 시 재고에 자동 반영</span>
                          <p className="text-xs text-slate-500">구매 완료 처리 후 재고 관리에 자동으로 반영됩니다.</p>
                        </div>
                      </label>
                    </div>
                  )}
                </TabsContent>
              </div>
            </Tabs>

            {/* ── 5. 견적 요청 품목 (접힘) ── */}
            <Card className="bg-[#1a1a1e] rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <button
                type="button"
                onClick={() => setItemsExpanded(!itemsExpanded)}
                className="w-full flex items-center justify-between px-4 sm:px-6 py-3.5 text-sm font-semibold text-slate-700 hover:bg-[#111114] transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-slate-400" />
                  견적 요청 품목
                  <Badge variant="secondary" className="text-xs font-semibold">{quote.items?.length || 0}개</Badge>
                </span>
                {itemsExpanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
              </button>

              {itemsExpanded && (
                <div className="border-t border-slate-100">
                  {/* 모바일: 카드 */}
                  <div className="md:hidden space-y-3 p-4">
                    {quote.items?.map((item: any) => {
                      const vendor = item.product?.vendors?.[0]?.vendor;
                      const isEditing = editingNoteId === item.id;
                      return (
                        <div key={item.id} className="p-3 border border-[#2a2a2e] rounded-lg space-y-2">
                          <div className="font-semibold text-sm text-slate-100">{item.product?.name || item.name || "제품 정보 없음"}</div>
                          <div className="text-xs text-muted-foreground space-y-0.5">
                            {(vendor?.name || item.product?.brand) && <div>벤더: {vendor?.name || item.product?.brand}</div>}
                            {item.product?.spec && <div>규격: {item.product.spec}</div>}
                            <div>수량: {item.quantity}</div>
                          </div>
                          <div className="pt-2 border-t">
                            {isEditing ? (
                              <div className="space-y-2">
                                <Textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="메모를 입력하세요..." className="text-xs min-h-[60px]" />
                                <div className="flex gap-2">
                                  <Button size="sm" onClick={() => handleSaveNote(item.id)} disabled={updateNoteMutation.isPending} className="h-7 text-xs"><Check className="h-3 w-3 mr-1" />저장</Button>
                                  <Button size="sm" variant="outline" onClick={handleCancelNote} className="h-7 text-xs">취소</Button>
                                </div>
                              </div>
                            ) : (
                              <div onClick={() => handleStartEditNote(item.id, item.notes || "")} className="flex items-start gap-2 cursor-pointer hover:bg-muted/50 rounded p-1 -m-1">
                                <MessageSquare className="h-3 w-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                                <span className="text-xs text-muted-foreground">{item.notes || "메모 추가..."}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* 데스크탑: 테이블 */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-[#111114]">
                        <tr className="border-b border-[#2a2a2e]">
                          <th className="text-left py-3 px-4 font-semibold text-xs text-slate-600">제품명</th>
                          <th className="text-left py-3 px-4 font-semibold text-xs text-slate-600">벤더</th>
                          <th className="text-left py-3 px-4 font-semibold text-xs text-slate-600">규격</th>
                          <th className="text-left py-3 px-4 font-semibold text-xs text-slate-600">수량</th>
                          <th className="text-left py-3 px-4 font-semibold text-xs text-slate-600 min-w-[200px]">메모</th>
                        </tr>
                      </thead>
                      <tbody>
                        {quote.items?.map((item: any) => {
                          const vendor = item.product?.vendors?.[0]?.vendor;
                          const isEditing = editingNoteId === item.id;
                          return (
                            <tr key={item.id} className="border-b border-slate-100 hover:bg-[#111114]/50">
                              <td className="py-3 px-4 min-w-[180px]">
                                <div className="font-semibold text-sm text-slate-100 truncate">{item.product?.name || item.name || "제품 정보 없음"}</div>
                              </td>
                              <td className="py-3 px-4 text-sm text-muted-foreground">{vendor?.name || item.product?.brand || "-"}</td>
                              <td className="py-3 px-4 text-sm text-muted-foreground">{item.product?.spec || "-"}</td>
                              <td className="py-3 px-4 text-sm font-medium">{item.quantity}</td>
                              <td className="py-3 px-4 text-sm">
                                {isEditing ? (
                                  <div className="flex items-center gap-2">
                                    <Input value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="메모 입력..." className="h-8 text-xs flex-1"
                                      onKeyDown={(e) => { if (e.key === "Enter") handleSaveNote(item.id); if (e.key === "Escape") handleCancelNote(); }} autoFocus />
                                    <Button size="sm" onClick={() => handleSaveNote(item.id)} disabled={updateNoteMutation.isPending} className="h-8 w-8 p-0"><Check className="h-4 w-4" /></Button>
                                    <Button size="sm" variant="outline" onClick={handleCancelNote} className="h-8 w-8 p-0"><X className="h-4 w-4" /></Button>
                                  </div>
                                ) : (
                                  <div onClick={() => handleStartEditNote(item.id, item.notes || "")} className="flex items-center gap-2 cursor-pointer hover:bg-muted rounded px-2 py-1 -mx-2 -my-1 group">
                                    {item.notes ? (
                                      <><MessageSquare className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" /><span className="text-muted-foreground">{item.notes}</span><Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" /></>
                                    ) : (
                                      <><MessageSquare className="h-3.5 w-3.5 text-muted-foreground/50 flex-shrink-0" /><span className="text-muted-foreground/50 italic">메모 추가...</span></>
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
                </div>
              )}
            </Card>

            {/* ── 5.5 최근 활동 ── */}
            <Card className="bg-[#1a1a1e] rounded-xl border border-gray-100 shadow-sm px-4 py-3 sm:px-6">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">최근 활동</h3>
              <ActivityTimeline entityType="QUOTE" entityId={quoteId} limit={3} />
            </Card>

            {/* ── 6. 하단 액션 바 ── */}
            <Card className="bg-[#1a1a1e] rounded-xl border border-gray-100 shadow-sm px-4 py-4 sm:px-6">
              <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3">

                {/* 관리자: 견적 저장 */}
                {isAdmin && quoteStatus !== "COMPLETED" && quoteStatus !== "CANCELLED" && (
                  <Button
                    onClick={() => saveVendorReplyMutation.mutate()}
                    disabled={saveVendorReplyMutation.isPending || !replyVendorName.trim()}
                    className="w-full sm:w-auto text-sm h-10 bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm disabled:opacity-50"
                  >
                    <Save className="h-4 w-4 mr-2 shrink-0" />
                    {saveVendorReplyMutation.isPending ? "저장 중..." : "견적 저장"}
                  </Button>
                )}

                {/* 관리자: 구매 진행 처리 */}
                {isAdmin && quoteStatus !== "COMPLETED" && quoteStatus !== "CANCELLED" && respondedVendors.length > 0 && (
                  <Button
                    onClick={handleMarkAsCompleted}
                    disabled={updateStatusMutation.isPending}
                    variant="outline"
                    className="w-full sm:w-auto text-sm h-10 border-emerald-300 text-emerald-700 hover:bg-emerald-50 font-semibold"
                  >
                    <Package className="h-4 w-4 mr-2 shrink-0" />
                    {updateStatusMutation.isPending ? "처리 중..." : "구매 진행 처리"}
                  </Button>
                )}

                {/* 회원사: 승인 */}
                {!isAdmin && quoteStatus === "RESPONDED" && (
                  <Button
                    onClick={handleMarkAsCompleted}
                    className="w-full sm:w-auto text-sm h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2 shrink-0" />
                    승인
                  </Button>
                )}

                {/* 회원사: 보류 */}
                {!isAdmin && quoteStatus === "RESPONDED" && (
                  <Button
                    onClick={() => toast({ title: "보류 처리됨", description: "추가 검토가 필요하면 관리자에게 문의하세요." })}
                    variant="outline"
                    className="w-full sm:w-auto text-sm h-10"
                  >
                    <Clock className="h-4 w-4 mr-2 shrink-0" />
                    보류
                  </Button>
                )}

                {/* COMPLETED: 주문 접수 요청 */}
                {quoteStatus === "COMPLETED" && !quote.order && isAdmin && (
                  <Dialog open={showOrderDialog} onOpenChange={setShowOrderDialog}>
                    <DialogTrigger asChild>
                      <Button className="w-full sm:w-auto text-sm h-10 bg-blue-600 hover:bg-blue-700 text-white font-semibold">
                        <ShoppingCart className="h-4 w-4 mr-2 shrink-0" />주문 접수 요청
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
                      <DialogHeader>
                        <DialogTitle>주문 접수</DialogTitle>
                        <DialogDescription>주문 정보를 입력하고 접수해주세요</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4 overflow-y-auto pr-1 flex-1">
                        <div className="space-y-2">
                          <Label>희망 배송일</Label>
                          <Input type="date" value={orderForm.expectedDelivery} onChange={(e) => setOrderForm({ ...orderForm, expectedDelivery: e.target.value })} min={new Date().toISOString().split("T")[0]} />
                        </div>
                        <div className="space-y-2">
                          <Label>���제할 과제 <span className="text-red-500">*</span></Label>
                          <Select value={orderForm.budgetId} onValueChange={(value) => setOrderForm({ ...orderForm, budgetId: value })}>
                            <SelectTrigger><SelectValue placeholder="과제를 선택하세요" /></SelectTrigger>
                            <SelectContent>
                              {budgets.map((budget: any) => (
                                <SelectItem key={budget.id} value={budget.id}>{budget.name} (잔액: ₩ {safeLocaleAmount(budget.remainingAmount)})</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {selectedBudget && (
                            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 space-y-1 text-sm">
                              <div className="flex justify-between"><span className="text-muted-foreground">현재 잔액</span><span className="font-semibold">₩ {safeLocaleAmount(selectedBudget.remainingAmount)}</span></div>
                              <div className="flex justify-between"><span className="text-muted-foreground">주문 금액</span><span className="font-semibold text-red-600">- ₩ {quoteTotal.toLocaleString()}</span></div>
                              <div className="flex justify-between pt-1.5 border-t border-blue-200"><span className="font-medium">예상 잔액</span>
                                <span className={cn("font-bold", expectedRemaining !== null && expectedRemaining < 0 ? "text-red-600" : "text-green-600")}>₩ {expectedRemaining !== null ? expectedRemaining.toLocaleString() : "0"}</span>
                              </div>
                              {expectedRemaining !== null && expectedRemaining < 0 && <p className="text-xs text-red-600 flex items-center gap-1"><AlertTriangle className="h-3 w-3" />예산이 부족합니다</p>}
                            </div>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label>결제 방식 <span className="text-muted-foreground text-xs">(선택)</span></Label>
                          <Select value={orderForm.paymentMethod} onValueChange={(value) => setOrderForm({ ...orderForm, paymentMethod: value })}>
                            <SelectTrigger><SelectValue placeholder="결제 방식 선택" /></SelectTrigger>
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
                          <Label>전달 사항 <span className="text-muted-foreground text-xs">(선택)</span></Label>
                          <Textarea placeholder="추가로 전달할 사항이 있으시면 입력하세요" value={orderForm.notes} onChange={(e) => setOrderForm({ ...orderForm, notes: e.target.value })} rows={3} />
                        </div>
                        <div className="flex gap-2 pt-2">
                          <Button variant="outline" onClick={() => { setShowOrderDialog(false); setOrderForm({ expectedDelivery: "", paymentMethod: "", budgetId: "", notes: "" }); }} className="flex-1">취소</Button>
                          <Button onClick={() => {
                            if (!orderForm.budgetId) { toast({ title: "과제를 선택해주세요", variant: "destructive" }); return; }
                            createOrderMutation.mutate({ expectedDelivery: orderForm.expectedDelivery || undefined, paymentMethod: orderForm.paymentMethod || undefined, budgetId: orderForm.budgetId, notes: orderForm.notes || undefined });
                          }} disabled={createOrderMutation.isPending || !orderForm.budgetId} className="flex-1 bg-blue-600 hover:bg-blue-700">
                            {createOrderMutation.isPending ? "처리 중..." : "주문 접수"}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}

                {/* COMPLETED + 회원사: 승인 요청 */}
                {quoteStatus === "COMPLETED" && !quote.order && !isAdmin && (
                  <Dialog open={showRequestDialog} onOpenChange={setShowRequestDialog}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="w-full sm:w-auto text-sm h-10">
                        <Send className="h-4 w-4 mr-2 shrink-0" />승인 요청
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>승인 요청</DialogTitle>
                        <DialogDescription>관리자에게 구매 승인을 요청합니다.</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label>팀 선택</Label>
                          <Select value={selectedTeamId || ""} onValueChange={setSelectedTeamId}>
                            <SelectTrigger><SelectValue placeholder="팀을 선택하세요" /></SelectTrigger>
                            <SelectContent>{teamsData?.teams?.map((team: any) => (<SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>))}</SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>요청 메모 (선택)</Label>
                          <Textarea placeholder="예: 실험 A에 필요함, 긴급 주문 요청 등" value={requestMessage} onChange={(e) => setRequestMessage(e.target.value)} rows={3} />
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" onClick={() => setShowRequestDialog(false)} className="flex-1">취소</Button>
                          <Button onClick={() => { if (!selectedTeamId) { toast({ title: "팀을 선택해주세요", variant: "destructive" }); return; } purchaseRequestMutation.mutate({ teamId: selectedTeamId, message: requestMessage }); }}
                            disabled={purchaseRequestMutation.isPending || !selectedTeamId} className="flex-1">
                            {purchaseRequestMutation.isPending ? "전송 중..." : "요청 전송"}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}

                {/* COMPLETED + 주문 완료 */}
                {quoteStatus === "COMPLETED" && quote.order && (
                  <Badge variant="default" className="px-3 py-1.5 text-xs justify-center w-full sm:w-auto">
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />구매 완료됨
                  </Badge>
                )}

                {/* 구분선 */}
                <div className="hidden sm:block w-px h-8 bg-slate-200 mx-1" />

                {/* 목록으로 */}
                <Link href="/quotes" className="w-full sm:w-auto">
                  <Button variant="outline" className="w-full sm:w-auto text-sm h-10">
                    <ChevronLeft className="h-4 w-4 mr-1.5 shrink-0" />목록으로
                  </Button>
                </Link>

                {/* 요청 취소 처리 */}
                {quoteStatus === "PENDING" && (
                  <Button type="button" variant="outline" onClick={handleCancelQuote} disabled={updateStatusMutation.isPending}
                    className="w-full sm:w-auto text-sm h-10 text-red-600 border-red-300 hover:bg-red-50 hover:border-red-400">
                    <XCircle className="h-4 w-4 mr-1.5 shrink-0" />
                    {updateStatusMutation.isPending && updateStatusMutation.variables?.status === "CANCELLED" ? "처리 중..." : "요청 취소 처리"}
                  </Button>
                )}

                {/* 회원사: 요청 취소 */}
                {!isAdmin && quoteStatus !== "COMPLETED" && quoteStatus !== "CANCELLED" && quoteStatus !== "PENDING" && (
                  <Button type="button" variant="outline" onClick={handleCancelQuote} disabled={updateStatusMutation.isPending}
                    className="w-full sm:w-auto text-sm h-10 text-red-600 border-red-300 hover:bg-red-50">
                    <XCircle className="h-4 w-4 mr-1.5 shrink-0" />
                    요청 취소 처리
                  </Button>
                )}
              </div>
            </Card>

          </div>
        </div>
      </div>

      {/* ── 구매 확정 다이얼로그 ── */}
      <Dialog open={showPurchaseDialog} onOpenChange={setShowPurchaseDialog}>
        <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-blue-600" />구매 진행 처리
            </DialogTitle>
            <DialogDescription>차감할 예산을 선택하세요. 구매 내역과 예산 사용액이 자동으로 기록됩니다.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 overflow-y-auto pr-1 flex-1">
            {respondedVendors.length > 1 && (
              <div className="space-y-2">
                <Label>구매할 벤더 선택 <span className="text-red-500">*</span></Label>
                <Select value={purchaseVendorRequestId} onValueChange={setPurchaseVendorRequestId}>
                  <SelectTrigger><SelectValue placeholder="벤더를 선택하세요" /></SelectTrigger>
                  <SelectContent>{respondedVendors.map((vr: any) => (<SelectItem key={vr.id} value={vr.id}>{vr.vendorName || vr.vendorEmail || "벤더"}</SelectItem>))}</SelectContent>
                </Select>
              </div>
            )}

            {purchaseTotal > 0 && (
              <div className="flex items-center justify-between p-3 bg-[#111114] rounded-lg border border-[#2a2a2e] text-sm">
                <span className="text-muted-foreground font-medium">결제 금액</span>
                <span className="font-bold text-slate-100">₩{purchaseTotal.toLocaleString("ko-KR")}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label>결제 예산 <span className="text-red-500">*</span></Label>
              <Select value={purchaseBudgetId} onValueChange={setPurchaseBudgetId}>
                <SelectTrigger><SelectValue placeholder="예산을 선택하세요" /></SelectTrigger>
                <SelectContent>
                  {budgets.length === 0 ? (
                    <div className="px-3 py-4 text-center text-sm text-muted-foreground">등록된 활성 예산이 없습니다.</div>
                  ) : (
                    budgets.map((b: any) => (
                      <SelectItem key={b.id} value={b.id}>{b.name} — 잔액 ₩{safeLocaleAmount(b.remainingAmount)}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {(() => {
              const selBudget = budgets.find((b: any) => b.id === purchaseBudgetId);
              if (!selBudget) return null;
              const afterAmount = (selBudget.remainingAmount ?? 0) - purchaseTotal;
              return (
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 space-y-1.5">
                  <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">현재 잔액</span><span className="font-semibold">₩{safeLocaleAmount(selBudget.remainingAmount)}</span></div>
                  <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">차감 금액</span><span className="font-semibold text-red-600">- ₩{purchaseTotal.toLocaleString("ko-KR")}</span></div>
                  <div className="flex items-center justify-between text-sm pt-1.5 border-t border-blue-200">
                    <span className="font-medium">차감 후 잔액</span>
                    <span className={cn("font-bold text-base", afterAmount < 0 ? "text-red-600" : "text-emerald-600")}>₩{afterAmount.toLocaleString("ko-KR")}</span>
                  </div>
                  {afterAmount < 0 && <p className="text-xs text-red-600 flex items-center gap-1 pt-0.5"><AlertTriangle className="h-3 w-3 shrink-0" />예산 잔액이 부족합니다.</p>}
                </div>
              );
            })()}

            {/* 입고 예정일 */}
            <div className="space-y-2">
              <Label>입고 예정일 <span className="text-slate-400 text-xs">(선택)</span></Label>
              <Input type="date" value={expectedArrivalDate} onChange={(e) => setExpectedArrivalDate(e.target.value)} min={new Date().toISOString().split("T")[0]} />
            </div>

            {/* 재고 반영 옵션 */}
            <label className="flex items-center gap-2 p-3 bg-[#111114] rounded-lg border border-[#2a2a2e] cursor-pointer">
              <input type="checkbox" checked={autoInventory} onChange={(e) => setAutoInventory(e.target.checked)} className="rounded" />
              <div>
                <span className="text-sm font-medium text-slate-800">입고 시 재고에 자동 반영</span>
                <p className="text-xs text-slate-500">구매 완료 처리 후 재고 관리에 자동 반영</p>
              </div>
            </label>
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => setShowPurchaseDialog(false)}>취소</Button>
            <Button
              className="flex-1 bg-blue-600 hover:bg-blue-700"
              disabled={
                !purchaseBudgetId ||
                (respondedVendors.length > 1 && !purchaseVendorRequestId) ||
                updateStatusMutation.isPending ||
                (() => { const b = budgets.find((b: any) => b.id === purchaseBudgetId); return b ? (b.remainingAmount ?? 0) < purchaseTotal : false; })()
              }
              onClick={() => {
                setShowPurchaseDialog(false);
                updateStatusMutation.mutate({ status: "COMPLETED", budgetId: purchaseBudgetId, vendorRequestId: effectiveVrId || undefined });
              }}
            >
              {updateStatusMutation.isPending ? "처리 중..." : "구매 진행 처리"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
