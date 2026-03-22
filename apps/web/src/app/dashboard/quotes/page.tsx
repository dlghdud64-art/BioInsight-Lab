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
  AlertTriangle, Sparkles, X, ExternalLink, FileText as FileTextIcon,
} from "lucide-react";
import Link from "next/link";
import { usePermission } from "@/hooks/use-permission";
import { PermissionGate } from "@/components/permission-gate";
import { AiActionButton } from "@/components/ai/ai-action-button";
import { OpsExecutionContext } from "@/components/ops/ops-execution-context";
import { CenterWorkWindow } from "@/components/work-window/center-work-window";
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

// ── Canonical State Enum ──
type RailState = "request_not_sent" | "awaiting_responses" | "response_delayed" | "compare_not_ready" | "compare_review_required" | "condition_check_required" | "external_approval_required" | "ready_for_po_conversion";

function deriveRailState(q: Quote): RailState {
  const rc = q.responses?.length ?? 0;
  if (q.status === "COMPLETED") return "ready_for_po_conversion";
  if (q.status === "RESPONDED") return rc >= 2 ? "compare_review_required" : "compare_not_ready";
  if (q.status === "SENT") {
    if (rc === 0) return isDelayed(q) ? "response_delayed" : "awaiting_responses";
    return rc >= 2 ? "compare_review_required" : "compare_not_ready";
  }
  return "request_not_sent";
}

// ── 상태별 exact 매핑 테이블 ──
type WorkWindowKey = "request_send" | "followup_send" | "compare_review" | "approval_prep" | "po_conversion" | null;

const RAIL_STATE_MAP: Record<RailState, {
  badge: string; headerSummary: string; urgency: string;
  status: string; blocker: string; nextAction: string; compareReady: string; poReady: string;
  snapshotNote: string; handoffTarget: string; handoffStatus: string;
  aiRecommendation: string;
  ctaLabel: string; ctaVariant: "default" | "outline"; secondaryCta: string; tertiaryCta: string;
  actionKey: WorkWindowKey;
}> = {
  request_not_sent: {
    badge: "요청 발송 전", headerSummary: "아직 공급사에 견적 요청이 발송되지 않았습니다", urgency: "첫 액션이 필요합니다",
    status: "요청 생성 완료", blocker: "공급사 미전송", nextAction: "견적 요청 발송", compareReady: "불가 · 수신 견적 없음", poReady: "불가 · 비교 전 단계",
    snapshotNote: "견적 요청이 아직 발송되지 않아 수신 견적이 없습니다",
    handoffTarget: "견적 요청 발송 흐름", handoffStatus: "아직 다음 단계 이동 전",
    aiRecommendation: "AI 추천: 현재는 비교나 검토보다 견적 요청 발송이 우선입니다",
    ctaLabel: "견적 요청 발송", ctaVariant: "default", secondaryCta: "전체 상세 열기", tertiaryCta: "닫기",
    actionKey: "request_send",
  },
  awaiting_responses: {
    badge: "회신 대기", headerSummary: "일부 공급사 응답을 기다리는 중입니다", urgency: "회신 수집 후 비교 가능 여부가 결정됩니다",
    status: "회신 수집 중", blocker: "응답 대기 공급사 존재", nextAction: "회신 확인", compareReady: "불가 · 응답 대기", poReady: "불가 · 회신 수집 단계",
    snapshotNote: "현재 회신 수를 기준으로 비교 가능 여부가 달라질 수 있습니다",
    handoffTarget: "회신 수집 유지", handoffStatus: "유효 견적 확보 후 비교 검토",
    aiRecommendation: "AI 추천: 회신 수집이 끝날 때까지 비교 확정보다 응답 추적이 더 중요합니다",
    ctaLabel: "회신 확인", ctaVariant: "outline", secondaryCta: "전체 상세 열기", tertiaryCta: "닫기",
    actionKey: null,
  },
  response_delayed: {
    badge: "회신 지연", headerSummary: "기대 응답 시점을 넘긴 공급사가 있습니다", urgency: "오늘 재요청 여부 판단이 필요합니다",
    status: "회신 지연", blocker: "기대 응답 기한 경과", nextAction: "재요청 보내기", compareReady: "불안정 · 추가 회신 필요", poReady: "불가 · 응답 확보 전",
    snapshotNote: "회신 지연 공급사를 정리하지 않으면 비교 일정이 밀릴 수 있습니다",
    handoffTarget: "재요청 / 공급사 재확인", handoffStatus: "회신 확보 전 비교 보류",
    aiRecommendation: "AI 추천: 기존 거래 이력이 있다면 신규 탐색보다 재요청이 우선일 수 있습니다",
    ctaLabel: "재요청 보내기", ctaVariant: "default", secondaryCta: "전체 상세 열기", tertiaryCta: "보류",
    actionKey: "followup_send",
  },
  compare_not_ready: {
    badge: "비교 준비 부족", headerSummary: "비교에 필요한 유효 견적 수가 부족합니다", urgency: "추가 회신 확보가 우선입니다",
    status: "비교 준비 부족", blocker: "유효 견적 수 부족", nextAction: "추가 공급사 회신 확보", compareReady: "불가 또는 제한적", poReady: "불가 · 선택안 없음",
    snapshotNote: "유효 견적 수가 부족해 비교 후보가 아직 안정적으로 만들어지지 않았습니다",
    handoffTarget: "추가 회신 확보", handoffStatus: "비교 준비 중",
    aiRecommendation: "AI 추천: 유효 견적 수를 먼저 확보해야 비교 결과의 신뢰도가 올라갑니다",
    ctaLabel: "추가 회신 확보", ctaVariant: "outline", secondaryCta: "전체 상세 열기", tertiaryCta: "보류",
    actionKey: "followup_send",
  },
  compare_review_required: {
    badge: "비교 검토 필요", headerSummary: "비교는 가능하지만 선택안 확정이 남아 있습니다", urgency: "비교 검토 후 다음 단계로 넘길 수 있습니다",
    status: "비교 검토 가능", blocker: "선택안 미확정", nextAction: "비교 결과 정리", compareReady: "가능", poReady: "조건부 · 선택안 확정 필요",
    snapshotNote: "비교는 가능하지만 선택안 확정과 예외 정리가 남아 있습니다",
    handoffTarget: "Compare Review Center", handoffStatus: "선택안 확정 필요",
    aiRecommendation: "AI 추천: 현재는 추가 수집보다 비교 결과 정리와 선택안 확정이 우선입니다",
    ctaLabel: "비교 결과 정리", ctaVariant: "default", secondaryCta: "비교 열기", tertiaryCta: "닫기",
    actionKey: "compare_review",
  },
  condition_check_required: {
    badge: "조건 확인 필요", headerSummary: "문서 또는 조건 이슈가 남아 있어 확정이 불가합니다", urgency: "확인 완료 전에는 다음 단계 진행이 제한됩니다",
    status: "확정 전 조건 확인", blocker: "SDS/CoA/MOQ/납기 조건 확인 필요", nextAction: "조건 확인", compareReady: "가능", poReady: "불가 · 조건 해소 전",
    snapshotNote: "비교 결과는 있으나 문서 또는 조건 확인 전에는 확정할 수 없습니다",
    handoffTarget: "조건 확인 / 문서 정리", handoffStatus: "해소 후 발주 전환 검토 가능",
    aiRecommendation: "AI 추천: 문서나 조건 이슈를 해소하면 바로 다음 단계로 넘길 수 있습니다",
    ctaLabel: "조건 확인", ctaVariant: "default", secondaryCta: "전체 상세 열기", tertiaryCta: "보류",
    actionKey: "compare_review",
  },
  external_approval_required: {
    badge: "외부 승인 필요", headerSummary: "승인 패키지 준비 또는 승인 결과 반영이 필요합니다", urgency: "외부 승인 완료 전에는 발주 전환 불가",
    status: "승인 대기 또는 승인 준비", blocker: "외부 승인 미완료", nextAction: "승인 패키지 준비", compareReady: "완료", poReady: "불가 · 승인 필요",
    snapshotNote: "선택안은 정리되었고 외부 승인 결과만 반영되면 다음 단계로 이동할 수 있습니다",
    handoffTarget: "승인 패키지 준비", handoffStatus: "외부 승인 완료 후 PO 전환",
    aiRecommendation: "AI 추천: 승인 패키지 정리 후 외부 승인 상태만 반영하면 발주 전환으로 이어질 수 있습니다",
    ctaLabel: "승인 패키지 준비", ctaVariant: "default", secondaryCta: "전체 상세 열기", tertiaryCta: "보류",
    actionKey: "approval_prep",
  },
  ready_for_po_conversion: {
    badge: "전환 가능", headerSummary: "차단 없이 발주 전환 준비가 가능한 상태입니다", urgency: "지금 전환하면 다음 처리로 바로 이어집니다",
    status: "전환 준비 완료", blocker: "차단 없음", nextAction: "발주 전환 준비", compareReady: "완료", poReady: "가능",
    snapshotNote: "현재 케이스는 비교와 확인 단계를 통과해 발주 전환 준비가 가능합니다",
    handoffTarget: "PO Conversion Workbench", handoffStatus: "즉시 전환 가능",
    aiRecommendation: "AI 추천: 현재 케이스는 추가 검토보다 발주 전환 준비를 우선해도 됩니다",
    ctaLabel: "발주 전환 준비", ctaVariant: "default", secondaryCta: "전체 상세 열기", tertiaryCta: "닫기",
    actionKey: "po_conversion",
  },
};

// ── 운영 신호 파생 (canonical state 기반) ──
function getOpSignals(q: Quote) {
  const railState = deriveRailState(q);
  const m = RAIL_STATE_MAP[railState];
  const responseCount = q.responses?.length ?? 0;

  let readinessStage = 0;
  if (q.status === "SENT") readinessStage = 1;
  if (q.status === "SENT" && responseCount > 0) readinessStage = 2;
  if (q.status === "RESPONDED") readinessStage = 3;
  if (q.status === "COMPLETED") readinessStage = 4;

  return {
    railState,
    blocker: m.blocker,
    nextAction: m.nextAction,
    summary: m.headerSummary,
    ctaLabel: m.ctaLabel,
    ctaVariant: m.ctaVariant,
    readinessStage,
    aiRecommendation: m.aiRecommendation,
    // Rail-specific fields
    badge: m.badge,
    urgency: m.urgency,
    status: m.status,
    compareReady: m.compareReady,
    poReady: m.poReady,
    snapshotNote: m.snapshotNote,
    handoffTarget: m.handoffTarget,
    handoffStatus: m.handoffStatus,
    secondaryCta: m.secondaryCta,
    tertiaryCta: m.tertiaryCta,
    actionKey: m.actionKey,
  };
}

const READINESS_LABELS = ["요청 생성", "회신 수집", "비교 검토", "전환 준비", "완료"];

// ── 견적 카드 (운영형 density) ──
function QuoteCard({ quote, isSelected, onSelect }: { quote: Quote; isSelected?: boolean; onSelect?: () => void }) {
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
    <div
      className={`bg-pn rounded-xl border transition-colors p-4 cursor-pointer ${
        isSelected ? "border-blue-600/40 ring-1 ring-blue-600/20 bg-blue-600/5"
        : delayed ? "border-red-600/30"
        : "border-bd/80 hover:border-bd"
      }`}
      onClick={onSelect}
    >
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

        {/* State-aware CTA — rail open only, no page navigation */}
        <div className="flex flex-col gap-1.5 flex-shrink-0 min-w-[100px]" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant={signals.ctaVariant}
            className={`h-7 text-xs w-full ${signals.ctaVariant === "default" ? "bg-blue-600 hover:bg-blue-700 text-white" : ""}`}
            onClick={(e) => { e.stopPropagation(); onSelect?.(); }}
          >
            {signals.ctaLabel}
            <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
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
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(searchParams.get("selected") ?? null);
  const [activeWorkWindow, setActiveWorkWindow] = useState<WorkWindowKey>(null);

  // Rail open/close handler — single action key
  const openQuoteContextRail = (caseId: string, source: string = "row") => {
    const next = selectedQuoteId === caseId ? null : caseId;
    if (typeof window !== "undefined") {
      console.log("[QuoteQueue]", next ? "quote_queue_open_rail" : "quote_queue_close_rail", { caseId, source, pathname: window.location.pathname, selectedQuery: next });
    }
    setSelectedQuoteId(next);
  };

  // ESC로 rail 닫기
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setSelectedQuoteId(null); };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

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
  const selectedQuote = selectedQuoteId ? quotes.find(q => q.id === selectedQuoteId) : null;
  const selectedSignals = selectedQuote ? getOpSignals(selectedQuote) : null;
  const selectedOpStatus = selectedQuote ? getOpStatus(selectedQuote) : null;

  // 운영 요약 — canonical state 기반 집계 (row/rail과 같은 selector 사용)
  const quotesWithState = useMemo(() => quotes.map(q => ({ quote: q, state: deriveRailState(q) })), [quotes]);
  const summaryStats = useMemo(() => {
    const waiting = quotesWithState.filter(({ state }) => state === "awaiting_responses" || state === "response_delayed");
    const review = quotesWithState.filter(({ state }) => state === "compare_not_ready" || state === "compare_review_required" || state === "condition_check_required");
    const deadlineToday = quotes.filter(q => q.deliveryDate && new Date(q.deliveryDate).toDateString() === today && q.status !== "COMPLETED" && q.status !== "CANCELLED");
    const convertible = quotesWithState.filter(({ state }) => state === "ready_for_po_conversion");
    return {
      pendingResponse: { count: waiting.length, insight: waiting.length > 0 ? `${waiting.filter(({ state }) => state === "response_delayed").length}건 회신 지연` : "대기 건 없음" },
      needsReview: { count: review.length, insight: review.length > 0 ? "비교 결과 정리 후 전환 가능" : "검토 대상 없음" },
      todayDeadline: { count: deadlineToday.length, insight: deadlineToday.length > 0 ? "납기 영향으로 우선 처리 필요" : "오늘 마감 없음" },
      readyToOrder: { count: convertible.length, insight: convertible.length > 0 ? "차단 없이 다음 단계 이동 가능" : "전환 대상 없음" },
    };
  }, [quotesWithState, quotes, today]);

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

      {/* ═══ Main: List + Quote Context Rail ═══ */}
      <div className="flex gap-0">
      <div className={`flex-1 min-w-0 space-y-4 ${selectedQuote ? "lg:pr-0" : ""}`}>

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
          {urgentQuotes.map((quote) => <QuoteCard key={quote.id} quote={quote} isSelected={selectedQuoteId === quote.id} onSelect={() => openQuoteContextRail(quote.id, "row")} />)}
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
          {inProgressQuotes.map((quote) => <QuoteCard key={quote.id} quote={quote} isSelected={selectedQuoteId === quote.id} onSelect={() => openQuoteContextRail(quote.id, "row")} />)}
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
            {completedQuotes.map((quote) => <QuoteCard key={quote.id} quote={quote} isSelected={selectedQuoteId === quote.id} onSelect={() => openQuoteContextRail(quote.id, "row")} />)}
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

      </div>{/* end list column */}

      {/* ═══ Quote Context Rail (lg+) ═══ */}
      {selectedQuote && selectedSignals && selectedOpStatus && (() => {
        const sqResponseCount = selectedQuote.responses?.length ?? 0;
        const sqDaysSince = Math.floor((Date.now() - new Date(selectedQuote.createdAt).getTime()) / 86400000);
        const sqDelayed = isDelayed(selectedQuote);
        const sqDeadline = selectedQuote.deliveryDate ? new Date(selectedQuote.deliveryDate) : null;
        const sqDaysToDeadline = sqDeadline ? Math.ceil((sqDeadline.getTime() - Date.now()) / 86400000) : null;

        return (
        <div className="hidden lg:flex w-[380px] shrink-0 border-l border-bd flex-col bg-pn ml-5 rounded-xl overflow-hidden self-start sticky top-20" style={{ maxHeight: "calc(100vh - 120px)" }}>
          {/* A. Rail header */}
          <div className="px-4 py-3 border-b border-bd bg-el/50">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border font-medium ${selectedOpStatus.bg} ${selectedOpStatus.text} ${selectedOpStatus.border}`}>
                  {selectedSignals.badge}
                </span>
                <span className="text-[10px] text-slate-500 font-mono">#{selectedQuote.id.slice(0, 8).toUpperCase()}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Link href={`/quotes/${selectedQuote.id}`}>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-slate-500 hover:text-slate-300" title="전체 상세 열기"><ExternalLink className="h-3 w-3" /></Button>
                </Link>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-slate-500 hover:text-slate-300" onClick={() => setSelectedQuoteId(null)}><X className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
            <h3 className="text-sm font-semibold text-slate-100 truncate mb-1">{selectedQuote.title}</h3>
            <p className="text-[10px] text-slate-500">{selectedQuote.items.length}건 · 회신 {sqResponseCount}/{selectedQuote.items.length} · {sqDaysSince === 0 ? "오늘" : `${sqDaysSince}일 전`}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{selectedSignals.urgency}</p>
          </div>

          {/* Rail scrollable body */}
          <div className="flex-1 overflow-y-auto">

          {/* B. Operating summary — 5 canonical fields */}
          <div className="px-4 py-3 border-b border-bd/50">
            <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-2">운영 요약</div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs"><span className="text-slate-400">현재 상태</span><span className="text-slate-200 font-medium">{selectedSignals.status}</span></div>
              <div className="flex justify-between text-xs"><span className="text-slate-400">차단/위험</span><span className={selectedSignals.blocker === "차단 없음" ? "text-emerald-400" : "text-amber-400"}>{selectedSignals.blocker}</span></div>
              <div className="flex justify-between text-xs"><span className="text-slate-400">다음 액션</span><span className="text-slate-200">{selectedSignals.nextAction}</span></div>
              <div className="flex justify-between text-xs"><span className="text-slate-400">비교 가능</span><span className={selectedSignals.compareReady === "가능" || selectedSignals.compareReady === "완료" ? "text-emerald-400" : "text-slate-500"}>{selectedSignals.compareReady}</span></div>
              <div className="flex justify-between text-xs"><span className="text-slate-400">전환 readiness</span><span className={selectedSignals.poReady === "가능" ? "text-emerald-400" : "text-slate-500"}>{selectedSignals.poReady}</span></div>
            </div>
          </div>

          {/* C. Response / Compare snapshot */}
          <div className="px-4 py-3 border-b border-bd/50">
            <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-2">회신 · 비교 현황</div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs"><span className="text-slate-400">수신 견적</span><span className="text-slate-200">{sqResponseCount}건</span></div>
              <div className="flex justify-between text-xs"><span className="text-slate-400">회신 대기</span><span className={selectedQuote.status === "SENT" && sqResponseCount === 0 ? "text-amber-400" : "text-slate-500"}>{selectedQuote.status === "SENT" ? `${selectedQuote.items.length - sqResponseCount}건` : "—"}</span></div>
              <div className="flex justify-between text-xs"><span className="text-slate-400">선택안</span><span className="text-slate-500">{selectedQuote.status === "COMPLETED" ? "확정됨" : "미확정"}</span></div>
            </div>
            <p className="text-[10px] text-slate-500 mt-2 leading-snug">{selectedSignals.snapshotNote}</p>
            <div className="mt-2 space-y-1">
              {selectedQuote.items.slice(0, 3).map(item => (
                <div key={item.id} className="flex justify-between text-[11px]">
                  <span className="text-slate-300 truncate max-w-[200px]">{item.product.name}</span>
                  <span className="text-slate-500 shrink-0">×{item.quantity}</span>
                </div>
              ))}
              {selectedQuote.items.length > 3 && <p className="text-[10px] text-slate-500">+{selectedQuote.items.length - 3}건 더</p>}
            </div>
          </div>

          {/* D. Activity snapshot */}
          <div className="px-4 py-3 border-b border-bd/50">
            <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-2">최근 활동</div>
            <div className="space-y-1.5">
              <div className="flex items-start gap-2 text-[11px]">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                <div><span className="text-slate-300">요청 생성</span><span className="text-slate-500 ml-1.5">{sqDaysSince === 0 ? "오늘" : `${sqDaysSince}일 전`}</span></div>
              </div>
              {selectedQuote.status !== "PENDING" && (
                <div className="flex items-start gap-2 text-[11px]">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                  <div><span className="text-slate-300">견적 요청 발송</span></div>
                </div>
              )}
              {sqResponseCount > 0 && (
                <div className="flex items-start gap-2 text-[11px]">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                  <div><span className="text-slate-300">회신 {sqResponseCount}건 도착</span></div>
                </div>
              )}
              {selectedQuote.status === "RESPONDED" && (
                <div className="flex items-start gap-2 text-[11px]">
                  <span className="h-1.5 w-1.5 rounded-full bg-purple-400 mt-1.5 shrink-0" />
                  <div><span className="text-slate-300">비교 검토 필요</span></div>
                </div>
              )}
              {selectedQuote.status === "PENDING" && (
                <div className="flex items-start gap-2 text-[11px]">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-600 mt-1.5 shrink-0" />
                  <div><span className="text-slate-500">첫 액션: 견적 요청 발송</span></div>
                </div>
              )}
            </div>
          </div>

          {/* E. Decision summary + AI */}
          <div className="px-4 py-3 border-b border-bd/50">
            <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-1.5">판단 요약</div>
            <p className="text-xs text-slate-300 leading-relaxed">{selectedSignals.summary}</p>
            {selectedSignals.aiRecommendation && (
              <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-1.5">
                <Sparkles className="h-3 w-3 text-slate-600 shrink-0" />{selectedSignals.aiRecommendation}
              </p>
            )}
          </div>

          {/* F. Related handoff */}
          <div className="px-4 py-3">
            <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-1.5">연결 작업</div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs"><span className="text-slate-400">승인 정책</span><span className="text-slate-500">없음</span></div>
              <div className="flex justify-between text-xs"><span className="text-slate-400">외부 승인</span><span className="text-slate-500">불필요</span></div>
              <div className="flex justify-between text-xs"><span className="text-slate-400">다음 연결</span><span className="text-slate-200">{selectedSignals.handoffTarget}</span></div>
              <div className="flex justify-between text-xs"><span className="text-slate-400">handoff</span><span className={selectedSignals.poReady === "가능" ? "text-emerald-400" : "text-amber-400"}>{selectedSignals.handoffStatus}</span></div>
            </div>
          </div>

          </div>{/* end scrollable body */}

          {/* G. Bottom sticky action — 3 canonical CTA (rail-first, no default page nav) */}
          <div className="px-4 py-3 border-t border-bd bg-el/30 space-y-1.5">
            <Button size="sm" className={`w-full h-8 text-xs font-medium ${selectedSignals.ctaVariant === "default" ? "bg-blue-600 hover:bg-blue-500 text-white" : "border-bd text-slate-300"}`}
              onClick={() => {
                if (selectedSignals.actionKey) {
                  console.log("[QuoteQueue] quote_rail_cta_clicked", { caseId: selectedQuote.id, actionKey: selectedSignals.actionKey, uiState: selectedSignals.railState });
                  setActiveWorkWindow(selectedSignals.actionKey);
                }
              }}
              disabled={!selectedSignals.actionKey}>
              {selectedSignals.ctaLabel}<ArrowRight className="h-3 w-3 ml-1.5" />
            </Button>
            <div className="flex gap-1.5">
              <Link href={`/quotes/${selectedQuote.id}`} className="flex-1">
                <Button size="sm" variant="outline" className="w-full h-7 text-[10px] text-slate-400 border-bd">전체 상세 열기</Button>
              </Link>
              <Button size="sm" variant="ghost" className="flex-1 h-7 text-[10px] text-slate-500" onClick={() => setSelectedQuoteId(null)}>{selectedSignals.tertiaryCta}</Button>
            </div>
          </div>
        </div>
        );
      })()}

      </div>{/* end flex container */}

      {/* ═══ Center Work Window — rail CTA에서 열리는 task surface ═══ */}
      {activeWorkWindow && selectedQuote && selectedSignals && (
        <CenterWorkWindow
          open={true}
          onClose={() => setActiveWorkWindow(null)}
          title={selectedSignals.ctaLabel}
          subtitle={`${selectedQuote.title} · ${selectedSignals.badge}`}
          phase="ready"
          primaryAction={{
            label: selectedSignals.ctaLabel,
            onClick: () => {
              console.log("[QuoteQueue] quote_work_window_action", { caseId: selectedQuote.id, actionKey: activeWorkWindow });
              setActiveWorkWindow(null);
            },
          }}
          secondaryAction={{ label: "닫기", onClick: () => setActiveWorkWindow(null) }}
        >
          <div className="space-y-4">
            {/* Work window header context */}
            <div className="rounded-lg border border-bd bg-pn p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border font-medium ${selectedOpStatus?.bg} ${selectedOpStatus?.text} ${selectedOpStatus?.border}`}>
                  {selectedSignals.badge}
                </span>
                <span className="text-xs text-slate-400">#{selectedQuote.id.slice(0, 8).toUpperCase()}</span>
              </div>
              <h3 className="text-sm font-semibold text-slate-100 mb-1">{selectedQuote.title}</h3>
              <p className="text-xs text-slate-400">{selectedSignals.summary}</p>
            </div>

            {/* Action-specific content */}
            {activeWorkWindow === "request_send" && (
              <div className="rounded-lg border border-bd bg-pn p-4 space-y-3">
                <p className="text-xs font-medium text-slate-200">견적 요청 발송</p>
                <p className="text-xs text-slate-400">선택한 공급사에 견적 요청을 발송합니다. 발송 후 회신 수집이 시작됩니다.</p>
                <div className="text-xs text-slate-500">품목: {selectedQuote.items.length}건</div>
              </div>
            )}
            {activeWorkWindow === "followup_send" && (
              <div className="rounded-lg border border-bd bg-pn p-4 space-y-3">
                <p className="text-xs font-medium text-slate-200">재요청 / 추가 회신 확보</p>
                <p className="text-xs text-slate-400">미응답 공급사에 재요청하거나 추가 공급사를 탐색합니다.</p>
                <div className="text-xs text-slate-500">현재 회신: {selectedQuote.responses?.length ?? 0}건</div>
              </div>
            )}
            {activeWorkWindow === "compare_review" && (
              <div className="rounded-lg border border-bd bg-pn p-4 space-y-3">
                <p className="text-xs font-medium text-slate-200">비교 결과 정리</p>
                <p className="text-xs text-slate-400">수신된 견적을 비교하고 선택안을 확정합니다. blocker가 있으면 해소한 뒤 다음 단계로 넘깁니다.</p>
                <div className="text-xs text-slate-500">비교 대상: {selectedQuote.responses?.length ?? 0}건</div>
              </div>
            )}
            {activeWorkWindow === "approval_prep" && (
              <div className="rounded-lg border border-bd bg-pn p-4 space-y-3">
                <p className="text-xs font-medium text-slate-200">승인 패키지 준비</p>
                <p className="text-xs text-slate-400">외부 승인에 필요한 정보를 정리하고 전달 상태를 기록합니다.</p>
              </div>
            )}
            {activeWorkWindow === "po_conversion" && (
              <div className="rounded-lg border border-bd bg-pn p-4 space-y-3">
                <p className="text-xs font-medium text-slate-200">발주 전환 준비</p>
                <p className="text-xs text-slate-400">line item을 확정하고 발주 조건을 검토한 뒤 PO를 생성합니다.</p>
                <div className="text-xs text-slate-500">품목: {selectedQuote.items.length}건</div>
              </div>
            )}

            {/* AI recommendation */}
            {selectedSignals.aiRecommendation && (
              <p className="text-[10px] text-slate-500 flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-slate-600 shrink-0" />{selectedSignals.aiRecommendation}
              </p>
            )}
          </div>
        </CenterWorkWindow>
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
