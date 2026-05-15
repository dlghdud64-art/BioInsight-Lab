"use client";

/**
 * §11.246b-1 #recharts-dynamic-bundle-split — 호영님 P0 성능 #1+#5
 *
 * 호영님 spec ("scope 축소 — recharts dynamic() 만 먼저"):
 *   - 분석 페이지 진입 시 recharts (~200KB) 즉시 로드 차단
 *   - 페이지 hydration 후 차트 데이터 사용 시점에만 lazy load
 *   - 모바일 throttled 환경에서 KPI 카드 first paint 단축
 *
 * Variant:
 *   - "real" — 실제 monthlySpending 데이터 (color blue + Tooltip + Legend + animation)
 *   - "mockup" — §11.244 Phase B 빈 상태 mockup (gray + no Tooltip + no animation)
 *
 * canonical truth lock:
 *   - recharts API 시그니처 변경 0 (named import 그대로 reuse)
 *   - data shape ({ month: string; amount: number }[]) 보존
 *   - §11.244 Phase B mockup 패턴 (회색 톤 + opacity-40 grayscale wrapper) 분리 X — 호출자가 wrapper 제공
 */

import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  Legend,
} from "recharts";

interface SpendTrendDataPoint {
  month: string;
  amount: number;
}

interface SpendTrendAreaChartProps {
  data: Array<SpendTrendDataPoint>;
  variant?: "real" | "mockup";
}

export default function SpendTrendAreaChart({
  data,
  variant = "real",
}: SpendTrendAreaChartProps) {
  if (variant === "mockup") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="colorMockup" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fill: "#cbd5e1", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#cbd5e1", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <Area
            type="monotone"
            dataKey="amount"
            stroke="#94a3b8"
            strokeWidth={2}
            fill="url(#colorMockup)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fill: "#64748b", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: "#64748b", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => `₩${Math.round(v / 10000)}만`}
        />
        <Tooltip
          contentStyle={{
            borderRadius: "8px",
            border: "1px solid #e2e8f0",
            backgroundColor: "#ffffff",
            color: "#1e293b",
            fontSize: "12px",
          }}
          formatter={(value: number) => [`₩${value.toLocaleString("ko-KR")}`, "지출"]}
        />
        <Legend
          verticalAlign="top"
          align="right"
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: "11px", color: "#64748b" }}
        />
        <Area
          name="실제 지출"
          type="monotone"
          dataKey="amount"
          stroke="#3b82f6"
          strokeWidth={2.5}
          fill="url(#colorActual)"
          dot={{ r: 3, fill: "#3b82f6", stroke: "#fff", strokeWidth: 2 }}
          isAnimationActive
          animationDuration={1200}
          animationEasing="ease-out"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
