"use client";

/**
 * useDispatchGovernanceSync — Dispatch workbench용 governance bus 구독 hook
 *
 * 책임:
 * 1. GovernanceEventBus에 구독하여 dispatch 관련 이벤트를 수신
 * 2. dispatch-invalidation-engine의 computeInvalidation/computeDockLocks 실행
 * 3. 재계산이 필요한 경우 caller에게 콜백으로 통지
 * 4. DockActionLockState를 반환하여 Send Now/Schedule Send 잠금 상태 제공
 *
 * IMMUTABLE RULES:
 * - canonical truth 변경 X — read-only subscription
 * - broad global refresh 금지 — targeted invalidation만
 * - optimistic unlock 금지 — 실제 계산 결과로만 action이 열림
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { getGlobalGovernanceEventBus } from "@/lib/ai/governance-event-bus";
import {
  computeInvalidation,
  computeDockLocks,
  shouldRecalcReadiness,
  type DispatchInvalidationEvent,
  type DispatchInvalidationEventType,
  type DispatchInvalidationPayload,
  type InvalidationResult,
  type DockActionLockState,
} from "@/lib/ai/dispatch-invalidation-engine";
import type { DispatchGovernanceReadiness } from "@/lib/ai/po-dispatch-governance-engine";

// ══════════════════════════════════════════════
// Hook Input / Output
// ══════════════════════════════════════════════

export interface UseDispatchGovernanceSyncInput {
  /** 현재 PO 번호 */
  poNumber: string;
  /** 현재 case ID */
  caseId: string;
  /** 현재 governance readiness */
  readiness: DispatchGovernanceReadiness;
  /** snapshot 유효성 */
  snapshotValid: boolean;
  /** 확인 체크리스트 전체 완료 여부 */
  allConfirmed: boolean;
  /** readiness 재계산이 필요할 때 호출되는 콜백 */
  onReadinessRecalcNeeded?: () => void;
  /** invalidation 이벤트가 발생했을 때 호출되는 콜백 */
  onInvalidationReceived?: (result: InvalidationResult) => void;
}

export interface UseDispatchGovernanceSyncResult {
  /** Dock 버튼 잠금 상태 (Send Now, Schedule Send 등) */
  dockLocks: DockActionLockState;
  /** 최근 수신된 invalidation 결과 */
  lastInvalidation: InvalidationResult | null;
  /** irreversible action(Send Now)이 잠겨 있는지 */
  irreversibleLocked: boolean;
}

// ══════════════════════════════════════════════
// Dispatch-relevant event types
// ══════════════════════════════════════════════

const DISPATCH_RELEVANT_EVENT_TYPES: ReadonlySet<string> = new Set<string>([
  "po_conversion_completed",
  "po_conversion_reopened",
  "supplier_profile_changed",
  "approval_snapshot_invalidated",
  "policy_hold_changed",
  "attachment_changed",
  "send_scheduled",
  "schedule_cancelled",
  "po_data_changed_after_approval",
]);

// ══════════════════════════════════════════════
// Hook
// ══════════════════════════════════════════════

export function useDispatchGovernanceSync(
  input: UseDispatchGovernanceSyncInput,
): UseDispatchGovernanceSyncResult {
  const {
    poNumber,
    caseId,
    readiness,
    snapshotValid,
    allConfirmed,
    onReadinessRecalcNeeded,
    onInvalidationReceived,
  } = input;

  const [lastInvalidation, setLastInvalidation] = useState<InvalidationResult | null>(null);

  // Refs for stable callback access
  const readinessRef = useRef(readiness);
  readinessRef.current = readiness;
  const onRecalcRef = useRef(onReadinessRecalcNeeded);
  onRecalcRef.current = onReadinessRecalcNeeded;
  const onInvalidRef = useRef(onInvalidationReceived);
  onInvalidRef.current = onInvalidationReceived;

  // Subscribe to governance event bus
  useEffect(() => {
    let bus: ReturnType<typeof getGlobalGovernanceEventBus>;
    try {
      bus = getGlobalGovernanceEventBus();
    } catch {
      return;
    }

    const subscriptionId = bus.subscribe({
      domains: [],
      chainStages: [],
      caseId: null,
      poNumber,
      severities: [],
      handler: (event) => {
        // Only dispatch-relevant events for this PO
        if (!DISPATCH_RELEVANT_EVENT_TYPES.has(event.eventType)) return;

        // Build DispatchInvalidationEvent from bus event
        const invalidationEvent: DispatchInvalidationEvent = {
          type: event.eventType as DispatchInvalidationEventType,
          caseId: event.caseId ?? caseId,
          poNumber: event.poNumber ?? poNumber,
          timestamp: event.timestamp ?? new Date().toISOString(),
          actor: event.actor ?? "system",
          payload: (event.payload ?? { kind: event.eventType }) as DispatchInvalidationPayload,
        };

        // Compute invalidation result
        const result = computeInvalidation(invalidationEvent);
        setLastInvalidation(result);

        // Notify caller
        onInvalidRef.current?.(result);

        // Check if readiness recalculation is needed
        if (shouldRecalcReadiness({ currentReadiness: readinessRef.current, invalidation: result })) {
          onRecalcRef.current?.();
        }
      },
    });

    return () => {
      bus.unsubscribe(subscriptionId);
    };
  }, [poNumber, caseId]);

  // Compute dock locks from current state
  const dockLocks = computeDockLocks(readiness, lastInvalidation, snapshotValid, allConfirmed);

  return {
    dockLocks,
    lastInvalidation,
    irreversibleLocked: dockLocks.sendNowLocked,
  };
}
