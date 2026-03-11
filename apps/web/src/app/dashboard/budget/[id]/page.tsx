"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import Link from "next/link";
import {
  Wallet,
  ArrowLeft,
  FileSpreadsheet,
  FileText,
  Edit,
  Lock,
  AlertTriangle,
  Clock,
  Building2,
  ShieldCheck,
  TrendingUp,
  Receipt,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useToast } from "@/hooks/use-toast";

type Budget = {
  id: string;
  name: string;
  amount: number;
  currency: string;
  periodStart: string;
  periodEnd: string;
  targetDepartment?: string | null;
  projectName?: string | null;
  description?: string | null;
  usage?: {
    totalSpent: number;
    usageRate: number;
    remaining: number;
  };
};

const CHART_COLORS = [
  "#3b82f6",
  "#10b981",
  "#06b6d4",
  "#8b5cf6",
  "#f59e0b",
  "#ec4899",
];

const MOCK_SPENDING_TREND = [
  { month: "1월", amount: 0 },
  { month: "2월", amount: 0 },
  { month: "3월", amount: 0 },
  { month: "4월", amount: 0 },
];

const MOCK_CATEGORY_DATA = [
  { name: "시약", value: 0, color: CHART_COLORS[0] },
  { name: "소모품", value: 0, color: CHART_COLORS[1] },
  { name: "장비", value: 0, color: CHART_COLORS[2] },
];

function BudgetDetailSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b1120] py-8 px-4 md:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-8 w-24" />
          </div>
        </div>
        <Card className="shadow-sm border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60">
          <CardContent className="p-4 md:p-6">
            <div className="grid grid-cols-3 gap-4 md:gap-6">
              <div className="space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-8 w-32" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-8 w-32" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-8 w-32" />
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <div className="flex justify-between">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-12" />
              </div>
              <Skeleton className="h-2 w-full" />
            </div>
          </CardContent>
        </Card>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="md:col-span-2 h-[332px] rounded-xl" />
          <Skeleton className="h-[332px] rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export default function BudgetDetailPage({ params }: { params: { id: string } }) {
  const id = params?.id;
  const { toast } = useToast();
  useSession(); // 세션 필요 (인증 확인)
  const [budget, setBudget] = useState<Budget | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [userOrgRole, setUserOrgRole] = useState<string | null>(null);
  const canEdit = userOrgRole === "OWNER" || userOrgRole === "ADMIN";

  // 조직 역할 조회
  const fetchOrgRole = useCallback(async () => {
    try {
      const res = await fetch("/api/organizations");
      if (!res.ok) return;
      const json = await res.json();
      const orgs = Array.isArray(json.organizations) ? json.organizations : [];
      if (orgs.length > 0) setUserOrgRole(orgs[0].role ?? null);
    } catch { /* silent */ }
  }, []);

  const fetchBudget = useCallback(async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      const res = await fetch(`/api/budgets/${id}`);
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (!res.ok) throw new Error("Failed to fetch budget");
      const json = await res.json();
      setBudget(json.budget ?? null);
      if (!json.budget) setNotFound(true);
    } catch (err) {
      console.error("[BudgetDetailPage] Error fetching budget:", err);
      setNotFound(true);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchBudget();
    fetchOrgRole();
  }, [fetchBudget, fetchOrgRole]);

  if (!id) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0b1120]">
        <p className="text-sm text-slate-500 dark:text-slate-400">잘못된 접근입니다.</p>
      </div>
    );
  }

  if (isLoading) {
    return <BudgetDetailSkeleton />;
  }

  if (notFound || !budget) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0b1120]">
        <div className="text-center space-y-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">해당 예산 정보를 찾을 수 없습니다.</p>
          <Link
            href="/dashboard/budget"
            className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            예산 목록으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  const usage = budget.usage;
  const usageRate = usage?.usageRate ?? 0;
  const totalSpent = usage?.totalSpent ?? 0;
  const remaining = usage?.remaining ?? budget.amount;
  const startStr = new Date(budget.periodStart).toLocaleDateString("ko-KR");
  const endStr = new Date(budget.periodEnd).toLocaleDateString("ko-KR");

  // 예산 상태 판정
  const now = new Date();
  const periodStart = new Date(budget.periodStart);
  const periodEnd = new Date(budget.periodEnd);
  const budgetStatus = (() => {
    if (usageRate > 100) return { label: "초과", color: "bg-red-100 text-red-700 border-red-200" };
    if (usageRate >= 80) return { label: "경고", color: "bg-orange-100 text-orange-700 border-orange-200" };
    if (now < periodStart) return { label: "예정", color: "bg-slate-100 text-slate-600 border-slate-200" };
    if (now > periodEnd) return { label: "종료", color: "bg-slate-100 text-slate-500 border-slate-200" };
    return { label: "운영 중", color: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  })();

  // 통제 지표 계산
  const totalDays = Math.max(1, Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)));
  const elapsedDays = Math.max(0, Math.ceil((now.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)));
  const remainingDays = Math.max(0, Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  const timeProgress = Math.min(100, Math.round((elapsedDays / totalDays) * 100));
  // 시간 대비 소비 속도 판정 (사용률이 시간 진행률을 크게 초과하면 위험)
  const burnRisk = usageRate > 0 && timeProgress > 0
    ? Math.round(usageRate / timeProgress * 100) / 100
    : 0;
  const hasSpending = totalSpent > 0;

  const handleExcelDownload = () => {
    toast({ title: "엑셀 다운로드", description: "집행 내역이 다운로드됩니다. (준비 중)" });
  };

  const handleReportGenerate = () => {
    toast({ title: "리포트 생성", description: "예산 보고서가 생성됩니다. (준비 중)" });
  };

  const formatAmount = (n: number) => `₩ ${n.toLocaleString("ko-KR")}`;

  // description에서 내부 메타 텍스트 제거 (사용자에게 보이면 안 되는 raw 문자열)
  const cleanDescription = (() => {
    if (!budget.description) return null;
    return budget.description
      .replace(/^\[([^\]]*)\]\s*\|?\s*/, "")       // [이름] 제거
      .replace(/프로젝트:\s*[^|]+\|?\s*/g, "")      // 프로젝트: xxx 제거
      .replace(/period:\d{4}-\d{2}-\d{2}~\d{4}-\d{2}-\d{2}\s*\|?\s*/g, "") // period:... 제거
      .replace(/^\s*\|\s*/, "")                      // 남은 선행 구분자 제거
      .replace(/\s*\|\s*$/, "")                      // 후행 구분자 제거
      .trim() || null;
  })();

  // 상태 해석 문구
  const statusInterpretation = (() => {
    if (usageRate > 100) return "예산이 초과되었습니다. 추가 집행 전 검토가 필요합니다.";
    if (usageRate >= 80) return "예산 소진이 임박합니다. 잔여 집행 계획을 확인하세요.";
    if (now > periodEnd) return "예산 기간이 종료되었습니다. 정산 또는 이월 여부를 확인하세요.";
    if (now < periodStart) return "예산 기간이 아직 시작되지 않았습니다.";
    if (!hasSpending) return "예산이 운영 중이며, 아직 집행 내역이 없습니다.";
    return "예산이 정상 범위 내에서 운영 중입니다.";
  })();

  // 사용률 해석
  const usageInterpretation = (() => {
    if (!hasSpending) return "현재 사용 없음";
    if (usageRate > 100) return `예산 대비 ${(usageRate - 100).toFixed(1)}% 초과`;
    if (usageRate >= 80) return `잔여 ${(100 - usageRate).toFixed(1)}% — 소진 임박`;
    return `${formatAmount(totalSpent)} 집행`;
  })();

  // 잔여 기간 해석
  const periodInterpretation = (() => {
    if (now > periodEnd) return "기간 종료 — 정산 필요";
    if (now < periodStart) return `시작 전 — ${startStr} 개시`;
    return `${remainingDays}일 남음 / 전체 ${totalDays}일 중 ${timeProgress}% 경과`;
  })();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b1120] py-8 px-4 md:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* 좌측: 복귀 내비게이션 */}
        <Link
          href="/dashboard/budget"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors -mb-2"
        >
          <ArrowLeft className="w-4 h-4" />
          예산 관리
        </Link>

        {/* 헤더: 좌측 = 제목/상태, 우측 = 실행 액션만 */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-600 flex items-center justify-center text-white mt-0.5">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-white break-keep">
                  {budget.name}
                </h1>
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${budgetStatus.color}`}>
                  {budgetStatus.label}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                이 예산은 견적 승인과 구매 집행에 연결되며, 사용률과 잔여 금액을 기준으로 통제합니다.
              </p>
            </div>
          </div>
          {/* 우측: 실행 액션만 (수정 > 다운로드 > 리포트) */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {canEdit ? (
              <Link href="/dashboard/budget">
                <Button size="sm" variant="outline" className="border-slate-200 dark:border-slate-700">
                  <Edit className="w-4 h-4 mr-1.5" />
                  수정
                </Button>
              </Link>
            ) : (
              <TooltipProvider>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="outline" disabled className="opacity-50">
                      <Lock className="w-4 h-4 mr-1.5" />
                      수정
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Owner/Admin만 수정 가능</p>
                  </TooltipContent>
                </UITooltip>
              </TooltipProvider>
            )}
            {hasSpending && (
              <Button
                variant="outline"
                size="sm"
                className="border-slate-200 dark:border-slate-700"
                onClick={handleExcelDownload}
              >
                <FileSpreadsheet className="w-4 h-4 mr-1.5" />
                <span className="hidden sm:inline">다운로드</span>
              </Button>
            )}
            {hasSpending && (
              <Button
                variant="outline"
                size="sm"
                className="border-slate-200 dark:border-slate-700"
                onClick={handleReportGenerate}
              >
                <FileText className="w-4 h-4 mr-1.5" />
                <span className="hidden sm:inline">리포트</span>
              </Button>
            )}
          </div>
        </div>

        {/* 통제 지표 대시보드 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* 사용률 */}
          <Card className={`shadow-sm border ${usageRate > 100 ? "border-red-300 bg-red-50 dark:bg-red-950/30" : usageRate >= 80 ? "border-orange-200 bg-orange-50 dark:bg-orange-950/20" : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/60"}`}>
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <TrendingUp className={`h-3.5 w-3.5 ${usageRate > 100 ? "text-red-500" : usageRate >= 80 ? "text-orange-500" : "text-blue-500"}`} />
                <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">사용률</p>
              </div>
              <p className={`text-lg font-extrabold tracking-tight ${usageRate > 100 ? "text-red-700 dark:text-red-400" : usageRate >= 80 ? "text-orange-700 dark:text-orange-400" : "text-slate-900 dark:text-white"}`}>
                {usageRate.toFixed(1)}%
              </p>
              <Progress value={Math.min(usageRate, 100)} className="h-1.5 mt-1.5" />
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1.5">{usageInterpretation}</p>
            </CardContent>
          </Card>

          {/* 초과 위험 */}
          <Card className={`shadow-sm border ${burnRisk > 1.3 ? "border-red-300 bg-red-50 dark:bg-red-950/30" : burnRisk > 1.0 ? "border-orange-200 bg-orange-50 dark:bg-orange-950/20" : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/60"}`}>
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <AlertTriangle className={`h-3.5 w-3.5 ${burnRisk > 1.3 ? "text-red-500" : burnRisk > 1.0 ? "text-orange-500" : "text-emerald-500"}`} />
                <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">초과 위험</p>
              </div>
              <p className={`text-lg font-extrabold tracking-tight ${burnRisk > 1.3 ? "text-red-700 dark:text-red-400" : burnRisk > 1.0 ? "text-orange-700 dark:text-orange-400" : "text-emerald-700 dark:text-emerald-400"}`}>
                {burnRisk > 1.3 ? "높음" : burnRisk > 1.0 ? "주의" : hasSpending ? "안전" : "-"}
              </p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                {hasSpending
                  ? burnRisk > 1.3
                    ? `소비 속도 ${burnRisk.toFixed(1)}배 — 기간 내 초과 예상`
                    : burnRisk > 1.0
                      ? `소비 속도 ${burnRisk.toFixed(1)}배 — 추이 주시 필요`
                      : `소비 속도 ${burnRisk.toFixed(1)}배 — 정상 범위`
                  : "아직 초과 위험 신호 없음"}
              </p>
            </CardContent>
          </Card>

          {/* 잔여 기간 */}
          <Card className="shadow-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Clock className="h-3.5 w-3.5 text-slate-400" />
                <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">잔여 기간</p>
              </div>
              <p className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
                {now > periodEnd ? "종료" : now < periodStart ? "시작 전" : `${remainingDays}일`}
              </p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                {periodInterpretation}
              </p>
            </CardContent>
          </Card>

          {/* 잔여 금액 */}
          <Card className="shadow-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Wallet className="h-3.5 w-3.5 text-emerald-500" />
                <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">잔여 금액</p>
              </div>
              <p className={`text-lg font-extrabold tracking-tight break-keep ${remaining < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                {formatAmount(remaining)}
              </p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                총 예산 {formatAmount(budget.amount)} 중 {remaining < 0 ? "초과" : "잔여"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* 운영 정보 */}
        <Card className="shadow-sm border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60">
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">적용 대상</span>
                </div>
                <p className="font-medium text-slate-900 dark:text-white text-sm">
                  {budget.targetDepartment || "부서 미지정"}
                  {budget.projectName ? ` · ${budget.projectName}` : ""}
                </p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">승인 규칙</span>
                </div>
                <p className="font-medium text-slate-900 dark:text-white text-sm">
                  견적 승인 후 집행
                </p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">상태 해석</span>
                </div>
                <p className="font-medium text-slate-900 dark:text-white text-sm">
                  {statusInterpretation}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-800 pt-3">
              <span>{startStr} ~ {endStr}</span>
              <span>{budget.currency}</span>
              {cleanDescription && <span>{cleanDescription}</span>}
            </div>
          </CardContent>
        </Card>

        {/* 차트 — 집행 데이터가 있을 때만 표시 */}
        {hasSpending ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="md:col-span-2 shadow-sm border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-slate-900 dark:text-white">월별 집행 추이</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={MOCK_SPENDING_TREND} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.6} />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.3} />
                    <XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} tickFormatter={(v: number) => `${(v / 1000000).toFixed(0)}M`} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        color: "hsl(var(--card-foreground))",
                      }}
                      formatter={(value: number) => [formatAmount(value), "집행액"]}
                    />
                    <Area type="monotone" dataKey="amount" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorAmount)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-slate-900 dark:text-white">항목별 지출 비중</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={MOCK_CATEGORY_DATA}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }: { name: string; percent: number }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                      style={{ fontSize: 12 }}
                    >
                      {MOCK_CATEGORY_DATA.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} stroke="#475569" strokeWidth={1} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        color: "hsl(var(--card-foreground))",
                      }}
                      formatter={(value: number) => [formatAmount(value), "금액"]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        ) : null}

        {/* 집행 내역 */}
        <Card className="shadow-sm border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60">
          <CardHeader>
            <CardTitle className="text-sm font-bold text-slate-900 dark:text-white">집행 내역</CardTitle>
          </CardHeader>
          <CardContent>
            {hasSpending ? (
              <CardDescription className="text-slate-500 dark:text-slate-400">
                구매 데이터가 연동되면 상세 집행 내역이 표시됩니다.
              </CardDescription>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Receipt className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-3" />
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                  아직 이 예산에 연결된 집행 내역이 없습니다
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 max-w-sm mb-5">
                  견적 승인 후 구매가 발생하면 이 예산에 집행 내역이 자동으로 반영됩니다.
                  예산과 연결된 견적을 확인하거나, 새 견적 요청을 시작할 수 있습니다.
                </p>
                <div className="flex gap-2">
                  <Link href="/dashboard/quotes">
                    <Button variant="outline" size="sm" className="text-xs">
                      연결된 견적 보기
                    </Button>
                  </Link>
                  <Link href="/test/search">
                    <Button size="sm" className="text-xs">
                      견적 요청 시작하기
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
