"use client";

import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Package, AlertTriangle, DollarSign, FileText, Search, Plus,
  TrendingUp, TrendingDown, Truck, ChevronRight, Beaker, Calendar, GitCompare,
  CheckCircle2, Clock,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { getGuestKey } from "@/lib/guest-key";
import { WorkQueueInbox } from "@/components/dashboard/work-queue-inbox";
import { COMPARE_SUBSTATUS_DEFS, RESOLUTION_PATH_LABELS, HANDOFF_STALL_LABELS } from "@/lib/work-queue/compare-queue-semantics";
import { OPS_STALL_LABELS } from "@/lib/work-queue/ops-queue-semantics";

// ── Summary Strip Stat ──
function StripStat({ label, count, warn, href }: {
  label: string; count: number | string; warn?: boolean; href?: string;
}) {
  const inner = (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-sm font-semibold tabular-nums ${warn ? "text-red-400" : "text-foreground"}`}>
        {typeof count === "number" ? count.toLocaleString("ko-KR") : count}
      </span>
    </div>
  );
  if (href) return <Link href={href} className="hover:underline underline-offset-2">{inner}</Link>;
  return inner;
}

// ── Section Header ──
function SectionHeader({ title, count, href }: { title: string; count?: number; href?: string }) {
  return (
    <div className="flex items-center justify-between border-b pb-2">
      <div className="flex items-center gap-2">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</h3>
        {count !== undefined && count > 0 && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{count}</Badge>
        )}
      </div>
      {href && (
        <Link href={href} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5">
          전체 보기 <ChevronRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}

// ── Action Row (priority action list item) ──
function ActionRow({ icon, title, subtitle, href, warn }: {
  icon: React.ReactNode; title: string; subtitle: string; href: string; warn?: boolean;
}) {
  return (
    <Link href={href} className="flex items-center gap-3 px-3 py-2 border-b last:border-b-0 hover:bg-muted/30 transition-colors group">
      <div className="flex-shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${warn ? "text-red-400" : "text-foreground"}`}>{title}</p>
        <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
      </div>
      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 flex-shrink-0 group-hover:text-foreground transition-colors" />
    </Link>
  );
}

// ── Purchase Row ──
function PurchaseRow({ name, vendor, date, amount }: {
  name: string; vendor: string; date: string; amount: number | null;
}) {
  const d = new Date(date);
  const dateStr = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  return (
    <div className="flex items-center gap-3 px-3 py-2 border-b last:border-b-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{name || "품목명 미등록"}</p>
        <p className="text-xs text-muted-foreground">{vendor || "공급사 미지정"} · {dateStr}</p>
      </div>
      <span className="text-xs font-semibold text-foreground tabular-nums flex-shrink-0">
        {amount ? `₩${amount.toLocaleString("ko-KR")}` : "—"}
      </span>
    </div>
  );
}

// ── Shortcut Row ──
function ShortcutRow({ icon, title, subtitle, href }: {
  icon: React.ReactNode; title: string; subtitle: string; href: string;
}) {
  return (
    <Link href={href} className="flex items-center gap-2.5 px-2 py-2 hover:bg-muted/30 transition-colors group">
      <div className="flex-shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <span className="block text-sm font-medium text-foreground">{title}</span>
        <span className="block text-xs text-muted-foreground">{subtitle}</span>
      </div>
      <ChevronRight className="h-3 w-3 text-muted-foreground/50 flex-shrink-0 group-hover:text-foreground transition-colors" />
    </Link>
  );
}

export default function DashboardPage() {
  const { data: session, status } = useSession();

  const { data: dashboardStats, isLoading: statsLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const guestKey = getGuestKey();
      const headers: Record<string, string> = {};
      if (guestKey) headers["x-guest-key"] = guestKey;
      const response = await fetch("/api/dashboard/stats", { headers });
      if (!response.ok) throw new Error("Failed to fetch dashboard stats");
      return response.json();
    },
    enabled: status === "authenticated",
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  if (status === "loading" || statsLoading) {
    return (
      <div className="p-4 pt-4 md:p-8 md:pt-6 space-y-4">
        <div className="h-5 w-48 rounded bg-muted animate-pulse" />
        <div className="h-10 rounded-md bg-muted animate-pulse" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 rounded-md bg-muted animate-pulse" />
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
    expiringCount: rawStats.expiringCount ?? 0,
    lowStockItems: (rawStats.lowStockItems ?? []) as Array<{
      id: string; productName: string; catalogNumber?: string;
      currentQuantity: number; safetyStock: number; unit: string;
    }>,
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

  const hasActionItems = stats.lowStockAlerts > 0 || stats.activeQuotes > 0 || stats.expiringCount > 0 || stats.undecidedCompareCount > 0;

  // ── Build action items (urgent first) ──
  const actionItems: Array<{ icon: React.ReactNode; title: string; subtitle: string; href: string; warn?: boolean }> = [];

  if (stats.lowStockAlerts > 0) {
    actionItems.push({
      icon: <AlertTriangle className="h-4 w-4 text-red-400" />,
      title: `재고 부족 ${stats.lowStockAlerts}건 — 발주 검토 필요`,
      subtitle: stats.lowStockAlerts >= 3 ? "즉시 발주 검토가 필요합니다" : "해당 품목의 발주를 검토하세요",
      href: "/dashboard/inventory?filter=low",
      warn: true,
    });
  }

  if (stats.undecidedCompareCount > 0) {
    const sla = stats.compareStats.slaBreachedCount;
    actionItems.push({
      icon: <GitCompare className={`h-4 w-4 ${sla > 0 ? "text-red-400" : "text-purple-400"}`} />,
      title: sla > 0
        ? `비교 판정 대기 ${stats.undecidedCompareCount}건 (SLA 초과 ${sla}건)`
        : `비교 판정 대기 ${stats.undecidedCompareCount}건`,
      subtitle: sla > 0 ? "즉시 처리 필요" : "비교 결과를 검토하고 판정하세요",
      href: "/compare",
      warn: sla > 0,
    });
  }

  if (stats.activeQuotes > 0) {
    actionItems.push({
      icon: <FileText className="h-4 w-4 text-blue-400" />,
      title: `견적 ${stats.activeQuotes}건 검토 대기`,
      subtitle: stats.respondedQuotes > 0 ? `${stats.respondedQuotes}건 응답 수신 — 검토 필요` : "공급사 응답 대기 중",
      href: "/dashboard/quotes?status=PENDING",
    });
  }

  if (stats.expiringCount > 0) {
    actionItems.push({
      icon: <Calendar className="h-4 w-4 text-amber-400" />,
      title: `유통기한 임박 ${stats.expiringCount}건`,
      subtitle: "30일 이내 만료 예정",
      href: "/dashboard/inventory",
    });
  }

  return (
    <div className="p-4 pt-4 md:p-8 md:pt-6 space-y-4 md:space-y-5 overflow-x-hidden">

      {/* ═══ Page Header ═══ */}
      <div className="flex items-center justify-between min-w-0">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">대시보드</h2>
          <p className="text-xs text-muted-foreground">
            {session?.user?.name ? `${session.user.name}님` : ""}
          </p>
        </div>
        {hasActionItems && (
          <Link href="/dashboard/work-queue">
            <Badge variant="destructive" className="text-xs px-2.5 py-0.5">
              처리 필요 {actionItems.length}건
            </Badge>
          </Link>
        )}
      </div>

      {/* ═══ Context Strip ═══ */}
      <div className={`flex flex-wrap items-center gap-4 border rounded-md px-3 py-2 ${hasActionItems ? "border-l-[3px] border-l-red-500" : "border-l-[3px] border-l-emerald-500"}`}>
        <StripStat label="등록 품목" count={stats.totalInventory} href="/dashboard/inventory" />
        <StripStat label="재고 부족" count={stats.lowStockAlerts} warn={stats.lowStockAlerts > 0} href="/dashboard/inventory?filter=low" />
        <StripStat label="이번 달 지출" count={stats.monthlySpending > 0 ? `₩${stats.monthlySpending.toLocaleString("ko-KR")}` : "—"} href="/dashboard/purchases" />
        <StripStat label="진행 중 견적" count={stats.activeQuotes} href="/dashboard/quotes?status=PENDING" />
        {stats.undecidedCompareCount > 0 && (
          <StripStat label="비교 판정 대기" count={stats.undecidedCompareCount} warn={stats.compareStats.slaBreachedCount > 0} href="/compare" />
        )}
        {stats.monthlySpending > 0 && (
          <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
            {stats.monthOverMonthChange >= 0
              ? <><TrendingUp className="h-3 w-3 text-red-500" /> <span className="text-red-400 font-medium">▲{Math.abs(stats.monthOverMonthChange).toFixed(1)}%</span></>
              : <><TrendingDown className="h-3 w-3 text-emerald-500" /> <span className="text-emerald-400 font-medium">▼{Math.abs(stats.monthOverMonthChange).toFixed(1)}%</span></>
            }
            <span>전월 대비</span>
          </div>
        )}
      </div>

      {/* ═══ AI Work Queue Inbox ═══ */}
      <WorkQueueInbox />

      {/* ═══ Urgent Actions ═══ */}
      {actionItems.length > 0 && (
        <div className="space-y-0">
          <SectionHeader title="오늘의 우선 작업" count={actionItems.length} href="/dashboard/work-queue" />
          <div className="bg-card border border-t-0 rounded-b-md">
            {actionItems.map((item, i) => (
              <ActionRow key={i} icon={item.icon} title={item.title} subtitle={item.subtitle} href={item.href} warn={item.warn} />
            ))}
          </div>
        </div>
      )}
      {!hasActionItems && (
        <div className="border rounded-md px-3 py-2">
          <p className="text-sm text-muted-foreground">현재 즉시 처리가 필요한 항목이 없습니다.</p>
        </div>
      )}

      {/* ═══ Desktop: 2-column layout ═══ */}
      <div className="hidden md:grid md:grid-cols-7 md:gap-5">

        {/* ── Left column (5col) ── */}
        <div className="md:col-span-5 space-y-5">

          {/* Compare Substatus Breakdown */}
          {stats.undecidedCompareCount > 0 && (
            <div className="space-y-0">
              <SectionHeader title="비교 판정 현황" href="/compare" />
              <div className="bg-card border border-t-0 rounded-b-md px-3 py-2 space-y-1">
                {Object.keys(stats.compareStats.substatusBreakdown).length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {Object.entries(stats.compareStats.substatusBreakdown)
                      .filter(([, count]) => count > 0)
                      .map(([key, count]) => `${COMPARE_SUBSTATUS_DEFS[key]?.label ?? key} ${count}`)
                      .join(" · ")}
                  </p>
                )}
                {stats.compareStats.compareToQuoteCount > 0 && (
                  <p className="text-xs text-muted-foreground tabular-nums">
                    견적 {stats.compareStats.compareToQuoteCount}
                    {" → 발주 "}{stats.compareStats.quoteToPurchaseCount}
                    {" → 입고 "}{stats.compareStats.purchaseToReceivingCount}
                    {" → 완료 "}{stats.compareStats.receivingToInventoryCount}
                    {stats.compareStats.handoffStallPoint !== "none" && (
                      <span className="text-orange-500 ml-1">
                        ({HANDOFF_STALL_LABELS[stats.compareStats.handoffStallPoint as keyof typeof HANDOFF_STALL_LABELS]})
                      </span>
                    )}
                  </p>
                )}
                {stats.compareStats.noMovementCount > 0 && (
                  <p className="text-xs text-orange-400 font-medium">다음 단계 없음 {stats.compareStats.noMovementCount}건</p>
                )}
              </div>
            </div>
          )}

          {/* Recent Purchases */}
          <div className="space-y-0">
            <SectionHeader title="최근 구매 내역" href="/dashboard/purchases" />
            <div className="bg-card border border-t-0 rounded-b-md">
              {stats.recentPurchases.length === 0 ? (
                <div className="flex items-center gap-3 px-3 py-6 justify-center">
                  <Package className="h-4 w-4 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">구매 내역을 등록하면 여기에 표시됩니다.</p>
                </div>
              ) : (
                stats.recentPurchases.slice(0, 5).map((p, i) => (
                  <PurchaseRow key={p.id || `p-${i}`} name={p.itemName || ""} vendor={p.vendorName || ""} date={p.purchasedAt} amount={p.amount} />
                ))
              )}
            </div>
          </div>

          {/* Ops Funnel */}
          {stats.opsFunnel.totalQuotes > 0 && (
            <div className="space-y-0">
              <SectionHeader title="운영 퍼널" />
              <div className="bg-card border border-t-0 rounded-b-md px-3 py-2">
                <p className="text-xs text-muted-foreground tabular-nums">
                  견적 {stats.opsFunnel.totalQuotes}
                  {" → 발주 "}{stats.opsFunnel.purchasedQuotes}
                  {" → 입고 "}{stats.opsFunnel.confirmedOrders}
                  {" → 완료 "}{stats.opsFunnel.completedReceiving}
                  {stats.opsFunnel.stallPoint !== "none" && (
                    <span className="text-orange-500 ml-1">
                      ({OPS_STALL_LABELS[stats.opsFunnel.stallPoint as keyof typeof OPS_STALL_LABELS]})
                    </span>
                  )}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── Right column (2col) ── */}
        <div className="md:col-span-2 space-y-5">

          {/* Shortcuts */}
          <div className="space-y-0">
            <SectionHeader title="업무 바로가기" />
            <div className="bg-card border border-t-0 rounded-b-md divide-y">
              <ShortcutRow icon={<Search className="h-3.5 w-3.5 text-muted-foreground" />} title="시약·장비 검색" subtitle="500만+ 품목" href="/test/search" />
              <ShortcutRow icon={<GitCompare className="h-3.5 w-3.5 text-muted-foreground" />} title="제품 비교" subtitle="스펙·가격 비교" href="/test/compare" />
              <ShortcutRow icon={<TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />} title="견적 요청" subtitle="공급사에 견적 발송" href="/test/quote" />
              <ShortcutRow icon={<Plus className="h-3.5 w-3.5 text-muted-foreground" />} title="재고 등록" subtitle="입고 품목 등록" href="/dashboard/inventory" />
              <ShortcutRow icon={<TrendingDown className="h-3.5 w-3.5 text-muted-foreground" />} title="재고 차감" subtitle="출고·사용 기록" href="/dashboard/inventory" />
            </div>
          </div>

          {/* Quote Status */}
          <div className="space-y-0">
            <SectionHeader title="견적 처리 현황" href="/dashboard/quotes" />
            <div className="bg-card border border-t-0 rounded-b-md divide-y">
              <Link href="/dashboard/quotes?status=RESPONDED" className="flex items-center gap-3 px-3 py-2 hover:bg-muted/30 transition-colors">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                <span className="text-xs text-foreground flex-1">응답 수신</span>
                <span className={`text-sm font-semibold tabular-nums flex-shrink-0 ${stats.respondedQuotes > 0 ? "text-emerald-400" : "text-muted-foreground"}`}>
                  {stats.respondedQuotes}
                </span>
              </Link>
              <Link href="/dashboard/quotes?status=PENDING" className="flex items-center gap-3 px-3 py-2 hover:bg-muted/30 transition-colors">
                <Clock className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                <span className="text-xs text-foreground flex-1">응답 대기</span>
                <span className={`text-sm font-semibold tabular-nums flex-shrink-0 ${stats.activeQuotes > 0 ? "text-amber-400" : "text-muted-foreground"}`}>
                  {stats.activeQuotes}
                </span>
              </Link>
              <Link href="/dashboard/analytics" className="flex items-center gap-3 px-3 py-2 hover:bg-muted/30 transition-colors">
                <TrendingUp className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                <span className="text-xs text-muted-foreground flex-1">지출 분석 상세</span>
                <ChevronRight className="h-3 w-3 text-muted-foreground/50 flex-shrink-0" />
              </Link>
            </div>
          </div>

          {/* Low Stock Items */}
          {stats.lowStockItems.length > 0 && (
            <div className="space-y-0">
              <SectionHeader title={`부족 재고 (${stats.lowStockItems.length})`} href="/dashboard/inventory?filter=low" />
              <div className="bg-card border border-t-0 rounded-b-md divide-y">
                {stats.lowStockItems.slice(0, 3).map((item) => (
                  <div key={item.id} className="flex items-center justify-between px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{item.productName}</p>
                      <p className="text-xs text-red-400">{item.currentQuantity}/{item.safetyStock} {item.unit}</p>
                    </div>
                    <span className="inline-flex h-2 w-2 rounded-full bg-red-500 flex-shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ Mobile Layout ═══ */}
      <div className="md:hidden space-y-3 pb-20">

        {/* KPI Strip (mobile) */}
        <div className="grid grid-cols-2 gap-2">
          <Link href="/dashboard/inventory" className="border rounded-md px-3 py-2">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">등록 품목</span>
            <p className="text-xl font-bold text-foreground tabular-nums">{stats.totalInventory.toLocaleString("ko-KR")}</p>
          </Link>
          <Link href="/dashboard/inventory?filter=low" className={`border rounded-md px-3 py-2 ${stats.lowStockAlerts > 0 ? "border-l-2 border-l-red-500" : ""}`}>
            <span className="text-xs text-red-400 uppercase tracking-wider">재고 부족</span>
            <p className="text-xl font-bold text-red-400 tabular-nums">{stats.lowStockAlerts}</p>
          </Link>
          <Link href="/dashboard/purchases" className="border rounded-md px-3 py-2">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">이번 달 지출</span>
            <p className="text-lg font-bold text-foreground tabular-nums leading-tight">
              {stats.monthlySpending > 0 ? `₩${stats.monthlySpending.toLocaleString("ko-KR")}` : "—"}
            </p>
          </Link>
          <Link href="/dashboard/quotes?status=PENDING" className="border rounded-md px-3 py-2">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">진행 중 견적</span>
            <p className="text-xl font-bold text-foreground tabular-nums">{stats.activeQuotes}</p>
          </Link>
        </div>

        {/* Quick Actions (mobile) */}
        <div className="space-y-0">
          <SectionHeader title="빠른 실행" />
          <div className="bg-card border border-t-0 rounded-b-md grid grid-cols-2 gap-0.5 p-1.5">
            <Link href="/test/search">
              <Button variant="outline" className="w-full h-9 justify-start text-xs gap-1.5">
                <Search className="h-3.5 w-3.5" />시약 검색
              </Button>
            </Link>
            <Link href="/test/quote">
              <Button variant="outline" className="w-full h-9 justify-start text-xs gap-1.5">
                <FileText className="h-3.5 w-3.5" />견적 요청
              </Button>
            </Link>
          </div>
        </div>

        {/* Recent Purchases (mobile) */}
        {stats.recentPurchases.length > 0 && (
          <div className="space-y-0">
            <SectionHeader title="최근 구매" href="/dashboard/purchases" />
            <div className="bg-card border border-t-0 rounded-b-md">
              {stats.recentPurchases.slice(0, 3).map((p, i) => (
                <PurchaseRow key={p.id || `p-${i}`} name={p.itemName || ""} vendor={p.vendorName || ""} date={p.purchasedAt} amount={p.amount} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Mobile bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-background/95 backdrop-blur-sm border-t px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Link href="/test/search" className="flex-1">
            <Button variant="outline" size="sm" className="w-full h-10 text-xs gap-1.5">
              <Search className="h-3.5 w-3.5" />시약 검색
            </Button>
          </Link>
          <Link href="/dashboard/inventory" className="flex-1">
            <Button variant="outline" size="sm" className="w-full h-10 text-xs gap-1.5">
              <Plus className="h-3.5 w-3.5" />재고 등록
            </Button>
          </Link>
          <Link href="/test/quote" className="flex-1">
            <Button size="sm" className="w-full h-10 text-xs gap-1.5">
              <FileText className="h-3.5 w-3.5" />견적 요청
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
