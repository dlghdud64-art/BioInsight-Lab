"use client";

import { csrfFetch } from "@/lib/api-client";
import { useState, useMemo, useCallback, useEffect } from "react";
import { NoSSR } from "@/components/ui/no-ssr";
import { useUserPreferences } from "@/lib/preferences/user-preferences";
// #post-approval-purchase-order-flow B+H step 3 — ActionableRow 의 PDF/email
// quick-action mutation. component-scoped useMutation (각 row 마다 독립).
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useWorkbenchOverlayOpen } from "@/hooks/use-workbench-overlay-open";
import { useOpsStore } from "@/lib/ops-console/ops-store";
import {
  buildModuleHeaderStats,
  buildModulePriorityQueue,
  buildModuleLandingItems,
  buildModuleBuckets,
  buildModuleDownstream,
  MODULE_ORIENTATION,
  MODULE_HEADER_STAT_META,
  BUCKET_COLORS,
  type ModuleBucketKey,
  type ModuleLandingItem,
} from "@/lib/ops-console/module-landing-adapter";
import { ChevronRight, ArrowRight, AlertCircle, Clock, Zap, Sparkles, Loader2, ShieldAlert, ShieldCheck, DollarSign, AlertTriangle, CheckCircle2, FlaskConical, Inbox, Filter, FileText, Mail } from "lucide-react";
import { buildDetailHref } from "@/lib/ops-console/navigation-context";
import { OperationalBriefFloatingEntry } from "@/components/operational-brief/floating-entry";
// §11.258-sweep-2 — 모바일 좌측 하단 ✨ 진입 (방안 1 위치 분리).
import { MobileBriefInlineButton } from "@/components/operational-brief/mobile-inline-button";
// #post-approval-purchase-order-flow I — 빈 상태 한국어 정합. raw text →
// reusable EmptyState (큰 icon + 한국어 title/description).
import { EmptyState } from "@/components/ui/empty-state";
// #post-approval-purchase-order-flow B+H step 3 — quick-action button.
// row 안 PDF/email 직접 trigger (detail page 진입 0). 호영님 스크린샷 정합.
import { useToast } from "@/hooks/use-toast";
// §11.374 P3.2 #mobile-surface-unify — 모바일 상태요약 가로 카운트 → StatusCountGrid 2x2.
import { StatusCountGrid } from "@/components/layout/status-count-grid";
import type { StatusCountItem, StatusCountTone } from "@/components/layout/status-count-grid";

// ── Bucket tab config (PO-specific labels) ────────────────────────
const PO_BUCKET_TABS: { key: ModuleBucketKey; label: string }[] = [
  { key: "ready", label: "발행 가능" },
  { key: "needs_review", label: "승인/검토" },
  { key: "waiting_external", label: "공급사 대기" },
  { key: "handoff", label: "입고 인계" },
];

// ── Priority badge color ──────────────────────────────────────────
const PRIORITY_DOT: Record<string, string> = {
  p0: "bg-red-500",
  p1: "bg-yellow-500",
  p2: "bg-blue-500",
  p3: "bg-slate-500",
};

// ── Stat key → filter mapping ─────────────────────────────────────
const STAT_FILTER_MAP: Record<string, string> = {
  openActionable: "all",
  blocked: "blocked",
  overdue: "overdue",
  waitingExternal: "waiting_external",
  readyToExecute: "ready",
};

// §11.374 P3.2 — 상태별 §11.302 신호등 톤(표현 통일). count 경로는 불변(headerStats).
const STAT_TONE_MAP: Record<string, StatusCountTone> = {
  openActionable: "neutral",
  blocked: "danger",
  overdue: "warning",
  waitingExternal: "info",
  readyToExecute: "success",
};

// ── Component ─────────────────────────────────────────────────────
function PurchaseOrderLandingPageInner() {
  const router = useRouter();
  const openOverlay = useWorkbenchOverlayOpen();
  const { unifiedInboxItems } = useOpsStore();
  const [activeTab, setActiveTab] = useState<ModuleBucketKey>("ready");

  // §11.230c (a)-6 #purchases-orders-filter-sync — server-first hydration.
  //   preferences.purchaseOrdersFilter.activeTab 도착 시 setActiveTab.
  const userPrefs = useUserPreferences();
  useEffect(() => {
    const serverTab = userPrefs.preferences?.purchaseOrdersFilter?.activeTab;
    if (!serverTab) return;
    setActiveTab(serverTab as ModuleBucketKey);
  }, [userPrefs.preferences]);

  // §11.230c (a)-6 — debounced server PATCH on activeTab change.
  useEffect(() => {
    userPrefs.updatePurchaseOrdersFilter({ activeTab });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Header stats
  const headerStats = useMemo(
    () => buildModuleHeaderStats(unifiedInboxItems, "po"),
    [unifiedInboxItems],
  );

  // §11.374 P3.2 — StatusCountGrid items. canonical count = headerStats[key]
  // (경로 불변). matching bucket 있으면 setActiveTab 토글(클릭 가능), 없으면
  // onClick 미연결 = 표시 전용(기존 display-only span 의미 보존, dead button 0).
  const poStatusItems: StatusCountItem[] = useMemo(
    () =>
      (
        Object.keys(MODULE_HEADER_STAT_META) as Array<
          keyof typeof MODULE_HEADER_STAT_META
        >
      ).map((key) => {
        const filterKey = STAT_FILTER_MAP[key] ?? key;
        const matchingTab = PO_BUCKET_TABS.find((t) => t.key === filterKey);
        return {
          key,
          label: MODULE_HEADER_STAT_META[key].label,
          count: headerStats[key],
          tone: STAT_TONE_MAP[key] ?? "neutral",
          active: matchingTab ? activeTab === matchingTab.key : false,
          onClick: matchingTab
            ? () => setActiveTab(matchingTab.key)
            : undefined,
        };
      }),
    [headerStats, activeTab],
  );

  // Priority queue (top 6)
  const priorityQueue = useMemo(
    () => buildModulePriorityQueue(unifiedInboxItems, "po", 6),
    [unifiedInboxItems],
  );

  // All landing items → buckets
  const allItems = useMemo(
    () => buildModuleLandingItems(unifiedInboxItems, "po"),
    [unifiedInboxItems],
  );

  const buckets = useMemo(() => buildModuleBuckets(allItems), [allItems]);

  // Downstream handoff
  const downstream = useMemo(
    () => buildModuleDownstream("po", unifiedInboxItems),
    [unifiedInboxItems],
  );

  // Active bucket items
  const activeBucketItems = buckets[activeTab] ?? [];

  // Bucket counts for tab badges
  const bucketCounts = useMemo(() => {
    const counts: Record<ModuleBucketKey, number> = {
      ready: 0,
      blocked: 0,
      needs_review: 0,
      waiting_external: 0,
      handoff: 0,
    };
    for (const item of allItems) {
      counts[item.bucketKey]++;
    }
    return counts;
  }, [allItems]);

  const orientation = MODULE_ORIENTATION.po;
  const isEmpty = allItems.length === 0;
  const onlyWaiting =
    allItems.length > 0 &&
    allItems.every((i) => i.bucketKey === "waiting_external");

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 space-y-5">
      {/* ── 1. Header ──────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-900">발주 관리</h1>
            {/* §11.209 — 실무 담당자 톤 정합. orientation.role 만으로는
                "관리" 의 실무 의미(발송 후 무엇을 추적) 불명확 → 작업
                흐름(공급사 확인·납기·입고) 을 직접 명시. Hybrid Tier
                별 외부 ERP/그룹웨어 hand-off 카피는 실 구현 land 시 별도
                batch 에서 분기 표기. */}
            <p className="text-xs text-slate-600 mt-0.5">발주서 발송 후 공급사 확인·납기·입고까지 추적하세요.</p>
          </div>
          <p className="text-xs text-slate-500 max-w-xs text-right">
            {headerStats.nextActionSummary}
          </p>
        </div>

        {/* §11.374 P3.2 — 모바일 상태요약: 가로 카운트 pill → StatusCountGrid 2x2.
            count = headerStats[key] 주입(경로 불변), 클릭 = setActiveTab 토글. */}
        <StatusCountGrid
          items={poStatusItems}
          ariaLabel="발주 상태별 요약"
          className="sm:hidden mt-3"
        />

        {/* Stat pills (데스크탑 sm+) — §11.191c self-filter (inbox redirect 제거,
            자체 페이지 bucket tab 으로 즉시 분기). matching bucket 있으면 button,
            없으면 display-only span (dead-link 0). 모바일은 위 StatusCountGrid. */}
        <div className="hidden sm:flex flex-wrap gap-2 mt-3">
          {(
            Object.keys(MODULE_HEADER_STAT_META) as Array<
              keyof typeof MODULE_HEADER_STAT_META
            >
          ).map((key) => {
            const value = headerStats[key];
            const meta = MODULE_HEADER_STAT_META[key];
            const filterKey = STAT_FILTER_MAP[key] ?? key;
            const matchingTab = PO_BUCKET_TABS.find((t) => t.key === filterKey);
            const baseClass =
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-100 border border-slate-200 text-xs";
            const labelSpan = (
              <>
                <span className="text-slate-600">{meta.label}</span>
                <span className="font-mono font-medium text-slate-700 tabular-nums">
                  {value}
                </span>
              </>
            );
            if (matchingTab) {
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveTab(matchingTab.key)}
                  className={`${baseClass} hover:border-slate-300 transition-colors`}
                  aria-label={`${meta.label} ${value}건 — 상태별 분류 ${matchingTab.label} 보기`}
                >
                  {labelSpan}
                </button>
              );
            }
            return (
              <span
                key={key}
                className={baseClass}
                aria-label={`${meta.label} ${value}건`}
              >
                {labelSpan}
              </span>
            );
          })}
        </div>
      </div>

      {/* ── Fallback: Empty ────────────────────────────────────────── */}
      {/* §11.209 — 실무 담당자 흐름 정합. 직전 단계(구매 운영)에서
          발주 전환을 완료해야 여기 항목이 생기므로 CTA 를 견적 관리가
          아니라 구매 운영으로 직접 연결. surface 귀책 명확화. */}
      {isEmpty && (
        <div className="bg-white border border-slate-200 rounded-lg">
          <EmptyState
            icon={Inbox}
            title="아직 발주된 항목이 없습니다"
            description="구매 운영에서 회신 받은 견적을 비교하고 발주로 전환하면 여기서 진행 상태를 추적합니다."
            action={
              <Link
                href="/dashboard/purchases"
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
              >
                구매 운영으로 이동 <ArrowRight className="h-3 w-3" />
              </Link>
            }
          />
        </div>
      )}

      {/* ── Fallback: Only waiting ─────────────────────────────────── */}
      {onlyWaiting && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-600">
            공급사 확인 대기 중 — 응답이 도착하면 처리 항목이 표시됩니다
          </p>
        </div>
      )}

      {!isEmpty && (
        <>
          {/* ── 2. Priority Queue ───────────────────────────────────── */}
          {priorityQueue.length > 0 && (
            <div>
              <h2 className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">
                우선 처리
              </h2>
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                {priorityQueue.map((item) => (
                  <PriorityCard
                    key={item.entityId}
                    item={item}
                    onClick={() => openOverlay({
                      routePath: buildDetailHref(item.targetRoute, { type: 'list', route: '/dashboard/purchase-orders', summary: item.title, returnLabel: '발주 목록으로' }),
                      origin: "card",
                      mode: "progress",
                    })}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── 3. State-Split Tabs ────────────────────────────────── */}
          <div>
            <h2 className="text-xs font-medium uppercase tracking-wider text-slate-600 mb-2">
              상태별 분류
            </h2>
            <div className="flex gap-1 border-b border-slate-200 mb-3">
              {PO_BUCKET_TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                    activeTab === tab.key
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-slate-600 hover:text-slate-700"
                  }`}
                >
                  {tab.label}
                  {bucketCounts[tab.key] > 0 && (
                    <span className="ml-1.5 tabular-nums text-slate-500">
                      {bucketCounts[tab.key]}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* ── 4. Actionable Queue (bucket items) ───────────────── */}
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              {activeBucketItems.length === 0 ? (
                <EmptyState
                  icon={Filter}
                  title={`${
                    PO_BUCKET_TABS.find((t) => t.key === activeTab)?.label ??
                    "현재"
                  } 단계에 처리할 항목이 없습니다`}
                  description="다른 분류 탭을 확인하거나, 우선 처리에서 다음 작업을 시작하세요."
                />
              ) : (
                <div className="divide-y divide-slate-200">
                  {activeBucketItems.map((item) => (
                    <ActionableRow
                      key={item.entityId}
                      item={item}
                      onClick={() =>
                        openOverlay({
                          routePath: `/dashboard/purchase-orders/${item.entityId}`,
                          origin: "queue",
                          mode: "progress",
                        })
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── 5. Downstream ──────────────────────────────────────── */}
          {downstream.length > 0 && (
            <div>
              <h2 className="text-xs font-medium uppercase tracking-wider text-slate-600 mb-2">
                다운스트림 인계
              </h2>
              <div className="grid gap-2 md:grid-cols-2">
                {downstream.map((ds) => (
                  <Link
                    key={ds.label}
                    href={ds.targetRoute}
                    className="bg-white border border-slate-200 rounded-lg p-3 hover:border-slate-300 transition-colors group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-700">
                        {ds.label}
                      </span>
                      <span className="text-xs font-mono text-emerald-600 tabular-nums">
                        {ds.count}건
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {ds.description}
                    </p>
                    <div className="flex items-center gap-1 mt-2 text-xs text-slate-600 group-hover:text-slate-700 transition-colors">
                      이동 <ArrowRight className="h-3 w-3" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* §11.181 — 운영 브리핑 floating entry (default = popup open).
          §11.258-sweep — §11.257 후속: 모바일 (<lg) BarcodeScanFab 겹침 해소,
          데스크탑 한정 노출. 모바일 inline 진입은 §11.258-sweep-2 백로그. */}
      <div className="hidden lg:block">
        <OperationalBriefFloatingEntry controls="operational-brief-popup" />
      </div>
      {/* §11.258-sweep-2 — 모바일 좌측 하단 ✨ 운영 브리핑 진입 (방안 1). */}
      <MobileBriefInlineButton />
    </div>
  );
}

// ── Priority Card ─────────────────────────────────────────────────
function PriorityCard({
  item,
  onClick,
}: {
  item: ModuleLandingItem;
  onClick: () => void;
}) {
  const borderClass = item.dueState.isOverdue
    ? "border-l-red-500"
    : item.blockerSummary
      ? "border-l-yellow-500"
      : "border-l-slate-700";

  return (
    <button
      onClick={onClick}
      className={`text-left bg-white border border-slate-200 border-l-2 ${borderClass} rounded-lg p-3 hover:bg-slate-50 transition-colors w-full`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span
          className={`h-1.5 w-1.5 rounded-full ${PRIORITY_DOT[item.priority] ?? PRIORITY_DOT.p3}`}
        />
        <span className="text-xs font-mono text-slate-700 truncate">
          {item.title}
        </span>
      </div>
      <p className="text-xs text-slate-600 line-clamp-1">{item.summary}</p>
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-2">
          {item.currentOwnerName && (
            <span className="text-xs text-slate-600">
              {item.currentOwnerName}
            </span>
          )}
          <DueStateBadge dueState={item.dueState} />
        </div>
        {item.blockerSummary && (
          <span className="text-xs text-red-600 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            차단
          </span>
        )}
        {item.readySummary && !item.blockerSummary && (
          <span className="text-xs text-emerald-600 flex items-center gap-1">
            <Zap className="h-3 w-3" />
            실행 가능
          </span>
        )}
      </div>
      {/* AI 분석 패널 */}
      <AiAnalysisPanel item={item} />
    </button>
  );
}

// ── Actionable Row ────────────────────────────────────────────────
function ActionableRow({
  item,
  onClick,
}: {
  item: ModuleLandingItem;
  onClick: () => void;
}) {
  const { toast } = useToast();
  const borderClass = item.dueState.isOverdue
    ? "border-l-2 border-l-red-500"
    : item.blockerSummary
      ? "border-l-2 border-l-yellow-500"
      : "";

  // §11.211 Path V — ActionableRow 안 useQuery 로 entityId → DB Order.id
  // resolve. mock contract.id ('po-002') 가 그대로 DB Order.id 인 경우
  // 200 응답 (Sub-B: production seed 시 explicit id), 미존재 시 404 → null.
  // resolvedOrderId null 이면 PDF/email button disabled + tooltip 명시
  // (dead-button 0). PO row (vendorName 있음) 만 enabled.
  const { data: orderData, isLoading: orderResolving } = useQuery<
    { id: string } | null
  >({
    queryKey: ["po-actionable-row-order-resolve", item.entityId],
    queryFn: async () => {
      const res = await csrfFetch(`/api/orders/${item.entityId}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Order resolve 실패");
      const data = (await res.json()) as { order?: { id: string } | null };
      return data.order ?? null;
    },
    enabled: Boolean(item.vendorName),
    staleTime: 60_000, // 1분 캐시
    retry: false,
  });
  const resolvedOrderId: string | null = orderData?.id ?? null;

  // #post-approval-purchase-order-flow B+H step 3 — PDF 다운로드 + 이메일
  // 발송 quick-action mutation. ActionableRow 안 stopPropagation 으로 row
  // navigation 영향 0. resolvedOrderId 사용 (Path V — entityId 가 mock
  // contract.id 가 아닌 DB Order.id 정합 보장).
  const pdfMutation = useMutation({
    mutationFn: async () => {
      if (!resolvedOrderId) throw new Error("발주 row 가 아직 변환되지 않았습니다");
      const res = await csrfFetch(`/api/orders/${resolvedOrderId}/generate-pdf`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "PDF 생성 실패");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${item.title.replace(/[^\w-]/g, "_")}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    onError: (err: Error) =>
      toast({ title: "PDF 다운로드 실패", description: err.message, variant: "destructive" }),
  });
  const emailMutation = useMutation({
    mutationFn: async () => {
      if (!resolvedOrderId) throw new Error("발주 row 가 아직 변환되지 않았습니다");
      const res = await csrfFetch(`/api/orders/${resolvedOrderId}/send-email`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "이메일 발송 실패");
      }
      return res.json();
    },
    onSuccess: () =>
      toast({ title: "이메일 발송 완료", description: "공급사에게 발주서를 발송했습니다." }),
    onError: (err: Error) =>
      toast({ title: "발송 실패", description: err.message, variant: "destructive" }),
  });

  return (
    <div className={`w-full text-left px-4 py-2.5 hover:bg-slate-100 transition-colors ${borderClass}`}>
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick();
          }
        }}
        className="w-full flex items-center gap-3 cursor-pointer"
      >
        <span
          className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${PRIORITY_DOT[item.priority] ?? PRIORITY_DOT.p3}`}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-900 font-mono truncate">
              {item.title}
            </span>
            <span
              className={`text-xs px-1.5 py-0.5 rounded ${BUCKET_COLORS[item.bucketKey]}`}
            >
              {item.nextAction}
            </span>
          </div>
          <p className="text-xs text-slate-600 truncate mt-0.5">
            {item.summary}
          </p>
          {/* #post-approval-purchase-order-flow B+H step 1 — vendor row.
              VENDOR_MAP lookup (mock seed). vendor 미설정 row 는 skip. */}
          {item.vendorName && (
            <p className="text-[11px] text-slate-500 truncate mt-0.5">
              <span className="text-slate-400">공급사 ·</span>{" "}
              {item.vendorName}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {item.currentOwnerName && (
            <span className="text-xs text-slate-600">
              {item.currentOwnerName}
            </span>
          )}
          <DueStateBadge dueState={item.dueState} />
          {/* #post-approval-purchase-order-flow B+H step 3 — quick-action.
              row click 의 detail navigation 영향 0 (stopPropagation). vendor
              미설정 row 는 group 자체 hide (PO 가 아닌 row 에서 의미 0). */}
          {item.vendorName && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  pdfMutation.mutate();
                }}
                disabled={pdfMutation.isPending || orderResolving || !resolvedOrderId}
                title={
                  resolvedOrderId
                    ? "발주서 PDF 다운로드"
                    : orderResolving
                      ? "발주 정보 확인 중…"
                      : "발주 row 가 아직 변환되지 않았습니다"
                }
                className="p-1 rounded text-slate-500 hover:text-slate-700 hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FileText className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  emailMutation.mutate();
                }}
                disabled={
                  emailMutation.isPending ||
                  orderResolving ||
                  !resolvedOrderId ||
                  !item.vendorEmail
                }
                title={
                  !resolvedOrderId
                    ? orderResolving
                      ? "발주 정보 확인 중…"
                      : "발주 row 가 아직 변환되지 않았습니다"
                    : item.vendorEmail
                      ? "공급사 이메일 발송"
                      : "공급사 이메일이 설정되지 않아 발송할 수 없습니다."
                }
                className="p-1 rounded text-slate-500 hover:text-slate-700 hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Mail className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
        </div>
      </div>
      <AiAnalysisPanel item={item} />
    </div>
  );
}

// ── Due State Badge ───────────────────────────────────────────────
function DueStateBadge({
  dueState,
}: {
  dueState: ModuleLandingItem["dueState"];
}) {
  if (dueState.tone === "normal") return null;

  const cls =
    dueState.tone === "overdue"
      ? "text-red-600"
      : "text-yellow-600";

  return (
    <span className={`text-xs flex items-center gap-0.5 ${cls}`}>
      <Clock className="h-3 w-3" />
      {dueState.label}
    </span>
  );
}

// ══════════════════════════════════════════════════════════════════
// AI 분석 패널 — Budget Anomaly + Safety Check
// ══════════════════════════════════════════════════════════════════

interface BudgetAnomalyResult {
  isAnomaly: boolean;
  anomalyReason: string;
  anomalySeverity: "NORMAL" | "WARNING" | "CRITICAL";
  remainingAfterOrder: number;
  remainingPercent: number;
  predictedDepletionDate: string;
  burnRateStatus: "SAFE" | "WARNING" | "CRITICAL";
  burnRateDetail: string;
  recommendation: string;
}

interface SafetyCheckResult {
  isHazardous: boolean;
  hazardClass: string;
  ghs_pictograms: string[];
  requiredPPE: string[];
  storageRequirements: string;
  regulatoryWarnings: string[];
  handlingPrecautions: string;
  riskLevel: "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

const RISK_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  NONE:     { bg: "bg-slate-100",  text: "text-slate-600",   border: "border-slate-300" },
  LOW:      { bg: "bg-blue-50",    text: "text-blue-600",    border: "border-blue-200" },
  MEDIUM:   { bg: "bg-yellow-50",   text: "text-yellow-600",   border: "border-yellow-200" },
  HIGH:     { bg: "bg-yellow-50",  text: "text-yellow-600",  border: "border-yellow-200" },
  CRITICAL: { bg: "bg-red-50",     text: "text-red-600",     border: "border-red-200" },
};

const BURN_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
  SAFE:     { bg: "bg-emerald-50",  text: "text-emerald-600", icon: "text-emerald-600" },
  WARNING:  { bg: "bg-yellow-50",    text: "text-yellow-600",   icon: "text-yellow-600" },
  CRITICAL: { bg: "bg-red-50",      text: "text-red-600",     icon: "text-red-600" },
  NORMAL:   { bg: "bg-slate-100",   text: "text-slate-600",   icon: "text-slate-500" },
};

function AiAnalysisPanel({ item }: { item: ModuleLandingItem }) {
  const [isLoading, setIsLoading] = useState(false);
  const [budgetResult, setBudgetResult] = useState<BudgetAnomalyResult | null>(null);
  const [safetyResult, setSafetyResult] = useState<SafetyCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runAnalysis = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [budgetRes, safetyRes] = await Promise.allSettled([
        csrfFetch("/api/ai/budget-anomaly", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            itemName: item.title || "발주 품목",
            orderAmount: 350000,
            budgetTotal: 50000000,
            budgetCurrent: 28000000,
            budgetName: "연구비",
            budgetPeriod: "2026년 상반기",
          }),
        }).then((r) => r.json()),
        csrfFetch("/api/ai/safety-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            itemName: item.title || "품목",
            category: "REAGENT",
          }),
        }).then((r) => r.json()),
      ]);

      if (budgetRes.status === "fulfilled" && budgetRes.value.success) {
        setBudgetResult(budgetRes.value.data);
      }
      if (safetyRes.status === "fulfilled" && safetyRes.value.success) {
        setSafetyResult(safetyRes.value.data);
      }
      if (
        (budgetRes.status === "rejected" || !budgetRes.value?.success) &&
        (safetyRes.status === "rejected" || !safetyRes.value?.success)
      ) {
        setError("AI 분석에 실패했습니다.");
      }
    } catch {
      setError("AI 분석 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [item.title]);

  const hasResults = budgetResult || safetyResult;

  return (
    <div className="mt-2" onClick={(e) => e.stopPropagation()}>
      {!hasResults && !isLoading && (
        <button
          onClick={runAnalysis}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-violet-100 border border-violet-200 text-violet-600 text-xs font-medium hover:bg-violet-200 transition-colors"
        >
          <Sparkles className="h-3 w-3" />
          AI 분석
        </button>
      )}

      {isLoading && (
        <div className="flex items-center gap-2 px-3 py-2 rounded bg-slate-100 border border-slate-200 text-xs text-slate-600">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          예산 이상 탐지 + 안전 규제 검토 중...
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded bg-red-50 border border-red-200 text-xs text-red-600">
          <AlertCircle className="h-3.5 w-3.5" />
          {error}
        </div>
      )}

      {hasResults && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-1">
          {budgetResult && (
            <div className="rounded border border-slate-300 bg-slate-100 p-2.5 space-y-1.5">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">
                <DollarSign className="h-3 w-3 text-blue-600" />
                Budget & Anomaly
              </div>

              <div className={`rounded px-2 py-1.5 ${BURN_COLORS[budgetResult.anomalySeverity]?.bg ?? "bg-slate-100"}`}>
                <div className="flex items-center gap-1.5">
                  {budgetResult.isAnomaly ? (
                    <AlertTriangle className={`h-3 w-3 ${BURN_COLORS[budgetResult.anomalySeverity]?.icon ?? "text-slate-500"}`} />
                  ) : (
                    <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                  )}
                  <span className={`text-xs ${BURN_COLORS[budgetResult.anomalySeverity]?.text ?? "text-slate-400"}`}>
                    {budgetResult.anomalyReason}
                  </span>
                </div>
              </div>

              <div className={`rounded px-2 py-1.5 ${BURN_COLORS[budgetResult.burnRateStatus]?.bg ?? "bg-slate-100"}`}>
                <div className="flex items-center justify-between">
                  <span className={`text-xs ${BURN_COLORS[budgetResult.burnRateStatus]?.text ?? "text-slate-600"}`}>
                    잔여 {budgetResult.remainingPercent}%
                  </span>
                  <span className="text-[10px] text-slate-600">{budgetResult.predictedDepletionDate}</span>
                </div>
                <p className="text-[10px] text-slate-600 mt-0.5">{budgetResult.burnRateDetail}</p>
              </div>

              <p className="text-[10px] text-slate-600">{budgetResult.recommendation}</p>
            </div>
          )}

          {safetyResult && (
            <div className="rounded border border-slate-300 bg-slate-100 p-2.5 space-y-1.5">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">
                <FlaskConical className="h-3 w-3 text-yellow-600" />
                Safety & Compliance
              </div>

              <div className={`rounded px-2 py-1.5 border ${RISK_COLORS[safetyResult.riskLevel]?.bg ?? "bg-slate-100"} ${RISK_COLORS[safetyResult.riskLevel]?.border ?? "border-slate-200"}`}>
                <div className="flex items-center gap-1.5">
                  {safetyResult.isHazardous ? (
                    <ShieldAlert className={`h-3 w-3 ${RISK_COLORS[safetyResult.riskLevel]?.text ?? "text-slate-400"}`} />
                  ) : (
                    <ShieldCheck className="h-3 w-3 text-emerald-400" />
                  )}
                  <span className={`text-xs ${RISK_COLORS[safetyResult.riskLevel]?.text ?? "text-slate-400"}`}>
                    {safetyResult.hazardClass}
                  </span>
                </div>
              </div>

              {safetyResult.requiredPPE.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {safetyResult.requiredPPE.map((ppe, i) => (
                    <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-200">
                      {ppe}
                    </span>
                  ))}
                </div>
              )}

              {safetyResult.regulatoryWarnings.length > 0 && (
                <div className="space-y-0.5">
                  {safetyResult.regulatoryWarnings.map((w, i) => (
                    <div key={i} className="flex items-start gap-1 text-[10px] text-yellow-600">
                      <AlertTriangle className="h-2.5 w-2.5 mt-0.5 flex-shrink-0" />
                      {w}
                    </div>
                  ))}
                </div>
              )}

              {safetyResult.storageRequirements && safetyResult.riskLevel !== "NONE" && (
                <p className="text-[10px] text-slate-600">
                  <span className="text-slate-600">보관: </span>{safetyResult.storageRequirements}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// §11.214b Path Z — NoSSR wrapper.
export default function PurchaseOrderLandingPage() {
  return (
    <NoSSR>
      <PurchaseOrderLandingPageInner />
    </NoSSR>
  );
}
