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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ShoppingCart, Search, Filter, Calendar, Package, CheckCircle2, Clock,
  AlertCircle, Send, FileCheck2, ArrowRight, Plus, RefreshCw, Truck,
  AlertTriangle, Sparkles,
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
  items: Array<{ id: string; product: { id: string; name: string }; quantity: number }>;
  responses?: Array<{ id: string; vendor: { name: string }; totalPrice?: number; createdAt: string }>;
}

// ── 운영 상태 파생 ──────────────────────────────────────────
function isDelayed(q: Quote): boolean {
  if (!q.deliveryDate) return false;
  if (q.status === "COMPLETED" || q.status === "CANCELLED") return false;
  return new Date(q.deliveryDate) < new Date();
}

const OP_STATUS: Record<string, { label: string; bg: string; text: string; border: string }> = {
  지연:           { label: "지연",            bg: "bg-red-600/10",     text: "text-red-400",     border: "border-red-600/30" },
  비교_검토:      { label: "비교 검토 필요",  bg: "bg-purple-600/10",  text: "text-purple-400",  border: "border-purple-600/30" },
  일부_회신:      { label: "일부 회신 도착",  bg: "bg-blue-600/10",    text: "text-blue-400",    border: "border-blue-600/30" },
  회신_대기:      { label: "회신 대기 중",    bg: "bg-amber-600/10",   text: "text-amber-400",   border: "border-amber-600/30" },
  요청_접수:      { label: "요청 접수",       bg: "bg-el",             text: "text-slate-400",   border: "border-bd" },
  발주_완료:      { label: "발주 완료",       bg: "bg-emerald-600/10", text: "text-emerald-400", border: "border-emerald-600/30" },
  취소됨:         { label: "취소됨",          bg: "bg-red-600/5",      text: "text-red-400",     border: "border-red-600/20" },
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

// ── 운영 우선순위 (triage 기준) ──
function getOpPriority(q: Quote): number {
  if (isDelayed(q)) return 0;
  // 오늘 마감
  if (q.deliveryDate && new Date(q.deliveryDate).toDateString() === new Date().toDateString()) return 1;
  const map: Record<QuoteStatus, number> = {
    RESPONDED: 2, SENT: 3, PENDING: 4, COMPLETED: 6, CANCELLED: 7,
  };
  // 일부 회신 도착 = 비교 가능
  if (q.status === "SENT" && (q.responses?.length ?? 0) > 0) return 2;
  return map[q.status] ?? 9;
}

// ── 운영 신호 3종 파생 ──
function getOpSignals(q: Quote) {
  const responseCount = q.responses?.length ?? 0;
  const delayed = isDelayed(q);

  // 1. blocker / risk (지시문 3.C.8 매핑표 기준)
  let blocker = "";
  if (delayed) blocker = "납기 초과 — 우선 처리 필요";
  else if (q.status === "PENDING") blocker = "발송 전 — 공급사 미전달";
  else if (q.status === "SENT" && responseCount === 0) blocker = "공급사 응답 필요";
  else if (q.status === "SENT" && responseCount > 0) blocker = "추가 회신 대기 중";
  else if (q.status === "RESPONDED") blocker = "선택안 미확정";
  else if (q.status === "COMPLETED") blocker = "차단 없음";

  // 2. next action
  let nextAction = "";
  if (q.status === "PENDING") nextAction = "견적 요청 발송";
  else if (q.status === "SENT" && responseCount === 0) nextAction = "회신 확인";
  else if (q.status === "SENT" && responseCount > 0) nextAction = "비교 검토 시작";
  else if (q.status === "RESPONDED") nextAction = "비교 결과 정리";
  else if (q.status === "COMPLETED") nextAction = "발주 전환 준비";

  // 3. decision summary
  let summary = "";
  if (q.status === "PENDING") summary = "요청이 접수되었으나 아직 공급사에 발송되지 않았습니다";
  else if (q.status === "SENT" && responseCount === 0) summary = "공급사 회신을 기다리고 있습니다. 회신이 지연되면 재요청이 필요합니다";
  else if (q.status === "SENT" && responseCount > 0) summary = `${responseCount}건 회신 도착 — 추가 회신 대기 또는 현재 결과로 비교 검토를 시작할 수 있습니다`;
  else if (q.status === "RESPONDED") summary = "모든 회신이 도착했습니다. 비교 검토 후 발주 전환 대상을 확정하세요";
  else if (q.status === "COMPLETED") summary = "비교/검토가 완료되어 발주 전환이 가능한 상태입니다";
  else if (q.status === "CANCELLED") summary = "이 견적은 취소되었습니다";

  // 4. state-aware CTA
  let ctaLabel = "상세보기";
  let ctaVariant: "default" | "outline" = "outline";
  if (q.status === "PENDING") { ctaLabel = "견적 요청 발송"; ctaVariant = "default"; }
  else if (q.status === "SENT" && responseCount > 0) { ctaLabel = "비교 검토 시작"; ctaVariant = "default"; }
  else if (q.status === "SENT") ctaLabel = "회신 확인";
  else if (q.status === "RESPONDED") { ctaLabel = "비교 결과 정리"; ctaVariant = "default"; }
  else if (q.status === "COMPLETED") { ctaLabel = "발주 전환 준비"; ctaVariant = "default"; }

  // 5. readiness stage (0-4)
  let readinessStage = 0;
  if (q.status === "SENT") readinessStage = 1;
  if (q.status === "SENT" && responseCount > 0) readinessStage = 2;
  if (q.status === "RESPONDED") readinessStage = 3;
  if (q.status === "COMPLETED") readinessStage = 4;

  // 6. AI inline recommendation
  let aiRecommendation = "";
  if (q.status === "PENDING") aiRecommendation = "AI 추천: 요청 발송 후 회신 수집을 시작하세요";
  else if (q.status === "SENT" && responseCount === 0) aiRecommendation = "AI 추천: 회신이 지연되면 재요청을 고려하세요";
  else if (q.status === "SENT" && responseCount > 0) aiRecommendation = "AI 추천: 현재 회신만으로도 비교 검토를 시작할 수 있습니다";
  else if (q.status === "RESPONDED") aiRecommendation = "AI 추천: 비교 결과 확정 후 발주 전환이 가능합니다";
  else if (q.status === "COMPLETED") aiRecommendation = "AI 추천: 문서 확인 완료 시 바로 전환 가능한 상태입니다";

  return { blocker, nextAction, summary, ctaLabel, ctaVariant, readinessStage, aiRecommendation };
}

const READINESS_LABELS = ["요청 생성", "회신 수집", "비교 검토", "전환 준비", "완료"];

// ── 견적 카드 (운영형 density) ──
function QuoteCard({ quote }: { quote: Quote }) {
  const opStatus = getOpStatus(quote);
  const signals = getOpSignals(quote);
  const itemCount = quote.items.length;
  const responseCount = quote.responses?.length ?? 0;
  const prices = (quote.responses ?? []).map(r => r.totalPrice).filter((p): p is number => typeof p === "number" && p > 0);
  const minPrice = prices.length ? Math.min(...prices) : null;
  const delayed = isDelayed(quote);
  const quoteRef = `#${quote.id.slice(0, 8).toUpperCase()}`;
  const daysSinceCreated = Math.floor((Date.now() - new Date(quote.createdAt).getTime()) / 86400000);

  return (
    <div className={`bg-pn rounded-xl border transition-colors p-4 ${delayed ? "border-red-600/30" : "border-bd/80 hover:border-bd"}`}>
      {/* 운영 신호 3종 — 최상단 */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded border ${opStatus.bg} ${opStatus.text} ${opStatus.border}`}>
          {opStatus.label}
        </span>
        {signals.blocker && (
          <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-600/10 text-amber-400 border border-amber-600/20">
            <AlertTriangle className="h-2.5 w-2.5" />{signals.blocker.length > 25 ? signals.blocker.substring(0, 25) + "…" : signals.blocker}
          </span>
        )}
        <span className="text-[10px] text-slate-500 font-mono ml-auto">{quoteRef}</span>
      </div>

      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          {/* 제목 */}
          <h3 className="font-semibold text-slate-100 text-sm leading-snug truncate mb-1">{quote.title}</h3>

          {/* Decision summary sentence */}
          <p className="text-xs text-slate-400 leading-relaxed mb-1 line-clamp-2">{signals.summary}</p>
          {/* AI inline recommendation */}
          {signals.aiRecommendation && (
            <p className="text-[10px] text-slate-500 flex items-center gap-1 mb-2">
              <Sparkles className="h-3 w-3 text-slate-600 shrink-0" />
              <span className="line-clamp-1">{signals.aiRecommendation}</span>
            </p>
          )}

          {/* 운영형 메타 — triage 우선 */}
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            <span className="text-[11px] text-slate-500 flex items-center gap-1">
              <Package className="h-3 w-3" />{itemCount}건
            </span>
            <span className={`text-[11px] flex items-center gap-1 ${responseCount > 0 ? "text-blue-400 font-medium" : "text-slate-500"}`}>
              <Send className="h-3 w-3" />{responseCount > 0 ? `회신 ${responseCount}` : "미회신"}
            </span>
            {minPrice !== null && (
              <span className="text-[11px] text-slate-200 font-medium">₩{minPrice.toLocaleString("ko-KR")}</span>
            )}
            <span className="text-[11px] text-slate-500">{daysSinceCreated === 0 ? "오늘" : `${daysSinceCreated}일 전`}</span>
            {quote.deliveryDate && (
              <span className={`text-[11px] flex items-center gap-1 ${delayed ? "text-red-400 font-semibold" : "text-slate-500"}`}>
                <Clock className="h-3 w-3" />납기 {new Date(quote.deliveryDate).toLocaleDateString("ko-KR")}
              </span>
            )}
          </div>
        </div>

        {/* State-aware CTA */}
        <div className="flex flex-col gap-1.5 flex-shrink-0 min-w-[100px]">
          <Link href={`/quotes/${quote.id}`}>
            <Button
              size="sm"
              variant={signals.ctaVariant}
              className={`h-7 text-xs w-full ${signals.ctaVariant === "default" ? "bg-blue-600 hover:bg-blue-700 text-white" : ""}`}
            >
              {signals.ctaLabel}
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </Link>
          {/* 다음 액션 힌트 */}
          <span className="text-[9px] text-slate-500 text-center">다음: {signals.nextAction}</span>
        </div>
      </div>

      {/* Readiness strip */}
      <div className="flex items-center gap-0.5 mt-3 pt-2.5 border-t border-bd/50">
        {READINESS_LABELS.map((label, idx) => {
          const active = idx <= signals.readinessStage;
          const current = idx === signals.readinessStage;
          return (
            <div key={label} className="flex items-center gap-0.5 flex-1 min-w-0">
              <div className={`h-1 flex-1 rounded-full ${active ? (current ? "bg-blue-500" : "bg-emerald-600/40") : "bg-bd/30"}`} />
              {current && <span className="text-[8px] text-blue-400 shrink-0 hidden sm:inline">{label}</span>}
            </div>
          );
        })}
      </div>

      {/* 운영 실행 현황 */}
      <OpsExecutionContext entityType="QUOTE" entityId={quote.id} compact className="mt-2.5 pt-2.5 border-t border-bd/50" />
    </div>
  );
}

// ── Operating mode chips ──
const MODE_CHIPS = [
  { key: "urgent",     label: "우선 처리",  filter: (q: Quote) => isDelayed(q) || (q.deliveryDate && new Date(q.deliveryDate).toDateString() === new Date().toDateString()) },
  { key: "blocked",    label: "차단 있음",  filter: (q: Quote) => q.status === "SENT" && (q.responses?.length ?? 0) === 0 },
  { key: "reviewable", label: "비교 가능",  filter: (q: Quote) => q.status === "RESPONDED" || (q.status === "SENT" && (q.responses?.length ?? 0) > 0) },
  { key: "convertible",label: "전환 가능",  filter: (q: Quote) => q.status === "COMPLETED" },
];

function QuotesPageContent() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get("status") ?? "all");
  const [modeChip, setModeChip] = useState<string | null>(null);

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

  const { data: quotesData, isLoading, isFetching } = useQuery({
    queryKey: ["quotes", statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all" && statusFilter !== "DEADLINE_TODAY") params.append("status", statusFilter);
      const response = await fetch(`/api/quotes?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch quotes");
      return response.json();
    },
    enabled: status === "authenticated",
    staleTime: 15_000, // 15초 short cache — 재방문 시 즉시 표시
    placeholderData: (prev) => prev, // 필터 변경 시 기존 데이터 유지
    refetchOnWindowFocus: true,
  });

  // 필터 변경 중 indicator (기존 list 유지하면서 상단에만 표시)
  const isFilterChanging = isFetching && !isLoading;

  const quotes: Quote[] = quotesData?.quotes || [];
  const today = new Date().toDateString();

  // 운영 요약 — control card 데이터
  const summaryStats = useMemo(() => {
    const sent = quotes.filter(q => q.status === "SENT");
    const responded = quotes.filter(q => q.status === "RESPONDED");
    const deadlineToday = quotes.filter(q => q.deliveryDate && new Date(q.deliveryDate).toDateString() === today && q.status !== "COMPLETED" && q.status !== "CANCELLED");
    const readyToConvert = quotes.filter(q => q.status === "COMPLETED" || (q.status === "RESPONDED" && (q.responses?.length ?? 0) > 0));
    return {
      pendingResponse: { count: sent.length, insight: sent.length > 0 ? `${sent.filter(q => (q.responses?.length ?? 0) === 0).length}건은 아직 회신 없음` : "대기 건 없음" },
      needsReview: { count: responded.length, insight: responded.length > 0 ? "비교 결과 정리 후 전환 가능" : "검토 대상 없음" },
      todayDeadline: { count: deadlineToday.length, insight: deadlineToday.length > 0 ? "납기 영향으로 우선 처리 필요" : "오늘 마감 없음" },
      readyToOrder: { count: readyToConvert.length, insight: readyToConvert.length > 0 ? "차단 없이 다음 단계 이동 가능" : "전환 대상 없음" },
    };
  }, [quotes, today]);

  // 필터링 + 운영 우선순위 정렬
  const filteredQuotes = useMemo(() => {
    let result = quotes
      .filter(quote => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return quote.title.toLowerCase().includes(q) || quote.id.toLowerCase().includes(q) || quote.items.some(item => item.product.name.toLowerCase().includes(q));
      })
      .filter(quote => {
        if (statusFilter === "all") return true;
        if (statusFilter === "DEADLINE_TODAY") return quote.deliveryDate && new Date(quote.deliveryDate).toDateString() === today && quote.status !== "COMPLETED" && quote.status !== "CANCELLED";
        return quote.status === statusFilter;
      });

    // Mode chip 필터
    if (modeChip) {
      const chip = MODE_CHIPS.find(c => c.key === modeChip);
      if (chip) result = result.filter(chip.filter);
    }

    return result.sort((a, b) => getOpPriority(a) - getOpPriority(b));
  }, [quotes, searchQuery, statusFilter, modeChip, today]);

  // 섹션 분류
  const urgentQuotes = filteredQuotes.filter(q => q.status === "RESPONDED" || (q.status === "SENT" && (q.responses?.length ?? 0) > 0) || isDelayed(q));
  const inProgressQuotes = filteredQuotes.filter(q => !urgentQuotes.includes(q) && q.status !== "COMPLETED" && q.status !== "CANCELLED");
  const completedQuotes = filteredQuotes.filter(q => q.status === "COMPLETED" || q.status === "CANCELLED");

  return (
    <div className="p-4 md:p-8 pt-4 md:pt-6 space-y-5 max-w-7xl mx-auto w-full">

      {/* ── 헤더 ── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-100">견적 운영 워크큐</h1>
          <p className="text-sm text-slate-500 mt-0.5 hidden sm:block">처리가 필요한 견적을 우선순위 순으로 확인하세요</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <AiActionButton label="견적 요청 초안 만들기" icon={FileText} generateEndpoint="/api/ai-actions/generate/quote-draft"
            generatePayload={{ items: quotes?.slice(0, 3).flatMap((q: Quote) => q.items?.map(item => ({ productName: item.product?.name || "품목", quantity: item.quantity || 1 })) || []) || [] }}
            variant="outline" size="sm" className="h-9 text-sm hidden sm:flex" />
          <PermissionGate permission="quotes.create">
            <Link href="/test/search" className="flex-shrink-0">
              <Button size="sm" className="h-9 text-sm gap-1.5 bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4" /><span className="hidden sm:inline">새 견적 요청</span><span className="sm:hidden">새 요청</span>
              </Button>
            </Link>
          </PermissionGate>
        </div>
      </div>

      {/* ── KPI Control Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "회신 대기", ...summaryStats.pendingResponse, icon: <Clock className="h-4 w-4 text-amber-400" />, filter: "SENT", color: "amber" },
          { label: "비교 검토 필요", ...summaryStats.needsReview, icon: <RefreshCw className="h-4 w-4 text-purple-400" />, filter: "RESPONDED", color: "purple" },
          { label: "오늘 마감", ...summaryStats.todayDeadline, icon: <AlertCircle className="h-4 w-4 text-red-400" />, filter: "DEADLINE_TODAY", color: "red" },
          { label: "전환 가능", ...summaryStats.readyToOrder, icon: <FileCheck2 className="h-4 w-4 text-emerald-400" />, filter: "COMPLETED", color: "emerald" },
        ].map(({ label, count, insight, icon, filter, color }) => {
          const isActive = statusFilter === filter;
          return (
            <button key={label} onClick={() => setStatusFilter(prev => prev === filter ? "all" : filter)}
              className={`text-left rounded-xl border bg-pn p-3.5 transition-all cursor-pointer hover:border-${color}-600/30 ${isActive ? `border-${color}-600/40 bg-${color}-600/5 ring-1 ring-${color}-600/20` : "border-bd/80"}`}>
              <div className="flex items-center gap-2 mb-1">
                {icon}
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider truncate">{label}</span>
              </div>
              <div className="text-2xl font-bold text-slate-100 mb-1">{isLoading ? "—" : count}</div>
              <p className="text-[10px] text-slate-500 leading-snug line-clamp-1">{insight}</p>
            </button>
          );
        })}
      </div>

      {/* ── 검색 + 필터 ── */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input placeholder="견적명 / 품목명 / 요청 번호 검색..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 h-9 text-sm" />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setModeChip(null); }}>
            <SelectTrigger className="w-full sm:w-[160px] h-9 text-sm">
              <Filter className="h-3.5 w-3.5 mr-2 text-slate-400" /><SelectValue placeholder="상태 필터" />
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
        {/* Operating mode chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {MODE_CHIPS.map(chip => {
            const isActive = modeChip === chip.key;
            const chipCount = quotes.filter(chip.filter).length;
            return (
              <button key={chip.key} onClick={() => setModeChip(isActive ? null : chip.key)}
                className={`inline-flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full border font-medium transition-all ${
                  isActive ? "bg-blue-600/10 text-blue-400 border-blue-600/30" : "text-slate-500 border-bd/50 hover:border-bd hover:text-slate-300"
                }`}>
                {chip.label}
                {chipCount > 0 && <span className={`text-[9px] ${isActive ? "text-blue-300" : "text-slate-600"}`}>{chipCount}</span>}
              </button>
            );
          })}
          {modeChip && (
            <button onClick={() => setModeChip(null)} className="text-[10px] text-slate-500 hover:text-slate-300 ml-1">초기화</button>
          )}
        </div>
      </div>

      {/* ── 로딩: progressive skeleton (list만, header/search는 이미 보임) ── */}
      {isLoading && (
        <div className="space-y-2">
          {[0,1,2,3,4].map((i) => (
            <div key={i} className="bg-pn rounded-xl border border-bd/80 p-4 space-y-2" style={{ opacity: 1 - i * 0.15 }}>
              <div className="flex items-center gap-2">
                <div className="h-5 w-20 bg-el rounded animate-pulse" />
                <div className="h-4 w-32 bg-el/50 rounded animate-pulse" />
              </div>
              <div className="h-4 w-3/4 bg-el rounded animate-pulse" />
              <div className="h-3 w-1/2 bg-el/30 rounded animate-pulse" />
            </div>
          ))}
        </div>
      )}

      {/* 필터 변경 중 indicator (기존 list 유지) */}
      {isFilterChanging && (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <div className="h-3 w-3 animate-spin rounded-full border border-blue-600 border-t-transparent" />
          필터 적용 중...
        </div>
      )}

      {/* ── 섹션: 즉시 처리 필요 ── */}
      {!isLoading && urgentQuotes.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-400" />
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
            <Clock className="h-4 w-4 text-amber-400" />
            <h2 className="text-sm font-semibold text-slate-200">진행 중</h2>
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-600/15 text-amber-400 text-[10px] font-bold">{inProgressQuotes.length}</span>
          </div>
          {inProgressQuotes.map((quote) => <QuoteCard key={quote.id} quote={quote} />)}
        </div>
      )}

      {/* ── 섹션: 완료 ── */}
      {!isLoading && completedQuotes.length > 0 && (
        <details className="group">
          <summary className="flex items-center gap-2 cursor-pointer list-none select-none">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span className="text-sm font-semibold text-slate-200">완료 / 취소</span>
            <span className="text-xs text-slate-500">({completedQuotes.length}건)</span>
            <span className="ml-1 text-xs text-slate-500 group-open:hidden">▶</span>
            <span className="ml-1 text-xs text-slate-500 hidden group-open:inline">▼</span>
          </summary>
          <div className="mt-2 space-y-2">
            {completedQuotes.map((quote) => <QuoteCard key={quote.id} quote={quote} />)}
          </div>
        </details>
      )}

      {/* ── 빈 상태 ── */}
      {!isLoading && filteredQuotes.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-3">
          <Package className="h-10 w-10 opacity-25" />
          <p className="text-sm">{searchQuery || statusFilter !== "all" || modeChip ? "조건에 맞는 견적이 없습니다" : "아직 견적 요청이 없습니다"}</p>
          {!searchQuery && statusFilter === "all" && !modeChip && (
            <Link href="/test/search"><Button size="sm" className="mt-1 h-8 text-xs bg-blue-600 hover:bg-blue-700">첫 견적 요청하기</Button></Link>
          )}
          {(searchQuery || statusFilter !== "all" || modeChip) && (
            <button onClick={() => { setSearchQuery(""); setStatusFilter("all"); setModeChip(null); }} className="text-xs text-blue-400 hover:underline">필터 초기화</button>
          )}
        </div>
      )}
    </div>
  );
}

export default function QuotesPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    }>
      <QuotesPageContent />
    </Suspense>
  );
}
