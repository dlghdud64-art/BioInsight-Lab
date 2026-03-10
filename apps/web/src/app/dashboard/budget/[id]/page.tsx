"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
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
  TrendingUp,
  AlertTriangle,
  ShoppingCart,
  ArrowRight,
  Calendar,
  AlertCircle,
  CheckCircle2,
  BarChart3,
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

const CHART_COLORS = ["#3b82f6", "#10b981", "#06b6d4", "#8b5cf6", "#f59e0b", "#ec4899"];

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
    <div className="w-full px-4 md:px-6 py-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="md:col-span-2 h-[340px] rounded-xl" />
          <Skeleton className="h-[340px] rounded-xl" />
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
      if (res.status === 404) { setNotFound(true); return; }
      if (!res.ok) throw new Error("Failed to fetch budget");
      const json = await res.json();
      setBudget(json.budget ?? null);
      if (!json.budget) setNotFound(true);
    } catch (err) {
      console.error("[BudgetDetailPage] Error:", err);
      setNotFound(true);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchBudget(); }, [fetchBudget]);

  if (!id) {
    return (
      <div className="w-full px-4 md:px-6 py-6">
        <div className="max-w-6xl mx-auto text-center py-12">
          <p className="text-sm text-slate-500">잘못된 접근입니다.</p>
        </div>
      </div>
    );
  }

  if (isLoading) return <BudgetDetailSkeleton />;

  if (notFound || !budget) {
    return (
      <div className="w-full px-4 md:px-6 py-6">
        <div className="max-w-6xl mx-auto">
          <Card className="border-slate-200">
            <CardContent className="py-16 text-center">
              <Wallet className="h-8 w-8 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-600 mb-1">해당 예산 정보를 찾을 수 없습니다</p>
              <p className="text-xs text-slate-400 mb-4">삭제되었거나 접근 권한이 없을 수 있습니다.</p>
              <Link href="/dashboard/budget">
                <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                  <ArrowLeft className="h-3 w-3" />
                  예산 목록으로
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const usage = budget.usage;
  const usageRate = usage?.usageRate ?? 0;
  const remaining = usage?.remaining ?? budget.amount;
  const totalSpent = usage?.totalSpent ?? 0;
  const startStr = new Date(budget.periodStart).toLocaleDateString("ko-KR");
  const endStr = new Date(budget.periodEnd).toLocaleDateString("ko-KR");
  const now = new Date();
  const periodEnd = new Date(budget.periodEnd);
  const periodStart = new Date(budget.periodStart);
  const totalDays = Math.max(1, Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)));
  const elapsedDays = Math.max(0, Math.ceil((now.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)));
  const daysLeft = Math.max(0, Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

  // 해석형 정보
  const dailyBurnRate = elapsedDays > 0 ? totalSpent / elapsedDays : 0;
  const monthlyBurnRate = dailyBurnRate * 30;
  const projectedTotal = dailyBurnRate * totalDays;
  const isOverRisk = projectedTotal > budget.amount && usageRate < 100;
  const isExceeded = usageRate > 100;
  const isWarning = usageRate >= 80 && usageRate <= 100;

  const formatAmount = (n: number) => `₩${n.toLocaleString("ko-KR")}`;

  const handleExcelDownload = () => {
    toast({ title: "엑셀 다운로드 준비 중", description: "집행 내역이 다운로드됩니다." });
  };

  const handleReportGenerate = () => {
    toast({ title: "리포트 생성 준비 중", description: "예산 보고서가 생성됩니다." });
  };

  const hasSpendingData = totalSpent > 0;
  const hasCategoryData = MOCK_CATEGORY_DATA.some((d) => d.value > 0);

  return (
    <div className="w-full px-4 md:px-6 py-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* 헤더 */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <Link
              href="/dashboard/budget"
              className="inline-flex items-center text-xs text-slate-400 hover:text-slate-600 mb-2 transition-colors"
            >
              <ArrowLeft className="h-3 w-3 mr-1" />
              예산 목록
            </Link>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
              {budget.name}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              <span className="text-xs text-slate-500">{startStr} ~ {endStr}</span>
              {daysLeft > 0 ? (
                <span className="text-[10px] text-slate-400">({daysLeft}일 남음)</span>
              ) : (
                <Badge variant="outline" className="text-[10px] bg-slate-100 text-slate-500">종료됨</Badge>
              )}
              {budget.targetDepartment && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{budget.targetDepartment}</span>
              )}
              {budget.projectName && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">{budget.projectName}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleExcelDownload}>
              <FileSpreadsheet className="h-3.5 w-3.5" />
              엑셀
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleReportGenerate}>
              <FileText className="h-3.5 w-3.5" />
              리포트
            </Button>
          </div>
        </div>

        {/* 해석형 KPI 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-[11px] text-slate-500 font-medium">사용률</p>
            <p className={`text-xl font-bold mt-0.5 ${isExceeded ? "text-red-600" : isWarning ? "text-orange-600" : "text-slate-900"}`}>
              {usageRate.toFixed(1)}%
            </p>
            <Progress
              value={Math.min(usageRate, 100)}
              className={`h-1 mt-2 ${isExceeded ? "[&>div]:bg-red-500" : isWarning ? "[&>div]:bg-orange-500" : ""}`}
            />
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-[11px] text-slate-500 font-medium">잔여 금액</p>
            <p className={`text-xl font-bold mt-0.5 ${remaining < 0 ? "text-red-600" : "text-emerald-600"}`}>
              {formatAmount(remaining)}
            </p>
            <p className="text-[10px] text-slate-400 mt-1">전체 {formatAmount(budget.amount)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-[11px] text-slate-500 font-medium">최근 30일 집행</p>
            <p className="text-xl font-bold text-slate-900 mt-0.5">{formatAmount(Math.round(monthlyBurnRate))}</p>
            <p className="text-[10px] text-slate-400 mt-1">일평균 {formatAmount(Math.round(dailyBurnRate))}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-[11px] text-slate-500 font-medium">초과 위험</p>
            {isExceeded ? (
              <div className="flex items-center gap-1.5 mt-1">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <p className="text-sm font-bold text-red-600">예산 초과</p>
              </div>
            ) : isOverRisk ? (
              <div className="flex items-center gap-1.5 mt-1">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                <p className="text-sm font-bold text-orange-600">초과 예상</p>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 mt-1">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <p className="text-sm font-bold text-emerald-600">정상</p>
              </div>
            )}
            {isOverRisk && !isExceeded && (
              <p className="text-[10px] text-orange-500 mt-1">
                현재 속도 유지 시 {formatAmount(Math.round(projectedTotal))} 예상
              </p>
            )}
          </div>
        </div>

        {/* 운영 메모 */}
        {budget.description && (
          <div className="flex items-start gap-2 px-4 py-2.5 rounded-lg bg-slate-50 border border-slate-100">
            <FileText className="h-3.5 w-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-slate-500 leading-relaxed">{budget.description}</p>
          </div>
        )}

        {/* 차트 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 월별 집행 추이 */}
          <Card className="md:col-span-2 shadow-sm border-slate-200 bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-slate-900">월별 집행 추이</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              {hasSpendingData ? (
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
                      contentStyle={{ backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px" }}
                      formatter={(value: number) => [formatAmount(value), "집행액"]}
                    />
                    <Area type="monotone" dataKey="amount" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorAmount)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <BarChart3 className="h-8 w-8 text-slate-200 mb-3" />
                  <p className="text-sm font-medium text-slate-500 mb-1">아직 집행 데이터가 없습니다</p>
                  <p className="text-xs text-slate-400 mb-4 max-w-xs">
                    구매 내역에서 이 예산을 연결하면 월별 집행 추이가 자동으로 표시됩니다.
                  </p>
                  <Link href="/dashboard/purchases">
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                      <ShoppingCart className="h-3 w-3" />
                      구매 내역 보기
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 항목별 지출 비중 */}
          <Card className="shadow-sm border-slate-200 bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-slate-900">항목별 지출 비중</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              {hasCategoryData ? (
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
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px" }}
                      formatter={(value: number) => [formatAmount(value), "금액"]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="w-16 h-16 rounded-full border-4 border-slate-100 flex items-center justify-center mb-3">
                    <span className="text-xs text-slate-300 font-medium">0%</span>
                  </div>
                  <p className="text-sm font-medium text-slate-500 mb-1">지출 내역 없음</p>
                  <p className="text-xs text-slate-400 max-w-[180px]">
                    구매가 진행되면 카테고리별 비중이 표시됩니다.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 집행 내역 */}
        <Card className="shadow-sm border-slate-200 bg-white">
          <CardHeader>
            <CardTitle className="text-sm font-bold text-slate-900">집행 내역</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center mb-3">
                <ShoppingCart className="h-5 w-5 text-slate-300" />
              </div>
              <p className="text-sm font-medium text-slate-600 mb-1">
                이 예산에 연결된 구매 내역이 없습니다
              </p>
              <p className="text-xs text-slate-400 mb-4 max-w-sm leading-relaxed">
                구매 내역에서 예산을 연결하면 집행 금액이 자동으로 반영됩니다.
                연결된 구매 건은 여기에서 확인할 수 있습니다.
              </p>
              <Link href="/dashboard/purchases">
                <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                  <ShoppingCart className="h-3 w-3" />
                  구매 내역에서 예산 연결하기
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 보고서 팝업 */}
      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>구매 보고서</DialogTitle>
            <DialogDescription>
              {selectedSpending?.item} - 관련 구매 증빙 자료
            </DialogDescription>
          </DialogHeader>
          {selectedSpending && (
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-slate-500">항목</span>
                  <p className="font-medium text-slate-900">{selectedSpending.item}</p>
                </div>
                <div>
                  <span className="text-slate-500">벤더</span>
                  <p className="font-medium text-slate-900">{selectedSpending.vendor}</p>
                </div>
                <div>
                  <span className="text-slate-500">금액</span>
                  <p className="font-medium text-slate-900">{formatAmount(selectedSpending.amount)}</p>
                </div>
                <div>
                  <span className="text-slate-500">날짜</span>
                  <p className="font-medium text-slate-900">{new Date(selectedSpending.date).toLocaleDateString("ko-KR")}</p>
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 flex flex-col items-center justify-center py-10 text-center">
                <FileText className="h-8 w-8 text-slate-300 mb-2" />
                <p className="text-xs text-slate-400">구매 데이터 연동 후 증빙 자료가 표시됩니다.</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
