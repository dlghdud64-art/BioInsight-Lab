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

/**
 * §cron-registry-drift (2026-08-08) — 운영 메타 결합.
 *
 * 실행 이력만 보여주던 표에 목적 / 실행 시각(KST) / 수동 차단 지점을 붙인다.
 * 메타는 서버(/api/admin/cron)가 VERCEL_CRON_REGISTRY 에서 조인해 내려준다 —
 * 클라이언트는 registry 를 import 하지 않는다(번들 표면 확대 방지).
 *
 * registry === null 인 행은 드롭하지 않고 경고 행으로 렌더한다.
 * vercel.json 에는 있는데 레지스트리에 없는 cron 이 조용히 사라지면
 * §11.250b(dead cron) 같은 사건을 다시 놓친다.
 */
interface CronRegistryMeta {
  scheduleKst: string;
  purposeKo: string;
  manualGateKo: string;
  operatorCheckKo: string;
  expectedResultKo: string;
  environment: string;
}

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
  registry: CronRegistryMeta | null;
}

interface CronResponse {
  period: Period;
  rows: CronRow[];
  unregisteredCount?: number;
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
  const unregisteredCount = data?.unregisteredCount ?? 0;

  return (
    <div className="space-y-3">
      {/* 레지스트리 미등록 경고 — 무음 누락 금지 */}
      {unregisteredCount > 0 && (
        <div
          role="status"
          className="rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-800"
        >
          운영 레지스트리에 등록되지 않은 cron {unregisteredCount}건이 실행되고
          있습니다. 목적과 차단 지점을 확인하려면
          <span className="font-mono"> src/lib/ops-console/vercel-cron-registry.ts</span>
          에 항목을 추가하세요.
        </div>
      )}

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
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-700 uppercase tracking-wide">
                  실행 시각
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-700 uppercase tracking-wide">
                  목적
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-700 uppercase tracking-wide">
                  차단 지점
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
                    colSpan={11}
                    className="text-center py-8 text-sm text-slate-500"
                  >
                    데이터를 불러오는 중입니다...
                  </td>
                </tr>
              )}
              {isError && (
                <tr>
                  <td
                    colSpan={11}
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
                    colSpan={11}
                    className="text-center py-8 text-sm text-slate-500"
                  >
                    아직 cron 실행 기록이 수집되지 않았습니다. 다음 cron 실행 시점부터 자동 누적됩니다.
                  </td>
                </tr>
              )}
              {!isLoading &&
                !isError &&
                rows.map((row) => (
                  <tr
                    key={row.cronPath}
                    className={
                      row.registry == null
                        ? "bg-yellow-50/60 hover:bg-yellow-50"
                        : "hover:bg-slate-50"
                    }
                  >
                    <td className="px-4 py-3 text-xs font-mono text-slate-800 truncate max-w-[280px]">
                      {row.cronPath}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                      {row.registry?.scheduleKst ?? (
                        <span className="text-yellow-700 font-medium">미등록</span>
                      )}
                    </td>
                    <td
                      className="px-4 py-3 text-xs text-slate-600 max-w-[320px] truncate"
                      title={row.registry?.purposeKo ?? undefined}
                    >
                      {row.registry?.purposeKo ?? (
                        <span className="text-yellow-700">
                          운영 레지스트리 미등록 — 목적 미정의
                        </span>
                      )}
                    </td>
                    <td
                      className="px-4 py-3 text-xs text-slate-600 max-w-[320px] truncate"
                      title={row.registry?.manualGateKo ?? undefined}
                    >
                      {row.registry?.manualGateKo ?? (
                        <span className="text-yellow-700">
                          차단 지점 미정의 — Vercel Dashboard에서 cron 중지
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                      {row.totalCount > 0 ? (
                        row.totalCount
                      ) : (
                        <span
                          className="text-yellow-700 text-xs"
                          title="등록됐지만 조회 기간 내 실행 기록이 없습니다 (dead cron 신호)"
                        >
                          실행 없음
                        </span>
                      )}
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
