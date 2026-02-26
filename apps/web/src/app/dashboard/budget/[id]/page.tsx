import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import Link from "next/link";
import { Wallet, Calendar, ArrowLeft } from "lucide-react";

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

// TODO: 실제 API 연동 시 이 부분을 서버 요청으로 대체하세요.
const MOCK_BUDGETS: Budget[] = [
  {
    id: "1",
    name: "2026 상반기 시약비",
    amount: 50000000,
    currency: "KRW",
    periodStart: "2026-01-01",
    periodEnd: "2026-06-30",
    targetDepartment: "기초연구팀",
    projectName: "R&D 프로젝트",
    description: "상반기 시약 및 소모품 구매 예산",
    usage: {
      totalSpent: 12500000,
      usageRate: 25,
      remaining: 37500000,
    },
  },
];

export default function BudgetDetailPage({ params }: { params: { id: string } }) {
  const id = params?.id;

  if (!id) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0b1120]">
        <p className="text-sm text-slate-500 dark:text-slate-400">잘못된 접근입니다.</p>
      </div>
    );
  }

  const budget = MOCK_BUDGETS.find((b) => b.id === id);

  if (!budget) {
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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b1120] py-8 px-4 md:px-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-600 flex items-center justify-center text-white">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-white break-keep">
                예산 상세: {budget.name}
              </h1>
              <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">
                조직/팀별 예산 현황과 사용률을 한눈에 확인합니다.
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/budget"
            className="inline-flex items-center text-xs md:text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            목록으로
          </Link>
        </div>

        <Card className="shadow-sm border-slate-200 bg-white/90 dark:bg-slate-900/60">
          <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <CardTitle className="text-lg md:text-xl font-semibold text-slate-900 dark:text-white break-keep">
                {budget.name}
              </CardTitle>
              <CardDescription className="mt-1 text-xs md:text-sm flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-slate-500 dark:text-slate-400">
                  {startStr} ~ {endStr}
                </span>
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              {budget.targetDepartment && (
                <Badge variant="outline" className="bg-slate-50 dark:bg-slate-800/60 text-xs">
                  {budget.targetDepartment}
                </Badge>
              )}
              {budget.projectName && (
                <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950/40 text-xs">
                  {budget.projectName}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400">예산 금액</p>
                <p className="text-2xl xl:text-3xl font-extrabold tracking-tighter text-slate-900 dark:text-white break-keep">
                  ₩ {budget.amount.toLocaleString("ko-KR")}
                </p>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400">사용 금액</p>
                <p className="text-2xl xl:text-3xl font-extrabold tracking-tighter text-slate-900 dark:text-white break-keep">
                  ₩ {(usage?.totalSpent ?? 0).toLocaleString("ko-KR")}
                </p>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400">잔여 금액</p>
                <p className="text-2xl xl:text-3xl font-extrabold tracking-tighter break-keep text-emerald-600 dark:text-emerald-400">
                  ₩ {(usage?.remaining ?? budget.amount).toLocaleString("ko-KR")}
                </p>
              </div>
            </div>

            {usage && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs md:text-sm">
                  <span className="text-slate-500 dark:text-slate-400">예산 사용률</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {usageRate.toFixed(1)}%
                  </span>
                </div>
                <Progress value={Math.min(usageRate, 100)} className="h-2" />
              </div>
            )}

            {budget.description && (
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300 break-keep">
                  {budget.description}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

