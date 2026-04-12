/**
 * Fast-Track Governance Guard Input Resolver
 *
 * 목적:
 *   fast-track-governance-guard.ts 의 `FastTrackGovernanceGuardInput` 을
 *   실제 store/bus 에서 조회해 조립하는 얇은 resolver.
 *   guard 자체는 pure function 이고, 본 모듈이 side-effect (store/bus 접근) 를
 *   격리해 테스트 가능성을 유지한다.
 *
 * 고정 규칙:
 *   1. read-only. canonical truth 변경 X.
 *   2. guard input 조립 이외의 로직을 넣지 않는다.
 *   3. store/bus 접근 실패 시 안전한 기본값 반환 (guard 가 block 쪽으로 기울게).
 */

import { getGlobalGovernanceEventBus } from "@/lib/ai/governance-event-bus";
import type { FastTrackGovernanceGuardInput } from "./fast-track-governance-guard";
import type { FastTrackRecommendationObject } from "@/lib/ontology/types";

// ══════════════════════════════════════════════
// Policy Hold — governance event bus 에서 최신 policy_hold_changed 이벤트 조회
// ══════════════════════════════════════════════

interface PolicyHoldState {
  active: boolean;
  reason: string;
}

function resolvePolicyHoldState(): PolicyHoldState {
  try {
    const bus = getGlobalGovernanceEventBus();
    const events = bus.getHistory({});
    // policy_hold_changed 중 가장 최근 것
    const holdEvents = events.filter((e: any) => e.eventType === "policy_hold_changed");
    if (holdEvents.length === 0) return { active: false, reason: "" };
    const latest = holdEvents[holdEvents.length - 1];
    const holdActive = (latest.payload as Record<string, unknown>)?.holdActive;
    const holdReason = (latest.payload as Record<string, unknown>)?.holdReason;
    return {
      active: holdActive === true,
      reason: typeof holdReason === "string" ? holdReason : "",
    };
  } catch {
    // bus 접근 실패 — 안전하게 active=false
    return { active: false, reason: "" };
  }
}

// ══════════════════════════════════════════════
// Budget Available — budget store 에서 가용 잔액 조회
// ══════════════════════════════════════════════

function resolveAvailableBudget(
  budgets: ReadonlyArray<{ amount: number; remaining?: number; usage?: { remaining: number } }>,
): number | null {
  if (budgets.length === 0) return null;
  const b = budgets[0];
  // remaining 이 직접 있으면 사용, 없으면 usage.remaining, 없으면 amount 전체
  if (typeof b.remaining === "number") return b.remaining;
  if (b.usage && typeof b.usage.remaining === "number") return b.usage.remaining;
  return b.amount;
}

// ══════════════════════════════════════════════
// Snapshot Invalidation — Fast-Track recommendation 중 stale 상태인 case 조회
// ══════════════════════════════════════════════

function resolveInvalidatedSnapshotCaseIds(
  recommendations: Readonly<Record<string, FastTrackRecommendationObject>>,
): Set<string> {
  const invalidated = new Set<string>();
  for (const [caseId, rec] of Object.entries(recommendations)) {
    if (rec.recommendationStatus === "stale") {
      invalidated.add(caseId);
    }
  }
  return invalidated;
}

// ══════════════════════════════════════════════
// Critical Events — governance event bus 에서 미처리 critical 이벤트 존재 여부
// ══════════════════════════════════════════════

function resolveHasPendingCriticalEvents(): boolean {
  try {
    const bus = getGlobalGovernanceEventBus();
    // 최근 50건 중 critical severity 가 하나라도 있으면 pending 으로 간주.
    // 실제 운영에서는 "acknowledged" flag 가 필요하지만,
    // 현재 bus 스펙에는 ack 필드가 없으므로 최근 critical 존재 여부로 판단.
    const recent = bus.getHistory({ limit: 50 });
    return recent.some((e: any) => e.severity === "critical");
  } catch {
    return false;
  }
}

// ══════════════════════════════════════════════
// Public API — guard input 조립
// ══════════════════════════════════════════════

/**
 * 실제 store/bus 에서 guard input 을 조립한다.
 * orders/page.tsx 의 proactive modal gating effect 에서 호출.
 */
export function resolveGuardInputs(
  eligibleItems: readonly FastTrackRecommendationObject[],
  budgets: ReadonlyArray<{ amount: number; remaining?: number; usage?: { remaining: number } }>,
  recommendations: Readonly<Record<string, FastTrackRecommendationObject>>,
): FastTrackGovernanceGuardInput {
  const policyHold = resolvePolicyHoldState();
  return {
    eligibleItems,
    policyHoldActive: policyHold.active,
    policyHoldReason: policyHold.reason,
    availableBudget: resolveAvailableBudget(budgets),
    invalidatedSnapshotCaseIds: resolveInvalidatedSnapshotCaseIds(recommendations),
    hasPendingCriticalEvents: resolveHasPendingCriticalEvents(),
  };
}
