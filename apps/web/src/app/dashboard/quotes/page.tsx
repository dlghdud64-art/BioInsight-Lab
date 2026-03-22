"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Search, Clock, AlertCircle, Send, FileCheck2, ArrowRight, Plus, RefreshCw,
  Package, X, FileText, ChevronRight, AlertTriangle, CheckCircle2, Pause,
  RotateCcw, GitCompare, ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { PermissionGate } from "@/components/permission-gate";
import { deriveStage, getStageInfo, type ProcurementStage } from "@/lib/procurement-stage";

type QuoteStatus = "PENDING" | "SENT" | "RESPONDED" | "COMPLETED" | "CANCELLED";

interface Quote {
  id: string;
  title: string;
  status: QuoteStatus;
  createdAt: string;
  deliveryDate?: string;
  deliveryLocation?: string;
  items: Array<{ id: string; product: { id: string; name: string }; quantity: number }>;
  responses?: Array<{ id: string; vendor: { name: string }; totalPrice?: number; createdAt: string }>;
  vendorRequests?: Array<{ id: string; status: string }>;
}

function isDelayed(q: Quote): boolean {
  if (!q.deliveryDate || q.status === "COMPLETED" || q.status === "CANCELLED") return false;
  return new Date(q.deliveryDate) < new Date();
}

function getQuoteStage(q: Quote): ProcurementStage {
  const totalVR = q.vendorRequests?.length ?? 0;
  const respondedVR = q.vendorRequests?.filter(vr => vr.status === "RESPONDED").length ?? 0;
  return deriveStage(q.status, totalVR, respondedVR, isDelayed(q));
}

// Stage filter tabs
const STAGE_TABS: { value: string; label: string; stages: ProcurementStage[] }[] = [
  { value: "all",             label: "전체",       stages: [] },
  { value: "waiting",         label: "응답 대기",  stages: ["quote_queue", "quote_waiting"] },
  { value: "partial",         label: "부분 응답",  stages: ["quote_partial"] },
  { value: "review",          label: "비교 필요",  stages: ["quote_received", "quote_compare_review"] },
  { value: "approval_ready",  label: "승인 준비",  stages: ["approval_ready"] },
  { value: "blocked",         label: "차단",       stages: ["blocked"] },
  { value: "hold",            label: "보류",       stages: ["hold"] },
];

function QuotesPageContent() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<string>(searchParams.get("stage") ?? "all");
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);

  useEffect(() => {
    const s = searchParams.get("stage");
    if (s) setStageFilter(s);
  }, [searchParams]);

  const { data: quotesData, isLoading } = useQuery({
    queryKey: ["quotes"],
    queryFn: async () => {
      const response = await fetch("/api/quotes");
      if (!response.ok) throw new Error("Failed to fetch quotes");
      return response.json();
    },
    enabled: status === "authenticated",
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  const quotes: Quote[] = quotesData?.quotes || [];

  // Add stage to each quote
  const quotesWithStage = useMemo(() =>
    quotes.map(q => ({ ...q, _stage: getQuoteStage(q), _stageInfo: getStageInfo(getQuoteStage(q)) })),
    [quotes],
  );

  // Stage counts for tabs
  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const tab of STAGE_TABS) {
      if (tab.value === "all") { counts.all = quotesWithStage.length; continue; }
      counts[tab.value] = quotesWithStage.filter(q => tab.stages.includes(q._stage)).length;
    }
    return counts;
  }, [quotesWithStage]);

  // Filter + search
  const filteredQuotes = useMemo(() => {
    let result = quotesWithStage;
    // Stage filter
    if (stageFilter !== "all") {
      const tab = STAGE_TABS.find(t => t.value === stageFilter);
      if (tab) result = result.filter(q => tab.stages.includes(q._stage));
    }
    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(quote =>
        quote.title.toLowerCase().includes(q) ||
        quote.id.toLowerCase().includes(q) ||
        quote.items.some(item => item.product.name.toLowerCase().includes(q)),
      );
    }
    // Sort by priority
    return result.sort((a, b) => a._stageInfo.priority - b._stageInfo.priority);
  }, [quotesWithStage, stageFilter, searchQuery]);

  const selectedQuote = quotesWithStage.find(q => q.id === selectedQuoteId);

  // Summary KPIs
  const kpis = useMemo(() => ({
    waiting: stageCounts.waiting ?? 0,
    review: stageCounts.review ?? 0 + (stageCounts.partial ?? 0),
    approvalReady: stageCounts.approval_ready ?? 0,
    blocked: stageCounts.blocked ?? 0,
    total: quotesWithStage.length,
  }), [stageCounts, quotesWithStage]);

  if (status === "loading" || isLoading) {
    return (
      <div className="fixed inset-0 z-[55] flex items-center justify-center" style={{ backgroundColor: '#303236' }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[55] flex flex-col overflow-hidden" style={{ backgroundColor: '#303236' }}>

      {/* ═══ Task Mode Chrome ═══ */}
      <div className="shrink-0 flex items-center justify-between px-4 md:px-6 py-2.5 border-b border-bd" style={{ backgroundColor: '#434548' }}>
        <div className="flex items-center gap-2">
          <Link href="/" className="shrink-0">
            <span className="text-sm md:text-lg font-bold text-slate-200 tracking-tight">LabAxis</span>
          </Link>
          <div className="w-px h-5 bg-bd" />
          <span className="text-xs md:text-sm font-medium text-slate-400">견적관리 워크큐</span>
        </div>
        <div className="flex items-center gap-3">
          {/* KPI pills */}
          <div className="hidden md:flex items-center gap-2">
            <span className="text-[10px] text-amber-400">{kpis.waiting} 대기</span>
            <span className="text-slate-600">·</span>
            <span className="text-[10px] text-purple-400">{kpis.review} 비교</span>
            <span className="text-slate-600">·</span>
            <span className="text-[10px] text-emerald-400">{kpis.approvalReady} 승인</span>
            {kpis.blocked > 0 && <><span className="text-slate-600">·</span><span className="text-[10px] text-red-400">{kpis.blocked} 차단</span></>}
          </div>
          <PermissionGate permission="quotes.create">
            <Link href="/test/search">
              <Button size="sm" className="h-8 text-xs gap-1.5 bg-blue-600 hover:bg-blue-500">
                <Plus className="h-3.5 w-3.5" />새 요청
              </Button>
            </Link>
          </PermissionGate>
        </div>
      </div>

      {/* ═══ Filter Utility Bar ═══ */}
      <div className="shrink-0 px-4 md:px-6 py-2 border-b border-bd flex items-center gap-2 overflow-x-auto" style={{ backgroundColor: '#353739' }}>
        {STAGE_TABS.map(tab => {
          const count = stageCounts[tab.value] ?? 0;
          const isActive = stageFilter === tab.value;
          return (
            <button key={tab.value} onClick={() => setStageFilter(isActive ? "all" : tab.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all border ${
                isActive ? "bg-blue-600/10 text-blue-300 border-blue-600/30" : "text-slate-400 border-transparent hover:bg-el hover:border-bd"
              }`}>
              {tab.label}
              <Badge variant="secondary" className={`h-4 min-w-4 px-1 text-[9px] ${isActive ? "bg-blue-600/20 text-blue-300" : "bg-pn text-slate-500"}`}>{count}</Badge>
            </button>
          );
        })}
        <div className="flex-1" />
        <div className="relative shrink-0 w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-500" />
          <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="검색..."
            className="h-7 pl-7 text-[11px] bg-pn border-bd" />
        </div>
      </div>

      {/* ═══ Main: Queue List + Ops Rail ═══ */}
      <div className="flex-1 overflow-hidden flex">

        {/* Queue List */}
        <div className="flex-1 overflow-y-auto">
          {filteredQuotes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
              <Package className="h-8 w-8 opacity-30" />
              <p className="text-sm">{searchQuery || stageFilter !== "all" ? "조건에 맞는 견적이 없습니다" : "아직 견적 요청이 없습니다"}</p>
              {stageFilter !== "all" && (
                <button onClick={() => setStageFilter("all")} className="text-xs text-blue-400 hover:underline">필터 초기화</button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-bd/50">
              {filteredQuotes.map(quote => {
                const si = quote._stageInfo;
                const isSelected = selectedQuoteId === quote.id;
                const responseCount = quote.responses?.length ?? 0;
                const prices = (quote.responses ?? []).map(r => r.totalPrice).filter((p): p is number => typeof p === "number" && p > 0);
                const minPrice = prices.length ? Math.min(...prices) : null;
                const ref = `#${quote.id.slice(0, 8).toUpperCase()}`;
                const delayed = isDelayed(quote);

                return (
                  <button key={quote.id} onClick={() => setSelectedQuoteId(quote.id)}
                    className={`w-full text-left px-4 md:px-6 py-3 transition-all ${
                      isSelected ? "bg-blue-600/5 border-l-2 border-l-blue-500" : "hover:bg-el border-l-2 border-l-transparent"
                    }`}>
                    {/* Line 1: identity + stage + amount */}
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border font-medium ${si.bgColor} ${si.color} ${si.borderColor}`}>
                        {si.label}
                      </span>
                      {delayed && <span className="text-[9px] px-1 py-0.5 rounded bg-red-600/10 text-red-400 border border-red-600/20">지연</span>}
                      <span className="text-[10px] text-slate-500 font-mono">{ref}</span>
                      <span className="flex-1" />
                      {minPrice !== null && <span className="text-xs font-semibold tabular-nums text-slate-100">₩{minPrice.toLocaleString("ko-KR")}</span>}
                      <ChevronRight className={`h-3.5 w-3.5 ${isSelected ? "text-blue-400" : "text-slate-600"}`} />
                    </div>
                    {/* Line 2: title + meta */}
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium text-slate-100 truncate flex-1">{quote.title}</span>
                      <span className="text-[10px] text-slate-500 shrink-0">{quote.items.length}건</span>
                      <span className="text-[10px] text-slate-500 shrink-0">{responseCount > 0 ? `회신 ${responseCount}` : "미회신"}</span>
                    </div>
                    {/* Line 3: next action + time */}
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] ${si.color}`}>다음: {si.nextAction}</span>
                      <span className="flex-1" />
                      <span className="text-[10px] text-slate-500">{new Date(quote.createdAt).toLocaleDateString("ko-KR")}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ═══ Quote Ops Rail (400px, sticky) ═══ */}
        <div className="hidden lg:flex w-[400px] shrink-0 border-l border-bd flex-col overflow-hidden" style={{ backgroundColor: '#353739' }}>
          {selectedQuote ? (
            <>
              {/* Rail header */}
              <div className="px-5 py-4 border-b border-bd" style={{ backgroundColor: '#434548' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border font-medium ${selectedQuote._stageInfo.bgColor} ${selectedQuote._stageInfo.color} ${selectedQuote._stageInfo.borderColor}`}>
                    {selectedQuote._stageInfo.label}
                  </span>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-slate-500 hover:text-slate-300" onClick={() => setSelectedQuoteId(null)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <h3 className="text-sm font-semibold text-slate-100 leading-tight line-clamp-2 mb-1">{selectedQuote.title}</h3>
                <div className="flex items-center gap-2 text-[10px] text-slate-400">
                  <span>{selectedQuote.items.length}건</span>
                  <span className="text-slate-600">·</span>
                  <span>{selectedQuote.responses?.length ?? 0}회신</span>
                  <span className="text-slate-600">·</span>
                  <span>{new Date(selectedQuote.createdAt).toLocaleDateString("ko-KR")}</span>
                </div>
                {(() => {
                  const prices = (selectedQuote.responses ?? []).map(r => r.totalPrice).filter((p): p is number => typeof p === "number" && p > 0);
                  const minP = prices.length ? Math.min(...prices) : null;
                  return minP !== null ? (
                    <p className="text-lg font-bold tabular-nums text-slate-100 mt-2">₩{minP.toLocaleString("ko-KR")}</p>
                  ) : null;
                })()}
              </div>

              {/* Rail body — scrollable */}
              <div className="flex-1 overflow-y-auto">
                {/* Next action */}
                <div className="px-5 py-3 border-b border-bd/50">
                  <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-1.5">다음 액션</div>
                  <p className={`text-xs font-medium ${selectedQuote._stageInfo.color}`}>{selectedQuote._stageInfo.nextAction}</p>
                </div>

                {/* Items compact list */}
                <div className="px-5 py-3 border-b border-bd/50">
                  <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-1.5">품목 ({selectedQuote.items.length}건)</div>
                  <div className="space-y-1">
                    {selectedQuote.items.slice(0, 5).map(item => (
                      <div key={item.id} className="flex items-center justify-between text-xs">
                        <span className="text-slate-300 truncate max-w-[220px]">{item.product.name}</span>
                        <span className="text-slate-500 tabular-nums shrink-0">×{item.quantity}</span>
                      </div>
                    ))}
                    {selectedQuote.items.length > 5 && <p className="text-[10px] text-slate-500">+{selectedQuote.items.length - 5}건 더</p>}
                  </div>
                </div>

                {/* Responses */}
                {(selectedQuote.responses?.length ?? 0) > 0 && (
                  <div className="px-5 py-3 border-b border-bd/50">
                    <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-1.5">공급사 응답</div>
                    <div className="space-y-1.5">
                      {selectedQuote.responses!.map(r => (
                        <div key={r.id} className="flex items-center justify-between text-xs">
                          <span className="text-slate-300">{r.vendor.name}</span>
                          <span className="text-slate-200 tabular-nums font-medium">
                            {r.totalPrice ? `₩${r.totalPrice.toLocaleString("ko-KR")}` : "금액 미정"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Vendor requests status */}
                {(selectedQuote.vendorRequests?.length ?? 0) > 0 && (
                  <div className="px-5 py-3 border-b border-bd/50">
                    <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-1.5">요청 상태</div>
                    <div className="space-y-1">
                      {selectedQuote.vendorRequests!.map(vr => (
                        <div key={vr.id} className="flex items-center justify-between text-xs">
                          <span className="text-slate-400 font-mono text-[10px]">#{vr.id.slice(0, 6)}</span>
                          <span className={vr.status === "RESPONDED" ? "text-emerald-400" : vr.status === "SENT" ? "text-amber-400" : "text-slate-500"}>
                            {vr.status === "RESPONDED" ? "응답 완료" : vr.status === "SENT" ? "발송됨" : vr.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Delivery info */}
                {selectedQuote.deliveryDate && (
                  <div className="px-5 py-3 border-b border-bd/50">
                    <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-1.5">납기</div>
                    <p className={`text-xs ${isDelayed(selectedQuote) ? "text-red-400 font-semibold" : "text-slate-300"}`}>
                      {new Date(selectedQuote.deliveryDate).toLocaleDateString("ko-KR")}
                      {isDelayed(selectedQuote) && " — 마감 초과"}
                    </p>
                  </div>
                )}
              </div>

              {/* Rail footer — actions */}
              <div className="px-5 py-3 border-t border-bd space-y-2 shrink-0" style={{ backgroundColor: '#434548' }}>
                <Link href={`/quotes/${selectedQuote.id}`} className="block">
                  <Button size="sm" className="w-full h-8 text-xs bg-blue-600 hover:bg-blue-500 text-white">
                    {selectedQuote._stage === "quote_compare_review" || selectedQuote._stage === "quote_received" ? "비교 검토 열기" : "검토 열기"}
                    <ArrowRight className="h-3 w-3 ml-1.5" />
                  </Button>
                </Link>
                <div className="flex gap-2">
                  {selectedQuote._stage === "approval_ready" && (
                    <Button size="sm" variant="outline" className="flex-1 h-7 text-[10px] text-emerald-400 border-emerald-600/30 hover:bg-emerald-600/10">
                      <CheckCircle2 className="h-3 w-3 mr-1" />승인으로 넘기기
                    </Button>
                  )}
                  {(selectedQuote._stage === "quote_waiting" || selectedQuote._stage === "quote_partial") && (
                    <Button size="sm" variant="outline" className="flex-1 h-7 text-[10px] text-amber-400 border-amber-600/30 hover:bg-amber-600/10">
                      <RotateCcw className="h-3 w-3 mr-1" />재요청
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="flex-1 h-7 text-[10px] text-slate-400 border-bd">
                    <Pause className="h-3 w-3 mr-1" />보류
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
              <div className="w-10 h-10 rounded-lg bg-el border border-bd flex items-center justify-center mb-3">
                <FileText className="h-5 w-5 text-slate-600" />
              </div>
              <p className="text-xs text-slate-400 mb-1">견적을 선택하세요</p>
              <p className="text-[10px] text-slate-500">행을 클릭하면 상세 정보와<br />다음 액션을 확인할 수 있습니다</p>
            </div>
          )}
        </div>
      </div>

      {/* ═══ Sticky Action Dock ═══ */}
      <div className="shrink-0 border-t-2 border-bd px-4 md:px-6 py-2.5" style={{ backgroundColor: '#434548' }}>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Stage counts */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500">{kpis.total}건</span>
            <span className="text-slate-600">·</span>
            <span className="text-[10px] text-amber-400">{kpis.waiting} 대기</span>
            <span className="text-[10px] text-purple-400">{kpis.review} 비교</span>
            <span className="text-[10px] text-emerald-400">{kpis.approvalReady} 승인</span>
            {kpis.blocked > 0 && <span className="text-[10px] text-red-400">{kpis.blocked} 차단</span>}
          </div>
          <div className="flex-1" />
          {/* Quick filters */}
          <Button size="sm" variant="ghost" className="h-7 px-2.5 text-[10px] text-purple-400 hover:bg-purple-600/10"
            onClick={() => setStageFilter(stageFilter === "review" ? "all" : "review")}>
            <GitCompare className="h-3 w-3 mr-1" />비교 필요만
          </Button>
          <Button size="sm" variant="ghost" className="h-7 px-2.5 text-[10px] text-amber-400 hover:bg-amber-600/10"
            onClick={() => setStageFilter(stageFilter === "waiting" ? "all" : "waiting")}>
            <Clock className="h-3 w-3 mr-1" />대기만
          </Button>
          {kpis.approvalReady > 0 && (
            <Button size="sm" className="h-7 px-3 text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white"
              onClick={() => setStageFilter("approval_ready")}>
              <CheckCircle2 className="h-3 w-3 mr-1" />승인 준비 {kpis.approvalReady}건
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function QuotesPage() {
  return (
    <Suspense fallback={
      <div className="fixed inset-0 z-[55] flex items-center justify-center" style={{ backgroundColor: '#303236' }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    }>
      <QuotesPageContent />
    </Suspense>
  );
}
