"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingDown, AlertTriangle, CalendarClock, FileSpreadsheet, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

type PredictData = {
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
  const params = organizationId ? `?organizationId=${organizationId}` : "";

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
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

  const { data, isLoading } = useQuery<PredictData>({
    queryKey: ["budget-predict", organizationId],
    queryFn: async () => {
      const res = await fetch(`/api/budget/predict${params}`);
      if (!res.ok) throw new Error("fetch failed");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <Card className="border border-slate-200 shadow-sm bg-white dark:bg-slate-900 dark:border-slate-800 animate-pulse">
        <CardContent className="p-5 h-[140px]" />
      </Card>
    );
  }

  if (!data || !data.hasBudget) return null;

  const dDay = data.runwayDays !== null ? data.runwayDays : null;
  const exhaustLabel = data.exhaustDate
    ? `D-${dDay} (${formatDate(data.exhaustDate)} 고갈 예상)`
    : "데이터 부족";
  const hasWarning = data.hasWarning;

  return (
    <Card className={`border border-slate-200 shadow-sm overflow-hidden dark:border-slate-800 ${hasWarning ? "bg-red-50/30 dark:bg-red-950/20" : "bg-white dark:bg-slate-900"}`}>
      <CardContent className="p-0">
        <div className="flex flex-col sm:flex-row gap-0">
          {/* 좌측: 텍스트 요약 */}
          <div className="flex-1 p-5 space-y-3">
            {/* 상태 배지 */}
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
              </span>
              <span className="text-xs font-medium text-blue-600 dark:text-blue-400 tracking-wide">
                AI 예측 분석 중
              </span>
            </div>

            {/* 예상 고갈일 */}
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-red-500 shrink-0" />
                <p className="text-xs text-slate-600 dark:text-slate-400">예산 고갈 예측</p>
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-red-600 dark:text-red-400 leading-tight tracking-tight">
                {exhaustLabel}
              </p>
            </div>

            {/* 소진 속도 */}
            <div className="flex items-center gap-1.5">
              <TrendingDown className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
              <p className="text-xs text-slate-600 dark:text-slate-400">
                월평균{" "}
                <span className="text-slate-900 dark:text-slate-200 font-medium">
                  {formatKRW(data.avgMonthlyBurnRate)}
                </span>{" "}
                소진 중 &middot; 잔여{" "}
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                  {formatKRW(data.remaining)}
                </span>
              </p>
            </div>
          </div>

          {/* 우측: Sparkline */}
          <div className="sm:w-[160px] h-[80px] sm:h-auto flex items-end px-4 pb-4 sm:pb-5 sm:pt-5">
            <ResponsiveContainer width="100%" height={70}>
              <LineChart data={data.sparkline}>
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
        {data.hasWarning && data.warningMessage && (
          <div className="mx-4 mb-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 px-4 py-3 flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-700 dark:text-amber-200 leading-relaxed">
              {data.warningMessage}
            </p>
          </div>
        )}
        {!data.hasWarning && (
          <div className="mx-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 px-4 py-3 flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 text-slate-500 dark:text-slate-400 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              현재 소진 속도가 안정적입니다. 예산 소진 추이를 지속적으로 모니터링 중입니다.
            </p>
          </div>
        )}

        {/* 다운로드 버튼 */}
        <div className="mx-4 mb-4 mt-3 flex justify-end">
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
      </CardContent>
    </Card>
  );
}
