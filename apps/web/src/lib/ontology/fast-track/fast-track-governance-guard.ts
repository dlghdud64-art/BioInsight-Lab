/**
 * Fast-Track Governance Guard
 *
 * 목적:
 *   proactive entry modal / similar intercept modal 을 노출하기 전에
 *   governance 사전검증을 수행한다. eligible 이라도 governance 차원에서
 *   자동 승인이 부적절한 상황이면 modal 노출을 차단하고 사유를 제공한다.
 *
 * 고정 규칙:
 *   1. canonical truth 변경 X. read-only guard 다.
 *   2. Fast-Track engine 의 eligibility 와는 독립적인 상위 governance layer.
 *      engine 이 eligible 이라 해도 guard 가 block 하면 modal 은 뜨지 않는다.
 *   3. optimistic unlock 금지. guard 가 block 을 반환하면 caller 는
 *      무조건 존중해야 한다.
 *   4. 판정은 deterministic — 동일 입력 → 동일 결과.
 *
 * 검증 항목:
 *   - policy hold active → block
 *   - budget 잔액 부족 (총 eligible 금액 > 가용 예산) → block
 *   - 승인 snapshot invalidation 중 → block
 *   - governance event bus 에 미처리 critical 이벤트 존재 → block
 */

import type { FastTrackRecommendationObject } from "@/lib/ontology/types";

// ══════════════════════════════════════════════
// Guard result
// ══════════════════════════════════════════════

export interface FastTrackGovernanceGuardResult {
  /** true 이면 modal 노출 허용 */
  allowed: boolean;
  /** block 사유 목록 (allowed=true 면 빈 배열) */
  blockReasons: FastTrackGuardBlockReason[];
  /** block 이 있더라도 "일부만" 허용 가능한 항목 (partial allow) */
  allowedItems: FastTrackRecommendationObject[];
  /** block 으로 제외된 항목 */
  blockedItems: FastTrackRecommendationObject[];
}

export interface FastTrackGuardBlockReason {
  code: FastTrackGuardBlockCode;
  message: string;
  /** 해결 힌트 */
  remediation: string;
  /** 이 block 에 의해 차단된 case id 목록 (null 이면 전체 차단) */
  affectedCaseIds: string[] | null;
}

export type FastTrackGuardBlockCode =
  | "policy_hold_active"
  | "budget_insufficient"
  | "snapshot_invalidated"
  | "critical_event_pending";

// ══════════════════════════════════════════════
// Guard input
// ══════════════════════════════════════════════

export interface FastTrackGovernanceGuardInput {
  /** eligible Fast-Track items (modal 에 보여줄 후보) */
  eligibleItems: readonly FastTrackRecommendationObject[];
  /** 현재 정책 보류 상태 */
  policyHoldActive: boolean;
  /** 정책 보류 사유 (있을 때만) */
  policyHoldReason?: string;
  /** 가용 예산 잔액 (null 이면 예산 검증 skip) */
  availableBudget: number | null;
  /** 승인 snapshot 이 invalidated 상태인 case id 집합 */
  invalidatedSnapshotCaseIds: ReadonlySet<string>;
  /** 미처리 critical governance 이벤트 존재 여부 */
  hasPendingCriticalEvents: boolean;
}

// ══════════════════════════════════════════════
// Evaluator
// ══════════════════════════════════════════════

/**
 * Fast-Track governance guard 를 실행한다.
 * read-only, deterministic, no side effects.
 */
export function evaluateFastTrackGovernanceGuard(
  input: FastTrackGovernanceGuardInput,
): FastTrackGovernanceGuardResult {
  const blockReasons: FastTrackGuardBlockReason[] = [];
  let remainingItems = [...input.eligibleItems];

  // ── 1. Policy Hold — 전체 차단 ──
  if (input.policyHoldActive) {
    blockReasons.push({
      code: "policy_hold_active",
      message: `정책 보류 활성 — ${input.policyHoldReason ?? "사유 미지정"}`,
      remediation: "정책 보류가 해제된 후 Fast-Track 승인이 가능합니다",
      affectedCaseIds: null,
    });
    return {
      allowed: false,
      blockReasons,
      allowedItems: [],
      blockedItems: [...input.eligibleItems],
    };
  }

  // ── 2. Critical Event Pending — 전체 차단 ──
  if (input.hasPendingCriticalEvents) {
    blockReasons.push({
      code: "critical_event_pending",
      message: "미처리 긴급 governance 이벤트 존재",
      remediation: "긴급 이벤트를 먼저 확인한 후 Fast-Track 승인을 진행하세요",
      affectedCaseIds: null,
    });
    return {
      allowed: false,
      blockReasons,
      allowedItems: [],
      blockedItems: [...input.eligibleItems],
    };
  }

  // ── 3. Snapshot Invalidation — 개별 case 차단 ──
  if (input.invalidatedSnapshotCaseIds.size > 0) {
    const blocked: FastTrackRecommendationObject[] = [];
    const passed: FastTrackRecommendationObject[] = [];
    for (const item of remainingItems) {
      if (input.invalidatedSnapshotCaseIds.has(item.procurementCaseId)) {
        blocked.push(item);
      } else {
        passed.push(item);
      }
    }
    if (blocked.length > 0) {
      blockReasons.push({
        code: "snapshot_invalidated",
        message: `승인 스냅샷 무효화 — ${blocked.length}건`,
        remediation: "해당 건의 재평가가 완료되면 Fast-Track이 다시 가능합니다",
        affectedCaseIds: blocked.map((b) => b.procurementCaseId),
      });
    }
    remainingItems = passed;
  }

  // ── 4. Budget Check — 남은 항목 중 예산 초과분 개별 차단 ──
  if (input.availableBudget !== null && remainingItems.length > 0) {
    // 금액 내림차순 정렬 → greedy 방식으로 예산 안에 들어가는 항목만 허용
    const sorted = [...remainingItems].sort(
      (a, b) => a.evaluationSnapshot.totalAmount - b.evaluationSnapshot.totalAmount,
    );
    let remaining = input.availableBudget;
    const withinBudget: FastTrackRecommendationObject[] = [];
    const overBudget: FastTrackRecommendationObject[] = [];

    for (const item of sorted) {
      if (item.evaluationSnapshot.totalAmount <= remaining) {
        remaining -= item.evaluationSnapshot.totalAmount;
        withinBudget.push(item);
      } else {
        overBudget.push(item);
      }
    }

    if (overBudget.length > 0) {
      const overTotal = overBudget.reduce(
        (s, i) => s + i.evaluationSnapshot.totalAmount, 0,
      );
      blockReasons.push({
        code: "budget_insufficient",
        message: `예산 부족 — ${overBudget.length}건 (₩${overTotal.toLocaleString("ko-KR")}) 초과`,
        remediation: "예산 증액 또는 일부 건만 선택 승인하세요",
        affectedCaseIds: overBudget.map((b) => b.procurementCaseId),
      });
    }

    remainingItems = withinBudget;
  }

  // ── 결과 조합 ──
  const allBlocked = input.eligibleItems.filter(
    (item) => !remainingItems.some((r) => r.objectId === item.objectId),
  );

  return {
    allowed: remainingItems.length > 0,
    blockReasons,
    allowedItems: remainingItems,
    blockedItems: allBlocked,
  };
}
