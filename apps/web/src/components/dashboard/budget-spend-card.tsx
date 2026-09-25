"use client";

/**
 * §dashboard-shifan-adopt P3b — 예산 & 지출 집행률 카드 (시안 중단 좌측)
 *
 * 정본: docs/plans/PLAN_dashboard-shifan-adopt.md (Phase 3 / P3b 정직성 코어)
 *
 * 시안 중단 area차트 슬롯을 대체 — "이번 달 누적 지출" + 예산 집행률(usageRate) 표시.
 * canonical 단일 진실: summary.budget(isSet/limit/spent/usageRate) + summary.spend.thisMonth.
 *
 * ★ 정직성(가드② empty 정직):
 *   - 가짜 집행률 금지 — 예산 미설정(isSet=false) 시 "미설정" 정직 + 집행률 미표시
 *     (회색 바 + 안내 문구). §dashboard-shifan-polish B4 — 예산 설정 CTA는 NextStepBanner 단독
 *     보유(중복 3곳→1곳). 카드는 정직 상태만 표시(설정 동선 미보유, dead button 0).
 *   - §A5/B1 — 카테고리 비중을 카드 내부 임베드(bare). 빈 분포 정직 empty(가짜 0).
 *   - 이번 달 누적 = summary.spend.thisMonth 실데이터(예산 무관). mock 0.
 *   - §11.302 신호등: ok=emerald / warn(≥80%)=yellow / danger(≥100%)=red (yellow 톤, 구 경고색 미사용).
 *
 * 4상태(P2 capMs): loading 스켈레톤 / error 재시도 / else(ready·empty) 정직 렌더.
 */

import { RotateCw, Wallet, ChevronRight } from "lucide-react";
import type { SectionState } from "@/lib/dashboard/section-state";
import { won, type DashboardSummary } from "@/lib/dashboard/summary-derive";
// §main-dashboard-p0-honesty T2 — 도넛 게이팅 + 소진 페이스(핸드오프 §0-2 · §5).
import { shouldRenderCategoryDonut, budgetPace, budgetPeriodLabel } from "@/lib/dashboard/p0-display";
import dynamic_import from "next/dynamic";

// §dashboard-shifan-polish A5/B1 — 카테고리 비중 카드 내부 통합(시안 "예산&지출 카드 내부").
//   recharts 코드분할 유지 위해 dynamic import(ssr:false) — BudgetSpendCard 가 eager 라도
//   recharts(~150KB)는 lazy chunk. bare 모드로 카드 chrome 없이 임베드.
const CategoryDistributionCard = dynamic_import(
  () =>
    import("@/components/dashboard/category-distribution-card").then((m) => ({
      default: m.CategoryDistributionCard,
    })),
  { ssr: false, loading: () => null },
);

export interface BudgetSpendCardProps {
  state: SectionState;
  summary: DashboardSummary | undefined;
  onRetry: () => void;
  /** §dashboard-shifan-polish A5/B1 — 카드 내부 카테고리 비중(stats.categorySpending). 정직 empty. */
  categorySpending?: Array<{ category: string; amount: number }>;
}

/** §11.302 신호등 — budTone → 진행바/텍스트 색(yellow 톤). */
const TONE_BAR: Record<string, string> = {
  none: "bg-slate-300",
  ok: "bg-emerald-500",
  warn: "bg-yellow-500",
  danger: "bg-red-600",
};
const TONE_TEXT: Record<string, string> = {
  none: "text-slate-400",
  ok: "text-emerald-700",
  warn: "text-yellow-700",
  danger: "text-red-700",
};

export function BudgetSpendCard({ state, summary, onRetry, categorySpending = [] }: BudgetSpendCardProps) {
  if (state === "loading") {
    return (
      <div
        className="h-[180px] rounded-xl border border-slate-200 bg-slate-50 animate-pulse"
        aria-busy="true"
        aria-label="예산 현황 로딩 중"
      />
    );
  }

  if (state === "error") {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-3 md:p-4 flex items-center justify-between gap-3">
        <p className="text-[13px] text-red-700 break-keep">예산 현황을 불러오지 못했습니다.</p>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 h-10 min-h-[44px] text-[13px] font-semibold text-white hover:bg-red-700 transition-colors flex-shrink-0"
        >
          <RotateCw className="h-3.5 w-3.5" />
          재시도
        </button>
      </div>
    );
  }

  const budget = summary?.budget;
  const isSet = budget?.isSet ?? false;
  const usageRate = budget?.usageRate ?? 0;
  const tone = summary?.derived.budTone ?? "none";
  const thisMonth = summary?.spend.thisMonth ?? 0;

  // §main-dashboard-p0-honesty T2 — 도넛은 예산 설정 후 + 실분포 있을 때만(핸드오프 §0-2).
  //   상단은 이번 달, 도넛 소스는 최근 6개월이라 미설정 상태에서 ₩0 과 6개월 누계가 공존했다.
  const showDonut = shouldRenderCategoryDonut(isSet, categorySpending);

  // ── 초기 상태(예산 미설정) — 핸드오프 §5 ────────────────────
  //   CTA 0: 예산 설정 동선은 NextStepBanner 단독 소유(§dashboard-shifan-polish B4).
  //   금액·도넛·총 지출 렌더 0: won() 을 아예 부르지 않는다.
  if (!isSet) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4 md:p-5 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100">
              <Wallet className="h-4 w-4 text-slate-600" />
            </span>
            <h3 className="text-[13px] font-extrabold text-slate-900">예산 &amp; 지출</h3>
          </div>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] font-bold text-slate-500">
            설정 전
          </span>
        </div>

        <dl className="space-y-2.5">
          <div>
            <dt className="text-[11px] font-semibold text-slate-400">이번 달 지출</dt>
            <dd className="text-[14px] font-bold text-slate-600">
              집계 전
              <span className="ml-1.5 text-[11px] font-medium text-slate-400">첫 발주 완료 후 표시</span>
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold text-slate-400">잔여 예산</dt>
            <dd className="text-[14px] font-bold text-slate-600">
              설정 전
              <span className="ml-1.5 text-[11px] font-medium text-slate-400">예산 등록 후 표시</span>
            </dd>
          </div>
        </dl>

        <p className="mt-auto pt-4 text-[11px] text-slate-400 break-keep">
          예산 설정은 상단 다음 단계 추천에서 진행합니다.
        </p>
      </div>
    );
  }

  // ── 운영 상태(예산 설정 후) — 핸드오프 §5 ───────────────────
  const barWidth = Math.min(100, Math.max(0, usageRate));
  // §budget-period-axis (P1-5) — 남은 일수·일평균·기간 라벨이 모두 **예산이 선언한 기간** 위에 선다.
  //   `now` 를 한 번만 만들어 셋에 같이 넘긴다 — 자정을 넘기며 지표끼리 어긋나는 것을 막는다.
  const now = new Date();
  const pace = budgetPace(budget!.remaining, now, budget!.periodEnd);
  const monthLabel = budgetPeriodLabel(budget!.periodEnd, now);

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4 md:p-5 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100">
            <Wallet className="h-4 w-4 text-slate-600" />
          </span>
          <h3 className="text-[13px] font-extrabold text-slate-900">
            예산 &amp; 지출 <span className="font-bold text-slate-400">· {monthLabel}</span>
          </h3>
        </div>
        <a
          href="/dashboard/budget"
          className="inline-flex items-center gap-0.5 text-[11.5px] font-bold text-slate-500 hover:text-slate-700 transition-colors"
        >
          예산 관리
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </a>
      </div>

      <p className="text-[26px] md:text-[28px] font-black tracking-tight tabular-nums leading-none text-slate-900">
        {won(budget!.spent + budget!.reserved)}
        <span className="text-[13px] font-semibold text-slate-400 ml-1.5">
          / {won(budget!.limit)} · {usageRate}% 사용
        </span>
      </p>
      {/* §budget-usage-reserved · 사용 = 집행 + 발주 예약(예산 상세·발주 차단과 같은 항).
          예약이 있을 때만 나눠 보인다. 예약 원장이 없는 예산에 「예약 ₩0」 을 그리지 않는다. */}
      {budget!.reserved > 0 && (
        <p className="mt-1 text-[11px] text-slate-500 tabular-nums">
          집행 {won(budget!.spent)} · 예약 {won(budget!.reserved)}
        </p>
      )}

      {/* 게이지 8px — §11.302 신호등(canonical budTone 상속. 로컬 임계 재정의 0). */}
      <div className="mt-3 h-2 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${TONE_BAR[tone]}`}
          style={{ width: `${barWidth}%` }}
        />
      </div>

      {/* 3지표 — 잔여 · 남은 일수 · 일평균 가능 */}
      <dl className="mt-3 grid grid-cols-3 gap-2">
        <div>
          <dt className="text-[10.5px] font-semibold text-slate-400">잔여</dt>
          <dd className={`text-[13px] font-extrabold tabular-nums ${TONE_TEXT[tone]}`}>{won(budget!.remaining)}</dd>
        </div>
        <div>
          <dt className="text-[10.5px] font-semibold text-slate-400">남은 일수</dt>
          <dd className="text-[13px] font-extrabold tabular-nums text-slate-700">{pace.daysLeft}일</dd>
        </div>
        <div>
          <dt className="text-[10.5px] font-semibold text-slate-400">일평균 가능</dt>
          <dd className="text-[13px] font-extrabold tabular-nums text-slate-700">{won(pace.dailyAllowance)}</dd>
        </div>
      </dl>

      {/* 이번 달 실지출(예산 무관 canonical) — 예산 spent 와 기간 축이 같아 병기해도 모순 0. */}
      <p className="mt-2 text-[11px] text-slate-400 tabular-nums">이번 달 실지출 {won(thisMonth)}</p>

      {/* 카테고리 비중 — showDonut 게이트 뒤에서만 렌더(가짜 분포 0 · 기간 모순 차단). */}
      {showDonut && (
        <div className="mt-4 pt-4 border-t border-slate-100">
          <CategoryDistributionCard categorySpending={categorySpending} bare />
        </div>
      )}
    </div>
  );
}
