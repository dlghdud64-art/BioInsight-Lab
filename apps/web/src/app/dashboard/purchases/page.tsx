"use client";

export const dynamic = 'force-dynamic';

import { useState, useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search, Package, CheckCircle2, Clock, AlertCircle, AlertTriangle,
  ArrowRight, X, ListChecks, CircleCheck, ChevronRight, FileText,
  Sparkles, Truck,
} from "lucide-react";
import Link from "next/link";

import type {
  PurchaseConversionItem,
  ConversionStatus,
  BlockerType,
  NextAction,
  AiRecommendationStatus,
  AiOption,
} from "@/lib/ontology/purchase-conversion-resolver";

// ═══════════════════════════════════════════════════════════════════
//  구매 운영 (#P02 Phase B-α step α-C)
//
//  Source: GET /api/work-queue/purchase-conversion (ADR-002 §11.10
//  follow-up, plan PLAN_phase-b-alpha-purchase-conversion.md). Server-
//  side composer endpoint joins Quote + replies + vendors +
//  vendorRequests + order + AiActionItem and returns a flat
//  PurchaseConversionItem[] driven by the rule-based resolver
//  in lib/ontology/purchase-conversion-resolver.ts.
//
//  This rewires the Phase B-β page (commit b214386a, which had
//  swapped to /api/quotes/my as a smaller-scoped intermediate
//  fix) onto the full conversion-queue ontology. The old mock UX
//  (status / blocker / nextAction / AI options) is back, but every
//  field traces to a documented model branch — no fallback fake
//  data.
//
//  LabAxis constraints preserved:
//   • canonical truth only — every field comes from the resolver
//   • same-canvas — same /dashboard/purchases route
//   • page-per-feature ban — no new routes
//   • dead button ban — every CTA is a real Link or pure UI state.
//     The bulk PO + selected-option mutations live in α-D and are
//     intentionally NOT rendered as disabled-buttons here.
//   • chatbot/assistant 재해석 금지 — resolver is rule-based
// ═══════════════════════════════════════════════════════════════════

interface ConversionStats {
  total: number;
  review_required: number;
  ready_for_po: number;
  hold: number;
  confirmed: number;
  expired: number;
}

interface ConversionResponse {
  success: boolean;
  data: {
    items: PurchaseConversionItem[];
    stats: ConversionStats;
  };
}

type QueueTab = "all" | ConversionStatus;

const STATUS_MAP: Record<ConversionStatus, { label: string; bg: string; text: string; border: string }> = {
  review_required: { label: "검토 필요", bg: "bg-blue-50",    text: "text-blue-600",    border: "border-blue-200" },
  ready_for_po:    { label: "발주 가능", bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-200" },
  hold:            { label: "보류",      bg: "bg-slate-100",  text: "text-slate-600",   border: "border-slate-200" },
  confirmed:       { label: "확정됨",   bg: "bg-purple-50",  text: "text-purple-600",  border: "border-purple-200" },
};

const BLOCKER_LABEL: Record<BlockerType, string> = {
  none: "차단 없음",
  partial_reply: "회신 미완료",
  price_gap: "가격 차이",
  lead_time: "유효기간 만료",
  moq_issue: "MOQ 충돌",
  approval_unknown: "외부 승인 미확인",
};

const NEXT_ACTION_LABEL: Record<NextAction, string> = {
  review_selection: "선택안 검토",
  prepare_po: "발주 준비",
  wait_reply: "추가 회신 대기",
  check_external_approval: "외부 승인 확인",
};

const AI_REC_STATUS_LABEL: Record<AiRecommendationStatus, { label: string; className: string }> = {
  recommended:   { label: "AI 추천 완료", className: "text-blue-600" },
  review_needed: { label: "AI 검토 필요", className: "text-amber-600" },
  hold:          { label: "AI 판단 보류", className: "text-slate-500" },
};

const RECOMMENDATION_LEVEL_LABEL: Record<AiOption["recommendationLevel"], string> = {
  primary: "추천",
  alternate: "대체",
  conservative: "보수",
};

export default function PurchasesPage() {
  const { status: authStatus } = useSession();
  const [searchQuery, setSearchQuery] = useState("");
  const [queueTab, setQueueTab] = useState<QueueTab>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading, isError, error } = useQuery<ConversionResponse>({
    queryKey: ["purchase-conversion-queue"],
    queryFn: async () => {
      const res = await fetch("/api/work-queue/purchase-conversion", { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "구매 전환 큐 조회 실패");
      }
      return res.json();
    },
    enabled: authStatus === "authenticated",
    staleTime: 30 * 1000,
    retry: 1,
  });

  const items = data?.data.items ?? [];
  const stats = data?.data.stats ?? {
    total: 0, review_required: 0, ready_for_po: 0, hold: 0, confirmed: 0, expired: 0,
  };

  const filteredItems = useMemo(() => {
    let result = items;
    if (queueTab !== "all") {
      result = result.filter((i) => i.conversionStatus === queueTab);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (i) =>
          i.requestTitle.toLowerCase().includes(q) ||
          i.itemSummary.toLowerCase().includes(q) ||
          (i.quoteNumber?.toLowerCase().includes(q) ?? false),
      );
    }
    return result;
  }, [items, queueTab, searchQuery]);

  const selectedItem = useMemo(() => {
    if (!selectedId) return null;
    return items.find((i) => i.id === selectedId) ?? null;
  }, [selectedId, items]);

  const closeRail = useCallback(() => setSelectedId(null), []);

  const formatPrice = (n: number | null, c: string) => {
    if (n === null || n === undefined) return "—";
    return c === "KRW" ? `₩${n.toLocaleString("ko-KR")}` : `${c} ${n.toLocaleString("en-US")}`;
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
            <p className="text-sm text-slate-500 mt-0.5">선택안 검토, 회신 확인, 발주 전환까지 한 화면에서 처리합니다.</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Link href="/app/search">
              <Button variant="outline" size="sm" className="h-10 px-4 text-sm gap-2 border-slate-200 font-medium">
                <Search className="h-4 w-4" /> 소싱
              </Button>
            </Link>
            <Link href="/dashboard/quotes">
              <Button size="sm" className="h-10 px-5 text-sm gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm">
                <FileText className="h-4 w-4" /> 견적 보관함
              </Button>
            </Link>
            {/*
              "일괄 발주 전환" header CTA — intentionally hidden until α-D
              wires the bulk-PO mutation. dead button ban precludes a
              disabled placeholder here.
            */}
          </div>
        </div>

        {/* ═══ KPI 카드 4개 — conversionStatus 기반 ═══ */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <KpiCard
            icon={<ListChecks className="h-5 w-5 text-blue-500" />}
            iconBg="bg-blue-50"
            label="검토 필요"
            value={stats.review_required}
            valueColor={stats.review_required > 0 ? "text-blue-600" : "text-slate-900"}
            sub="review_required"
            active={queueTab === "review_required"}
            onClick={() => setQueueTab(queueTab === "review_required" ? "all" : "review_required")}
          />
          <KpiCard
            icon={<CircleCheck className="h-5 w-5 text-emerald-500" />}
            iconBg="bg-emerald-50"
            label="발주 가능"
            value={stats.ready_for_po}
            valueColor={stats.ready_for_po > 0 ? "text-emerald-600" : "text-slate-900"}
            sub="ready_for_po"
            active={queueTab === "ready_for_po"}
            onClick={() => setQueueTab(queueTab === "ready_for_po" ? "all" : "ready_for_po")}
          />
          <KpiCard
            icon={<AlertCircle className="h-5 w-5 text-purple-500" />}
            iconBg="bg-purple-50"
            label="확정됨"
            value={stats.confirmed}
            valueColor={stats.confirmed > 0 ? "text-purple-600" : "text-slate-900"}
            sub="confirmed"
            active={queueTab === "confirmed"}
            onClick={() => setQueueTab(queueTab === "confirmed" ? "all" : "confirmed")}
          />
          <KpiCard
            icon={<Clock className="h-5 w-5 text-rose-500" />}
            iconBg="bg-rose-50"
            label="만료"
            value={stats.expired}
            valueColor={stats.expired > 0 ? "text-rose-600" : "text-slate-900"}
            sub="isExpired count"
            active={false}
            onClick={() => setQueueTab("review_required")}
          />
        </div>

        {/* ═══ 탭 + 검색 ═══ */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="flex items-center gap-1 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {([
              { key: "all" as QueueTab,             label: "전체",      count: stats.total },
              { key: "review_required" as QueueTab, label: "검토 필요", count: stats.review_required },
              { key: "ready_for_po" as QueueTab,    label: "발주 가능", count: stats.ready_for_po },
              { key: "hold" as QueueTab,            label: "보류",      count: stats.hold },
              { key: "confirmed" as QueueTab,       label: "확정됨",   count: stats.confirmed },
            ]).map((tab) => (
              <button key={tab.key} type="button" onClick={() => setQueueTab(tab.key)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  queueTab === tab.key
                    ? "bg-white text-slate-900 border border-slate-200 shadow-sm"
                    : "text-slate-500 hover:text-slate-700 hover:bg-white/60 border border-transparent"
                }`}>
                {tab.label}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                  queueTab === tab.key ? "bg-slate-100 text-slate-700" : "bg-slate-100 text-slate-400"
                }`}>{tab.count}</span>
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
          <div className={`flex-1 min-w-0 space-y-2 transition-all ${selectedItem ? "md:max-w-[calc(100%-400px)]" : ""}`}>

            {isLoading && (
              <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
                <Clock className="h-6 w-6 text-slate-400 mx-auto mb-3 animate-pulse" />
                <p className="text-sm text-slate-500">구매 전환 큐를 불러오는 중...</p>
              </div>
            )}

            {isError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-10 text-center">
                <AlertCircle className="h-6 w-6 text-rose-500 mx-auto mb-3" />
                <p className="text-sm text-rose-700 mb-1">구매 전환 큐를 불러오지 못했습니다</p>
                <p className="text-xs text-rose-500">{(error as Error)?.message ?? "잠시 후 다시 시도해주세요."}</p>
              </div>
            )}

            {!isLoading && !isError && filteredItems.length === 0 && (
              <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                  <Package className="h-6 w-6 text-slate-400" />
                </div>
                <p className="text-sm text-slate-500 mb-1">
                  {searchQuery.trim()
                    ? `'${searchQuery.trim()}'에 해당하는 항목이 없습니다`
                    : items.length === 0
                      ? "보유한 견적이 없습니다"
                      : "선택한 탭에 항목이 없습니다"}
                </p>
                <p className="text-xs text-slate-400 mb-4">
                  {searchQuery.trim()
                    ? "다른 키워드로 검색해 보세요."
                    : items.length === 0
                      ? "소싱에서 검색하고 견적을 만들어 시작하세요."
                      : "다른 탭을 확인해 보세요."}
                </p>
                {!searchQuery.trim() && items.length === 0 && (
                  <Link href="/app/search">
                    <Button size="sm" className="h-9 px-4 text-sm shadow-sm">
                      소싱 열기 <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </Link>
                )}
              </div>
            )}

            {!isLoading && !isError && filteredItems.map((item) => {
              const cs = STATUS_MAP[item.conversionStatus];
              const ai = AI_REC_STATUS_LABEL[item.aiRecommendationStatus];
              const isSelected = selectedId === item.id;
              const hasBlocker = item.blockerType !== "none";

              return (
                <div key={item.id}
                  className={`rounded-xl border bg-white transition-all cursor-pointer hover:shadow-md ${
                    isSelected ? "border-blue-300 ring-1 ring-blue-100 shadow-md" : "border-slate-200 hover:border-slate-300"
                  }`}
                  onClick={() => setSelectedId(item.id)}>

                  <div className="p-4">
                    {/* 상단 배지 */}
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md border ${cs.bg} ${cs.text} ${cs.border}`}>
                        {cs.label}
                      </span>
                      {item.isExpired && (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-rose-50 text-rose-600 border border-rose-200">
                          만료됨
                        </span>
                      )}
                      {hasBlocker && (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                          {BLOCKER_LABEL[item.blockerType]}
                        </span>
                      )}
                      {item.quoteNumber && (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-slate-50 text-slate-500 border border-slate-200 font-mono">
                          {item.quoteNumber}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-[11px] text-slate-400 ml-auto">
                        <Clock className="h-3 w-3" />{item.createdDaysAgo}일 전
                      </span>
                    </div>

                    {/* 본문: 제목 + 회신·AI 정보 + 가격 */}
                    <div className="flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-slate-900 text-sm leading-snug mb-0.5">{item.requestTitle}</h3>
                        <p className="text-xs text-slate-500 mb-3 line-clamp-2">{item.itemSummary}</p>

                        {/* 막힘 / 다음 단계 */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <div className={`rounded-xl px-3.5 py-3 border ${
                            hasBlocker ? "bg-amber-50/70 border-amber-200" : "bg-emerald-50/50 border-emerald-200"
                          }`}>
                            <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${
                              hasBlocker ? "text-amber-500" : "text-emerald-500"
                            }`}>막힘 확인</p>
                            <p className={`text-xs leading-snug flex items-start gap-2 font-medium ${
                              hasBlocker ? "text-amber-700" : "text-emerald-700"
                            }`}>
                              {hasBlocker
                                ? <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-amber-500" />
                                : <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-emerald-500" />
                              }
                              {item.blockerReason}
                            </p>
                          </div>
                          <div className="rounded-xl bg-blue-50/60 border border-blue-200 px-3.5 py-3">
                            <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider mb-1">다음 단계</p>
                            <p className="text-xs text-blue-700 leading-snug flex items-start gap-2 font-medium">
                              <ArrowRight className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-blue-500" />
                              {item.nextStage}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* 우측: AI 정보 + 가격 + 견적 상세 link */}
                      <div className="hidden sm:flex flex-col items-end gap-2 flex-shrink-0 min-w-[160px]"
                        onClick={(e) => e.stopPropagation()}>
                        <div className="text-right">
                          <span className={`text-[11px] flex items-center gap-1 justify-end mb-0.5 ${ai.className}`}>
                            <Sparkles className="h-3 w-3" />{ai.label}
                          </span>
                          <span className="text-[11px] flex items-center gap-1 justify-end text-slate-500">
                            <FileText className="h-3 w-3" />회신 {item.supplierReplies}/{item.totalSuppliers}
                          </span>
                        </div>
                        <p className="text-xl font-extrabold text-slate-900">
                          {formatPrice(item.totalBudget, item.currency)}
                        </p>
                        <Link href={`/dashboard/quotes/${item.id}`} className="w-full">
                          <Button size="sm" variant="outline"
                            className="w-full h-9 text-xs font-semibold border-slate-200 text-slate-700">
                            견적 상세 <ArrowRight className="h-3.5 w-3.5 ml-1" />
                          </Button>
                        </Link>
                        <span className="text-[10px] text-slate-400">다음: {NEXT_ACTION_LABEL[item.nextAction]}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Rail 패널 ── */}
          {selectedItem && (() => {
            const cs = STATUS_MAP[selectedItem.conversionStatus];
            const ai = AI_REC_STATUS_LABEL[selectedItem.aiRecommendationStatus];
            const hasBlocker = selectedItem.blockerType !== "none";

            return (
              <div className="hidden md:flex flex-col w-[380px] flex-shrink-0 rounded-xl border border-slate-200 bg-white overflow-hidden max-h-[calc(100vh-160px)] shadow-sm">

                {/* Rail header */}
                <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${cs.bg} ${cs.text} ${cs.border}`}>{cs.label}</span>
                      {selectedItem.isExpired && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded border border-rose-200 bg-rose-50 text-rose-600">만료됨</span>
                      )}
                      <span className={`text-[10px] ${ai.className}`}>{ai.label}</span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 truncate">{selectedItem.requestTitle}</h3>
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

                  {/* 견적 요약 */}
                  <div className="px-5 py-4 border-b border-slate-100">
                    <div className="text-xs font-bold text-slate-700 mb-2.5">견적 요약</div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">상태</span>
                        <span className={`${cs.text} font-medium`}>{cs.label}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">총액</span>
                        <span className="text-slate-900 font-medium">
                          {formatPrice(selectedItem.totalBudget, selectedItem.currency)}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">회신 현황</span>
                        <span className={selectedItem.supplierReplies === selectedItem.totalSuppliers && selectedItem.totalSuppliers > 0
                          ? "text-emerald-600 font-medium"
                          : "text-amber-600"}>
                          {selectedItem.supplierReplies}/{selectedItem.totalSuppliers} {selectedItem.totalSuppliers > 0 ? "완료" : "—"}
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
                        <span className="text-slate-500">작성 후</span>
                        <span className="text-slate-700">{selectedItem.createdDaysAgo}일</span>
                      </div>
                    </div>
                  </div>

                  {/* 막힘 확인 + 다음 단계 */}
                  <div className="px-5 py-4 border-b border-slate-100">
                    <div className="text-xs font-bold text-slate-700 mb-2.5">발주 Readiness</div>
                    <div className={`rounded-xl px-4 py-3 mb-2.5 ${
                      hasBlocker ? "bg-amber-50/70 border border-amber-200" : "bg-emerald-50/70 border border-emerald-200"
                    }`}>
                      <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${
                        hasBlocker ? "text-amber-500" : "text-emerald-500"
                      }`}>
                        {hasBlocker ? "현재 막힘" : "차단 없음"}
                      </p>
                      <p className={`text-xs font-medium leading-snug ${
                        hasBlocker ? "text-amber-700" : "text-emerald-700"
                      }`}>
                        {selectedItem.blockerReason}
                      </p>
                    </div>
                    <div className="rounded-xl px-4 py-3 bg-blue-50/60 border border-blue-200">
                      <p className="text-[10px] font-bold uppercase tracking-wider mb-1 text-blue-500">다음 단계</p>
                      <p className="text-xs text-blue-700 font-medium leading-snug">{selectedItem.nextStage}</p>
                    </div>
                    <div className="space-y-1.5 mt-3">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">외부 승인</span>
                        <span className={selectedItem.externalApprovalStatus === "approved"
                          ? "text-emerald-600 font-medium"
                          : selectedItem.externalApprovalStatus === "pending"
                            ? "text-amber-600"
                            : "text-slate-500"}>
                          {selectedItem.externalApprovalStatus === "approved" ? "승인 완료"
                            : selectedItem.externalApprovalStatus === "pending" ? "대기 중"
                            : "미확인"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* AI 선택안 */}
                  {selectedItem.aiOptions.length > 0 && (
                    <div className="px-5 py-4 border-b border-slate-100">
                      <div className="flex items-center gap-1.5 mb-3">
                        <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                        <span className="text-xs font-bold text-slate-700">AI 선택안</span>
                        <span className={`text-[10px] ml-auto ${ai.className}`}>{ai.label}</span>
                      </div>
                      <div className="space-y-2">
                        {selectedItem.aiOptions.map((opt) => {
                          const isPrimary = opt.recommendationLevel === "primary";
                          return (
                            <div key={opt.id} className={`rounded-lg border p-3 ${
                              isPrimary ? "border-emerald-200 bg-emerald-50/50" : "border-slate-100 bg-slate-50/50"
                            }`}>
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-1.5">
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                    isPrimary ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-500"
                                  }`}>
                                    {RECOMMENDATION_LEVEL_LABEL[opt.recommendationLevel]}
                                  </span>
                                  <span className="text-xs font-medium text-slate-700">{opt.supplierName}</span>
                                </div>
                                <span className="text-xs font-bold text-slate-900">
                                  {formatPrice(opt.price, selectedItem.currency)}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-[10px] text-slate-500">
                                <span className="flex items-center gap-1"><Truck className="h-3 w-3" />납기 {opt.leadDays ?? "—"}일</span>
                                {opt.moq !== null && <span>MOQ {opt.moq}</span>}
                              </div>
                              {opt.rationale.length > 0 && (
                                <p className="text-[10px] text-slate-400 mt-1 leading-snug">{opt.rationale.join(" · ")}</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
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
