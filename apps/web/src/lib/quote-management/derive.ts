/**
 * §quote-management P1 — 파생 로직(저장 금지, 항상 계산)
 *
 * 지시문 §02~§04. 우선순위·마감·회신수는 절대 저장하지 말고 읽을 때마다 파생.
 *   - deriveStage: QuoteStatus → s1~s5 (CANCELLED 등 퍼널 외 = null).
 *   - computeDue: 단계별 기준일. s2 = sentDate+responseWindowDays(발송 모달 공유).
 *     ★ s1/s3/s4 기준일(sendByDate/decisionDueDate)이 없으면 null → 표시 "—"(미정).
 *       validUntil 등 다른 의미 필드를 마감으로 근사 대입 금지(가짜 마감 = 정직성 위반).
 *   - computePriority: 4요인 가중합(config) → { level, reason, score, dd }.
 */

import {
  PRIORITY_WEIGHTS as W,
  MONEY_TIERS as MT,
  PRIORITY_THRESHOLDS as TH,
  STALL_RULE,
} from "./config";

export type Stage = "s1" | "s2" | "s3" | "s4" | "s5";
export type StockLevel = "ok" | "low" | "critical";
export type PriorityLevel = "high" | "mid" | "low";

export interface Supplier {
  name: string;
  replied: boolean;
  email?: string;
}

/** 파생 입력 케이스(현행 Quote/QuoteVendorRequest 에서 정규화). */
export interface QuoteCase {
  id: string;
  name: string;
  stage: Stage;
  suppliers: Supplier[];
  amount: number | null;
  stock: StockLevel;
  sentDate: string | null; // 발송일 YYYY-MM-DD
  responseWindowDays: number; // 응답 요청 기한(일)
  sendByDate: string | null; // s1 발송 기한 (B: 현행 미보유 → null = "—")
  decisionDueDate: string | null; // s3/s4 의사결정 기한 (B: 현행 미보유 → null = "—")
}

/** QuoteStatus → stage. 퍼널 외(CANCELLED 등) = null. */
export function deriveStage(status: string): Stage | null {
  switch (status) {
    case "PENDING":
    case "PARSED":
      return "s1";
    case "SENT":
      return "s2";
    case "RESPONDED":
      return "s3";
    case "COMPLETED":
      return "s4";
    case "PURCHASED":
      return "s5";
    default:
      return null; // CANCELLED 등 퍼널 외
  }
}

export function vendorsCount(c: QuoteCase): number {
  return c.suppliers.length;
}
export function repliedCount(c: QuoteCase): number {
  return c.suppliers.filter((s) => s.replied).length;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
/** (dateStr − 오늘) 일 단위. null 입력 = null. */
export function daysUntil(dateStr: string | null, now: Date = new Date()): number | null {
  if (!dateStr) return null;
  const target = startOfDay(new Date(dateStr));
  const today = startOfDay(now);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}
/** (오늘 − dateStr) 일 단위. */
export function daysSince(dateStr: string | null, now: Date = new Date()): number | null {
  const u = daysUntil(dateStr, now);
  return u == null ? null : -u;
}

/** 단계별 마감 기준일. 없으면 null(표시 "—"). 근사 대입 금지. */
export function computeDue(c: QuoteCase): string | null {
  if (c.stage === "s2" && c.sentDate) return addDays(c.sentDate, c.responseWindowDays);
  if (c.stage === "s1") return c.sendByDate; // null 가능 → "—"
  if (c.stage === "s3" || c.stage === "s4") return c.decisionDueDate; // null 가능 → "—"
  return null; // s5 = 마감 개념 없음
}

/** D-day 표시 라벨. */
export function dDayLabel(dd: number | null): string {
  if (dd == null) return "—";
  if (dd < 0) return `${-dd}일 지남`;
  if (dd === 0) return "D-day";
  return `D-${dd}`;
}

export interface PriorityResult {
  level: PriorityLevel;
  reason: string | null; // 高·中만 노출, 低는 null
  score: number;
  dd: number | null;
}

/** §03 가중합 → 등급 + 최대 기여 요인(사유). */
export function computePriority(c: QuoteCase, now: Date = new Date()): PriorityResult {
  const dd = daysUntil(computeDue(c), now);
  const urgency =
    dd == null
      ? W.urgency.none
      : dd <= 1
        ? W.urgency.d1
        : dd <= 3
          ? W.urgency.d3
          : dd <= 5
            ? W.urgency.d5
            : dd <= 7
              ? W.urgency.d7
              : W.urgency.other;

  const money =
    c.amount == null
      ? W.money.unknown
      : c.amount >= MT.t1000
        ? W.money.m1000
        : c.amount >= MT.t500
          ? W.money.m500
          : c.amount >= MT.t100
            ? W.money.m100
            : W.money.other;

  let stall = 0;
  if (c.stage === "s2" && c.suppliers.length > 0) {
    const ratio = repliedCount(c) / c.suppliers.length;
    const since = daysSince(c.sentDate, now);
    if (ratio < STALL_RULE.repliedRatio && since != null && since >= STALL_RULE.sinceDays) {
      stall = W.stall.stalled;
    } else if (repliedCount(c) < c.suppliers.length) {
      stall = W.stall.partial;
    }
  }

  const stock = c.stock === "critical" ? W.stock.critical : c.stock === "low" ? W.stock.low : 0;

  const score = urgency + money + stall + stock;
  const factors: Record<string, number> = {
    마감임박: urgency,
    고액: money,
    회신정체: stall,
    재고위급: stock,
  };
  const level: PriorityLevel = score >= TH.high ? "high" : score >= TH.mid ? "mid" : "low";
  // 사유 = 기여 최대 요인. 低는 생략(null).
  let reason: string | null = null;
  if (level !== "low") {
    reason = Object.entries(factors).reduce((a, b) => (b[1] > a[1] ? b : a))[0];
  }
  return { level, reason, score, dd };
}
