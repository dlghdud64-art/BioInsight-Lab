"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

/**
 * #cron-monitoring-admin-dashboard #cron-execution-table — admin/cron 메인 표.
 *
 * 호영님 backlog audit P0 (b). cron 별 last execution + success rate + p95
 * duration 시각화. period 토글 (7d/30d).
 *
 * admin/rum/_components/rum-aggregate-table 패턴 정확 reuse.
 */

type Period = "7d" | "30d";

interface CronRow {
  cronPath: string;
  totalCount: number;
  successCount: number;
  failureCount: number;
  avgDurationMs: number | null;
  p95DurationMs: number | null;
  lastStartedAt: string | null;
  lastSuccess: boolean | null;
  successRate: number | null;
}

interface CronResponse {
  period: Period;
  rows: CronRow[];
}

function formatMs(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("ko-KR");
  } catch {
    return iso;
  }
}

export function CronExecutionTable() {
  const [period, setPeriod] = useState<Period>("7d");

  const { data, isLoading, isError, error } = useQuery<CronResponse>({
    queryKey: ["admin-cron-aggregate", period],
    queryFn: async () => {
      const res = await fetch(`/api/admin/cron?period=${period}`);
      if (!res.ok) throw new Error(`Failed to fetch cron aggregate (${res.status})`);
      return res.json();
    },
    staleTime: 60_000,
  });

  const rows = data?.rows ?? [];

  return (
    <div className="space-y-3">
      {/* period 토글 */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setPeriod("7d")}
          aria-pressed={period === "7d"}
          className={`h-9 px-3 text-xs font-medium rounded-md border transition-colors ${
            period === "7d"
              ? "bg-slate-900 text-white border-slate-900"
              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
          }`}
        >
          최근 7일
        </button>
        <button
          type="button"
          onClick={() => setPeriod("30d")}
          aria-pressed={period === "30d"}
          className={`h-9 px-3 text-xs font-medium rounded-md border transition-colors ${
            period === "30d"
              ? "bg-slate-900 text-white border-slate-900"
              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
          }`}
        >
          최근 30일
        </button>
      </div>

      {/* 표 */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-700 uppercase tracking-wide">
                  cronPath
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-700 uppercase tracking-wide">
                  실행 수
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-700 uppercase tracking-wide">
                  성공률
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-700 uppercase tracking-wide">
                  실패
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-700 uppercase tracking-wide">
                  평균 시간
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-700 uppercase tracking-wide">
                  p95
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-700 uppercase tracking-wide">
                  마지막 실행
                </th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-700 uppercase tracking-wide">
                  마지막 결과
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading && (
                <tr>
                  <td
                    colSpan={8}
                    className="text-center py-8 text-sm text-slate-500"
                  >
                    데이터를 불러오는 중입니다...
                  </td>
                </tr>
              )}
              {isError && (
                <tr>
                  <td
                    colSpan={8}
                    className="text-center py-8 text-sm text-rose-600"
                  >
                    cron 실행 history 를 불러오지 못했습니다.
                    {error instanceof Error ? ` (${error.message})` : ""}
                  </td>
                </tr>
              )}
              {!isLoading && !isError && rows.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="text-center py-8 text-sm text-slate-500"
                  >
                    아직 cron 실행 기록이 수집되지 않았습니다. 다음 cron 실행 시점부터 자동 누적됩니다.
                  </td>
                </tr>
              )}
              {!isLoading &&
                !isError &&
                rows.map((row) => (
                  <tr key={row.cronPath} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-xs font-mono text-slate-800 truncate max-w-[280px]">
                      {row.cronPath}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                      {row.totalCount}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <span
                        className={
                          row.successRate != null && row.successRate < 95
                            ? "text-rose-600 font-semibold"
                            : "text-emerald-700 font-medium"
                        }
                      >
                        {row.successRate != null ? `${row.successRate}%` : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {row.failureCount > 0 ? (
                        <span className="text-rose-600 font-semibold">
                          {row.failureCount}
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                      {formatMs(row.avgDurationMs)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                      {formatMs(row.p95DurationMs)}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {formatDate(row.lastStartedAt)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {row.lastSuccess == null ? (
                        <span className="text-xs text-slate-400">—</span>
                      ) : row.lastSuccess ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          성공
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                          실패
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
