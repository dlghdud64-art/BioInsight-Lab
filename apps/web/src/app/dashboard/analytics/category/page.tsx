"use client";

import Link from "next/link";
import { ArrowLeft, FlaskConical, Microscope } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function CategoryAnalyticsPage() {
  // 차트 데이터
  const data = [
    {
      name: "시약",
      value: 24500000,
      icon: FlaskConical,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-950/30",
    },
    {
      name: "장비",
      value: 12000000,
      icon: Microscope,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-950/30",
    },
  ];

  // 차트 색상 (파랑, 초록)
  const COLORS = ["#2563eb", "#059669"];

  // 금액 포맷터
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW" }).format(value);
  };

  return (
    <div className="flex-1 space-y-6 p-8 pt-6 max-w-7xl mx-auto w-full">
      {/* 상단 뒤로가기 및 타이틀 (이모지 제거) */}
      <div className="mb-8">
        <Link
          href="/dashboard/analytics"
          className="text-sm text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 flex items-center mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          지출 분석 홈으로
        </Link>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          카테고리별 지출 분석
        </h2>
        <p className="text-muted-foreground mt-2">
          어떤 항목에 연구비가 가장 많이 쓰이는지 확인하세요.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 mt-6">
        {/* 좌측: 도넛 차트 */}
        <Card className="shadow-sm border-slate-200 dark:border-slate-800">
          <CardHeader>
            <CardTitle className="text-lg">비중 (도넛 차트)</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center min-h-[350px]">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={110}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                  }}
                />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* 우측: 상세 금액 리스트 */}
        <Card className="shadow-sm border-slate-200 dark:border-slate-800">
          <CardHeader>
            <CardTitle className="text-lg">항목별 상세 금액</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            {data.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.name}
                  className={`flex items-center justify-between p-4 rounded-lg border border-slate-100 dark:border-slate-800 ${item.bg}`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-5 h-5 ${item.color}`} />
                    <span className={`font-bold ${item.color}`}>{item.name}</span>
                  </div>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {formatCurrency(item.value)}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
