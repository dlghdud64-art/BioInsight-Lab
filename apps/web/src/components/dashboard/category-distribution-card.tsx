"use client";

/**
 * §11.85 #dashboard-category-donut-add
 *
 * 호영님 시안의 카테고리 도넛 채택 — dashboard 종합 same-canvas 표시.
 * /dashboard/reports 의 deep-dive 페이지는 그대로 유지 (duplicate 아님).
 *
 * Data source:
 *   /api/dashboard/stats GET → categorySpending: Array<{ category, amount }>
 *   (이미 dashboard/page.tsx 에서 fetch 가능 — props 로 forward)
 *
 * Category label mapping:
 *   PRODUCT_CATEGORIES (lib/constants) — REAGENT/TOOL/EQUIPMENT/RAW_MATERIAL
 *   를 한국어 운영자 라벨로 매핑 (§11.40 패턴).
 *
 * LabAxis 원칙:
 *   - mock 0 (real Prisma derived)
 *   - empty state 명시
 *   - raw enum 노출 금지 (§11.40 lesson)
 */

import { useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { PRODUCT_CATEGORIES } from "@/lib/constants";

interface CategoryItem {
  category: string;
  amount: number;
}

interface CategoryDistributionCardProps {
  categorySpending: CategoryItem[];
}

const CATEGORY_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#94a3b8"];

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: { displayName: string; amount: number; pct: number } }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0]!.payload;
  return (
    <div className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 shadow-md">
      <p className="text-[11px] font-semibold text-slate-700 break-keep">{item.displayName}</p>
      <p className="text-[12px] font-bold text-slate-900 tabular-nums mt-0.5">
        ₩{item.amount.toLocaleString("ko-KR")}{" "}
        <span className="text-slate-500 font-medium">({item.pct.toFixed(1)}%)</span>
      </p>
    </div>
  );
}

export function CategoryDistributionCard({ categorySpending }: CategoryDistributionCardProps) {
  const data = useMemo(() => {
    if (!categorySpending || categorySpending.length === 0) return [];
    const total = categorySpending.reduce((s, c) => s + c.amount, 0);
    if (total === 0) return [];
    return categorySpending
      .map((c) => ({
        category: c.category,
        // §11.40 raw-enum mapping — REAGENT/TOOL/EQUIPMENT/RAW_MATERIAL → 한국어
        displayName: PRODUCT_CATEGORIES[c.category] || c.category || "기타",
        amount: c.amount,
        pct: (c.amount / total) * 100,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [categorySpending]);

  const total = useMemo(() => data.reduce((s, d) => s + d.amount, 0), [data]);

  const isEmpty = data.length === 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4 md:p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-[13px] font-extrabold text-slate-900">카테고리별 비중</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">최근 누적 지출 분포</p>
        </div>
        {!isEmpty && (
          <div className="text-right">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
              총 지출
            </p>
            <p className="text-sm font-bold text-slate-900 tabular-nums">
              ₩{(total / 1_000_000).toFixed(1)}M
            </p>
          </div>
        )}
      </div>

      {isEmpty ? (
        <div className="py-12 text-center">
          <p className="text-sm text-slate-500">아직 지출 기록이 없습니다.</p>
          <p className="text-[11px] text-slate-400 mt-1 break-keep">
            카테고리별 분포는 발주가 시작되면 표시됩니다.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
          <div className="h-[160px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="amount"
                  nameKey="displayName"
                  innerRadius={42}
                  outerRadius={70}
                  paddingAngle={2}
                  stroke="none"
                >
                  {data.map((entry, idx) => (
                    <Cell
                      key={entry.category}
                      fill={CATEGORY_COLORS[idx % CATEGORY_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1.5">
            {data.map((d, idx) => (
              <div key={d.category} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: CATEGORY_COLORS[idx % CATEGORY_COLORS.length] }}
                  />
                  <span className="text-slate-700 truncate break-keep">{d.displayName}</span>
                </div>
                <span className="font-bold text-slate-900 tabular-nums flex-shrink-0 ml-2">
                  {d.pct.toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
