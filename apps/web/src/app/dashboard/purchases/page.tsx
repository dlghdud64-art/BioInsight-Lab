"use client";

export const dynamic = 'force-dynamic';

import { useState, useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search, Package, CheckCircle2, Clock, AlertCircle, ArrowRight,
  X, ListChecks, CircleCheck, ChevronRight, FileText,
} from "lucide-react";
import Link from "next/link";

// ═══════════════════════════════════════════════════════════════════
//  구매 운영 (#P02 Phase B-β)
//
//  Source: GET /api/quotes/my  —  userId-scoped quote inbox.
//
//  History: this surface used to render a mock "AI 발주 전환 큐" with
//  supplier reply counts, AI options, blocker ontology, nextAction
//  resolver, and a multi-phase CenterWorkWindow. None of those
//  concepts were backed by canonical truth — the AI recommendation
//  engine + multi-supplier quote aggregation is parked as
//  `#P02 Phase B-α`. This build drops that mock ontology and renders
//  the real canonical Quote inbox with status filtering, search,
//  and deep-links into /dashboard/quotes/[id] for per-quote work.
//
//  Constraints preserved:
//   • canonical truth only (no mock fallback)
//   • same-canvas (header / queue / rail pattern kept)
//   • page-per-feature ban (same route, no new surface)
//   • dead button ban (every CTA resolves to a real navigation)
// ═══════════════════════════════════════════════════════════════════

type QuoteStatus = "PENDING" | "COMPLETED" | "REJECTED" | "PURCHASED";
type StatusFilter = QuoteStatus | "all";

interface QuoteSummary {
  id: string;
  quoteNumber: string | null;
  title: string;
  description: string | null;
  status: QuoteStatus;
  totalAmount: number | null;
  currency: string | null;
  validUntil: string | null;
  isExpired: boolean;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

interface QuotesStats {
  total: number;
  PENDING: number;
  COMPLETED: number;
  REJECTED: number;
  PURCHASED: number;
  expired: number;
}

interface QuotesMyResponse {
  success: boolean;
  data: {
    quotes: QuoteSummary[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalCount: number;
      limit: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
    };
    stats: QuotesStats;
  };
}

const STATUS_MAP: Record<QuoteStatus, { label: string; bg: string; text: string; border: string }> = {
  PENDING:   { label: "검토 대기",  bg: "bg-blue-50",    text: "text-blue-600",    border: "border-blue-200" },
  COMPLETED: { label: "확정됨",     bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-200" },
  REJECTED:  { label: "거부됨",     bg: "bg-rose-50",    text: "text-rose-600",    border: "border-rose-200" },
  PURCHASED: { label: "구매 완료",  bg: "bg-purple-50",  text: "text-purple-600",  border: "border-purple-200" },
};

export default function PurchasesPage() {
  const { status: authStatus } = useSession();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading, isError, error } = useQuery<QuotesMyResponse>({
    queryKey: ["quotes-my", statusFilter, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());
      params.set("limit", "50");
      const res = await fetch(`/api/quotes/my?${params.toString()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "견적 목록 조회 실패");
      }
      return res.json();
    },
    enabled: authStatus === "authenticated",
    staleTime: 30 * 1000,
    retry: 1,
  });

  const quotes = data?.data.quotes ?? [];
  const stats = data?.data.stats ?? {
    total: 0, PENDING: 0, COMPLETED: 0, REJECTED: 0, PURCHASED: 0, expired: 0,
  };

  const selectedItem = useMemo(() => {
    if (!selectedId) return null;
    return quotes.find((q) => q.id === selectedId) ?? null;
  }, [selectedId, quotes]);

  const closeRail = useCallback(() => setSelectedId(null), []);

  const formatPrice = (n: number | null, c: string | null) => {
    if (n === null || n === undefined) return "—";
    const currency = c || "KRW";
    return currency === "KRW"
      ? `₩${n.toLocaleString("ko-KR")}`
      : `${currency} ${n.toLocaleString("en-US")}`;
  };

  const formatDaysAgo = (iso: string) => {
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (days <= 0) return "오늘";
    if (days === 1) return "1일 전";
    return `${days}일 전`;
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 md:p-6 pt-4 md:pt-4">
      <div className="max-w-7xl mx-auto space-y-4">

        {/* ═══ 브레드크럼 ═══ */}
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <Link href="/dashboard" className="hover:text-slate-700 transition-colors">구매 및 예산</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-slate-900 font-medium">구매 운영</span>
        </div>

        {/* ═══ 페이지 헤더 ═══ */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-slate-900">구매 운영</h1>
            <p className="text-sm text-slate-500 mt-0.5">내 견적 보관함을 상태별로 확인하고, 상세 처리는 견적 페이지에서 이어갑니다.</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Link href="/dashboard/cart">
              <Button variant="outline" size="sm" className="h-10 px-4 text-sm gap-2 border-slate-200 font-medium">
                <FileText className="h-4 w-4" /> 장바구니
              </Button>
            </Link>
            <Link href="/dashboard/quotes">
              <Button size="sm" className="h-10 px-5 text-sm gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm">
                <FileText className="h-4 w-4" /> 견적 보관함
              </Button>
            </Link>
          </div>
        </div>

        {/* ═══ KPI 카드 4개 — Quote status 기반 ═══ */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <KpiCard
            icon={<ListChecks className="h-5 w-5 text-blue-500" />}
            iconBg="bg-blue-50"
            label="검토 대기"
            value={stats.PENDING}
            valueColor={stats.PENDING > 0 ? "text-blue-600" : "text-slate-900"}
            sub="PENDING"
            active={statusFilter === "PENDING"}
            onClick={() => setStatusFilter(statusFilter === "PENDING" ? "all" : "PENDING")}
          />
          <KpiCard
            icon={<CircleCheck className="h-5 w-5 text-emerald-500" />}
            iconBg="bg-emerald-50"
            label="확정됨"
            value={stats.COMPLETED}
            valueColor={stats.COMPLETED > 0 ? "text-emerald-600" : "text-slate-900"}
            sub="COMPLETED"
            active={statusFilter === "COMPLETED"}
            onClick={() => setStatusFilter(statusFilter === "COMPLETED" ? "all" : "COMPLETED")}
          />
          <KpiCard
            icon={<AlertCircle className="h-5 w-5 text-purple-500" />}
            iconBg="bg-purple-50"
            label="구매 완료"
            value={stats.PURCHASED}
            valueColor={stats.PURCHASED > 0 ? "text-purple-600" : "text-slate-900"}
            sub="PURCHASED"
            active={statusFilter === "PURCHASED"}
            onClick={() => setStatusFilter(statusFilter === "PURCHASED" ? "all" : "PURCHASED")}
          />
          <KpiCard
            icon={<Clock className="h-5 w-5 text-rose-500" />}
            iconBg="bg-rose-50"
            label="만료"
            value={stats.expired}
            valueColor={stats.expired > 0 ? "text-rose-600" : "text-slate-900"}
            sub="expired (PENDING only)"
            active={false}
            onClick={() => setStatusFilter("PENDING")}
          />
        </div>

        {/* ═══ 탭 + 검색 ═══ */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="flex items-center gap-1 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {([
              { key: "all" as StatusFilter,       label: "전체" },
              { key: "PENDING" as StatusFilter,   label: "검토 대기" },
              { key: "COMPLETED" as StatusFilter, label: "확정됨" },
              { key: "PURCHASED" as StatusFilter, label: "구매 완료" },
              { key: "REJECTED" as StatusFilter,  label: "거부됨" },
            ]).map((tab) => (
              <button key={tab.key} type="button" onClick={() => setStatusFilter(tab.key)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  statusFilter === tab.key
                    ? "bg-white text-slate-900 border border-slate-200 shadow-sm"
                    : "text-slate-500 hover:text-slate-700 hover:bg-white/60 border border-transparent"
                }`}>
                {tab.label}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                  statusFilter === tab.key ? "bg-slate-100 text-slate-700" : "bg-slate-100 text-slate-400"
                }`}>
                  {tab.key === "all" ? stats.total : stats[tab.key as QuoteStatus]}
                </span>
              </button>
            ))}
          </div>
          <div className="relative flex-1 min-w-0 sm:max-w-xs sm:ml-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder="제목, 견적번호 검색..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 text-sm bg-white border-slate-200" />
          </div>
        </div>

        {/* ═══ Queue + Rail ═══ */}
        <div className="flex gap-5">

          {/* ── 큐 리스트 ── */}
          <div className={`flex-1 min-w-0 space-y-2 transition-all ${selectedItem ? "md:max-w-[calc(100%-400px)]" : ""}`}>

            {/* loading */}
            {isLoading && (
              <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
                <Clock className="h-6 w-6 text-slate-400 mx-auto mb-3 animate-pulse" />
                <p className="text-sm text-slate-500">견적 목록을 불러오는 중...</p>
              </div>
            )}

            {/* error */}
            {isError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-10 text-center">
                <AlertCircle className="h-6 w-6 text-rose-500 mx-auto mb-3" />
                <p className="text-sm text-rose-700 mb-1">견적 목록을 불러오지 못했습니다</p>
                <p className="text-xs text-rose-500">{(error as Error)?.message ?? "잠시 후 다시 시도해주세요."}</p>
              </div>
            )}

            {/* empty */}
            {!isLoading && !isError && quotes.length === 0 && (
              <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                  <Package className="h-6 w-6 text-slate-400" />
                </div>
                <p className="text-sm text-slate-500 mb-1">
                  {searchQuery.trim()
                    ? `'${searchQuery.trim()}'에 해당하는 견적이 없습니다`
                    : "보유한 견적이 없습니다"}
                </p>
                <p className="text-xs text-slate-400 mb-4">
                  {searchQuery.trim()
                    ? "다른 키워드로 검색해 보세요."
                    : "장바구니에서 견적을 만들어 시작하세요."}
                </p>
                {!searchQuery.trim() && (
                  <Link href="/dashboard/cart">
                    <Button size="sm" className="h-9 px-4 text-sm shadow-sm">
                      장바구니 열기 <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </Link>
                )}
              </div>
            )}

            {/* rows */}
            {!isLoading && !isError && quotes.map((item) => {
              const cs = STATUS_MAP[item.status];
              const isSelected = selectedId === item.id;

              return (
                <div key={item.id}
                  className={`rounded-xl border bg-white transition-all cursor-pointer hover:shadow-md ${
                    isSelected ? "border-blue-300 ring-1 ring-blue-100 shadow-md" : "border-slate-200 hover:border-slate-300"
                  }`}
                  onClick={() => setSelectedId(item.id)}>

                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md border ${cs.bg} ${cs.text} ${cs.border}`}>
                        {cs.label}
                      </span>
                      {item.isExpired && (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-rose-50 text-rose-600 border border-rose-200">
                          만료됨
                        </span>
                      )}
                      {item.quoteNumber && (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-slate-50 text-slate-500 border border-slate-200 font-mono">
                          {item.quoteNumber}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-[11px] text-slate-400 ml-auto">
                        <Clock className="h-3 w-3" />{formatDaysAgo(item.createdAt)}
                      </span>
                    </div>

                    <div className="flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-slate-900 text-sm leading-snug mb-0.5">{item.title}</h3>
                        {item.description && (
                          <p className="text-xs text-slate-500 mb-2 line-clamp-2">{item.description}</p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <FileText className="h-3 w-3" />{item.itemCount}개 품목
                          </span>
                          {item.validUntil && (
                            <span className={`flex items-center gap-1 ${item.isExpired ? "text-rose-500" : "text-slate-500"}`}>
                              유효: {new Date(item.validUntil).toLocaleDateString("ko-KR")}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="hidden sm:flex flex-col items-end gap-2 flex-shrink-0 min-w-[140px]"
                        onClick={(e) => e.stopPropagation()}>
                        <p className="text-xl font-extrabold text-slate-900">
                          {formatPrice(item.totalAmount, item.currency)}
                        </p>
                        <Link href={`/dashboard/quotes/${item.id}`} className="w-full">
                          <Button size="sm" variant="outline"
                            className="w-full h-9 text-xs font-semibold border-slate-200 text-slate-700">
                            견적 상세 <ArrowRight className="h-3.5 w-3.5 ml-1" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Rail 패널 ── */}
          {selectedItem && (() => {
            const cs = STATUS_MAP[selectedItem.status];
            return (
              <div className="hidden md:flex flex-col w-[380px] flex-shrink-0 rounded-xl border border-slate-200 bg-white overflow-hidden max-h-[calc(100vh-160px)] shadow-sm">

                {/* Rail header */}
                <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${cs.bg} ${cs.text} ${cs.border}`}>{cs.label}</span>
                      {selectedItem.isExpired && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded border border-rose-200 bg-rose-50 text-rose-600">만료됨</span>
                      )}
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 truncate">{selectedItem.title}</h3>
                    {selectedItem.quoteNumber && (
                      <p className="text-[11px] text-slate-500 truncate font-mono">{selectedItem.quoteNumber}</p>
                    )}
                  </div>
                  <button onClick={closeRail} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 shrink-0 transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Rail body */}
                <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "#cbd5e1 transparent" }}>

                  <div className="px-5 py-4 border-b border-slate-100">
                    <div className="text-xs font-bold text-slate-700 mb-2.5">견적 요약</div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">상태</span>
                        <span className={`${cs.text} font-medium`}>{cs.label}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">품목 수</span>
                        <span className="text-slate-900 font-medium">{selectedItem.itemCount}개</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">총액</span>
                        <span className="text-slate-900 font-medium">
                          {formatPrice(selectedItem.totalAmount, selectedItem.currency)}
                        </span>
                      </div>
                      {selectedItem.validUntil && (
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">유효기간</span>
                          <span className={selectedItem.isExpired ? "text-rose-600 font-medium" : "text-slate-700"}>
                            {new Date(selectedItem.validUntil).toLocaleDateString("ko-KR")}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">작성일</span>
                        <span className="text-slate-700">
                          {new Date(selectedItem.createdAt).toLocaleDateString("ko-KR")}
                        </span>
                      </div>
                    </div>
                  </div>

                  {selectedItem.description && (
                    <div className="px-5 py-4 border-b border-slate-100">
                      <div className="text-xs font-bold text-slate-700 mb-2">설명</div>
                      <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{selectedItem.description}</p>
                    </div>
                  )}
                </div>

                {/* Rail CTA */}
                <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50/50 space-y-2">
                  <Link href={`/dashboard/quotes/${selectedItem.id}`} className="block">
                    <Button size="sm" className="w-full h-9 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
                      견적 상세 페이지 열기 <ArrowRight className="h-3 w-3 ml-1.5" />
                    </Button>
                  </Link>
                  <Button size="sm" variant="ghost" className="w-full h-8 text-[11px] text-slate-500" onClick={closeRail}>
                    닫기
                  </Button>
                </div>
              </div>
            );
          })()}

        </div>

      </div>
    </div>
  );
}

/* ── KPI Card ── */
function KpiCard({ icon, iconBg, label, value, valueColor, sub, active, onClick }: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: number;
  valueColor: string;
  sub: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick}
      className={`rounded-xl border bg-white p-5 text-left transition-all hover:shadow-md ${
        active ? "border-blue-300 ring-1 ring-blue-100 shadow-md" : "border-slate-200 hover:border-slate-300"
      }`}>
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center`}>{icon}</div>
        <span className="text-xs text-slate-400">{label}</span>
      </div>
      <p className={`text-3xl font-extrabold ${valueColor}`}>
        {value}<span className="text-base font-normal text-slate-400 ml-0.5">건</span>
      </p>
      <p className="text-xs text-slate-500 mt-1">{sub}</p>
    </button>
  );
}
