/**
 * §main-dashboard-redesign P1 — /api/dashboard/summary 단일 진실 파생 helper
 *
 * 정본: docs/plans/PLAN_main-dashboard-redesign.md (P0 매핑·empty 명세·가드 3건)
 *
 * 순수 함수(DB 접근 0). route 가 Prisma 로 모은 raw 카운트를 받아
 * 시안 8모듈 단일 진실 계약(MODULES{quote,po,receive,stock} + BUDGET + 파생)으로 변환.
 *
 * 가드②(가짜 차트 모순 비반복): 분포/차트 mock 0. 실데이터/0만. 이 helper 는
 *   목업 분포를 절대 생성하지 않는다 — 입력 카운트 그대로 합·파생.
 * 가드③(Pipeline canonical): 전이맵 로컬 재정의 0. 이 helper 는 전이를 정의하지
 *   않는다(표시 카운트만). Pipeline 전이 표시는 P4에서 lib/operations/state-machine.ts
 *   를 상속.
 */

export type ReceivingStatusKey = "PENDING" | "PARTIAL" | "COMPLETED" | "ISSUE";

/** route 가 Prisma 로 모아 넘기는 정규화 입력(이미 scope 필터 적용된 카운트). */
export interface DashboardSummaryInput {
  quote: {
    total: number;
    pending: number;
    responded: number;
    completed: number;
    purchased: number;
    pendingAmount: number;
  };
  po: {
    total: number;
    ordered: number;
    confirmed: number;
    shipping: number;
    delivered: number;
    cancelled: number;
    confirmedAmount: number;
    thisMonth: number;
  };
  receive: {
    total: number;
    pending: number;
    partial: number;
    completed: number;
    issue: number;
    expiringCount: number;
  };
  stock: {
    total: number;
    reorderNeeded: number;
    lowStock: number;
    expiringCount: number;
    assetValue: number;
  };
  /** 활성 예산 부재 시 null. */
  budget: {
    limit: number;
    spent: number;
    remaining: number;
  } | null;
  /** 지출 파생(예산 무관 실구매 합). StatLine "이번달 지출" 소스. */
  spend: {
    /** 이번 달(1일~) 실 구매액 합. 실데이터/0만(가드②). */
    thisMonth: number;
  };
}

export type BudgetTone = "none" | "ok" | "warn" | "danger";

export interface DashboardSummaryBudget {
  isSet: boolean;
  limit: number;
  spent: number;
  remaining: number;
  /** 0–100+ (over budget 시 100 초과 가능). 예산 미설정 시 0. */
  usageRate: number;
}

export interface DashboardSummary {
  modules: {
    quote: DashboardSummaryInput["quote"];
    po: DashboardSummaryInput["po"];
    receive: DashboardSummaryInput["receive"];
    stock: DashboardSummaryInput["stock"];
  };
  budget: DashboardSummaryBudget;
  /** 지출 파생 — StatLine "이번달 지출" 소스(예산 무관 실구매). */
  spend: { thisMonth: number };
  derived: {
    /** 4모듈 전부 0 = GlobalEmpty(종합 빈). 빈 계정 정직 첫 화면(가드①). */
    allEmpty: boolean;
    /** §11.302 신호등 — 예산 사용률 기반 톤. */
    budTone: BudgetTone;
  };
}

/**
 * §11.302 신호등 — 예산 사용률 → 톤.
 * 미설정: none / <80%: ok(emerald) / 80–<100%: warn(yellow) / >=100%: danger(red).
 */
export function budTone(isSet: boolean, usageRate: number): BudgetTone {
  if (!isSet) return "none";
  if (usageRate >= 100) return "danger";
  if (usageRate >= 80) return "warn";
  return "ok";
}

/** 원화 포맷(파생 표시 전용). 음수/소수 안전. */
export function won(amount: number): string {
  const n = Number.isFinite(amount) ? Math.round(amount) : 0;
  return `₩${n.toLocaleString("ko-KR")}`;
}

/**
 * 정규화 입력 → 단일 진실 summary 계약.
 * 빈 입력(모든 카운트 0 + budget null)은 allEmpty=true 로 파생 — 빈 데이터 차트
 * 금지(가드①)의 상류 신호. 목업 분포 생성 0(가드②).
 */
export function deriveDashboardSummary(
  input: DashboardSummaryInput,
): DashboardSummary {
  const { quote, po, receive, stock, budget } = input;

  const isSet = budget !== null && budget.limit > 0;
  const usageRate =
    isSet && budget!.limit > 0
      ? (budget!.spent / budget!.limit) * 100
      : 0;

  const allEmpty =
    quote.total === 0 &&
    po.total === 0 &&
    receive.total === 0 &&
    stock.total === 0;

  return {
    modules: { quote, po, receive, stock },
    budget: {
      isSet,
      limit: budget?.limit ?? 0,
      spent: budget?.spent ?? 0,
      remaining: budget?.remaining ?? 0,
      usageRate: Math.round(usageRate * 10) / 10,
    },
    spend: { thisMonth: input.spend?.thisMonth ?? 0 },
    derived: {
      allEmpty,
      budTone: budTone(isSet, usageRate),
    },
  };
}
