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
import { wonCompact } from "@/lib/dashboard/summary-derive";

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
    <div className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05),_0_2px_4px_rgba(0,0,0,0.04),_0_8px_24px_rgba(0,0,0,0.06)] p-5 md:p-6">
      {/* §11.207 — 시안 정합 헤더: 좌측 icon + 한국어 title + REAL-TIME SPEND
          TRACKING eyebrow / 우측 최고 지출액 큰 숫자 (font-black tracking-tighter).
          호영님 첨부 LabAxis 시안 정합. */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
            <TrendingUp className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 leading-tight">지출 트렌드 분석</h3>
          </div>
        </div>
        {!isEmpty && stats?.peak && (
          <div className="text-right flex-shrink-0">
            <p className={`text-2xl md:text-[26px] font-black tracking-tighter tabular-nums leading-none text-slate-900`}>
              {wonCompact(stats.peak.amount)}원
            </p>
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400 mt-1">
              최고 지출액
            </p>
          </div>
        )}
      </div>

      {isEmpty ? (
        /* §main-dashboard-redesign P1 가드①②(정본 PLAN) — 빈 데이터 차트 미렌더.
           이전 §11.243b#4 회색 mockup 차트 + sample overlay 는 빈 계정에 가짜
           분포를 그려 §1-2⑤ 정직성 위반(₩0 KPI vs ₩71.6M 차트 모순). 제거 →
           차트 미렌더 + "데이터 쌓이면 표시" 컴팩트 empty 로 정직화. 목업 0. */
        <div className="flex h-[180px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center">
          <p className="text-sm font-semibold text-slate-600 mb-1">
            데이터가 쌓이면 지출 추이가 표시됩니다
          </p>
          <p className="text-[11px] text-slate-400 break-keep">
            첫 발주가 완료되면 월별 지출 트렌드가 자동으로 그려집니다.
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
                  tickFormatter={(v) => wonCompact(v)}
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
                {wonCompact(stats!.lastMonth.amount)}원
              </p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-0.5">
                최고 지출 월
              </p>
              <p className="text-sm font-bold text-slate-900 tabular-nums">
                {stats!.peak.month} · {wonCompact(stats!.peak.amount)}원
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
