"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

// 가상 12개월 데이터 (단위: 원)
const monthlyData2026 = [
  { month: "1월", amount: 1850000 },
  { month: "2월", amount: 1620000 },
  { month: "3월", amount: 2100000 },
  { month: "4월", amount: 1980000 },
  { month: "5월", amount: 2350000 },
  { month: "6월", amount: 2200000 },
  { month: "7월", amount: 1800000 },
  { month: "8월", amount: 2100000 },
  { month: "9월", amount: 1950000 },
  { month: "10월", amount: 2400000 },
  { month: "11월", amount: 2200000 },
  { month: "12월", amount: 2050000 },
];

const monthlyData2025 = monthlyData2026.map((d, i) => ({
  ...d,
  amount: Math.round(d.amount * (0.85 + Math.random() * 0.2)),
}));

export default function MonthlyAnalyticsPage() {
  const [year, setYear] = useState("2026");
  const data = year === "2026" ? monthlyData2026 : monthlyData2025;

  return (
    <div className="flex-1 space-y-6 p-8 pt-6 w-full max-w-6xl mx-auto">
      <div className="flex flex-col space-y-4 mb-6">
        <Button variant="ghost" className="w-fit -ml-2 text-slate-500 hover:text-blue-600" asChild>
          <Link href="/dashboard/analytics">
            <ArrowLeft className="mr-2 h-4 w-4" />
            지출 분석 홈으로 돌아가기
          </Link>
        </Button>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">월별 지출 상세 분석</h2>
            <p className="text-muted-foreground mt-1">
              12개월간의 예산 소진 흐름을 상세하게 확인하세요.
            </p>
          </div>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-[140px] h-10 border-slate-200">
              <SelectValue placeholder="연도 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2026">2026년</SelectItem>
              <SelectItem value="2025">2025년</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="shadow-sm border-slate-200">
        <CardHeader>
          <CardTitle>월별 지출 추이 (단위: 만원)</CardTitle>
          <p className="text-sm text-muted-foreground">연도별 월간 지출액을 막대 그래프로 확인할 수 있습니다.</p>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="month"
                  tick={{ fill: "#64748b", fontSize: 12 }}
                  stroke="#cbd5e1"
                />
                <YAxis
                  tick={{ fill: "#64748b", fontSize: 12 }}
                  stroke="#cbd5e1"
                  tickFormatter={(value) => `₩${(value / 10000).toFixed(0)}만`}
                />
                <Tooltip
                  cursor={{ fill: "rgba(0,0,0,0.04)" }}
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    backgroundColor: "white",
                  }}
                  formatter={(value: number) => [`₩ ${value.toLocaleString("ko-KR")}`, "지출액"]}
                />
                <Bar
                  dataKey="amount"
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                  barSize={32}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-slate-200">
        <CardHeader>
          <CardTitle>월별 지출액 상세</CardTitle>
          <p className="text-sm text-muted-foreground">월별 지출 금액을 표로 확인합니다.</p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>월</TableHead>
                  <TableHead className="text-right">지출액 (원)</TableHead>
                  <TableHead className="text-right">지출액 (만원)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row) => (
                  <TableRow key={row.month}>
                    <TableCell className="font-medium">{row.month}</TableCell>
                    <TableCell className="text-right">
                      ₩ {row.amount.toLocaleString("ko-KR")}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {(row.amount / 10000).toFixed(1)}만
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
