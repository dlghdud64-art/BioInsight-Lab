"use client";

export const dynamic = 'force-dynamic';

import { useState, useMemo, useCallback, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUserPreferences } from "@/lib/preferences/user-preferences";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search, Package, CheckCircle2, Clock, AlertCircle, AlertTriangle,
  ArrowRight, X, ListChecks, CircleCheck, ChevronRight, ChevronDown, ChevronUp, FileText,
  Sparkles, Truck, Check, Send, ShoppingCart, Columns3, ScanLine,
} from "lucide-react";
import Link from "next/link";
import { csrfFetch } from "@/lib/api-client";
import { toast } from "@/hooks/use-toast";
import { MobileOperationalBriefSheet } from "@/components/operational-brief/mobile-bottom-sheet";
import { OperationalBriefFloatingEntry } from "@/components/operational-brief/floating-entry";
// §11.258-sweep-2 — 모바일 좌측 하단 ✨ 진입 (방안 1 위치 분리).
import { MobileBriefInlineButton } from "@/components/operational-brief/mobile-inline-button";
import { MetricCell } from "@/components/operational-brief/metric-cell";
import { invalidateBriefNarrative, useOperationalBriefNarrative } from "@/lib/hooks/use-operational-brief";
// §11.209b Phase 3 — workspace.plan → approvalPolicy 매핑 (헤더 카피
// Tier 분기). Lab Team 카피에서 결재 약속 제거 = dead promise 차단.
import { resolveApprovalPolicyForPlan } from "@/lib/billing/plan-descriptor";
// §11.209d-mutation — reject Dialog (reason input).
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
// §11.334 — 빈상태 온보딩 "견적서 스캔" CTA wiring. §10 에서 land 한 모달 재사용.
import { QuoteScannerModal } from "@/components/inventory/QuoteScannerModal";

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
//  (status / blocker / nextAction / three review options) is back, but every
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
//   • tri-option decision support only — resolver drafts options, operator confirms final action
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
    // §11.209b Phase 3 — workspace.plan (헤더 카피 Tier 분기).
    workspacePlan?: string | null;
    // §11.209c Phase 2 — workspace.stripePriceId (TEAM SKU 분기).
    // BUSINESS_MONTHLY 매칭 시 R&D Operations 결재 약속 활성.
    workspaceStripePriceId?: string | null;
  };
}

type QueueTab = "all" | ConversionStatus;

// §11.284a #purchases-kpi-label-relabel — 호영님 P0 spec: 구매 운영 KPI 라벨
//   "발주 전환 대기 / 발주 승인 대기 / 발주 확정 / 공급사 통보 완료" 으로 통일.
//   기존 "검토 필요 / 발주 가능 / 확정됨 / 만료" → 구매 운영 실제 단계명 정합.
const STATUS_MAP: Record<ConversionStatus, { label: string; bg: string; text: string; border: string }> = {
  review_required: { label: "발주 인계 대기", bg: "bg-blue-50",    text: "text-blue-600",    border: "border-blue-200" },
  ready_for_po:    { label: "발주 승인 대기", bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-200" },
  hold:            { label: "보류",          bg: "bg-slate-100",  text: "text-slate-600",   border: "border-slate-200" },
  confirmed:       { label: "발주 확정",     bg: "bg-purple-50",  text: "text-purple-600",  border: "border-purple-200" },
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

const DECISION_SUPPORT_STATUS_LABEL: Record<AiRecommendationStatus, { label: string; className: string }> = {
  recommended:   { label: "AI 추천 완료", className: "text-blue-600" },
  review_needed: { label: "AI 검토 필요", className: "text-yellow-600" },
  hold:          { label: "AI 판단 보류", className: "text-slate-500" },
};

const RECOMMENDATION_LEVEL_LABEL: Record<AiOption["recommendationLevel"], string> = {
  primary: "추천",
  alternate: "대체",
  conservative: "보수",
};

export default function PurchasesPage() {
  const { status: authStatus, data: session } = useSession();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [queueTab, setQueueTab] = useState<QueueTab>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // §11.277c — 모바일 카드 2단계 접힘/펼침 (호영님 P0 spec, §11.264g 패턴 reuse).
  //   default collapsed (모바일 한정). 접힌 = 배지/제목/막힘/다음 단계.
  //   펼친 = + itemSummary 본문 + 우측 AI/가격/CTA panel. 데스크탑 (md+) 변경 0.
  const [expandedCardIds, setExpandedCardIds] = useState<Set<string>>(new Set());
  const toggleCardExpand = useCallback((id: string) => {
    setExpandedCardIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  // §11.230c (a)-6 #purchases-orders-filter-sync — server-first hydration.
  //   preferences.purchasesFilter.queueTab 도착 시 QueueTab validation 후 setQueueTab.
  const userPrefs = useUserPreferences();
  useEffect(() => {
    const serverTab = userPrefs.preferences?.purchasesFilter?.queueTab;
    if (!serverTab) return;
    // QueueTab = "all" | ConversionStatus. 자유 string → page UI 가드 (잘못된 값은 setQueueTab 후 UI default).
    setQueueTab(serverTab as QueueTab);
  }, [userPrefs.preferences]);

  // §11.230c (a)-6 — debounced server PATCH on queueTab change.
  useEffect(() => {
    userPrefs.updatePurchasesFilter({ queueTab });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queueTab]);

  // §11.209d-mutation — approve/reject CTA 권한 check (ADMIN/OWNER 만).
  // server enforceAction 이 진짜 lock — client check 는 button visibility
  // 만 (defense in depth).
  const userRole = (session?.user as { role?: string })?.role;
  const canApprove = userRole === "ADMIN" || userRole === "OWNER";

  // §11.209d-mutation — reject Dialog state (reason input)
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectingRequestId, setRejectingRequestId] = useState<string | null>(null);

  // §11.209d-history-expand — "이전 결재 이력" expand state
  const [historyExpanded, setHistoryExpanded] = useState(false);

  // §11.334 — 빈상태 온보딩 "견적서 스캔" 모달 open state.
  const [scanOpen, setScanOpen] = useState(false);

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

  // §11.209b Phase 3 + §11.209c Phase 2 — workspace.plan + stripePriceId
  // → approvalPolicy 매핑. TEAM + BUSINESS_MONTHLY 매칭 시 R&D Operations
  // approvalPolicy 'in_app_approval' → 결재 약속 카피 visible.
  const approvalPolicy = resolveApprovalPolicyForPlan(
    data?.data?.workspacePlan ?? null,
    data?.data?.workspaceStripePriceId ?? null,
  );
  const showsApprovalPromise = approvalPolicy !== "none";

  // α-D session B (ADR §11.22): atomic bulk-PO conversion. Takes the
  // current ready_for_po quoteIds and POSTs them all-or-nothing. On
  // success, invalidate the queue so the just-converted rows shift to
  // the confirmed bucket. On failure, toast the server's error code
  // (most operationally meaningful is the first failing quote).
  const bulkPoMutation = useMutation({
    mutationFn: async (quoteIds: string[]) => {
      const res = await csrfFetch(
        `/api/work-queue/purchase-conversion/bulk-po`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quoteIds }),
          credentials: "include",
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "일괄 발주 인계 실패");
      }
      return res.json();
    },
    onSuccess: (data: { data: { results: Array<{ quoteId: string; orderNumber: string }> } }) => {
      const n = data.data.results.length;
      toast({
        title: `${n}건 발주 인계 완료`,
        description:
          data.data.results
            .slice(0, 3)
            .map((r) => r.orderNumber)
            .join(", ") +
          (n > 3 ? ` 외 ${n - 3}건` : "") +
          " · 발주 관리에서 외부 발주·입고를 추적하세요.",
      });
      queryClient.invalidateQueries({ queryKey: ["purchase-conversion-queue"] });
      // §11.158 cache-bust — bulk-PO 직후 영향 quote brief 모두 invalidate
      for (const r of data.data.results) {
        invalidateBriefNarrative({ quoteId: r.quoteId, module: "purchase_conversion", sourceUpdatedAt: new Date() });
        invalidateBriefNarrative({ quoteId: r.quoteId, module: "quote_detail", sourceUpdatedAt: new Date() });
      }
    },
    onError: (err: Error) => {
      toast({
        title: "일괄 발주 인계 실패",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  // §11.209d-mutation — approve/reject PurchaseRequest from purchases
  // detail panel. mutation API 는 이미 land (/api/request/[id]/approve|reject) —
  // admin/requests page 의 패턴 흡수. server enforceAction 이 진짜 lock.
  const approveRequestMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const res = await csrfFetch(`/api/request/${requestId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || body?.message || "결재 승인 실패");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "결재 승인 완료", description: "발주 인계가 가능합니다." });
      queryClient.invalidateQueries({ queryKey: ["purchase-conversion-queue"] });
    },
    onError: (err: Error) => {
      toast({
        title: "결재 승인 실패",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const rejectRequestMutation = useMutation({
    mutationFn: async (vars: { requestId: string; reason: string }) => {
      const res = await csrfFetch(`/api/request/${vars.requestId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason: vars.reason }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || body?.message || "결재 반려 실패");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "결재 반려 처리됨", description: "재요청 또는 대안 검토가 필요합니다." });
      queryClient.invalidateQueries({ queryKey: ["purchase-conversion-queue"] });
      setRejectDialogOpen(false);
      setRejectReason("");
      setRejectingRequestId(null);
    },
    onError: (err: Error) => {
      toast({
        title: "결재 반려 실패",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  // §11.209d-pr-auto-create — Quote → PurchaseRequest 결재 요청 mutation.
  // R&D Operations / Enterprise workspace 의 결재 정책 (in_app_approval)
  // 활성 시만 호출 가능 (server enforceAction + policy check). 성공 시
  // PR INSERT (PENDING) → next refetch 에서 internalApprovalStatus="PENDING"
  // → §11.209d UI 분기 (결재 대기 badge + PO CTA disabled) 자동 활성.
  const requestApprovalMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      const res = await csrfFetch(
        `/api/work-queue/purchase-conversion/${quoteId}/request-approval`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || body?.error || "결재 요청 실패");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "결재 요청 완료",
        description: "결재자에게 알림이 전송됩니다.",
      });
      queryClient.invalidateQueries({ queryKey: ["purchase-conversion-queue"] });
    },
    onError: (err: Error) => {
      toast({
        title: "결재 요청 실패",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  // α-F (ADR §11.25): generate / fetch persisted LLM rationale for a
  // single supplier option. Backend caches by (quoteId, optionId);
  // first call hits the LLM, subsequent calls return cached
  // AiActionItem result. invalidateQueries() reloads the queue so
  // resolver picks up the new RATIONALE_SUMMARY row.
  const rationaleMutation = useMutation({
    mutationFn: async (vars: {
      quoteId: string;
      optionId: string;
      supplierName: string;
      replied: boolean;
      price: number | null;
      leadDays: number | null;
      moq: number | null;
      currency: string;
      quoteTitle: string;
      totalSuppliers: number;
    }) => {
      const res = await csrfFetch(
        `/api/ai-actions/generate/quote-rationale`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(vars),
          credentials: "include",
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "검토 근거 생성 실패");
      }
      return res.json();
    },
    onSuccess: (data: {
      data: { rationale: string[]; fromCache: boolean; aiModel: string | null };
    }, vars) => {
      toast({
        title: data.data.fromCache ? "검토 근거 (캐시)" : "검토 근거 생성 완료",
        description: data.data.rationale.join(" · "),
      });
      queryClient.invalidateQueries({ queryKey: ["purchase-conversion-queue"] });
      // §11.158 cache-bust — rationale update 후 brief stale
      invalidateBriefNarrative({ quoteId: vars.quoteId, module: "purchase_conversion", sourceUpdatedAt: new Date() });
    },
    onError: (err: Error) => {
      toast({
        title: "검토 근거 생성 실패",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  // α-D session A (ADR §11.21): persist operator's reply choice.
  // POST { replyId } / { replyId: null } to un-select. Optimistic UX
  // is intentionally not used — a single round-trip + invalidation is
  // simple and cannot leave the UI showing a phantom selection if the
  // server rejects.
  const selectReplyMutation = useMutation({
    mutationFn: async (vars: { quoteId: string; replyId: string | null }) => {
      const res = await csrfFetch(
        `/api/quotes/${vars.quoteId}/select-reply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ replyId: vars.replyId }),
          credentials: "include",
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "선택안 저장 실패");
      }
      return res.json();
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["purchase-conversion-queue"] });
      // §11.158 cache-bust — selectedReplyId 변경은 두 surface narrative 모두 stale
      invalidateBriefNarrative({ quoteId: vars.quoteId, module: "purchase_conversion", sourceUpdatedAt: new Date() });
      invalidateBriefNarrative({ quoteId: vars.quoteId, module: "quote_detail", sourceUpdatedAt: new Date() });
    },
    onError: (err: Error) => {
      toast({
        title: "선택안 저장 실패",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const items = data?.data.items ?? [];
  const stats = data?.data.stats ?? {
    total: 0, review_required: 0, ready_for_po: 0, hold: 0, confirmed: 0, expired: 0,
  };

  // §11.284d #purchases-base-status-whitelist — 호영님 P1 spec (2026-05-23):
  // 구매 운영 목록은 발주 단계 (ready_for_po 이상) 만 표시. STATUS_MAP 의 5
  // status (review_required / ready_for_po / hold / confirmed / expired) =
  // 발주 라이프사이클 단계. 견적 단계 (sent / collecting / comparing 등)
  // conversionStatus 가 STATUS_MAP 에 없는 item 은 자동 제외 → 구매 운영
  // 와 견적 관리 화면 정체성 분리 (호영님 "발주 관리 화면" 인지 가능).
  const PURCHASE_STAGE_STATUSES = useMemo(
    () => new Set(Object.keys(STATUS_MAP)),
    [],
  );
  const filteredItems = useMemo(() => {
    // (1) Base whitelist — 발주 단계 status 만 (견적 단계 자동 제외)
    let result = items.filter((i) =>
      PURCHASE_STAGE_STATUSES.has(i.conversionStatus),
    );
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
  }, [items, queueTab, searchQuery, PURCHASE_STAGE_STATUSES]);

  const selectedItem = useMemo(() => {
    if (!selectedId) return null;
    return items.find((i) => i.id === selectedId) ?? null;
  }, [selectedId, items]);

  const closeRail = useCallback(() => setSelectedId(null), []);
  // §11.181 — handleFloatingEntryClick 제거: FAB default 가 popup 호출.

  // §11.161 — 운영 브리핑 narrative hook
  const { narrative: briefNarrative, cached: briefCached } = useOperationalBriefNarrative({
    sourceTrace: {
      quoteId: selectedItem?.id ?? "",
      module: "purchase_conversion",
      sourceUpdatedAt: new Date(0),
    },
    facts: {
      status: selectedItem ? (STATUS_MAP[selectedItem.conversionStatus]?.label ?? selectedItem.conversionStatus) : null,
      blocker: selectedItem?.blockerType !== "none" ? (selectedItem?.blockerReason ?? null) : "차단 없음",
      nextAction: selectedItem?.nextStage ?? null,
    },
    enabled: !!selectedItem?.id,
  });

  const formatPrice = (n: number | null, c: string) => {
    if (n === null || n === undefined) return "—";
    return c === "KRW" ? `₩${n.toLocaleString("ko-KR")}` : `${c} ${n.toLocaleString("en-US")}`;
  };

  return (
    <div className="min-h-screen bg-white p-4 md:p-6 pt-4 md:pt-4">
      {/* §11.333 Part A — 운영 화면 wide 정책 정합. 옛 max-w-7xl(1280px) → max-w-full
          (다른 운영 화면 dashboard/quotes/inventory/purchase-orders/receiving 와 동일). */}
      <div className="max-w-full mx-auto space-y-4">

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
            {/* §11.209 — 실무 담당자 톤 정합. 책임자 보고 톤("처리합니다")
                이 아니라 담당자가 지금 무엇을 하는지 명시. */}
            {/* §11.209b Phase 3 — Tier 분기. Lab Team (approvalPolicy='none')
                사용자에게는 결재 약속 카피 제거 (dead promise 차단). R&D
                Operations / Enterprise (in_app_approval) 만 약속 visible. */}
            <p className="text-sm text-slate-500 mt-0.5">
              회신 받은 견적을 비교하고 발주로 전환하세요.
              {showsApprovalPromise && " 결재가 필요한 항목은 자동으로 결재 라인에 올라갑니다."}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Link href="/app/search">
              <Button variant="outline" size="sm" className="h-10 px-4 text-sm gap-2 border-slate-200 font-medium">
                <Search className="h-4 w-4" /> 소싱
              </Button>
            </Link>
            {/* §11.306b — header 의 quotes-archive CTA 제거 (호영님 P2 2026-05-26).
                하단 탭바 /dashboard/quotes 와 중복. 하단 탭바 wiring 보존 — 사용자
                접근 경로 0 회귀, header CTA 만 단순화. FileText icon 은 line 886/1399
                다른 사용처 보존되어 import 유지. */}
            {/*
              "일괄 발주 전환" header CTA — α-D session B (ADR §11.22).
              Wired to /api/work-queue/purchase-conversion/bulk-po. Only
              renders when stats.ready_for_po > 0 so it never appears
              as a dead button.
            */}
            {stats.ready_for_po > 0 && (
              <Button
                size="sm"
                className="h-10 px-5 text-sm gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm disabled:opacity-60"
                disabled={bulkPoMutation.isPending}
                onClick={() => {
                  const ids = items
                    .filter((i) => i.conversionStatus === "ready_for_po")
                    .map((i) => i.id);
                  if (ids.length === 0) return;
                  // Confirm dialog — no fancy modal, just the browser
                  // confirm. Bulk-PO is reversible at the operational
                  // level (operator can request cancellation), but the
                  // mutation itself is atomic so a single OK / Cancel
                  // is the right friction.
                  const ok = window.confirm(
                    `발주 가능 ${ids.length}건을 발주 인계로 정리합니다. 인계 후 발주 관리에서 외부 발주·입고를 추적합니다. 진행하시겠습니까?`,
                  );
                  if (!ok) return;
                  bulkPoMutation.mutate(ids);
                }}
              >
                <CheckCircle2 className="h-4 w-4" /> 일괄 발주 인계 ({stats.ready_for_po})
              </Button>
            )}
          </div>
        </div>

        {/* §11.277a (= §11.273b reapply) — 모바일 KPI 1줄 숫자 요약 바 (호영님 P0 spec, §11.272c 패턴 reuse).
            2×2 그리드 → 1줄 (검토/발주/확정/만료) + count. 0건 = text-slate-400 (회색),
            count > 0 = tone color, 활성 queueTab = bg-slate-100. tap → setQueueTab
            (KpiCard onClick 와 동일 분기). md:hidden — 데스크탑은 아래 4 cell grid 유지.
            §11.272b-restore-2 (134a94ea) base restore 시 §11.273b dropped 이후 reapply. */}
        <div
          data-testid="purchases-kpi-mobile-summary-bar"
          className="md:hidden flex items-stretch border-y border-slate-200 bg-white -mx-3 px-1 py-1"
          role="group"
          aria-label="구매 상태별 요약"
        >
          {/* §11.284a 모바일 KPI 라벨 — 검토→전환대기 / 발주→승인대기 / 확정 보존 / 만료→통보완료. */}
          {[
            { short: "전환대기", count: stats.review_required, tab: "review_required" as QueueTab, activeText: "text-blue-600" },
            { short: "승인대기", count: stats.ready_for_po, tab: "ready_for_po" as QueueTab, activeText: "text-emerald-600" },
            { short: "확정", count: stats.confirmed, tab: "confirmed" as QueueTab, activeText: "text-purple-600" },
            { short: "통보완료", count: stats.expired, tab: "review_required" as QueueTab, activeText: "text-rose-600" },
          ].map(({ short, count, tab, activeText }) => {
            const isActive = queueTab === tab;
            const isZero = count === 0;
            return (
              <button
                key={short}
                type="button"
                onClick={() => setQueueTab(prev => prev === tab ? "all" : tab)}
                aria-pressed={isActive}
                aria-label={`${short} ${count}건${isActive ? " · 선택됨" : ""}`}
                className={`flex-1 min-h-[44px] inline-flex items-center justify-center gap-1.5 text-[13px] font-semibold rounded-md transition-colors
                  ${isActive ? "bg-slate-100" : "bg-transparent hover:bg-slate-50"}
                `}
              >
                <span className={isZero ? "text-slate-400" : "text-slate-500"}>{short}</span>
                <span className={`tabular-nums ${isZero ? "text-slate-400" : activeText}`}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* ═══ KPI 카드 4개 — conversionStatus 기반 (§11.277a/§11.273b 데스크탑 md+ 만 표시) ═══ */}
        <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <KpiCard
            icon={<ListChecks className="h-5 w-5 text-blue-500" />}
            iconBg="bg-blue-50"
            label="발주 인계 대기"
            value={stats.review_required}
            valueColor={stats.review_required > 0 ? "text-blue-600" : "text-slate-900"}
            sub="응답 수집 중"
            active={queueTab === "review_required"}
            onClick={() => setQueueTab(queueTab === "review_required" ? "all" : "review_required")}
          />
          <KpiCard
            icon={<CircleCheck className="h-5 w-5 text-emerald-500" />}
            iconBg="bg-emerald-50"
            label="발주 승인 대기"
            value={stats.ready_for_po}
            valueColor={stats.ready_for_po > 0 ? "text-emerald-600" : "text-slate-900"}
            sub="비교 완료 · 발주 대기"
            active={queueTab === "ready_for_po"}
            onClick={() => setQueueTab(queueTab === "ready_for_po" ? "all" : "ready_for_po")}
          />
          <KpiCard
            icon={<AlertCircle className="h-5 w-5 text-purple-500" />}
            iconBg="bg-purple-50"
            label="발주 확정"
            value={stats.confirmed}
            valueColor={stats.confirmed > 0 ? "text-purple-600" : "text-slate-900"}
            sub="발주 확정 완료"
            active={queueTab === "confirmed"}
            onClick={() => setQueueTab(queueTab === "confirmed" ? "all" : "confirmed")}
          />
          <KpiCard
            icon={<Clock className="h-5 w-5 text-rose-500" />}
            iconBg="bg-rose-50"
            label="공급사 통보 완료"
            value={stats.expired}
            valueColor={stats.expired > 0 ? "text-rose-600" : "text-slate-900"}
            sub="응답 기한 초과"
            active={false}
            onClick={() => setQueueTab("review_required")}
          />
        </div>

        {/* ═══ 탭 + 검색 ═══
            §11.260b — 호영님 §11.259c 패턴 reuse. 모바일에서도 가로 1줄 압축
            (sm:flex-row → flex-row 강제). 탭 영역 flex-1 min-w-0 (좌측 차지 +
            가로 스크롤). 검색 input 모바일 w-[140px] 고정, sm+ flex-1 + max-w-xs. */}
        {/* §11.334 — 온보딩(데이터 0건·검색 X) 시 탭/검색 숨김(시안 Improved 정합). */}
        {!(items.length === 0 && !searchQuery.trim()) && (
        <div className="flex flex-row items-center gap-2">
          <div className="flex items-center gap-1 overflow-x-auto flex-1 min-w-0" style={{ scrollbarWidth: "none" }}>
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
          <div className="relative w-[140px] sm:w-auto sm:flex-1 sm:max-w-xs sm:ml-auto shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder="제목, 견적번호 검색..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 text-sm bg-white border-slate-200" />
          </div>
        </div>
        )}

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

            {/* §11.334 — 빈상태 분기. (a) 검색 무결과 / (c) 탭 무결과 = 얇은
                안내 유지. (b) 데이터 0건(items.length===0 && 검색 X) = 시안
                Improved 온보딩(히어로+파이프라인+할일+미리보기)로 전환. 파이프라인
                상태는 stats(canonical)에서 파생 — 거짓 "완료" 표기 0.
                ⚠️ 옛 텍스트 empty 카피("발주 인계 대기…"/"견적 비교가 완료되면…")
                제거는 의도된 §11.334 디자인 — desync reversion 아님. */}
            {!isLoading && !isError && filteredItems.length === 0 && (
              searchQuery.trim() ? (
                <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                    <Package className="h-6 w-6 text-slate-400" />
                  </div>
                  <p className="text-sm text-slate-500 mb-1">{`'${searchQuery.trim()}'에 해당하는 항목이 없습니다`}</p>
                  <p className="text-xs text-slate-400">다른 키워드로 검색해 보세요.</p>
                </div>
              ) : items.length === 0 ? (
                <PurchasesOnboarding
                  hasSentRequest={stats.total > 0}
                  onScanOpen={() => setScanOpen(true)}
                />
              ) : (
                <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                    <Package className="h-6 w-6 text-slate-400" />
                  </div>
                  <p className="text-sm text-slate-500 mb-1">선택한 탭에 항목이 없습니다</p>
                  <p className="text-xs text-slate-400">다른 탭을 확인해 보세요.</p>
                </div>
              )
            )}

            {!isLoading && !isError && filteredItems.map((item) => {
              const cs = STATUS_MAP[item.conversionStatus];
              const ai = DECISION_SUPPORT_STATUS_LABEL[item.aiRecommendationStatus];
              const isSelected = selectedId === item.id;
              const hasBlocker = item.blockerType !== "none";
              // §11.277c — 모바일 카드 2단계 접힘/펼침 (default collapsed).
              const isExpanded = expandedCardIds.has(item.id);

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
                        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-yellow-50 text-yellow-700 border border-yellow-200">
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

                    {/* 본문: 제목 + 회신·AI 정보 + 가격
                        §11.284c — 호영님 P0 spec: 견적 단계 본문 텍스트 (안녕하세요…)
                        제거 + 금액 (견적가) + 공급사명 1줄 표시. itemSummary 데이터
                        source 보존 (resolver / engine 변경 0), UI 표시 만 제거. */}
                    <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-slate-900 text-sm leading-snug mb-0.5">{item.requestTitle}</h3>
                        {/* §11.284c 금액 + 공급사명 1줄 표시 (itemSummary 본문 텍스트 대체) */}
                        {(() => {
                          const selectedOption = item.selectedOptionId
                            ? item.aiOptions.find((o) => o.id === item.selectedOptionId)
                            : null;
                          const primaryOption = item.aiOptions.find((o) => o.recommendationLevel === "primary");
                          const supplier = selectedOption?.supplierName || primaryOption?.supplierName || item.aiOptions[0]?.supplierName || null;
                          const amount = item.totalBudget;
                          const amountText = amount !== null
                            ? new Intl.NumberFormat("ko-KR", { style: "currency", currency: item.currency || "KRW", maximumFractionDigits: 0 }).format(amount)
                            : null;
                          if (!amountText && !supplier) return null;
                          return (
                            <p
                              data-testid="purchases-card-amount-supplier"
                              className="text-xs text-slate-600 mb-3 flex items-center gap-2 flex-wrap"
                            >
                              {amountText && <span className="font-semibold text-slate-900 tabular-nums">{amountText}</span>}
                              {amountText && supplier && <span className="text-slate-300">·</span>}
                              {supplier && <span className="text-slate-600">{supplier}</span>}
                            </p>
                          );
                        })()}

                        {/* 막힘 / 다음 단계 */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <div className={`rounded-xl px-3.5 py-3 border ${
                            hasBlocker ? "bg-yellow-50/70 border-yellow-200" : "bg-emerald-50/50 border-emerald-200"
                          }`}>
                            <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${
                              hasBlocker ? "text-yellow-500" : "text-emerald-500"
                            }`}>막힘 확인</p>
                            <p className={`text-xs leading-snug flex items-start gap-2 font-medium ${
                              hasBlocker ? "text-yellow-700" : "text-emerald-700"
                            }`}>
                              {hasBlocker
                                ? <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-yellow-500" />
                                : <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-emerald-500" />
                              }
                              {item.blockerReason}
                            </p>
                          </div>
                          {/* §11.277b — 카드 "다음 단계" 블록 직접 onClick (호영님 P0 Option A).
                              card click handler 와 분리 (e.stopPropagation), setSelectedId(item.id)
                              + hash="#brief-next" 으로 rail panel 열림 + 발주 전환 chip 자동 anchor scroll.
                              '✦ 운영 브리핑' button 은 기존 동작 (상태 요약 chip) 보존. */}
                          <div
                            data-testid="purchases-card-next-step-cta"
                            role="button"
                            tabIndex={0}
                            aria-label={`다음 단계로 이동: ${item.nextStage}`}
                            className="rounded-xl bg-blue-50/60 border border-blue-200 px-3.5 py-3 cursor-pointer hover:bg-blue-100/60 hover:border-blue-300 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedId(item.id);
                              if (typeof window !== "undefined") {
                                window.requestAnimationFrame(() => {
                                  window.requestAnimationFrame(() => {
                                    const target = document.getElementById("brief-next");
                                    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
                                  });
                                });
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                e.stopPropagation();
                                setSelectedId(item.id);
                                if (typeof window !== "undefined") {
                                  window.requestAnimationFrame(() => {
                                    window.requestAnimationFrame(() => {
                                      const target = document.getElementById("brief-next");
                                      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
                                    });
                                  });
                                }
                              }
                            }}
                          >
                            <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider mb-1">다음 단계</p>
                            <p className="text-xs text-blue-700 leading-snug flex items-start gap-2 font-medium">
                              <ArrowRight className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-blue-500" />
                              {item.nextStage}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* 우측: 결정 보조 정보 + 가격 + 견적 상세 link (§11.277c — 모바일 collapse 분기) */}
                      <div className={`${isExpanded ? "flex" : "hidden"} sm:flex flex-col items-end gap-2 flex-shrink-0 w-full sm:w-auto sm:min-w-[160px]`}
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
                        {/* §11.331-a — 견적 상세: 페이지 점프 대신 same-canvas Rail 열기.
                            구매 운영 컨텍스트 유지(이탈 X). Rail 안에서 deep-dive 가능. */}
                        <Button size="sm" variant="outline"
                          data-testid="purchases-quote-detail-rail"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedId(item.id);
                          }}
                          className="w-full h-9 text-xs font-semibold border-slate-200 text-slate-700">
                          견적 상세 <ArrowRight className="h-3.5 w-3.5 ml-1" />
                        </Button>
                        <span className="text-[10px] text-slate-400">다음: {NEXT_ACTION_LABEL[item.nextAction]}</span>
                      </div>
                    </div>

                    {/* §11.277c — 모바일 카드 toggle (sm:hidden, default collapsed) */}
                    <button
                      type="button"
                      data-testid="purchases-card-mobile-toggle"
                      aria-label={isExpanded ? "카드 접기" : "카드 더 보기"}
                      aria-expanded={isExpanded}
                      className="sm:hidden w-full mt-3 flex items-center justify-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-700 py-1.5 border-t border-slate-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleCardExpand(item.id);
                      }}
                    >
                      {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      {isExpanded ? "접기" : "더 보기"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Rail 패널 ── */}
          {selectedItem && (() => {
            const cs = STATUS_MAP[selectedItem.conversionStatus];
            const ai = DECISION_SUPPORT_STATUS_LABEL[selectedItem.aiRecommendationStatus];
            const hasBlocker = selectedItem.blockerType !== "none";

            return (
              <div className="hidden md:flex flex-col w-[480px] flex-shrink-0 rounded-xl border border-slate-200 bg-white overflow-hidden max-h-[calc(100vh-160px)] shadow-sm">

                {/* §11.142-impl Rail header — 운영 브리핑 (§11.179 eyebrow 통일) */}
                <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold text-blue-700 mb-1">
                      운영 브리핑
                    </div>
                    <div className="text-[11px] text-slate-500 mb-1.5">선택한 견적</div>
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
                  <button onClick={closeRail} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 shrink-0 transition-colors" aria-label="브리핑 닫기">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* §11.142-impl preset action chips — anchor scroll */}
                <div className="px-5 py-2.5 border-b border-slate-100 bg-white flex items-center gap-1.5 flex-wrap">
                  <a
                    href="#brief-summary"
                    className="text-[11px] px-2 py-1 rounded border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 transition-colors"
                  >
                    상태 요약
                  </a>
                  <a
                    href="#brief-facts"
                    className="text-[11px] px-2 py-1 rounded border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 transition-colors"
                  >
                    공급사 회신
                  </a>
                  <a
                    href="#brief-next"
                    className="text-[11px] px-2 py-1 rounded border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 transition-colors"
                  >
                    발주 인계
                  </a>
                  <a
                    href="#brief-risks"
                    className="text-[11px] px-2 py-1 rounded border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 transition-colors"
                  >
                    차단 사유
                  </a>
                </div>

                {/* Rail body */}
                <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "#cbd5e1 transparent" }}>

                  {/* §11.142-impl § 1. 상황 요약 — 1-line resolver-derived + §11.161 LLM narrative hook */}
                  <div id="brief-summary" className="px-5 py-4 border-b border-slate-100 bg-slate-50/30">
                    <div className="text-xs font-bold text-slate-700 mb-2">상황 요약</div>
                    <p className="text-[12px] text-slate-700 leading-relaxed break-keep">
                      {briefNarrative ??
                        (hasBlocker
                          ? `${cs.label} 상태이며, ${selectedItem.blockerReason}`
                          : selectedItem.totalSuppliers > 0 && selectedItem.supplierReplies < selectedItem.totalSuppliers
                            ? `${cs.label} 상태입니다. 공급사 ${selectedItem.totalSuppliers}곳 중 ${selectedItem.supplierReplies}곳이 회신했고, 차단된 작업은 없습니다.`
                            : `${cs.label} 상태이며, 차단된 작업이 없습니다. ${selectedItem.nextStage}`)}
                      {briefCached && <span className="ml-1 text-[10px] text-slate-400">· 캐시</span>}
                    </p>
                  </div>

                  {/* §11.187 § 2. 판단 근거 — 4-cell MetricCell grid (§11.180 패턴) */}
                  <div id="brief-facts" className="px-5 py-4 border-b border-slate-100">
                    <div className="text-xs font-bold text-slate-700 mb-2.5">판단 근거</div>
                    {(() => {
                      const replyTone: "ok" | "warn" | "danger" =
                        selectedItem.totalSuppliers === 0
                          ? "danger"
                          : selectedItem.supplierReplies === selectedItem.totalSuppliers
                            ? "ok"
                            : "warn";
                      const expiryTone: "ok" | "warn" | "danger" | "neutral" =
                        selectedItem.isExpired
                          ? "danger"
                          : selectedItem.validUntil
                            ? "ok"
                            : "neutral";
                      const replyValue =
                        selectedItem.totalSuppliers === 0
                          ? "—"
                          : `${selectedItem.supplierReplies}/${selectedItem.totalSuppliers}`;
                      const expiryValue = selectedItem.isExpired
                        ? "만료됨"
                        : selectedItem.validUntil
                          ? new Date(selectedItem.validUntil).toLocaleDateString("ko-KR")
                          : "—";
                      return (
                        <div className="grid grid-cols-2 gap-2.5">
                          <MetricCell label="상태" value={cs.label} tone="neutral" />
                          <MetricCell label="공급사 회신" value={replyValue} tone={replyTone} />
                          <MetricCell
                            label="총액"
                            value={formatPrice(selectedItem.totalBudget, selectedItem.currency)}
                            tone="neutral"
                          />
                          <MetricCell label="유효기간" value={expiryValue} tone={expiryTone} />
                        </div>
                      );
                    })()}
                    {/* 보조 metadata — 작성 후 일수 (정보 보존) */}
                    <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between text-[11px]">
                      <span className="text-slate-500">작성 후</span>
                      <span className="text-slate-700">{selectedItem.createdDaysAgo}일</span>
                    </div>
                  </div>

                  {/* §11.142-impl § 3. 리스크 — blocker / expired / missing-info */}
                  <div id="brief-risks" className="px-5 py-4 border-b border-slate-100">
                    <div className="text-xs font-bold text-slate-700 mb-2.5">리스크</div>
                    <div className={`rounded-xl px-4 py-3 ${
                      hasBlocker ? "bg-yellow-50/70 border border-yellow-200" : "bg-emerald-50/70 border border-emerald-200"
                    }`}>
                      <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${
                        hasBlocker ? "text-yellow-700" : "text-emerald-700"
                      }`}>
                        {hasBlocker ? "현재 막힘" : "차단 없음"}
                      </p>
                      <p className={`text-xs font-medium leading-snug ${
                        hasBlocker ? "text-yellow-700" : "text-emerald-700"
                      }`}>
                        {selectedItem.blockerReason}
                      </p>
                    </div>
                    {selectedItem.isExpired && (
                      <div className="rounded-xl px-4 py-3 bg-rose-50/60 border border-rose-200 mt-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider mb-1 text-rose-700">유효기간 만료</p>
                        <p className="text-xs text-rose-700 font-medium leading-snug">
                          견적 유효기간이 지났습니다. 갱신 또는 재요청이 필요합니다.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* §11.142-impl § 4. 다음 조치 — nextStage + primary CTA */}
                  <div id="brief-next" className="px-5 py-4 border-b border-slate-100">
                    <div className="text-xs font-bold text-slate-700 mb-2.5">다음 조치</div>
                    <div className="rounded-xl px-4 py-3 bg-blue-50/60 border border-blue-200 mb-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider mb-1 text-blue-700">다음 단계</p>
                      <p className="text-xs text-blue-700 font-medium leading-snug">{selectedItem.nextStage}</p>
                    </div>
                    <div className="space-y-1.5 mb-3">
                      {/* §11.209d — 내부 결재 상태. canonical source =
                          PurchaseRequest.status (resolver derive). 4 값
                          (NOT_REQUIRED / PENDING / APPROVED / REJECTED)
                          분기 visible. */}
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">내부 결재</span>
                        <span className={
                          selectedItem.internalApprovalStatus === "APPROVED"
                            ? "text-emerald-700 font-medium"
                            : selectedItem.internalApprovalStatus === "PENDING"
                              ? "text-yellow-700 font-medium"
                              : selectedItem.internalApprovalStatus === "REJECTED"
                                ? "text-rose-700 font-medium"
                                : "text-slate-500"
                        }>
                          {selectedItem.internalApprovalStatus === "APPROVED" ? "결재 완료"
                            : selectedItem.internalApprovalStatus === "PENDING" ? "결재 대기"
                            : selectedItem.internalApprovalStatus === "REJECTED" ? "결재 반려"
                            : "결재 불필요"}
                        </span>
                      </div>
                      {/* §11.209d-history — 결재 timeline. internalApprovalStatus
                          !== "NOT_REQUIRED" 시만 visible (PENDING / APPROVED /
                          REJECTED). canonical source = latest non-CANCELLED PR. */}
                      {selectedItem.internalApprovalStatus !== "NOT_REQUIRED" &&
                        selectedItem.approvalRequestedAt && (
                          <div className="rounded-md border border-slate-200 bg-white p-2.5 mt-1 space-y-1.5">
                            <div className="flex justify-between text-[11px]">
                              <span className="text-slate-400">결재 요청 시각</span>
                              <span className="font-mono tabular-nums text-slate-700">
                                {new Date(selectedItem.approvalRequestedAt).toLocaleString("ko-KR", {
                                  year: "numeric",
                                  month: "2-digit",
                                  day: "2-digit",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                            {selectedItem.approverName && (
                              <div className="flex justify-between text-[11px]">
                                <span className="text-slate-400">결재자</span>
                                <span className="font-medium text-slate-700">
                                  {selectedItem.approverName}
                                </span>
                              </div>
                            )}
                            {/* §11.209d-contact — approver email/phone (있을 때만 visible).
                                email 은 mailto:, phone 은 tel: 링크. */}
                            {selectedItem.approverEmail && (
                              <div className="flex justify-between text-[11px]">
                                <span className="text-slate-400">이메일</span>
                                <a
                                  href={`mailto:${selectedItem.approverEmail}`}
                                  className="font-mono text-blue-600 hover:underline truncate ml-2"
                                >
                                  {selectedItem.approverEmail}
                                </a>
                              </div>
                            )}
                            {selectedItem.approverPhone && (
                              <div className="flex justify-between text-[11px]">
                                <span className="text-slate-400">연락처</span>
                                <a
                                  href={`tel:${selectedItem.approverPhone}`}
                                  className="font-mono text-blue-600 hover:underline"
                                >
                                  {selectedItem.approverPhone}
                                </a>
                              </div>
                            )}
                            {selectedItem.approvalDecidedAt && (
                              <div className="flex justify-between text-[11px]">
                                <span className="text-slate-400">
                                  {selectedItem.internalApprovalStatus === "APPROVED" ? "승인 시각" : "반려 시각"}
                                </span>
                                <span className="font-mono tabular-nums text-slate-700">
                                  {new Date(selectedItem.approvalDecidedAt).toLocaleString("ko-KR", {
                                    year: "numeric",
                                    month: "2-digit",
                                    day: "2-digit",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              </div>
                            )}
                            {selectedItem.rejectionReason && (
                              <div className="text-[11px] pt-1 border-t border-slate-100">
                                <span className="text-slate-400">반려 사유</span>
                                <p className="mt-0.5 text-rose-700 leading-snug break-words">
                                  {selectedItem.rejectionReason}
                                </p>
                              </div>
                            )}
                            {/* §11.209d-history-expand — 이전 결재 이력 expand.
                                approvalHistoryEntries 가 2 개 이상 (latest 제외 추가
                                entries 존재) 시만 button visible. dead button 0. */}
                            {selectedItem.approvalHistoryEntries.length > 1 && (
                              <div className="pt-1.5 border-t border-slate-100">
                                <button
                                  type="button"
                                  className="text-[11px] text-slate-500 hover:text-slate-700 flex items-center gap-1"
                                  onClick={() => setHistoryExpanded((v) => !v)}
                                >
                                  {historyExpanded ? "이전 결재 이력 숨기기" : `이전 결재 이력 ${selectedItem.approvalHistoryEntries.length - 1}건 보기`}
                                </button>
                                {historyExpanded && (
                                  <ul className="mt-2 space-y-2">
                                    {selectedItem.approvalHistoryEntries.slice(1).map((entry) => (
                                      <li
                                        key={entry.id}
                                        className="text-[10px] bg-slate-50 rounded p-2 border border-slate-100"
                                      >
                                        <div className="flex items-center justify-between mb-0.5">
                                          <span
                                            className={
                                              entry.status === "APPROVED"
                                                ? "font-semibold text-emerald-700"
                                                : entry.status === "REJECTED"
                                                  ? "font-semibold text-rose-700"
                                                  : entry.status === "CANCELLED"
                                                    ? "font-semibold text-slate-500"
                                                    : "font-semibold text-yellow-700"
                                            }
                                          >
                                            {entry.status === "APPROVED"
                                              ? "결재 완료"
                                              : entry.status === "REJECTED"
                                                ? "결재 반려"
                                                : entry.status === "CANCELLED"
                                                  ? "취소"
                                                  : "결재 대기"}
                                          </span>
                                          <span className="font-mono tabular-nums text-slate-500">
                                            {new Date(entry.requestedAt).toLocaleString("ko-KR", {
                                              year: "numeric",
                                              month: "2-digit",
                                              day: "2-digit",
                                              hour: "2-digit",
                                              minute: "2-digit",
                                            })}
                                          </span>
                                        </div>
                                        {entry.approverName && (
                                          <div className="text-slate-600">결재자: {entry.approverName}</div>
                                        )}
                                        {entry.rejectionReason && (
                                          <div className="text-rose-700 mt-0.5 break-words">
                                            반려 사유: {entry.rejectionReason}
                                          </div>
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">외부 승인</span>
                        <span className={selectedItem.externalApprovalStatus === "approved"
                          ? "text-emerald-700 font-medium"
                          : selectedItem.externalApprovalStatus === "pending"
                            ? "text-yellow-700"
                            : "text-slate-500"}>
                          {selectedItem.externalApprovalStatus === "approved" ? "승인 완료"
                            : selectedItem.externalApprovalStatus === "pending" ? "대기 중"
                            : "미확인"}
                        </span>
                      </div>
                    </div>
                    {/* Primary CTA — 견적 관리 handoff */}
                    <Link
                      href={`/dashboard/quotes?focus=${encodeURIComponent(selectedItem.id)}`}
                      className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors"
                    >
                      견적 관리에서 계속
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>

                  {/* 3옵션 결정 보조안 */}
                  {selectedItem.aiOptions.length > 0 && (
                    <div className="px-5 py-4 border-b border-slate-100">
                      <div className="flex items-center gap-1.5 mb-3">
                        <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                        <span className="text-xs font-bold text-slate-700">3옵션 결정 보조안</span>
                        <span className={`text-[10px] ml-auto ${ai.className}`}>{ai.label}</span>
                      </div>
                      <div className="space-y-2">
                        {selectedItem.aiOptions.map((opt) => {
                          const isPrimary = opt.recommendationLevel === "primary";
                          // α-D (ADR §11.21): selectedOptionId comes from
                          // Quote.selectedReplyId via the resolver. Click
                          // toggles select / un-select.
                          const isSelected = selectedItem.selectedOptionId === opt.id;
                          const onPick = () => {
                            if (selectReplyMutation.isPending) return;
                            selectReplyMutation.mutate({
                              quoteId: selectedItem.id,
                              replyId: isSelected ? null : opt.id,
                            });
                          };
                          return (
                            <button
                              type="button"
                              key={opt.id}
                              onClick={onPick}
                              disabled={selectReplyMutation.isPending}
                              aria-pressed={isSelected}
                              className={`w-full text-left rounded-lg border p-3 transition-colors ${
                                isSelected
                                  ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                                  : isPrimary
                                  ? "border-emerald-200 bg-emerald-50/50 hover:border-emerald-300"
                                  : "border-slate-100 bg-slate-50/50 hover:border-slate-200"
                              } disabled:opacity-60`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-1.5">
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                    isSelected
                                      ? "bg-blue-100 text-blue-600"
                                      : isPrimary
                                      ? "bg-emerald-100 text-emerald-600"
                                      : "bg-slate-100 text-slate-500"
                                  }`}>
                                    {RECOMMENDATION_LEVEL_LABEL[opt.recommendationLevel]}
                                  </span>
                                  <span className="text-xs font-medium text-slate-700">{opt.supplierName}</span>
                                  {isSelected && (
                                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-blue-600">
                                      <Check className="h-3 w-3" />선택됨
                                    </span>
                                  )}
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
                              {/* α-F (ADR §11.25): inline decision-support rationale generator.
                                  Tiny button below rationale line. Click does NOT
                                  toggle selection (stopPropagation) — it only
                                  persists / refreshes the LLM rationale via
                                  /api/ai-actions/generate/quote-rationale. */}
                              <button
                                type="button"
                                disabled={rationaleMutation.isPending}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (rationaleMutation.isPending) return;
                                  rationaleMutation.mutate({
                                    quoteId: selectedItem.id,
                                    optionId: opt.id,
                                    supplierName: opt.supplierName,
                                    replied: opt.recommendationLevel !== "conservative",
                                    price: opt.price,
                                    leadDays: opt.leadDays,
                                    moq: opt.moq,
                                    currency: selectedItem.currency,
                                    quoteTitle: selectedItem.requestTitle,
                                    totalSuppliers: selectedItem.totalSuppliers,
                                  });
                                }}
                                className="mt-1 inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-blue-600 disabled:opacity-50"
                              >
                                <Sparkles className="h-3 w-3" />검토 근거
                              </button>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Rail CTA — §11.61 #purchases-rail-inline-action-wiring
                    헤더 카피 ("검토, 회신 확인, 발주 전환까지 한 화면에서 처리")
                    가 surface 와 일치하도록 same-canvas inline action 추가.
                    - ready_for_po stage 에서만 primary "발주 전환" 노출.
                      bulkPoMutation 재사용 (§11.22 utility, single-item array).
                      mutation 이미 toast + queryInvalidate 가짐 — 응답 후
                      stage 가 confirmed 로 자동 전이 → 본 button 자동 사라짐.
                    - 비-ready_for_po stage (review_required/hold/confirmed/expired)
                      는 view-only — "견적 상세 페이지 열기" 만 노출 (deep dive).
                    - "견적 상세 페이지 열기" 는 ready_for_po 에서는 secondary
                      (outline) 로, 그 외 stage 는 primary 로. */}
                <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50/50 space-y-2">
                  {/* §11.209d-pr-auto-create — "결재 요청" CTA. R&D Operations
                      / Enterprise workspace (approvalPolicy === "in_app_approval")
                      + internalApprovalStatus === "NOT_REQUIRED" 시 visible.
                      자기 자신이 ADMIN 이면 직접 결재 가능 (canApprove) — 결재
                      요청 button 대신 approve/reject CTA visible. dead button 0. */}
                  {approvalPolicy === "in_app_approval" &&
                    selectedItem.internalApprovalStatus === "NOT_REQUIRED" &&
                    !canApprove && (
                      <Button
                        size="sm"
                        className="w-full h-9 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm disabled:opacity-50"
                        disabled={requestApprovalMutation.isPending}
                        onClick={() => {
                          if (requestApprovalMutation.isPending) return;
                          requestApprovalMutation.mutate(selectedItem.id);
                        }}
                      >
                        {requestApprovalMutation.isPending ? (
                          "요청 중..."
                        ) : (
                          <>
                            <FileText className="h-3.5 w-3.5 mr-1.5" />
                            결재 요청
                          </>
                        )}
                      </Button>
                    )}
                  {/* §11.209d-mutation — approve/reject CTA. ADMIN/OWNER 만,
                      internalApprovalStatus === "PENDING" + latestPendingRequestId
                      존재 시. server enforceAction 이 진짜 lock — client check 는
                      visibility 만 (defense in depth). */}
                  {canApprove &&
                    selectedItem.internalApprovalStatus === "PENDING" &&
                    selectedItem.latestPendingRequestId && (
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          size="sm"
                          className="h-9 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm disabled:opacity-50"
                          disabled={approveRequestMutation.isPending}
                          onClick={() => {
                            if (!selectedItem.latestPendingRequestId) return;
                            approveRequestMutation.mutate(selectedItem.latestPendingRequestId);
                          }}
                        >
                          {approveRequestMutation.isPending ? (
                            "승인 중..."
                          ) : (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                              결재 승인
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          className="h-9 text-xs font-semibold bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 shadow-sm"
                          disabled={rejectRequestMutation.isPending}
                          onClick={() => {
                            if (!selectedItem.latestPendingRequestId) return;
                            setRejectingRequestId(selectedItem.latestPendingRequestId);
                            setRejectReason("");
                            setRejectDialogOpen(true);
                          }}
                        >
                          <X className="h-3.5 w-3.5 mr-1.5" />
                          결재 반려
                        </Button>
                      </div>
                    )}
                  {selectedItem.conversionStatus === "ready_for_po" && (
                    <>
                      {/* §11.209d — internalApprovalStatus === "PENDING" 시
                          발주 전환 차단. 결재 완료 후 자동 enabled. dead button
                          0 — 운영자 친화 메시지로 사용자 의도 명확. */}
                      <Button
                        size="sm"
                        className="w-full h-9 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={
                          bulkPoMutation.isPending ||
                          selectedItem.internalApprovalStatus === "PENDING" ||
                          selectedItem.internalApprovalStatus === "REJECTED"
                        }
                        onClick={() => {
                          if (bulkPoMutation.isPending) return;
                          if (selectedItem.internalApprovalStatus === "PENDING") return;
                          if (selectedItem.internalApprovalStatus === "REJECTED") return;
                          bulkPoMutation.mutate([selectedItem.id]);
                        }}
                      >
                        {bulkPoMutation.isPending ? (
                          "인계 중..."
                        ) : selectedItem.internalApprovalStatus === "PENDING" ? (
                          <>
                            <Clock className="h-3.5 w-3.5 mr-1.5" />
                            결재 대기 중
                          </>
                        ) : selectedItem.internalApprovalStatus === "REJECTED" ? (
                          <>
                            <X className="h-3.5 w-3.5 mr-1.5" />
                            결재 반려됨
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                            발주 인계
                          </>
                        )}
                      </Button>
                      {selectedItem.internalApprovalStatus === "PENDING" && (
                        <p className="text-[11px] text-yellow-700 text-center">결재 완료 후 인계 가능</p>
                      )}
                      {selectedItem.internalApprovalStatus === "REJECTED" && (
                        <p className="text-[11px] text-rose-700 text-center">결재 반려 — 재요청 또는 대안 검토</p>
                      )}
                    </>
                  )}
                  {/* §11.352 — 인계 완료(confirmed) 시 dead-end 해소: 견적 회귀 대신
                      발주 관리로 전진. 외부 발주·입고 상태는 발주 관리에서 추적
                      (DECISION_11.35x 요청자 중심 — LabAxis = 의뢰·추적, 실행은 외부). */}
                  {selectedItem.conversionStatus === "confirmed" && (
                    <Link href="/dashboard/purchase-orders" className="block">
                      <Button
                        size="sm"
                        className="w-full h-9 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                      >
                        <ArrowRight className="h-3.5 w-3.5 mr-1.5" />
                        발주 관리에서 외부 발주·입고 추적
                      </Button>
                    </Link>
                  )}
                  <Link href={`/dashboard/quotes/${selectedItem.id}`} className="block">
                    <Button
                      size="sm"
                      className={
                        selectedItem.conversionStatus === "ready_for_po"
                          ? "w-full h-9 text-xs font-semibold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-sm"
                          : "w-full h-9 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                      }
                    >
                      전체 견적 페이지 열기 <ArrowRight className="h-3 w-3 ml-1.5" />
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

        {/* §11.155 모바일 변종 — desktop rail (hidden md:flex) 와 mutually exclusive */}
        {selectedItem && (
          <MobileOperationalBriefSheet
            open={!!selectedItem}
            onClose={closeRail}
            objectLabel="선택한 견적"
            chips={[
              { id: "summary", label: "상태 요약" },
              { id: "facts",   label: "공급사 회신" },
              { id: "risks",   label: "차단 사유" },
              { id: "next",    label: "발주 인계" },
            ]}
            summary={
              <p className="text-xs text-slate-700 leading-relaxed">
                {STATUS_MAP[selectedItem.conversionStatus]?.label} · {selectedItem.requestTitle}
                {selectedItem.blockerType !== "none" && ` — ${selectedItem.blockerReason}`}
              </p>
            }
            facts={
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-slate-400">상태</span><span className="font-medium">{STATUS_MAP[selectedItem.conversionStatus]?.label}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">공급사 회신</span><span>{selectedItem.supplierReplies}/{selectedItem.totalSuppliers}건</span></div>
                {selectedItem.quoteNumber && <div className="flex justify-between"><span className="text-slate-400">견적번호</span><span className="font-mono text-[11px]">{selectedItem.quoteNumber}</span></div>}
              </div>
            }
            risks={
              selectedItem.blockerType !== "none"
                ? <p className="text-xs text-yellow-700">{selectedItem.blockerReason}</p>
                : selectedItem.isExpired
                  ? <p className="text-xs text-rose-700">유효기간 만료</p>
                  : <p className="text-xs text-slate-500">차단 없음</p>
            }
            next={
              <p className="text-xs text-slate-700">{selectedItem.nextStage}</p>
            }
            primaryCta={{
              label: "견적 관리에서 계속",
              onClick: () => {
                if (typeof window !== "undefined") {
                  window.location.href = `/dashboard/quotes?focus=${encodeURIComponent(selectedItem.id)}`;
                }
              },
            }}
          />
        )}

      </div>

      {/* §11.181 — 운영 브리핑 floating entry (default = popup open).
          §11.258-sweep — §11.257 후속: 모바일 (<lg) BarcodeScanFab 겹침 해소,
          데스크탑 한정 노출. 모바일 inline 진입은 §11.258-sweep-2 백로그. */}
      <div className="hidden lg:block">
        <OperationalBriefFloatingEntry controls="operational-brief-popup" />
      </div>
      {/* §11.258-sweep-2 — 모바일 좌측 하단 ✨ 운영 브리핑 진입 (방안 1). */}
      <MobileBriefInlineButton />

      {/* §11.209d-mutation — reject Dialog (reason input). admin/requests
          page 의 패턴 흡수. server enforceAction 이 진짜 lock. */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>결재 반려</DialogTitle>
            <DialogDescription>
              반려 사유를 입력하세요. 요청자에게 전달되어 재요청 또는 대안 검토에 사용됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="예: 예산 초과 — 다음 분기 재요청 권장"
              className="min-h-[100px] text-sm"
              maxLength={500}
            />
            <p className="text-[10px] text-slate-400 mt-1 text-right">
              {rejectReason.length} / 500
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRejectDialogOpen(false)}
              disabled={rejectRequestMutation.isPending}
            >
              취소
            </Button>
            <Button
              size="sm"
              className="bg-rose-600 hover:bg-rose-700 text-white"
              disabled={
                !rejectReason.trim() ||
                rejectReason.trim().length < 5 ||
                !rejectingRequestId ||
                rejectRequestMutation.isPending
              }
              onClick={() => {
                if (!rejectingRequestId) return;
                rejectRequestMutation.mutate({
                  requestId: rejectingRequestId,
                  reason: rejectReason.trim(),
                });
              }}
            >
              {rejectRequestMutation.isPending ? "처리 중..." : "반려 처리"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* §11.334 — 견적서 스캔 모달 (빈상태 온보딩 CTA wiring). 스캔 완료 시
          큐 invalidate → 새 후보가 목록에 반영. dead button 0. */}
      <QuoteScannerModal
        open={scanOpen}
        onOpenChange={setScanOpen}
        onScanComplete={() => {
          queryClient.invalidateQueries({ queryKey: ["purchase-conversion-queue"] });
          toast({
            title: "견적서 스캔 완료",
            description: "스캔한 견적을 견적 관리에서 확인하세요.",
          });
        }}
      />
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
  // §11.260a → §bg-unify-kpi-zero — 0건 카드 시각 우선순위 낮춤.
  //   진화: 카드 전체 opacity-50(흰 캔버스 위 탁한 회색 박스 원인) 폐지 → 숫자 색만 톤다운(text-slate-300).
  //   카드는 선명한 흰색 + border 유지(구획 보존), 값 생기면 valueColor 컬러 강조. active/hover 또렷.
  const isZero = value === 0 && !active;
  return (
    <button type="button" onClick={onClick}
      className={`rounded-xl border bg-white p-5 text-left transition-all hover:shadow-md ${
        active ? "border-blue-300 ring-1 ring-blue-100 shadow-md" : "border-slate-200 hover:border-slate-300"
      }`}>
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center`}>{icon}</div>
        <span className="text-xs text-slate-400">{label}</span>
      </div>
      <p className={`text-3xl font-extrabold ${isZero ? "text-slate-300" : valueColor}`}>
        {value}<span className="text-base font-normal text-slate-400 ml-0.5">건</span>
      </p>
      <p className="text-xs text-slate-500 mt-1">{sub}</p>
    </button>
  );
}

/* ── §11.334 빈상태 온보딩 (시안 Improved) ──
   데이터 0건일 때 얇은 empty 대신 "다음 행동 안내" 히어로 + 진행 파이프라인
   + 할 일 카드 + 미리보기. 파이프라인 상태는 canonical(stats.total 파생
   hasSentRequest)에서만 도출 — 거짓 "완료" 표기 0. 모든 CTA 는 실제 라우트
   또는 실제 모달 wiring (dead button 0). */
function PurchasesOnboarding({ hasSentRequest, onScanOpen }: {
  hasSentRequest: boolean;
  onScanOpen: () => void;
}) {
  type StepState = "done" | "active" | "todo";
  // 거짓 done 금지: 견적 요청 전이면 done 0. 보낸 뒤에도 "회신 수집"은
  //   active(수집 중)까지만 — 실제 회신 도착 확증 없이 done 표기 안 함.
  const steps: { n: string; label: string; sub: string; icon: React.ReactNode; s: StepState }[] = [
    { n: "01", label: "소싱 검색",       sub: "품목 찾기",   icon: <Search className="h-4 w-4" />,       s: hasSentRequest ? "done" : "active" },
    { n: "02", label: "견적 요청",       sub: "공급사 발송", icon: <Send className="h-4 w-4" />,         s: hasSentRequest ? "done" : "todo" },
    { n: "03", label: "회신 수집",       sub: "견적 도착",   icon: <FileText className="h-4 w-4" />,     s: hasSentRequest ? "active" : "todo" },
    { n: "04", label: "비교 · 발주 전환", sub: "여기서 처리", icon: <Columns3 className="h-4 w-4" />,     s: "todo" },
    { n: "05", label: "발주 인계",       sub: "발주 관리로", icon: <ShoppingCart className="h-4 w-4" />, s: "todo" },
  ];

  return (
    <div className="space-y-4" data-testid="purchases-onboarding">
      {/* 온보딩 히어로 — 네이비 */}
      <div className="rounded-2xl bg-slate-900 px-5 py-6 md:px-7 md:py-7 text-white">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue-300 mb-2">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-blue-400" />
          </span>
          다음 단계 안내
        </span>
        <h2 className="text-lg md:text-xl font-extrabold tracking-tight mb-2">
          {hasSentRequest
            ? "견적 요청을 보냈어요 — 회신이 도착하면 여기에 모입니다"
            : "아직 비교할 견적이 없어요 — 견적 회신부터 모아볼까요?"}
        </h2>
        <p className="text-sm text-slate-300 leading-relaxed max-w-2xl mb-4">
          {hasSentRequest ? (
            <>회신이 도착하면 자동으로 <b className="text-white">비교 후보</b>로 쌓입니다. 진행 상황은 견적 관리에서 추적할 수 있어요.</>
          ) : (
            <>구매 운영은 <b className="text-white">회신 받은 견적을 비교해 발주로 전환</b>하는 단계입니다. 회신이 도착하면 자동으로 여기에 쌓입니다. 지금은 소싱에서 견적 요청을 보내는 것이 가장 빠른 시작입니다.</>
          )}
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <Link href="/app/search" className="w-full sm:w-auto">
            <Button className="h-11 px-5 w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-semibold gap-2">
              <Search className="h-4 w-4" /> 소싱에서 견적 요청
            </Button>
          </Link>
          <Link href="/dashboard/quotes" className="w-full sm:w-auto">
            <Button variant="outline" className="h-11 px-5 w-full sm:w-auto bg-transparent border-slate-600 text-slate-200 hover:bg-slate-800 hover:text-white font-semibold">
              견적 관리 보기
            </Button>
          </Link>
        </div>
      </div>

      {/* 진행 파이프라인 — 지금 어디인지 (canonical 파생) */}
      <div data-testid="purchases-onboarding-pipeline" className="rounded-xl border border-slate-200 bg-white px-4 py-4 md:px-5">
        <div className="flex items-start gap-0 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {steps.map((st, i) => (
            <div key={st.n} className="relative flex min-w-[84px] flex-1 flex-col items-center gap-1.5 text-center">
              {i > 0 && (
                <span aria-hidden className={`absolute right-1/2 top-[15px] z-0 h-0.5 w-full ${st.s === "todo" ? "bg-slate-200" : "bg-emerald-500"}`} />
              )}
              <span className={`relative z-[1] grid h-8 w-8 shrink-0 place-items-center rounded-full border ${
                st.s === "done"
                  ? "border-emerald-500 bg-emerald-500 text-white"
                  : st.s === "active"
                    ? "border-blue-600 bg-blue-600 text-white ring-4 ring-blue-100"
                    : "border-slate-200 bg-white text-slate-400"
              }`}>
                {st.s === "done" ? <Check className="h-4 w-4" /> : st.icon}
              </span>
              {st.s === "active" && (
                <span className="text-[9px] font-bold uppercase tracking-wide text-blue-600">현재 단계</span>
              )}
              <span className={`text-[11px] font-bold leading-tight ${
                st.s === "active" ? "text-blue-700" : st.s === "done" ? "text-slate-700" : "text-slate-400"
              }`}>{st.label}</span>
              <span className="hidden sm:block text-[10px] leading-tight text-slate-400">{st.sub}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 지금 할 수 있는 일 + 미리보기 */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center gap-2 px-4 md:px-5 py-3 border-b border-slate-100">
          <Sparkles className="h-4 w-4 text-blue-500" />
          <h2 className="text-sm font-bold text-slate-900">지금 할 수 있는 일</h2>
        </div>
        <div className="p-4 md:p-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold mb-2">1</span>
              <h4 className="text-sm font-bold text-slate-900 mb-1">소싱에서 견적 요청</h4>
              <p className="text-xs text-slate-500 leading-relaxed mb-3">필요한 품목을 검색하고 공급사에 견적을 요청하면, 회신이 이 화면으로 들어옵니다.</p>
              <Link href="/app/search" className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700">
                소싱 열기 <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-600 text-xs font-bold mb-2">2</span>
              <h4 className="text-sm font-bold text-slate-900 mb-1">진행 중 견적 확인</h4>
              <p className="text-xs text-slate-500 leading-relaxed mb-3">이미 요청한 견적이 있다면 견적 관리에서 회신 상태를 추적할 수 있습니다.</p>
              <Link href="/dashboard/quotes" className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-slate-900">
                견적 관리 <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-600 text-xs font-bold mb-2">3</span>
              <h4 className="text-sm font-bold text-slate-900 mb-1">견적서 스캔으로 시작</h4>
              <p className="text-xs text-slate-500 leading-relaxed mb-3">이미 받은 견적서 PDF가 있다면 업로드해 바로 비교 후보로 등록할 수 있습니다.</p>
              <button
                type="button"
                data-testid="purchases-onboarding-scan-cta"
                onClick={onScanOpen}
                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-slate-900"
              >
                <ScanLine className="h-3 w-3" /> 견적서 스캔 <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          </div>

          {/* 미리보기(ghost) — 회신 도착 시 표시 예시. 실제 데이터 아님 명시. */}
          <div className="mt-4 flex items-center gap-1.5 text-[11px] text-slate-400">
            <Package className="h-3 w-3" /> 회신이 도착하면 이렇게 표시됩니다 (미리보기)
          </div>
          <div className="mt-2 space-y-2">
            {[0, 1].map((i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-3 py-3">
                <span className="h-7 w-7 rounded-full bg-slate-200" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-2.5 w-1/3 rounded bg-slate-200" />
                  <div className="h-2 w-1/4 rounded bg-slate-100" />
                </div>
                <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> 발주 승인 대기
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
