"use client";

/**
 * §11.246d-4-cont-3 #rum-trend-line-chart — 호영님 §11.246d-4-cont-2 자연 후속.
 *
 * Core Web Vitals 일자별 p75 line chart. 단일 metric 표시 (lcp | cls | inp).
 *   호영님 결정: 3 separate LineChart vertical stack — 각 chart 단일 y-axis.
 *   CLS unitless 구분 명확, dual y-axis 회피, 단순 구성.
 *
 * §11.246b-1 dynamic import target — page 가 nextDynamic 으로 lazy load.
 *
 * canonical truth lock:
 *   - data shape ({ date: string, lcp_p75 | cls_p75 | inp_p75: number | null })
 *     = server timeseries endpoint response 와 정합.
 *   - recharts named import (§11.246b-1 패턴 reuse).
 */

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type Metric = "lcp" | "cls" | "inp";

interface RumTrendDataPoint {
  date: string;
  lcp_p75: number | null;
  cls_p75: number | null;
  inp_p75: number | null;
}

interface RumTrendLineChartProps {
  data: Array<RumTrendDataPoint>;
  metric: Metric;
}

const METRIC_CONFIG: Record<
  Metric,
  { key: keyof RumTrendDataPoint; label: string; unit: string; color: string }
> = {
  lcp: {
    key: "lcp_p75",
    label: "LCP p75",
    unit: "ms",
    color: "#3b82f6", // blue-500
  },
  cls: {
    key: "cls_p75",
    label: "CLS p75",
    unit: "",
    color: "#10b981", // emerald-500
  },
  inp: {
    key: "inp_p75",
    label: "INP p75",
    unit: "ms",
    color: "#f59e0b", // amber-500
  },
};

function formatTickValue(metric: Metric, v: number): string {
  if (metric === "cls") return v.toFixed(2);
  return `${Math.round(v)}ms`;
}

export default function RumTrendLineChart({
  data,
  metric,
}: RumTrendLineChartProps) {
  const cfg = METRIC_CONFIG[metric];

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: "#64748b", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(d: string) => d.slice(5)} /* MM-DD */
        />
        <YAxis
          tick={{ fill: "#64748b", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => formatTickValue(metric, v)}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(value: number) => [
            metric === "cls" ? value.toFixed(3) : `${Math.round(value)}ms`,
            cfg.label,
          ]}
          labelFormatter={(d: string) => d}
        />
        <Line
          type="monotone"
          dataKey={cfg.key}
          stroke={cfg.color}
          strokeWidth={2}
          dot={{ r: 3, fill: cfg.color }}
          activeDot={{ r: 5 }}
          isAnimationActive={true}
          connectNulls={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
