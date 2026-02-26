"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { DollarSign, TrendingUp, TrendingDown, Package, FlaskConical, ShoppingCart, ChevronRight } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/**
 * 지출 분석 페이지 (사용자용)
 * 연구비 소진 현황을 확인하는 리포트
 */
const FILTER_OPTIONS = [
  { value: "all", label: "전체 팀원" },
  { value: "team1", label: "1팀 (세포배양)" },
  { value: "team2", label: "2팀 (분자생물)" },
  { value: "lee", label: "이호영 (관리자)" },
];

// Mock: 팀별 예산 요약 (teamId 기준)
const BUDGET_BY_TEAM: Record<string, { total: number; used: number; remaining: number; usageRate: number }> = {
  all: { total: 50000000, used: 12500000, remaining: 37500000, usageRate: 25 },
  team1: { total: 25000000, used: 7200000, remaining: 17800000, usageRate: 29 },
  team2: { total: 20000000, used: 3800000, remaining: 16200000, usageRate: 19 },
  lee: { total: 5000000, used: 1500000, remaining: 3500000, usageRate: 30 },
};

// Mock: 월별 지출 추이 (teamId 포함)
const FULL_MONTHLY_SPENDING = [
  { month: "7월", amount: 1800000, teamId: "all" },
  { month: "8월", amount: 2100000, teamId: "all" },
  { month: "9월", amount: 1950000, teamId: "all" },
  { month: "10월", amount: 2400000, teamId: "all" },
  { month: "11월", amount: 2200000, teamId: "all" },
  { month: "12월", amount: 2050000, teamId: "all" },
  { month: "7월", amount: 900000, teamId: "team1" },
  { month: "8월", amount: 1100000, teamId: "team1" },
  { month: "9월", amount: 950000, teamId: "team1" },
  { month: "10월", amount: 1200000, teamId: "team1" },
  { month: "11월", amount: 1150000, teamId: "team1" },
  { month: "12월", amount: 1900000, teamId: "team1" },
  { month: "7월", amount: 600000, teamId: "team2" },
  { month: "8월", amount: 700000, teamId: "team2" },
  { month: "9월", amount: 650000, teamId: "team2" },
  { month: "10월", amount: 800000, teamId: "team2" },
  { month: "11월", amount: 750000, teamId: "team2" },
  { month: "12월", amount: 300000, teamId: "team2" },
  { month: "7월", amount: 300000, teamId: "lee" },
  { month: "8월", amount: 300000, teamId: "lee" },
  { month: "9월", amount: 350000, teamId: "lee" },
  { month: "10월", amount: 400000, teamId: "lee" },
  { month: "11월", amount: 300000, teamId: "lee" },
  { month: "12월", amount: 250000, teamId: "lee" },
];

// Mock: 카테고리별 비중 (teamId 포함)
const FULL_CATEGORY_SPENDING = [
  { name: "시약", value: 45, amount: 5625000, color: "#3b82f6", teamId: "all" },
  { name: "장비", value: 30, amount: 3750000, color: "#10b981", teamId: "all" },
  { name: "소모품", value: 15, amount: 1875000, color: "#f59e0b", teamId: "all" },
  { name: "기타", value: 10, amount: 1250000, color: "#8b5cf6", teamId: "all" },
  { name: "시약", value: 55, amount: 3960000, color: "#3b82f6", teamId: "team1" },
  { name: "장비", value: 25, amount: 1800000, color: "#10b981", teamId: "team1" },
  { name: "소모품", value: 15, amount: 1080000, color: "#f59e0b", teamId: "team1" },
  { name: "기타", value: 5, amount: 360000, color: "#8b5cf6", teamId: "team1" },
  { name: "시약", value: 40, amount: 1520000, color: "#3b82f6", teamId: "team2" },
  { name: "장비", value: 35, amount: 1330000, color: "#10b981", teamId: "team2" },
  { name: "소모품", value: 15, amount: 570000, color: "#f59e0b", teamId: "team2" },
  { name: "기타", value: 10, amount: 380000, color: "#8b5cf6", teamId: "team2" },
  { name: "시약", value: 50, amount: 750000, color: "#3b82f6", teamId: "lee" },
  { name: "장비", value: 20, amount: 300000, color: "#10b981", teamId: "lee" },
  { name: "소모품", value: 20, amount: 300000, color: "#f59e0b", teamId: "lee" },
  { name: "기타", value: 10, amount: 150000, color: "#8b5cf6", teamId: "lee" },
];

// Mock: 최근 큰 지출 (teamId 포함)
const FULL_TOP_SPENDING = [
  { id: 1, item: "Gibco FBS (500ml × 10)", vendor: "Thermo Fisher", category: "시약", amount: 2500000, date: "2024-12-15", teamId: "all" },
  { id: 2, item: "Centrifuge (고속 원심분리기)", vendor: "Eppendorf", category: "장비", amount: 1800000, date: "2024-11-20", teamId: "all" },
  { id: 3, item: "Pipette Tips (10μL × 1000)", vendor: "Corning", category: "소모품", amount: 850000, date: "2024-12-10", teamId: "all" },
  { id: 4, item: "DMEM Medium (500ml × 20)", vendor: "Sigma-Aldrich", category: "시약", amount: 720000, date: "2024-11-28", teamId: "all" },
  { id: 5, item: "Cell Culture Plate (96-well × 50)", vendor: "Falcon", category: "소모품", amount: 450000, date: "2024-12-05", teamId: "all" },
  { id: 6, item: "FBS 세포배양용 (100ml)", vendor: "Thermo Fisher", category: "시약", amount: 1200000, date: "2024-12-12", teamId: "team1" },
  { id: 7, item: "CO2 인큐베이터 부품", vendor: "Panasonic", category: "장비", amount: 950000, date: "2024-12-08", teamId: "team1" },
  { id: 8, item: "세포배양용 플레이트", vendor: "Corning", category: "소모품", amount: 420000, date: "2024-12-05", teamId: "team1" },
  { id: 9, item: "Trypsin-EDTA", vendor: "Gibco", category: "시약", amount: 380000, date: "2024-12-03", teamId: "team1" },
  { id: 10, item: "세포배양 배지", vendor: "Sigma", category: "시약", amount: 250000, date: "2024-11-28", teamId: "team1" },
  { id: 11, item: "PCR 실험 키트", vendor: "Bio-Rad", category: "시약", amount: 680000, date: "2024-12-10", teamId: "team2" },
  { id: 12, item: "전기영동 장비", vendor: "Eppendorf", category: "장비", amount: 520000, date: "2024-12-01", teamId: "team2" },
  { id: 13, item: "DNA 염색 시약", vendor: "Invitrogen", category: "시약", amount: 350000, date: "2024-12-07", teamId: "team2" },
  { id: 14, item: "마이크로피펫", vendor: "Eppendorf", category: "장비", amount: 280000, date: "2024-12-02", teamId: "team2" },
  { id: 15, item: "실험용 튜브", vendor: "Falcon", category: "소모품", amount: 120000, date: "2024-11-30", teamId: "team2" },
  { id: 16, item: "관리용 소모품", vendor: "Sigma", category: "소모품", amount: 280000, date: "2024-12-14", teamId: "lee" },
  { id: 17, item: "사무용품", vendor: "기타", category: "기타", amount: 150000, date: "2024-12-10", teamId: "lee" },
  { id: 18, item: "소프트웨어 라이선스", vendor: "Adobe", category: "기타", amount: 200000, date: "2024-12-01", teamId: "lee" },
];

// Mock: 팀원별 지출 랭킹 (teamId 포함)
const FULL_TEAM_SPENDING_RANKING = [
  { rank: 1, name: "박연구", amount: 4500000, percent: 36, teamId: "all" },
  { rank: 2, name: "김석사", amount: 3200000, percent: 25, teamId: "all" },
  { rank: 3, name: "최학부", amount: 1500000, percent: 12, teamId: "all" },
  { rank: 4, name: "정인턴", amount: 1200000, percent: 10, teamId: "all" },
  { rank: 5, name: "한연구", amount: 1100000, percent: 9, teamId: "all" },
  { rank: 1, name: "박연구", amount: 2800000, percent: 39, teamId: "team1" },
  { rank: 2, name: "김석사", amount: 2200000, percent: 31, teamId: "team1" },
  { rank: 3, name: "최학부", amount: 2200000, percent: 31, teamId: "team1" },
  { rank: 1, name: "최학부", amount: 1800000, percent: 47, teamId: "team2" },
  { rank: 2, name: "정인턴", amount: 1200000, percent: 32, teamId: "team2" },
  { rank: 3, name: "한연구", amount: 800000, percent: 21, teamId: "team2" },
  { rank: 1, name: "이호영", amount: 1500000, percent: 100, teamId: "lee" },
];

export default function AnalyticsPage() {
  const [selectedTeam, setSelectedTeam] = useState("all");

  // 팀별 데이터 필터링
  const budgetSummary = BUDGET_BY_TEAM[selectedTeam] ?? BUDGET_BY_TEAM.all;

  const monthlySpending = selectedTeam === "all"
    ? FULL_MONTHLY_SPENDING.filter((d) => d.teamId === "all")
    : FULL_MONTHLY_SPENDING.filter((d) => d.teamId === selectedTeam);

  const categorySpending = FULL_CATEGORY_SPENDING.filter(
    (d) => d.teamId === selectedTeam
  );

  const topSpending = FULL_TOP_SPENDING.filter(
    (d) => d.teamId === selectedTeam
  )
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  const teamSpendingRanking = FULL_TEAM_SPENDING_RANKING.filter(
    (d) => d.teamId === selectedTeam
  );

  const COLORS = categorySpending.map((cat) => cat.color);

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 max-w-7xl mx-auto w-full">
      {/* 1. 상단 타이틀 및 글로벌 필터 */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-6">
        <div className="flex flex-col space-y-2">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">지출 분석</h2>
          <p className="text-muted-foreground">연구비 소진 현황을 확인하세요.</p>
        </div>
        <div className="w-full sm:w-48">
          <Select value={selectedTeam} onValueChange={setSelectedTeam}>
            <SelectTrigger className="bg-white dark:bg-slate-950">
              <SelectValue placeholder="조직 단위 선택" />
            </SelectTrigger>
            <SelectContent>
              {FILTER_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <Separator />

      {/* 요약 카드 (Stats) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">총 예산</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₩ {budgetSummary.total.toLocaleString("ko-KR")}</div>
            <p className="text-xs text-muted-foreground mt-1">
              연간 연구비
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">현재 사용액</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₩ {budgetSummary.used.toLocaleString("ko-KR")}</div>
            <p className="text-xs text-muted-foreground mt-1">
              사용률: {budgetSummary.usageRate}%
            </p>
            <div className="mt-2 h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all"
                style={{ width: `${budgetSummary.usageRate}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">잔액</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₩ {budgetSummary.remaining.toLocaleString("ko-KR")}</div>
            <p className="text-xs text-muted-foreground mt-1">
              남은 예산
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 메인 차트 (Charts) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 월별 지출 추이 (Bar Chart) */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="space-y-1">
              <CardTitle>월별 지출 추이</CardTitle>
              <CardDescription>최근 6개월간 지출액 변화</CardDescription>
            </div>
            <Button variant="ghost" size="sm" className="text-slate-500 hover:text-blue-600 text-sm shrink-0" asChild>
              <Link href="/dashboard/analytics/monthly">
                상세보기 <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlySpending} key={selectedTeam}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis 
                  dataKey="month" 
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  stroke="#cbd5e1"
                />
                <YAxis 
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  stroke="#cbd5e1"
                  tickFormatter={(value) => `₩${(value / 1000000).toFixed(1)}M`}
                />
                <Tooltip 
                  cursor={{ fill: 'transparent' }}
                  contentStyle={{ 
                    borderRadius: '8px', 
                    border: 'none', 
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    backgroundColor: 'white'
                  }}
                  formatter={(value: number) => [`₩ ${value.toLocaleString("ko-KR")}`, "지출액"]}
                />
                <Bar 
                  dataKey="amount" 
                  fill="#3b82f6" 
                  radius={[4, 4, 0, 0]}
                  barSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* 카테고리별 비중 (Pie Chart) */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="space-y-1">
              <CardTitle>카테고리별 비중</CardTitle>
              <CardDescription>시약, 장비, 소모품 비율</CardDescription>
            </div>
            <Button variant="ghost" size="sm" className="text-slate-500 hover:text-blue-600 text-sm shrink-0" asChild>
              <Link href="/dashboard/analytics/category">
                상세보기 <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart key={selectedTeam}>
                <Pie
                  data={categorySpending}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {categorySpending.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '8px', 
                    border: 'none', 
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    backgroundColor: 'white'
                  }}
                  formatter={(value: number, name: string, props: any) => [
                    `₩ ${props.payload.amount.toLocaleString("ko-KR")}`,
                    `${name} (${value}%)`
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 space-y-2">
              {categorySpending.map((category) => (
                <div key={`${category.name}-${category.teamId}`} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: category.color }}
                    />
                    <span className="text-slate-600">{category.name}</span>
                  </div>
                  <span className="font-medium">₩ {category.amount.toLocaleString("ko-KR")}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 2. 하단 레이아웃 분할 (7-Grid): 최근 큰 지출 + 팀원별 지출 랭킹 */}
      <div className="grid grid-cols-1 lg:grid-cols-7 gap-4 mt-4">
        {/* 좌측: 최근 큰 지출 (col-span-4) */}
        <Card className="lg:col-span-4 shadow-sm" key={`top-${selectedTeam}`}>
          <CardHeader>
            <CardTitle>최근 큰 지출</CardTitle>
            <CardDescription>가격이 높은 순서대로 구매 내역 Top 5</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table className="min-w-[600px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">순위</TableHead>
                    <TableHead>품목명</TableHead>
                    <TableHead>벤더</TableHead>
                    <TableHead>카테고리</TableHead>
                    <TableHead className="text-right">금액</TableHead>
                    <TableHead>구매일</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topSpending.map((item, index) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-semibold dark:bg-slate-800 dark:text-slate-300">
                          {index + 1}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{item.item}</TableCell>
                      <TableCell>{item.vendor}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {item.category === "시약" && <FlaskConical className="h-4 w-4 text-blue-600" />}
                          {item.category === "장비" && <Package className="h-4 w-4 text-green-600" />}
                          {item.category === "소모품" && <ShoppingCart className="h-4 w-4 text-orange-600" />}
                          <span>{item.category}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        ₩ {item.amount.toLocaleString("ko-KR")}
                      </TableCell>
                      <TableCell className="text-slate-600 dark:text-slate-400">
                        {new Date(item.date).toLocaleDateString("ko-KR")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* 우측: 팀원별 지출 랭킹 (col-span-3) */}
        <Card className="lg:col-span-3 shadow-sm border-slate-200 dark:border-slate-800" key={selectedTeam}>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">팀원별 지출 랭킹</CardTitle>
            <CardDescription>이번 달 누적 지출액 기준</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-4">
            {teamSpendingRanking.map((row) => (
              <div key={`${row.name}-${row.rank}-${selectedTeam}`}>
                <div className="flex justify-between text-sm mb-2">
                  <span className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        row.rank === 1
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
                          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                      }`}
                    >
                      {row.rank}
                    </span>
                    {row.name}
                  </span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    ₩ {row.amount.toLocaleString("ko-KR")}
                    <span className="text-slate-400 dark:text-slate-500 font-normal text-xs ml-1">
                      ({row.percent}%)
                    </span>
                  </span>
                </div>
                <Progress
                  value={row.percent}
                  className={`h-2 bg-slate-100 dark:bg-slate-800 ${
                    row.rank === 1 ? "[&>div]:bg-blue-600" : "[&>div]:bg-slate-500"
                  }`}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
