"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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

// TODO: 실제 AI 예측 API (GET /api/dashboard/ai-prediction) 연동 시 이 객체를 응답 데이터로 교체할 것
const mockAIPredictionData = {
  totalBudget: 50_000_000,
  spentAmount: 32_500_000,
  predictedExhaustionDate: "2026-10-15",
  aiInsightMessage:
    "현재 지출 속도 유지 시, 10월 중순 예산 소진이 예상됩니다. 하반기 추가 예산 편성을 권장합니다.",
  status: "warning",
} as const;

const MOCK_PREDICT_BUDGET: PredictItem = {
  scopeKey: "mock-default-budget",
  organizationId: null,
  hasBudget: true,
  budgetName: "연구실 기본 예산",
  totalBudget: mockAIPredictionData.totalBudget,
  totalSpent: mockAIPredictionData.spentAmount,
  remaining: mockAIPredictionData.totalBudget - mockAIPredictionData.spentAmount,
  avgMonthlyBurnRate: Math.round(mockAIPredictionData.spentAmount / 6),
  runwayDays: 180,
  exhaustDate: mockAIPredictionData.predictedExhaustionDate,
  sparkline: [
    { month: "4월", amount: 4_800_000 },
    { month: "5월", amount: 5_200_000 },
    { month: "6월", amount: 5_400_000 },
    { month: "7월", amount: 5_600_000 },
    { month: "8월", amount: 5_800_000 },
    { month: "9월", amount: 5_700_000 },
  ],
  hasWarning: mockAIPredictionData.status === "warning",
  warningMessage: mockAIPredictionData.aiInsightMessage,
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

  const hasRealBudgetData =
    budgets.length > 0 && budgets.some((b) => b.hasBudget && b.totalBudget > 0);

  const effectiveBudgets = hasRealBudgetData ? budgets : [MOCK_PREDICT_BUDGET];

  const effectiveSelected = selectedScopeKey ?? effectiveBudgets[0]?.scopeKey ?? null;

  const selectedBudget = useMemo(
    () =>
      effectiveBudgets.find((b) => b.scopeKey === effectiveSelected) ??
      effectiveBudgets[0],
    [effectiveBudgets, effectiveSelected]
  );

  const usageRate =
    selectedBudget && selectedBudget.totalBudget > 0
      ? Math.round((selectedBudget.totalSpent / selectedBudget.totalBudget) * 100)
      : 0;

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
      <Card className="border border-slate-200 shadow-sm bg-white bg-[#1a1a1e] border-[#2a2a2e] animate-pulse">
        <CardContent className="p-4 h-[100px] sm:p-5 sm:h-[140px]" />
      </Card>
    );
  }

  if (!selectedBudget || !selectedBudget.hasBudget) {
    return (
      <Card className="border border-slate-200 shadow-sm bg-white bg-[#1a1a1e] border-[#2a2a2e]">
        <CardContent className="py-6 px-5 flex items-center gap-4">
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50  bg-blue-950/40">
            <span className="animate-ping absolute inline-flex h-5 w-5 rounded-full bg-blue-300 opacity-50" />
            <Loader2 className="relative h-4 w-4 text-blue-500 animate-spin" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-200">AI가 데이터 학습 중입니다</p>
            <p className="text-xs text-slate-400 mt-0.5">
              예산을 등록하면 AI 소진 예측 분석이 시작됩니다.
            </p>
          </div>
          <a href="/dashboard/settings/budget" className="ml-auto shrink-0 text-xs text-blue-600 hover:underline text-blue-400">
            예산 등록 →
          </a>
        </CardContent>
      </Card>
    );
  }

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
    <Card className={`border border-slate-200 shadow-sm overflow-hidden border-[#2a2a2e] ${hasWarning ? "bg-red-50/30 bg-red-950/20" : "bg-white bg-[#1a1a1e]"}`}>
      <CardContent className="p-0">
        <div className="flex flex-col sm:flex-row gap-0">
          {/* 좌측: 텍스트 요약 */}
          <div className="flex-1 p-3 sm:p-5 space-y-2 sm:space-y-3">
            {/* 헤더: AI 배지 + 예산 셀렉터 */}
            <div className="flex justify-between items-center gap-2">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
                </span>
                <span className="text-xs font-medium text-blue-600 text-blue-400 tracking-wide">
                  AI 예측 분석 중
                </span>
              </div>
              {effectiveBudgets.length > 1 ? (
                <Select
                  value={effectiveSelected ?? ""}
                  onValueChange={(v) => setSelectedScopeKey(v || null)}
                >
                  <SelectTrigger className="h-8 w-[180px] text-xs border-slate-200 border-[#333338]">
                    <SelectValue placeholder="예산 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {effectiveBudgets.map((b) => (
                      <SelectItem key={b.scopeKey} value={b.scopeKey} className="text-xs">
                        {b.budgetName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="px-2 py-1.5 rounded-full bg-slate-50 bg-[#222226]/60 border border-slate-200/80 border-[#333338]/80 text-[11px] text-slate-300">
                  {effectiveBudgets[0]?.budgetName}
                </div>
              )}
            </div>

            {/* 예상 고갈일 (타이틀에 예산명 포함) */}
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-red-500 shrink-0" />
                <p className="text-xs text-slate-400">예산 고갈 예측</p>
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-red-600 text-red-400 leading-tight tracking-tight">
                [{selectedBudget.budgetName}] {exhaustLabel}
              </p>
            </div>

            {/* 소진 속도 */}
            <div className="flex items-center gap-1.5">
              <TrendingDown className="h-3.5 w-3.5 text-slate-400" />
              <p className="text-xs text-slate-400">
                월평균{" "}
                <span className="text-slate-200 font-medium">
                  {formatKRW(selectedBudget.avgMonthlyBurnRate)}
                </span>{" "}
                소진 중 &middot; 잔여{" "}
                <span className="text-emerald-600 text-emerald-400 font-medium">
                  {formatKRW(selectedBudget.remaining)}
                </span>
              </p>
            </div>

            {/* 예산 소진률 Progress Bar */}
            <div className="space-y-1 pt-1">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>
                  사용 예산{" "}
                  <span className="font-semibold text-slate-100">
                    {formatKRW(selectedBudget.totalSpent)}
                  </span>
                </span>
                <span className={`font-semibold ${usageRate >= 80 ? "text-red-600 text-red-400" : "text-slate-100"}`}>
                  {usageRate}%
                </span>
              </div>
              <Progress
                value={usageRate}
                className={`h-2.5 ${usageRate >= 80 ? "[&>div]:bg-red-500 bg-red-950/40" : "bg-slate-100 bg-[#222226]/60"}`}
              />
              <p className="text-[10px] text-slate-400 text-slate-500">
                총 예산 {formatKRW(selectedBudget.totalBudget)} 기준
              </p>
            </div>
          </div>

          {/* 우측: Sparkline */}
          <div className="hidden sm:flex sm:w-[160px] sm:h-auto items-end px-4 pb-5 pt-5">
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
          <div className="mx-3 mb-3 sm:mx-4 sm:mb-4 rounded-lg bg-amber-950/30 border border-amber-200  border-amber-800/40 px-3 py-1.5 sm:px-4 sm:py-2 flex items-start gap-2">
            <AlertTriangle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-600 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-700  text-amber-200 leading-relaxed">
              {selectedBudget.warningMessage}
            </p>
          </div>
        )}
        {!selectedBudget.hasWarning && (
          <div className="mx-3 sm:mx-4 rounded-lg bg-slate-50 bg-[#222226]/50 border border-slate-200 border-[#333338] px-3 py-1.5 sm:px-4 sm:py-2 flex items-start gap-2">
            <AlertTriangle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-400 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-300 leading-relaxed">
              현재 소진 속도가 안정적입니다. 예산 소진 추이를 지속적으로 모니터링 중입니다.
            </p>
          </div>
        )}

        {/* 추가 위험 알림 + 다운로드 버튼 */}
        <div className="mx-3 mb-3 mt-2 sm:mx-4 sm:mb-4 sm:mt-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          {otherWarningCount > 0 && (
            <button
              type="button"
              onClick={() => otherWarningBudgets[0] && setSelectedScopeKey(otherWarningBudgets[0].scopeKey)}
              className="text-xs text-amber-600 text-amber-400 hover:underline"
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
              className="border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-300  border-emerald-800 text-emerald-400  hover:bg-emerald-950/50 text-xs h-8 px-3"
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
