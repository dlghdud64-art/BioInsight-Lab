"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import Link from "next/link";
import {
  Wallet,
  ArrowLeft,
  FileSpreadsheet,
  FileText,
  ChevronRight,
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
  const [budget, setBudget] = useState<Budget | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [selectedSpending, setSelectedSpending] = useState<null | {
    id: string; date: string; item: string; vendor: string; amount: number; category: string;
  }>(null);

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
  }, [fetchBudget]);

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
  const startStr = new Date(budget.periodStart).toLocaleDateString("ko-KR");
  const endStr = new Date(budget.periodEnd).toLocaleDateString("ko-KR");

  const handleExcelDownload = () => {
    toast({ title: "엑셀 다운로드", description: "집행 내역이 다운로드됩니다. (준비 중)" });
  };

  const handleReportGenerate = () => {
    toast({ title: "리포트 생성", description: "예산 보고서가 생성됩니다. (준비 중)" });
  };

  const formatAmount = (n: number) => `₩ ${n.toLocaleString("ko-KR")}`;
  const formatDate = (d: string) => new Date(d).toLocaleDateString("ko-KR");

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b1120] py-8 px-4 md:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* 헤더 + 액션 버튼 */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-600 flex items-center justify-center text-white">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-white break-keep">
                {budget.name}
              </h1>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="text-xs md:text-sm text-slate-500 dark:text-slate-400">{startStr} ~ {endStr}</span>
                {budget.targetDepartment && (
                  <Badge variant="outline" className="text-xs bg-slate-50 dark:bg-slate-800/60">
                    {budget.targetDepartment}
                  </Badge>
                )}
                {budget.projectName && (
                  <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-950/40">
                    {budget.projectName}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-slate-200 dark:border-slate-700"
              onClick={handleExcelDownload}
            >
              <FileSpreadsheet className="w-4 h-4 mr-1.5" />
              엑셀 다운로드
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-slate-200 dark:border-slate-700"
              onClick={handleReportGenerate}
            >
              <FileText className="w-4 h-4 mr-1.5" />
              리포트 생성
            </Button>
            <Link
              href="/dashboard/budget"
              className="inline-flex items-center text-xs md:text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              목록
            </Link>
          </div>
        </div>

        {/* 수치 요약 */}
        <Card className="shadow-sm border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60">
          <CardContent className="p-4 md:p-6">
            <div className="grid grid-cols-3 gap-4 md:gap-6">
              <div className="space-y-1">
                <p className="text-xs text-slate-500 dark:text-slate-400">예산 금액</p>
                <p className="text-xl md:text-2xl font-extrabold tracking-tighter text-slate-900 dark:text-white break-keep">
                  {formatAmount(budget.amount)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-500 dark:text-slate-400">사용 금액</p>
                <p className="text-xl md:text-2xl font-extrabold tracking-tighter text-slate-900 dark:text-white break-keep">
                  {formatAmount(usage?.totalSpent ?? 0)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-500 dark:text-slate-400">잔여 금액</p>
                <p className="text-xl md:text-2xl font-extrabold tracking-tighter break-keep text-emerald-600 dark:text-emerald-400">
                  {formatAmount(usage?.remaining ?? budget.amount)}
                </p>
              </div>
            </div>
            {usage && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400">예산 사용률</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{usageRate.toFixed(1)}%</span>
                </div>
                <Progress value={Math.min(usageRate, 100)} className="h-2" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* 차트 */}
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
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} tickFormatter={(v) => `${(v / 1000000).toFixed(0)}M`} />
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
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
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

        {/* 집행 내역 */}
        <Card className="shadow-sm border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60">
          <CardHeader>
            <CardTitle className="text-sm font-bold text-slate-900 dark:text-white">집행 내역</CardTitle>
            <CardDescription className="text-slate-500 dark:text-slate-400">
              구매 데이터가 연동되면 실제 집행 내역이 표시됩니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                아직 집행 내역이 없습니다.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 보고서 팝업 (placeholder) */}
      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogContent className="sm:max-w-[500px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-slate-900 dark:text-white">구매 보고서</DialogTitle>
            <DialogDescription className="text-slate-500 dark:text-slate-400">
              {selectedSpending?.item} - 관련 구매 증빙 자료
            </DialogDescription>
          </DialogHeader>
          {selectedSpending && (
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-slate-500 dark:text-slate-400">항목</span>
                  <p className="font-medium text-slate-900 dark:text-white">{selectedSpending.item}</p>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400">벤더</span>
                  <p className="font-medium text-slate-900 dark:text-white">{selectedSpending.vendor}</p>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400">금액</span>
                  <p className="font-medium text-slate-900 dark:text-white">{formatAmount(selectedSpending.amount)}</p>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400">날짜</span>
                  <p className="font-medium text-slate-900 dark:text-white">{formatDate(selectedSpending.date)}</p>
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center py-12 text-center">
                <FileText className="w-12 h-12 text-slate-400 mb-2" />
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  PDF/이미지 보고서는 구매 데이터 연동 후 제공됩니다.
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
