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

// §receive-canonical (호영님 판정 2026-09-20) — 입고 정본은 ReceivingDraft.
//   구 키(PENDING/PARTIAL/COMPLETED/ISSUE)는 InventoryRestock 어휘였다.
export type ReceivingStatusKey =
  | "AWAITING_REPLY"
  | "PENDING_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "EXPIRED";

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
    /** 화면(/dashboard/receiving)이 거는 3상태 합. 그 화면과 같은 집합이다. */
    total: number;
    awaitingReply: number;
    pendingReview: number;
    /** 입고 확정분 — 할 일이 아니므로 attention 에 넣지 않는다(호영님 판정). */
    approved: number;
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
    /**
     * §budget-period-axis (P1-5) — 예산이 선언한 기간의 **마지막 달력 날짜** `YYYY-MM-DD`.
     * 선언이 없으면 null → 소비측이 이번 달 말일로 폴백한다.
     * 시간대 변환은 route 가 한 번만 한다(KST 달력 날짜). 여기서부터는 문자열이다.
     */
    periodEnd: string | null;
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
  /**
   * §budget-period-axis (P1-5) — 예산 기간의 마지막 달력 날짜 `YYYY-MM-DD`. 선언이 없으면 null.
   * `남은 일수` · `일평균 가능` · 카드 기간 라벨이 전부 이 축 위에 선다.
   */
  periodEnd: string | null;
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
 * §dashboard-mobile-format — 컴팩트 원화(만원/억). 차트 축·트렌드 요약 전용.
 *   영문 M/K 금지(한국어 일관). ≥1억: "X.X억" · ≥1만: "X,XXX만" · 그 외: 원 단위 숫자.
 *   ★ 정확값이 필요한 KPI(StatLine 등)는 won() 사용 — 본 함수는 만 단위 반올림(트렌드 근사).
 */
export function wonCompact(amount: number): string {
  const n = Number.isFinite(amount) ? Math.round(amount) : 0;
  const abs = Math.abs(n);
  if (abs >= 100_000_000) {
    const v = Math.round((n / 100_000_000) * 10) / 10;
    return `${v.toLocaleString("ko-KR")}억`;
  }
  if (abs >= 10_000) {
    return `${Math.round(n / 10_000).toLocaleString("ko-KR")}만`;
  }
  return n.toLocaleString("ko-KR");
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
      periodEnd: budget?.periodEnd ?? null,
    },
    spend: { thisMonth: input.spend?.thisMonth ?? 0 },
    derived: {
      allEmpty,
      budTone: budTone(isSet, usageRate),
    },
  };
}

// ───────────────────────────────────────────────────────────────
// §budget-canonical-pick (P1-9 · 호영님 권고 2026-09-21)
// ───────────────────────────────────────────────────────────────

/**
 * 대시보드 정본 예산을 고르는 **질의 인자**. route 가 그대로 `findFirst` 에 넘긴다.
 *
 * 규칙: 활성 예산 중 **오늘이 기간 안에 드는 것**, 그 중 **가장 최근 시작분**.
 *
 * ★ 왜 함수로 빼는가 — 규칙을 **값으로 잴 수 있게** 하기 위해서다.
 *   route 안에 인라인으로 두면 sentinel 이 정규식으로 문자열을 더듬는 수밖에 없고,
 *   그건 리팩토링 한 번에 깨지면서 정작 규칙이 바뀐 것은 못 잡는다.
 *   여기서는 `toEqual` 로 질의 인자 자체를 단언한다.
 *
 * ★ 규칙을 JS 로 한 번 더 구현하지 않는다(고르는 주체는 DB 다).
 *   같은 규칙을 두 곳에 적으면 한쪽만 바뀌어도 통과한다 — §receive-canonical 에서 이미 본 형태다.
 *
 * 날짜 미선언(null)은 "제한 없음" 으로 읽어 통과시킨다 — 날짜 없이 만들어진 기존 예산 호환.
 * 정렬 `startDate desc nulls last`: 날짜를 선언한 예산이 선언 안 한 것보다 구체적이다.
 * 동점이면 `createdAt desc` — **미정을 남기지 않는다**(이번 결함의 본체가 그것이었다).
 */
export function canonicalBudgetQuery(userId: string, now: Date) {
  return {
    where: {
      userId,
      isActive: true,
      AND: [
        { OR: [{ startDate: null }, { startDate: { lte: now } }] },
        { OR: [{ endDate: null }, { endDate: { gte: now } }] },
      ],
    },
    orderBy: [
      { startDate: { sort: "desc", nulls: "last" } },
      { createdAt: "desc" },
    ],
  } as const;
}
