"use client";

/**
 * §11.84 #dashboard-spend-trend-chart-add
 *
 * 호영님 시안의 Area Chart 채택 — dashboard 종합 same-canvas 원칙에 따라
 * /dashboard/analytics 의 detail 페이지와 별개로 dashboard 에 직접 표시.
 * `/dashboard/analytics` 는 deep-dive 그대로 유지 (duplicate 아님 — same
 * data, different angle).
 *
 * Data source:
 *   /api/dashboard/stats GET → monthlySpending: Array<{ month, amount }>
 *   (이미 dashboard/page.tsx 에서 fetch — props 로 forward)
 *
 * Sub-stats derive (props 로 받은 monthlySpending 만 사용 — 새 endpoint 0):
 *   - 일평균: 최근 30일 amount 합 / 30
 *   - 최고 지출일: 데이터 한계상 월 단위 → 최고 월 + 그 월의 amount
 *   - 전주 대비: 최근 월 vs 그 전 월 % 변화
 *
 * LabAxis 원칙:
 *   - mock 0 (real Prisma derived)
 *   - empty state 명시
 *   - marketing decorative 거부 (시안 visual essence — smooth curve + gradient
 *     fill + sub-stats row 만 흡수)
 */

import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface MonthlyPoint {
  month: string;
  amount: number;
}

interface SpendTrendCardProps {
  monthlySpending: MonthlyPoint[];
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 shadow-md">
      <p className="text-[10px] font-semibold text-slate-500 mb-0.5">{label}</p>
      <p className="text-[12px] font-bold text-slate-900 tabular-nums">
        ₩{payload[0]!.value.toLocaleString("ko-KR")}
      </p>
    </div>
  );
}

export function SpendTrendCard({ monthlySpending }: SpendTrendCardProps) {
  const stats = useMemo(() => {
    if (!monthlySpending || monthlySpending.length === 0) {
      return null;
    }
    const valid = monthlySpending.filter((m) => m.amount >= 0);
    if (valid.length === 0) return null;

    // 일평균 — 최근 1개월 amount / 30 (월 단위 데이터의 최선 근사)
    const lastMonth = valid[valid.length - 1]!;
    const avgDaily = lastMonth.amount / 30;

    // 최고 지출 월
    const peak = [...valid].sort((a, b) => b.amount - a.amount)[0]!;

    // 전월 대비 변화율
    let momChange: number | null = null;
    if (valid.length >= 2) {
      const prev = valid[valid.length - 2]!.amount;
      if (prev > 0) {
        momChange = ((lastMonth.amount - prev) / prev) * 100;
      }
    }

    return { avgDaily, peak, momChange, lastMonth };
  }, [monthlySpending]);

  const isEmpty = !stats || stats.lastMonth.amount === 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4 md:p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-[13px] font-extrabold text-slate-900">지출 추이</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">최근 12개월 누적 지출</p>
        </div>
        {!isEmpty && stats?.lastMonth && (
          <div className="text-right">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
              일평균
            </p>
            <p className="text-sm font-bold text-slate-900 tabular-nums">
              ₩{Math.round(stats.avgDaily).toLocaleString("ko-KR")}
            </p>
          </div>
        )}
      </div>

      {isEmpty ? (
        <div className="py-12 text-center">
          <p className="text-sm text-slate-500">아직 지출 기록이 없습니다.</p>
          <p className="text-[11px] text-slate-400 mt-1 break-keep">
            발주가 시작되면 월별 지출 추이가 여기에 표시됩니다.
          </p>
        </div>
      ) : (
        <>
          <div className="h-[180px] -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlySpending} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  tickFormatter={(v) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(0)}M` : v >= 1_000 ? `${(v / 1_000).toFixed(0)}K` : `${v}`)}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: "#cbd5e1", strokeDasharray: 3 }} />
                <Area
                  type="monotone"
                  dataKey="amount"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#spendGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-3 mt-3 border-t border-slate-100">
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-0.5">
                이번 달
              </p>
              <p className="text-sm font-bold text-slate-900 tabular-nums">
                ₩{stats!.lastMonth.amount.toLocaleString("ko-KR")}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-0.5">
                최고 지출 월
              </p>
              <p className="text-sm font-bold text-slate-900 tabular-nums">
                {stats!.peak.month} · ₩{(stats!.peak.amount / 1_000_000).toFixed(1)}M
              </p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-0.5">
                전월 대비
              </p>
              {stats!.momChange === null ? (
                <p className="text-sm font-bold text-slate-400 tabular-nums">—</p>
              ) : (
                <div className="flex items-center gap-1">
                  {stats!.momChange > 0 ? (
                    <TrendingUp className="h-3.5 w-3.5 text-rose-500" />
                  ) : stats!.momChange < 0 ? (
                    <TrendingDown className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <Minus className="h-3.5 w-3.5 text-slate-400" />
                  )}
                  <p
                    className={`text-sm font-bold tabular-nums ${
                      stats!.momChange > 0
                        ? "text-rose-600"
                        : stats!.momChange < 0
                          ? "text-emerald-600"
                          : "text-slate-600"
                    }`}
                  >
                    {stats!.momChange > 0 ? "+" : ""}
                    {stats!.momChange.toFixed(1)}%
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
