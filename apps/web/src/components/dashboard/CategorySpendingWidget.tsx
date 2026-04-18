"use client";

/**
 * CategorySpendingWidget.tsx
 *
 * 카테고리별 지출 통제 대시보드 위젯.
 * 각 카테고리의 이번 달 지출, MOM% 변화율, 상태(정상/주의/초과위험)를 카드로 표시.
 */

import { useEffect, useMemo } from "react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Beaker,
  Package,
  FlaskConical,
  Dna,
  MoreHorizontal,
  HelpCircle,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import {
  useSpendingCategoryStore,
  type CategorySpendingItem,
} from "@/lib/store/spending-category-store";

// ── 아이콘 매핑 ──
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Beaker,
  Package,
  FlaskConical,
  Dna,
  MoreHorizontal,
  HelpCircle,
};

// ── 상태 설정 ──
const STATUS_CONFIG: Record<
  CategorySpendingItem["status"],
  {
    label: string;
    bgColor: string;
    textColor: string;
    dotColor: string;
    borderColor: string;
  }
> = {
  normal: {
    label: "정상",
    bgColor: "bg-emerald-50",
    textColor: "text-emerald-700",
    dotColor: "bg-emerald-500",
    borderColor: "border-emerald-200",
  },
  warning: {
    label: "주의",
    bgColor: "bg-amber-50",
    textColor: "text-amber-700",
    dotColor: "bg-amber-500",
    borderColor: "border-amber-200",
  },
  soft_limit: {
    label: "소프트 리밋",
    bgColor: "bg-orange-50",
    textColor: "text-orange-700",
    dotColor: "bg-orange-500",
    borderColor: "border-orange-200",
  },
  over_budget: {
    label: "예산 초과 위험",
    bgColor: "bg-red-50",
    textColor: "text-red-700",
    dotColor: "bg-red-500",
    borderColor: "border-red-200",
  },
  no_budget: {
    label: "예산 미설정",
    bgColor: "bg-slate-50",
    textColor: "text-slate-500",
    dotColor: "bg-slate-400",
    borderColor: "border-slate-200",
  },
};

// ── 금액 포맷 ──
function formatWon(n: number): string {
  if (n === 0) return "₩0";
  if (n >= 100_000_000) return `₩${(n / 100_000_000).toFixed(1)}억`;
  if (n >= 10_000) return `₩${Math.round(n / 10_000).toLocaleString("ko-KR")}만`;
  return `₩${n.toLocaleString("ko-KR")}`;
}

// ── MOM% 뱃지 ──
function MomBadge({ percent }: { percent: number | null }) {
  if (percent === null || percent === undefined) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-slate-400">
        <Minus className="w-3 h-3" />
        <span>N/A</span>
      </span>
    );
  }

  if (percent > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-red-600">
        <TrendingUp className="w-3 h-3" />
        <span>+{percent}%</span>
      </span>
    );
  }

  if (percent < 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-emerald-600">
        <TrendingDown className="w-3 h-3" />
        <span>{percent}%</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-0.5 text-xs text-slate-500">
      <Minus className="w-3 h-3" />
      <span>0%</span>
    </span>
  );
}

// ── 상태 아이콘 ──
function StatusIcon({ status }: { status: CategorySpendingItem["status"] }) {
  switch (status) {
    case "over_budget":
    case "soft_limit":
      return <AlertTriangle className="w-3.5 h-3.5" />;
    case "warning":
      return <AlertCircle className="w-3.5 h-3.5" />;
    case "normal":
      return <CheckCircle2 className="w-3.5 h-3.5" />;
    default:
      return null;
  }
}

// ── 사용률 바 ──
function UsageBar({
  usagePercent,
  status,
}: {
  usagePercent: number | null;
  status: CategorySpendingItem["status"];
}) {
  if (usagePercent === null) return null;

  const barColor =
    status === "over_budget" || status === "soft_limit"
      ? "bg-red-500"
      : status === "warning"
        ? "bg-amber-500"
        : "bg-emerald-500";

  const width = Math.min(usagePercent, 100);

  return (
    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-300 ${barColor}`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

// ── 카테고리 카드 ──
function CategoryCard({ item }: { item: CategorySpendingItem }) {
  const config = STATUS_CONFIG[item.status];
  const IconComponent = item.icon ? ICON_MAP[item.icon] : null;

  // drill-down: 카드 클릭 → 해당 카테고리 필터된 구매 내역
  const drillDownHref = item.categoryId
    ? `/dashboard/purchases?category=${encodeURIComponent(item.categoryName)}`
    : `/dashboard/purchases?filter=unclassified`;

  return (
    <Link
      href={drillDownHref}
      className={`block rounded-lg border p-4 ${config.borderColor} bg-white transition-shadow hover:shadow-sm cursor-pointer`}
    >
      {/* 헤더: 아이콘 + 카테고리명 + MOM */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {IconComponent && (
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${item.color}15` }}
            >
              <IconComponent className="w-4 h-4" />
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-slate-800">
              {item.displayName}
            </p>
          </div>
        </div>
        <MomBadge percent={item.momChangePercent} />
      </div>

      {/* 금액 */}
      <div className="mb-2">
        <p className="text-lg font-semibold text-slate-900 tabular-nums">
          {formatWon(item.committedSpend)}
        </p>
        {item.budgetAmount !== null && (
          <p className="text-xs text-slate-500">
            / {formatWon(item.budgetAmount)}
          </p>
        )}
      </div>

      {/* 사용률 바 */}
      <UsageBar usagePercent={item.usagePercent} status={item.status} />

      {/* 상태 뱃지 */}
      <div className="mt-2 flex items-center justify-between">
        <span
          className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${config.bgColor} ${config.textColor}`}
        >
          <StatusIcon status={item.status} />
          {config.label}
        </span>
        {item.usagePercent !== null && (
          <span className="text-xs text-slate-400 tabular-nums">
            {item.usagePercent}%
          </span>
        )}
      </div>
    </Link>
  );
}

// ── 메인 위젯 ──

interface CategorySpendingWidgetProps {
  organizationId: string;
  yearMonth?: string;
}

export default function CategorySpendingWidget({
  organizationId,
  yearMonth,
}: CategorySpendingWidgetProps) {
  const { spendingSummary, isLoading, error, fetchSpendingSummary } =
    useSpendingCategoryStore();

  // yearMonth를 명시 전달하지 않으면 API에서 org timezone 기준으로 현재 월을 결정.
  // 클라이언트에서 UTC 기반 월 키를 직접 생성하면
  // gate/widget/engine 간 period가 달라지므로 금지.
  // 반드시 API가 org timezone(resolvePeriodYearMonth)으로 결정하게 위임.
  const targetYearMonth = yearMonth ?? undefined;

  useEffect(() => {
    if (organizationId) {
      fetchSpendingSummary(organizationId, targetYearMonth);
    }
  }, [organizationId, targetYearMonth, fetchSpendingSummary]);

  // 로딩
  if (isLoading && !spendingSummary) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
        <span className="ml-2 text-sm text-slate-500">
          카테고리별 지출 현황을 불러오는 중...
        </span>
      </div>
    );
  }

  // 에러
  if (error) {
    return (
      <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
        {error}
      </div>
    );
  }

  // 데이터 없음
  if (
    !spendingSummary ||
    !spendingSummary.categories ||
    spendingSummary.categories.length === 0
  ) {
    return (
      <div className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-4 text-center">
        <p className="font-medium mb-1">카테고리별 지출 데이터가 없습니다</p>
        <p className="text-xs text-slate-400">
          카테고리를 설정하고 구매 내역이 기록되면 여기에 표시됩니다.
        </p>
      </div>
    );
  }

  const { categories, totalCommittedSpend, overBudgetRiskCount, unclassifiedCount } = spendingSummary;

  // 연/월 표시용 — API 응답의 yearMonth를 사용 (org timezone 기준)
  const displayYearMonth = spendingSummary.yearMonth ?? targetYearMonth ?? "";
  const [y, m] = displayYearMonth.split("-");
  const monthLabel = y && m ? `${y}년 ${parseInt(m)}월` : "";

  return (
    <div>
      {/* 섹션 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">
            카테고리별 예산 사용 현황
          </h3>
          <p className="text-xs text-slate-500">{monthLabel} 확정 구매액 기준</p>
        </div>
        <div className="flex items-center gap-3">
          {unclassifiedCount > 0 && (
            <Link
              href="/dashboard/purchases?filter=unclassified"
              className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full hover:bg-amber-100 transition-colors"
            >
              <HelpCircle className="w-3 h-3" />
              미분류 {unclassifiedCount}건
            </Link>
          )}
          {overBudgetRiskCount > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
              <AlertTriangle className="w-3 h-3" />
              {overBudgetRiskCount}건 주의
            </span>
          )}
          <span className="text-xs text-slate-500">
            확정 구매액: <span className="font-medium text-slate-700">{formatWon(totalCommittedSpend)}</span>
          </span>
        </div>
      </div>

      {/* 카테고리 카드 그리드 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {categories.map((item: CategorySpendingItem) => (
          <CategoryCard
            key={item.categoryId ?? item.categoryName}
            item={item}
          />
        ))}
      </div>
    </div>
  );
}
