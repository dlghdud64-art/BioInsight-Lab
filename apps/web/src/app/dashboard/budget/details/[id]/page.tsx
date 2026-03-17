"use client";

export const dynamic = "force-dynamic";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Wallet, Calendar, TrendingUp, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/app/_components/page-header";

interface BudgetDetail {
  id: string;
  name: string;
  amount: number;
  currency: string;
  periodStart: string;
  periodEnd: string;
  description?: string | null;
  projectName?: string | null;
  targetDepartment?: string | null;
  usage?: {
    totalSpent: number;
    usageRate: number;
    remaining: number;
  };
}

export default function BudgetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const budgetId = params.id as string;

  const { data: budgets, isLoading } = useQuery({
    queryKey: ["budgets"],
    queryFn: async () => {
      const res = await fetch("/api/budgets");
      if (!res.ok) throw new Error("Failed to fetch budgets");
      const json = await res.json();
      return json.budgets || [];
    },
  });

  const budget = budgets?.find((b: BudgetDetail) => b.id === budgetId) as BudgetDetail | undefined;

  if (isLoading) {
    return (
      <div className="w-full px-4 md:px-6 py-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center py-12 text-muted-foreground dark:text-slate-400">
            로딩 중...
          </div>
        </div>
      </div>
    );
  }

  if (!budget) {
    return (
      <div className="w-full px-4 md:px-6 py-6">
        <div className="max-w-3xl mx-auto">
          <Card className="border-slate-200 dark:border-slate-700">
            <CardContent className="py-12 text-center">
              <Wallet className="h-12 w-12 mx-auto text-muted-foreground dark:text-slate-500 mb-4" />
              <p className="text-slate-600 dark:text-slate-300 mb-2">예산을 찾을 수 없습니다.</p>
              <p className="text-sm text-muted-foreground dark:text-slate-400 mb-4">
                해당 예산이 삭제되었거나 접근 권한이 없을 수 있습니다.
              </p>
              <Button asChild variant="outline">
                <Link href="/dashboard/budget">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  예산 목록으로
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const usage = budget.usage;
  const usageRate = usage?.usageRate ?? 0;
  const isOverBudget = usageRate > 100;
  const isWarning = usageRate > 80 && usageRate <= 100;

  return (
    <div className="w-full px-4 md:px-6 py-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/budget">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <PageHeader
            title={budget.name}
            description={
              budget.periodStart && budget.periodEnd ? (
                <span className="flex items-center gap-1.5 text-muted-foreground dark:text-slate-400">
                  <Calendar className="h-4 w-4" />
                  {new Date(budget.periodStart).toLocaleDateString("ko-KR")} ~{" "}
                  {new Date(budget.periodEnd).toLocaleDateString("ko-KR")}
                </span>
              ) : undefined
            }
            icon={Wallet}
          />
        </div>

        <Card className="border-slate-200 dark:border-slate-700 dark:bg-slate-900/50">
          <CardHeader>
            <CardTitle className="text-slate-900 dark:text-white">
              사용 현황
            </CardTitle>
            <CardDescription className="text-muted-foreground dark:text-slate-400">
              예산 대비 실제 사용 금액
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-x-4 gap-y-1 items-center min-w-0">
              <div className="text-sm md:text-base font-semibold text-slate-900 dark:text-white truncate min-w-0">
                ₩ {(usage?.totalSpent ?? 0).toLocaleString("ko-KR")} / ₩{" "}
                {budget.amount.toLocaleString("ko-KR")}
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs md:text-sm">
                <span className="text-muted-foreground dark:text-slate-400">예산 사용률</span>
                <span className="font-medium text-slate-900 dark:text-white">
                  {usageRate.toFixed(1)}%
                </span>
              </div>
              <Progress
                value={Math.min(usageRate, 100)}
                className={`h-2 dark:bg-slate-800 ${
                  isOverBudget ? "bg-red-200 dark:bg-red-900/30" : isWarning ? "bg-orange-200 dark:bg-orange-900/30" : ""
                }`}
              />
            </div>
            {usage && usage.remaining < 0 && (
              <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <span>예산을 초과했습니다.</span>
              </div>
            )}
          </CardContent>
        </Card>

        {budget.description && (
          <Card className="border-slate-200 dark:border-slate-700 dark:bg-slate-900/50">
            <CardHeader>
              <CardTitle className="text-slate-900 dark:text-white text-base">설명</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground dark:text-slate-300">
                {budget.description}
              </p>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end">
          <Button asChild variant="outline">
            <Link href="/dashboard/budget">
              <ArrowLeft className="h-4 w-4 mr-2" />
              목록으로 돌아가기
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
