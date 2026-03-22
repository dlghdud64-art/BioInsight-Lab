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
} from "lucide-react";
import Link from "next/link";
import { usePermission } from "@/hooks/use-permission";
import { PermissionGate } from "@/components/permission-gate";
import { AiActionButton } from "@/components/ai/ai-action-button";
import { OpsExecutionContext } from "@/components/ops/ops-execution-context";
import { FileText } from "lucide-react";
import { deriveStage, getStageInfo, QUOTE_QUEUE_STAGES, type ProcurementStage } from "@/lib/procurement-stage";

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
  vendorRequests?: Array<{
    id: string;
    status: string;
  }>;
}

// ── 운영 상태 파생 (procurement-stage 기반) ──
function isDelayed(q: Quote): boolean {
  if (!q.deliveryDate) return false;
  if (q.status === "COMPLETED" || q.status === "CANCELLED") return false;
  return new Date(q.deliveryDate) < new Date();
}

function getQuoteStage(q: Quote): ProcurementStage {
  const totalVR = q.vendorRequests?.length ?? 0;
  const respondedVR = q.vendorRequests?.filter(vr => vr.status === "RESPONDED").length ?? 0;
  return deriveStage(q.status, totalVR, respondedVR, isDelayed(q));
}

function getOpStatus(q: Quote) {
  if (isDelayed(q)) {
    return { label: "지연", bg: "bg-red-600/10", text: "text-red-400", border: "border-red-600/30" };
  }
  const stageInfo = getStageInfo(getQuoteStage(q));
  return { label: stageInfo.label, bg: stageInfo.bgColor, text: stageInfo.color, border: stageInfo.borderColor };
}

function getPriority(q: Quote): number {
  if (isDelayed(q)) return 0;
  const stageInfo = getStageInfo(getQuoteStage(q));
  return stageInfo.priority;
}

// ── 견적 카드 ──────────────────────────────────────────────
function QuoteCard({ quote }: { quote: Quote }) {
  const opStatus = getOpStatus(quote);
  const itemCount = quote.items.length;
  const responseCount = quote.responses?.length ?? 0;
  const prices = (quote.responses ?? [])
    .map((r) => r.totalPrice)
    .filter((p): p is number => typeof p === "number" && p > 0);
  const minPrice = prices.length ? Math.min(...prices) : null;
  const maxPrice = prices.length ? Math.max(...prices) : null;
  const delayed = isDelayed(quote);
  const quoteRef = `#${quote.id.slice(0, 8).toUpperCase()}`;

  return (
    <div className={`bg-pn rounded-xl border transition-colors p-4 ${delayed ? "border-red-600/30" : "border-bd hover:border-bd/80"}`}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          {/* 상태 뱃지 + 참조번호 */}
          <div className="flex items-center gap-2 mb-1.5">
            <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${opStatus.bg} ${opStatus.text} ${opStatus.border}`}>
              {opStatus.label}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">{quoteRef}</span>
            {delayed && (
              <span className="text-[10px] font-semibold text-red-400 flex items-center gap-0.5">
                <AlertCircle className="h-3 w-3" /> 마감 초과
              </span>
            )}
          </div>

          {/* 제목 */}
          <h3 className="font-semibold text-slate-100 text-sm leading-snug truncate mb-2">{quote.title}</h3>

          {/* 메타 정보 */}
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <Package className="h-3 w-3" />
              {itemCount}개 품목
            </span>
            <span className={`text-xs flex items-center gap-1 ${responseCount > 0 ? "text-blue-400 font-medium" : "text-slate-500"}`}>
              <Send className="h-3 w-3" />
              {responseCount > 0 ? `회신 ${responseCount}건` : "회신 없음"}
            </span>
            {minPrice !== null && (
              <span className="text-xs text-slate-200 font-medium flex items-center gap-1">
                <Truck className="h-3 w-3 text-slate-400" />
                {minPrice === maxPrice
                  ? `₩${minPrice.toLocaleString()}`
                  : `₩${minPrice.toLocaleString()} ~ ₩${maxPrice!.toLocaleString()}`}
              </span>
            )}
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {new Date(quote.createdAt).toLocaleDateString("ko-KR")}
            </span>
            {quote.deliveryDate && (
              <span className={`text-xs flex items-center gap-1 ${delayed ? "text-red-400 font-semibold" : "text-slate-500"}`}>
                <Clock className="h-3 w-3" />
                납기 {new Date(quote.deliveryDate).toLocaleDateString("ko-KR")}
              </span>
            )}
          </div>
        </div>

        {/* 빠른 액션 */}
        <div className="flex flex-col gap-1.5 flex-shrink-0 min-w-[88px]">
          <Link href={`/quotes/${quote.id}`}>
            <Button
              size="sm"
              variant={quote.status === "RESPONDED" ? "default" : "outline"}
              className={`h-7 text-xs w-full ${quote.status === "RESPONDED" ? "bg-blue-600 hover:bg-blue-700 text-white" : ""}`}
            >
              {quote.status === "RESPONDED" ? "비교표 보기" : "상세보기"}
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </Link>
          {quote.status === "PENDING" && (
            <Link href={`/quotes/${quote.id}`}>
              <Button size="sm" className="h-7 text-xs w-full bg-amber-500 hover:bg-amber-600 text-white">
                발송하기
              </Button>
            </Link>
          )}
          {quote.status === "RESPONDED" && (
            <Link href={`/quotes/${quote.id}`}>
              <Button size="sm" variant="outline" className="h-7 text-xs w-full border-emerald-600/30 text-emerald-400 hover:bg-emerald-600/10">
                발주 전환
              </Button>
            </Link>
          )}
          {quote.status === "SENT" && responseCount > 0 && (
            <Link href={`/quotes/${quote.id}`}>
              <Button size="sm" variant="outline" className="h-7 text-xs w-full text-slate-400 border-bd hover:bg-el">
                회신 확인
              </Button>
            </Link>
          )}
          {quote.status === "COMPLETED" && (
            <Link href={`/dashboard/purchases?quoteId=${quote.id}`}>
              <Button size="sm" className="h-7 text-xs w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                <ShoppingCart className="h-3 w-3 mr-1" />
                구매 요청
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* 운영 실행 현황 */}
      <OpsExecutionContext
        entityType="QUOTE"
        entityId={quote.id}
        compact
        className="mt-3 pt-3 border-t border-bd"
      />
    </div>
  );
}

function QuotesPageContent() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  // URL ?status= 파라미터가 있으면 초기 필터로 세팅 (대시보드 카드 원클릭 진입)
  const [statusFilter, setStatusFilter] = useState<string>(
    searchParams.get("status") ?? "all"
  );
  const [sortBy, setSortBy] = useState<string>("newest");

  // URL 파라미터 변경 시 필터 동기화 (뒤로가기 후 재진입 등)
  useEffect(() => {
    const s = searchParams.get("status");
    if (s) setStatusFilter(s);
  }, [searchParams]);

  // Deep-link: work_item + entity_id → 해당 견적으로 스크롤
  const entityIdParam = searchParams.get("entity_id");
  useEffect(() => {
    if (entityIdParam) {
      const el = document.getElementById("ops-execution-context");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [entityIdParam]);

  // 견적 목록 조회
  // staleTime: 0 - 항상 최신 상태 확인 (견적 상태 변경 후 목록 복귀 시 즉시 반영)
  // refetchOnMount: "always" - 페이지 재방문 시 항상 재요청 (Next.js 라우터 캐시 우회)
  const { data: quotesData, isLoading } = useQuery({
    queryKey: ["quotes", statusFilter, sortBy],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all" && statusFilter !== "DEADLINE_TODAY") params.append("status", statusFilter);
      if (sortBy) params.append("sortBy", sortBy);
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
        <div className="h-8 w-48 bg-el rounded animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[0,1,2,3].map((i) => <div key={i} className="h-24 bg-el rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  const quotes: Quote[] = quotesData?.quotes || [];

  // 검색 필터링
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

  // 운영 요약 카운트 — stage 기반
  const today = new Date().toDateString();
  const quotesWithStage = quotes.map((q) => ({ ...q, _stage: getQuoteStage(q) }));
  const summaryStats = {
    pendingResponse: quotesWithStage.filter((q) => q._stage === "quote_waiting" || q._stage === "quote_queue").length,
    needsReview:     quotesWithStage.filter((q) => q._stage === "quote_compare_review" || q._stage === "quote_received" || q._stage === "quote_partial").length,
    todayDeadline:   quotes.filter((q) => q.deliveryDate && new Date(q.deliveryDate).toDateString() === today && q.status !== "COMPLETED" && q.status !== "CANCELLED").length,
    readyToOrder:    quotesWithStage.filter((q) => q._stage === "approval_ready").length,
  };

  // 섹션 분류 (stage 기반)
  const urgentQuotes     = filteredQuotes.filter((q) => {
    const s = getQuoteStage(q);
    return s === "quote_compare_review" || s === "quote_received" || s === "quote_partial" || isDelayed(q);
  });
  const inProgressQuotes = filteredQuotes.filter((q) => {
    const s = getQuoteStage(q);
    return !urgentQuotes.includes(q) && s !== "po_created" && s !== "cancelled";
  });
  const completedQuotes  = filteredQuotes.filter((q) => {
    const s = getQuoteStage(q);
    return s === "po_created" || s === "cancelled";
  });

  return (
    <div className="p-4 md:p-8 pt-4 md:pt-6 space-y-5 max-w-7xl mx-auto w-full">

      {/* ── 헤더 ── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-100">견적 운영 워크큐</h1>
          <p className="text-sm text-slate-500 mt-0.5 hidden sm:block">처리가 필요한 견적을 우선순위 순으로 확인하세요</p>
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
            className="h-9 text-sm hidden sm:flex"
          />
          <PermissionGate permission="quotes.create">
            <Link href="/compare/quote" className="flex-shrink-0">
              <Button size="sm" className="h-9 text-sm gap-1.5 bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">새 견적 요청</span>
                <span className="sm:hidden">새 요청</span>
              </Button>
            </Link>
          </PermissionGate>
        </div>
      </div>

      {/* ── 운영 요약 스트립 ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "회신 대기",       count: summaryStats.pendingResponse, icon: <Clock className="h-4 w-4 text-amber-400" />,      filter: "SENT",           hover: "hover:border-amber-600/30",   active: "border-amber-600/40 bg-amber-600/10 ring-1 ring-amber-600/20" },
          { label: "비교 검토 필요",  count: summaryStats.needsReview,     icon: <RefreshCw className="h-4 w-4 text-purple-400" />,  filter: "RESPONDED",      hover: "hover:border-purple-600/30",  active: "border-purple-600/40 bg-purple-600/10 ring-1 ring-purple-600/20" },
          { label: "오늘 마감",       count: summaryStats.todayDeadline,   icon: <AlertCircle className="h-4 w-4 text-red-400" />,   filter: "DEADLINE_TODAY", hover: "hover:border-red-600/30",     active: "border-red-600/40 bg-red-600/10 ring-1 ring-red-600/20" },
          { label: "발주 전환 가능",  count: summaryStats.readyToOrder,    icon: <FileCheck2 className="h-4 w-4 text-emerald-400" />, filter: "RESPONDED",      hover: "hover:border-emerald-600/30", active: "border-emerald-600/40 bg-emerald-600/10 ring-1 ring-emerald-600/20" },
        ].map(({ label, count, icon, filter, hover, active }) => {
          const isActive = statusFilter === filter;
          return (
          <button
            key={label}
            onClick={() => setStatusFilter(prev => prev === filter ? "all" : filter)}
            className={`text-left rounded-xl border bg-pn p-4 shadow-sm transition-all cursor-pointer ${hover} ${isActive ? active : ""}`}
          >
            <div className="flex items-center gap-2 mb-1">
              {icon}
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider truncate">{label}</span>
            </div>
            <div className="text-2xl font-bold text-slate-100">{isLoading ? "—" : count}</div>
          </button>
          );
        })}
      </div>

      {/* ── 검색 + 필터 ── */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input
            placeholder="견적명 / 품목명 / 요청 번호 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[160px] h-9 text-sm">
            <Filter className="h-3.5 w-3.5 mr-2 text-slate-400" />
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

      {/* ── 로딩 스켈레톤 ── */}
      {isLoading && (
        <div className="space-y-2">
          {[0,1,2].map((i) => (
            <div key={i} className="h-28 bg-el rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {/* ── 섹션: 즉시 처리 필요 ── */}
      {!isLoading && urgentQuotes.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <h2 className="text-sm font-semibold text-slate-200">즉시 처리 필요</h2>
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-600/15 text-red-400 text-[10px] font-bold">{urgentQuotes.length}</span>
          </div>
          {urgentQuotes.map((quote) => <QuoteCard key={quote.id} quote={quote} />)}
        </div>
      )}

      {/* ── 섹션: 진행 중 ── */}
      {!isLoading && inProgressQuotes.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-500" />
            <h2 className="text-sm font-semibold text-slate-200">진행 중</h2>
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-600/15 text-amber-400 text-[10px] font-bold">{inProgressQuotes.length}</span>
          </div>
          {inProgressQuotes.map((quote) => <QuoteCard key={quote.id} quote={quote} />)}
        </div>
      )}

      {/* ── 섹션: 완료 (접을 수 있는) ── */}
      {!isLoading && completedQuotes.length > 0 && (
        <details className="group">
          <summary className="flex items-center gap-2 cursor-pointer list-none select-none">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span className="text-sm font-semibold text-slate-200">완료 / 취소</span>
            <span className="text-xs text-slate-400">({completedQuotes.length}건)</span>
            <span className="ml-1 text-xs text-slate-400 group-open:hidden">▶ 펼치기</span>
            <span className="ml-1 text-xs text-slate-400 hidden group-open:inline">▼ 접기</span>
          </summary>
          <div className="mt-2 space-y-2">
            {completedQuotes.map((quote) => <QuoteCard key={quote.id} quote={quote} />)}
          </div>
        </details>
      )}

      {/* ── 빈 상태 ── */}
      {!isLoading && filteredQuotes.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
          <ShoppingCart className="h-10 w-10 opacity-25" />
          <p className="text-sm">
            {searchQuery || statusFilter !== "all" ? "조건에 맞는 견적이 없습니다" : "아직 견적 요청이 없습니다"}
          </p>
          {!searchQuery && statusFilter === "all" && (
            <Link href="/compare/quote">
              <Button size="sm" className="mt-1 h-8 text-xs bg-blue-600 hover:bg-blue-700">
                첫 견적 요청하기
              </Button>
            </Link>
          )}
          {(searchQuery || statusFilter !== "all") && (
            <button onClick={() => { setSearchQuery(""); setStatusFilter("all"); }} className="text-xs text-blue-600 hover:underline">
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
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        </div>
      }
    >
      <QuotesPageContent />
    </Suspense>
  );
}
