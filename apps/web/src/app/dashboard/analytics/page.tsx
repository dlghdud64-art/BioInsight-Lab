"use client";

export const dynamic = 'force-dynamic';

import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/app/_components/page-header";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, Users, ShoppingCart, FileText, Share2, Target, Activity } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";

/**
 * KPI 대시보드 페이지
 * PRD 14.2, 14.3 기반
 */
export default function AnalyticsPage() {
  const { data: session, status } = useSession();
  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("30d");

  // KPI 데이터 조회
  const { data: kpiData, isLoading } = useQuery({
    queryKey: ["analytics-kpi", period],
    queryFn: async () => {
      const response = await fetch(`/api/analytics/kpi?period=${period}`);
      if (!response.ok) throw new Error("Failed to fetch KPI data");
      return response.json();
    },
    enabled: status === "authenticated",
  });

  if (status === "loading" || isLoading) {
    return (
      <div className="w-full px-4 md:px-6 py-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <p className="text-muted-foreground">로딩 중...</p>
          </div>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="w-full px-4 md:px-6 py-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <p className="text-muted-foreground">로그인이 필요합니다.</p>
          </div>
        </div>
      </div>
    );
  }

  const kpi = kpiData || {
    activation: {
      searchRunRate: 0,
      addToCompareRate: 0,
      exportRate: 0,
    },
    value: {
      listCreationRate: 0,
      avgItemCount: 0,
    },
    retention: {
      returnRate: 0,
      avgSessionsPerUser: 0,
    },
    revenue: {
      shareLinkRate: 0,
      rfqCreationRate: 0,
      budgetUsageRate: 0,
    },
    quality: {
      protocolAcceptRate: 0,
      aiConfidenceRate: 0,
    },
  };

  // 차트 데이터 준비
  const activationData = [
    { name: "검색 실행", value: kpi.activation.searchRunRate, target: 60 },
    { name: "비교 추가", value: kpi.activation.addToCompareRate, target: 30 },
    { name: "내보내기", value: kpi.activation.exportRate, target: 15 },
  ];

  const valueData = [
    { name: "리스트 생성", value: kpi.value.listCreationRate, target: 10 },
    { name: "평균 품목 수", value: kpi.value.avgItemCount, target: 3 },
  ];

  return (
    <div className="w-full px-4 md:px-6 py-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <PageHeader
            title="KPI 대시보드"
            description="서비스 사용 현황 및 핵심 지표를 확인하세요"
            icon={Activity}
          />
          <Select value={period} onValueChange={(value: "7d" | "30d" | "90d") => setPeriod(value)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">최근 7일</SelectItem>
              <SelectItem value="30d">최근 30일</SelectItem>
              <SelectItem value="90d">최근 90일</SelectItem>
            </SelectContent>
          </Select>
        </div>

          {/* P0 핵심 KPI */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                  검색 실행률
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpi.activation.searchRunRate.toFixed(1)}%</div>
                <div className="text-xs text-muted-foreground mt-1">목표: 60%+</div>
                <div className="mt-2 h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 transition-all"
                    style={{ width: `${Math.min((kpi.activation.searchRunRate / 60) * 100, 100)}%` }}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-green-600" />
                  비교 추가율
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpi.activation.addToCompareRate.toFixed(1)}%</div>
                <div className="text-xs text-muted-foreground mt-1">목표: 30%+</div>
                <div className="mt-2 h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-600 transition-all"
                    style={{ width: `${Math.min((kpi.activation.addToCompareRate / 30) * 100, 100)}%` }}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4 text-purple-600" />
                  내보내기율
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpi.activation.exportRate.toFixed(1)}%</div>
                <div className="text-xs text-muted-foreground mt-1">목표: 15%+</div>
                <div className="mt-2 h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-600 transition-all"
                    style={{ width: `${Math.min((kpi.activation.exportRate / 15) * 100, 100)}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Value 지표 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">산출물 생성률</CardTitle>
                <CardDescription>구매요청 리스트 생성 비율</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold mb-2">{kpi.value.listCreationRate.toFixed(1)}%</div>
                <div className="text-xs text-muted-foreground">목표: 10%+</div>
                <div className="mt-4">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={valueData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" fill="#8884d8" />
                      <Bar dataKey="target" fill="#82ca9d" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">재방문율</CardTitle>
                <CardDescription>7일 내 재방문 비율</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold mb-2">{kpi.retention.returnRate.toFixed(1)}%</div>
                <div className="text-xs text-muted-foreground">목표: 15%+</div>
                <div className="mt-4">
                  <div className="text-sm text-muted-foreground">
                    평균 세션 수: {kpi.retention.avgSessionsPerUser.toFixed(1)}회
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Revenue Proxy 지표 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Share2 className="h-4 w-4 text-orange-600" />
                  공유 링크 생성률
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpi.revenue.shareLinkRate.toFixed(1)}%</div>
                <div className="text-xs text-muted-foreground mt-1">목표: 10%+</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Target className="h-4 w-4 text-red-600" />
                  견적 요청 생성률
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpi.revenue.rfqCreationRate.toFixed(1)}%</div>
                <div className="text-xs text-muted-foreground mt-1">목표: 5%+</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Activity className="h-4 w-4 text-indigo-600" />
                  예산 기능 사용률
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpi.revenue.budgetUsageRate.toFixed(1)}%</div>
                <div className="text-xs text-muted-foreground mt-1">목표: 10%+</div>
              </CardContent>
            </Card>
          </div>

          {/* Quality 지표 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">AI 신뢰도</CardTitle>
              <CardDescription>프로토콜 추출 수정 없이 확정 비율</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold mb-2">{kpi.quality.protocolAcceptRate.toFixed(1)}%</div>
              <div className="text-xs text-muted-foreground">목표: 40%+</div>
              <div className="mt-4">
                <div className="text-sm text-muted-foreground">
                  AI 확신도: {kpi.quality.aiConfidenceRate.toFixed(1)}%
                </div>
              </div>
            </CardContent>
          </Card>
      </div>
    </div>
  );
}











