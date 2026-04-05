"use client";

export const dynamic = 'force-dynamic';

import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Package, AlertTriangle, DollarSign, FileText, Search, Plus,
  TrendingUp, TrendingDown, Truck, ChevronRight, Beaker, Calendar, GitCompare,
  CheckCircle2, Clock,
} from "lucide-react";
import Link from "next/link";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Badge } from "@/components/ui/badge";
import { getGuestKey } from "@/lib/guest-key";
import dynamic_import from "next/dynamic";
const WorkQueueInbox = dynamic_import(() => import("@/components/dashboard/work-queue-inbox").then(m => m.WorkQueueInbox), {
  ssr: false,
  loading: () => <div className="h-16 rounded-xl bg-el animate-pulse" />,
});
import { COMPARE_SUBSTATUS_DEFS, RESOLUTION_PATH_LABELS, HANDOFF_STALL_LABELS } from "@/lib/work-queue/compare-queue-semantics";
import { OPS_STALL_LABELS } from "@/lib/work-queue/ops-queue-semantics";

export default function DashboardPage() {
  const { data: session, status } = useSession();

  const { data: dashboardStats, isLoading: statsLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const guestKey = getGuestKey();
      const headers: Record<string, string> = {};
      if (guestKey) headers["x-guest-key"] = guestKey;
      const response = await fetch("/api/dashboard/stats", { headers });
      if (!response.ok) {
        console.warn("[dashboard] stats API failed:", response.status);
        return null;
      }
      return response.json();
    },
    enabled: status === "authenticated",
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  if (status === "loading") {
    return (
      <div className="p-4 pt-4 md:p-8 md:pt-6 space-y-4">
        <div className="h-6 w-48 rounded bg-el animate-pulse" />
        <div className="h-[72px] rounded-xl bg-el animate-pulse" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-[100px] md:h-[120px] rounded-xl bg-el animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const rawStats = dashboardStats || {};

  const stats = {
    totalInventory: rawStats.totalInventory ?? 0,
    lowStockAlerts: rawStats.lowStockAlerts ?? 0,
    monthlySpending: rawStats.thisMonthPurchaseAmount ?? 0,
    activeQuotes: rawStats.quoteStats?.pending ?? 0,
    respondedQuotes: rawStats.quoteStats?.responded ?? 0,
    monthOverMonthChange: parseFloat(rawStats.monthOverMonthChange ?? "0"),
    monthlySpendingChart: (rawStats.monthlySpending ?? []) as Array<{ month: string; amount: number }>,
    expiringItems: (rawStats.expiringItems ?? []) as Array<{
      id: string; productName: string; catalogNumber?: string;
      expiryDate: string; currentQuantity: number; unit: string; daysLeft: number;
    }>,
    lowStockItems: (rawStats.lowStockItems ?? []) as Array<{
      id: string; productName: string; catalogNumber?: string;
      currentQuantity: number; safetyStock: number; unit: string;
    }>,
    expiringCount: rawStats.expiringCount ?? 0,
    recentPurchases: (rawStats.recentPurchases ?? []) as Array<{
      id: string; itemName: string | null; vendorName: string | null;
      amount: number | null; purchasedAt: string; category: string | null;
      qty: number | null; unit: string | null;
    }>,
    undecidedCompareCount: rawStats.undecidedCompareCount ?? 0,
    compareStats: {
      slaBreachedCount: rawStats.compareStats?.slaBreachedCount ?? 0,
      inquiryFollowupCount: rawStats.compareStats?.inquiryFollowupCount ?? 0,
      substatusBreakdown: (rawStats.compareStats?.substatusBreakdown ?? {}) as Record<string, number>,
      conversionRate: rawStats.compareStats?.conversionRate ?? 0,
      avgTurnaroundDays: rawStats.compareStats?.avgTurnaroundDays ?? 0,
      resolutionPathDistribution: (rawStats.compareStats?.resolutionPathDistribution ?? {}) as Record<string, number>,
      noMovementCount: rawStats.compareStats?.noMovementCount ?? 0,
      inquiryFollowupRate: rawStats.compareStats?.inquiryFollowupRate ?? 0,
      compareToQuoteCount: rawStats.compareStats?.compareToQuoteCount ?? 0,
      quoteToPurchaseCount: rawStats.compareStats?.quoteToPurchaseCount ?? 0,
      purchaseToReceivingCount: rawStats.compareStats?.purchaseToReceivingCount ?? 0,
      receivingToInventoryCount: rawStats.compareStats?.receivingToInventoryCount ?? 0,
      handoffStallPoint: (rawStats.compareStats?.handoffStallPoint ?? "none") as string,
    },
    opsFunnel: {
      totalQuotes: rawStats.opsFunnel?.totalQuotes ?? 0,
      purchasedQuotes: rawStats.opsFunnel?.purchasedQuotes ?? 0,
      confirmedOrders: rawStats.opsFunnel?.confirmedOrders ?? 0,
      completedReceiving: rawStats.opsFunnel?.completedReceiving ?? 0,
      stallPoint: (rawStats.opsFunnel?.stallPoint ?? "none") as string,
    },
  };

  const hasAnyData = stats.totalInventory > 0 || stats.monthlySpending > 0 || stats.activeQuotes > 0;
  const hasActionItems = stats.lowStockAlerts > 0 || stats.activeQuotes > 0 || stats.expiringCount > 0 || stats.undecidedCompareCount > 0;
  const actionCount = (stats.lowStockAlerts > 0 ? 1 : 0) + (stats.activeQuotes > 0 ? 1 : 0) + (stats.expiringCount > 0 ? 1 : 0) + (stats.undecidedCompareCount > 0 ? 1 : 0);

  // -- 알림 (심각도순 정렬) --
  const notifications = [
    ...(stats.lowStockAlerts > 0
      ? [{ id: "n-low", type: "alert" as const, title: `재고 부족 ${stats.lowStockAlerts}건 -- 발주 검토 필요`, content: "안전재고 이하 품목이 감지되었습니다.", time: "지금", unread: true, href: "/dashboard/inventory?filter=low" }]
      : []),
    ...(stats.activeQuotes > 0
      ? [{ id: "n-quote", type: "quote" as const, title: `견적 ${stats.activeQuotes}건 검토 대기`, content: stats.respondedQuotes > 0 ? `${stats.respondedQuotes}건 응답 수신, 검토가 필요합니다.` : "공급사 응답을 기다리고 있습니다.", time: "최근", unread: true, href: "/dashboard/quotes?status=PENDING" }]
      : []),
    ...(stats.expiringCount > 0
      ? [{ id: "n-exp", type: "alert" as const, title: `유통기한 임박 ${stats.expiringCount}건`, content: "30일 이내 만료 예정 품목이 있습니다.", time: "최근", unread: true, href: "/dashboard/inventory" }]
      : []),
    ...(stats.undecidedCompareCount > 0
      ? [{
          id: "n-compare",
          type: stats.compareStats.slaBreachedCount > 0 ? "alert" as const : "quote" as const,
          title: stats.compareStats.slaBreachedCount > 0
            ? `비교 판정 대기 ${stats.undecidedCompareCount}건 (SLA 초과 ${stats.compareStats.slaBreachedCount}건)`
            : `비교 판정 대기 ${stats.undecidedCompareCount}건`,
          content: stats.compareStats.inquiryFollowupCount > 0
            ? `문의 후속 ${stats.compareStats.inquiryFollowupCount}건 포함`
            : "비교 결과를 검토하고 판정을 내려주세요.",
          time: "최근",
          unread: stats.compareStats.slaBreachedCount > 0,
          href: "/compare",
        }]
      : []),
    { id: "n-delivery", type: "delivery" as const, title: "최근 입고 처리 완료", content: "등록된 입고 내역을 확인할 수 있습니다.", time: "최근", unread: false, href: "/dashboard/purchases" },
  ].slice(0, 4);

  const renderNotificationIcon = (type: string) => {
    switch (type) {
      case "alert":
        return <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />;
      case "quote":
        return <FileText className="h-4 w-4 text-blue-400 flex-shrink-0 mt-0.5" />;
      case "delivery":
        return <Truck className="h-4 w-4 text-green-400 flex-shrink-0 mt-0.5" />;
      default:
        return null;
    }
  };

  const formatPurchaseDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  };

  // -- KPI 해석 문구 --
  const getInventoryInsight = () => {
    if (stats.totalInventory === 0) return "등록된 품목이 없어 비교·요청 이력이 아직 없습니다";
    if (stats.lowStockAlerts > 0) return `${stats.lowStockAlerts}개 품목 부족 — 발주 검토 필요`;
    return "전체 품목 정상 운영 중";
  };

  const getStockInsight = () => {
    if (stats.lowStockAlerts === 0) return "모든 품목이 안전재고 이상으로 유지되고 있습니다";
    if (stats.lowStockAlerts >= 3) return "3건 이상 부족 — 일괄 발주를 검토하세요";
    return "해당 품목의 개별 발주를 검토하세요";
  };

  const getSpendingInsight = () => {
    const change = stats.monthOverMonthChange;
    if (stats.monthlySpending === 0) return "이번 달 지출이 없어 추이를 표시할 수 없습니다";
    if (change > 10) return `전월 대비 ${change.toFixed(0)}% 증가 — 지출 항목을 확인하세요`;
    if (change < -10) return `전월 대비 ${Math.abs(change).toFixed(0)}% 절감 — 정상 범위`;
    return "전월과 유사한 수준을 유지하고 있습니다";
  };

  const getQuoteInsight = () => {
    if (stats.activeQuotes === 0) return "진행 중인 견적이 없어 응답 대기 건이 없습니다";
    if (stats.respondedQuotes > 0) return `${stats.respondedQuotes}건 응답 수신 — 확정 또는 반려가 필요합니다`;
    return "공급사 응답 대기 중 — 평균 1~2일 소요";
  };

  // -- KPI risk level --
  const inventoryRisk = stats.lowStockAlerts > 0 ? "amber" : "none";
  const stockRisk = stats.lowStockAlerts >= 3 ? "red" : stats.lowStockAlerts > 0 ? "amber" : "none";
  const spendingRisk = stats.monthOverMonthChange > 10 ? "amber" : "none";
  const quoteRisk = stats.respondedQuotes > 0 ? "amber" : "none";

  const riskBorder = (risk: string) => {
    if (risk === "red") return "border-l-2 border-l-red-500";
    if (risk === "amber") return "border-l-2 border-l-amber-500";
    return "";
  };

  // -- 즉시 처리 항목 생성 --
  const urgentItems: Array<{ id: string; icon: React.ReactNode; label: string; desc: string; href: string; severity: "red" | "amber" }> = [];
  if (stats.lowStockAlerts > 0) {
    urgentItems.push({
      id: "u-low",
      icon: <AlertTriangle className="h-4 w-4 text-red-400" />,
      label: `재고 부족 ${stats.lowStockAlerts}건`,
      desc: "안전재고 이하 품목 -- 발주 검토",
      href: "/dashboard/inventory?filter=low",
      severity: stats.lowStockAlerts >= 3 ? "red" : "amber",
    });
  }
  if (stats.respondedQuotes > 0) {
    urgentItems.push({
      id: "u-responded",
      icon: <CheckCircle2 className="h-4 w-4 text-green-400" />,
      label: `견적 응답 ${stats.respondedQuotes}건`,
      desc: "공급사 응답 수신 -- 검토 후 확정",
      href: "/dashboard/quotes?status=RESPONDED",
      severity: "amber",
    });
  }
  if (stats.expiringCount > 0) {
    urgentItems.push({
      id: "u-expiring",
      icon: <Calendar className="h-4 w-4 text-amber-400" />,
      label: `유통기한 임박 ${stats.expiringCount}건`,
      desc: "30일 이내 만료 예정",
      href: "/dashboard/inventory",
      severity: "amber",
    });
  }
  if (stats.undecidedCompareCount > 0) {
    urgentItems.push({
      id: "u-compare",
      icon: <GitCompare className="h-4 w-4 text-slate-400" />,
      label: `비교 판정 대기 ${stats.undecidedCompareCount}건`,
      desc: stats.compareStats.slaBreachedCount > 0 ? `SLA 초과 ${stats.compareStats.slaBreachedCount}건 포함` : "비교 결과 검토 필요",
      href: "/compare",
      severity: stats.compareStats.slaBreachedCount > 0 ? "red" : "amber",
    });
  }
  if (stats.activeQuotes > 0 && stats.respondedQuotes === 0) {
    urgentItems.push({
      id: "u-pending-quote",
      icon: <Clock className="h-4 w-4 text-amber-400" />,
      label: `승인 대기 견적 ${stats.activeQuotes}건`,
      desc: "공급사 응답 대기 중",
      href: "/dashboard/quotes?status=PENDING",
      severity: "amber",
    });
  }

  // -- 상태 기반 추천 작업 --
  const recommendedActions: Array<{ id: string; icon: React.ReactNode; label: string; desc: string; href: string; state: "idle" | "ready" | "blocked" }> = [];

  // 품목 등록 상태
  if (stats.totalInventory === 0) {
    recommendedActions.push({ id: "r-register", icon: <Plus className="h-3.5 w-3.5 text-slate-400" />, label: "품목 등록", desc: "등록된 품목이 없어 비교·견적을 시작할 수 없습니다", href: "/dashboard/inventory", state: "blocked" });
  } else {
    recommendedActions.push({ id: "r-register", icon: <Plus className="h-3.5 w-3.5 text-emerald-400" />, label: "재고 등록", desc: `${stats.totalInventory}개 운영 중 · 추가 입고 등록`, href: "/dashboard/inventory", state: "ready" });
  }

  // 비교 상태
  if (stats.undecidedCompareCount > 0) {
    recommendedActions.push({ id: "r-compare", icon: <GitCompare className="h-3.5 w-3.5 text-amber-400" />, label: "비교 판정", desc: `${stats.undecidedCompareCount}건 판정 대기 — 검토 후 확정하세요`, href: "/compare", state: "ready" });
  } else if (stats.totalInventory > 0) {
    recommendedActions.push({ id: "r-compare", icon: <GitCompare className="h-3.5 w-3.5 text-slate-400" />, label: "제품 비교", desc: "비교 대기 항목 없음 — 검색에서 후보를 추가하세요", href: "/app/compare", state: "idle" });
  }

  // 견적 상태
  if (stats.respondedQuotes > 0) {
    recommendedActions.push({ id: "r-quote", icon: <FileText className="h-3.5 w-3.5 text-amber-400" />, label: "견적 검토", desc: `${stats.respondedQuotes}건 응답 수신 — 확정 대기`, href: "/dashboard/quotes?status=RESPONDED", state: "ready" });
  } else if (stats.activeQuotes > 0) {
    recommendedActions.push({ id: "r-quote", icon: <FileText className="h-3.5 w-3.5 text-slate-400" />, label: "견적 현황", desc: `${stats.activeQuotes}건 응답 대기 중`, href: "/dashboard/quotes?status=PENDING", state: "idle" });
  } else {
    recommendedActions.push({ id: "r-quote", icon: <FileText className="h-3.5 w-3.5 text-slate-400" />, label: "견적 요청", desc: "작성 대기 요청 없음 — 비교 결과에서 견적을 시작하세요", href: "/app/quote", state: "idle" });
  }

  // 검색
  recommendedActions.push({ id: "r-search", icon: <Search className="h-3.5 w-3.5 text-slate-400" />, label: "시약·장비 검색", desc: "500만+ 품목에서 후보 탐색", href: "/app/search", state: "idle" });

  // -- KPI 판단 카드 렌더 (공통) --
  const renderKpiCard = (config: {
    href: string; icon: React.ReactNode; label: string; value: React.ReactNode;
    insight: string; action?: string; risk: string; className?: string;
  }) => (
    <Link href={config.href}>
      <Card className={`overflow-hidden cursor-pointer transition-all hover:shadow-md bg-[#1A2332] border-white/[0.08] shadow-sm rounded-xl ${riskBorder(config.risk)} ${config.className ?? ""}`}>
        <CardContent className="p-3.5 md:p-4 flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-lg" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
              {config.icon}
            </span>
            <span className="text-[10px] md:text-xs font-semibold text-slate-100 uppercase tracking-wider">{config.label}</span>
          </div>
          <div className="text-2xl md:text-3xl font-bold text-white leading-tight">{config.value}</div>
          <p className="text-[10px] md:text-[11px] text-slate-200 leading-tight truncate">{config.insight}</p>
          {config.action && (
            <p className="text-[10px] md:text-[11px] text-blue-400 font-medium mt-0.5">{config.action} →</p>
          )}
        </CardContent>
      </Card>
    </Link>
  );

  return (
    <div className="p-4 pt-4 md:p-8 md:pt-6 space-y-4 md:space-y-5 overflow-x-hidden">

      {/* --- 페이지 헤더 --- */}
      <div className="flex flex-col space-y-1 min-w-0">
        <h2 className="text-xl md:text-2xl font-bold tracking-tight text-white">
          대시보드
        </h2>
        <p className="text-sm text-slate-100">
          {session?.user?.name ? `${session.user.name}님, ` : ""}
          {hasActionItems ? `처리가 필요한 항목 ${actionCount}건이 있습니다.` : "현재 운영 상태가 양호합니다."}
        </p>
      </div>

      {/* --- AI 작업함 --- */}
      <WorkQueueInbox />

      {/* --- Empty State (보조 섹션) --- */}
      {!hasAnyData && !statsLoading && (
        <div className="rounded-lg border border-white/[0.05] border-dashed p-4 md:p-5 bg-white/[0.01]">
          <p className="text-[10px] font-medium text-slate-600 uppercase tracking-widest mb-3">시작하기</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              { step: "1", label: "품목 등록", desc: "시약·장비 등록", href: "/dashboard/inventory", icon: <Plus className="h-3.5 w-3.5 text-slate-500" /> },
              { step: "2", label: "비교 시작", desc: "스펙·가격 비교", href: "/app/compare", icon: <GitCompare className="h-3.5 w-3.5 text-slate-500" /> },
              { step: "3", label: "견적 요청", desc: "공급사 견적 요청", href: "/app/quote", icon: <FileText className="h-3.5 w-3.5 text-slate-500" /> },
              { step: "4", label: "재고 연결", desc: "입고 후 연결", href: "/dashboard/inventory", icon: <Package className="h-3.5 w-3.5 text-slate-500" /> },
            ].map((item) => (
              <Link key={item.step} href={item.href} className="group border border-white/[0.05] rounded-md p-2.5 hover:bg-white/[0.03] transition-colors">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[9px] font-bold text-slate-600 bg-white/[0.05] rounded px-1 py-0.5">{item.step}</span>
                  {item.icon}
                </div>
                <p className="text-[11px] font-medium text-slate-300">{item.label}</p>
                <p className="text-[10px] text-slate-600 mt-0.5">{item.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* --- 1순위: 오늘의 우선 작업 --- */}
      <div className="rounded-xl border border-white/[0.10] bg-[#2c2e32] shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-2">
            {hasActionItems ? (
              <>
                <span className="relative flex h-2 w-2 flex-shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
                </span>
                <h3 className="text-sm font-semibold text-white">오늘의 우선 작업</h3>
              </>
            ) : (
              <>
                <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 flex-shrink-0" />
                <h3 className="text-sm font-semibold text-slate-200">운영 상태 정상</h3>
              </>
            )}
          </div>
          {hasActionItems && (
            <div className="flex items-center gap-2">
              {stats.activeQuotes > 0 && (
                <Link href="/dashboard/quotes?status=PENDING">
                  <Button variant="outline" size="sm" className="h-7 text-[11px] px-2.5 border-blue-900/50 text-blue-400 hover:bg-el/50">
                    견적 검토하기
                  </Button>
                </Link>
              )}
              {stats.lowStockAlerts > 0 && (
                <Link href="/dashboard/inventory?filter=low">
                  <Button variant="outline" size="sm" className="h-7 text-[11px] px-2.5 border-red-900/50 text-red-400 hover:bg-red-950/30">
                    재고 확인하기
                  </Button>
                </Link>
              )}
            </div>
          )}
        </div>
        {hasActionItems ? (
          <div className="divide-y divide-white/[0.04] sm:divide-y-0 sm:grid sm:divide-x sm:divide-white/[0.04]" style={{ gridTemplateColumns: `repeat(${actionCount}, 1fr)` }}>
            {stats.lowStockAlerts > 0 && (
              <Link href="/dashboard/inventory?filter=low" className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.04] transition-colors group">
                <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white">{stats.lowStockAlerts}건 재고 부족</p>
                  <p className="text-xs text-slate-300">즉시 발주 검토 필요</p>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-500 flex-shrink-0 group-hover:text-slate-300 transition-colors" />
              </Link>
            )}
            {stats.activeQuotes > 0 && (
              <Link href="/dashboard/quotes?status=PENDING" className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.04] transition-colors group">
                <FileText className="h-4 w-4 text-blue-400 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white">{stats.activeQuotes}건 견적 대기</p>
                  <p className="text-xs text-slate-400">
                    {stats.respondedQuotes > 0 ? `${stats.respondedQuotes}건 응답 수신 -- 검토 필요` : "공급사 응답 대기 중"}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-500 flex-shrink-0 group-hover:text-slate-300 transition-colors" />
              </Link>
            )}
            {stats.expiringCount > 0 && (
              <Link href="/dashboard/inventory" className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.04] transition-colors group">
                <Calendar className="h-4 w-4 text-amber-400 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white">{stats.expiringCount}건 유통기한 임박</p>
                  <p className="text-xs text-slate-300">30일 이내 만료 예정</p>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-500 flex-shrink-0 group-hover:text-slate-300 transition-colors" />
              </Link>
            )}
            {stats.undecidedCompareCount > 0 && (
              <Link href="/compare" className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.04] transition-colors group">
                <GitCompare className={`h-4 w-4 flex-shrink-0 ${stats.compareStats.slaBreachedCount > 0 ? "text-red-400" : "text-slate-400"}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white">{stats.undecidedCompareCount}건 비교 판정 대기</p>
                  <p className="text-xs text-slate-400">
                    {stats.compareStats.slaBreachedCount > 0
                      ? `SLA 초과 ${stats.compareStats.slaBreachedCount}건 -- 즉시 처리 필요`
                      : "비교 결과를 검토하고 판정하세요"}
                  </p>
                  {Object.keys(stats.compareStats.substatusBreakdown).length > 0 && (
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {Object.entries(stats.compareStats.substatusBreakdown)
                        .filter(([, count]) => count > 0)
                        .map(([key, count]) => `${COMPARE_SUBSTATUS_DEFS[key]?.label ?? key} ${count}`)
                        .join(" · ")}
                    </p>
                  )}
                  {(stats.compareStats.avgTurnaroundDays > 0 || stats.compareStats.conversionRate > 0) && (
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {stats.compareStats.avgTurnaroundDays > 0 ? `평균 ${stats.compareStats.avgTurnaroundDays}일` : ""}
                      {stats.compareStats.avgTurnaroundDays > 0 && stats.compareStats.conversionRate > 0 ? " · " : ""}
                      {stats.compareStats.conversionRate > 0 ? `견적 전환 ${stats.compareStats.conversionRate}%` : ""}
                    </p>
                  )}
                  {Object.keys(stats.compareStats.resolutionPathDistribution).length > 0 && (
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {Object.entries(stats.compareStats.resolutionPathDistribution)
                        .filter(([, count]) => count > 0)
                        .map(([key, count]) => `${RESOLUTION_PATH_LABELS[key as keyof typeof RESOLUTION_PATH_LABELS] ?? key} ${count}`)
                        .join(" · ")}
                    </p>
                  )}
                  {stats.compareStats.noMovementCount > 0 && (
                    <p className="text-[10px] text-orange-500 font-medium mt-0.5">
                      다음 단계 없음 {stats.compareStats.noMovementCount}건
                    </p>
                  )}
                  {stats.compareStats.compareToQuoteCount > 0 && (
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {"견적 "}{stats.compareStats.compareToQuoteCount}
                      {" -> 발주 "}{stats.compareStats.quoteToPurchaseCount}
                      {" -> 입고 "}{stats.compareStats.purchaseToReceivingCount}
                      {" -> 완료 "}{stats.compareStats.receivingToInventoryCount}
                      {stats.compareStats.handoffStallPoint !== "none" && (
                        <span className="text-orange-500 ml-1">
                          ({HANDOFF_STALL_LABELS[stats.compareStats.handoffStallPoint as keyof typeof HANDOFF_STALL_LABELS]})
                        </span>
                      )}
                    </p>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 text-slate-500 flex-shrink-0 group-hover:text-slate-300 transition-colors" />
              </Link>
            )}
          </div>
        ) : (
          <div className="px-4 py-3">
            <p className="text-sm text-slate-300">현재 즉시 처리가 필요한 항목이 없습니다. 아래 빠른 실행에서 업무를 시작하세요.</p>
          </div>
        )}
      </div>

      {/* ======= 모바일 전용 레이아웃 ======= */}
      <div className="md:hidden space-y-3 pb-20">

        {/* KPI 판단 카드 2x2 */}
        <div className="grid grid-cols-2 gap-3">
          {renderKpiCard({
            href: "/dashboard/inventory",
            icon: <Package className="h-3 w-3 text-emerald-400" />,
            label: "등록 품목",
            value: stats.totalInventory.toLocaleString("ko-KR"),
            insight: getInventoryInsight(),
            action: stats.totalInventory === 0 ? "품목 등록 시작" : undefined,
            risk: inventoryRisk,
          })}
          {renderKpiCard({
            href: "/dashboard/inventory?filter=low",
            icon: <AlertTriangle className="h-3 w-3 text-amber-400" />,
            label: "재고 부족",
            value: stats.lowStockAlerts,
            insight: getStockInsight(),
            action: stats.lowStockAlerts > 0 ? "부족 품목 확인" : undefined,
            risk: stockRisk,
          })}
          {renderKpiCard({
            href: "/dashboard/purchases",
            icon: <DollarSign className="h-3 w-3 text-blue-400" />,
            label: "이번 달 지출",
            value: stats.monthlySpending > 0 ? `₩${stats.monthlySpending.toLocaleString("ko-KR")}` : "—",
            insight: getSpendingInsight(),
            action: stats.monthlySpending === 0 ? "첫 구매 등록" : undefined,
            risk: spendingRisk,
          })}
          {renderKpiCard({
            href: "/dashboard/quotes?status=PENDING",
            icon: <FileText className="h-3 w-3 text-violet-400" />,
            label: "진행 중 견적",
            value: stats.activeQuotes,
            insight: getQuoteInsight(),
            action: stats.activeQuotes === 0 ? "견적 요청 시작" : stats.respondedQuotes > 0 ? "응답 검토" : undefined,
            risk: quoteRisk,
          })}
        </div>

        {/* 운영 패널: 즉시 처리 + 추천 작업 */}
        <Card className="bg-[#1A2332] border-white/[0.08] shadow-sm rounded-xl">
          <CardContent className="p-3 space-y-3">
            {/* 즉시 처리 */}
            {urgentItems.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider">즉시 처리</p>
                {urgentItems.map((item) => (
                  <Link key={item.id} href={item.href} className={`flex items-center gap-2.5 p-2 rounded-lg hover:bg-el transition-colors ${item.severity === "red" ? "border-l-2 border-l-red-500" : "border-l-2 border-l-amber-500"}`}>
                    {item.icon}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white">{item.label}</p>
                      <p className="text-[10px] text-slate-300">{item.desc}</p>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
                  </Link>
                ))}
              </div>
            )}

            {/* 상태 기반 추천 */}
            <div className="space-y-1.5">
              {urgentItems.length > 0 && <div className="border-t border-bd" />}
              <p className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider">다음 작업</p>
              <div className="space-y-1">
                {recommendedActions.map((action) => (
                  <Link key={action.id} href={action.href} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-white/[0.04] transition-colors">
                    {action.icon}
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-medium ${action.state === "blocked" ? "text-slate-400" : action.state === "ready" ? "text-white" : "text-slate-300"}`}>{action.label}</p>
                      <p className="text-[10px] text-slate-400 truncate">{action.desc}</p>
                    </div>
                    <ChevronRight className="h-3 w-3 text-slate-600 flex-shrink-0" />
                  </Link>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 최근 알림 */}
        <Card className="bg-[#1A2332] border-white/[0.08] shadow-sm rounded-xl">
          <CardHeader className="pb-2 p-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">최근 알림</CardTitle>
              <Link href="/dashboard/notifications"><Button variant="ghost" size="sm" className="text-[11px] h-6 px-2">모두 보기</Button></Link>
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-0 space-y-1">
            {notifications.map((n) => (
              <Link key={n.id} href={n.href} className={`flex items-start gap-2.5 p-2 rounded-lg transition-colors ${n.unread ? "bg-el/50" : "hover:bg-el"}`}>
                {renderNotificationIcon(n.type)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <p className="font-medium text-xs text-white truncate">{n.title}</p>
                    {n.unread && <Badge variant="default" className="h-3.5 px-1 text-[9px] bg-blue-600 flex-shrink-0">새</Badge>}
                  </div>
                  <p className="text-[10px] text-slate-300 line-clamp-1">{n.content}</p>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-slate-500 flex-shrink-0 mt-1" />
              </Link>
            ))}
          </CardContent>
        </Card>

        {/* 최근 처리 이력 (축소) */}
        <Card className="bg-[#1A2332] border-white/[0.08] shadow-sm rounded-xl">
          <CardHeader className="pb-2 p-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-white">최근 처리 이력</CardTitle>
              <Link href="/dashboard/purchases"><Button variant="ghost" size="sm" className="text-[11px] h-6 px-2">전체 보기</Button></Link>
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-0 space-y-2">
            {stats.recentPurchases.length === 0 ? (
              <p className="text-xs text-slate-500 py-2">아직 처리된 운영 이력이 없습니다</p>
            ) : (
              stats.recentPurchases.slice(0, 3).map((p, i) => (
                <div key={p.id || `p-${i}`} className="flex items-center gap-2.5 py-1.5 border-b border-bd/30 last:border-0">
                  <Beaker className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-100 truncate">{p.itemName || "품목명 미등록"}</p>
                    <p className="text-[10px] text-slate-300">{formatPurchaseDate(p.purchasedAt)}</p>
                  </div>
                  <span className="text-xs font-semibold text-slate-300 flex-shrink-0">
                    {p.amount ? `₩${p.amount.toLocaleString("ko-KR")}` : "—"}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* ======= 데스크탑 레이아웃 ======= */}
      <div className="hidden md:grid md:grid-cols-7 md:gap-4">

        {/* -- 좌측 메인 (5col) -- */}
        <div className="md:col-span-5 space-y-4">

          {/* KPI 판단 카드 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {renderKpiCard({
              href: "/dashboard/inventory",
              icon: <Package className="h-3.5 w-3.5 text-emerald-400" />,
              label: "등록 품목",
              value: stats.totalInventory.toLocaleString("ko-KR"),
              insight: getInventoryInsight(),
              action: stats.totalInventory === 0 ? "품목 등록 시작" : undefined,
              risk: inventoryRisk,
            })}
            {renderKpiCard({
              href: "/dashboard/inventory?filter=low",
              icon: <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />,
              label: "재고 부족",
              value: stats.lowStockAlerts,
              insight: getStockInsight(),
              action: stats.lowStockAlerts > 0 ? "부족 품목 확인" : undefined,
              risk: stockRisk,
            })}
            <Link href="/dashboard/purchases">
              <Card className={`overflow-hidden cursor-pointer transition-all hover:shadow-md bg-[#1A2332] border-white/[0.08] shadow-sm rounded-xl ${riskBorder(spendingRisk)}`}>
                <CardContent className="p-4 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className="flex items-center justify-center w-6 h-6 rounded-lg" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
                      <DollarSign className="h-3.5 w-3.5 text-blue-400" />
                    </span>
                    <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">이번 달 지출</span>
                  </div>
                  <div className="text-xl font-bold text-white leading-tight">
                    {stats.monthlySpending > 0 ? `₩${stats.monthlySpending.toLocaleString("ko-KR")}` : "—"}
                  </div>
                  {stats.monthlySpending > 0 ? (
                    <div className={`flex items-center text-[11px] font-medium w-fit px-1.5 py-0.5 rounded ${
                      stats.monthOverMonthChange >= 0
                        ? "text-red-400 bg-red-900/20"
                        : "text-emerald-400 bg-emerald-900/20"
                    }`}>
                      {stats.monthOverMonthChange >= 0 ? "▲" : "▼"} {Math.abs(stats.monthOverMonthChange).toFixed(1)}% 전월 대비
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-300 leading-tight">{getSpendingInsight()}</p>
                  )}
                </CardContent>
              </Card>
            </Link>
            <Link href="/dashboard/quotes?status=PENDING">
              <Card className={`overflow-hidden cursor-pointer transition-all hover:shadow-md bg-[#1A2332] border-white/[0.08] shadow-sm rounded-xl ${riskBorder(quoteRisk)}`}>
                <CardContent className="p-4 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className="flex items-center justify-center w-6 h-6 rounded-lg" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
                      <FileText className="h-3.5 w-3.5 text-violet-400" />
                    </span>
                    <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">진행 중 견적</span>
                  </div>
                  <div className="text-2xl font-bold text-white">{stats.activeQuotes}</div>
                  <p className="text-[11px] text-slate-300 leading-tight">{getQuoteInsight()}</p>
                  {stats.opsFunnel.totalQuotes > 0 && (
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {"견적 "}{stats.opsFunnel.totalQuotes}
                      {" -> 발주 "}{stats.opsFunnel.purchasedQuotes}
                      {" -> 입고 "}{stats.opsFunnel.confirmedOrders}
                      {" -> 완료 "}{stats.opsFunnel.completedReceiving}
                      {stats.opsFunnel.stallPoint !== "none" && (
                        <span className="text-orange-500 ml-1">
                          ({OPS_STALL_LABELS[stats.opsFunnel.stallPoint as keyof typeof OPS_STALL_LABELS]})
                        </span>
                      )}
                    </p>
                  )}
                </CardContent>
              </Card>
            </Link>
          </div>

          {/* 최근 처리 이력 */}
          <Card className="overflow-hidden bg-[#1A2332] border-white/[0.08] shadow-sm rounded-xl">
            <CardHeader className="p-4 pb-2">
              <div className="flex justify-between items-center">
                <CardTitle className="text-sm font-semibold text-white">최근 처리 이력</CardTitle>
                <Link href="/dashboard/purchases" className="flex items-center text-xs text-slate-500 hover:text-slate-100 font-medium transition-colors">
                  전체 보기 <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {stats.recentPurchases.length === 0 ? (
                <div className="flex items-center gap-3 py-4 text-center justify-center">
                  <Package className="h-5 w-5 text-slate-500" />
                  <p className="text-sm text-slate-300">아직 처리된 운영 이력이 없습니다</p>
                </div>
              ) : (
                <div className="space-y-0 divide-y divide-bd/50">
                  {stats.recentPurchases.slice(0, 5).map((p, i) => (
                    <div key={p.id || `p-${i}`} className="flex items-center gap-3 py-2.5 first:pt-1">
                      <Beaker className="h-4 w-4 text-blue-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-100 truncate">{p.itemName || "품목명 미등록"}</p>
                        <p className="text-[11px] text-slate-400">{p.vendorName || "공급사 미지정"} · {formatPurchaseDate(p.purchasedAt)}</p>
                      </div>
                      <span className="text-sm font-semibold text-slate-300 flex-shrink-0">
                        {p.amount ? `₩${p.amount.toLocaleString("ko-KR")}` : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 지출 추이 */}
          {stats.monthlySpendingChart.length > 1 && (
            <Card className="overflow-hidden bg-[#1A2332] border-white/[0.08] shadow-sm rounded-xl">
              <CardHeader className="p-4 pb-2">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-sm font-semibold text-white">월별 지출 추이</CardTitle>
                  <Link href="/dashboard/analytics" className="flex items-center text-xs text-slate-500 hover:text-slate-100 font-medium transition-colors">
                    상세 분석 <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="h-[180px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats.monthlySpendingChart} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 11, fill: "#8A99AF" }}
                        axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: "#8A99AF" }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v: number) => v >= 1000000 ? `${(v / 1000000).toFixed(0)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#1a1f2e",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: "8px",
                          fontSize: "12px",
                          color: "#e2e8f0",
                        }}
                        formatter={(value: number) => [`₩${value.toLocaleString("ko-KR")}`, "지출"]}
                        labelStyle={{ color: "#94a3b8", fontSize: "11px" }}
                      />
                      <Area
                        type="monotone"
                        dataKey="amount"
                        stroke="#3b82f6"
                        strokeWidth={2.5}
                        fill="url(#colorAmount)"
                        dot={{ r: 3, fill: "#3b82f6", strokeWidth: 0 }}
                        activeDot={{ r: 5, fill: "#3b82f6", stroke: "#1e3a5f", strokeWidth: 2 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* -- 우측 운영 패널 (2col) -- */}
        <div className="md:col-span-2 space-y-4">

          {/* 즉시 처리 + 추천 작업 */}
          <Card className="bg-[#1A2332] border-white/[0.08] shadow-sm rounded-xl">
            <CardContent className="p-4 space-y-4">
              {/* 즉시 처리 */}
              {urgentItems.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider">즉시 처리</p>
                  <div className="space-y-1">
                    {urgentItems.map((item) => (
                      <Link key={item.id} href={item.href} className={`flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-white/[0.04] transition-colors group ${item.severity === "red" ? "border-l-2 border-l-red-500" : "border-l-2 border-l-amber-500"}`}>
                        {item.icon}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-white">{item.label}</p>
                          <p className="text-[10px] text-slate-300">{item.desc}</p>
                        </div>
                        <ChevronRight className="h-3.5 w-3.5 text-slate-500 flex-shrink-0 group-hover:text-slate-300 transition-colors" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* 상태 기반 추천 */}
              <div className="space-y-2">
                {urgentItems.length > 0 && <div className="border-t border-bd" />}
                <p className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider">다음 작업</p>
                <div className="space-y-0.5">
                  {recommendedActions.map((action) => (
                    <Link key={action.id} href={action.href} className="flex items-center gap-2.5 px-2 py-2.5 rounded-lg hover:bg-white/[0.04] transition-colors group">
                      {action.icon}
                      <div className="flex-1 min-w-0">
                        <span className={`block text-sm font-medium ${action.state === "blocked" ? "text-slate-400" : action.state === "ready" ? "text-white" : "text-slate-300"}`}>{action.label}</span>
                        <span className="block text-[11px] text-slate-400 leading-snug">{action.desc}</span>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-slate-500 flex-shrink-0 group-hover:text-slate-300 transition-colors" />
                    </Link>
                  ))}
                </div>
                {/* 보조 기능 */}
                <div className="pt-2 border-t border-bd space-y-0.5">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-2 pb-1">보조 기능</p>
                  <Link href="/dashboard/inventory" className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-white/[0.04] transition-colors group">
                    <Package className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                    <span className="text-sm text-slate-400 group-hover:text-slate-200">재고 관리</span>
                    <ChevronRight className="h-3 w-3 text-slate-500 ml-auto group-hover:text-slate-300 transition-colors" />
                  </Link>
                  <Link href="/dashboard/inventory" className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-white/[0.04] transition-colors group">
                    <TrendingDown className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                    <span className="text-sm text-slate-400 group-hover:text-slate-200">재고 차감</span>
                    <ChevronRight className="h-3 w-3 text-slate-500 ml-auto group-hover:text-slate-300 transition-colors" />
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 최근 알림 */}
          <Card className="bg-[#1A2332] border-white/[0.08] shadow-sm rounded-xl">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm font-semibold">최근 알림</CardTitle>
                <Link href="/dashboard/notifications"><Button variant="ghost" size="sm" className="text-[11px] h-6 px-2">모두 보기</Button></Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-1.5 pt-0">
              {notifications.map((n) => (
                <Link key={n.id} href={n.href} className={`flex items-start gap-2.5 p-2.5 rounded-lg transition-colors group ${n.unread ? "bg-el/50 hover:bg-el/70" : "hover:bg-el"}`}>
                  {renderNotificationIcon(n.type)}
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <p className="font-medium text-xs text-white truncate">{n.title}</p>
                      {n.unread && <Badge variant="default" className="h-3.5 px-1 text-[9px] bg-blue-600 flex-shrink-0">새</Badge>}
                    </div>
                    <p className="text-[11px] text-slate-300 line-clamp-1">{n.content}</p>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-slate-500 flex-shrink-0 mt-1 group-hover:text-slate-300 transition-colors" />
                </Link>
              ))}
            </CardContent>
          </Card>

          {/* 견적 처리 현황 */}
          <Card className="bg-[#1A2332] border-white/[0.08] shadow-sm rounded-xl">
            <CardHeader className="pb-2 p-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-white">견적 처리 현황</CardTitle>
                <Link href="/dashboard/quotes"><Button variant="ghost" size="sm" className="text-[11px] h-6 px-2">전체 보기</Button></Link>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-2">
              <Link href="/dashboard/quotes?status=RESPONDED" className="flex items-center gap-3 p-2.5 rounded-lg border border-green-900/40 bg-green-950/20 hover:bg-green-950/40 transition-colors group">
                <CheckCircle2 className="h-4 w-4 text-green-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white">응답 수신</p>
                  <p className="text-[10px] text-slate-300">
                    {stats.respondedQuotes > 0 ? `${stats.respondedQuotes}건 -- 검토 후 벤더 확정하세요` : "대기 중인 응답 없음"}
                  </p>
                </div>
                <span className={`text-sm font-bold flex-shrink-0 ${stats.respondedQuotes > 0 ? "text-green-400" : "text-slate-400"}`}>
                  {stats.respondedQuotes}
                </span>
              </Link>

              <Link href="/dashboard/quotes?status=PENDING" className="flex items-center gap-3 p-2.5 rounded-lg border border-bd hover:bg-white/[0.04] transition-colors group">
                <Clock className="h-4 w-4 text-amber-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white">응답 대기</p>
                  <p className="text-[10px] text-slate-300">
                    {stats.activeQuotes > 0 ? `${stats.activeQuotes}건 공급사 응답 대기 중` : "대기 중인 견적 없음"}
                  </p>
                </div>
                <span className={`text-sm font-bold flex-shrink-0 ${stats.activeQuotes > 0 ? "text-amber-400" : "text-slate-400"}`}>
                  {stats.activeQuotes}
                </span>
              </Link>

            </CardContent>
          </Card>

          {/* 부족 재고 목록 (조건부) */}
          {stats.lowStockItems.length > 0 && (
            <Card className="bg-[#1A2332] border-white/[0.08] shadow-sm rounded-xl border-l-2 border-l-red-500">
              <CardHeader className="pb-1 p-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs font-semibold text-red-400 flex items-center gap-1.5 uppercase tracking-wider">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    부족 재고 ({stats.lowStockItems.length})
                  </CardTitle>
                  <Link href="/dashboard/inventory?filter=low"><Button variant="ghost" size="sm" className="text-[11px] h-6 px-2 text-red-400">발주 검토</Button></Link>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-1.5">
                {stats.lowStockItems.slice(0, 3).map((item) => (
                  <div key={item.id} className="flex items-center justify-between py-1.5 border-b border-bd/30 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-100 truncate">{item.productName}</p>
                      <p className="text-[10px] text-red-400">{item.currentQuantity}/{item.safetyStock} {item.unit}</p>
                    </div>
                    <span className="relative flex h-2 w-2 ml-2 flex-shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-red-600" />
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* 모바일 하단 고정 빠른 실행 바 */}
      <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-sh/95 backdrop-blur-sm border-t border-bd px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Link href="/app/search" className="flex-1">
            <Button variant="outline" size="sm" className="w-full h-11 text-xs gap-1.5 bg-pg border-bd text-slate-300 hover:bg-el">
              <Search className="h-3.5 w-3.5" />
              시약 검색
            </Button>
          </Link>
          <Link href="/dashboard/inventory" className="flex-1">
            <Button variant="outline" size="sm" className="w-full h-11 text-xs gap-1.5 border-bd text-slate-300 hover:bg-el">
              <Plus className="h-3.5 w-3.5" />
              재고 등록
            </Button>
          </Link>
          <Link href="/app/quote" className="flex-1">
            <Button size="sm" className="w-full h-11 text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
              <FileText className="h-3.5 w-3.5" />
              견적 요청
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
