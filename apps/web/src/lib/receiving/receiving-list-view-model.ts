/**
 * §11.334 P1 — 입고 목록 웹 리디자인 파생 view-model (순수함수).
 *
 * 시안(입고 목록 웹 리디자인.html)의 파이프라인 퍼널·탭·행 visual 을
 * ModuleLandingItem.bucketKey 에서 **파생**한다.
 *
 * ⚠ canonical 재고 truth 대체 금지: 여기서 만드는 값은 전부 projection.
 *   실제 재고 반영은 POST /api/receiving-drafts/[id]/approve (가드 완비)만 수행.
 *   퍼널 카운트/badge/action 은 표시·분기 힌트일 뿐, 상태를 여기서 바꾸지 않는다.
 */
import type { ModuleBucketKey, ModuleLandingItem } from "@/lib/ops-console/module-landing-adapter";

// ── 파이프라인 퍼널 4단계 (시안 §funnel) ──────────────────────────
export type ReceivingFunnelKey = "waiting" | "review" | "blocked" | "posted";

export interface ReceivingFunnelCounts {
  /** 입고 대기 — 도착 예정·미도착 (waiting_external) */
  waiting: number;
  /** 검수 대기 — 도착 후 검수 필요 (needs_review) */
  review: number;
  /** 문서·판단 — 반영 차단·보류 (blocked) */
  blocked: number;
  /** 재고 반영 — 반영 대기(ready) + 반영 완료(handoff) */
  posted: number;
}

export function buildReceivingFunnel(items: ReadonlyArray<ModuleLandingItem>): ReceivingFunnelCounts {
  const c: ReceivingFunnelCounts = { waiting: 0, review: 0, blocked: 0, posted: 0 };
  for (const it of items) {
    switch (it.bucketKey) {
      case "waiting_external": c.waiting++; break;
      case "needs_review": c.review++; break;
      case "blocked": c.blocked++; break;
      case "ready": c.posted++; break;
      case "handoff": c.posted++; break;
    }
  }
  return c;
}

// ── 탭 카운트 (시안 §toolbar: 처리 필요 / 전체 / 완료) ─────────────
export interface ReceivingTabCounts {
  actionable: number;
  all: number;
  done: number;
}

export function buildReceivingTabCounts(items: ReadonlyArray<ModuleLandingItem>): ReceivingTabCounts {
  let done = 0;
  for (const it of items) if (it.bucketKey === "handoff") done++;
  return { actionable: items.length - done, all: items.length, done };
}

// ── 행 visual + 상태별 액션 분기 (시안 §list / §quickview action) ──
export type ReceivingRowAction = "coa" | "post" | "inspect" | "none";
export type ReceivingRowTone = "rose" | "amber" | "blue" | "emerald" | "slate";

export interface ReceivingRowVisual {
  tone: ReceivingRowTone;
  badgeLabel: string;
  /** 퀵뷰 드로어 하단 액션 분기 (시안 data-action) */
  action: ReceivingRowAction;
}

export function resolveReceivingRowVisual(bucketKey: ModuleBucketKey): ReceivingRowVisual {
  switch (bucketKey) {
    case "blocked":
      return { tone: "rose", badgeLabel: "반영 차단", action: "coa" };
    case "needs_review":
      return { tone: "amber", badgeLabel: "검수 대기", action: "inspect" };
    case "ready":
      return { tone: "blue", badgeLabel: "반영 대기", action: "post" };
    case "handoff":
      return { tone: "emerald", badgeLabel: "반영 완료", action: "none" };
    case "waiting_external":
      return { tone: "slate", badgeLabel: "입고 대기", action: "none" };
  }
}
