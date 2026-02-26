"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import {
  DollarSign,
  FileText,
  Package,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Mock 데이터 (데이터가 없을 때 사용)
const MOCK_MONTHLY_SPENDING = [
  { month: "2024-07", amount: 2500000 },
  { month: "2024-08", amount: 3200000 },
  { month: "2024-09", amount: 2800000 },
  { month: "2024-10", amount: 3500000 },
  { month: "2024-11", amount: 3100000 },
  { month: "2024-12", amount: 2900000 },
];

const MOCK_CATEGORY_SPENDING = [
  { category: "시약 (Reagent)", amount: 8500000 },
  { category: "소모품", amount: 3200000 },
  { category: "장비", amount: 1500000 },
  { category: "기타", amount: 800000 },
];

const COLORS = ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#6366f1"];

export function ExecutiveDashboard() {
  const { data: session, status } = useSession();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const response = await fetch("/api/dashboard/stats");
      if (!response.ok) throw new Error("Failed to fetch dashboard stats");
      return response.json();
    },
    enabled: status === "authenticated",
  });

  // 데이터가 없을 때 Mock 데이터 사용
  const hasData = stats && (stats.thisMonthPurchaseAmount > 0 || stats.totalAssetValue > 0);
  const useMockData = !hasData && !isLoading;

  // 이번 달 지출
  const thisMonthSpending = stats?.thisMonthPurchaseAmount || 0;
  const monthOverMonthChange = parseFloat(stats?.monthOverMonthChange || "0");
  const isIncrease = monthOverMonthChange > 0;

  // 진행 중인 견적 (RESPONDED, COMPLETED 상태의 총액)
  const pendingQuotesAmount = stats?.quoteStats?.pendingAmount || 0;
  const mockPendingQuotesAmount = useMockData ? 3500000 : 0;

  // 보유 자산 가치
  const totalAssetValue = stats?.totalAssetValue || 0;
  const mockAssetValue = useMockData ? 12500000 : 0;

  // 재고 부족 알림
  const reorderNeededCount = stats?.reorderNeededCount || 0;
  const mockReorderCount = useMockData ? 3 : 0;

  // 월별 지출 추이
  const monthlySpending = useMockData
    ? MOCK_MONTHLY_SPENDING
    : stats?.monthlySpending?.map((item: any) => ({
        month: item.month.slice(5), // "MM" 형식으로 변환
        amount: item.amount || 0,
      })) || [];

  // 카테고리별 지출 비중
  const categorySpending = useMockData
    ? MOCK_CATEGORY_SPENDING
    : stats?.categorySpending?.map((item: any) => ({
        category: item.category || "기타",
        amount: item.amount || 0,
      })) || [];

  const totalCategoryAmount = categorySpending.reduce(
    (sum: number, item: any) => sum + (item.amount || 0),
    0
  );

  const categoryData = categorySpending.map((item: any) => ({
    name: item.category,
    value: item.amount || 0,
    percentage: totalCategoryAmount > 0
      ? ((item.amount || 0) / totalCategoryAmount * 100).toFixed(1)
      : "0",
  }));

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32 mb-2" />
                <Skeleton className="h-3 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 이번 달 지출 */}
        <Card className={cn("relative overflow-hidden", useMockData && "opacity-60")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">이번 달 지출</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-1">
              <div className="text-2xl xl:text-3xl font-bold tracking-tight text-slate-900 dark:text-white break-words">
                ₩{(useMockData ? 2900000 : thisMonthSpending).toLocaleString()}
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                {useMockData ? (
                  <>
                    <TrendingDown className="h-3 w-3 text-green-600" />
                    <span className="text-green-600">전월 대비 -7.2%</span>
                  </>
                ) : monthOverMonthChange !== 0 ? (
                  <>
                    {isIncrease ? (
                      <TrendingUp className="h-3 w-3 text-red-600" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-green-600" />
                    )}
                    <span className={isIncrease ? "text-red-600" : "text-green-600"}>
                      전월 대비 {Math.abs(monthOverMonthChange).toFixed(1)}%
                      {isIncrease ? " 증가" : " 감소"}
                    </span>
                  </>
                ) : (
                  <span>전월 대비 변화 없음</span>
                )}
              </div>
            </div>
            {useMockData && (
              <p className="text-xs text-muted-foreground mt-2 italic">
                예시 데이터
              </p>
            )}
          </CardContent>
        </Card>

        {/* 진행 중인 견적 */}
        <Card className={cn("relative overflow-hidden", useMockData && "opacity-60")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">진행 중인 견적</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₩{(useMockData ? mockPendingQuotesAmount : pendingQuotesAmount).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              승인 대기 중인 예상 지출
            </p>
            {useMockData && (
              <p className="text-xs text-muted-foreground mt-2 italic">
                예시 데이터
              </p>
            )}
          </CardContent>
        </Card>

        {/* 보유 자산 가치 */}
        <Card className={cn("relative overflow-hidden", useMockData && "opacity-60")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">보유 자산 가치</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₩{(useMockData ? mockAssetValue : totalAssetValue).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              랩 냉장고 시약 총액
            </p>
            {useMockData && (
              <p className="text-xs text-muted-foreground mt-2 italic">
                예시 데이터
              </p>
            )}
          </CardContent>
        </Card>

        {/* 재고 부족 알림 */}
        <Card className={cn("relative overflow-hidden", useMockData && "opacity-60")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">재고 부족 알림</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {useMockData ? mockReorderCount : reorderNeededCount}개 품목
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              곧 동납니다
            </p>
            <Link href="/my/orders" className="mt-2 inline-block">
              <Button variant="ghost" size="sm" className="h-7 text-xs">
                주문하기
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </Link>
            {useMockData && (
              <p className="text-xs text-muted-foreground mt-2 italic">
                예시 데이터
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 지출 추이 (Line Chart) */}
        <Card className={cn(useMockData && "opacity-60")}>
          <CardHeader>
            <CardTitle>지출 추이</CardTitle>
            <CardDescription>
              지난달보다 돈을 아꼈나요?
            </CardDescription>
          </CardHeader>
          <CardContent>
            {monthlySpending.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlySpending}>
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => `${value}월`}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => `₩${(value / 1000000).toFixed(0)}M`}
                  />
                  <Tooltip
                    formatter={(value: number) => [`₩${value.toLocaleString()}`, "지출"]}
                    labelFormatter={(label) => `${label}월`}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="amount"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    name="지출"
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                데이터가 없습니다
              </div>
            )}
            {useMockData && (
              <p className="text-xs text-muted-foreground mt-2 text-center italic">
                예시 데이터
              </p>
            )}
          </CardContent>
        </Card>

        {/* 예산 비중 (Donut Chart) */}
        <Card className={cn(useMockData && "opacity-60")}>
          <CardHeader>
            <CardTitle>예산 비중</CardTitle>
            <CardDescription>
              우리가 시약(Reagent)에 돈을 제일 많이 쓰는구나
            </CardDescription>
          </CardHeader>
          <CardContent>
            {categoryData.length > 0 ? (
              <div className="space-y-4">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {categoryData.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number, name: string, props: any) => [
                        `₩${value.toLocaleString()} (${props.payload.percentage}%)`,
                        name,
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {categoryData.map((item: any, index: number) => (
                    <div
                      key={index}
                      className="flex items-center justify-between text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span>{item.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          ₩{item.value.toLocaleString()}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          ({item.percentage}%)
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                데이터가 없습니다
              </div>
            )}
            {useMockData && (
              <p className="text-xs text-muted-foreground mt-2 text-center italic">
                예시 데이터
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

