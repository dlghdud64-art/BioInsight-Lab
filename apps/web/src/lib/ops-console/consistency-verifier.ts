/**
 * consistency-verifier.ts
 *
 * Cross-Module State Consistency 검증 helper.
 * 개발용 — 사용자-facing UI에 노출하지 않는다.
 *
 * canonical demo scenarios에서 화면 간 상태 충돌이 없는지 검사한다.
 *
 * @module ops-console/consistency-verifier
 */

import type { UnifiedInboxItem } from './inbox-adapter';
import type {
  EntityOperationalState,
  OperationalReadiness,
} from './entity-operational-state';

// ===========================================================================
// 1. Inconsistency Types
// ===========================================================================

export type InconsistencyType =
  | 'ready_in_detail_but_blocked_in_inbox'
  | 'handoff_ready_but_no_next_route'
  | 'waiting_external_but_blocked_badge'
  | 'selected_still_showing_ready'
  | 'issued_still_showing_ready_to_issue'
  | 'posted_still_showing_ready_to_post'
  | 'converted_still_showing_ready'
  | 'priority_divergence'
  | 'readiness_mismatch'
  | 'owner_mismatch';

export interface ConsistencyIssue {
  type: InconsistencyType;
  entityId: string;
  entityType: string;
  description: string;
  surface1: string;
  surface1Value: string;
  surface2: string;
  surface2Value: string;
  severity: 'error' | 'warning';
}

// ===========================================================================
// 2. Cross-Surface Verifier
// ===========================================================================

/**
 * EntityOperationalState (canonical normalization)와
 * UnifiedInboxItem (inbox adapter 출력)의 일관성을 검증한다.
 */
export function verifyEntityInboxConsistency(
  opState: EntityOperationalState,
  inboxItems: UnifiedInboxItem[],
): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];
  const entityInboxItems = inboxItems.filter((i) => i.entityId === opState.entityId);

  if (entityInboxItems.length === 0 && opState.readiness !== 'terminal' && opState.readiness !== 'handoff_ready') {
    // Entity has active operational state but no inbox item — might be OK for some states
    return issues;
  }

  for (const inbox of entityInboxItems) {
    // 1. Ready in detail but blocked in inbox
    if (opState.readiness === 'ready' && inbox.blockedReason) {
      issues.push({
        type: 'ready_in_detail_but_blocked_in_inbox',
        entityId: opState.entityId,
        entityType: opState.entityType,
        description: `Entity is 'ready' in canonical state but has blockedReason in inbox`,
        surface1: 'operational_state',
        surface1Value: 'ready',
        surface2: 'inbox',
        surface2Value: `blocked: ${inbox.blockedReason}`,
        severity: 'error',
      });
    }

    // 2. Waiting external in detail but blocked badge in inbox
    if (opState.readiness === 'waiting_external' && inbox.triageGroup === 'blocked') {
      issues.push({
        type: 'waiting_external_but_blocked_badge',
        entityId: opState.entityId,
        entityType: opState.entityType,
        description: `Entity is 'waiting_external' in canonical state but grouped as 'blocked' in inbox`,
        surface1: 'operational_state',
        surface1Value: 'waiting_external',
        surface2: 'inbox_triage',
        surface2Value: 'blocked',
        severity: 'warning',
      });
    }

    // 3. Priority divergence check
    const inboxP = priorityToNumber(inbox.priority);
    const opP = priorityToNumber(opState.priorityClass);
    if (Math.abs(inboxP - opP) >= 2) {
      issues.push({
        type: 'priority_divergence',
        entityId: opState.entityId,
        entityType: opState.entityType,
        description: `Priority differs by 2+ tiers between canonical state and inbox`,
        surface1: 'operational_state',
        surface1Value: opState.priorityClass,
        surface2: 'inbox',
        surface2Value: inbox.priority,
        severity: 'warning',
      });
    }
  }

  return issues;
}

// ===========================================================================
// 3. Handoff Integrity Verifier
// ===========================================================================

/**
 * Handoff ready 상태에서 next route와 target module이 유효한지 확인한다.
 */
export function verifyHandoffIntegrity(
  states: EntityOperationalState[],
): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];

  for (const state of states) {
    if (state.readiness === 'handoff_ready') {
      if (!state.handoff.targetRoute) {
        issues.push({
          type: 'handoff_ready_but_no_next_route',
          entityId: state.entityId,
          entityType: state.entityType,
          description: 'Handoff is ready but no target route is defined',
          surface1: 'operational_state',
          surface1Value: 'handoff_ready',
          surface2: 'handoff.targetRoute',
          surface2Value: 'null',
          severity: 'error',
        });
      }
    }
  }

  return issues;
}

// ===========================================================================
// 4. Stale State Verifier
// ===========================================================================

/**
 * 이미 다음 단계로 넘어간 엔티티가 이전 단계의 ready 상태로 남아있는지 감지.
 */
export function verifyStaleStates(
  states: EntityOperationalState[],
  inboxItems: UnifiedInboxItem[],
): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];

  // Build a set of entity ids that are terminal or handoff_ready
  const handedOffIds = new Set(
    states
      .filter((s) => s.readiness === 'terminal' || s.readiness === 'handoff_ready')
      .map((s) => s.entityId),
  );

  // Check if any inbox items still point to these entities with 'ready' semantics
  for (const inbox of inboxItems) {
    if (handedOffIds.has(inbox.entityId) && inbox.triageGroup === 'now') {
      const opState = states.find((s) => s.entityId === inbox.entityId);
      if (opState) {
        const staleType =
          opState.entityType === 'quote' ? 'selected_still_showing_ready' :
          opState.entityType === 'po' ? 'issued_still_showing_ready_to_issue' :
          opState.entityType === 'receiving' ? 'posted_still_showing_ready_to_post' :
          'converted_still_showing_ready';

        issues.push({
          type: staleType,
          entityId: inbox.entityId,
          entityType: opState.entityType,
          description: `Entity is ${opState.readiness} in canonical state but still shows as actionable in inbox`,
          surface1: 'operational_state',
          surface1Value: opState.readiness,
          surface2: 'inbox_triage',
          surface2Value: inbox.triageGroup,
          severity: 'error',
        });
      }
    }
  }

  return issues;
}

// ===========================================================================
// 5. Full Scenario Verification
// ===========================================================================

/**
 * 전체 시나리오에 대해 모든 검증을 실행한다.
 * 개발/테스트 시 호출하여 화면 간 상태 충돌을 사전 탐지.
 */
export function runFullConsistencyCheck(
  operationalStates: EntityOperationalState[],
  inboxItems: UnifiedInboxItem[],
): {
  issues: ConsistencyIssue[];
  errorCount: number;
  warningCount: number;
  summary: string;
} {
  const allIssues: ConsistencyIssue[] = [];

  // Per-entity inbox consistency
  for (const opState of operationalStates) {
    allIssues.push(...verifyEntityInboxConsistency(opState, inboxItems));
  }

  // Handoff integrity
  allIssues.push(...verifyHandoffIntegrity(operationalStates));

  // Stale state detection
  allIssues.push(...verifyStaleStates(operationalStates, inboxItems));

  const errorCount = allIssues.filter((i) => i.severity === 'error').length;
  const warningCount = allIssues.filter((i) => i.severity === 'warning').length;

  return {
    issues: allIssues,
    errorCount,
    warningCount,
    summary: errorCount === 0 && warningCount === 0
      ? `✓ All ${operationalStates.length} entities consistent across surfaces`
      : `${errorCount} errors, ${warningCount} warnings across ${operationalStates.length} entities`,
  };
}

// ===========================================================================
// Utility
// ===========================================================================

function priorityToNumber(p: string): number {
  const map: Record<string, number> = { p0: 0, p1: 1, p2: 2, p3: 3 };
  return map[p] ?? 3;
}
