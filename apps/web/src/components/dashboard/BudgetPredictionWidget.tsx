"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TrendingDown, AlertTriangle, CalendarClock, FileSpreadsheet, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

type PredictItem = {
  scopeKey: string;
  organizationId: string | null;
  hasBudget: boolean;
  budgetName: string;
  totalBudget: number;
  totalSpent: number;
  remaining: number;
  avgMonthlyBurnRate: number;
  runwayDays: number | null;
  exhaustDate: string | null;
  sparkline: { month: string; amount: number }[];
  hasWarning: boolean;
  warningMessage: string | null;
};

function formatKRW(n: number) {
  if (n >= 100_000_000) return `₩${(n / 100_000_000).toFixed(1)}억`;
  if (n >= 10_000) return `₩${Math.round(n / 10_000).toLocaleString()}만`;
  return `₩${n.toLocaleString()}`;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export function BudgetPredictionWidget({ organizationId }: { organizationId?: string }) {
  const { toast } = useToast();
  const [isDownloading, setIsDownloading] = useState(false);
  const [selectedScopeKey, setSelectedScopeKey] = useState<string | null>(null);

  const { data: listData, isLoading } = useQuery<{ budgets: PredictItem[] }>({
    queryKey: ["budget-predict-list"],
    queryFn: async () => {
      const res = await fetch("/api/budget/predict/list");
      if (!res.ok) throw new Error("fetch failed");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    enabled: !organizationId,
  });

  const { data: singleData, isLoading: singleLoading } = useQuery<PredictItem & { hasBudget: boolean }>({
    queryKey: ["budget-predict", organizationId],
    queryFn: async () => {
      const params = organizationId ? `?organizationId=${organizationId}` : "";
      const res = await fetch(`/api/budget/predict${params}`);
      if (!res.ok) throw new Error("fetch failed");
      const json = await res.json();
      return {
        ...json,
        scopeKey: organizationId,
        organizationId,
      };
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!organizationId,
  });

  const budgets = organizationId
    ? singleData?.hasBudget
      ? [{ ...singleData, scopeKey: organizationId, organizationId }]
      : []
    : listData?.budgets ?? [];
  const effectiveSelected = selectedScopeKey ?? budgets[0]?.scopeKey ?? null;
  const selectedBudget = useMemo(
    () => budgets.find((b) => b.scopeKey === effectiveSelected) ?? budgets[0],
    [budgets, effectiveSelected]
  );

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const params = selectedBudget?.organizationId
        ? `?organizationId=${selectedBudget.organizationId}`
        : "";
      const res = await fetch(`/api/budget/report${params}`);
      if (!res.ok) throw new Error("생성 실패");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const yyyymmdd = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      a.href = url;
      a.download = `budget_proposal_${yyyymmdd}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "기안서가 성공적으로 생성되었습니다." });
    } catch {
      toast({ title: "다운로드 실패", description: "잠시 후 다시 시도해주세요.", variant: "destructive" });
    } finally {
      setIsDownloading(false);
    }
  };

  const isLoadingState = organizationId ? singleLoading : isLoading;

  if (isLoadingState) {
    return (
      <Card className="border border-slate-200 shadow-sm bg-white dark:bg-slate-900 dark:border-slate-800 animate-pulse">
        <CardContent className="p-5 h-[140px]" />
      </Card>
    );
  }

  if (!selectedBudget || !selectedBudget.hasBudget) return null;

  const dDay = selectedBudget.runwayDays;
  const exhaustLabel = selectedBudget.exhaustDate
    ? `D-${dDay} (${formatDate(selectedBudget.exhaustDate)} 고갈 예상)`
    : "데이터 부족";
  const hasWarning = selectedBudget.hasWarning;

  const otherWarningBudgets = budgets.filter(
    (b) => b.scopeKey !== effectiveSelected && b.hasWarning
  );
  const otherWarningCount = otherWarningBudgets.length;

  return (
    <Card className={`border border-slate-200 shadow-sm overflow-hidden dark:border-slate-800 ${hasWarning ? "bg-red-50/30 dark:bg-red-950/20" : "bg-white dark:bg-slate-900"}`}>
      <CardContent className="p-0">
        <div className="flex flex-col sm:flex-row gap-0">
          {/* 좌측: 텍스트 요약 */}
          <div className="flex-1 p-5 space-y-3">
            {/* 헤더: AI 배지 + 예산 셀렉터 */}
            <div className="flex justify-between items-center gap-2">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
                </span>
                <span className="text-xs font-medium text-blue-600 dark:text-blue-400 tracking-wide">
                  AI 예측 분석 중
                </span>
              </div>
              <Select
                value={effectiveSelected ?? ""}
                onValueChange={(v) => setSelectedScopeKey(v || null)}
              >
                <SelectTrigger className="h-8 w-[180px] text-xs border-slate-200 dark:border-slate-700">
                  <SelectValue placeholder="예산 선택" />
                </SelectTrigger>
                <SelectContent>
                  {budgets.map((b) => (
                    <SelectItem key={b.scopeKey} value={b.scopeKey} className="text-xs">
                      {b.budgetName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 예상 고갈일 (타이틀에 예산명 포함) */}
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-red-500 shrink-0" />
                <p className="text-xs text-slate-600 dark:text-slate-400">예산 고갈 예측</p>
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-red-600 dark:text-red-400 leading-tight tracking-tight">
                [{selectedBudget.budgetName}] {exhaustLabel}
              </p>
            </div>

            {/* 소진 속도 */}
            <div className="flex items-center gap-1.5">
              <TrendingDown className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
              <p className="text-xs text-slate-600 dark:text-slate-400">
                월평균{" "}
                <span className="text-slate-900 dark:text-slate-200 font-medium">
                  {formatKRW(selectedBudget.avgMonthlyBurnRate)}
                </span>{" "}
                소진 중 &middot; 잔여{" "}
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                  {formatKRW(selectedBudget.remaining)}
                </span>
              </p>
            </div>
          </div>

          {/* 우측: Sparkline */}
          <div className="sm:w-[160px] h-[80px] sm:h-auto flex items-end px-4 pb-4 sm:pb-5 sm:pt-5">
            <ResponsiveContainer width="100%" height={70}>
              <LineChart data={selectedBudget.sparkline}>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "6px",
                    color: "#0f172a",
                    fontSize: 12,
                    boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.1)",
                  }}
                  formatter={(v: number) => [formatKRW(v), "소진액"]}
                  labelFormatter={(l) => l}
                />
                <Line
                  type="monotone"
                  dataKey="amount"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 3, fill: "#3b82f6" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* AI 인사이트 영역 */}
        {selectedBudget.hasWarning && selectedBudget.warningMessage && (
          <div className="mx-4 mb-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 px-4 py-3 flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-700 dark:text-amber-200 leading-relaxed">
              {selectedBudget.warningMessage}
            </p>
          </div>
        )}
        {!selectedBudget.hasWarning && (
          <div className="mx-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 px-4 py-3 flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 text-slate-500 dark:text-slate-400 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              현재 소진 속도가 안정적입니다. 예산 소진 추이를 지속적으로 모니터링 중입니다.
            </p>
          </div>
        )}

        {/* 추가 위험 알림 + 다운로드 버튼 */}
        <div className="mx-4 mb-4 mt-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          {otherWarningCount > 0 && (
            <button
              type="button"
              onClick={() => otherWarningBudgets[0] && setSelectedScopeKey(otherWarningBudgets[0].scopeKey)}
              className="text-xs text-amber-600 dark:text-amber-400 hover:underline"
            >
              + 주의가 필요한 다른 예산 {otherWarningCount}건이 있습니다.
            </button>
          )}
          <div className={otherWarningCount > 0 ? "sm:ml-auto" : "w-full flex justify-end"}>
            <Button
              size="sm"
              variant="outline"
              disabled={isDownloading}
              onClick={handleDownload}
              className="border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-300 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/50 text-xs h-8 px-3"
            >
              {isDownloading ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  생성 중...
                </>
              ) : (
                <>
                  <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" />
                  예산 증액 기안서 생성 (.xlsx)
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
