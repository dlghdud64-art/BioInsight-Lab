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

// Mock: 팀원별 지출 랭킹 (이번 달 누적 기준)
const teamSpendingRanking = [
  { rank: 1, name: "박연구", amount: 4500000, percent: 36 },
  { rank: 2, name: "김석사", amount: 3200000, percent: 25 },
  { rank: 3, name: "최학부", amount: 1500000, percent: 12 },
  { rank: 4, name: "정인턴", amount: 1200000, percent: 10 },
  { rank: 5, name: "한연구", amount: 1100000, percent: 9 },
];

export default function AnalyticsPage() {
  const [filterValue, setFilterValue] = useState("all");

  // Mock Data: 예산 요약
  const budgetSummary = {
    total: 50000000,      // 총 예산: ₩ 50,000,000
    used: 12500000,       // 현재 사용액: ₩ 12,500,000
    remaining: 37500000,  // 잔액: ₩ 37,500,000
    usageRate: 25,        // 사용률: 25%
  };

  // Mock Data: 월별 지출 추이 (최근 6개월)
  const monthlySpending = [
    { month: "7월", amount: 1800000 },
    { month: "8월", amount: 2100000 },
    { month: "9월", amount: 1950000 },
    { month: "10월", amount: 2400000 },
    { month: "11월", amount: 2200000 },
    { month: "12월", amount: 2050000 },
  ];

  // Mock Data: 카테고리별 비중
  const categorySpending = [
    { name: "시약", value: 45, amount: 5625000, color: "#3b82f6" },
    { name: "장비", value: 30, amount: 3750000, color: "#10b981" },
    { name: "소모품", value: 15, amount: 1875000, color: "#f59e0b" },
    { name: "기타", value: 10, amount: 1250000, color: "#8b5cf6" },
  ];

  // Mock Data: 최근 큰 지출 Top 5
  const topSpending = [
    { id: 1, item: "Gibco FBS (500ml × 10)", vendor: "Thermo Fisher", category: "시약", amount: 2500000, date: "2024-12-15" },
    { id: 2, item: "Centrifuge (고속 원심분리기)", vendor: "Eppendorf", category: "장비", amount: 1800000, date: "2024-11-20" },
    { id: 3, item: "Pipette Tips (10μL × 1000)", vendor: "Corning", category: "소모품", amount: 850000, date: "2024-12-10" },
    { id: 4, item: "DMEM Medium (500ml × 20)", vendor: "Sigma-Aldrich", category: "시약", amount: 720000, date: "2024-11-28" },
    { id: 5, item: "Cell Culture Plate (96-well × 50)", vendor: "Falcon", category: "소모품", amount: 450000, date: "2024-12-05" },
  ];

  const COLORS = categorySpending.map(cat => cat.color);

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 max-w-7xl mx-auto w-full">
      {/* 1. 상단 타이틀 및 글로벌 필터 */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-6">
        <div className="flex flex-col space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">지출 분석 📊</h2>
          <p className="text-muted-foreground">연구비 소진 현황을 확인하세요.</p>
        </div>
        <div className="w-full sm:w-48">
          <Select value={filterValue} onValueChange={setFilterValue}>
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <BarChart data={monthlySpending}>
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
              <PieChart>
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
                <div key={category.name} className="flex items-center justify-between text-sm">
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
        <Card className="lg:col-span-4 shadow-sm">
          <CardHeader>
            <CardTitle>최근 큰 지출</CardTitle>
            <CardDescription>가격이 높은 순서대로 구매 내역 Top 5</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
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
        <Card className="lg:col-span-3 shadow-sm border-slate-200 dark:border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">팀원별 지출 랭킹 🏆</CardTitle>
            <CardDescription>이번 달 누적 지출액 기준</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-4">
            {teamSpendingRanking.map((row) => (
              <div key={row.rank}>
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
