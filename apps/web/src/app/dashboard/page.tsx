"use client";

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
import { Badge } from "@/components/ui/badge";
import { getGuestKey } from "@/lib/guest-key";
import { WorkQueueInbox } from "@/components/dashboard/work-queue-inbox";

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
    staleTime: 5 * 60 * 1000,    // 5분간 캐시 유지 (불필요한 refetch 제거)
    gcTime: 15 * 60 * 1000,      // 15분간 GC 방지
  });

  if (status === "loading" || statsLoading) {
    return (
      <div className="p-4 pt-4 md:p-8 md:pt-6 space-y-4">
        <div className="h-6 w-48 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
        <div className="h-[72px] rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-[100px] md:h-[120px] rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
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
  };

  const hasActionItems = stats.lowStockAlerts > 0 || stats.activeQuotes > 0 || stats.expiringCount > 0;
  const actionCount = (stats.lowStockAlerts > 0 ? 1 : 0) + (stats.activeQuotes > 0 ? 1 : 0) + (stats.expiringCount > 0 ? 1 : 0);

  // ── 알림 (심각도순 정렬) ──
  const notifications = [
    ...(stats.lowStockAlerts > 0
      ? [{ id: "n-low", type: "alert" as const, title: `재고 부족 ${stats.lowStockAlerts}건 — 발주 검토 필요`, content: "안전재고 이하 품목이 감지되었습니다.", time: "지금", unread: true, href: "/dashboard/inventory?filter=low" }]
      : []),
    ...(stats.activeQuotes > 0
      ? [{ id: "n-quote", type: "quote" as const, title: `견적 ${stats.activeQuotes}건 검토 대기`, content: stats.respondedQuotes > 0 ? `${stats.respondedQuotes}건 응답 수신, 검토가 필요합니다.` : "공급사 응답을 기다리고 있습니다.", time: "최근", unread: true, href: "/dashboard/quotes?status=PENDING" }]
      : []),
    ...(stats.expiringCount > 0
      ? [{ id: "n-exp", type: "alert" as const, title: `유통기한 임박 ${stats.expiringCount}건`, content: "30일 이내 만료 예정 품목이 있습니다.", time: "최근", unread: true, href: "/dashboard/inventory" }]
      : []),
    { id: "n-delivery", type: "delivery" as const, title: "최근 입고 처리 완료", content: "등록된 입고 내역을 확인할 수 있습니다.", time: "최근", unread: false, href: "/dashboard/purchases" },
  ].slice(0, 4);

  const renderNotificationIcon = (type: string) => {
    switch (type) {
      case "alert":
        return <div className="flex-shrink-0 rounded-md bg-red-100 dark:bg-red-950/40 p-2"><AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" /></div>;
      case "quote":
        return <div className="flex-shrink-0 rounded-md bg-blue-100 dark:bg-blue-950/40 p-2"><FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" /></div>;
      case "delivery":
        return <div className="flex-shrink-0 rounded-md bg-green-100 dark:bg-green-950/40 p-2"><Truck className="h-4 w-4 text-green-600 dark:text-green-400" /></div>;
      default:
        return null;
    }
  };

  const formatPurchaseDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  };

  // ── KPI 해석 문구 ──
  const getInventoryInsight = () => {
    if (stats.totalInventory === 0) return "품목을 등록하면 현황이 표시됩니다";
    if (stats.lowStockAlerts > 0) return `${stats.lowStockAlerts}개 품목 부족 — 점검 필요`;
    return "전체 품목 정상 운영 중";
  };

  const getStockInsight = () => {
    if (stats.lowStockAlerts === 0) return "현재 모든 품목 정상 수준";
    if (stats.lowStockAlerts >= 3) return "즉시 발주 검토가 필요합니다";
    return "해당 품목의 발주를 검토하세요";
  };

  const getSpendingInsight = () => {
    const change = stats.monthOverMonthChange;
    if (stats.monthlySpending === 0) return "이번 달 지출 내역 없음";
    if (change > 10) return `전월 대비 ${change.toFixed(0)}% 증가 — 확인 필요`;
    if (change < -10) return `전월 대비 ${Math.abs(change).toFixed(0)}% 절감`;
    return "전월과 유사한 지출 수준";
  };

  const getQuoteInsight = () => {
    if (stats.activeQuotes === 0) return "현재 진행 중인 견적 없음";
    if (stats.respondedQuotes > 0) return `${stats.respondedQuotes}건 응답 수신 — 검토 필요`;
    return "공급사 응답 대기 중";
  };

  return (
    <div className="p-4 pt-4 md:p-8 md:pt-6 space-y-4 md:space-y-5 overflow-x-hidden">

      {/* ═══ 페이지 헤더 (breadcrumb 제거) ═══ */}
      <div className="flex flex-col space-y-0.5 min-w-0">
        <h2 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          대시보드
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {session?.user?.name ? `${session.user.name}님, ` : ""}
          {hasActionItems ? `처리가 필요한 항목 ${actionCount}건이 있습니다.` : "현재 운영 상태가 양호합니다."}
        </p>
      </div>

      {/* ═══ AI 작업함: 운영형 에이전트 실행 큐 ═══ */}
      <WorkQueueInbox />

      {/* ═══ 1순위: 오늘의 우선 작업 ═══ */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800/50 bg-white dark:bg-[#161d2f] shadow-sm overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {hasActionItems ? (
              <>
                <span className="relative flex h-2 w-2 flex-shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
                </span>
                <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300">오늘의 우선 작업</h3>
              </>
            ) : (
              <>
                <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 flex-shrink-0" />
                <h3 className="text-xs font-semibold text-slate-600 dark:text-slate-400">운영 상태 정상</h3>
              </>
            )}
          </div>
          {hasActionItems && (
            <div className="flex items-center gap-2">
              {stats.activeQuotes > 0 && (
                <Link href="/dashboard/quotes?status=PENDING">
                  <Button variant="outline" size="sm" className="h-7 text-[11px] px-2.5 border-blue-200 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30">
                    견적 검토하기
                  </Button>
                </Link>
              )}
              {stats.lowStockAlerts > 0 && (
                <Link href="/dashboard/inventory?filter=low">
                  <Button variant="outline" size="sm" className="h-7 text-[11px] px-2.5 border-red-200 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30">
                    재고 확인하기
                  </Button>
                </Link>
              )}
            </div>
          )}
        </div>
        {hasActionItems ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/50 sm:divide-y-0 sm:grid sm:divide-x" style={{ gridTemplateColumns: `repeat(${actionCount}, 1fr)` }}>
            {stats.lowStockAlerts > 0 && (
              <Link href="/dashboard/inventory?filter=low" className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group">
                <div className="rounded-md bg-red-100 dark:bg-red-950/40 p-2 flex-shrink-0">
                  <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{stats.lowStockAlerts}건 재고 부족</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">즉시 발주 검토 필요</p>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-300 flex-shrink-0 group-hover:text-slate-500 transition-colors" />
              </Link>
            )}
            {stats.activeQuotes > 0 && (
              <Link href="/dashboard/quotes?status=PENDING" className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group">
                <div className="rounded-md bg-blue-100 dark:bg-blue-950/40 p-2 flex-shrink-0">
                  <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{stats.activeQuotes}건 견적 대기</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {stats.respondedQuotes > 0 ? `${stats.respondedQuotes}건 응답 수신 — 검토 필요` : "공급사 응답 대기 중"}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-300 flex-shrink-0 group-hover:text-slate-500 transition-colors" />
              </Link>
            )}
            {stats.expiringCount > 0 && (
              <Link href="/dashboard/inventory" className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group">
                <div className="rounded-md bg-amber-100 dark:bg-amber-950/40 p-2 flex-shrink-0">
                  <Calendar className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{stats.expiringCount}건 유통기한 임박</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">30일 이내 만료 예정</p>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-300 flex-shrink-0 group-hover:text-slate-500 transition-colors" />
              </Link>
            )}
          </div>
        ) : (
          <div className="px-4 py-3">
            <p className="text-sm text-slate-500 dark:text-slate-400">현재 즉시 처리가 필요한 항목이 없습니다. 아래 빠른 실행에서 업무를 시작하세요.</p>
          </div>
        )}
      </div>

      {/* ═══ 모바일 전용 레이아웃 ═══ */}
      <div className="md:hidden space-y-3 pb-20">

        {/* 2순위: KPI 카드 2×2 */}
        <div className="grid grid-cols-2 gap-3">
          <Link href="/dashboard/inventory">
            <Card className="overflow-hidden cursor-pointer transition-all hover:shadow-md border-slate-200 dark:border-slate-800/50 shadow-sm bg-white dark:bg-[#161d2f]">
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">등록 품목</span>
                  <div className="rounded-full p-1 bg-blue-50 dark:bg-blue-950/50"><Package className="h-3 w-3 text-blue-600 dark:text-blue-400" /></div>
                </div>
                <div className="text-2xl font-bold text-slate-900 dark:text-slate-200">{stats.totalInventory.toLocaleString("ko-KR")}</div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">{getInventoryInsight()}</p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/dashboard/inventory?filter=low">
            <Card className={`overflow-hidden cursor-pointer transition-all hover:shadow-md shadow-sm ${stats.lowStockAlerts > 0 ? "border-red-200 dark:border-red-900/50 bg-red-50/30 dark:bg-red-950/20" : "border-slate-200 dark:border-slate-800/50 bg-white dark:bg-[#161d2f]"}`}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider">재고 부족</span>
                  <div className="rounded-full p-1 bg-red-100 dark:bg-red-950/50"><AlertTriangle className="h-3 w-3 text-red-600 dark:text-red-400" /></div>
                </div>
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.lowStockAlerts}</div>
                <p className="text-[10px] text-red-500 dark:text-red-400 mt-0.5 leading-tight">{getStockInsight()}</p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/dashboard/purchases">
            <Card className="overflow-hidden cursor-pointer transition-all hover:shadow-md border-slate-200 dark:border-slate-800/50 shadow-sm bg-white dark:bg-[#161d2f]">
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">이번 달 지출</span>
                  <div className="rounded-full p-1 bg-emerald-50 dark:bg-emerald-900/20"><DollarSign className="h-3 w-3 text-emerald-600 dark:text-emerald-400" /></div>
                </div>
                <div className="text-lg font-bold text-slate-900 dark:text-slate-200 leading-tight">
                  {stats.monthlySpending > 0 ? `₩${stats.monthlySpending.toLocaleString("ko-KR")}` : "—"}
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">{getSpendingInsight()}</p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/dashboard/quotes?status=PENDING">
            <Card className="overflow-hidden cursor-pointer transition-all hover:shadow-md border-slate-200 dark:border-slate-800/50 shadow-sm bg-white dark:bg-[#161d2f]">
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">진행 중 견적</span>
                  <div className="rounded-full p-1 bg-violet-50 dark:bg-violet-950/50"><FileText className="h-3 w-3 text-violet-600 dark:text-violet-400" /></div>
                </div>
                <div className="text-2xl font-bold text-slate-900 dark:text-slate-200">{stats.activeQuotes}</div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">{getQuoteInsight()}</p>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* 3순위: 빠른 실행 */}
        <Card className="shadow-sm border-slate-200 dark:border-slate-800/50 bg-white dark:bg-[#161d2f]">
          <CardHeader className="pb-2 p-3">
            <CardTitle className="text-sm font-semibold">빠른 실행</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 grid grid-cols-2 gap-2">
            <Link href="/test/search" className="block">
              <Button variant="outline" className="w-full h-10 justify-start text-xs gap-2 bg-blue-50/50 border-blue-200 text-blue-700 dark:text-blue-400 dark:bg-blue-950/20 dark:border-blue-900/50 hover:bg-blue-50">
                <Search className="h-3.5 w-3.5 flex-shrink-0" />
                시약·장비 검색
              </Button>
            </Link>
            <Link href="/test/quote" className="block">
              <Button variant="outline" className="w-full h-10 justify-start text-xs gap-2 bg-blue-50/50 border-blue-200 text-blue-700 dark:text-blue-400 dark:bg-blue-950/20 dark:border-blue-900/50 hover:bg-blue-50">
                <FileText className="h-3.5 w-3.5 flex-shrink-0" />
                견적 요청하기
              </Button>
            </Link>
            <Link href="/dashboard/inventory" className="block">
              <Button variant="outline" className="w-full h-10 justify-start text-xs gap-2 bg-slate-50 border-slate-300 text-slate-700 hover:bg-slate-100">
                <TrendingDown className="h-3.5 w-3.5 flex-shrink-0" />
                재고 차감
              </Button>
            </Link>
            <Link href="/dashboard/inventory" className="block">
              <Button variant="outline" className="w-full h-10 justify-start text-xs gap-2 hover:bg-slate-50">
                <Plus className="h-3.5 w-3.5 flex-shrink-0" />
                재고 등록
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* 4순위: 최근 알림 */}
        <Card className="bg-white dark:bg-[#161d2f] border-slate-200 dark:border-slate-800/50 shadow-sm">
          <CardHeader className="pb-2 p-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">최근 알림</CardTitle>
              <Link href="/dashboard/notifications"><Button variant="ghost" size="sm" className="text-[11px] h-6 px-2">모두 보기</Button></Link>
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-0 space-y-1">
            {notifications.map((n) => (
              <Link key={n.id} href={n.href} className={`flex items-start gap-2.5 p-2 rounded-lg transition-colors ${n.unread ? "bg-blue-50/50 dark:bg-blue-950/30" : "hover:bg-slate-50 dark:hover:bg-slate-800"}`}>
                {renderNotificationIcon(n.type)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <p className="font-medium text-xs text-slate-900 dark:text-slate-100 truncate">{n.title}</p>
                    {n.unread && <Badge variant="default" className="h-3.5 px-1 text-[9px] bg-blue-600 flex-shrink-0">새</Badge>}
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1">{n.content}</p>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-slate-300 flex-shrink-0 mt-1" />
              </Link>
            ))}
          </CardContent>
        </Card>

        {/* 5순위: 최근 구매 (축소) */}
        {stats.recentPurchases.length > 0 && (
          <Card className="bg-white dark:bg-[#161d2f] border-slate-200 dark:border-slate-800/50 shadow-sm">
            <CardHeader className="pb-2 p-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">최근 구매</CardTitle>
                <Link href="/dashboard/purchases"><Button variant="ghost" size="sm" className="text-[11px] h-6 px-2">전체 보기</Button></Link>
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-0 space-y-2">
              {stats.recentPurchases.slice(0, 3).map((p, i) => (
                <div key={p.id || `p-${i}`} className="flex items-center gap-2.5 py-1.5 border-b border-slate-100 dark:border-slate-800/30 last:border-0">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
                    <Beaker className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">{p.itemName || "품목명 미등록"}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">{formatPurchaseDate(p.purchasedAt)}</p>
                  </div>
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex-shrink-0">
                    {p.amount ? `₩${p.amount.toLocaleString("ko-KR")}` : "—"}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {/* ═══ 데스크탑 레이아웃 ═══ */}
      <div className="hidden md:grid md:grid-cols-7 md:gap-5">

        {/* ── 좌측 메인 (5col) ── */}
        <div className="md:col-span-5 space-y-5">

          {/* 2순위: KPI 카드 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Link href="/dashboard/inventory">
              <Card className="h-[124px] flex flex-col justify-between overflow-hidden cursor-pointer transition-all hover:shadow-md border-slate-200/60 dark:border-slate-800/50 shadow-sm rounded-xl bg-white dark:bg-[#161d2f]">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 p-4">
                  <CardTitle className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">등록 품목</CardTitle>
                  <div className="rounded-full p-1.5 bg-blue-50 dark:bg-blue-950/50 flex-shrink-0"><Package className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" /></div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-2xl font-bold text-slate-900 dark:text-slate-200">{stats.totalInventory.toLocaleString("ko-KR")}</div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">{getInventoryInsight()}</p>
                </CardContent>
              </Card>
            </Link>
            <Link href="/dashboard/inventory?filter=low">
              <Card className={`h-[124px] flex flex-col justify-between overflow-hidden cursor-pointer transition-all hover:shadow-md shadow-sm rounded-xl ${stats.lowStockAlerts > 0 ? "border-red-200/60 dark:border-red-900/40 bg-red-50/20 dark:bg-red-950/20" : "border-slate-200/60 dark:border-slate-800/50 bg-white dark:bg-[#161d2f]"}`}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 p-4">
                  <CardTitle className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider">재고 부족</CardTitle>
                  <div className="rounded-full p-1.5 bg-red-100 dark:bg-red-950/50 flex-shrink-0"><AlertTriangle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" /></div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.lowStockAlerts}</div>
                  <p className="text-[11px] text-red-500 dark:text-red-400 mt-0.5 leading-tight">{getStockInsight()}</p>
                </CardContent>
              </Card>
            </Link>
            <Link href="/dashboard/purchases">
              <Card className="h-[124px] flex flex-col justify-between overflow-hidden cursor-pointer transition-all hover:shadow-md border-slate-200/60 dark:border-slate-800/50 shadow-sm rounded-xl bg-white dark:bg-[#161d2f]">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 p-4">
                  <CardTitle className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">이번 달 지출</CardTitle>
                  <div className="rounded-full p-1.5 bg-emerald-50 dark:bg-emerald-900/20 flex-shrink-0"><DollarSign className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /></div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-xl font-bold text-slate-900 dark:text-slate-200 leading-tight">
                    {stats.monthlySpending > 0 ? `₩${stats.monthlySpending.toLocaleString("ko-KR")}` : "—"}
                  </div>
                  {stats.monthlySpending > 0 && (
                    <div className={`flex items-center text-[11px] font-medium w-fit px-1.5 py-0.5 rounded mt-1 ${
                      stats.monthOverMonthChange >= 0
                        ? "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/20"
                        : "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/20"
                    }`}>
                      {stats.monthOverMonthChange >= 0 ? "▲" : "▼"} {Math.abs(stats.monthOverMonthChange).toFixed(1)}% 전월 대비
                    </div>
                  )}
                  {stats.monthlySpending === 0 && <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{getSpendingInsight()}</p>}
                </CardContent>
              </Card>
            </Link>
            <Link href="/dashboard/quotes?status=PENDING">
              <Card className="h-[124px] flex flex-col justify-between overflow-hidden cursor-pointer transition-all hover:shadow-md border-slate-200/60 dark:border-slate-800/50 shadow-sm rounded-xl bg-white dark:bg-[#161d2f]">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 p-4">
                  <CardTitle className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">진행 중 견적</CardTitle>
                  <div className="rounded-full p-1.5 bg-violet-50 dark:bg-violet-950/50 flex-shrink-0"><FileText className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" /></div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-2xl font-bold text-slate-900 dark:text-slate-200">{stats.activeQuotes}</div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">{getQuoteInsight()}</p>
                </CardContent>
              </Card>
            </Link>
          </div>

          {/* 5순위: 최근 구매 내역 (축소 — 최대 5건, 컴팩트) */}
          <Card className="overflow-hidden bg-white dark:bg-[#161d2f] border-slate-200/60 dark:border-slate-800/50 shadow-sm rounded-xl">
            <CardHeader className="p-4 pb-2">
              <div className="flex justify-between items-center">
                <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">최근 구매 내역</CardTitle>
                <Link href="/dashboard/purchases" className="flex items-center text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 font-medium transition-colors">
                  전체 보기 <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {stats.recentPurchases.length === 0 ? (
                <div className="flex items-center gap-3 py-4 text-center justify-center">
                  <Package className="h-5 w-5 text-slate-300 dark:text-slate-600" />
                  <p className="text-sm text-slate-500 dark:text-slate-400">구매 내역을 등록하면 여기에 표시됩니다.</p>
                </div>
              ) : (
                <div className="space-y-0 divide-y divide-slate-100 dark:divide-slate-800/50">
                  {stats.recentPurchases.slice(0, 5).map((p, i) => (
                    <div key={p.id || `p-${i}`} className="flex items-center gap-3 py-2.5 first:pt-1">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
                        <Beaker className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{p.itemName || "품목명 미등록"}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">{p.vendorName || "공급사 미지정"} · {formatPurchaseDate(p.purchasedAt)}</p>
                      </div>
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex-shrink-0">
                        {p.amount ? `₩${p.amount.toLocaleString("ko-KR")}` : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── 우측 패널 (2col) ── */}
        <div className="md:col-span-2 space-y-5">

          {/* 🎯 업무 바로가기 — 대시보드 공식 실행 영역 (최상단 고정) */}
          <Card className="bg-white dark:bg-[#161d2f] border-slate-200/60 dark:border-slate-800/50 shadow-sm rounded-xl">
            <CardHeader className="pb-2 p-4">
              <CardTitle className="text-sm font-semibold text-slate-900 dark:text-slate-100">업무 바로가기</CardTitle>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">검색 → 비교 → 견적 → 재고 등록</p>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {/* 메인 액션 흐름 */}
              <div className="space-y-0.5">
                <Link href="/test/search" className="flex items-center gap-2.5 px-2 py-2.5 rounded-lg hover:bg-blue-50/60 dark:hover:bg-blue-950/30 transition-colors group">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-50 dark:bg-blue-950/50 flex-shrink-0">
                    <Search className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-slate-800 dark:text-slate-200 group-hover:text-blue-700 dark:group-hover:text-blue-400">시약·장비 검색</span>
                    <span className="block text-[11px] text-slate-400 dark:text-slate-500">500만+ 품목 검색</span>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-slate-300 flex-shrink-0 group-hover:text-blue-400 transition-colors" />
                </Link>
                <Link href="/test/compare" className="flex items-center gap-2.5 px-2 py-2.5 rounded-lg hover:bg-indigo-50/60 dark:hover:bg-indigo-950/30 transition-colors group">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-50 dark:bg-indigo-950/50 flex-shrink-0">
                    <GitCompare className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-slate-800 dark:text-slate-200 group-hover:text-indigo-700 dark:group-hover:text-indigo-400">제품 비교</span>
                    <span className="block text-[11px] text-slate-400 dark:text-slate-500">스펙·가격 비교 목록</span>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-slate-300 flex-shrink-0 group-hover:text-indigo-400 transition-colors" />
                </Link>
                <Link href="/test/quote" className="flex items-center gap-2.5 px-2 py-2.5 rounded-lg hover:bg-violet-50/60 dark:hover:bg-violet-950/30 transition-colors group">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-violet-50 dark:bg-violet-950/50 flex-shrink-0">
                    <TrendingUp className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-slate-800 dark:text-slate-200 group-hover:text-violet-700 dark:group-hover:text-violet-400">견적 요청하기</span>
                    <span className="block text-[11px] text-slate-400 dark:text-slate-500">공급사에 견적 발송</span>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-slate-300 flex-shrink-0 group-hover:text-violet-400 transition-colors" />
                </Link>
                <Link href="/dashboard/inventory" className="flex items-center gap-2.5 px-2 py-2.5 rounded-lg hover:bg-emerald-50/60 dark:hover:bg-emerald-950/30 transition-colors group">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50 dark:bg-emerald-950/50 flex-shrink-0">
                    <Plus className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-slate-800 dark:text-slate-200 group-hover:text-emerald-700 dark:group-hover:text-emerald-400">재고 등록</span>
                    <span className="block text-[11px] text-slate-400 dark:text-slate-500">입고 품목 등록 및 관리</span>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-slate-300 flex-shrink-0 group-hover:text-emerald-400 transition-colors" />
                </Link>
                <Link href="/dashboard/inventory" className="flex items-center gap-2.5 px-2 py-2.5 rounded-lg hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors group">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 dark:bg-slate-800/50 flex-shrink-0">
                    <TrendingDown className="h-3.5 w-3.5 text-slate-600 dark:text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-slate-800 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-slate-100">재고 차감</span>
                    <span className="block text-[11px] text-slate-400 dark:text-slate-500">출고·사용 기록</span>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-slate-300 flex-shrink-0 group-hover:text-slate-500 transition-colors" />
                </Link>
              </div>
              {/* 보조 액션 */}
              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/50 space-y-0.5">
                <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-2 pb-1">보조 기능</p>
                {/* 프로토콜 BOM: PDF 분석 미완성으로 베타 기간 중 비노출 */}
                <Link href="/dashboard/inventory" className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group">
                  <Package className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                  <span className="text-sm text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-100">재고 관리</span>
                  <ChevronRight className="h-3 w-3 text-slate-300 ml-auto group-hover:text-slate-500 transition-colors" />
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* 최근 알림 (액션 연결) */}
          <Card className="bg-white dark:bg-[#161d2f] border-slate-200/60 dark:border-slate-800/50 shadow-sm rounded-xl">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm font-semibold">최근 알림</CardTitle>
                <Link href="/dashboard/notifications"><Button variant="ghost" size="sm" className="text-[11px] h-6 px-2">모두 보기</Button></Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-1.5 pt-0">
              {notifications.map((n) => (
                <Link key={n.id} href={n.href} className={`flex items-start gap-2.5 p-2.5 rounded-lg transition-colors group ${n.unread ? "bg-blue-50/50 dark:bg-blue-950/30 hover:bg-blue-50 dark:hover:bg-blue-950/50" : "hover:bg-slate-50 dark:hover:bg-slate-800"}`}>
                  {renderNotificationIcon(n.type)}
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <p className="font-medium text-xs text-slate-900 dark:text-slate-100 truncate">{n.title}</p>
                      {n.unread && <Badge variant="default" className="h-3.5 px-1 text-[9px] bg-blue-600 flex-shrink-0">새</Badge>}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">{n.content}</p>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-slate-300 flex-shrink-0 mt-1 group-hover:text-slate-500 transition-colors" />
                </Link>
              ))}
            </CardContent>
          </Card>

          {/* 견적 처리 현황 */}
          <Card className="bg-white dark:bg-[#161d2f] border-slate-200/60 dark:border-slate-800/50 shadow-sm rounded-xl">
            <CardHeader className="pb-2 p-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-slate-800 dark:text-slate-100">견적 처리 현황</CardTitle>
                <Link href="/dashboard/quotes"><Button variant="ghost" size="sm" className="text-[11px] h-6 px-2">전체 보기</Button></Link>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-2">
              {/* 응답 수신 — 즉시 검토 필요 */}
              <Link href="/dashboard/quotes?status=RESPONDED" className="flex items-center gap-3 p-2.5 rounded-lg border border-green-200/60 dark:border-green-900/40 bg-green-50/40 dark:bg-green-950/20 hover:bg-green-50 dark:hover:bg-green-950/40 transition-colors group">
                <div className="rounded-md bg-green-100 dark:bg-green-950/60 p-1.5 flex-shrink-0">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">응답 수신</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    {stats.respondedQuotes > 0 ? `${stats.respondedQuotes}건 — 검토 후 벤더 확정하세요` : "대기 중인 응답 없음"}
                  </p>
                </div>
                <span className={`text-sm font-bold flex-shrink-0 ${stats.respondedQuotes > 0 ? "text-green-600 dark:text-green-400" : "text-slate-400"}`}>
                  {stats.respondedQuotes}
                </span>
              </Link>

              {/* 응답 대기 */}
              <Link href="/dashboard/quotes?status=PENDING" className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-200/60 dark:border-slate-700/40 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group">
                <div className="rounded-md bg-amber-100 dark:bg-amber-950/40 p-1.5 flex-shrink-0">
                  <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">응답 대기</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    {stats.activeQuotes > 0 ? `${stats.activeQuotes}건 공급사 응답 대기 중` : "대기 중인 견적 없음"}
                  </p>
                </div>
                <span className={`text-sm font-bold flex-shrink-0 ${stats.activeQuotes > 0 ? "text-amber-500 dark:text-amber-400" : "text-slate-400"}`}>
                  {stats.activeQuotes}
                </span>
              </Link>

              {/* 지출 분석 바로가기 */}
              <Link href="/dashboard/analytics" className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-colors group">
                <TrendingUp className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                <span className="text-xs text-slate-600 dark:text-slate-400 group-hover:text-blue-700 dark:group-hover:text-blue-400">지출 분석 상세 보기</span>
                <ChevronRight className="h-3 w-3 text-slate-300 ml-auto group-hover:text-blue-400 transition-colors" />
              </Link>
            </CardContent>
          </Card>

          {/* 부족 재고 목록 (조건부) */}
          {stats.lowStockItems.length > 0 && (
            <Card className="bg-red-50/10 dark:bg-[#161d2f] border-red-200/60 dark:border-slate-800/50 shadow-sm rounded-xl">
              <CardHeader className="pb-1 p-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs font-semibold text-red-600 dark:text-red-400 flex items-center gap-1.5 uppercase tracking-wider">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    부족 재고 ({stats.lowStockItems.length})
                  </CardTitle>
                  <Link href="/dashboard/inventory?filter=low"><Button variant="ghost" size="sm" className="text-[11px] h-6 px-2 text-red-600 dark:text-red-400">발주 검토</Button></Link>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-1.5">
                {stats.lowStockItems.slice(0, 3).map((item) => (
                  <div key={item.id} className="flex items-center justify-between py-1.5 border-b border-red-100 dark:border-slate-800/30 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{item.productName}</p>
                      <p className="text-[10px] text-red-500 dark:text-red-400">{item.currentQuantity}/{item.safetyStock} {item.unit}</p>
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
      <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white/95 dark:bg-[#0f1623]/95 backdrop-blur-sm border-t border-slate-200 dark:border-slate-800/50 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Link href="/test/search" className="flex-1">
            <Button variant="outline" size="sm" className="w-full h-11 text-xs gap-1.5 bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200">
              <Search className="h-3.5 w-3.5" />
              시약 검색
            </Button>
          </Link>
          <Link href="/dashboard/inventory" className="flex-1">
            <Button variant="outline" size="sm" className="w-full h-11 text-xs gap-1.5 border-blue-200 text-blue-700 hover:bg-blue-50">
              <Plus className="h-3.5 w-3.5" />
              재고 등록
            </Button>
          </Link>
          <Link href="/test/quote" className="flex-1">
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
