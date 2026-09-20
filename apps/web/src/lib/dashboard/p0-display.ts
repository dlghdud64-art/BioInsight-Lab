/**
 * §main-dashboard-p0-honesty — 대시보드 P0 정직성 표시 계약(순수 파생)
 *
 * 정본: docs/plans/PLAN_main-dashboard-p0-honesty.md
 *       메인 대시보드 핸드오프.md (호영님 2026-09-17) §1·§4·§5·§6
 *
 * 이 모듈은 **표시 규율만** 파생한다. canonical truth 는 여전히
 *   /api/dashboard/summary (summary.budget · summary.spend · summary.modules)
 * 이며, 여기서 카운트를 새로 만들거나 전이를 정의하지 않는다(가드②③).
 *
 * budTone 재정의 0 — 예산 톤의 canonical 권위는 summary-derive.ts 의
 *   budTone() 이다. 본 모듈은 그 결과를 받기만 한다.
 *
 * 순수 함수(React·DOM·fetch 의존 0)라 sentinel 이 아니라 **행동 단언**으로
 * 검증한다. 정규식 sentinel 은 구조 사실(FAB 부재 등)에만 쓴다.
 */

import type { DashboardSummary } from "@/lib/dashboard/summary-derive";

// ───────────────────────────────────────────────────────────────
// 1. StatLine — 예산 미설정 시 금액 렌더 금지 (핸드오프 §0-1 · §5 초기 상태)
// ───────────────────────────────────────────────────────────────

/** amount = 실금액 표시 / pending = 집계 전(금액 렌더 금지). */
export type StatDisplayMode = "amount" | "pending";

export interface StatDisplay {
  mode: StatDisplayMode;
  /** 큰 글씨 자리에 들어갈 문자열. pending 이면 금액이 아니다. */
  primary: string;
  /** 보조 1줄. pending 일 때만 존재. */
  helper: string | null;
}

export type BudgetStatKind = "spend" | "remaining";

/**
 * 예산 미설정(isSet=false)이면 `₩0` 대신 정직 문구를 돌려준다.
 *
 * ★ `₩0` 이 "지출이 0원" 과 "아직 집계 전" 을 구분하지 못하는 것이 결함의 뿌리다.
 *   미설정 상태에서는 금액을 아예 만들지 않는다 — 포맷 함수를 부르지 않는다.
 */
export function budgetStatDisplay(
  kind: BudgetStatKind,
  amountWon: number,
  isSet: boolean,
  format: (n: number) => string,
): StatDisplay {
  if (!isSet) {
    return kind === "spend"
      ? { mode: "pending", primary: "집계 전", helper: "첫 발주 완료 후 표시" }
      : { mode: "pending", primary: "설정 전", helper: "예산 등록 후 표시" };
  }
  return { mode: "amount", primary: format(amountWon), helper: null };
}

// ───────────────────────────────────────────────────────────────
// 2. 카테고리 도넛 게이팅 (핸드오프 §0-2 · §5)
// ───────────────────────────────────────────────────────────────

export interface CategorySlice {
  category: string;
  amount: number;
}

/**
 * 예산 미설정 시 도넛·총 지출 미노출.
 *
 * ★ 상단은 `summary.spend.thisMonth`(이번 달), 도넛은 `stats.categorySpending`
 *   (PurchaseRecord 최근 6개월)이라 기간이 다르다. 예산 미설정 상태에서 둘을
 *   한 카드에 얹으면 `₩0` 과 6개월 누계가 공존한다(핸드오프 §0-2).
 *   실분포가 비어 있을 때도 렌더하지 않는다 — 가짜 분포 0(가드②).
 */
export function shouldRenderCategoryDonut(
  isSet: boolean,
  categorySpending: readonly CategorySlice[] | undefined,
): boolean {
  if (!isSet) return false;
  if (!categorySpending || categorySpending.length === 0) return false;
  return categorySpending.some((c) => Number.isFinite(c.amount) && c.amount > 0);
}

// ───────────────────────────────────────────────────────────────
// 3. 파이프라인 상태 칩 (핸드오프 §4 — 게이지 대체)
// ───────────────────────────────────────────────────────────────

/** §11.302 신호등 — amber/orange 금지. 주의는 yellow. */
export type ChipTone = "red" | "yellow" | "gray" | "emerald";

export interface PipelineChip {
  key: string;
  label: string;
  count: number | null;
  tone: ChipTone;
  /** 모듈 필터 딥링크. 기존 검증된 라우트·파라미터만 사용(신규 dead route 0). */
  href: string;
}

export type PipelineStageKey = "quote" | "receive" | "stock";

/**
 * 단계별 상태 칩. **count 0 인 칩은 반환하지 않는다**(dead button 0).
 * 입고는 전량 0이면 `이상 없음`(emerald) 1개를 돌려준다 — 정직한 정상 신호.
 *
 * ⚠️ 핸드오프 §4 의 견적 `마감 오늘 n` 칩은 여기 없다.
 *   회신 마감일이 summary 계약에 없어 파생 불가 → P1(§3 기한 그룹)과 함께 처리한다.
 *   없는 데이터로 칩을 만들지 않는다(가드②).
 */
export function buildPipelineChips(
  summary: DashboardSummary | undefined,
): Record<PipelineStageKey, PipelineChip[]> {
  const q = summary?.modules.quote;
  const r = summary?.modules.receive;
  const st = summary?.modules.stock;

  const quote: PipelineChip[] = [];
  if ((q?.pending ?? 0) > 0) {
    quote.push({
      key: "quote-pending",
      // §main-dashboard-p0-honesty Smoke D (2026-09-20) — 라벨 정정.
      //   핸드오프 §4 예시가 `회신 대기` 였으나 `quote.pending` = status PENDING 이고,
      //   착지 화면(/dashboard/quotes?status=PENDING)은 그 단계를 **발송 대기** 로 부른다.
      //   아직 발송도 안 된 견적을 "회신 대기" 로 부르면 같은 것을 두 이름으로 말하는 것이다.
      //   시안 문구보다 착지 화면 어휘가 이긴다 — 클릭해서 확인할 수 있는 쪽이 사실이다.
      label: "발송 대기",
      count: q!.pending,
      tone: "yellow",
      href: "/dashboard/quotes?status=PENDING",
    });
  }
  if ((q?.responded ?? 0) > 0) {
    quote.push({
      key: "quote-responded",
      label: "비교 중",
      count: q!.responded,
      tone: "gray",
      href: "/dashboard/quotes?status=RESPONDED",
    });
  }

  // 🛑 §main-dashboard-p0-honesty — 입고 칩은 P0 에서 만들지 않는다 (호영님 판정 2026-09-18).
  //
  //   prod 실측: 판정 소스와 착지 화면이 **다른 테이블**이다.
  //     판정  summary.modules.receive  <- db.inventoryRestock   (api/dashboard/summary/route.ts:98)
  //     착지  /dashboard/receiving     <- ReceivingDraft        (api/receiving-drafts)
  //   그래서 「이상 없음」(그린) 을 눌러도 빈 입고 화면이 나왔다.
  //   CLAUDE.md 「화면이 보여주는 수와 게이트가 판정하는 수는 같은 함수에서 나와야 한다」 위반.
  //
  //   어느 테이블을 canonical 로 삼을지는 입고 큐 트랙의 결정이라 이 트랙이 앞질러 내리지 않는다.
  //   칩을 만들지 않으면 Pipeline 이 기존 텍스트 표시로 되돌아간다(클릭 대상 0 = dead link 0).
  //   ⚠️ 잔여 P1: 입고 카드의 `열기 ›` 도 같은 불일치를 안고 있다(본 트랙 이전부터. 신규 회귀 아님).
  const receive: PipelineChip[] = [];
  void r;

  const stock: PipelineChip[] = [];
  if ((st?.lowStock ?? 0) > 0) {
    stock.push({
      key: "stock-low",
      label: "안전재고 미달",
      count: st!.lowStock,
      tone: "red",
      href: "/dashboard/inventory?filter=low",
    });
  }
  if ((st?.expiringCount ?? 0) > 0) {
    stock.push({
      key: "stock-expiring",
      label: "만료 임박",
      count: st!.expiringCount,
      tone: "yellow",
      href: "/dashboard/inventory?filter=lot_issue&tab=overview",
    });
  }

  return { quote, receive, stock };
}

// ───────────────────────────────────────────────────────────────
// 4. 예산 소진 페이스 (핸드오프 §5 운영 상태 3지표)
// ───────────────────────────────────────────────────────────────

export interface BudgetPace {
  /** 이번 달 남은 일수(오늘 포함). 월말이면 1. */
  daysLeft: number;
  /** 남은 예산 / 남은 일수. 잔여가 음수면 0(초과 상태에서 "쓸 수 있는 돈" 을 만들지 않는다). */
  dailyAllowance: number;
}

/**
 * 잔여 예산 + 남은 일수 → 일평균 가능액.
 *
 * ★ `now` 를 주입받는다 — 시스템 시계에 의존하면 테스트가 날짜마다 흔들린다.
 *   예산 미설정 상태에서는 호출하지 않는다(호출측 게이트).
 */
export function budgetPace(remainingWon: number, now: Date): BudgetPace {
  const year = now.getFullYear();
  const month = now.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const daysLeft = Math.max(1, lastDay - now.getDate() + 1);
  const safeRemaining = Number.isFinite(remainingWon) && remainingWon > 0 ? remainingWon : 0;
  return { daysLeft, dailyAllowance: Math.floor(safeRemaining / daysLeft) };
}
