"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { DollarSign, TrendingUp, TrendingDown, Package, AlertCircle, Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface DashboardStats {
  thisMonthPurchaseAmount: number;
  monthOverMonthChange: string;
  totalAssetValue: number;
  reorderNeededCount: number;
  monthlySpending: Array<{ month: string; amount: number }>;
  categorySpending: Array<{ category: string; amount: number }>;
}

export function AnalyticsDashboard() {
  const { data, isLoading, error } = useQuery<DashboardStats>({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const response = await fetch("/api/dashboard/stats");
      if (!response.ok) throw new Error("Failed to fetch dashboard stats");
      const result = await response.json();
      return {
        thisMonthPurchaseAmount: result.thisMonthPurchaseAmount || 0,
        monthOverMonthChange: result.monthOverMonthChange || "0",
        totalAssetValue: result.totalAssetValue || 0,
        reorderNeededCount: result.reorderNeededCount || 0,
        monthlySpending: result.monthlySpending || [],
        categorySpending: result.categorySpending || [],
      };
    },
  });

  if (error) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertCircle className="h-8 w-8 mx-auto text-red-500 mb-2" />
          <p className="text-sm text-muted-foreground">데이터를 불러오는 중 오류가 발생했습니다.</p>
        </CardContent>
      </Card>
    );
  }

  const monthOverMonthChangeNum = parseFloat(data?.monthOverMonthChange || "0");
  const isPositive = monthOverMonthChangeNum >= 0;

  // 인사이트 생성
  const insights = generateInsights(data);

  // 차트 색상 팔레트
  const CHART_COLORS = [
    "#3b82f6", // blue-500
    "#8b5cf6", // violet-500
    "#ec4899", // pink-500
    "#f59e0b", // amber-500
    "#10b981", // emerald-500
    "#ef4444", // red-500
    "#06b6d4", // cyan-500
    "#f97316", // orange-500
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* 이번 달 지출 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">이번 달 지출</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  ₩{data?.thisMonthPurchaseAmount.toLocaleString("ko-KR") || "0"}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                  <span>전월 대비</span>
                  <span
                    className={cn(
                      "font-semibold",
                      isPositive ? "text-blue-600" : "text-red-600"
                    )}
                  >
                    {isPositive ? "+" : ""}
                    {data?.monthOverMonthChange || "0"}%
                  </span>
                  {isPositive ? (
                    <TrendingUp className="h-3 w-3 text-blue-600" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-600" />
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* 전월 대비 증감 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">전월 대비 증감</CardTitle>
            {isPositive ? (
              <TrendingUp className="h-4 w-4 text-blue-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <>
                <div
                  className={cn(
                    "text-2xl font-bold",
                    isPositive ? "text-blue-600" : "text-red-600"
                  )}
                >
                  {isPositive ? "+" : ""}
                  {data?.monthOverMonthChange || "0"}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {isPositive ? "지출이 증가했습니다" : "지출이 감소했습니다"}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* 보유 자산 총액 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">보유 자산 총액</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  ₩{data?.totalAssetValue.toLocaleString("ko-KR") || "0"}
                </div>
                <p className="text-xs text-muted-foreground mt-1">인벤토리 총 가치</p>
              </>
            )}
          </CardContent>
        </Card>

        {/* 재주문 필요 품목 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">재주문 필요</CardTitle>
            <AlertCircle className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {data?.reorderNeededCount || 0}
                  <span className="text-lg font-normal text-muted-foreground ml-1">개</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">재고 부족 또는 품절</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* 월별 지출 추이 */}
        <Card>
          <CardHeader>
            <CardTitle>월별 지출 추이</CardTitle>
            <CardDescription>최근 6개월간 지출 추이</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data?.monthlySpending || []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => {
                      const [year, month] = value.split("-");
                      return `${year}.${month}`;
                    }}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => `₩${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(value: number) => [`₩${value.toLocaleString("ko-KR")}`, "지출"]}
                    labelFormatter={(label) => `월: ${label}`}
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="amount"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ fill: "#3b82f6", r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* 카테고리별 지출 비중 */}
        <Card>
          <CardHeader>
            <CardTitle>카테고리별 지출 비중</CardTitle>
            <CardDescription>카테고리별 지출 분포</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : data?.categorySpending && data.categorySpending.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={data.categorySpending}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ category, percent }) =>
                      `${category}: ${(percent * 100).toFixed(0)}%`
                    }
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="amount"
                  >
                    {data.categorySpending.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={CHART_COLORS[index % CHART_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [`₩${value.toLocaleString("ko-KR")}`, "지출"]}
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                <p className="text-sm">데이터가 없습니다</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Insight Section */}
      {insights.length > 0 && (
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-600" />
              <CardTitle>스마트 인사이트</CardTitle>
            </div>
            <CardDescription>데이터 기반 인사이트와 조언</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {insights.map((insight, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-3 bg-white rounded-lg border border-blue-100"
                >
                  <div
                    className={cn(
                      "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold",
                      insight.type === "positive"
                        ? "bg-emerald-100 text-emerald-700"
                        : insight.type === "warning"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-blue-100 text-blue-700"
                    )}
                  >
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-900">{insight.message}</p>
                    {insight.badge && (
                      <Badge variant="outline" className="mt-2 text-xs">
                        {insight.badge}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// 인사이트 생성 함수
function generateInsights(data: DashboardStats | undefined): Array<{
  type: "positive" | "warning" | "info";
  message: string;
  badge?: string;
}> {
  if (!data) return [];

  const insights: Array<{
    type: "positive" | "warning" | "info";
    message: string;
    badge?: string;
  }> = [];

  const monthOverMonthChangeNum = parseFloat(data.monthOverMonthChange || "0");

  // 전월 대비 증감 인사이트
  if (Math.abs(monthOverMonthChangeNum) > 5) {
    if (monthOverMonthChangeNum < 0) {
      insights.push({
        type: "positive",
        message: `지난달보다 지출이 ${Math.abs(monthOverMonthChangeNum).toFixed(1)}% 줄었습니다. 훌륭합니다!`,
        badge: "절감 성공",
      });
    } else {
      insights.push({
        type: "warning",
        message: `지난달보다 지출이 ${monthOverMonthChangeNum.toFixed(1)}% 증가했습니다. 예산 관리에 주의하세요.`,
        badge: "지출 증가",
      });
    }
  }

  // 재주문 필요 품목 인사이트
  if (data.reorderNeededCount > 0) {
    insights.push({
      type: "warning",
      message: `재주문이 필요한 품목이 ${data.reorderNeededCount}개 있습니다. 빠른 조치가 필요합니다.`,
      badge: "재고 부족",
    });
  }

  // 카테고리별 지출 인사이트
  if (data.categorySpending && data.categorySpending.length > 0) {
    const topCategory = data.categorySpending.reduce((prev, current) =>
      prev.amount > current.amount ? prev : current
    );
    const totalCategorySpending = data.categorySpending.reduce(
      (sum, cat) => sum + cat.amount,
      0
    );
    const topCategoryPercentage = (topCategory.amount / totalCategorySpending) * 100;

    if (topCategoryPercentage > 40) {
      insights.push({
        type: "info",
        message: `${topCategory.category} 카테고리가 전체 지출의 ${topCategoryPercentage.toFixed(0)}%를 차지합니다.`,
        badge: topCategory.category,
      });
    }
  }

  // 월별 추이 인사이트
  if (data.monthlySpending && data.monthlySpending.length >= 2) {
    const recent = data.monthlySpending.slice(-2);
    const trend = recent[1].amount - recent[0].amount;
    const trendPercentage = recent[0].amount > 0 ? (trend / recent[0].amount) * 100 : 0;

    if (Math.abs(trendPercentage) > 10) {
      if (trend < 0) {
        insights.push({
          type: "positive",
          message: `최근 지출 추이가 하락세입니다. 지출 관리가 잘 되고 있습니다.`,
          badge: "하락 추세",
        });
      } else {
        insights.push({
          type: "warning",
          message: `최근 지출 추이가 상승세입니다. 예산 계획을 재검토해보세요.`,
          badge: "상승 추세",
        });
      }
    }
  }

  return insights.slice(0, 3); // 최대 3개만 표시
}


