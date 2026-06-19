/**
 * §quote-management P1 — 우선순위/마감 설정값(재보정 가능, 하드코딩 금지)
 *
 * 지시문 §03 가중합 + §04 마감. 운영 데이터 쌓이면 가중치 재보정(예: 재고 비중 상향).
 *   모든 점수·임계값·티어는 여기서만 정의 — derive.ts 는 이 값을 참조.
 */

/** 우선순위 4요인 점수(지시문 §03 표). */
export const PRIORITY_WEIGHTS = {
  // 마감 임박도 — D-day 구간별. none = 마감 없음(dueDate null).
  urgency: { d1: 40, d3: 28, d5: 16, d7: 8, other: 3, none: 0 },
  // 금액 규모 — 티어별. unknown = amount null.
  money: { m1000: 25, m500: 16, m100: 9, other: 5, unknown: 3 },
  // 회신 정체 — s2 한정. stalled = 회신율<50% & 발송 3일+, partial = 일부만 회신.
  stall: { stalled: 20, partial: 8 },
  // 재고 위급.
  stock: { critical: 15, low: 8 },
} as const;

/** 금액 티어 경계(원). */
export const MONEY_TIERS = { t1000: 1e7, t500: 5e6, t100: 1e6 } as const;

/** 등급 임계값(합계 점수). */
export const PRIORITY_THRESHOLDS = { high: 50, mid: 28 } as const;

/** 회신 정체 판정 — 발송 후 경과일·회신율. */
export const STALL_RULE = { sinceDays: 3, repliedRatio: 0.5 } as const;

/** 마감 임박(빨강 강조) D-day 임계. */
export const SOON_DDAY = 2 as const;

/** 응답 요청 기한 입력 범위(일) — 발송 모달. */
export const RESPONSE_WINDOW_RANGE = { min: 1, max: 90 } as const;
