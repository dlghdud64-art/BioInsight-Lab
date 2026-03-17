"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
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
  Package,
  CheckCircle2,
  Clock,
  AlertCircle,
  Send,
  FileCheck2,
  ArrowRight,
  Plus,
  RefreshCw,
  Truck,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { usePermission } from "@/hooks/use-permission";
import { PermissionGate } from "@/components/permission-gate";
import { AiActionButton } from "@/components/ai/ai-action-button";
import { OpsExecutionContext } from "@/components/ops/ops-execution-context";
import { FileText } from "lucide-react";

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
    product: { id: string; name: string };
    quantity: number;
  }>;
  responses?: Array<{
    id: string;
    vendor: { name: string };
    totalPrice?: number;
    createdAt: string;
  }>;
}

// ── 운영 상태 파생 ──
function isDelayed(q: Quote): boolean {
  if (!q.deliveryDate) return false;
  if (q.status === "COMPLETED" || q.status === "CANCELLED") return false;
  return new Date(q.deliveryDate) < new Date();
}

const OP_STATUS: Record<string, { label: string; borderClass: string }> = {
  지연:       { label: "지연",           borderClass: "border-l-red-500" },
  비교_검토:  { label: "비교 검토 필요", borderClass: "border-l-purple-500" },
  일부_회신:  { label: "일부 회신 도착", borderClass: "border-l-blue-400" },
  회신_대기:  { label: "회신 대기 중",   borderClass: "border-l-amber-400" },
  요청_접수:  { label: "요청 접수",      borderClass: "border-l-slate-600" },
  발주_완료:  { label: "발주 완료",      borderClass: "border-l-emerald-400" },
  취소됨:     { label: "취소됨",         borderClass: "border-l-slate-700" },
};

function getOpStatus(q: Quote) {
  if (isDelayed(q)) return OP_STATUS.지연;
  switch (q.status) {
    case "RESPONDED": return OP_STATUS.비교_검토;
    case "SENT":
      return (q.responses?.length ?? 0) > 0 ? OP_STATUS.일부_회신 : OP_STATUS.회신_대기;
    case "PENDING":   return OP_STATUS.요청_접수;
    case "COMPLETED": return OP_STATUS.발주_완료;
    case "CANCELLED": return OP_STATUS.취소됨;
    default:          return OP_STATUS.요청_접수;
  }
}

function getPriority(q: Quote): number {
  if (isDelayed(q)) return 0;
  return { RESPONDED: 1, SENT: 2, PENDING: 3, COMPLETED: 4, CANCELLED: 5 }[q.status] ?? 9;
}

// ── Primary CTA label based on status ──
function getPrimaryCta(q: Quote): { label: string; variant: "default" | "outline" } {
  if (q.status === "RESPONDED") return { label: "비교표 보기", variant: "default" };
  if (q.status === "PENDING") return { label: "발송하기", variant: "default" };
  if (q.status === "SENT" && (q.responses?.length ?? 0) > 0) return { label: "회신 확인", variant: "outline" };
  if (q.status === "COMPLETED") return { label: "구매 요청", variant: "default" };
  return { label: "상세보기", variant: "outline" };
}

// ── Quote Row ──
function QuoteRow({ quote }: { quote: Quote }) {
  const opStatus = getOpStatus(quote);
  const itemCount = quote.items.length;
  const responseCount = quote.responses?.length ?? 0;
  const prices = (quote.responses ?? []).map((r) => r.totalPrice).filter((p): p is number => typeof p === "number" && p > 0);
  const minPrice = prices.length ? Math.min(...prices) : null;
  const maxPrice = prices.length ? Math.max(...prices) : null;
  const delayed = isDelayed(quote);
  const quoteRef = `#${quote.id.slice(0, 8).toUpperCase()}`;
  const cta = getPrimaryCta(quote);
  const ctaHref = quote.status === "COMPLETED"
    ? `/dashboard/purchases?quoteId=${quote.id}`
    : `/quotes/${quote.id}`;

  const ageDays = Math.floor((Date.now() - new Date(quote.createdAt).getTime()) / 86400000);

  return (
    <div className={`flex items-center gap-3 px-3 py-2 border-b border-l-[3px] hover:bg-muted/30 transition-colors ${opStatus.borderClass}`}>
      {/* Title + status + meta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <Link href={`/quotes/${quote.id}`} className="text-sm font-medium text-foreground truncate hover:underline underline-offset-2">
            {quote.title}
          </Link>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 flex-shrink-0">
            {opStatus.label}
          </Badge>
          {delayed && (
            <span className="text-[10px] font-medium text-red-400 flex-shrink-0">마감 초과</span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
          <span className="font-mono">{quoteRef}</span>
          <span>{itemCount}개 품목</span>
          {responseCount > 0 && <span className="text-blue-400 font-medium">회신 {responseCount}건</span>}
          {minPrice !== null && (
            <span className="font-medium text-foreground">
              {minPrice === maxPrice ? `₩${minPrice.toLocaleString()}` : `₩${minPrice.toLocaleString()} ~ ₩${maxPrice!.toLocaleString()}`}
            </span>
          )}
        </div>
      </div>

      {/* Age */}
      <span className={`text-xs tabular-nums flex-shrink-0 whitespace-nowrap ${delayed ? "text-red-400 font-medium" : "text-muted-foreground"}`}>
        {ageDays === 0 ? "오늘" : `${ageDays}일`}
      </span>

      {/* Primary CTA */}
      <Link href={ctaHref} className="flex-shrink-0">
        <Button size="sm" variant={cta.variant} className="h-6 text-[11px] px-2.5">
          {cta.label}
        </Button>
      </Link>
    </div>
  );
}

// ── Section Header ──
function SectionHeader({ icon, title, count }: { icon: React.ReactNode; title: string; count: number }) {
  return (
    <div className="flex items-center gap-2 border-b pb-2">
      {icon}
      <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</h2>
      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{count}</Badge>
    </div>
  );
}

function QuotesPageContent() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(
    searchParams.get("status") ?? "all"
  );

  useEffect(() => {
    const s = searchParams.get("status");
    if (s) setStatusFilter(s);
  }, [searchParams]);

  const entityIdParam = searchParams.get("entity_id");
  useEffect(() => {
    if (entityIdParam) {
      const el = document.getElementById("ops-execution-context");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [entityIdParam]);

  const { data: quotesData, isLoading } = useQuery({
    queryKey: ["quotes", statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all" && statusFilter !== "DEADLINE_TODAY") params.append("status", statusFilter);
      const response = await fetch(`/api/quotes?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch quotes");
      return response.json();
    },
    enabled: status === "authenticated",
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  if (status === "loading") {
    return (
      <div className="p-4 md:p-8 space-y-4 max-w-7xl mx-auto">
        <div className="h-5 w-48 bg-muted rounded animate-pulse" />
        <div className="h-10 bg-muted rounded-md animate-pulse" />
        <div className="space-y-2">
          {[0, 1, 2].map((i) => <div key={i} className="h-12 bg-muted rounded-md animate-pulse" />)}
        </div>
      </div>
    );
  }

  const quotes: Quote[] = quotesData?.quotes || [];

  const filteredQuotes = quotes
    .filter((quote) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        quote.title.toLowerCase().includes(q) ||
        quote.id.toLowerCase().includes(q) ||
        quote.items.some((item) => item.product.name.toLowerCase().includes(q))
      );
    })
    .filter((quote) => {
      if (statusFilter === "all") return true;
      if (statusFilter === "DEADLINE_TODAY") {
        return quote.deliveryDate && new Date(quote.deliveryDate).toDateString() === new Date().toDateString() && quote.status !== "COMPLETED" && quote.status !== "CANCELLED";
      }
      return quote.status === statusFilter;
    })
    .sort((a, b) => getPriority(a) - getPriority(b));

  const today = new Date().toDateString();
  const summaryStats = {
    pendingResponse: quotes.filter((q) => q.status === "SENT").length,
    needsReview: quotes.filter((q) => q.status === "RESPONDED").length,
    todayDeadline: quotes.filter((q) => q.deliveryDate && new Date(q.deliveryDate).toDateString() === today && q.status !== "COMPLETED" && q.status !== "CANCELLED").length,
    readyToOrder: quotes.filter((q) => q.status === "RESPONDED" && (q.responses?.length ?? 0) > 0).length,
  };

  const urgentQuotes = filteredQuotes.filter((q) => q.status === "RESPONDED" || (q.status === "SENT" && (q.responses?.length ?? 0) > 0) || isDelayed(q));
  const inProgressQuotes = filteredQuotes.filter((q) => !urgentQuotes.includes(q) && q.status !== "COMPLETED" && q.status !== "CANCELLED");
  const completedQuotes = filteredQuotes.filter((q) => q.status === "COMPLETED" || q.status === "CANCELLED");

  return (
    <div className="p-4 md:p-8 pt-4 md:pt-6 space-y-5 max-w-7xl mx-auto w-full">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground">견적 운영 워크큐</h1>
          <p className="text-xs text-muted-foreground mt-0.5 hidden sm:block">처리가 필요한 견적을 우선순위 순으로 확인하세요</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <AiActionButton
            label="견적 요청 초안 만들기"
            icon={FileText}
            generateEndpoint="/api/ai-actions/generate/quote-draft"
            generatePayload={{
              items: quotes?.slice(0, 3).flatMap((q: Quote) =>
                q.items?.map((item) => ({
                  productName: item.product?.name || "품목",
                  quantity: item.quantity || 1,
                })) || []
              ) || [],
            }}
            variant="outline"
            size="sm"
            className="h-8 text-xs hidden sm:flex"
          />
          <PermissionGate permission="quotes.create">
            <Link href="/compare/quote" className="flex-shrink-0">
              <Button size="sm" className="h-8 text-xs gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">새 견적 요청</span>
                <span className="sm:hidden">새 요청</span>
              </Button>
            </Link>
          </PermissionGate>
        </div>
      </div>

      {/* ── Summary Strip ── */}
      <div className="flex flex-wrap items-center gap-4 border rounded-md px-3 py-1.5">
        <button onClick={() => setStatusFilter(p => p === "SENT" ? "all" : "SENT")} className={`flex items-center gap-1.5 hover:underline underline-offset-2 ${statusFilter === "SENT" ? "font-bold" : ""}`}>
          <span className="text-xs text-muted-foreground">회신 대기</span>
          <span className={`text-sm font-semibold tabular-nums ${summaryStats.pendingResponse > 0 ? "text-amber-400" : "text-foreground"}`}>
            {isLoading ? "—" : summaryStats.pendingResponse}
          </span>
        </button>
        <button onClick={() => setStatusFilter(p => p === "RESPONDED" ? "all" : "RESPONDED")} className={`flex items-center gap-1.5 hover:underline underline-offset-2 ${statusFilter === "RESPONDED" ? "font-bold" : ""}`}>
          <span className="text-xs text-muted-foreground">비교 검토 필요</span>
          <span className={`text-sm font-semibold tabular-nums ${summaryStats.needsReview > 0 ? "text-purple-400" : "text-foreground"}`}>
            {isLoading ? "—" : summaryStats.needsReview}
          </span>
        </button>
        <button onClick={() => setStatusFilter(p => p === "DEADLINE_TODAY" ? "all" : "DEADLINE_TODAY")} className={`flex items-center gap-1.5 hover:underline underline-offset-2 ${statusFilter === "DEADLINE_TODAY" ? "font-bold" : ""}`}>
          <span className="text-xs text-muted-foreground">오늘 마감</span>
          <span className={`text-sm font-semibold tabular-nums ${summaryStats.todayDeadline > 0 ? "text-red-400" : "text-foreground"}`}>
            {isLoading ? "—" : summaryStats.todayDeadline}
          </span>
        </button>
        <button onClick={() => setStatusFilter(p => p === "RESPONDED" ? "all" : "RESPONDED")} className="flex items-center gap-1.5 hover:underline underline-offset-2">
          <span className="text-xs text-muted-foreground">발주 전환 가능</span>
          <span className={`text-sm font-semibold tabular-nums ${summaryStats.readyToOrder > 0 ? "text-emerald-400" : "text-foreground"}`}>
            {isLoading ? "—" : summaryStats.readyToOrder}
          </span>
        </button>
      </div>

      {/* ── Search + Filter ── */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="견적명 / 품목명 / 요청 번호 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-8 text-sm"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[160px] h-8 text-sm">
            <Filter className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
            <SelectValue placeholder="상태 필터" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 상태</SelectItem>
            <SelectItem value="DEADLINE_TODAY">오늘 마감</SelectItem>
            <SelectItem value="PENDING">요청 접수</SelectItem>
            <SelectItem value="SENT">회신 대기 중</SelectItem>
            <SelectItem value="RESPONDED">비교 검토 필요</SelectItem>
            <SelectItem value="COMPLETED">발주 완료</SelectItem>
            <SelectItem value="CANCELLED">취소됨</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ── Loading ── */}
      {isLoading && (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => <div key={i} className="h-12 bg-muted rounded-md animate-pulse" />)}
        </div>
      )}

      {/* ── Section: Urgent ── */}
      {!isLoading && urgentQuotes.length > 0 && (
        <div className="space-y-0">
          <SectionHeader icon={<AlertCircle className="h-3.5 w-3.5 text-red-500" />} title="즉시 처리 필요" count={urgentQuotes.length} />
          <div className="bg-card border border-t-0 rounded-b-md">
            {urgentQuotes.map((quote) => <QuoteRow key={quote.id} quote={quote} />)}
          </div>
        </div>
      )}

      {/* ── Section: In Progress ── */}
      {!isLoading && inProgressQuotes.length > 0 && (
        <div className="space-y-0">
          <SectionHeader icon={<Clock className="h-3.5 w-3.5 text-amber-500" />} title="진행 중" count={inProgressQuotes.length} />
          <div className="bg-card border border-t-0 rounded-b-md">
            {inProgressQuotes.map((quote) => <QuoteRow key={quote.id} quote={quote} />)}
          </div>
        </div>
      )}

      {/* ── Section: Completed ── */}
      {!isLoading && completedQuotes.length > 0 && (
        <details className="group">
          <summary className="flex items-center gap-2 cursor-pointer list-none select-none border-b pb-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">완료 / 취소</span>
            <span className="text-xs text-muted-foreground">({completedQuotes.length}건)</span>
            <ChevronRight className="h-3 w-3 text-muted-foreground ml-auto group-open:rotate-90 transition-transform" />
          </summary>
          <div className="bg-card border border-t-0 rounded-b-md mt-0">
            {completedQuotes.map((quote) => <QuoteRow key={quote.id} quote={quote} />)}
          </div>
        </details>
      )}

      {/* ── Empty State ── */}
      {!isLoading && filteredQuotes.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
          <ShoppingCart className="h-8 w-8 opacity-25" />
          <p className="text-sm">
            {searchQuery || statusFilter !== "all" ? "조건에 맞는 견적이 없습니다" : "아직 견적 요청이 없습니다"}
          </p>
          {!searchQuery && statusFilter === "all" && (
            <Link href="/compare/quote">
              <Button size="sm" className="mt-1 h-7 text-xs">첫 견적 요청하기</Button>
            </Link>
          )}
          {(searchQuery || statusFilter !== "all") && (
            <button onClick={() => { setSearchQuery(""); setStatusFilter("all"); }} className="text-xs text-blue-400 hover:underline">
              필터 초기화
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function QuotesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      }
    >
      <QuotesPageContent />
    </Suspense>
  );
}
