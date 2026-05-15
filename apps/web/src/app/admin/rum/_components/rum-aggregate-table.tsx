"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

/**
 * §11.246d-4-cont-2 #rum-aggregate-admin-dashboard — 호영님 scope 축소 (table only).
 *
 * RumMetric 데이터 pathname 별 grouping + p75/p95 시각화. 7d / 30d period 토글.
 *   recharts 0 — 호영님 결정 (bundle 절약). chart 시각화는 별도 cluster.
 *
 * canonical truth lock:
 *   - 서버 percentile_cont aggregate = source of truth.
 *   - period 토글 = useQuery key 분기 (refetch). client state polluted 0.
 *   - empty state / error state / loading state 모두 명시.
 */

type Period = "7d" | "30d";

interface RumAggregateRow {
  pathname: string | null;
  count: number;
  lcp_p75: number | null;
  lcp_p95: number | null;
  cls_p75: number | null;
  cls_p95: number | null;
  inp_p75: number | null;
  inp_p95: number | null;
}

interface RumAggregateResponse {
  period: Period;
  rows: RumAggregateRow[];
}

// LCP/INP = ms 단위. CLS = unitless (소수점 3자리).
function formatMs(value: number | null): string {
  if (value === null || value === undefined) return "—";
  return `${Math.round(value)}ms`;
}

function formatCls(value: number | null): string {
  if (value === null || value === undefined) return "—";
  return value.toFixed(3);
}

export function RumAggregateTable() {
  const [period, setPeriod] = useState<Period>("7d");

  const { data, isLoading, isError } = useQuery<RumAggregateResponse>({
    queryKey: ["admin-rum-aggregate", period],
    queryFn: async () => {
      const res = await fetch(`/api/admin/rum/aggregate?period=${period}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch RUM aggregate (${res.status})`);
      }
      return res.json();
    },
  });

  return (
    <div className="space-y-4">
      {/* §11.246d-4-cont-2 — period 토글 button group */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-slate-700">기간</span>
        <div className="inline-flex rounded-md border border-bd overflow-hidden">
          <button
            type="button"
            onClick={() => setPeriod("7d")}
            className={`px-3 py-1.5 text-sm font-medium ${
              period === "7d"
                ? "bg-blue-600 text-white"
                : "bg-white text-slate-700 hover:bg-slate-50"
            }`}
            aria-pressed={period === "7d"}
          >
            최근 7일
          </button>
          <button
            type="button"
            onClick={() => setPeriod("30d")}
            className={`px-3 py-1.5 text-sm font-medium ${
              period === "30d"
                ? "bg-blue-600 text-white"
                : "bg-white text-slate-700 hover:bg-slate-50"
            }`}
            aria-pressed={period === "30d"}
          >
            최근 30일
          </button>
        </div>
      </div>

      {/* §11.246d-4-cont-2 — 8 column table (pathname / count / 3 metric × p75·p95) */}
      <div className="overflow-x-auto rounded-xl border border-bd bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
              <th className="px-3 py-2.5">경로 (pathname)</th>
              <th className="px-3 py-2.5 text-right">측정 수 (count)</th>
              <th className="px-3 py-2.5 text-right">LCP p75</th>
              <th className="px-3 py-2.5 text-right">LCP p95</th>
              <th className="px-3 py-2.5 text-right">CLS p75</th>
              <th className="px-3 py-2.5 text-right">CLS p95</th>
              <th className="px-3 py-2.5 text-right">INP p75</th>
              <th className="px-3 py-2.5 text-right">INP p95</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-bd">
            {isLoading && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-slate-500">
                  로딩 중...
                </td>
              </tr>
            )}
            {isError && !isLoading && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-rose-600">
                  데이터 조회에 실패했습니다. 잠시 후 다시 시도하세요.
                </td>
              </tr>
            )}
            {!isLoading &&
              !isError &&
              (data?.rows.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-slate-500">
                    아직 RUM 데이터가 수집되지 않았습니다. (수집 후 다시 방문하세요.)
                  </td>
                </tr>
              )}
            {!isLoading &&
              !isError &&
              data?.rows.map((row, idx) => (
                <tr
                  key={`${row.pathname ?? "null"}-${idx}`}
                  className="hover:bg-slate-50"
                >
                  <td className="px-3 py-2 font-mono text-xs text-slate-800">
                    {row.pathname ?? "(unknown)"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                    {row.count.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-800">
                    {formatMs(row.lcp_p75)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-800">
                    {formatMs(row.lcp_p95)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-800">
                    {formatCls(row.cls_p75)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-800">
                    {formatCls(row.cls_p95)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-800">
                    {formatMs(row.inp_p75)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-800">
                    {formatMs(row.inp_p95)}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
