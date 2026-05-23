"use client";

/**
 * §11.290 Phase 6 #ocr-cost-chart — per-day OcrJob count + costUsd 시각화.
 *
 * spend-trend-area-chart (§11.246b-1) 패턴 정합:
 *   - named recharts import + default export
 *   - caller 가 next/dynamic + ssr:false 로 lazy load (bundle 분리)
 *   - ResponsiveContainer + AreaChart + dual axis (count + costUsd)
 *
 * canonical truth lock:
 *   - data shape ({ day: string; count: number; costUsd: number }[]) 보존
 *   - tooltip + legend 한국어
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

interface OcrCostDataPoint {
  day: string;
  count: number;
  costUsd: number;
}

interface OcrCostChartProps {
  data: Array<OcrCostDataPoint>;
}

export default function OcrCostChart({ data }: OcrCostChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="ocrCount" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="ocrCost" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="day" tick={{ fontSize: 11 }} />
        <YAxis
          yAxisId="left"
          tick={{ fontSize: 11 }}
          label={{ value: "건수", angle: -90, position: "insideLeft", offset: 12, style: { fontSize: 11 } }}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fontSize: 11 }}
          label={{ value: "USD", angle: 90, position: "insideRight", offset: 12, style: { fontSize: 11 } }}
        />
        <Tooltip
          contentStyle={{ fontSize: 12 }}
          formatter={(value: number, name: string) => {
            if (name === "OCR 호출") return [value.toLocaleString(), "OCR 호출"];
            return [`$${value.toFixed(4)}`, "비용 (USD)"];
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Area
          yAxisId="left"
          type="monotone"
          dataKey="count"
          name="OCR 호출"
          stroke="#3b82f6"
          fill="url(#ocrCount)"
          strokeWidth={2}
        />
        <Area
          yAxisId="right"
          type="monotone"
          dataKey="costUsd"
          name="비용 (USD)"
          stroke="#10b981"
          fill="url(#ocrCost)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
