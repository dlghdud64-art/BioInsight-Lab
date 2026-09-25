/**
 * §budget-detail-redesign — 예산 상세 화면의 판정값(순수 파생 · 서버 전용 호출)
 *
 * 정본: 예산 상세 핸드오프.md (호영님 2026-09-25) §2 · §3 · §4
 *
 * 🛑 화면은 이 값을 **받아서 그리기만** 한다(front-only 판정 금지 · 핸드오프 §4).
 *   구 화면은 `reserved = 0 // chain 연결 후 실데이터로 교체` 상수로 사용률을 계산했다.
 *   예약은 이미 BudgetEvent(ORDER_RESERVED)에 있었고 발주 차단도 그 값을 쓰고 있었다.
 *   → 화면이 보여주는 사용률과 서버가 차단에 쓰는 사용률이 **다른 식**이었다.
 *
 * 같은 함수 원칙(CLAUDE.md §화면이 보여주는 수와 게이트가 판정하는 수)
 *   · 상태 톤  = budTone()      (대시보드 §11.302 신호등과 같은 함수)
 *   · 남은 일수·일평균 여유 = budgetPace()  (대시보드 예산 카드와 같은 함수)
 *   · 사용액   = 집행(PurchaseRecord) + 활성 예약(BudgetEvent) · /api/orders 의 잔액식과 같은 항
 *
 * 확정(committed) 단계는 없다. 이 저장소의 예약은 **발주 시점**에 잡히고(ORDER_RESERVED),
 * 구매 완료(markPurchased)에서 소멸하며 지출은 PurchaseRecord 가 든다. 중간 단계를 세는 생산자가 0이라
 * 핸드오프의 「확정」 은 표시하지 않는다(§연결되지 않은 소스는 0 을 보여주지 않는다).
 */

import { budTone } from "@/lib/dashboard/summary-derive";
import { budgetPace } from "@/lib/dashboard/p0-display";

/** 경고 표시 경계(%) · budTone 의 warn 경계와 같은 값이어야 한다(행동 단언으로 잠근다). */
export const BUDGET_WARN_RATE = 80;
/** 차단 경계(%) · /api/orders validateReservation 이 잔액 초과 발주를 거절한다. */
export const BUDGET_BLOCK_RATE = 100;
/** 경고 근접 표시 폭(%p) · 경고 경계까지 이 폭 안이면 규칙 행에 남은 폭을 노란색으로 보인다. */
export const BUDGET_NEAR_BAND = 10;

export type BudgetDetailStatus = "normal" | "warning" | "blocked";
export type BudgetPhase = "upcoming" | "active" | "ended";

export interface CalendarYmd {
  y: number;
  m: number;
  d: number;
}

export interface BudgetDetailInput {
  amount: number;
  /** 활성 발주 예약 합(activeReservedAmount) */
  reserved: number;
  /** 기간 내 집행 합(PurchaseRecord) */
  actual: number;
  /** "YYYY-MM-DD" */
  startDate: string;
  /** "YYYY-MM-DD" */
  endDate: string;
  /** 보는 사람의 달력 날짜(서버가 Asia/Seoul 로 한 번만 변환한다) */
  today: CalendarYmd;
}

export interface BudgetDetailControl {
  used: number;
  available: number;
  /** (예약 + 집행) / 총액 × 100, 소수 1자리 */
  usedRate: number;
  status: BudgetDetailStatus;
  phase: BudgetPhase;
  warnRate: number;
  blockRate: number;
  /** 경고 경계까지 남은 금액(도달했으면 0) */
  warnAmountLeft: number;
  /** 경고 경계까지 남은 %p(도달했으면 0) */
  warnRateLeft: number;
  /** 경고 경계까지 BUDGET_NEAR_BAND 안인가(도달 전) */
  nearWarn: boolean;
  totalDays: number;
  /** 오늘 포함 경과일(시작 전 0 · 종료 후 totalDays) */
  elapsedDays: number;
  /** 오늘 포함 남은 일수(진행 중일 때만 의미 있음) */
  daysLeft: number;
  /** 사용액 / 경과일 (원 단위 내림) */
  dailyBurn: number;
  /** 가용 / 남은 일수 (budgetPace.dailyAllowance) */
  dailyHeadroom: number;
  /** 경과일 기준 선형 진도로 가용이 0 이 되는 날 "YYYY-MM-DD" · 사용 0 이거나 진행 중이 아니면 null */
  projectedExhaustDate: string | null;
  /** 예상 소진일이 기간 종료일보다 앞인가 */
  exhaustBeforeEnd: boolean;
  /** 예상 소진일 → 종료일까지 일수(앞설 때만 양수) */
  daysBeforeEnd: number;
}

const DAY = 86_400_000;

function parseYmd(s: string): CalendarYmd {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) throw new Error(`달력 날짜 형식이 아니다: ${s}`);
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}
const utc = (c: CalendarYmd) => Date.UTC(c.y, c.m - 1, c.d);
const pad2 = (n: number) => String(n).padStart(2, "0");
function ymdOf(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/** 서버 시각 → Asia/Seoul 달력 날짜. 서버가 UTC 여도 KST 달력으로 센다. */
export function seoulToday(now: Date): CalendarYmd {
  const s = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return parseYmd(s);
}

export function deriveBudgetDetail(input: BudgetDetailInput): BudgetDetailControl {
  const amount = Math.max(0, input.amount);
  const reserved = Math.max(0, input.reserved);
  const actual = Math.max(0, input.actual);
  const used = reserved + actual;
  const available = Math.max(amount - used, 0);
  const rawRate = amount > 0 ? (used / amount) * 100 : 0;
  const usedRate = Math.round(rawRate * 10) / 10;

  const tone = budTone(amount > 0, rawRate);
  const status: BudgetDetailStatus =
    tone === "danger" ? "blocked" : tone === "warn" ? "warning" : "normal";

  const start = utc(parseYmd(input.startDate));
  const end = utc(parseYmd(input.endDate));
  const today = utc(input.today);
  const totalDays = Math.max(1, Math.round((end - start) / DAY) + 1);
  const phase: BudgetPhase = today < start ? "upcoming" : today > end ? "ended" : "active";
  const elapsedDays =
    phase === "upcoming" ? 0 : phase === "ended" ? totalDays : Math.round((today - start) / DAY) + 1;

  // 남은 일수·일평균 여유는 대시보드와 같은 함수에서 나온다.
  // budgetPace 는 now 의 **로컬 게터**로 달력 날짜를 읽으므로, KST 달력 값으로 로컬 Date 를 만든다.
  const localToday = new Date(input.today.y, input.today.m - 1, input.today.d);
  const pace = budgetPace(available, localToday, input.endDate);
  const daysLeft = phase === "active" ? pace.daysLeft : phase === "upcoming" ? totalDays : 0;
  const dailyHeadroom = phase === "active" ? pace.dailyAllowance : phase === "upcoming" ? Math.floor(available / totalDays) : 0;

  const dailyBurn = elapsedDays > 0 ? Math.floor(used / elapsedDays) : 0;

  let projectedExhaustDate: string | null = null;
  let exhaustBeforeEnd = false;
  let daysBeforeEnd = 0;
  if (phase === "active" && used > 0 && dailyBurn > 0) {
    const daysToZero = Math.ceil(available / dailyBurn);
    const at = today + daysToZero * DAY;
    projectedExhaustDate = ymdOf(at);
    if (at < end) {
      exhaustBeforeEnd = true;
      daysBeforeEnd = Math.round((end - at) / DAY);
    }
  }

  const warnAmountLeft = Math.max(Math.floor((amount * BUDGET_WARN_RATE) / 100) - used, 0);
  const warnRateLeft = Math.max(Math.round((BUDGET_WARN_RATE - rawRate) * 10) / 10, 0);
  const nearWarn = rawRate < BUDGET_WARN_RATE && BUDGET_WARN_RATE - rawRate <= BUDGET_NEAR_BAND;

  return {
    used,
    available,
    usedRate,
    status,
    phase,
    warnRate: BUDGET_WARN_RATE,
    blockRate: BUDGET_BLOCK_RATE,
    warnAmountLeft,
    warnRateLeft,
    nearWarn,
    totalDays,
    elapsedDays,
    daysLeft,
    dailyBurn,
    dailyHeadroom,
    projectedExhaustDate,
    exhaustBeforeEnd,
    daysBeforeEnd,
  };
}

/** 발주 상태 → 화면 문구 (영문 enum 노출 0) */
export const ORDER_STATUS_LABEL: Record<string, string> = {
  ORDERED: "주문 완료",
  CONFIRMED: "공급사 확인",
  SHIPPING: "배송 중",
  DELIVERED: "배송 완료",
  CANCELLED: "취소",
};
