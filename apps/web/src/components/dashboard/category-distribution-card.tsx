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
  /** §11.313 — 부모 grid cell 높이 정합용 (예: "h-full"). */
  className?: string;
  /** §dashboard-shifan-polish A5/B1 — bare 모드: 카드 chrome(border/bg/shadow/padding) 제거하고
   *  헤더+차트만 렌더(BudgetSpendCard 내부 임베드용 — 시안 "예산&지출 카드 내부 통합"). */
  bare?: boolean;
}

const CATEGORY_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#94a3b8"];

// §dashboard-shifan-adopt P3b 정직성 코어 — 빈 도넛 mockup(MOCKUP_CATEGORY_DATA 42/25/20/13%
//   + "예시 데이터" overlay) 제거. 빈 계정에 가짜 분포를 그려 §1-2⑤ 정직성 위반(₩0 KPI vs
//   예시 분포 모순)이었음 — SpendTrendCard 패턴(§main-dashboard-redesign P1 가드①②)과 정합:
//   차트 미렌더 + 컴팩트 정직 empty. mock 0.

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

export function CategoryDistributionCard({ categorySpending, className, bare }: CategoryDistributionCardProps) {
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
    /* §11.313 — flex flex-col + className(h-full) 로 부모 grid cell 높이 정합.
       헤더는 고정, 차트 영역은 flex-1 로 남은 세로 공간 채워 중앙 정렬.
       §dashboard-shifan-polish A5/B1 — bare 모드는 카드 chrome 제거(부모 카드 내부 임베드). */
    <div className={`${bare ? "" : "rounded-xl border border-slate-200 bg-white shadow-sm p-4 md:p-5 "}flex flex-col ${className ?? ""}`}>
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
              ₩{total.toLocaleString("ko-KR")}
            </p>
          </div>
        )}
      </div>

      {isEmpty ? (
        /* §dashboard-shifan-adopt P3b 정직성 코어 — 빈 데이터 차트 미렌더(가드①②).
           이전 §11.243b#4 회색 mockup 도넛 + "예시 데이터" overlay 는 빈 계정에 가짜
           분포(42/25/20/13%)를 그려 정직성 위반. SpendTrendCard 패턴으로 정합 —
           차트 미렌더 + 컴팩트 "데이터 쌓이면 표시" 정직 empty. mock 0. */
        <div className="flex min-h-[180px] flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 py-5 text-center">
          <p className="text-sm font-semibold text-slate-600 mb-1">
            발주가 시작되면 카테고리 분포가 표시됩니다
          </p>
          <p className="text-[11px] text-slate-400 break-keep mb-3">
            첫 지출이 기록되면 카테고리별 비중이 자동으로 그려집니다.
          </p>
          {/* §dashboard-shifan-polish — 차트 실높이만큼 영역 reserve(데이터 시 카드 높이 안 튐, CLS 방지).
              skeleton 은 분포 암시 0: 모든 bar 동일 길이(flex-1, inline width 미사용) + 라벨만.
              길이 차등 = 가짜 분포이므로 금지(시안 예시 분포 재발 차단). */}
          <div className="w-full max-w-[200px] space-y-1.5" aria-hidden>
            {["시약", "소모품", "장비", "기타"].map((label) => (
              <div key={label} className="flex items-center gap-2">
                <span className="w-10 shrink-0 text-left text-[10px] text-slate-400">{label}</span>
                <span className="h-2 flex-1 rounded-full bg-slate-200" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center flex-1">
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
