"use client";

export const dynamic = 'force-dynamic';

import { csrfFetch } from "@/lib/api-client";
import { MobileOperationalBriefSheet } from "@/components/operational-brief/mobile-bottom-sheet";
import { OperationalBriefFloatingEntry } from "@/components/operational-brief/floating-entry";
import { MetricCell } from "@/components/operational-brief/metric-cell";
import { invalidateBriefNarrative, useOperationalBriefNarrative } from "@/lib/hooks/use-operational-brief";
import { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search, Filter, Package, CheckCircle2, Clock, AlertCircle, Send, FileCheck2, ArrowRight, Plus, RefreshCw, AlertTriangle, Sparkles, X, ExternalLink, FileText as FileTextIcon, Loader2, Upload, ChevronDown, ChevronUp } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { RelativeTimeText } from "@/components/ui/relative-time-text";
import { NoSSR } from "@/components/ui/no-ssr";
import { VendorRequestModal } from "@/components/quotes/dispatch/vendor-dispatch-workbench";
import { resolveSuppliers, buildDraftMessage } from "@/components/quotes/dispatch/resolve-suppliers";
import { BatchActionBar } from "@/components/quotes/dispatch/batch-action-bar";
import { BatchDispatchSheet } from "@/components/quotes/dispatch/batch-dispatch-sheet";
import Link from "next/link";
import { usePermission } from "@/hooks/use-permission";
import { useOntologyContextBridge } from "@/hooks/use-ontology-context-bridge";
import { PermissionGate } from "@/components/permission-gate";
import { OpsExecutionContext } from "@/components/ops/ops-execution-context";
import { CenterWorkWindow } from "@/components/work-window/center-work-window";
import { AiQuoteParseModal } from "@/components/quotes/ai-quote-parse-modal";
import { QuoteIntakeDock } from "@/components/quotes/intake/quote-intake-dock";

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
  // §11.218 카드 구분자 — sub-context 표시용 (요청자 / 부서).
  user?: { id: string; name: string | null; email: string | null } | null;
  organization?: { id: string; name: string } | null;
}

// ── 운영 상태 파생 ──────────────────────────────────────────
function isDelayed(q: Quote): boolean {
  if (!q.deliveryDate) return false;
  if (q.status === "COMPLETED" || q.status === "CANCELLED") return false;
  return new Date(q.deliveryDate) < new Date();
}

const OP_STATUS: Record<string, { label: string; bg: string; text: string; border: string; leftBorder: string }> = {
  지연:           { label: "지연",            bg: "bg-red-600/10",     text: "text-red-600",     border: "border-red-600/30",   leftBorder: "border-l-red-500" },
  비교_검토:      { label: "비교 검토 필요",  bg: "bg-purple-50",  text: "text-purple-700",  border: "border-purple-200",   leftBorder: "border-l-purple-500" },
  일부_회신:      { label: "일부 회신 도착",  bg: "bg-blue-600/10",    text: "text-blue-600",    border: "border-blue-600/30",  leftBorder: "border-l-blue-500" },
  회신_대기:      { label: "회신 대기 중",    bg: "bg-amber-600/10",   text: "text-amber-600",   border: "border-amber-600/30", leftBorder: "border-l-amber-500" },
  요청_접수:      { label: "요청 접수",       bg: "bg-el",             text: "text-slate-400",   border: "border-bd",           leftBorder: "border-l-slate-300" },
  발주_완료:      { label: "발주 완료",       bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200",  leftBorder: "border-l-emerald-500" },
  취소됨:         { label: "취소됨",          bg: "bg-red-600/5",      text: "text-red-600",     border: "border-red-600/20",   leftBorder: "border-l-red-300" },
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
  ctaLabel: string; railCtaLabel: string; ctaVariant: "default" | "outline"; secondaryCta: string; tertiaryCta: string;
  actionKey: WorkWindowKey;
}> = {
  request_not_sent: {
    badge: "요청 발송 전", headerSummary: "아직 공급사에 견적 요청이 발송되지 않았습니다", urgency: "첫 액션이 필요합니다",
    status: "요청 생성 완료", blocker: "공급사 미전송", nextAction: "견적 요청 발송", compareReady: "불가 · 수신 견적 없음", poReady: "불가 · 비교 전 단계",
    snapshotNote: "견적 요청이 아직 발송되지 않아 수신 견적이 없습니다",
    handoffTarget: "견적 요청 발송 흐름", handoffStatus: "아직 다음 단계 이동 전",
    aiRecommendation: "AI 추천: 현재는 비교나 검토보다 견적 요청 발송이 우선입니다",
    ctaLabel: "견적 요청 발송", railCtaLabel: "견적 요청 발송", ctaVariant: "default", secondaryCta: "전체 상세 열기", tertiaryCta: "닫기",
    actionKey: "request_send",
  },
  awaiting_responses: {
    badge: "회신 대기", headerSummary: "공급사 회신을 기다리는 중입니다 — 새 회신이 도착하면 비교 검토로 넘어갑니다", urgency: "새 회신 도착 여부 확인이 필요합니다",
    status: "회신 수집 중", blocker: "응답 대기 공급사 존재", nextAction: "새 회신 확인", compareReady: "불가 · 응답 대기", poReady: "불가 · 회신 수집 단계",
    snapshotNote: "현재 회신 수를 기준으로 비교 가능 여부가 달라질 수 있습니다",
    handoffTarget: "회신 수집 유지", handoffStatus: "유효 견적 확보 후 비교 검토",
    aiRecommendation: "AI 추천: 회신 수집이 끝날 때까지 비교 확정보다 응답 추적이 더 중요합니다",
    ctaLabel: "새 회신 보기", railCtaLabel: "회신 검토 시작", ctaVariant: "outline", secondaryCta: "전체 상세 열기", tertiaryCta: "닫기",
    actionKey: "compare_review",
  },
  response_delayed: {
    badge: "회신 지연", headerSummary: "기대 응답 시점을 넘긴 공급사가 있습니다", urgency: "오늘 재요청 여부 판단이 필요합니다",
    status: "회신 지연", blocker: "기대 응답 기한 경과", nextAction: "재요청 보내기", compareReady: "불안정 · 추가 회신 필요", poReady: "불가 · 응답 확보 전",
    snapshotNote: "회신 지연 공급사를 정리하지 않으면 비교 일정이 밀릴 수 있습니다",
    handoffTarget: "재요청 / 공급사 재확인", handoffStatus: "회신 확보 전 비교 보류",
    aiRecommendation: "AI 추천: 기존 거래 이력이 있다면 신규 탐색보다 재요청이 우선일 수 있습니다",
    ctaLabel: "재요청 보내기", railCtaLabel: "재요청 검토 시작", ctaVariant: "default", secondaryCta: "전체 상세 열기", tertiaryCta: "보류",
    actionKey: "followup_send",
  },
  compare_not_ready: {
    badge: "비교 준비 부족", headerSummary: "비교에 필요한 유효 견적 수가 부족합니다", urgency: "추가 회신 확보가 우선입니다",
    status: "비교 준비 부족", blocker: "유효 견적 수 부족", nextAction: "추가 공급사 회신 확보", compareReady: "불가 또는 제한적", poReady: "불가 · 선택안 없음",
    snapshotNote: "유효 견적 수가 부족해 비교 후보가 아직 안정적으로 만들어지지 않았습니다",
    handoffTarget: "추가 회신 확보", handoffStatus: "비교 준비 중",
    aiRecommendation: "AI 추천: 유효 견적 수를 먼저 확보해야 비교 결과의 신뢰도가 올라갑니다",
    ctaLabel: "추가 회신 확보", railCtaLabel: "추가 확보 검토", ctaVariant: "outline", secondaryCta: "전체 상세 열기", tertiaryCta: "보류",
    actionKey: "followup_send",
  },
  compare_review_required: {
    badge: "비교 검토 필요", headerSummary: "비교는 가능하지만 선택안 확정이 남아 있습니다", urgency: "비교 검토 후 다음 단계로 넘길 수 있습니다",
    status: "비교 검토 가능", blocker: "선택안 미확정", nextAction: "비교 결과 정리", compareReady: "가능", poReady: "조건부 · 선택안 확정 필요",
    snapshotNote: "비교는 가능하지만 선택안 확정과 예외 정리가 남아 있습니다",
    handoffTarget: "비교 검토 확정", handoffStatus: "선택안 확정 필요",
    aiRecommendation: "AI 추천: 현재는 추가 수집보다 비교 결과 정리와 선택안 확정이 우선입니다",
    ctaLabel: "비교 결과 정리", railCtaLabel: "비교 검토 시작", ctaVariant: "default", secondaryCta: "비교 열기", tertiaryCta: "닫기",
    actionKey: "compare_review",
  },
  condition_check_required: {
    badge: "조건 확인 필요", headerSummary: "문서 또는 조건 이슈가 남아 있어 확정이 불가합니다", urgency: "확인 완료 전에는 다음 단계 진행이 제한됩니다",
    status: "확정 전 조건 확인", blocker: "SDS/CoA/MOQ/납기 조건 확인 필요", nextAction: "조건 확인", compareReady: "가능", poReady: "불가 · 조건 해소 전",
    snapshotNote: "비교 결과는 있으나 문서 또는 조건 확인 전에는 확정할 수 없습니다",
    handoffTarget: "조건 확인 / 문서 정리", handoffStatus: "해소 후 발주 실행 검토 가능",
    aiRecommendation: "AI 추천: 문서나 조건 이슈를 해소하면 바로 다음 단계로 넘길 수 있습니다",
    ctaLabel: "조건 확인", railCtaLabel: "조건 검토 시작", ctaVariant: "default", secondaryCta: "전체 상세 열기", tertiaryCta: "보류",
    actionKey: "compare_review",
  },
  external_approval_required: {
    badge: "외부 승인 대기", headerSummary: "외부 승인 결과 확인 후 발주 실행으로 이어집니다", urgency: "외부 승인 확인 전에는 발주 실행 불가",
    status: "외부 승인 확인 대기", blocker: "외부 승인 미확인", nextAction: "승인 증빙 연결", compareReady: "완료", poReady: "불가 · 승인 확인 필요",
    snapshotNote: "선택안은 정리되었고 외부 승인 결과만 연결되면 다음 단계로 이동할 수 있습니다",
    handoffTarget: "승인 증빙 연결", handoffStatus: "외부 승인 확인 후 발주 실행",
    aiRecommendation: "AI 추천: 외부 승인 결과를 연결하면 발주 실행으로 바로 이어질 수 있습니다",
    ctaLabel: "승인 증빙 연결", railCtaLabel: "승인 검토 시작", ctaVariant: "default", secondaryCta: "전체 상세 열기", tertiaryCta: "보류",
    actionKey: "approval_prep",
  },
  ready_for_po_conversion: {
    badge: "전환 가능", headerSummary: "차단 없이 발주 전환 준비가 가능한 상태입니다", urgency: "지금 전환하면 다음 처리로 바로 이어집니다",
    status: "실행 준비 완료", blocker: "차단 없음", nextAction: "발주 실행 준비", compareReady: "완료", poReady: "가능",
    snapshotNote: "현재 케이스는 비교와 확인 단계를 통과해 발주 실행 준비가 가능합니다",
    handoffTarget: "발주 실행 워크벤치", handoffStatus: "즉시 실행 가능",
    aiRecommendation: "AI 추천: 현재 케이스는 추가 검토보다 발주 실행 준비를 우선해도 됩니다",
    ctaLabel: "발주 실행 준비", railCtaLabel: "발주 실행 검토", ctaVariant: "default", secondaryCta: "전체 상세 열기", tertiaryCta: "닫기",
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
    railCtaLabel: m.railCtaLabel,
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

type QuoteDispatchPreflight = {
  hardBlocked: boolean;
  summary: string;
  blockers: string[];
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// #user-supplier-registration Phase 5 — organizationVendors optional param.
//   resolveSuppliers 의 org_book source 정합 — operator 직접 등록한 거래처
//   가 있으면 preflight 의 includedSuppliers 에 자동 포함.
function getQuoteDispatchPreflight(
  q: Quote | null,
  organizationVendors: Array<{
    id: string;
    vendorName: string;
    vendorEmail: string;
    vendorPhone?: string | null;
    isPrimary?: boolean;
    notes?: string | null;
  }> = [],
): QuoteDispatchPreflight {
  if (!q) {
    return {
      hardBlocked: true,
      summary: "견적을 먼저 선택해야 합니다.",
      blockers: ["견적 선택 없음"],
    };
  }

  const suppliers = resolveSuppliers({ quote: q, organizationVendors, organizationVendorProducts });
  const includedSuppliers = suppliers.filter((supplier) => supplier.included);
  const invalidContacts = includedSuppliers.filter((supplier) => !EMAIL_PATTERN.test(supplier.email));
  const blockers: string[] = [];

  if (!q.id) blockers.push("견적 연결 없음");
  if (includedSuppliers.length === 0) blockers.push("연락 가능한 공급사 후보 없음");
  if (invalidContacts.length > 0) blockers.push(`연락 채널 확인 필요 ${invalidContacts.length}건`);

  return {
    hardBlocked: blockers.length > 0,
    blockers,
    summary: blockers.length > 0
      ? blockers.join(" · ")
      : `${includedSuppliers.length}개 공급사 후보 전달 가능`,
  };
}

const READINESS_LABELS = ["요청 생성", "회신 수집", "비교 검토", "전환 준비", "완료"];

// ── 견적 카드 (운영형 density) ──
// §11.217 Phase 3 — batch dispatch selection props.
//   isSelectable: PENDING (request_not_sent) state quote 만 true.
//   isSelectedForBatch: selectedQuoteIds.has(quote.id) 결과.
//   onToggleSelect: page-level toggleQuoteSelection handler.
function QuoteCard({
  quote,
  isSelected,
  onSelect,
  isSelectable,
  isSelectedForBatch,
  onToggleSelect,
}: {
  quote: Quote;
  isSelected?: boolean;
  onSelect?: () => void;
  isSelectable?: boolean;
  isSelectedForBatch?: boolean;
  onToggleSelect?: () => void;
}) {
  const opStatus = getOpStatus(quote);
  const signals = getOpSignals(quote);
  const itemCount = quote.items.length;
  const responseCount = quote.responses?.length ?? 0;
  const prices = (quote.responses ?? []).map(r => r.totalPrice).filter((p): p is number => typeof p === "number" && p > 0);
  const minPrice = prices.length ? Math.min(...prices) : null;
  const delayed = isDelayed(quote);
  const quoteRef = `#${quote.id.slice(0, 8).toUpperCase()}`;
  // §11.212 — daysSinceCreated 인라인 계산 제거 (SSR-CSR Date.now() drift 차단).
  // <RelativeTimeText iso={quote.createdAt} /> 가 useEffect mount 후 set.

  // §11.217 Phase 1 (Issue 1) — 카드 제목 정보 밀도 복구.
  // 기존: quote.title ("견적 요청 — N개 품목" generic) → 사용자가 카드 식별 불가.
  // 신규: 첫 품목명 + 추가 건수. snapshot path (productId null, item.name 보존)
  //       및 canonical path (item.product.name) 양쪽 fallback.
  const firstItem = quote.items[0];
  const firstItemName =
    firstItem?.product?.name ??
    (firstItem as { name?: string | null } | undefined)?.name ??
    null;
  const moreCount = Math.max(0, itemCount - 1);
  const displayTitle = firstItemName
    ? moreCount > 0
      ? `${firstItemName} 외 ${moreCount}건`
      : firstItemName
    : quote.title;

  return (
    <div
      data-testid="quote-request-card"
      className={`bg-pn rounded-xl border border-l-[3px] transition-all duration-200 p-4 cursor-pointer hover:shadow-md hover:-translate-y-0.5 animate-stagger-up ${opStatus.leftBorder} ${
        isSelectedForBatch ? "border-violet-500/60 ring-1 ring-violet-500/30 bg-violet-50/40"
        : isSelected ? "border-blue-600/40 ring-1 ring-blue-600/20 bg-blue-600/5"
        : delayed ? "border-red-600/30"
        : "border-bd/80 hover:border-bd"
      }`}
      onClick={onSelect}
    >
      {/* §11.217 Phase 3 — batch dispatch checkbox (PENDING quote 만 노출) */}
      {isSelectable && (
        <div className="flex items-center gap-2 mb-2" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={!!isSelectedForBatch}
            onChange={onToggleSelect}
            onClick={(e) => e.stopPropagation()}
            className="h-4 w-4 rounded border-slate-300 text-violet-600 focus-visible:ring-2 focus-visible:ring-violet-500 cursor-pointer"
            aria-label={`${displayTitle} 일괄 발송 선택`}
          />
          <span className="sr-only">일괄 발송 선택</span>
          {isSelectedForBatch && (
            <span className="text-[11px] text-violet-700 font-medium">선택됨</span>
          )}
        </div>
      )}

      {/* 운영 신호 3종 — 최상단 */}
      <div className="flex items-center gap-1.5 sm:gap-2 mb-2 flex-wrap">
        <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded border ${opStatus.bg} ${opStatus.text} ${opStatus.border}`}>
          {(quote.status === "SENT" || quote.status === "PENDING") && !delayed && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
            </span>
          )}
          {opStatus.label}
        </span>
        {signals.blocker && (
          <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded bg-amber-600/10 text-amber-600 border border-amber-600/20">
            <AlertTriangle className="h-2.5 w-2.5" />{signals.blocker.length > 25 ? signals.blocker.substring(0, 25) + "…" : signals.blocker}
          </span>
        )}
        <span className="text-[11px] text-slate-500 font-mono ml-auto">{quoteRef}</span>
      </div>

      <div className="flex flex-col sm:flex-row items-start gap-2 sm:gap-3">
        <div className="flex-1 min-w-0 w-full">
          {/* 제목 — §11.217 Phase 1 (Issue 1): 첫 품목명 (사용자 식별 가능) */}
          <h3 className="font-semibold text-slate-900 text-sm leading-snug truncate mb-1">{displayTitle}</h3>

          {/* §11.218 카드 구분자 (sub-context disambiguation) — 같은 품목 다른 quote 식별.
              요청자 (quote.user.name) + 부서/조직 (quote.organization.name) 노출.
              둘 다 부재 시 row 0 (no-op render). */}
          {(quote.user?.name || quote.organization?.name) && (
            <p className="text-[11px] text-slate-500 mb-1 truncate">
              {quote.user?.name && (
                <span className="font-medium text-slate-600">{quote.user.name}</span>
              )}
              {quote.user?.name && quote.organization?.name && (
                <span className="mx-1 text-slate-400">·</span>
              )}
              {quote.organization?.name && (
                <span>{quote.organization.name}</span>
              )}
            </p>
          )}

          {/* Decision summary sentence */}
          <p className="text-xs text-slate-400 leading-relaxed mb-1 line-clamp-2">{signals.summary}</p>
          {/* §11.217 Phase 1 (Issue 5) — inline AI 추천 row 4번 반복 제거.
              page-top banner 1회 (별도 단계) 로 통합 예정. */}

          {/* 운영형 메타 — triage 우선 */}
          <div className="flex flex-wrap gap-x-2 sm:gap-x-3 gap-y-1">
            <span className="text-[11px] text-slate-500 flex items-center gap-1">
              <Package className="h-3 w-3" />{itemCount}건
            </span>
            <span className={`text-[11px] flex items-center gap-1 ${responseCount > 0 ? "text-blue-600 font-medium" : "text-slate-500"}`}>
              <Send className="h-3 w-3" />{responseCount > 0 ? `회신 ${responseCount}` : "미회신"}
            </span>
            {minPrice !== null && (
              <span className="text-[11px] text-slate-700 font-medium">₩{minPrice.toLocaleString("ko-KR")}</span>
            )}
            <RelativeTimeText iso={quote.createdAt} className="text-[11px] text-slate-500" />
            {quote.deliveryDate && (
              <span className={`text-[11px] flex items-center gap-1 ${delayed ? "text-red-600 font-semibold" : "text-slate-500"}`}>
                <Clock className="h-3 w-3" />납기 {new Date(quote.deliveryDate).toLocaleDateString("ko-KR")}
              </span>
            )}
          </div>
        </div>

        {/* State-aware CTA — 모바일: 가로 전폭, sm+: 오른쪽 세로 */}
        <div className="flex sm:flex-col gap-1.5 flex-shrink-0 w-full sm:w-auto sm:min-w-[100px]" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant={signals.ctaVariant}
            className={`h-9 sm:h-7 text-xs flex-1 sm:flex-none sm:w-full ${signals.ctaVariant === "default" ? "bg-blue-600 hover:bg-blue-700 text-white" : ""}`}
            onClick={(e) => { e.stopPropagation(); onSelect?.(); }}
          >
            {signals.ctaLabel}
            <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
          {/* 다음 액션 힌트 — 모바일에서는 숨김 */}
          <span className="text-[9px] text-slate-500 text-center hidden sm:block">다음: {signals.nextAction}</span>
        </div>
      </div>

      {/* §11.217 Phase 4 — 회신 수집 progress bar.
          quote card 의 readiness strip 직전에 inline 진행률 시각화.
          PENDING hide (회신 의미 없음) — SENT/RESPONDED 만 노출.
          color: 0% slate, partial blue, 완료(N≥M) emerald. */}
      {(quote.status === "SENT" || quote.status === "RESPONDED") && itemCount > 0 && (
        <div className="mt-2.5 flex items-center gap-2" aria-label="회신 수집 진행률">
          <span className="text-[10px] font-medium text-slate-600 shrink-0 tabular-nums">
            회신 {responseCount}/{itemCount}
          </span>
          <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              role="progressbar"
              aria-valuenow={responseCount}
              aria-valuemin={0}
              aria-valuemax={itemCount}
              aria-label={`회신 ${responseCount}/${itemCount}`}
              className={`h-full rounded-full transition-all ${
                responseCount === 0
                  ? "bg-slate-200"
                  : responseCount >= itemCount
                    ? "bg-emerald-500"
                    : "bg-blue-500"
              }`}
              style={{
                width: `${Math.min(100, (responseCount / itemCount) * 100)}%`,
              }}
            />
          </div>
          {responseCount >= itemCount && (
            <span className="text-[10px] font-medium text-emerald-700 shrink-0">완료</span>
          )}
        </div>
      )}

      {/* Readiness strip */}
      <div className="mt-3 pt-2.5 border-t border-bd/50">
        <div className="flex items-center gap-0.5 sm:gap-1">
          {READINESS_LABELS.map((label, idx) => {
            const active = idx <= signals.readinessStage;
            const current = idx === signals.readinessStage;
            return (
              <div key={label} className="flex flex-col items-center gap-0.5 sm:gap-1 flex-1 min-w-0">
                <div className={`h-1.5 sm:h-2 w-full rounded-full transition-all ${
                  active
                    ? current ? "bg-blue-500 shadow-sm shadow-blue-200" : "bg-emerald-500/50"
                    : "bg-slate-100"
                }`} />
                <span className={`text-[9px] sm:text-[8px] leading-tight whitespace-nowrap ${current ? "text-blue-600 font-semibold" : active ? "text-emerald-600/60" : "text-slate-300"}`}>{label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 운영 실행 현황 */}
      <OpsExecutionContext entityType="QUOTE" entityId={quote.id} compact className="mt-2.5 pt-2.5 border-t border-bd/50" />
    </div>
  );
}

// ── Operating mode chips ──
// Mode chips — canonical state 기반 operator lens
const RESPONSE_TRACK_STATES = new Set(["request_not_sent", "awaiting_responses", "response_delayed"]);
const BLOCKED_STATES = new Set(["condition_check_required", "external_approval_required", "compare_not_ready"]);
const COMPARE_STATES = new Set(["compare_not_ready", "compare_review_required", "condition_check_required"]);

const MODE_CHIPS = [
  { key: "urgent",      label: "우선 처리",  filter: (q: Quote) => { const s = deriveRailState(q); return s === "response_delayed" || s === "condition_check_required" || s === "external_approval_required" || (q.deliveryDate && new Date(q.deliveryDate).toDateString() === new Date().toDateString()); } },
  { key: "blocked",     label: "차단 있음",  filter: (q: Quote) => BLOCKED_STATES.has(deriveRailState(q)) },
  { key: "today",       label: "오늘 처리",  filter: (q: Quote) => q.deliveryDate && new Date(q.deliveryDate).toDateString() === new Date().toDateString() && q.status !== "COMPLETED" && q.status !== "CANCELLED" },
  { key: "convertible", label: "전환 가능",  filter: (q: Quote) => deriveRailState(q) === "ready_for_po_conversion" },
];

function QuotesPageContent() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const pilotProfile = searchParams.get("labaxisPilot") ?? searchParams.get("pilot");
  const isBrowserPilotQuoteDispatch = pilotProfile === "quote-dispatch";
  const queryClient = useQueryClient();
  const { toast } = useToast();
  // §11.221 — 운영 브리핑 판단 근거 collapsible (호영님 5월 8일 결론).
  //   default 접힘 — 1차 노출은 한 줄 인과관계 요약, "상세 보기" 클릭 시 4 cell.
  const [factsExpanded, setFactsExpanded] = useState(false);
  // §11.217 Phase 5 — chip scroll-spy active highlight.
  //   IntersectionObserver 로 detail panel scroll 시 visible section 의 chip
  //   자동 highlight. chip click 시 scrollIntoView + setActiveChipId 즉시 update.
  const [activeChipId, setActiveChipId] = useState<string | null>("summary");
  // §11.217 Phase 6 — quote list 보기 모드 (카드 ↔ 테이블 toggle).
  //   localStorage "labaxis-quote-view-mode" persist — 사용자 선호 기억.
  //   default "card" (호영님 기존 패턴 정합).
  const [viewMode, setViewMode] = useState<"card" | "table">("card");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get("status") ?? "all");
  const [modeChip, setModeChip] = useState<string | null>(null);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(searchParams.get("selected") ?? null);
  const [activeWorkWindow, setActiveWorkWindow] = useState<WorkWindowKey>(null);
  const [aiCompareOpen, setAiCompareOpen] = useState(false);
  const [aiCompareLoading, setAiCompareLoading] = useState(false);
  const [aiCompareResult, setAiCompareResult] = useState<{ comparison: Array<{ vendor: string; price: string; leadTime: string; shippingFee: string }>; recommendation: string; negotiationGuide: string } | null>(null);
  const [aiCompareError, setAiCompareError] = useState<string | null>(null);
  const [aiParseModalOpen, setAiParseModalOpen] = useState(false);

  // ── Intake dock state (Smart Sourcing → workqueue 내부 통합) ──
  // §11.55 — manual_upload 분기 제거. backend (`create-from-intake` /
  // `attach-document`) 미구현으로 dead-end UI였음. LabAxis 견적 응답
  // 표준 워크플로우는 Path 1 (vendor token 응답 링크) + Path 2 (SendGrid
  // inbound webhook) 자동 처리이며 manual upload는 사용 시나리오 없음.
  // BOM import 분기만 유지.
  const [intakeDockOpen, setIntakeDockOpen] = useState(false);
  const [intakeDockSource, setIntakeDockSource] = useState<"bom_import" | null>(null);

  // §11.217 Phase 3 — batch dispatch selection state.
  // PENDING (request_not_sent) quote 만 selectable. checkbox click → toggle.
  // refetch / sheet close 시 clearSelection 으로 reset (canonical truth 정합).
  const [selectedQuoteIds, setSelectedQuoteIds] = useState<Set<string>>(new Set());
  const [batchSheetOpen, setBatchSheetOpen] = useState(false);
  const toggleQuoteSelection = useCallback((id: string) => {
    setSelectedQuoteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const clearSelection = useCallback(() => {
    setSelectedQuoteIds(new Set());
  }, []);

  // URL dock param 감지 (legacy redirect에서 유입)
  useEffect(() => {
    const dockParam = searchParams.get("dock");
    const sourceParam = searchParams.get("source");
    // §11.55 — manual_upload param은 무시 (legacy URL은 BOM 분기만 유효)
    if (dockParam === "intake" && sourceParam === "bom_import") {
      setIntakeDockSource("bom_import");
      setIntakeDockOpen(true);
    }
  }, [searchParams]);
  // ── Ontology Context Layer bridge — 현재 견적 관리 상태를 next-step resolver에 전달 ──
  useOntologyContextBridge({
    currentStage: "quote_management",
    activeWorkWindow: activeWorkWindow ?? null,
    counts: {
      pendingQuotes: 0, // quotes 로딩 전이므로 아래 useMemo로 갱신
    },
  });

  // ── AI 견적서 비교 실행 — quotes 선언 뒤로 이동 (아래 참조) ──

  // ── 견적 발송 성공 후 갱신 ──
  const handleSendSuccess = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["quotes"] });
    if (selectedQuoteId) {
      queryClient.invalidateQueries({ queryKey: ["quote", selectedQuoteId] });
      queryClient.invalidateQueries({ queryKey: ["vendor-requests", selectedQuoteId] });
      // §11.158 cache-bust — vendor request 발송 직후 brief stale (quote_detail + purchase_conversion)
      invalidateBriefNarrative({ quoteId: selectedQuoteId, module: "quote_detail", sourceUpdatedAt: new Date() });
      invalidateBriefNarrative({ quoteId: selectedQuoteId, module: "purchase_conversion", sourceUpdatedAt: new Date() });
    }
    setActiveWorkWindow(null);
  }, [queryClient, selectedQuoteId]);


  // ── Rail open/close — single source of truth ──
  const openQuoteContextRail = (caseId: string, source: string = "row") => {
    const next = selectedQuoteId === caseId ? null : caseId;
    if (typeof window !== "undefined") {
      console.log("[QuoteQueue]", next ? "quote_queue_open_rail" : "quote_queue_close_rail", { caseId, source, pathname: window.location.pathname });
    }
    if (next) {
      setSelectedQuoteId(next);
      // URL query에 selected 반영
      const url = new URL(window.location.href);
      url.searchParams.set("selected", next);
      window.history.replaceState({}, "", url.toString());
    } else {
      closeQuoteContextRail("toggle");
    }
  };

  const closeQuoteContextRail = (source: string = "x_button") => {
    if (typeof window !== "undefined") {
      console.log("[QuoteQueue] quote_context_rail_closed", { selectedRecordId: selectedQuoteId, activeWorkWindow, source, path: window.location.pathname });
    }
    setSelectedQuoteId(null);
    setActiveWorkWindow(null);
    // URL query 정리 — path 유지, selected/task 제거
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("selected");
      url.searchParams.delete("task");
      window.history.replaceState({}, "", url.toString());
    }
  };

  // ESC로 rail 닫기
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") closeQuoteContextRail("esc"); };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [selectedQuoteId]);

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

  // §11.217 Phase 6 — localStorage persist (mount 시 read).
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("labaxis-quote-view-mode");
      if (saved === "card" || saved === "table") {
        setViewMode(saved);
      }
    } catch {
      // localStorage unavailable (SSR / private mode) — fallback to "card".
    }
  }, []);

  // §11.217 Phase 6 — localStorage persist (viewMode change 시 write).
  useEffect(() => {
    try {
      window.localStorage.setItem("labaxis-quote-view-mode", viewMode);
    } catch {
      // ignore
    }
  }, [viewMode]);

  // §11.217 Phase 5 — chip scroll-spy. detail panel 의 4 brief section
  //   (brief-summary / brief-facts / brief-facts2 / brief-next) 을 IntersectionObserver
  //   로 감시 → 가장 위에 visible 한 section 의 chip 을 active 로 highlight.
  //   selectedQuoteId 가 set 된 후 mount 됨 (panel 안 element 가 DOM 에 있어야 attach).
  useEffect(() => {
    if (!selectedQuoteId) return;
    // detail panel 이 DOM 에 mount 될 때까지 microtask defer.
    let observer: IntersectionObserver | null = null;
    const attach = () => {
      const sectionIds = ["summary", "facts", "facts2", "next"] as const;
      const elements = sectionIds
        .map((id) => ({ id, el: document.getElementById(`brief-${id}`) }))
        .filter((x): x is { id: string; el: HTMLElement } => x.el !== null);
      if (elements.length === 0) return;

      observer = new IntersectionObserver(
        (entries) => {
          const visible = entries
            .filter((e) => e.isIntersecting)
            .sort(
              (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
            );
          if (visible.length > 0) {
            const targetId = visible[0].target.id.replace("brief-", "");
            setActiveChipId(targetId);
          }
        },
        { rootMargin: "-20% 0px -50% 0px", threshold: 0 },
      );
      elements.forEach(({ el }) => observer?.observe(el));
    };
    // 다음 frame 에서 attach (panel 의 brief sections 가 mount 된 후).
    const raf = requestAnimationFrame(attach);
    return () => {
      cancelAnimationFrame(raf);
      observer?.disconnect();
    };
  }, [selectedQuoteId]);

  const { data: quotesData, isLoading, isFetching, isError, refetch } = useQuery({
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

  // #user-supplier-registration Phase 5 — 조직 거래처 (org_book source) fetch.
  //   resolveSuppliers / preflight / batch sheet 모두 정합 forward.
  //   organization 미가입 user 또는 거래처 0건 → 빈 array (graceful).
  const { data: organizationVendorsData } = useQuery({
    queryKey: ["organization-vendors"],
    queryFn: async () => {
      const response = await fetch("/api/organization-vendors", { credentials: "include" });
      if (!response.ok) return { vendors: [] };
      return response.json();
    },
    enabled: status === "authenticated",
    staleTime: 60_000,
  });
  const organizationVendors: Array<{
    id: string;
    vendorName: string;
    vendorEmail: string;
    vendorPhone?: string | null;
    isPrimary?: boolean;
    notes?: string | null;
  }> = useMemo(() => organizationVendorsData?.vendors ?? [], [organizationVendorsData]);

  // #vendor-catalog-product-matching Phase 3 — vendor-product carry 매핑 fetch.
  //   resolveSuppliers 에 forward → product 매칭 시 vendor confidence boost.
  //   미등록 시 빈 array fallback (backward compat).
  const { data: organizationVendorProductsData } = useQuery({
    queryKey: ["organization-vendor-products"],
    queryFn: async () => {
      const response = await fetch("/api/organization-vendor-products", {
        credentials: "include",
      });
      if (!response.ok) return { entries: [] };
      return response.json();
    },
    enabled: status === "authenticated",
    staleTime: 60_000,
  });
  const organizationVendorProducts: Array<{
    vendorId: string;
    productId: string;
  }> = useMemo(
    () =>
      (organizationVendorProductsData?.entries ?? []).map(
        (e: { vendorId: string; productId: string }) => ({
          vendorId: e.vendorId,
          productId: e.productId,
        }),
      ),
    [organizationVendorProductsData],
  );

  // 필터 변경 중 indicator (기존 list 유지하면서 상단에만 표시)
  const isFilterChanging = isFetching && !isLoading;

  const quotes: Quote[] = useMemo(() => {
    const baseQuotes: Quote[] = quotesData?.quotes || [];
    if (!isBrowserPilotQuoteDispatch) return baseQuotes;

    const hasPending = baseQuotes.some((quote) => quote.status === "PENDING");
    if (hasPending) return baseQuotes;

    const pilotQuote: Quote = {
      id: "pilot-quote-dispatch",
      title: "Pilot PBS Buffer 견적 요청",
      status: "PENDING",
      createdAt: new Date().toISOString(),
      deliveryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      deliveryLocation: "LabAxis Pilot Lab",
      items: [
        {
          id: "pilot-quote-item",
          product: { id: "pilot-pbs-buffer", name: "PBS Buffer 10x, 500ml" },
          quantity: 2,
        },
      ],
      responses: [],
    };

    return [pilotQuote, ...baseQuotes];
  }, [quotesData?.quotes, isBrowserPilotQuoteDispatch]);

  // ── AI 견적서 비교 실행 ──
  const runAiQuoteCompare = useCallback(async () => {
    if (!quotes || quotes.length === 0) return;
    setAiCompareLoading(true);
    setAiCompareError(null);
    setAiCompareResult(null);
    setAiCompareOpen(true);
    try {
      const quotePayload = quotes
        .filter((q: Quote) => q.status !== "CANCELLED")
        .slice(0, 5)
        .map((q: Quote) => ({
          vendor: (q.items?.[0]?.product as Record<string, unknown>)?.brand as string || q.items?.[0]?.product?.name || "미지정 공급사",
          items: q.items?.map((item) => `${item.product?.name || "품목"} x${item.quantity || 1}`).join(", ") || q.title,
          rawText: `${q.title} — ${q.items?.length || 0}건 품목`,
        }));
      const res = await csrfFetch("/api/ai/quote-compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quotes: quotePayload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI 비교 분석 실패");
      setAiCompareResult(data.data);
    } catch (err: unknown) {
      setAiCompareError(err instanceof Error ? err.message : "AI 비교 분석 중 오류 발생");
    } finally {
      setAiCompareLoading(false);
    }
  }, [quotes]);

  const today = new Date().toDateString();
  const selectedQuote = selectedQuoteId ? quotes.find(q => q.id === selectedQuoteId) : null;
  const selectedSignals = selectedQuote ? getOpSignals(selectedQuote) : null;
  const selectedDispatchPreflight = useMemo(
    () => selectedQuote && selectedSignals?.actionKey === "request_send"
      ? getQuoteDispatchPreflight(selectedQuote, organizationVendors)
      : null,
    [selectedQuote, selectedSignals?.actionKey],
  );
  const selectedDispatchBlocked = !!selectedDispatchPreflight?.hardBlocked;

  const openQuoteDraftWorkbench = useCallback(() => {
    const targetQuote = selectedQuote
      ?? quotes.find((quote) => deriveRailState(quote) === "request_not_sent")
      ?? quotes.find((quote) => quote.status !== "COMPLETED" && quote.status !== "CANCELLED")
      ?? quotes[0];

    if (!targetQuote) {
      toast({
        title: "견적 요청 초안을 만들 수 없습니다",
        description: "먼저 비교 후보나 견적 요청 대상을 등록하세요.",
      });
      return;
    }

    setSelectedQuoteId(targetQuote.id);
    setActiveWorkWindow("request_send");

    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("selected", targetQuote.id);
      url.searchParams.set("task", "request_send");
      window.history.replaceState({}, "", url.toString());
      console.log("[QuoteQueue] quote_draft_workbench_opened", { caseId: targetQuote.id, source: "header_cta" });
    }
  }, [quotes, selectedQuote, toast]);

  // §11.181 — handleFloatingEntryClick 제거: FAB default 가 popup 호출.

  // §11.161 — 운영 브리핑 narrative hook (selectedQuote 선언 후 호출)
  const { narrative: briefNarrative, cached: briefCached } = useOperationalBriefNarrative({
    sourceTrace: {
      quoteId: selectedQuote?.id ?? "",
      module: "quote_detail",
      sourceUpdatedAt: selectedQuote?.createdAt ?? new Date(0),
    },
    facts: {
      status: selectedSignals?.status ?? null,
      blocker: selectedSignals?.blocker ?? null,
      nextAction: selectedSignals?.nextAction ?? null,
    },
    enabled: !!selectedQuote?.id,
  });
  const selectedOpStatus = selectedQuote ? getOpStatus(selectedQuote) : null;

  // 운영 요약 — canonical state 기반 집계 (row/rail과 같은 selector 사용)
  const quotesWithState = useMemo(() => quotes.map(q => ({ quote: q, state: deriveRailState(q) })), [quotes]);
  const summaryStats = useMemo(() => {
    // §11.217 Phase 2 (Issue 2) — "회신 추적 필요" 의미 분리.
    // 기존: request_not_sent + awaiting_responses + response_delayed 모두 합산 →
    //       "회신 추적 필요" label 이 "미발송" 케이스까지 포함 = 의미 mismatch.
    // 신규: dispatchPending (미발송) + responseTracking (회신 대기/지연) 으로
    //       2-bucket 분리. 각 bucket 별 filter 도 분리.
    const dispatchPending = quotesWithState.filter(({ state }) => state === "request_not_sent");
    const tracking = quotesWithState.filter(({ state }) => state === "awaiting_responses" || state === "response_delayed");
    const delayedCount = tracking.filter(({ state }) => state === "response_delayed").length;
    const review = quotesWithState.filter(({ state }) => COMPARE_STATES.has(state));
    const condCount = review.filter(({ state }) => state === "condition_check_required").length;
    const approval = quotesWithState.filter(({ state }) => state === "external_approval_required" || state === "condition_check_required");
    const convertible = quotesWithState.filter(({ state }) => state === "ready_for_po_conversion");
    return {
      dispatchPending: {
        count: dispatchPending.length,
        insight: dispatchPending.length > 0
          ? "공급사 견적 요청 발송 우선 — 첫 액션 필요"
          : "미발송 케이스 없음",
      },
      responseTracking: {
        count: tracking.length,
        insight: tracking.length > 0
          ? (delayedCount > 0 ? `${delayedCount}건 회신 지연 — 오늘 재요청 판단 필요` : "응답 수집 중 — 비교 가능 여부 대기")
          : "회신 추적 대상 없음",
      },
      compareReview: {
        count: review.length,
        insight: review.length > 0
          ? (condCount > 0 ? `${condCount}건 조건 확인 필요 — 선택안 확정 전` : "선택안 확정 또는 비교 준비 단계")
          : "검토 대상 없음",
      },
      approvalException: {
        count: approval.length,
        insight: approval.length > 0
          ? "승인 패키지 준비 또는 조건 해소 필요"
          : "승인/예외 처리 대상 없음",
      },
      readyToConvert: {
        count: convertible.length,
        insight: convertible.length > 0
          ? "차단 없이 PO 전환 준비 가능"
          : "전환 대상 없음 — 비교/조건 정리 먼저",
      },
    };
  }, [quotesWithState]);

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

  // ── Trace logging ──
  useEffect(() => {
    if (isLoading) console.log("[QuoteQueue] quote_queue_page_loading_started", { statusFilter, modeChip, searchQuery });
  }, [isLoading]);
  useEffect(() => {
    if (!isLoading && quotes.length > 0) console.log("[QuoteQueue] quote_queue_list_ready", { count: quotes.length, statusFilter, modeChip });
  }, [isLoading, quotes.length]);
  useEffect(() => {
    if (!isLoading && filteredQuotes.length === 0 && quotes.length === 0) console.log("[QuoteQueue] quote_queue_empty_shown");
    if (!isLoading && filteredQuotes.length === 0 && quotes.length > 0) console.log("[QuoteQueue] quote_queue_filter_empty_shown", { statusFilter, modeChip, searchQuery });
  }, [isLoading, filteredQuotes.length, quotes.length]);
  useEffect(() => {
    if (isError) console.log("[QuoteQueue] quote_queue_page_fatal_error", { statusFilter });
  }, [isError]);

  // 섹션 분류
  const urgentQuotes = filteredQuotes.filter(q => q.status === "RESPONDED" || (q.status === "SENT" && (q.responses?.length ?? 0) > 0) || isDelayed(q));
  const inProgressQuotes = filteredQuotes.filter(q => !urgentQuotes.includes(q) && q.status !== "COMPLETED" && q.status !== "CANCELLED");
  const completedQuotes = filteredQuotes.filter(q => q.status === "COMPLETED" || q.status === "CANCELLED");

  // §11.217 Phase 1B (Issue 5) — AI 추천 page-top banner 1회.
  // 기존: card 마다 inline AI 추천 row 반복 (4번) → 정보 노이즈.
  // 신규: page header 직후 1줄 banner — priority highest = urgentQuotes[0]
  //       → inProgressQuotes[0] fallback. 없으면 banner 0 (no-op).
  // canonical truth: getOpSignals 의 aiRecommendation 그대로 사용 (rail map
  // 의 single source).
  const priorityQuoteForBanner = urgentQuotes[0] ?? inProgressQuotes[0] ?? null;
  const priorityAiRecommendation = priorityQuoteForBanner
    ? getOpSignals(priorityQuoteForBanner).aiRecommendation
    : null;

  // §11.217 Phase 3 — batch dispatch preflight 합산.
  // selectedQuotes = selectedQuoteIds 에서 실제 quote object 복원 (filteredQuotes 안).
  // dispatchableCount = preflight 통과한 quote 수, hardBlockCount = 차단된 quote 수.
  // canonical truth = getQuoteDispatchPreflight (page-level helper) 그대로 사용.
  const selectedQuotes = useMemo(
    () => filteredQuotes.filter((q) => selectedQuoteIds.has(q.id)),
    [filteredQuotes, selectedQuoteIds],
  );
  const { dispatchableCount, hardBlockCount } = useMemo(() => {
    let dispatchable = 0;
    let hardBlock = 0;
    for (const q of selectedQuotes) {
      const preflight = getQuoteDispatchPreflight(q, organizationVendors);
      if (preflight.hardBlocked) hardBlock += 1;
      else dispatchable += 1;
    }
    return { dispatchableCount: dispatchable, hardBlockCount: hardBlock };
  }, [selectedQuotes]);

  return (
    <div className="p-4 md:p-8 pt-4 md:pt-6 space-y-5 max-w-7xl mx-auto w-full">

      {/* ── 헤더 ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-900">견적 관리</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5 hidden sm:block">처리가 필요한 견적 케이스를 우선순위 순으로 확인합니다.</p>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0 overflow-x-auto snap-x pb-0.5 sm:pb-0">
          {/* 견적서 파싱 버튼 */}
          <button
            onClick={() => setAiParseModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold shadow-sm transition-colors active:scale-95 shrink-0 snap-start"
          >
            <Upload className="h-3.5 sm:h-4 w-3.5 sm:w-4" />
            <span className="hidden sm:inline">견적서 파싱</span><span className="sm:hidden">파싱</span>
          </button>
          {/* 견적서 비교 버튼 */}
          <button
            onClick={runAiQuoteCompare}
            disabled={aiCompareLoading || !quotes || quotes.length < 2}
            className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed shrink-0 snap-start"
          >
            {aiCompareLoading ? (
              <Loader2 className="h-3.5 sm:h-4 w-3.5 sm:w-4 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 sm:h-4 w-3.5 sm:w-4" />
            )}
            <span className="hidden sm:inline">견적서 비교</span><span className="sm:hidden">비교</span>
          </button>
          <Button
            type="button"
            data-testid="quote-draft-workbench-cta"
            size="sm"
            variant="outline"
            className="h-9 text-sm hidden sm:flex"
            onClick={openQuoteDraftWorkbench}
            disabled={isLoading || quotes.length === 0}
          >
            <FileTextIcon className="h-4 w-4 mr-1.5" />
            견적 요청 초안 만들기
          </Button>
          <PermissionGate permission="quotes.create">
            <div className="flex items-center gap-0 flex-shrink-0 snap-start">
              <Link href="/app/search">
                <Button size="sm" className="h-9 text-xs sm:text-sm gap-1.5 bg-blue-600 hover:bg-blue-700 rounded-r-none border-r border-blue-500/40">
                  <Plus className="h-4 w-4" /><span className="hidden sm:inline">새 견적 요청</span><span className="sm:hidden">새 요청</span>
                </Button>
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" className="h-9 px-2 bg-blue-600 hover:bg-blue-700 rounded-l-none">
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52 !bg-white">
                  {/* §11.55 — "외부 견적서 업로드" 메뉴 제거: backend 미구현 dead-end였음. */}
                  <DropdownMenuItem
                    className="cursor-pointer gap-2 py-2.5"
                    onClick={() => { setIntakeDockSource("bom_import"); setIntakeDockOpen(true); }}
                  >
                    <FileTextIcon className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm">BOM 업로드</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </PermissionGate>
        </div>
      </div>

      {/* ── Page-level fatal error (primary fetch 실패 시만) ── */}
      {isError && !quotesData && (
        <div className="rounded-xl border border-red-600/20 bg-red-600/5 p-6 text-center space-y-3">
          <AlertCircle className="h-8 w-8 text-red-600 mx-auto" />
          <p className="text-sm text-slate-700 font-medium">견적 운영 워크큐를 불러오지 못했습니다</p>
          <p className="text-xs text-slate-500">기본 목록 데이터를 확인하지 못했습니다. 일시적 문제일 수 있습니다.</p>
          <div className="flex justify-center gap-2 pt-1">
            <Button size="sm" className="h-8 text-xs bg-blue-600 hover:bg-blue-700" onClick={() => refetch()}>다시 시도</Button>
            <Link href="/dashboard"><Button size="sm" variant="outline" className="h-8 text-xs text-slate-400 border-bd">대시보드로 돌아가기</Button></Link>
          </div>
        </div>
      )}

      {/* ── §11.217 Phase 1B — AI 추천 page-top banner (priority highest 1줄) ── */}
      {priorityAiRecommendation && (
        <div className="rounded-lg border border-violet-200 bg-violet-50/60 px-3 py-2 flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-violet-600 shrink-0" />
          <p className="text-[12px] sm:text-xs text-violet-900 line-clamp-1">
            {priorityAiRecommendation}
          </p>
        </div>
      )}

      {/* §11.217 Phase 3 — Batch action bar (sticky, selectedCount > 0 시만 노출) */}
      <BatchActionBar
        selectedCount={selectedQuoteIds.size}
        dispatchableCount={dispatchableCount}
        hardBlockCount={hardBlockCount}
        onReviewStart={() => setBatchSheetOpen(true)}
        onClearSelection={clearSelection}
      />

      {/* ── KPI Control Cards — 모바일: 가로 스와이프 / sm+: 2열 / lg+: 5열 (§11.217 Phase 2 — 발송 대기 cell 추가) ── */}
      <div className="flex gap-2.5 overflow-x-auto snap-x pb-1 sm:pb-0 sm:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 sm:gap-3 sm:overflow-visible">
        {[
          { label: "발송 대기", ...summaryStats.dispatchPending, icon: Send, filter: "PENDING", color: "slate", iconBg: "bg-slate-50", iconText: "text-slate-600", activeBorder: "border-slate-400/50", activeRing: "ring-slate-400/20", activeBg: "bg-slate-50/50", hoverBorder: "hover:border-slate-300", hoverShadow: "hover:shadow-slate-100" },
          { label: "회신 추적", ...summaryStats.responseTracking, icon: Clock, filter: "SENT", color: "amber", iconBg: "bg-amber-50", iconText: "text-amber-600", activeBorder: "border-amber-400/50", activeRing: "ring-amber-400/20", activeBg: "bg-amber-50/50", hoverBorder: "hover:border-amber-300", hoverShadow: "hover:shadow-amber-100" },
          { label: "비교 검토 필요", ...summaryStats.compareReview, icon: RefreshCw, filter: "RESPONDED", color: "purple", iconBg: "bg-purple-50", iconText: "text-purple-600", activeBorder: "border-purple-400/50", activeRing: "ring-purple-400/20", activeBg: "bg-purple-50/50", hoverBorder: "hover:border-purple-300", hoverShadow: "hover:shadow-purple-100" },
          { label: "승인 / 예외 처리", ...summaryStats.approvalException, icon: AlertCircle, filter: "DEADLINE_TODAY", color: "red", iconBg: "bg-red-50", iconText: "text-red-500", activeBorder: "border-red-400/50", activeRing: "ring-red-400/20", activeBg: "bg-red-50/50", hoverBorder: "hover:border-red-300", hoverShadow: "hover:shadow-red-100" },
          { label: "발주 전환 가능", ...summaryStats.readyToConvert, icon: FileCheck2, filter: "COMPLETED", color: "emerald", iconBg: "bg-emerald-50", iconText: "text-emerald-600", activeBorder: "border-emerald-400/50", activeRing: "ring-emerald-400/20", activeBg: "bg-emerald-50/50", hoverBorder: "hover:border-emerald-300", hoverShadow: "hover:shadow-emerald-100" },
        ].map(({ label, count, insight, icon: Icon, filter, iconBg, iconText, activeBorder, activeRing, activeBg, hoverBorder, hoverShadow }, idx) => {
          const isActive = statusFilter === filter;
          const isZero = !isLoading && count === 0;
          return (
            <button key={label} onClick={() => setStatusFilter(prev => prev === filter ? "all" : filter)}
              className={`animate-stagger-up text-left rounded-xl border bg-pn p-3 sm:p-3.5 transition-all duration-200 cursor-pointer group min-w-[140px] sm:min-w-0 shrink-0 sm:shrink snap-start
                ${hoverBorder} ${hoverShadow} hover:shadow-md hover:-translate-y-1
                ${isActive ? `${activeBorder} ${activeBg} ring-1 ${activeRing}` : "border-bd/80"}
                ${isZero && !isActive ? "opacity-50 hover:opacity-100" : ""}
              `}
              style={{ animationDelay: `${idx * 80}ms` }}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center transition-transform group-hover:scale-110`}>
                  <Icon className={`h-4 w-4 ${iconText}`} />
                </div>
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider truncate">{label}</span>
              </div>
              <div className={`text-3xl font-extrabold tracking-tight mb-1 ${isZero ? "text-slate-300" : "text-slate-900"}`}>
                {isLoading ? <span className="inline-block w-8 h-7 bg-el/50 rounded animate-pulse" /> : count}
              </div>
              <p className={`text-[11px] leading-snug line-clamp-2 ${isZero ? "text-slate-400" : "text-slate-500"}`}>
                {isLoading ? "집계 확인 중" : insight}
              </p>
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
                className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full border font-medium transition-all ${
                  isActive ? "bg-blue-600/10 text-blue-600 border-blue-600/30" : "text-slate-500 border-bd/50 hover:border-bd hover:text-slate-900"
                }`}>
                {chip.label}
                {chipCount > 0 && <span className={`text-[9px] ${isActive ? "text-blue-300" : "text-slate-600"}`}>{chipCount}</span>}
              </button>
            );
          })}
          {modeChip && (
            <button onClick={() => setModeChip(null)} className="text-[11px] text-slate-500 hover:text-slate-900 ml-1">초기화</button>
          )}

          {/* §11.220 — 전체 선택 CTA (PENDING quote 일괄 선택). 호영님 피드백
              "체크박스 박스 외에 일괄 선택 가능하게도". PENDING 0건이면 noop. */}
          {(() => {
            const selectablePending = filteredQuotes.filter(q => deriveRailState(q) === "request_not_sent");
            if (selectablePending.length === 0) return null;
            const allSelected = selectablePending.every(q => selectedQuoteIds.has(q.id));
            return (
              <button
                type="button"
                onClick={() => {
                  if (allSelected) {
                    clearSelection();
                  } else {
                    setSelectedQuoteIds(new Set(selectablePending.map(q => q.id)));
                  }
                }}
                className="ml-auto inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full border font-medium transition-all text-violet-700 border-violet-300/60 bg-violet-50/50 hover:bg-violet-100"
                aria-label={allSelected ? "전체 선택 해제" : "발송 대기 견적 전체 선택"}
              >
                {allSelected ? "전체 해제" : `전체 선택 (${selectablePending.length}건)`}
              </button>
            );
          })()}
        </div>
      </div>

      {/* ═══ Main: List + Quote Context Rail ═══ */}
      <div className="flex gap-0">
      <div data-testid="quote-work-queue" className="flex-1 min-w-0 space-y-4">

      {/* §11.217 Phase 6 — 보기 모드 toggle (카드 ↔ 테이블).
          localStorage persist + aria-pressed (a11y). 대량 quote audit 용 테이블. */}
      {!isLoading && filteredQuotes.length > 0 && (
        <div className="flex items-center justify-end gap-1.5">
          <span className="text-[11px] text-slate-500 mr-1">보기</span>
          <button
            type="button"
            onClick={() => setViewMode("card")}
            aria-pressed={viewMode === "card"}
            aria-label="카드 보기"
            className={
              viewMode === "card"
                ? "h-7 px-2 inline-flex items-center gap-1 rounded-md text-[11px] font-semibold bg-blue-100 text-blue-700"
                : "h-7 px-2 inline-flex items-center gap-1 rounded-md text-[11px] font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 transition-colors"
            }
          >
            <Package className="h-3 w-3" />
            카드
          </button>
          <button
            type="button"
            onClick={() => setViewMode("table")}
            aria-pressed={viewMode === "table"}
            aria-label="테이블 보기"
            className={
              viewMode === "table"
                ? "h-7 px-2 inline-flex items-center gap-1 rounded-md text-[11px] font-semibold bg-blue-100 text-blue-700"
                : "h-7 px-2 inline-flex items-center gap-1 rounded-md text-[11px] font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 transition-colors"
            }
          >
            <FileTextIcon className="h-3 w-3" />
            테이블
          </button>
        </div>
      )}

      {/* §11.217 Phase 6 — 테이블 보기 (단일 통합 테이블, 3 section 구분 row).
          card 와 같은 데이터 (filteredQuotes) 다른 layout. 클릭 → 같은 detail panel. */}
      {!isLoading && viewMode === "table" && filteredQuotes.length > 0 && (
        <div className="overflow-x-auto bg-pn rounded-xl border border-bd/80">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-bd">
              <tr className="text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-3 py-2">제목</th>
                <th className="px-3 py-2">상태</th>
                <th className="px-3 py-2 text-center">품목</th>
                <th className="px-3 py-2 text-center">회신</th>
                <th className="px-3 py-2 text-center">우선순위</th>
                <th className="px-3 py-2">등록</th>
                <th className="px-3 py-2 text-right">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bd/40">
              {filteredQuotes.map((quote) => {
                const signals = getOpSignals(quote);
                const itemCount = quote.items?.length ?? 0;
                const responseCount = quote.responses?.length ?? 0;
                const railState = deriveRailState(quote);
                const isSelected = selectedQuoteId === quote.id;
                return (
                  <tr
                    key={quote.id}
                    onClick={() => openQuoteContextRail(quote.id, "row")}
                    className={
                      isSelected
                        ? "bg-blue-50/60 cursor-pointer"
                        : "hover:bg-slate-50/60 cursor-pointer transition-colors"
                    }
                  >
                    <td className="px-3 py-2 font-medium text-slate-900 max-w-[280px] truncate">
                      {quote.title}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        railState === "request_not_sent" ? "bg-slate-100 text-slate-700"
                        : railState === "awaiting_responses" ? "bg-blue-100 text-blue-700"
                        : railState === "compare_review" ? "bg-purple-100 text-purple-700"
                        : railState === "approval_prep" ? "bg-amber-100 text-amber-700"
                        : "bg-emerald-100 text-emerald-700"
                      }`}>
                        {signals.badge}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center text-slate-600 tabular-nums">{itemCount}</td>
                    <td className="px-3 py-2 text-center">
                      {(quote.status === "SENT" || quote.status === "RESPONDED") && itemCount > 0 ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <span className="text-[10px] tabular-nums text-slate-600">
                            {responseCount}/{itemCount}
                          </span>
                          <div className="w-12 h-1 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              role="progressbar"
                              aria-valuenow={responseCount}
                              aria-valuemin={0}
                              aria-valuemax={itemCount}
                              className={`h-full rounded-full ${
                                responseCount === 0 ? "bg-slate-200"
                                : responseCount >= itemCount ? "bg-emerald-500"
                                : "bg-blue-500"
                              }`}
                              style={{ width: `${Math.min(100, (responseCount / itemCount) * 100)}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-block w-2 h-2 rounded-full ${
                        signals.priority === "critical" ? "bg-red-500"
                        : signals.priority === "high" ? "bg-amber-500"
                        : "bg-slate-300"
                      }`} aria-label={`우선순위 ${signals.priority}`} />
                    </td>
                    <td className="px-3 py-2 text-slate-500">
                      <RelativeTimeText iso={quote.createdAt} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        size="sm"
                        variant={signals.ctaVariant}
                        onClick={(e) => {
                          e.stopPropagation();
                          openQuoteContextRail(quote.id, "row");
                        }}
                        className={`h-7 text-[11px] ${signals.ctaVariant === "default" ? "bg-blue-600 hover:bg-blue-700 text-white" : ""}`}
                      >
                        {signals.ctaLabel}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

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

      {/* 필터 변경 / background revalidation indicator (기존 list 유지) */}
      {isFilterChanging && (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <div className="h-3 w-3 animate-spin rounded-full border border-blue-600 border-t-transparent" />
          {statusFilter !== "all" || modeChip ? "필터 적용 중..." : "최신 상태를 확인 중"}
        </div>
      )}

      {/* ── 섹션: 즉시 처리 필요 ── */}
      {!isLoading && viewMode === "card" && urgentQuotes.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <h2 className="text-sm font-semibold text-slate-700">즉시 처리 필요</h2>
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-600/15 text-red-600 text-[11px] font-bold">{urgentQuotes.length}</span>
          </div>
          {urgentQuotes.map((quote) => <QuoteCard key={quote.id} quote={quote} isSelected={selectedQuoteId === quote.id} onSelect={() => openQuoteContextRail(quote.id, "row")} isSelectable={deriveRailState(quote) === "request_not_sent"} isSelectedForBatch={selectedQuoteIds.has(quote.id)} onToggleSelect={() => toggleQuoteSelection(quote.id)} />)}
        </div>
      )}

      {/* ── 섹션: 진행 중 ── */}
      {!isLoading && viewMode === "card" && inProgressQuotes.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-600" />
            <h2 className="text-sm font-semibold text-slate-700">진행 중</h2>
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-600/15 text-amber-600 text-[11px] font-bold">{inProgressQuotes.length}</span>
          </div>
          {inProgressQuotes.map((quote) => <QuoteCard key={quote.id} quote={quote} isSelected={selectedQuoteId === quote.id} onSelect={() => openQuoteContextRail(quote.id, "row")} isSelectable={deriveRailState(quote) === "request_not_sent"} isSelectedForBatch={selectedQuoteIds.has(quote.id)} onToggleSelect={() => toggleQuoteSelection(quote.id)} />)}
        </div>
      )}

      {/* ── 섹션: 완료 ── */}
      {!isLoading && viewMode === "card" && completedQuotes.length > 0 && (
        <details className="group">
          <summary className="flex items-center gap-2 cursor-pointer list-none select-none">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span className="text-sm font-semibold text-slate-700">완료 / 취소</span>
            <span className="text-xs text-slate-500">({completedQuotes.length}건)</span>
            <span className="ml-1 text-xs text-slate-500 group-open:hidden">▶</span>
            <span className="ml-1 text-xs text-slate-500 hidden group-open:inline">▼</span>
          </summary>
          <div className="mt-2 space-y-2">
            {completedQuotes.map((quote) => <QuoteCard key={quote.id} quote={quote} isSelected={selectedQuoteId === quote.id} onSelect={() => openQuoteContextRail(quote.id, "row")} isSelectable={deriveRailState(quote) === "request_not_sent"} isSelectedForBatch={selectedQuoteIds.has(quote.id)} onToggleSelect={() => toggleQuoteSelection(quote.id)} />)}
          </div>
        </details>
      )}

      {/* ── 빈 상태: filter empty vs queue empty 분리 ── */}
      {!isLoading && filteredQuotes.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          {(searchQuery || statusFilter !== "all" || modeChip) ? (
            <>
              <Filter className="h-8 w-8 text-slate-600" />
              <p className="text-sm text-slate-700">현재 조건에 맞는 견적 케이스가 없습니다</p>
              <p className="text-xs text-slate-500">필터를 완화하거나 다른 상태군을 선택해 보세요</p>
              <div className="flex gap-2 mt-2">
                <button onClick={() => { setSearchQuery(""); setStatusFilter("all"); setModeChip(null); }} className="text-xs text-blue-600 hover:underline">필터 초기화</button>
                <button onClick={() => setStatusFilter("all")} className="text-xs text-slate-400 hover:underline">전체 보기</button>
              </div>
            </>
          ) : (
            <>
              <Package className="h-8 w-8 text-slate-600" />
              <p className="text-sm text-slate-700">현재 처리 중인 견적 케이스가 없습니다</p>
              <p className="text-xs text-slate-500">새 견적 요청을 만들거나, BOM/외부 견적서를 업로드할 수 있습니다</p>
              <div className="flex gap-2 mt-2">
                <Link href="/app/search"><Button size="sm" className="h-8 text-xs bg-blue-600 hover:bg-blue-700">새 요청 만들기</Button></Link>
                <Link href="/dashboard/inventory"><Button size="sm" variant="outline" className="h-8 text-xs text-slate-400 border-bd">재고 확인</Button></Link>
              </div>
            </>
          )}
        </div>
      )}

      </div>{/* end list column */}

      {/* ═══ Mobile Quote Context Sheet (lg 미만) ═══ */}
      {selectedQuote && selectedSignals && selectedOpStatus && (
        <div className="lg:hidden fixed inset-0 z-40" onClick={() => closeQuoteContextRail("overlay_click")}>
          <div className="absolute inset-0 bg-black/30" />
          <div
            className="absolute bottom-0 left-0 right-0 bg-pn rounded-t-2xl border-t border-bd max-h-[75vh] flex flex-col animate-slide-up safe-area-pb"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="flex justify-center py-2"><div className="w-10 h-1 rounded-full bg-slate-300" /></div>
            {/* Header */}
            <div className="px-4 pb-2 border-b border-bd/50">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded border font-medium ${selectedOpStatus.bg} ${selectedOpStatus.text} ${selectedOpStatus.border}`}>
                    {selectedSignals.badge}
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">#{selectedQuote.id.slice(0, 8).toUpperCase()}</span>
                </div>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-500" onClick={() => closeQuoteContextRail("x_button")}><X className="h-4 w-4" /></Button>
              </div>
              <h3 className="text-sm font-semibold text-slate-900 truncate">{selectedQuote.title}</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">{selectedSignals.summary}</p>
            </div>
            {/* Scrollable body — 운영 요약 compact */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-slate-400 block text-[10px]">상태</span><span className="text-slate-700 font-medium">{selectedSignals.status}</span></div>
                <div><span className="text-slate-400 block text-[10px]">차단</span><span className={selectedSignals.blocker === "차단 없음" ? "text-emerald-400" : "text-amber-600"}>{selectedSignals.blocker}</span></div>
                <div><span className="text-slate-400 block text-[10px]">비교</span><span className="text-slate-700">{selectedSignals.compareReady}</span></div>
                <div><span className="text-slate-400 block text-[10px]">전환</span><span className={selectedSignals.poReady === "가능" ? "text-emerald-400" : "text-slate-500"}>{selectedSignals.poReady}</span></div>
              </div>
              {selectedSignals.aiRecommendation && (
                <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-violet-50 border border-violet-100">
                  <Sparkles className="h-3 w-3 text-violet-500 shrink-0" />
                  <span className="text-[11px] text-violet-700 line-clamp-2">{selectedSignals.aiRecommendation}</span>
                </div>
              )}
            </div>
            {/* Bottom actions */}
            <div className="px-4 py-3 border-t border-bd/50 space-y-2">
              {selectedDispatchBlocked && selectedDispatchPreflight && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 space-y-2">
                  <div>
                    <p className="text-[11px] font-semibold text-amber-900">전달 전 보강 필요</p>
                    <p className="text-[11px] text-amber-700 leading-snug">{selectedDispatchPreflight.summary}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-[11px] border-amber-300 text-amber-800"
                      onClick={() => setActiveWorkWindow("request_send")}
                    >
                      공급사 후보 보강
                    </Button>
                    <Link href="/app/search">
                      <Button size="sm" variant="outline" className="w-full h-8 text-[11px] border-amber-300 text-amber-800">
                        요청 보완
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
              <Button size="sm" className="w-full h-10 text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white active:scale-[0.98]"
                onClick={() => {
                  if (selectedDispatchBlocked) return;
                  if (selectedSignals.actionKey) setActiveWorkWindow(selectedSignals.actionKey);
                }}
                disabled={!selectedSignals.actionKey || selectedDispatchBlocked}>
                {selectedDispatchBlocked ? "견적 요청 전달 잠김" : selectedSignals.railCtaLabel}<ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
              <div className="flex gap-2">
                <Link href={`/quotes/${selectedQuote.id}`} className="flex-1">
                  <Button size="sm" variant="outline" className="w-full h-9 text-xs text-slate-400 border-bd">전체 상세</Button>
                </Link>
                <Button size="sm" variant="ghost" className="flex-1 h-9 text-xs text-slate-500" onClick={() => closeQuoteContextRail("close_btn")}>닫기</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Quote Context Rail (lg+) ═══ */}
      {selectedQuote && selectedSignals && selectedOpStatus && (() => {
        const sqResponseCount = selectedQuote.responses?.length ?? 0;
        // §11.212 — sqDaysSince 인라인 계산 제거 (SSR-CSR Date.now() drift 차단).
        // <RelativeTimeText iso={selectedQuote.createdAt} /> 가 useEffect mount 후 set.
        const sqDelayed = isDelayed(selectedQuote);
        const sqDeadline = selectedQuote.deliveryDate ? new Date(selectedQuote.deliveryDate) : null;
        const sqDaysToDeadline = sqDeadline ? Math.ceil((sqDeadline.getTime() - Date.now()) / 86400000) : null;

        return (
        <div className="hidden lg:flex w-[480px] shrink-0 border-l border-bd flex-col bg-pn ml-5 rounded-xl overflow-hidden self-start sticky top-20" style={{ maxHeight: "calc(100vh - 120px)" }}>
          {/* §11.144 Brief header — 운영 브리핑 + 선택한 견적 (lock §11.142, §11.179 eyebrow 통일) */}
          <div className="px-4 py-2 border-b border-bd bg-el/30 flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-[0.12em] text-blue-700 uppercase">OPERATIONAL BRIEFING</span>
            <span className="text-[10px] text-slate-500 uppercase tracking-wide">선택한 견적</span>
          </div>

          {/* §11.144 4 preset chips — anchor jump to brief sections.
              §11.217 Phase 5 — scroll-spy active highlight (activeChipId 매칭 시 blue tone). */}
          <div className="px-4 py-2 border-b border-bd/50 flex flex-wrap gap-1.5">
            {[
              { id: "summary", label: "상태 요약" },
              { id: "facts",   label: "회신 현황" },
              { id: "facts2",  label: "비교 진행" },
              { id: "next",    label: "발주 전환" },
            ].map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const el = document.getElementById(`brief-${c.id}`);
                  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                  setActiveChipId(c.id);
                }}
                aria-pressed={activeChipId === c.id}
                className={
                  activeChipId === c.id
                    ? "px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700 transition-colors"
                    : "px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors"
                }
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* A. Rail header */}
          <div className="px-4 py-3 border-b border-bd bg-el/50">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded border font-medium ${selectedOpStatus.bg} ${selectedOpStatus.text} ${selectedOpStatus.border}`}>
                  {selectedSignals.badge}
                </span>
                <span className="text-[11px] text-slate-500 font-mono">#{selectedQuote.id.slice(0, 8).toUpperCase()}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Link href={`/quotes/${selectedQuote.id}`}>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-slate-500 hover:text-slate-900" title="전체 상세 열기"><ExternalLink className="h-3 w-3" /></Button>
                </Link>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-slate-500 hover:text-slate-900" onClick={(e) => { e.stopPropagation(); closeQuoteContextRail("x_button"); }}><X className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
            <h3 className="text-sm font-semibold text-slate-900 truncate mb-1">{selectedQuote.title}</h3>
            <p className="text-[11px] text-slate-500">{selectedQuote.items.length}건 · 회신 {sqResponseCount}/{selectedQuote.items.length} · <RelativeTimeText iso={selectedQuote.createdAt} /></p>
            <p className="text-[11px] text-slate-400 mt-0.5">{selectedSignals.urgency}</p>
          </div>

          {/* Rail scrollable body */}
          <div className="flex-1 overflow-y-auto">

          {/* § 1. 상황 요약 — resolver-derived 1-line + §11.161 LLM narrative hook */}
          <section id="brief-summary" className="px-4 py-3 border-b border-bd/50 scroll-mt-4">
            <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500 mb-1.5">상황 요약</div>
            <p className="text-xs text-slate-700 leading-relaxed">
              {briefNarrative ?? selectedSignals.summary}
              {briefCached && <span className="ml-1 text-[10px] text-slate-400">· 캐시</span>}
            </p>
          </section>

          {/* §11.221 § 2. 판단 근거 — 인과관계 한 줄 요약 + collapsible 4 cell.
              호영님 5월 8일 결론: "상태 반복" → "인과관계 + 실행 이유". 1차 노출은
              한 줄 ("→" + emoji + 굵게), 4 cell grid 는 "상세 보기" 클릭 시 펼침.
              §11.188 의 4 cell grid (현재 상태 / 회신 / 비교 가능 / 발주 전환) 는
              collapsed 안에 보존 — canonical truth 영향 0. */}
          <div id="brief-facts" className="px-4 py-3 border-b border-bd/50 scroll-mt-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500">판단 근거</div>
              <button
                type="button"
                onClick={() => setFactsExpanded(prev => !prev)}
                className="text-[10px] text-slate-500 hover:text-slate-700 inline-flex items-center gap-0.5 transition-colors"
                aria-label={factsExpanded ? "판단 근거 상세 접기" : "판단 근거 상세 보기"}
              >
                {factsExpanded ? "접기" : "상세 보기"}
                {factsExpanded ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </button>
            </div>

            {/* 1차 노출 — 한 줄 인과관계 요약 (always visible). */}
            {(() => {
              const totalItems = selectedQuote.items.length;
              const replyCount = sqResponseCount;
              const status = selectedSignals.status;
              const blocker = selectedSignals.blocker;
              const compareReady = selectedSignals.compareReady;
              const poReady = selectedSignals.poReady;
              const nextAction = selectedSignals.nextAction;

              let summary: string;
              if (blocker?.includes("공급사 미전송") || status?.includes("요청 생성")) {
                summary = "📋 견적 미발송 → 비교·발주 차단 중. 발송이 첫 단계입니다.";
              } else if (selectedQuote.status === "SENT" && replyCount === 0) {
                summary = "📤 발송 완료 → 회신 대기 중. 응답 수집이 다음 단계입니다.";
              } else if (replyCount > 0 && replyCount < totalItems) {
                summary = `📥 회신 ${replyCount}/${totalItems} → 일부 수신 중. 추가 회신 대기 또는 비교 검토 진입 가능.`;
              } else if (replyCount > 0 && replyCount >= totalItems && (compareReady === "가능" || compareReady === "완료")) {
                summary = "📊 회신 수집 완료 → 비교 검토 가능. 최적안 선택이 다음 단계입니다.";
              } else if (poReady === "가능") {
                summary = "✅ 비교 완료 → 발주 전환 가능. 결재 또는 PO 생성이 다음 단계입니다.";
              } else {
                summary = `${blocker && blocker !== "차단 없음" ? `⚠️ 차단: ${blocker} → ` : "→ "}다음 단계: ${nextAction ?? "-"}`;
              }
              return (
                <p className="text-xs leading-relaxed text-slate-800 font-medium">{summary}</p>
              );
            })()}

            {/* 2차 — collapsible: 4 cell grid + 보조 (차단/위험 + 다음 액션). */}
            {factsExpanded && (
              <>
                {(() => {
                  const totalItems = selectedQuote.items.length;
                  const replyTone: "ok" | "warn" | "danger" =
                    sqResponseCount === 0
                      ? "danger"
                      : sqResponseCount >= totalItems
                        ? "ok"
                        : "warn";
                  const compareTone: "ok" | "neutral" =
                    selectedSignals.compareReady === "가능" || selectedSignals.compareReady === "완료"
                      ? "ok"
                      : "neutral";
                  const poTone: "ok" | "neutral" =
                    selectedSignals.poReady === "가능" ? "ok" : "neutral";
                  const replyValue = totalItems === 0 ? "—" : `${sqResponseCount}/${totalItems}`;
                  return (
                    <div className="grid grid-cols-2 gap-2.5 mt-3">
                      <MetricCell label="현재 상태" value={selectedSignals.status} tone="neutral" />
                      <MetricCell label="회신" value={replyValue} tone={replyTone} />
                      <MetricCell label="비교 가능" value={selectedSignals.compareReady} tone={compareTone} />
                      <MetricCell label="발주 전환" value={selectedSignals.poReady} tone={poTone} />
                    </div>
                  );
                })()}
                {/* 보조 — 차단/위험 + 다음 액션 (정보 보존) */}
                <div className="mt-3 pt-3 border-t border-bd/30 space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">차단/위험</span>
                    <span className={selectedSignals.blocker === "차단 없음" ? "text-emerald-600" : "text-amber-600"}>
                      {selectedSignals.blocker}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">다음 액션</span>
                    <span className="text-slate-700">{selectedSignals.nextAction}</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* § 2 cont. 핵심 근거 (회신/비교) — response delta */}
          <div id="brief-facts2" className="px-4 py-3 border-b border-bd/50 scroll-mt-4">
            <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500 mb-2">회신 · 비교 현황</div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">수신 견적</span>
                <span className={`font-medium ${sqResponseCount > 0 ? "text-blue-600" : "text-slate-700"}`}>{sqResponseCount}건{sqResponseCount > 0 && selectedQuote.status === "SENT" ? " (새 회신)" : ""}</span>
              </div>
              <div className="flex justify-between text-xs"><span className="text-slate-400">회신 대기</span><span className={selectedQuote.status === "SENT" && sqResponseCount === 0 ? "text-amber-600" : "text-slate-500"}>{selectedQuote.status === "SENT" ? `${selectedQuote.items.length - sqResponseCount}건` : "—"}</span></div>
              {/* 가격 범위 — 회신이 있을 때만 */}
              {(() => {
                const prices = (selectedQuote.responses ?? []).map(r => r.totalPrice).filter((p): p is number => typeof p === "number" && p > 0);
                if (prices.length === 0) return null;
                const min = Math.min(...prices);
                const max = Math.max(...prices);
                const spread = prices.length >= 2 ? Math.round(((max - min) / min) * 100) : 0;
                return (
                  <>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">가격 범위</span>
                      <span className="text-slate-700 font-medium">₩{min.toLocaleString("ko-KR")}{prices.length >= 2 ? ` ~ ₩${max.toLocaleString("ko-KR")}` : ""}</span>
                    </div>
                    {prices.length >= 2 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">가격 차이</span>
                        <span className={`font-medium ${spread > 20 ? "text-amber-600" : "text-slate-700"}`}>{spread}%</span>
                      </div>
                    )}
                  </>
                );
              })()}
              {/* 최저가 공급사 */}
              {(() => {
                const validResponses = (selectedQuote.responses ?? []).filter(r => typeof r.totalPrice === "number" && r.totalPrice > 0);
                if (validResponses.length === 0) return null;
                const best = validResponses.reduce((a, b) => (a.totalPrice! < b.totalPrice! ? a : b));
                return (
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">최저가 공급사</span>
                    <span className="text-emerald-400 font-medium">{best.vendor.name}</span>
                  </div>
                );
              })()}
              <div className="flex justify-between text-xs"><span className="text-slate-400">선택안</span><span className="text-slate-500">{selectedQuote.status === "COMPLETED" ? "확정됨" : "미확정"}</span></div>
            </div>
            <p className="text-[11px] text-slate-500 mt-2 leading-snug">{selectedSignals.snapshotNote}</p>
            {/* 요청 품목 요약 */}
            <div className="mt-2 space-y-1">
              {selectedQuote.items.slice(0, 3).map(item => (
                <div key={item.id} className="flex justify-between text-[11px]">
                  <span className="text-slate-700 truncate max-w-[200px]">{item.product.name}</span>
                  <span className="text-slate-500 shrink-0">×{item.quantity}</span>
                </div>
              ))}
              {selectedQuote.items.length > 3 && <p className="text-[11px] text-slate-500">+{selectedQuote.items.length - 3}건 더</p>}
            </div>
            {/* 회신이 있을 때: 공급사별 회신 요약 */}
            {sqResponseCount > 0 && (
              <div className="mt-2.5 pt-2 border-t border-bd/30 space-y-1">
                <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-1">공급사별 회신</div>
                {(selectedQuote.responses ?? []).slice(0, 4).map(resp => (
                  <div key={resp.id} className="flex justify-between text-[11px]">
                    <span className="text-slate-700 truncate max-w-[140px]">{resp.vendor.name}</span>
                    <span className="text-slate-400">{typeof resp.totalPrice === "number" && resp.totalPrice > 0 ? `₩${resp.totalPrice.toLocaleString("ko-KR")}` : "가격 미제출"}</span>
                  </div>
                ))}
                {(selectedQuote.responses ?? []).length > 4 && <p className="text-[10px] text-slate-500">+{(selectedQuote.responses ?? []).length - 4}건 더</p>}
              </div>
            )}
          </div>

          {/* D. Activity snapshot */}
          <div className="px-4 py-3 border-b border-bd/50">
            <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500 mb-2">최근 활동</div>
            <div className="space-y-1.5">
              <div className="flex items-start gap-2 text-[11px]">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                <div><span className="text-slate-700">요청 생성</span><RelativeTimeText iso={selectedQuote.createdAt} className="text-slate-500 ml-1.5" /></div>
              </div>
              {selectedQuote.status !== "PENDING" && (
                <div className="flex items-start gap-2 text-[11px]">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                  <div><span className="text-slate-700">견적 요청 발송</span></div>
                </div>
              )}
              {sqResponseCount > 0 && (
                <div className="flex items-start gap-2 text-[11px]">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                  <div><span className="text-slate-700">회신 {sqResponseCount}건 도착</span></div>
                </div>
              )}
              {selectedQuote.status === "RESPONDED" && (
                <div className="flex items-start gap-2 text-[11px]">
                  <span className="h-1.5 w-1.5 rounded-full bg-purple-400 mt-1.5 shrink-0" />
                  <div><span className="text-slate-700">비교 검토 필요</span></div>
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

          {/* § 3. 리스크 — 차단/위험 + 만료 임박 */}
          <section id="brief-risks" className="px-4 py-3 border-b border-bd/50 scroll-mt-4">
            <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500 mb-1.5">리스크</div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">차단/위험</span>
                <span className={selectedSignals.blocker === "차단 없음" ? "text-emerald-600" : "text-amber-600 font-medium"}>{selectedSignals.blocker}</span>
              </div>
              {sqDaysToDeadline !== null && (
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">납기 잔여</span>
                  <span className={sqDaysToDeadline < 0 ? "text-rose-600 font-medium" : sqDaysToDeadline <= 3 ? "text-amber-600" : "text-slate-700"}>
                    {sqDaysToDeadline < 0 ? `${Math.abs(sqDaysToDeadline)}일 초과` : `${sqDaysToDeadline}일`}
                  </span>
                </div>
              )}
              {sqDelayed && (
                <p className="text-[11px] text-amber-600 mt-1">⚠ 회신 지연 — 재요청 권장</p>
              )}
            </div>
          </section>

          {/* (was E. Decision summary + AI) — § 1 상황 요약 의 AI 판단 보조 */}
          <div className="px-4 py-3 border-b border-bd/50">
            <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500 mb-1.5">AI 판단</div>
            <p className="text-xs text-slate-700 leading-relaxed">{selectedSignals.summary}</p>
            {selectedSignals.aiRecommendation && (
              <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-1.5">
                <Sparkles className="h-3 w-3 text-slate-600 shrink-0" />{selectedSignals.aiRecommendation}
              </p>
            )}
          </div>

          {/* § 4. 다음 조치 — 연결 작업 + 발주 전환 정보 */}
          <section id="brief-next" className="px-4 py-3 scroll-mt-4">
            <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500 mb-1.5">다음 조치</div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs"><span className="text-slate-400">승인 정책</span><span className="text-slate-500">없음</span></div>
              <div className="flex justify-between text-xs"><span className="text-slate-400">외부 승인</span><span className="text-slate-500">불필요</span></div>
              <div className="flex justify-between text-xs"><span className="text-slate-400">다음 연결</span><span className="text-slate-700">{selectedSignals.handoffTarget}</span></div>
              <div className="flex justify-between text-xs"><span className="text-slate-400">전환 상태</span><span className={selectedSignals.poReady === "가능" ? "text-emerald-400" : "text-amber-600"}>{selectedSignals.handoffStatus}</span></div>
            </div>
          </section>

          {/* §11.55 — G-pre "공급사 회신 견적서 등록" 블록 제거.
              backend (`/api/quotes/[id]/attach-document`) 미구현으로
              dead-end UI였음. LabAxis 견적 응답 표준 워크플로우는
              자동 처리(Path 1: vendor token 응답 링크 + Path 2: SendGrid
              inbound webhook)이며 운영자가 PDF를 직접 등록하는
              시나리오는 LabAxis 운영 ontology에 없음. 미래 demand
              발생 시 backend + UI 함께 재구현. */}

          </div>{/* end scrollable body */}

          {/* G. Bottom sticky action — 3 canonical CTA (rail-first, no default page nav) */}
          <div className="px-4 py-3 border-t border-bd bg-el/30 space-y-1.5">
            {selectedDispatchBlocked && selectedDispatchPreflight && (
              <div
                data-testid="quote-dispatch-blocker-summary"
                className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 space-y-2"
              >
                <div>
                  <p className="text-[11px] font-semibold text-amber-900">전달 전 보강 필요</p>
                  <p className="text-[11px] text-amber-700 leading-snug">{selectedDispatchPreflight.summary}</p>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <Button
                    data-testid="quote-dispatch-supplier-remediation-cta"
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px] border-amber-300 text-amber-800"
                    onClick={() => setActiveWorkWindow("request_send")}
                  >
                    공급사 후보 보강
                  </Button>
                  <Link href="/app/search">
                    <Button
                      data-testid="quote-dispatch-request-remediation-cta"
                      size="sm"
                      variant="outline"
                      className="w-full h-7 text-[11px] border-amber-300 text-amber-800"
                    >
                      요청 보완
                    </Button>
                  </Link>
                </div>
              </div>
            )}
            <Button
              data-testid={selectedSignals.actionKey === "request_send" ? "quote-dispatch-review-cta" : undefined}
              size="sm"
              className={`w-full h-8 text-xs font-medium ${selectedDispatchBlocked ? "bg-slate-200 text-slate-500 cursor-not-allowed" : selectedSignals.ctaVariant === "default" ? "bg-blue-600 hover:bg-blue-500 text-white" : "border-bd text-slate-700"}`}
              onClick={() => {
                if (selectedDispatchBlocked) return;
                if (selectedSignals.actionKey) {
                  console.log("[QuoteQueue] quote_rail_cta_clicked", { caseId: selectedQuote.id, actionKey: selectedSignals.actionKey, uiState: selectedSignals.railState });
                  setActiveWorkWindow(selectedSignals.actionKey);
                }
              }}
              disabled={!selectedSignals.actionKey || selectedDispatchBlocked}
              title={selectedDispatchBlocked ? selectedDispatchPreflight?.summary : undefined}>
              {selectedDispatchBlocked ? "견적 요청 전달 잠김" : selectedSignals.railCtaLabel}<ArrowRight className="h-3 w-3 ml-1.5" />
            </Button>
            <div className="flex gap-1.5">
              <Link href={`/quotes/${selectedQuote.id}`} className="flex-1">
                <Button size="sm" variant="outline" className="w-full h-7 text-[11px] text-slate-400 border-bd">전체 상세 열기</Button>
              </Link>
              <Button size="sm" variant="ghost" className="flex-1 h-7 text-[11px] text-slate-500" onClick={(e) => { e.stopPropagation(); closeQuoteContextRail("x_button"); }}>{selectedSignals.tertiaryCta}</Button>
            </div>
          </div>
        </div>
        );
      })()}

      </div>{/* end flex container */}

      {/* §11.155 모바일 변종 — desktop rail (hidden lg:flex) 와 mutually exclusive */}
      {selectedQuote && selectedSignals && (
        <MobileOperationalBriefSheet
          open={!!selectedQuote}
          onClose={() => closeQuoteContextRail("x_button")}
          objectLabel="선택한 견적"
          chips={[
            { id: "summary", label: "상태 요약" },
            { id: "facts",   label: "회신 현황" },
            { id: "risks",   label: "리스크" },
            { id: "next",    label: "발주 전환" },
          ]}
          summary={<p className="text-xs text-slate-700 leading-relaxed">{selectedSignals.summary}</p>}
          facts={
            // §11.222 — mobile bottom sheet 인과관계 정합 (§11.221 desktop 동일 메시지).
            //   1차 노출 한 줄 (→ + emoji) + collapsible 3-row (기존 보존).
            //   같은 factsExpanded state 공유 (desktop + mobile 동일 toggle).
            //   helper 추출은 별도 트랙 (현재는 inline duplicate 일시 허용 — minimal-diff).
            <div className="space-y-2 text-xs">
              {(() => {
                const totalItems = selectedQuote.items.length;
                const replyCount = (selectedQuote.responses?.length ?? 0);
                const status = selectedSignals.status;
                const blocker = selectedSignals.blocker;
                const compareReady = selectedSignals.compareReady;
                const poReady = selectedSignals.poReady;
                const nextAction = selectedSignals.nextAction;

                let summary: string;
                if (blocker?.includes("공급사 미전송") || status?.includes("요청 생성")) {
                  summary = "📋 견적 미발송 → 비교·발주 차단 중. 발송이 첫 단계입니다.";
                } else if (selectedQuote.status === "SENT" && replyCount === 0) {
                  summary = "📤 발송 완료 → 회신 대기 중. 응답 수집이 다음 단계입니다.";
                } else if (replyCount > 0 && replyCount < totalItems) {
                  summary = `📥 회신 ${replyCount}/${totalItems} → 일부 수신 중. 추가 회신 대기 또는 비교 검토 진입 가능.`;
                } else if (replyCount > 0 && replyCount >= totalItems && (compareReady === "가능" || compareReady === "완료")) {
                  summary = "📊 회신 수집 완료 → 비교 검토 가능. 최적안 선택이 다음 단계입니다.";
                } else if (poReady === "가능") {
                  summary = "✅ 비교 완료 → 발주 전환 가능. 결재 또는 PO 생성이 다음 단계입니다.";
                } else {
                  summary = `${blocker && blocker !== "차단 없음" ? `⚠️ 차단: ${blocker} → ` : "→ "}다음 단계: ${nextAction ?? "-"}`;
                }
                return (
                  <p className="text-xs leading-relaxed text-slate-800 font-medium">{summary}</p>
                );
              })()}
              <button
                type="button"
                onClick={() => setFactsExpanded(prev => !prev)}
                className="text-[10px] text-slate-500 hover:text-slate-700 inline-flex items-center gap-0.5 transition-colors"
                aria-label={factsExpanded ? "판단 근거 상세 접기" : "판단 근거 상세 보기"}
              >
                {factsExpanded ? "접기" : "상세 보기"}
                {factsExpanded ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </button>
              {factsExpanded && (
                <div className="space-y-1 pt-2 border-t border-slate-200">
                  <div className="flex justify-between"><span className="text-slate-400">현재 상태</span><span className="font-medium">{selectedSignals.status}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">다음 액션</span><span>{selectedSignals.nextAction}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">수신 견적</span><span>{(selectedQuote.responses?.length ?? 0)}건</span></div>
                </div>
              )}
            </div>
          }
          risks={
            <p className={`text-xs ${selectedSignals.blocker === "차단 없음" ? "text-emerald-700" : "text-amber-700"}`}>
              {selectedSignals.blocker}
            </p>
          }
          next={<p className="text-xs text-slate-700">{selectedSignals.handoffTarget}</p>}
          primaryCta={selectedDispatchBlocked ? {
            label: "공급사 후보 보강",
            onClick: () => { setActiveWorkWindow("request_send"); },
          } : selectedSignals.actionKey ? {
            label: selectedSignals.railCtaLabel,
            onClick: () => { setActiveWorkWindow(selectedSignals.actionKey); },
          } : undefined}
        />
      )}

      {/* ═══ 견적 발송 워크벤치 (request_send) ═══ */}
      {activeWorkWindow === "request_send" && selectedQuote && (
        <VendorRequestModal
          open={true}
          onOpenChange={(open) => { if (!open) setActiveWorkWindow(null); }}
          quoteId={selectedQuote.id}
          quoteSummary={selectedQuote.title}
          // #user-supplier-registration Phase 5 — org_book source forward.
          resolvedSuppliers={resolveSuppliers({ quote: selectedQuote, organizationVendors, organizationVendorProducts })}
          draftMessage={buildDraftMessage(selectedQuote)}
          onSuccess={handleSendSuccess}
        />
      )}

      {/* ═══ §11.217 Phase 3 — 일괄 발송 검토 sheet ═══ */}
      {/* #user-supplier-registration Phase 5 — getPreflight 가 organizationVendors
          를 closure 로 capture. BatchDispatchSheet 가 props 로도 받음. */}
      <BatchDispatchSheet
        open={batchSheetOpen}
        onOpenChange={setBatchSheetOpen}
        selectedQuotes={selectedQuotes as never}
        getPreflight={((q: Quote) => getQuoteDispatchPreflight(q, organizationVendors)) as never}
        organizationVendors={organizationVendors}
        onSuccess={() => { refetch(); clearSelection(); }}
      />

      {/* ═══ Center Work Window — rail CTA에서 열리는 task surface ═══ */}
      {activeWorkWindow && activeWorkWindow !== "request_send" && selectedQuote && selectedSignals && (
        <CenterWorkWindow
          open={true}
          onClose={() => setActiveWorkWindow(null)}
          title={selectedSignals.railCtaLabel}
          subtitle={`${selectedQuote.title} · ${selectedSignals.badge}`}
          phase="ready"
          primaryAction={{
            label: activeWorkWindow === "compare_review"
              ? ((selectedQuote.responses?.length ?? 0) >= 2 ? "선택안 확정" : "추가 회신 확보")
              : activeWorkWindow === "approval_prep"
              ? "승인 패키지 준비 완료"
              : selectedSignals.ctaLabel,
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
                <span className={`inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded border font-medium ${selectedOpStatus?.bg} ${selectedOpStatus?.text} ${selectedOpStatus?.border}`}>
                  {selectedSignals.badge}
                </span>
                <span className="text-xs text-slate-400">#{selectedQuote.id.slice(0, 8).toUpperCase()}</span>
              </div>
              <h3 className="text-sm font-semibold text-slate-900 mb-1">{selectedQuote.title}</h3>
              <p className="text-xs text-slate-400">{selectedSignals.summary}</p>
            </div>

            {/* Action-specific content */}
            {activeWorkWindow === "followup_send" && (
              <div className="rounded-lg border border-bd bg-pn p-4 space-y-3">
                <p className="text-xs font-medium text-slate-700">재요청 / 추가 회신 확보</p>
                <p className="text-xs text-slate-400">미응답 공급사에 재요청하거나 추가 공급사를 탐색합니다.</p>
                <div className="text-xs text-slate-500">현재 회신: {selectedQuote.responses?.length ?? 0}건</div>
              </div>
            )}
            {activeWorkWindow === "compare_review" && (() => {
              const sqrc = selectedQuote.responses?.length ?? 0;
              const validQuotes = sqrc;
              const hasSelection = selectedQuote.status === "COMPLETED";
              const blockers: { label: string; reason: string; action: string }[] = [];
              if (validQuotes < 2) blockers.push({ label: "유효 견적 부족", reason: "비교에 필요한 견적 수가 부족합니다", action: "추가 회신 확보" });
              if (!hasSelection && validQuotes >= 2) blockers.push({ label: "선택안 미확정", reason: "비교는 가능하지만 선택안이 아직 확정되지 않았습니다", action: "선택안 확정" });
              const canConfirm = validQuotes >= 2 && blockers.length === 0;
              const responses = selectedQuote.responses ?? [];
              const prices = responses.map(r => r.totalPrice).filter((p): p is number => typeof p === "number" && p > 0);

              return (
                <div className="space-y-4">
                  {/* A. Compare Snapshot Block */}
                  <div className="rounded-lg border border-bd bg-pn p-4">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500 mb-2">비교 현황</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                      <div><p className="text-lg font-bold tabular-nums text-slate-900">{sqrc}</p><p className="text-[11px] text-slate-500">수신 견적</p></div>
                      <div><p className="text-lg font-bold tabular-nums text-slate-900">{validQuotes}</p><p className="text-[11px] text-slate-500">유효 견적</p></div>
                      <div><p className="text-lg font-bold tabular-nums text-slate-900">{selectedQuote.items.length}</p><p className="text-[11px] text-slate-500">품목</p></div>
                      <div><p className={`text-lg font-bold ${hasSelection ? "text-emerald-400" : "text-amber-600"}`}>{hasSelection ? "확정" : "미확정"}</p><p className="text-[11px] text-slate-500">선택안</p></div>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-snug">
                      {validQuotes >= 2 ? "비교 자체는 가능하지만 선택안 확정이 남아 있습니다" : "유효 견적이 부족해 비교 후보가 안정적으로 만들어지지 않았습니다"}
                    </p>
                  </div>

                  {/* B. Candidate Decision Block */}
                  <div className="rounded-lg border border-bd bg-pn p-4">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500 mb-2">비교 후보</p>
                    {responses.length > 0 ? (
                      <div className="space-y-2">
                        {responses.slice(0, 2).map((r, idx) => {
                          const isRecommended = idx === 0 && prices.length > 0;
                          return (
                            <div key={r.id} className={`rounded border p-3 ${isRecommended ? "border-blue-600/30 bg-blue-600/5" : "border-bd"}`}>
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium text-slate-700">{r.vendor.name || "공급사"}</span>
                                  {isRecommended && <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-600/15 text-blue-600 border border-blue-600/20">추천</span>}
                                </div>
                                {r.totalPrice && <span className="text-xs font-semibold tabular-nums text-slate-900">₩{r.totalPrice.toLocaleString("ko-KR")}</span>}
                              </div>
                              <p className="text-[11px] text-slate-500">
                                {isRecommended ? "가격 우위 · 기존 거래처" : "대안 후보"}
                              </p>
                            </div>
                          );
                        })}
                        {responses.length > 2 && <p className="text-[11px] text-slate-500">+{responses.length - 2}건 더</p>}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 py-3">수신 견적이 없어 비교 후보를 구성할 수 없습니다. 추가 회신 확보가 필요합니다.</p>
                    )}
                  </div>

                  {/* C. Blocker & Handoff Block */}
                  <div className="rounded-lg border border-bd bg-pn p-4">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500 mb-2">차단 / 다음 단계</p>
                    {blockers.length > 0 ? (
                      <div className="space-y-2 mb-3">
                        {blockers.map((b, idx) => (
                          <div key={idx} className="rounded border border-amber-600/20 bg-amber-600/5 px-3 py-2">
                            <div className="flex items-center gap-2 text-xs mb-0.5">
                              <AlertTriangle className="h-3 w-3 text-amber-600 shrink-0" />
                              <span className="text-amber-300 font-medium">{b.label}</span>
                            </div>
                            <p className="text-[11px] text-slate-400 pl-5">{b.reason}</p>
                            <p className="text-[11px] text-blue-600 pl-5 mt-0.5">해소 액션: {b.action}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-emerald-400 mb-3">
                        <CheckCircle2 className="h-3.5 w-3.5" />차단 없음 — 선택안 확정 가능
                      </div>
                    )}
                    <div className="flex justify-between text-xs pt-2 border-t border-bd/50">
                      <span className="text-slate-400">다음 목적지</span>
                      <span className="text-slate-700">{canConfirm ? "승인 패키지 준비 또는 발주 전환" : "조건 해소 후 확정"}</span>
                    </div>
                  </div>
                </div>
              );
            })()}
            {activeWorkWindow === "approval_prep" && (() => {
              const sqrc = selectedQuote.responses?.length ?? 0;
              const prices = (selectedQuote.responses ?? []).map(r => r.totalPrice).filter((p): p is number => typeof p === "number" && p > 0);
              const bestPrice = prices.length > 0 ? Math.min(...prices) : null;
              const bestVendor = selectedQuote.responses?.find(r => r.totalPrice === bestPrice);

              return (
                <div className="space-y-4">
                  {/* A. Approval Package Summary */}
                  <div className="rounded-lg border border-bd bg-pn p-4">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500 mb-2">승인 패키지 요약</p>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <p className="text-[11px] text-slate-500">선택안</p>
                        <p className="text-xs text-slate-700 font-medium">{bestVendor?.vendor.name ?? "미확정"}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-slate-500">예상 금액</p>
                        <p className="text-xs text-slate-700 font-medium tabular-nums">{bestPrice ? `₩${bestPrice.toLocaleString("ko-KR")}` : "미정"}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-slate-500">품목</p>
                        <p className="text-xs text-slate-700">{selectedQuote.items.length}건</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-slate-500">공급사</p>
                        <p className="text-xs text-slate-700">{sqrc}곳 회신</p>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-snug">현재 선택안은 확정되었고 외부 승인 패키지 전달 준비 단계입니다</p>
                  </div>

                  {/* B. Approval Readiness & Exception */}
                  <div className="rounded-lg border border-bd bg-pn p-4">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500 mb-2">승인 준비 상태</p>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">선택안 확정</span>
                        <span className={bestPrice ? "text-emerald-400" : "text-amber-600"}>{bestPrice ? "준비 완료" : "확인 필요"}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">문서 상태</span>
                        <span className="text-emerald-400">준비 완료</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">예산 차단</span>
                        <span className="text-emerald-400">차단 없음</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">승인 정책</span>
                        <span className="text-slate-700">외부 승인 필요</span>
                      </div>
                    </div>
                  </div>

                  {/* C. Handoff Recording */}
                  <div className="rounded-lg border border-bd bg-pn p-4">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500 mb-2">승인 전달 기록</p>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">전달 채널</span>
                        <span className="text-slate-700">외부 전자결재</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">현재 상태</span>
                        <span className="text-amber-600">승인 준비 중</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">승인 완료 후</span>
                        <span className="text-slate-700">발주 전환 준비</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
            {activeWorkWindow === "po_conversion" && (
              <div className="rounded-lg border border-bd bg-pn p-4 space-y-3">
                <p className="text-xs font-medium text-slate-700">발주 전환 준비</p>
                <p className="text-xs text-slate-400">line item을 확정하고 발주 조건을 검토한 뒤 PO를 생성합니다.</p>
                <div className="text-xs text-slate-500">품목: {selectedQuote.items.length}건</div>
              </div>
            )}

            {/* AI recommendation */}
            {selectedSignals.aiRecommendation && (
              <p className="text-[11px] text-slate-500 flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-slate-600 shrink-0" />{selectedSignals.aiRecommendation}
              </p>
            )}
          </div>
        </CenterWorkWindow>
      )}

      {/* ═══ AI 견적서 파싱 모달 ═══ */}
      <AiQuoteParseModal
        open={aiParseModalOpen}
        onClose={() => setAiParseModalOpen(false)}
        quoteId={selectedQuoteId}
        onRegistered={() => {
          refetch();
          toast({ title: "AI 견적서 파싱 완료", description: "벤더 응답이 등록되었습니다." });
        }}
      />

      {/* ═══ AI 견적서 비교 모달 ═══ */}
      <Dialog open={aiCompareOpen} onOpenChange={setAiCompareOpen}>
        <DialogContent className="max-w-2xl bg-white border-slate-200 p-0 gap-0">
          <div className="px-6 pt-6 pb-4 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg text-slate-900">
                <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-blue-600" />
                </div>
                AI 견적서 비교 분석
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-500 mt-1">
                등록된 견적의 공급사별 조건을 비교하고 협상 포인트를 제안합니다
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="px-6 py-5 max-h-[60vh] overflow-y-auto space-y-4">
            {aiCompareLoading && (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                <p className="text-sm text-slate-500">견적 데이터를 분석하고 있습니다...</p>
              </div>
            )}

            {aiCompareError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                <p className="text-sm text-red-600">{aiCompareError}</p>
                <button onClick={runAiQuoteCompare} className="mt-2 text-xs text-red-500 hover:text-red-700 font-medium underline">재시도</button>
              </div>
            )}

            {aiCompareResult && (
              <>
                {/* 공급사별 비교 테이블 */}
                {aiCompareResult.comparison.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 mb-2">공급사 비교</h4>
                    <div className="rounded-lg border border-slate-200 overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50 text-slate-600">
                            <th className="text-left px-3 py-2 font-medium">공급사</th>
                            <th className="text-left px-3 py-2 font-medium">가격</th>
                            <th className="text-left px-3 py-2 font-medium">납기</th>
                            <th className="text-left px-3 py-2 font-medium">배송비</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {aiCompareResult.comparison.map((row, i) => (
                            <tr key={i} className="hover:bg-slate-50/50">
                              <td className="px-3 py-2 font-medium text-slate-900">{row.vendor}</td>
                              <td className="px-3 py-2 text-slate-700">{row.price}</td>
                              <td className="px-3 py-2 text-slate-700">{row.leadTime}</td>
                              <td className="px-3 py-2 text-slate-700">{row.shippingFee}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 추천 */}
                {aiCompareResult.recommendation && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4">
                    <div className="flex items-center gap-2 mb-1.5">
                      <CheckCircle2 className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-semibold text-blue-900">추천</span>
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed">{aiCompareResult.recommendation}</p>
                  </div>
                )}

                {/* 협상 가이드 */}
                {aiCompareResult.negotiationGuide && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
                    <div className="flex items-center gap-2 mb-1.5">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <span className="text-sm font-semibold text-amber-900">협상 포인트</span>
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{aiCompareResult.negotiationGuide}</p>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="px-6 py-3 border-t border-slate-100 flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setAiCompareOpen(false)}>닫기</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Intake Dock (외부 견적서 업로드 / BOM 업로드) ── */}
      <QuoteIntakeDock
        open={intakeDockOpen}
        onOpenChange={setIntakeDockOpen}
        source={intakeDockSource}
        onCommitSuccess={() => {
          setIntakeDockOpen(false);
          setIntakeDockSource(null);
          refetch();
        }}
      />

      {/* §11.181 — 운영 브리핑 floating entry (default = popup open) */}
      <OperationalBriefFloatingEntry controls="operational-brief-popup" />
    </div>
  );
}

function QuotesPageInner() {
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

// §11.214b Path Z — NoSSR wrapper.
export default function QuotesPage() {
  return (
    <NoSSR>
      <QuotesPageInner />
    </NoSSR>
  );
}